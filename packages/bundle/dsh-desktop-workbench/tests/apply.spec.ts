// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { apply, DesktopWorkbenchOverlay, inject } from '../src/client/apply.ts'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { FileHostV1 } from '@yeisme/dsh-file-host'
import type { TerminalHostV2 } from '@yeisme/dsh-terminal-host'
import type { MediaHostV1 } from '@yeisme/dsh-rich-media'

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

  it('does not register terminal or media placeholders when those owners are absent', () => {
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
    expect(kinds).not.toContain('desktop.terminal')
    expect(kinds).not.toContain('desktop.media')
    expect(pane.openView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'desktop.files', preferredRegion: 'right' }))
    expect(ctx.slots.inject).not.toHaveBeenCalledWith('shell.overlay', expect.any(Function))
    expect(typeof disposer).toBe('function')
  })

  it('registers the file pane from the explorer host when dsh.fileHost is absent', async () => {
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
    apply(ctx)
    const pane = ctx.get('paneWorkbench' as never) as unknown as { registerView: ReturnType<typeof vi.fn> }
    const files = pane.registerView.mock.calls.find(call => call[0].descriptor.kind === 'desktop.files')?.[0]
    expect(files).toBeDefined()
    const host = files?.component?.().props.host as FileHostV1
    const entries = await host.listEntries()
    expect(fetchImpl).toHaveBeenCalled()
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('/yeisme-files/api/fs.tree')
    expect(entries.map(entry => entry.name).sort()).toEqual(['README.md', 'src'])
    expect(entries.find(entry => entry.name === 'README.md')).toMatchObject({ kind: 'text' })
    expect(JSON.stringify(entries)).not.toContain('/workspace')
    expect(ctx.slots.inject).toHaveBeenCalledWith('conversation.session.header.actions', expect.any(Function))
    expect(ctx.slots.inject).toHaveBeenCalledWith('sidebar.footer.action', expect.any(Function))
    vi.unstubAllGlobals()
  })

  it('prefers an owner-provided dsh.fileHost over the workspaces browse adapter', () => {
    const owner = fileHost()
    const ctx = fakeClientContext({ fileHost: owner, workspaces: workspacesBrowse() })
    apply(ctx)
    const pane = ctx.get('paneWorkbench' as never) as unknown as { registerView: ReturnType<typeof vi.fn> }
    const files = pane.registerView.mock.calls.find(call => call[0].descriptor.kind === 'desktop.files')?.[0]
    expect(files?.component?.().props.host).toBe(owner)
  })

  it('opens a content tab when a file is clicked in the explorer', () => {
    const ctx = fakeClientContext({ fileHost: fileHost() })
    apply(ctx)
    const pane = ctx.get('paneWorkbench' as never) as unknown as { registerView: ReturnType<typeof vi.fn>; openView: ReturnType<typeof vi.fn> }
    const files = pane.registerView.mock.calls.find(call => call[0].descriptor.kind === 'desktop.files')?.[0]
    files?.component?.().props.onOpenEntry({ id: 'file-readme', name: 'README.md', kind: 'text', capabilities: ['open', 'preview'] })
    expect(pane.openView).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'desktop.file',
      resourceKey: 'file-readme',
      role: 'content',
      preview: true,
      title: 'README.md',
    }))
    files?.component?.().props.onPinEntry({ id: 'file-readme', name: 'README.md', kind: 'text', capabilities: ['open', 'preview'] })
    expect(pane.openView).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'desktop.file',
      resourceKey: 'file-readme',
      preview: false,
      pinned: true,
    }))
  })

  it('opens files on the right and terminal at the bottom from additive actions', () => {
    const ctx = fakeClientContext({ fileHost: fileHost(), terminalHost: terminalHost() })
    apply(ctx)
    const pane = ctx.get('paneWorkbench' as never) as unknown as { openView: ReturnType<typeof vi.fn> }
    const registrations = (ctx.slots.register as ReturnType<typeof vi.fn>).mock.calls
    const files = registrations.find(call => call[0].id === 'desktop-workbench-open-files')?.[1] as () => ReactNode
    const git = registrations.find(call => call[0].id === 'desktop-workbench-open-git')?.[1] as () => ReactNode
    const terminal = registrations.find(call => call[0].id === 'desktop-workbench-open-terminal')?.[1] as () => ReactNode
    render(createElement('div', null, files(), git(), terminal()))
    fireEvent.click(screen.getByRole('button', { name: '文件' }))
    fireEvent.click(screen.getByRole('button', { name: 'Git' }))
    fireEvent.click(screen.getByRole('button', { name: '>_' }))
    expect(pane.openView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'desktop.files', preferredRegion: 'right' }))
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

  it('fails explicitly when Pane Workbench V2 is unavailable', () => {
    const ctx = fakeClientContext()
    ;(ctx.get as ReturnType<typeof vi.fn>).mockImplementation((name: string) => name === 'slots' ? ctx.slots : undefined)
    expect(() => apply(ctx)).toThrow(/Pane Workbench/u)
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
