// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { apply, inject, PANE_CORE_HOST_CONTRACT } from '../src/client.js'

describe('Pane Workbench V2 DSH assembly', () => {
  it('attaches one layout owner and registers only the official Right/Bottom slots', () => {
    expect(inject).toEqual(['slots', 'workspaceLayout', 'sessions'])
    const registered: Array<{ name: string; dispose: ReturnType<typeof vi.fn> }> = []
    const injected: string[] = []
    const slots = {
      spec: (name: string) => name.startsWith('shell.workspace.') ? { kind: 'single', scope: 'root' } : undefined,
      inject: (name: string, setup: () => () => void) => { injected.push(name); const dispose = setup(); return () => dispose() },
      register: (input: { name: string }) => { const dispose = vi.fn(); registered.push({ name: input.name, dispose }); return dispose },
    }
    let layoutSnapshot = { attached: true, rightVisible: false, bottomVisible: false, rightWidth: 480, bottomRatio: 0.34, activeRegion: 'right' as const }
    const layoutListeners = new Set<() => void>()
    const layoutHandle = {
      update: (patch: object) => { layoutSnapshot = { ...layoutSnapshot, ...patch }; for (const listener of layoutListeners) listener() },
      getSnapshot: () => layoutSnapshot,
      subscribe: (listener: () => void) => { layoutListeners.add(listener); return () => layoutListeners.delete(listener) },
      dispose: vi.fn(),
    }
    const workspaceLayout = {
      corePaneVersion: PANE_CORE_HOST_CONTRACT,
      attach: vi.fn((_ownerId: string, _preference: object, _coreHost?: unknown) => layoutHandle),
    }
    let currentSession = 'session:one'
    const sessionListeners = new Set<() => void>()
    const sessions = {
      list: {
        getSnapshot: () => ({ current: currentSession }),
        subscribe: (listener: () => void) => { sessionListeners.add(listener); return () => sessionListeners.delete(listener) },
      },
    }
    const provide = vi.fn()
    const ctx = {
      get: (name: string) => name === 'slots' ? slots : name === 'workspaceLayout' ? workspaceLayout : name === 'sessions' ? sessions : undefined,
      provide,
    }
    const dispose = apply(ctx as never)
    expect(workspaceLayout.attach).toHaveBeenCalledTimes(1)
    expect(workspaceLayout.attach.mock.calls[0]?.[2]).toEqual({ open: expect.any(Function), close: expect.any(Function) })
    expect(injected).toEqual(['shell.workspace.right', 'shell.workspace.bottom'])
    expect(injected).not.toContain('shell.overlay')
    expect(registered.map(entry => entry.name)).toEqual(['shell.workspace.right', 'shell.workspace.bottom'])
    expect(provide).toHaveBeenCalledWith('paneWorkbench', expect.any(Object))

    const face = provide.mock.calls.find(call => call[0] === 'paneWorkbench')?.[1] as {
      views: { get(kind: string): { showInPicker?: boolean } | undefined }
      controller: { getSnapshot(): { views: Record<string, { kind: string }> } }
    }
    const coreHost = workspaceLayout.attach.mock.calls[0]?.[2] as { open(id: 'dsh.tool-details'): void; close(id: 'dsh.tool-details'): void }
    expect(face.views.get('dsh.tool-details')?.showInPicker).toBe(false)
    coreHost.open('dsh.tool-details')
    expect(Object.values(face.controller.getSnapshot().views).filter(view => view.kind === 'dsh.tool-details')).toHaveLength(1)
    currentSession = 'session:two'
    for (const listener of sessionListeners) listener()
    expect(Object.values(face.controller.getSnapshot().views).some(view => view.kind === 'dsh.tool-details')).toBe(false)
    coreHost.open('dsh.tool-details')
    expect(Object.values(face.controller.getSnapshot().views).filter(view => view.kind === 'dsh.tool-details')).toHaveLength(1)
    coreHost.close('dsh.tool-details')
    expect(Object.values(face.controller.getSnapshot().views).some(view => view.kind === 'dsh.tool-details')).toBe(false)

    dispose()
    expect(layoutHandle.dispose).toHaveBeenCalledOnce()
    expect(registered.every(entry => entry.dispose.mock.calls.length === 1)).toBe(true)
    expect(face.views.get('dsh.tool-details')).toBeUndefined()
    expect(sessionListeners.size).toBe(0)
  })

  it('fails clearly on an old DSH and never attempts overlay fallback', () => {
    const slots = { spec: () => undefined, inject: vi.fn(), register: vi.fn() }
    const ctx = { get: (name: string) => name === 'slots' ? slots : undefined, provide: vi.fn() }
    expect(() => apply(ctx as never)).toThrow(/requires .*ui-layout.*overlay fallbacks are disabled/i)
    expect(slots.inject).not.toHaveBeenCalled()
  })

  it('rejects the pre-Core workspace seam instead of mounting beside legacy Details', () => {
    const slots = {
      spec: (name: string) => name.startsWith('shell.workspace.') ? { kind: 'single', scope: 'root' } : undefined,
      inject: vi.fn(),
      register: vi.fn(),
    }
    const workspaceLayout = { attach: vi.fn() }
    const ctx = {
      get: (name: string) => name === 'slots' ? slots : name === 'workspaceLayout' ? workspaceLayout : undefined,
      provide: vi.fn(),
    }
    expect(() => apply(ctx as never)).toThrow(/workspace\.core-pane\.v1.*legacy Details.*disabled/i)
    expect(workspaceLayout.attach).not.toHaveBeenCalled()
    expect(slots.inject).not.toHaveBeenCalled()
  })

  it('unwinds the Core host and first slot when the second slot fails to mount', () => {
    const rightDispose = vi.fn()
    const slots = {
      spec: (name: string) => name.startsWith('shell.workspace.') ? { kind: 'single', scope: 'root' } : undefined,
      inject: (name: string, setup: () => () => void) => {
        if (name === 'shell.workspace.bottom') throw new Error('bottom slot failed')
        const dispose = setup()
        return () => dispose()
      },
      register: vi.fn(() => rightDispose),
    }
    const layoutHandle = {
      update: vi.fn(),
      getSnapshot: () => ({ attached: true, rightVisible: false, bottomVisible: false, rightWidth: 480, bottomRatio: 0.34, activeRegion: 'right' as const }),
      subscribe: () => () => {},
      dispose: vi.fn(),
    }
    const workspaceLayout = {
      corePaneVersion: PANE_CORE_HOST_CONTRACT,
      attach: vi.fn((_ownerId: string, _preference: object, _coreHost?: unknown) => layoutHandle),
    }
    const provide = vi.fn()
    const ctx = {
      get: (name: string) => name === 'slots' ? slots : name === 'workspaceLayout' ? workspaceLayout : undefined,
      provide,
    }

    expect(() => apply(ctx as never)).toThrow(/bottom slot failed/)
    expect(rightDispose).toHaveBeenCalledOnce()
    expect(layoutHandle.dispose).toHaveBeenCalledOnce()
    const face = provide.mock.calls.find(call => call[0] === 'paneWorkbench')?.[1] as {
      views: { get(kind: string): unknown }
    }
    expect(face.views.get('dsh.tool-details')).toBeUndefined()
  })
})
