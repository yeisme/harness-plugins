// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { apply, DesktopWorkbenchOverlay, inject } from '../src/client/apply.ts'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { FileHostV1 } from '@yeisme/dsh-file-host'
import type { TerminalHostV2 } from '@yeisme/dsh-terminal-host'
import type { MediaHostV1 } from '@yeisme/dsh-rich-media'
import { getComposerReferenceController, getExplorerRuntime } from '@yeisme/dsh-client-ui-pane-workbench/client'

afterEach(cleanup)

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
  return {
    slots,
    get: vi.fn((name: string) => name === 'slots' ? slots
      : name === 'paneWorkbench' ? paneWorkbench
      : name === 'dsh.terminalHost' ? options.terminalHost
      : name === 'dsh.mediaHost' ? options.mediaHost
      : name === 'dsh.fileHost' ? options.fileHost
      : name === 'workspaces' ? options.workspaces
      : name === 'sessions' ? sessions
      : name === 'workspaceLayout' ? options.workspaceLayout
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
    expect(files).toMatchObject({ showInPicker: false, descriptor: { deprecated: true } })
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
