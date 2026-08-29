// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
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
        usageAvailable: true, currentSession: null, todayText: '3', weekText: '3', processText: '3',
        bySession: [], byProvider: [], truncated: false,
        balance: { visible: false, lines: [], freshness: 'unknown', message: null, canRefresh: true },
        generatedAt: null,
      },
      t: key => key,
    })).container.innerHTML
    expect(html).not.toMatch(/sk-|bearer|authorization|apikey/iu)
  })
})
