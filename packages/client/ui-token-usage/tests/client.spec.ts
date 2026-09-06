// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply, inject, name } from '../src/client/index.ts'
import { ControllerBinding, OverlayToggle, TokenUsageController } from '../src/client/controller.ts'
import { TokenUsagePanel } from '../src/client/panel.tsx'

afterEach(cleanup)

type Row = { id: string; order?: number; component: (props?: Record<string, unknown>) => unknown; inject?: () => Record<string, unknown> }

class FakeSlots {
  private readonly buckets = new Map<string, Row[]>()
  private currentSlot = 'conversation.session.header.actions'

  inject(slot: string, setup: () => unknown): () => void {
    const previous = this.currentSlot
    this.currentSlot = slot
    try {
      const disposer = setup()
      return typeof disposer === 'function' ? (disposer as () => void) : () => {}
    } finally {
      this.currentSlot = previous
    }
  }

  register(input: { id: string; order?: number; inject?: () => Record<string, unknown> }, component: (props?: Record<string, unknown>) => unknown): () => void {
    const rows = this.buckets.get(this.currentSlot) ?? []
    rows.push({ id: input.id, order: input.order, component, ...(input.inject === undefined ? {} : { inject: input.inject }) })
    this.buckets.set(this.currentSlot, rows)
    return () => {}
  }

  entries(slot: string): readonly Row[] {
    return this.buckets.get(slot) ?? []
  }
}

function fakeCtx(options: { readonly pane?: boolean; readonly remote?: unknown } = {}) {
  const slots = new FakeSlots()
  const views: Array<{ descriptor: Record<string, unknown>; component: (props?: unknown) => unknown }> = []
  const opened: Array<Record<string, unknown>> = []
  const ctx = {
    slots,
    locale: undefined,
    ...(options.pane === true
      ? {
        paneWorkbench: {
          registerView: (view: { descriptor: Record<string, unknown>; component: (props?: unknown) => unknown }) => { views.push(view); return () => {} },
          openView: (request: Record<string, unknown>) => { opened.push(request) },
        },
      }
      : {}),
    ...(options.remote === undefined ? {} : { remote: options.remote }),
  }
  return { ctx, slots, views, opened }
}

function readyRemote() {
  const usage = {
    schemaVersion: 'token.usage.snapshot.v1alpha1' as const,
    generatedAt: '2026-08-27T12:00:00.000Z',
    freshness: 'fresh' as const,
    windows: {
      today: { uncachedInputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 },
      week: { uncachedInputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 },
      process: { uncachedInputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 },
    },
    bySession: [] as never[],
    byProvider: [] as never[],
    truncated: false,
  }
  const balance = {
    schemaVersion: 'token.balance.snapshot.v1alpha1' as const,
    status: 'ready' as const,
    freshness: 'fresh' as const,
    generatedAt: '2026-08-27T12:00:00.000Z',
    safeMessage: 'DeepSeek balance.',
    isAvailable: true,
    infos: [{ currency: 'CNY' as const, totalBalance: '110.00', grantedBalance: '10.00', toppedUpBalance: '100.00' }],
  }
  return {
    tokenUsage: {
      snapshot: vi.fn(async () => ({ ok: true as const, specVersion: '1.0' as const, usage, balance })),
      refreshBalance: vi.fn(async () => ({ ok: true as const, specVersion: '1.0' as const, balance })),
    },
  }
}

const entryFace = (row: Row) => row.inject?.() ?? {}

/** Full valid insights snapshot for a session, with a distinctive model label. */
function insightsSnapshotFor(sessionRef: string, model: string) {
  const buckets = { uncachedInputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0 }
  return {
    schemaVersion: 'session.insights.snapshot.v1alpha1' as const,
    sessionRef,
    scope: 'session' as const,
    revision: 1,
    generatedAt: '2026-09-05T08:00:00.000Z',
    freshness: 'fresh' as const,
    coverage: { status: 'complete' as const, knownRequests: 1 },
    source: { history: 'session_query' as const, context: 'session_projections' as const, cost: 'unknown' as const },
    totals: { buckets, requestCount: 1, sumRequestDurationMs: 100, wallClockMs: 90 },
    context: { status: 'available' as const, used: 100, limit: 1000, remaining: 900 },
    byModel: { rows: [{ key: model, label: model, requestCount: 1, buckets }], truncated: false },
    byProvider: { rows: [] as never[], truncated: false },
    requests: [{ attemptRef: `att_${sessionRef}`, sessionRef, buckets, model, status: 'completed' as const }],
    truncated: false,
  }
}

/** Fake official session-manager host provided on the Cordis context key. */
function fakeSessionDirectoryHost() {
  return {
    version: '0.1.0-rc.1',
    capability: 'session-manager',
    listSessions: vi.fn(async () => [
      { sessionId: 'sess_a', title: 'Session A', archived: false, running: false, unread: false, labels: [] },
      { sessionId: 'sess_b', title: 'Session B', archived: false, running: true, unread: false, labels: [] },
    ]),
  }
}

/** New-host remote: capabilities() + query() alongside the legacy methods. */
function insightsRemote(queryImpl?: (input: Record<string, unknown>) => unknown) {
  const base = readyRemote()
  const insights = {
    schemaVersion: 'session.insights.snapshot.v1alpha1' as const,
    sessionRef: 'sess_a',
    scope: 'session' as const,
    revision: 3,
    generatedAt: '2026-09-05T08:00:00.000Z',
    freshness: 'fresh' as const,
    coverage: { status: 'complete' as const, knownRequests: 1 },
    source: { history: 'session_query' as const, context: 'session_projections' as const, cost: 'unknown' as const },
    totals: {
      buckets: { uncachedInputTokens: 6400, outputTokens: 1200, cacheReadTokens: 300, cacheWriteTokens: 0 },
      requestCount: 1,
      sumRequestDurationMs: 800,
      wallClockMs: 700,
    },
    context: { status: 'available' as const, used: 1200, limit: 10000, remaining: 8800 },
    byModel: { rows: [{ key: 'deepseek-chat', label: 'deepseek-chat', requestCount: 1, buckets: { uncachedInputTokens: 6400, outputTokens: 1200, cacheReadTokens: 300, cacheWriteTokens: 0 } }], truncated: false },
    byProvider: { rows: [], truncated: false },
    requests: [{ attemptRef: 'att_1', requestRef: 'req_1', runRef: 'run_1', sessionRef: 'sess_a', happenedAt: '2026-09-05T07:59:00.000Z', buckets: { uncachedInputTokens: 6400, outputTokens: 1200, cacheReadTokens: 300, cacheWriteTokens: 0 }, model: 'deepseek-chat', status: 'completed' as const }],
    truncated: false,
  }
  return {
    tokenUsage: {
      ...base.tokenUsage,
      capabilities: vi.fn(async () => ({
        ok: true as const,
        specVersion: '1.0' as const,
        capabilities: { query: { available: true, schemaVersion: 'session.insights.snapshot.v1alpha1' } },
      })),
      query: vi.fn(async (input: Record<string, unknown>) => {
        const produced = queryImpl?.(input) ?? { ok: true as const, specVersion: '1.0' as const, snapshot: { ...insights, sessionRef: String(input.sessionRef) } }
        return produced
      }),
    },
  }
}

describe('client apply', () => {
  it('declares the always-present services and the plugin identity', () => {
    expect(name).toBe('client-ui-token-usage')
    expect(inject).toEqual(['slots', 'locale'])
  })

  it('registers the pane view and opens it from the header entry once the remote lands', async () => {
    const { ctx, slots, views, opened } = fakeCtx({ pane: true, remote: readyRemote() })
    const dispose = apply(ctx as never)
    expect(views.map(view => view.descriptor.kind)).toContain('workspace.token-usage')
    const entry = slots.entries('conversation.session.header.actions').find(row => row.id === 'token-usage-open')
    expect(entry).toBeDefined()
    await new Promise(resolve => { setTimeout(resolve, 0) })
    const face = entryFace(entry!) as { openTokens: () => void; isReady: () => boolean }
    expect(face.isReady()).toBe(true)
    const button = entry!.component({ openTokens: face.openTokens, isReady: face.isReady, disabledReason: () => 'x' }) as { props: { disabled: boolean; onClick: () => void } }
    expect(button.props.disabled).toBe(false)
    button.props.onClick()
    expect(opened[0]).toMatchObject({ kind: 'workspace.token-usage', preferredRegion: 'right' })
    dispose()
  })

  it('renders the pane surface with panel content after the remote resolves', async () => {
    const { ctx, views } = fakeCtx({ pane: true, remote: readyRemote() })
    const dispose = apply(ctx as never)
    const view = views.find(candidate => candidate.descriptor.kind === 'workspace.token-usage')
    await new Promise(resolve => { setTimeout(resolve, 0) })
    const mounted = render(createElement(() => view!.component() as never))
    await waitFor(() => { expect(mounted.container.innerHTML).toContain('110.00') })
    expect(mounted.container.innerHTML).toContain('Tokens')
    dispose()
  })

  it('registers the overlay seat instead of a pane view when Pane Workbench is missing', async () => {
    const { ctx, slots, views } = fakeCtx({ pane: false, remote: readyRemote() })
    const dispose = apply(ctx as never)
    expect(views).toHaveLength(0)
    const overlay = slots.entries('shell.overlay').find(row => row.id === 'yeisme.token-usage.dialog')
    expect(overlay).toBeDefined()
    await new Promise(resolve => { setTimeout(resolve, 0) })
    // Idle overlay renders nothing (resident seat, zero output when closed).
    const idle = render(createElement(() => overlay!.component() as never))
    expect(idle.container.innerHTML).toBe('')
    idle.unmount()
    dispose()
  })

  it('treats a missing optional service as absent on guarded Cordis contexts', () => {
    const slots = new FakeSlots()
    const guarded = new Proxy({
      get: (key: string) => key === 'slots' ? slots : key === 'locale' ? {} : undefined,
    }, {
      get(target, key, receiver) {
        if (key === 'paneWorkbench') throw new Error('cannot get property without inject')
        return Reflect.get(target, key, receiver)
      },
    })

    expect(() => apply(guarded as never)).not.toThrow()
  })

  it('opens the overlay from the entry and closes it via Escape', async () => {
    const { ctx, slots } = fakeCtx({ pane: false, remote: readyRemote() })
    const dispose = apply(ctx as never)
    await new Promise(resolve => { setTimeout(resolve, 0) })
    const overlay = slots.entries('shell.overlay').find(row => row.id === 'yeisme.token-usage.dialog')
    const entry = slots.entries('conversation.session.header.actions').find(row => row.id === 'token-usage-open')
    const face = entryFace(entry!) as { openTokens: () => void; isReady: () => boolean }
    const mounted = render(createElement(() => overlay!.component() as never))
    expect(mounted.container.innerHTML).toBe('')
    face.openTokens()
    await waitFor(() => { expect(document.querySelector('[data-dsh-token-usage-overlay]')).toBeTruthy() })
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => { expect(document.querySelector('[data-dsh-token-usage-overlay]')).toBeNull() })
    mounted.unmount()
    dispose()
  })

  it('keeps the entry disabled when the remote never resolves', async () => {
    const { ctx, slots } = fakeCtx({ pane: true })
    const dispose = apply(ctx as never)
    await new Promise(resolve => { setTimeout(resolve, 5) })
    const entry = slots.entries('conversation.session.header.actions').find(row => row.id === 'token-usage-open')
    const face = entryFace(entry!) as { isReady: () => boolean; disabledReason: () => string }
    expect(face.isReady()).toBe(false)
    const rendered = entry!.component({ openTokens: () => {}, isReady: face.isReady, disabledReason: face.disabledReason }) as { props: { disabled: boolean; title: string } }
    expect(rendered.props.disabled).toBe(true)
    expect(rendered.props.title).toContain('unavailable')
    dispose()
  })

  it('exposes the binding/toggle helpers for late controller arrival', async () => {
    const binding = new ControllerBinding()
    const toggle = new OverlayToggle()
    expect(binding.getSnapshot()).toBeUndefined()
    expect(toggle.isOpen()).toBe(false)
    const remote = readyRemote()
    binding.attach(new TokenUsageController(remote.tokenUsage as never))
    expect(binding.getSnapshot()).toBeDefined()
    toggle.setOpen(true)
    expect(toggle.isOpen()).toBe(true)
    const html = render(createElement(TokenUsagePanel, {
      model: {
        usageAvailable: true, usageError: null, usageStale: false, currentSession: null, todayText: '3', weekText: '3', processText: '3',
        bySession: [], byProvider: [], truncated: false,
        balance: { visible: false, lines: [], freshness: 'unknown', message: null, canRefresh: true, error: null, busy: false, queried: false },
        generatedAt: null,
      },
      t: key => key,
    })).container.innerHTML
    expect(html).not.toMatch(/sk-|bearer|authorization|apikey/iu)
  })

  it('upgrades the entry from overlay to pane when the pane service arrives late', async () => {
    const { ctx, slots } = fakeCtx({ pane: false, remote: readyRemote() })
    const dispose = apply(ctx as never)
    await new Promise(resolve => { setTimeout(resolve, 0) })
    const entry = slots.entries('conversation.session.header.actions').find(row => row.id === 'token-usage-open')
    const face = entryFace(entry!) as { openTokens: () => void; isReady: () => boolean }
    expect(face.isReady()).toBe(true)
    // Pane Workbench lands after plugin start: the entry must not stay locked
    // to the popover from the one-time apply probe.
    const opened: Array<Record<string, unknown>> = [];
    (ctx as Record<string, unknown>).paneWorkbench = {
      registerView: () => () => {},
      openView: (request: Record<string, unknown>) => { opened.push(request) },
    }
    face.openTokens()
    expect(opened[0]).toMatchObject({ kind: 'workspace.token-usage' })
    dispose()
  })

  it('binds the statistics pane to the metadata sessionRef from openView', async () => {
    const remote = insightsRemote()
    const { ctx, views } = fakeCtx({ pane: true, remote })
    const dispose = apply(ctx as never)
    await new Promise(resolve => { setTimeout(resolve, 0) })
    await new Promise(resolve => { setTimeout(resolve, 0) })
    const view = views.find(candidate => candidate.descriptor.kind === 'workspace.token-usage')
    const mounted = render(createElement(() => view!.component({
      view: { resourceKey: 'token-usage:session:sess_a', metadata: { sessionRef: 'sess_a' } },
    }) as never))
    await waitFor(() => { expect(remote.tokenUsage.query).toHaveBeenCalledWith(expect.objectContaining({ sessionRef: 'sess_a', scope: 'session' })) })
    await waitFor(() => { expect(mounted.container.innerHTML).toContain('deepseek-chat') })
    expect(mounted.container.innerHTML).toContain('Session statistics')
    // No subscription seam on this fake → manual-refresh messaging, never live promises.
    expect(mounted.container.innerHTML).toContain('refresh manually')
    mounted.unmount()
    dispose()
  })

  it('keeps two sessions isolated via resourceKey/metadata (A and B side by side)', async () => {
    const remote = insightsRemote()
    const { ctx, views } = fakeCtx({ pane: true, remote })
    const dispose = apply(ctx as never)
    await new Promise(resolve => { setTimeout(resolve, 0) })
    await new Promise(resolve => { setTimeout(resolve, 0) })
    const view = views.find(candidate => candidate.descriptor.kind === 'workspace.token-usage')
    const mountedA = render(createElement(() => view!.component({ view: { resourceKey: 'token-usage:session:sess_a', metadata: { sessionRef: 'sess_a' } } }) as never))
    const mountedB = render(createElement(() => view!.component({ view: { resourceKey: 'token-usage:session:sess_b', metadata: { sessionRef: 'sess_b' } } }) as never))
    await waitFor(() => {
      expect(remote.tokenUsage.query).toHaveBeenCalledWith(expect.objectContaining({ sessionRef: 'sess_a' }))
      expect(remote.tokenUsage.query).toHaveBeenCalledWith(expect.objectContaining({ sessionRef: 'sess_b' }))
    })
    await waitFor(() => { expect(mountedB.container.innerHTML).toContain('sess_b') })
    mountedA.unmount()
    mountedB.unmount()
    dispose()
  })

  it('labels the legacy snapshot() fallback explicitly on an old host', async () => {
    const { ctx, views } = fakeCtx({ pane: true, remote: readyRemote() })
    const dispose = apply(ctx as never)
    await new Promise(resolve => { setTimeout(resolve, 0) })
    const view = views.find(candidate => candidate.descriptor.kind === 'workspace.token-usage')
    const mounted = render(createElement(() => view!.component() as never))
    await waitFor(() => { expect(mounted.container.innerHTML).toContain('Legacy process-observed statistics') })
    expect(mounted.container.innerHTML).toContain('110.00')
    mounted.unmount()
    dispose()
  })

  it('explains the missing binding when the pane has no sessionRef metadata', async () => {
    const remote = insightsRemote()
    const { ctx, views } = fakeCtx({ pane: true, remote })
    const dispose = apply(ctx as never)
    await new Promise(resolve => { setTimeout(resolve, 0) })
    await new Promise(resolve => { setTimeout(resolve, 0) })
    const view = views.find(candidate => candidate.descriptor.kind === 'workspace.token-usage')
    const mounted = render(createElement(() => view!.component({ view: { resourceKey: 'token-usage:process' } }) as never))
    await waitFor(() => { expect(mounted.container.innerHTML).toContain('No session is bound') })
    expect(remote.tokenUsage.query).not.toHaveBeenCalled()
    mounted.unmount()
    dispose()
  })

  it('recomputes translations when the locale provider arrives late', async () => {
    const remote = insightsRemote()
    const { ctx, views } = fakeCtx({ pane: true, remote })
    const dispose = apply(ctx as never)
    await new Promise(resolve => { setTimeout(resolve, 0) })
    await new Promise(resolve => { setTimeout(resolve, 0) })
    const { zh } = await import('../src/client/locales.ts')
    ;(ctx as Record<string, unknown>).locale = { bind: (ns: string) => (key: keyof typeof zh) => zh[key] }
    const view = views.find(candidate => candidate.descriptor.kind === 'workspace.token-usage')
    const mounted = render(createElement(() => view!.component({
      view: { resourceKey: 'token-usage:session:sess_a', metadata: { sessionRef: 'sess_a' } },
    }) as never))
    await waitFor(() => { expect(mounted.container.innerHTML).toContain('会话统计') })
    mounted.unmount()
    dispose()
  })

  it('returns focus to the same-session trigger when the overlay closes via Escape', async () => {
    const { ctx, slots } = fakeCtx({ pane: false, remote: readyRemote() })
    const dispose = apply(ctx as never)
    await new Promise(resolve => { setTimeout(resolve, 0) })
    const overlay = slots.entries('shell.overlay').find(row => row.id === 'yeisme.token-usage.dialog')
    const entry = slots.entries('conversation.session.header.actions').find(row => row.id === 'token-usage-open')
    const face = entryFace(entry!) as { openTokens: (sessionRef?: string, trigger?: HTMLElement) => void; isReady: () => boolean }
    const mounted = render(createElement(() => createElement('div', null,
      entry!.component({ openTokens: face.openTokens, isReady: face.isReady, disabledReason: () => 'x' }) as never,
      overlay!.component() as never,
    )))
    const trigger = mounted.container.querySelector('button')!
    trigger.focus()
    fireEvent.click(trigger)
    await waitFor(() => { expect(document.querySelector('[data-dsh-token-usage-overlay]')).toBeTruthy() })
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => { expect(document.querySelector('[data-dsh-token-usage-overlay]')).toBeNull() })
    expect(document.activeElement).toBe(trigger)
    mounted.unmount()
    dispose()
  })

  it('switches the statistics target via the official directory and discards late old-target replies', async () => {
    let resolveA: ((value: unknown) => void) | undefined
    const remote = insightsRemote((input) => {
      if (input.sessionRef === 'sess_a') {
        return new Promise(resolve => { resolveA = resolve })
      }
      return { ok: true as const, specVersion: '1.0' as const, snapshot: insightsSnapshotFor(String(input.sessionRef), 'model-b') }
    })
    const directoryHost = fakeSessionDirectoryHost()
    const { ctx, views } = fakeCtx({ pane: true, remote })
    ;(ctx as Record<string, unknown>)['dsh.sessionManagerHost'] = directoryHost
    const dispose = apply(ctx as never)
    await new Promise(resolve => { setTimeout(resolve, 0) })
    await new Promise(resolve => { setTimeout(resolve, 0) })
    const view = views.find(candidate => candidate.descriptor.kind === 'workspace.token-usage')
    const mounted = render(createElement(() => view!.component({
      view: { resourceKey: 'token-usage:session:sess_a', metadata: { sessionRef: 'sess_a' } },
    }) as never))
    // Pinned to sess_a; its (deferred) read stays in flight.
    await waitFor(() => { expect(remote.tokenUsage.query).toHaveBeenCalledWith(expect.objectContaining({ sessionRef: 'sess_a', scope: 'session' })) })
    fireEvent.click(mounted.getByRole('button', { name: 'Switch statistics target' }))
    await waitFor(() => { expect(mounted.container.querySelectorAll('[data-insights-directory-row]')).toHaveLength(2) })
    expect(directoryHost.listSessions).toHaveBeenCalledTimes(1)
    const rowB = [...mounted.container.querySelectorAll('[data-insights-directory-row]')]
      .find(candidate => candidate.textContent?.includes('Session B')) as HTMLElement
    fireEvent.click(within(rowB).getByRole('button', { name: 'Show statistics' }))
    // The explicit switch re-binds through the registry: new target key.
    await waitFor(() => { expect(remote.tokenUsage.query).toHaveBeenCalledWith(expect.objectContaining({ sessionRef: 'sess_b', scope: 'session' })) })
    await waitFor(() => { expect(mounted.container.innerHTML).toContain('model-b') })
    expect(mounted.container.querySelector('[data-insights-directory]')).toBeNull()
    // A's late reply arrives after the switch: it must not overwrite B.
    resolveA?.({ ok: true, specVersion: '1.0', snapshot: insightsSnapshotFor('sess_a', 'late-model-a') })
    await new Promise(resolve => { setTimeout(resolve, 0) })
    await new Promise(resolve => { setTimeout(resolve, 0) })
    expect(mounted.container.innerHTML).not.toContain('late-model-a')
    expect(mounted.container.innerHTML).toContain('model-b')
    expect(mounted.container.innerHTML).toContain('sess_b')
    mounted.unmount()
    dispose()
  })

  it('keeps the target pinned with a disabled switcher when the session directory seam is absent', async () => {
    const remote = insightsRemote()
    const { ctx, views } = fakeCtx({ pane: true, remote })
    const dispose = apply(ctx as never)
    await new Promise(resolve => { setTimeout(resolve, 0) })
    await new Promise(resolve => { setTimeout(resolve, 0) })
    const view = views.find(candidate => candidate.descriptor.kind === 'workspace.token-usage')
    const mounted = render(createElement(() => view!.component({
      view: { resourceKey: 'token-usage:session:sess_a', metadata: { sessionRef: 'sess_a' } },
    }) as never))
    await waitFor(() => { expect(mounted.container.innerHTML).toContain('deepseek-chat') })
    const button = mounted.getByRole('button', { name: 'Switch statistics target' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('title')).toContain('official session directory')
    fireEvent.click(button)
    expect(mounted.container.querySelector('[data-insights-directory]')).toBeNull()
    // Only the pinned session was ever queried.
    for (const call of remote.tokenUsage.query.mock.calls) {
      expect(call[0]).toMatchObject({ sessionRef: 'sess_a' })
    }
    mounted.unmount()
    dispose()
  })
})
