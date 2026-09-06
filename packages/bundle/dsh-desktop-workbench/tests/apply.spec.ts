// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { apply as applyDesktopWorkbench, DesktopWorkbenchOverlay, inject } from '../src/client/apply.ts'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { FileHostV1 } from '@yeisme/dsh-file-host'
import type { TerminalHostV2 } from '@yeisme/dsh-terminal-host'
import type { MediaHostV1 } from '@yeisme/dsh-rich-media'
import { getComposerReferenceController, getComposerReferenceDraftControllerV2, getExplorerRuntime } from '@yeisme/dsh-client-ui-pane-workbench/client'

const activeDisposers = new Set<() => void>()

function apply(ctx: ClientContext): () => void {
  const dispose = applyDesktopWorkbench(ctx)
  let active = true
  const tracked = (): void => {
    if (!active) return
    active = false
    activeDisposers.delete(tracked)
    dispose()
  }
  activeDisposers.add(tracked)
  return tracked
}

afterEach(() => {
  for (const dispose of [...activeDisposers]) dispose()
  cleanup()
})

function workspacesBrowse(listDirectory = vi.fn(async () => ({ path: '/workspace', entries: [] }))) {
  return {
    listDirectory,
    list: {
      getSnapshot: () => ({
        items: [{ path: '/workspace', sessionIds: ['s-1'] }],
      }),
    },
  }
}

function fakeClientContext(options: {
  terminalHost?: unknown
  mediaHost?: MediaHostV1
  fileHost?: FileHostV1
  workspaces?: ReturnType<typeof workspacesBrowse>
  workspaceLayout?: unknown
  composerReferenceBridge?: unknown
  provided?: Map<string, unknown>
} = {}): ClientContext {
  const register = vi.fn(() => vi.fn())
  const injectSlot = vi.fn((_name: string, setup: () => () => void) => setup())
  const registerView = vi.fn(() => vi.fn())
  const openView = vi.fn()
  const slots = { inject: injectSlot, register }
  const paneWorkbench = { registerView, openView }
  const sessions = {
    list: { getSnapshot: () => ({ current: 's-1' }) },
  }
  const provided = options.provided ?? new Map<string, unknown>()
  return {
    slots,
    provide: vi.fn((name: string, service: unknown) => { provided.set(name, service); return () => { provided.delete(name) } }),
    get: vi.fn((name: string) => provided.has(name) ? provided.get(name)
      : name === 'slots' ? slots
      : name === 'paneWorkbench' ? paneWorkbench
      : name === 'dsh.terminalHost' ? options.terminalHost
      : name === 'dsh.mediaHost' ? options.mediaHost
      : name === 'dsh.fileHost' ? options.fileHost
      : name === 'workspaces' ? options.workspaces
      : name === 'sessions' ? sessions
      : name === 'workspaceLayout' ? options.workspaceLayout
      : name === 'composerReferenceBridge' ? options.composerReferenceBridge
      : undefined),
  } as unknown as ClientContext
}

function terminalHost(): TerminalHostV2 {
  return {
    version: '0.2.0-rc.1',
    capability: 'terminal-host',
    async listTerminals() { return [] },
    async openTerminal(title = 'zsh') { return { terminalId: 't-1', title, running: true } },
    async closeTerminal(terminalId) { return { status: 'ok', terminalId } },
    async writeInput(terminalId) { return { status: 'ok', terminalId } },
    async resizeTerminal(terminalId) { return { status: 'ok', terminalId } },
    async attachTerminal() { throw new Error('not needed in apply tests') },
  }
}

function fileHost(): FileHostV1 {
  return {
    version: '0.1.0-rc.1',
    capability: 'file-host',
    async listEntries() { return [] },
  }
}

it('waits for the canonical pane registry on unified hosts before registering desktop views', () => {
  const unified = { version: 'workspace.unified.v1', registerView: vi.fn(), openPane: vi.fn() }
  const ctx = fakeClientContext({ workspaceLayout: unified, workspaces: workspacesBrowse() })
  const originalGet = ctx.get.bind(ctx)
  const registry = originalGet('paneWorkbench' as never) as unknown as { registerView: ReturnType<typeof vi.fn> }
  const effects: Array<() => void> = []
  let ready = false
  let attach: ((scope: ClientContext) => unknown) | undefined
  const mutable = ctx as unknown as {
    get(name: string): unknown
    inject(services: string[], body: (scope: ClientContext) => unknown): { dispose(): void }
    effect(setup: () => () => void): void
  }
  mutable.get = name => name === 'layout' ? {} : name === 'paneWorkbench' && !ready ? undefined : originalGet(name as never)
  mutable.inject = (services, body) => {
    if (services.includes('paneWorkbench')) attach = body
    return { dispose() { for (const dispose of effects.splice(0)) dispose() } }
  }
  mutable.effect = setup => { effects.push(setup()) }
  const dispose = apply(ctx)
  expect(attach).toBeTypeOf('function')
  expect(unified.registerView).not.toHaveBeenCalled()
  expect(registry.registerView).not.toHaveBeenCalled()
  ready = true
  attach!(ctx)
  expect(registry.registerView).toHaveBeenCalledWith(expect.objectContaining({ descriptor: expect.objectContaining({ kind: 'desktop.git' }) }))
  expect(unified.registerView).not.toHaveBeenCalled()
  dispose()
})

describe('desktop workbench client apply', () => {
  it('declares slots injection', () => {
    expect(inject).toEqual(['slots', 'workspaces'])
  })

  it('does not register terminal placeholders when that owner is absent', () => {
    const ctx = fakeClientContext()
    const disposer = apply(ctx)
    const pane = ctx.get('paneWorkbench' as never) as unknown as {
      registerView: ReturnType<typeof vi.fn>
      openView: ReturnType<typeof vi.fn>
    }
    const kinds = pane.registerView.mock.calls.map(call => call[0].descriptor.kind)
    expect(kinds).toContain('desktop.files')
    expect(kinds).toContain('desktop.file')
    expect(kinds).toContain('desktop.git')
    expect(kinds).toContain('desktop.media')
    expect(kinds).toContain('desktop.sessions')
    expect(kinds).not.toContain('desktop.terminal')
    expect(pane.openView).not.toHaveBeenCalled()
    expect(ctx.slots.inject).not.toHaveBeenCalledWith('shell.overlay', expect.any(Function))
    expect(typeof disposer).toBe('function')
  })

  it('registers a media overlay that shows an honest empty state without a media host', () => {
    const ctx = fakeClientContext()
    apply(ctx)
    const pane = ctx.get('paneWorkbench' as never) as unknown as { registerView: ReturnType<typeof vi.fn> }
    const media = pane.registerView.mock.calls.find(call => call[0].descriptor.kind === 'desktop.media')?.[0]
    expect(media).toBeDefined()
    render(media?.component?.())
    expect(screen.getByRole('status').textContent).toContain('没有可预览媒体投影')
  })

  it('auto-opens the files navigator only when the Core Pane layout host is present', () => {
    const ctx = fakeClientContext({ workspaceLayout: { attach: vi.fn() } })
    apply(ctx)
    const pane = ctx.get('paneWorkbench' as never) as unknown as { openView: ReturnType<typeof vi.fn> }
    expect(pane.openView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'dsh.explorer', preferredRegion: 'right' }))
  })

  it('registers a hidden desktop.files shim and routes it to canonical Explorer', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        value: {
          path: '/workspace',
          entries: [
            { name: 'src', path: '/workspace/src', isDir: true, hidden: false },
            { name: 'README.md', path: '/workspace/README.md', isDir: false, hidden: false },
          ],
        },
      }),
    }))
    vi.stubGlobal('fetch', fetchImpl)
    const ctx = fakeClientContext({ workspaces: workspacesBrowse() })
    const dispose = apply(ctx)
    const pane = ctx.get('paneWorkbench' as never) as unknown as { registerView: ReturnType<typeof vi.fn>; openView: ReturnType<typeof vi.fn> }
    const files = pane.registerView.mock.calls.find(call => call[0].descriptor.kind === 'desktop.files')?.[0]
    expect(files).toMatchObject({ showInPicker: false })
    expect(files.descriptor, 'safe contract: no unknown keys').not.toHaveProperty('deprecated')
    render(createElement(files.component))
    expect(pane.openView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'dsh.explorer' }))
    expect(ctx.slots.inject).toHaveBeenCalledWith('sidebar.footer.action', expect.any(Function))
    dispose()
    vi.unstubAllGlobals()
  })

  it('probes an owner-provided dsh.fileHost before the workspaces browse adapter', () => {
    const owner = fileHost()
    const workspaces = workspacesBrowse()
    const ctx = fakeClientContext({ fileHost: owner, workspaces })
    const dispose = apply(ctx)
    expect(ctx.get).toHaveBeenCalledWith('dsh.fileHost')
    expect(workspaces.listDirectory).not.toHaveBeenCalled()
    dispose()
  })

  it('does not let the desktop.files compatibility shim bypass strict preview admission', () => {
    const ctx = fakeClientContext({ fileHost: fileHost() })
    apply(ctx)
    const pane = ctx.get('paneWorkbench' as never) as unknown as { registerView: ReturnType<typeof vi.fn>; openView: ReturnType<typeof vi.fn> }
    const files = pane.registerView.mock.calls.find(call => call[0].descriptor.kind === 'desktop.files')?.[0]
    render(createElement(files.component))
    expect(pane.openView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'dsh.explorer' }))
    expect(pane.openView).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'desktop.file' }))
    expect(pane.openView).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'desktop.media' }))
  })

  it('binds canonical Explorer to V2 and fails closed until owner inspect is usable', async () => {
    let usable = false
    const owner: FileHostV1 = {
      version: '0.1.0-rc.1', capability: 'file-host', capabilities: ['FileTreeProjectionCapabilityV2', 'FileInspectCapabilityV1'], async listEntries() { return [] },
      treeV2: {
        capability: 'FileTreeProjectionCapabilityV2',
        async roots() { return { workspaceRef: 'workspace:test', generation: 'g1', revision: 'r1', truncated: false, loaded: 1, total: 1, nodes: [{ ref: 'file-readme', name: 'README.md', kind: 'file', version: 'v1', hasChildren: false, hidden: false, ignored: false, sensitive: false, availability: { inspect: { state: 'available' }, preview: { state: 'available' }, download: { state: 'available' }, mutate: { state: 'disabled' } }, freshness: 'fresh' }] } },
        async listChildren() { return { workspaceRef: 'workspace:test', generation: 'g1', revision: 'r1', truncated: false, loaded: 0, nodes: [] } },
        async search() { return { workspaceRef: 'workspace:test', generation: 'g1', revision: 'r1', truncated: false, loaded: 0, nodes: [] } },
        async reveal() { return { workspaceRef: 'workspace:test', generation: 'g1', revision: 'r1', breadcrumbs: [] } },
      },
      inspect: { capability: 'FileInspectCapabilityV1', async inspect(ref) { return { owner: 'dsh.local', ref, version: 'v1', usable, state: usable ? 'ready' : 'unsupported', sensitive: false, ...(usable ? {} : { reason: 'unsupported' }), resource: { name: 'README.md', kind: 'text' } } } },
    }
    getComposerReferenceController().dispatch({ type: 'clear' })
    const ctx = fakeClientContext({ fileHost: owner })
    const dispose = apply(ctx)
    const runtime = getExplorerRuntime()!
    const [node] = await runtime.roots()
    expect(await runtime.openResource(node!, 'preview')).toMatchObject({ ok: false, reason: 'unsupported' })
    usable = true
    expect(await runtime.openResource(node!, 'preview')).toEqual({ ok: true })
    expect(getComposerReferenceController().snapshot().active).toMatchObject({ ref: 'file-readme', version: 'v1', kind: 'file-preview' })
    const pane = ctx.get('paneWorkbench' as never) as unknown as { openView: ReturnType<typeof vi.fn> }
    expect(pane.openView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'desktop.file', resourceKey: 'file-readme', preview: true }))
    dispose()
  })

  it('uses the server-issued terminal proof catalog before the legacy terminalPane fallback', async () => {
    const provided = new Map<string, unknown>()
    const list = vi.fn(async () => ({
      ok: true,
      value: {
        terminals: [{
          terminalId: 'pty-1', name: 'reference-terminal', type: 'shell', status: 'running',
          version: 'sha256:owner-proof', digest: 'owner-proof', scope: 'terminal/scrollback', preview: 'ready',
        }],
      },
    }))
    provided.set('remote.referenceTerminals', { list })
    const legacyList = vi.fn()
    provided.set('remote.terminalPane', { list: legacyList, read: vi.fn() })
    const ctx = fakeClientContext({ provided, fileHost: fileHost() })
    const dispose = apply(ctx)
    const catalog = provided.get('composerReferenceCatalog') as {
      list(target: { workspaceId: string; conversationId: string }, query: string, signal: AbortSignal): Promise<readonly { reference: unknown }[]>
    }
    await expect(catalog.list({ workspaceId: 'workspace-main', conversationId: 's-1' }, '', new window.AbortController().signal)).resolves.toEqual([
      expect.objectContaining({
        name: 'reference-terminal', section: 'Terminals',
        reference: expect.objectContaining({
          owner: 'dsh.terminal', ref: 'pty-1', kind: 'terminal', intent: 'content',
          version: 'sha256:owner-proof', digest: 'owner-proof', scope: 'terminal/scrollback',
        }),
      }),
    ])
    expect(list).toHaveBeenCalledWith({ sessionId: 's-1' }, expect.any(AbortSignal))
    expect(legacyList).not.toHaveBeenCalled()
    dispose()
  })

  it('registers one reference dock and resolves a dragged image region through the owner and Host bridge', async () => {
    const page = { workspaceRef: 'workspace:test', generation: 'g1', revision: 'r1', truncated: false, loaded: 1, total: 1, nodes: [{ ref: 'image-shot', name: 'shot.png', kind: 'file' as const, version: 'image-v1', hasChildren: false, hidden: false, ignored: false, sensitive: false, capabilities: ['preview', 'open'] as const, availability: { inspect: { state: 'available' as const }, preview: { state: 'available' as const }, download: { state: 'available' as const }, mutate: { state: 'disabled' as const } }, freshness: 'fresh' as const }] }
    const owner: FileHostV1 = {
      version: '0.1.0-rc.1', capability: 'file-host', capabilities: ['FileTreeProjectionCapabilityV2', 'FileInspectCapabilityV1'], async listEntries() { return [] },
      treeV2: { capability: 'FileTreeProjectionCapabilityV2', async roots() { return page }, async search() { return page }, async listChildren() { return { ...page, nodes: [], loaded: 0 } }, async reveal() { return { workspaceRef: page.workspaceRef, generation: page.generation, revision: page.revision, breadcrumbs: [] } } },
      inspect: {
        capability: 'FileInspectCapabilityV1',
        async inspect(ref) {
          return { owner: 'dsh.local', ref, version: 'image-v1', usable: true, state: 'partial', sensitive: false, resource: { name: 'shot.png', kind: 'image', mediaType: 'image/png' } }
        },
      },
      async readBinary() { return { bytes: new Uint8Array([1, 2, 3]), size: 3, truncated: false, version: 'image-v1', mediaType: 'image/png' } },
    }
    const provided = new Map<string, unknown>()
    const target = { workspaceId: 'workspace-main', conversationId: 's-1', draftRevision: 4, title: 'Main', caret: { start: 0, end: 0 } }
    const probe = (event: Event) => { const detail = (event as CustomEvent).detail; detail?.report?.(true) }
    const hostInsert = vi.fn((event: Event) => {
      const detail = (event as CustomEvent).detail
      window.dispatchEvent(new CustomEvent('dsh-composer-reference:insert-result', { detail: { version: 1, requestId: detail.requestId, target: detail.target, ok: true } }))
    })
    const imageResults: CustomEvent[] = []
    const imageResult = (event: Event) => { imageResults.push(event as CustomEvent) }
    window.addEventListener('dsh-composer-reference:probe', probe)
    window.addEventListener('dsh-composer-reference:insert', hostInsert)
    window.addEventListener('dsh-composer-reference:image-region-result', imageResult)
    const ctx = fakeClientContext({ fileHost: owner, workspaces: workspacesBrowse(), provided, composerReferenceBridge: { snapshot: () => ({ available: true, target, references: [] }), subscribe: () => () => {}, resolveSelection: vi.fn() } })
    const dispose = apply(ctx)
    expect(provided.has('composerReferenceSourceResolver')).toBe(true)
    expect(provided.has('composerReferenceCatalog')).toBe(true)
    const runtime = getExplorerRuntime()!
    const [node] = await runtime.roots()
    await expect(runtime.openResource(node!, 'preview')).resolves.toEqual({ ok: true })
    window.dispatchEvent(new CustomEvent('dsh-composer-reference:image-region-request', { detail: { version: 1, requestId: 'region-1', owner: 'dsh.local', ref: 'image-shot', resourceVersion: 'image-v1', label: 'shot.png', scope: 'image/region', naturalSize: { width: 1000, height: 500 }, region: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 } } }))
    await vi.waitFor(() => { expect(hostInsert.mock.calls.some(call => (call[0] as CustomEvent).detail?.requestId === 'region-1')).toBe(true) })
    const regionInsert = hostInsert.mock.calls.find(call => (call[0] as CustomEvent).detail?.requestId === 'region-1')?.[0] as CustomEvent
    expect(regionInsert.detail.reference).toMatchObject({ kind: 'image-region', owner: 'dsh.local', ref: 'image-shot', version: 'image-v1', region: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 } })
    await vi.waitFor(() => { expect(imageResults.at(-1)?.detail).toMatchObject({ requestId: 'region-1', ok: true }) })
    const referenceDockRegistrations = ctx.slots.register.mock.calls.filter(call => call[0]?.name === 'conversation.input.dock' && String(call[0]?.id).includes('composer-reference'))
    expect(referenceDockRegistrations).toHaveLength(1)
    dispose()
    window.removeEventListener('dsh-composer-reference:probe', probe)
    window.removeEventListener('dsh-composer-reference:insert', hostInsert)
    window.removeEventListener('dsh-composer-reference:image-region-result', imageResult)
  })

  it('passes activation through the host insert seam and reports activated only when the host confirms', async () => {
    const provided = new Map<string, unknown>()
    const target = { workspaceId: 'workspace-main', conversationId: 's-1', draftRevision: 4, title: 'Main' }
    const probe = (event: Event) => { const detail = (event as CustomEvent).detail; detail?.report?.(true, undefined, { activation: true }) }
    const hostInsert = vi.fn((event: Event) => {
      const detail = (event as CustomEvent).detail
      window.dispatchEvent(new CustomEvent('dsh-composer-reference:insert-result', {
        detail: { version: 1, requestId: detail.requestId, target: detail.target, ok: true, ...(detail.activation === undefined ? {} : { activated: true }) },
      }))
    })
    const addResults: CustomEvent[] = []
    const onAddResult = (event: Event) => { addResults.push(event as CustomEvent) }
    window.addEventListener('dsh-composer-reference:probe', probe)
    window.addEventListener('dsh-composer-reference:insert', hostInsert)
    window.addEventListener('dsh-composer-reference:add-to-main-result', onAddResult)
    try {
      const underlying = { snapshot: () => ({ available: true, target, references: [] }), subscribe: () => () => {}, resolveSelection: vi.fn() }
      const ctx = fakeClientContext({ provided, composerReferenceBridge: underlying })
      const dispose = apply(ctx)
      // 装饰桥只在 probe 握手确认后暴露 activation；chooseTarget 无宿主 seam，缺席。
      const decorated = provided.get('composerReferenceBridge') as { snapshot(): { available: boolean; features?: { activation?: boolean; chooseTarget?: boolean } } }
      expect(decorated.snapshot().available).toBe(true)
      expect(decorated.snapshot().features).toEqual({ activation: true })
      const reference = { id: 'r-1', kind: 'selection', intent: 'content', owner: 'dsh.local', ref: 'file:a.ts', version: 'v1', label: 'a.ts', scope: 'file/raw', digest: 'd-1', freshness: 'fresh', window: { start: 0, end: 3 } }
      window.dispatchEvent(new CustomEvent('dsh-composer-reference:add-to-main', { detail: { version: 1, requestId: 'add-1', target, reference, activation: { focus: 'composer' } } }))
      await vi.waitFor(() => expect(hostInsert).toHaveBeenCalled())
      expect((hostInsert.mock.calls[0]?.[0] as CustomEvent).detail.activation).toEqual({ focus: 'composer' })
      await new Promise(r => setTimeout(r, 100))
      await vi.waitFor(() => expect(addResults.some(event => event.detail?.requestId === 'add-1' && event.detail.ok === true && event.detail.activated === true)).toBe(true))
      // 宿主回执没有 activation 语义时，结果省略 activated（插件按未确认处理）。
      window.dispatchEvent(new CustomEvent('dsh-composer-reference:add-to-main', { detail: { version: 1, requestId: 'add-2', target, reference } }))
      await vi.waitFor(() => expect(addResults.some(event => event.detail?.requestId === 'add-2' && event.detail.ok === true)).toBe(true))
      expect(addResults.find(event => event.detail?.requestId === 'add-2' && event.detail.ok === true)?.detail.activated).toBeUndefined()
      dispose()
      // dispose 后握手失效：fail-closed。
      expect(decorated.snapshot().features?.activation).toBe(false)
    } finally {
      window.removeEventListener('dsh-composer-reference:probe', probe)
      window.removeEventListener('dsh-composer-reference:insert', hostInsert)
      window.removeEventListener('dsh-composer-reference:add-to-main-result', onAddResult)
    }
  })

  it('keeps activation unprobed when the host insert seam never answers the probe', () => {
    const provided = new Map<string, unknown>()
    const target = { workspaceId: 'workspace-main', conversationId: 's-1' }
    const ctx = fakeClientContext({ provided, composerReferenceBridge: { snapshot: () => ({ available: true, target }), subscribe: () => () => {}, resolveSelection: vi.fn() } })
    const dispose = apply(ctx)
    const decorated = provided.get('composerReferenceBridge') as { snapshot(): { features?: { activation?: boolean } } }
    expect(decorated.snapshot().features?.activation).toBe(false)
    dispose()
  })

  it('binds an in-flight request id to its exact target, proof, and activation until the original receipt settles', async () => {
    const provided = new Map<string, unknown>()
    const target = { workspaceId: 'workspace-main', conversationId: 's-1', draftRevision: 4, title: 'Main' }
    const probe = (event: Event) => { (event as CustomEvent).detail?.report?.(true, undefined, { activation: true }) }
    const hostInsert = vi.fn()
    const addResults: CustomEvent[] = []
    const onResult = (event: Event) => { addResults.push(event as CustomEvent) }
    window.addEventListener('dsh-composer-reference:probe', probe)
    window.addEventListener('dsh-composer-reference:insert', hostInsert)
    window.addEventListener('dsh-composer-reference:add-to-main-result', onResult)
    try {
      const underlying = { snapshot: () => ({ available: true, target, references: [] }), subscribe: () => () => {}, resolveSelection: vi.fn() }
      const dispose = apply(fakeClientContext({ provided, composerReferenceBridge: underlying }))
      const reference = { id: 'r-original', kind: 'selection', intent: 'content', owner: 'dsh.local', ref: 'file:a.ts', version: 'v1', label: 'a.ts', scope: 'file/raw', digest: 'd-1', freshness: 'fresh', window: { start: 0, end: 3 } }
      const original = { version: 1, requestId: 'shared-id', target, reference, activation: { focus: 'composer' } }
      window.dispatchEvent(new CustomEvent('dsh-composer-reference:add-to-main', { detail: original }))
      window.dispatchEvent(new CustomEvent('dsh-composer-reference:add-to-main', { detail: {
        ...original,
        target: { ...target, conversationId: 's-2' },
        reference: { ...reference, id: 'r-forged', ref: 'file:b.ts', digest: 'd-2' },
      } }))
      expect(hostInsert).toHaveBeenCalledTimes(1)
      expect((hostInsert.mock.calls[0]?.[0] as CustomEvent).detail).toMatchObject({
        requestId: 'shared-id', target, reference, activation: { focus: 'composer' },
      })
      expect(addResults.at(-1)?.detail).toMatchObject({
        requestId: 'shared-id', ok: false, reason: 'reference request id was reused with different content',
        target: { conversationId: 's-2' },
      })

      window.dispatchEvent(new CustomEvent('dsh-composer-reference:insert-result', { detail: {
        version: 1, requestId: 'shared-id', target, ok: true, activated: true,
      } }))
      await vi.waitFor(() => {
        expect(addResults.some(event => event.detail?.requestId === 'shared-id' && event.detail.ok === true && event.detail.activated === true)).toBe(true)
      })
      window.dispatchEvent(new CustomEvent('dsh-composer-reference:add-to-main', { detail: original }))
      expect(hostInsert).toHaveBeenCalledTimes(1)
      expect(addResults.at(-1)?.detail).toMatchObject({ requestId: 'shared-id', ok: true, activated: true })
      dispose()
    } finally {
      window.removeEventListener('dsh-composer-reference:probe', probe)
      window.removeEventListener('dsh-composer-reference:insert', hostInsert)
      window.removeEventListener('dsh-composer-reference:add-to-main-result', onResult)
    }
  })

  it('forwards the Host-owned target chooser only when its feature and method are both present', async () => {
    const provided = new Map<string, unknown>()
    const target = { workspaceId: 'workspace-main', conversationId: 's-1' }
    const selected = { workspaceId: 'workspace-other', conversationId: 's-2', draftRevision: 3, title: 'Other' }
    const chooseTarget = vi.fn(async () => ({ status: 'selected' as const, target: selected }))
    const underlying = {
      snapshot: () => ({ available: true, target, references: [], features: { chooseTarget: true } }),
      subscribe: () => () => {},
      resolveSelection: vi.fn(),
      chooseTarget,
    }
    const dispose = apply(fakeClientContext({ provided, composerReferenceBridge: underlying }))
    const decorated = provided.get('composerReferenceBridge') as {
      snapshot(): { features?: { chooseTarget?: boolean } }
      chooseTarget(signal?: AbortSignal): Promise<unknown>
    }
    expect(decorated.snapshot().features?.chooseTarget).toBe(true)
    const abort = new AbortController()
    await expect(decorated.chooseTarget(abort.signal)).resolves.toEqual({ status: 'selected', target: selected })
    expect(chooseTarget).toHaveBeenCalledWith(abort.signal)
    dispose()
  })

  it('does not turn an unavailable target into an available draft when the capability probe succeeds', () => {
    const provided = new Map<string, unknown>()
    const probe = (event: Event) => { (event as CustomEvent).detail?.report?.(true) }
    window.addEventListener('dsh-composer-reference:probe', probe)
    try {
      const ctx = fakeClientContext({ provided, composerReferenceBridge: {
        snapshot: () => ({ available: false, reason: 'no current conversation' }),
        subscribe: () => () => {},
        resolveSelection: vi.fn(),
      } })
      const dispose = apply(ctx)
      expect(getComposerReferenceDraftControllerV2().snapshot()).toMatchObject({
        hostAvailable: false,
        hostReason: 'no current conversation',
      })
      dispose()
    } finally {
      window.removeEventListener('dsh-composer-reference:probe', probe)
    }
  })

  it('projects bridge unavailability authoritatively without deleting the former target draft', () => {
    const provided = new Map<string, unknown>()
    const target = { workspaceId: 'workspace-main', conversationId: 'unavailable-target', draftRevision: 4, title: 'Former target' }
    const reference = { id: 'r-unavailable', kind: 'selection', intent: 'content', owner: 'dsh.local', ref: 'file:a.ts', version: 'v1', label: 'a.ts', scope: 'file/raw', digest: 'd-1', freshness: 'fresh', window: { start: 0, end: 3 } }
    let snapshot: { available: boolean; target?: typeof target; references?: readonly typeof reference[]; reason?: string } = { available: true, target, references: [reference] }
    const listeners = new Set<() => void>()
    const underlying = { snapshot: () => snapshot, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }, resolveSelection: vi.fn() }
    const ctx = fakeClientContext({ provided, composerReferenceBridge: underlying })
    const dispose = apply(ctx)
    const controller = getComposerReferenceDraftControllerV2()
    expect(controller.snapshot().activeTarget).toMatchObject(target)
    expect(controller.draftFor(target)?.references).toHaveLength(1)
    snapshot = { available: false, reason: 'target closed' }
    for (const listener of listeners) listener()
    expect(controller.snapshot()).toMatchObject({ hostAvailable: false, hostReason: 'target closed' })
    expect(controller.snapshot()).not.toHaveProperty('activeTarget')
    expect(controller.draftFor(target)?.references).toHaveLength(1)
    dispose()
  })


  it('aborts in-flight browser requests when the workspace owner switches (mutation 4.5)', async () => {
    const EMPTY_PAGE = { workspaceRef: 'workspace:test', generation: 'g1', revision: 'r1', truncated: false, loaded: 0, nodes: [] }
    const signals: AbortSignal[] = []
    const listeners: Array<() => void> = []
    let currentSession = 's-1'
    const fetchImpl = vi.fn(async (_input: string, init?: RequestInit) => {
      if (init?.signal !== undefined) signals.push(init.signal)
      return new Response(JSON.stringify({ ok: true, value: EMPTY_PAGE }), { headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchImpl)
    const ctx = fakeClientContext()
    const sessions = ctx.get('sessions' as never) as { list: { getSnapshot: () => { current?: string }; subscribe?: (listener: () => void) => () => void } }
    sessions.list.getSnapshot = () => ({ current: currentSession })
    sessions.list.subscribe = (listener: () => void) => {
      listeners.push(listener)
      return () => { const index = listeners.indexOf(listener); if (index >= 0) listeners.splice(index, 1) }
    }
    const dispose = apply(ctx)
    try {
      const runtime = getExplorerRuntime()!
      await runtime.roots()
      const before = signals.at(-1)!
      expect(before.aborted).toBe(false)
      // workspace owner（当前会话）切换 → 在途请求的 signal 立即 abort。
      currentSession = 's-2'
      for (const listener of [...listeners]) listener()
      expect(before.aborted).toBe(true)
      // 切换后的请求拿到全新的、未中止的 signal。
      await runtime.listChildren('any-ref')
      const after = signals.at(-1)!
      expect(after).not.toBe(before)
      expect(after.aborted).toBe(false)
    } finally {
      dispose()
      vi.unstubAllGlobals()
    }
  })

  it('opens files on the right and terminal at the bottom from additive actions', () => {
    const ctx = fakeClientContext({ fileHost: fileHost(), terminalHost: terminalHost() })
    apply(ctx)
    const pane = ctx.get('paneWorkbench' as never) as unknown as { openView: ReturnType<typeof vi.fn> }
    const registrations = (ctx.slots.register as ReturnType<typeof vi.fn>).mock.calls
    const files = registrations.find(call => call[0].id === 'desktop-workbench-sidebar-files')?.[1] as () => ReactNode
    const git = registrations.find(call => call[0].id === 'desktop-workbench-sidebar-git')?.[1] as () => ReactNode
    const terminal = registrations.find(call => call[0].id === 'desktop-workbench-open-terminal')?.[1] as () => ReactNode
    render(createElement('div', null, files(), git(), terminal()))
    fireEvent.click(screen.getByRole('button', { name: '文件' }))
    fireEvent.click(screen.getByRole('button', { name: 'Git' }))
    fireEvent.click(screen.getByRole('button', { name: '终端' }))
    expect(pane.openView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'dsh.explorer', preferredRegion: 'right' }))
    expect(pane.openView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'desktop.git', preferredRegion: 'right' }))
    expect(pane.openView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'desktop.terminal', preferredRegion: 'bottom' }))
  })

  it('uses the owner-provided terminal host when the optional context service is mounted', () => {
    const owner = terminalHost()
    const ctx = fakeClientContext({ terminalHost: owner })
    apply(ctx)
    const pane = ctx.get('paneWorkbench' as never) as unknown as { registerView: ReturnType<typeof vi.fn> }
    const terminal = pane.registerView.mock.calls.find(call => call[0].descriptor.kind === 'desktop.terminal')?.[0]
    expect(terminal?.component?.().props.host).toBe(owner)
  })

  it('rejects the legacy non-interactive terminal host from the production catalog', () => {
    const ctx = fakeClientContext({ terminalHost: {
      version: '0.1.0-rc.1', capability: 'terminal-host', listTerminals: vi.fn(), openTerminal: vi.fn(), closeTerminal: vi.fn(), writeInput: vi.fn(), resizeTerminal: vi.fn(),
    } })
    apply(ctx)
    const pane = ctx.get('paneWorkbench' as never) as unknown as { registerView: ReturnType<typeof vi.fn> }
    const kinds = pane.registerView.mock.calls.map(call => call[0].descriptor.kind)
    expect(kinds).not.toContain('desktop.terminal')
  })

  it('passes the owner media host into the Pane preview provider', () => {
    const mediaHost: MediaHostV1 = {
      version: '0.1.0-rc.1',
      capability: 'media-host',
      async listMedia() { return [] },
      async resolveUrl() { return undefined },
    }
    const ctx = fakeClientContext({ mediaHost })
    apply(ctx)
    const pane = ctx.get('paneWorkbench' as never) as unknown as { registerView: ReturnType<typeof vi.fn> }
    const media = pane.registerView.mock.calls.find(call => call[0].descriptor.kind === 'desktop.media')?.[0]
    expect(media?.component?.().props.host).toBe(mediaHost)
  })

  it('fails closed when Pane Workbench V2 is unavailable', () => {
    const ctx = fakeClientContext()
    ;(ctx.get as ReturnType<typeof vi.fn>).mockImplementation((name: string) => name === 'slots' ? ctx.slots : undefined)
    ;(ctx as unknown as { provide?: unknown }).provide = undefined
    const disposer = apply(ctx)
    expect(typeof disposer).toBe('function')
    expect(ctx.slots.inject).not.toHaveBeenCalled()
    disposer()
  })

  it('closes to a persistent launcher and reopens the desktop workbench', () => {
    render(createElement(DesktopWorkbenchOverlay))
    fireEvent.click(screen.getByRole('button', { name: '返回 DSH 会话' }))
    const launcher = screen.getByRole('button', { name: '打开桌面工作台' })
    expect(launcher.getAttribute('data-dsh-desktop-workbench-launcher')).toBe('true')
    fireEvent.click(launcher)
    expect(screen.getByRole('button', { name: '返回 DSH 会话' })).toBeTruthy()
  })
})
