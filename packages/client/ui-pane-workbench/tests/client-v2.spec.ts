// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { apply, inject } from '../src/client.js'

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
    const workspaceLayout = { attach: vi.fn(() => layoutHandle) }
    const provide = vi.fn()
    const ctx = {
      get: (name: string) => name === 'slots' ? slots : name === 'workspaceLayout' ? workspaceLayout : undefined,
      provide,
    }
    const dispose = apply(ctx as never)
    expect(workspaceLayout.attach).toHaveBeenCalledTimes(1)
    expect(injected).toEqual(['shell.workspace.right', 'shell.workspace.bottom'])
    expect(injected).not.toContain('shell.overlay')
    expect(registered.map(entry => entry.name)).toEqual(['shell.workspace.right', 'shell.workspace.bottom'])
    expect(provide).toHaveBeenCalledWith('paneWorkbench', expect.any(Object))

    dispose()
    expect(layoutHandle.dispose).toHaveBeenCalledOnce()
    expect(registered.every(entry => entry.dispose.mock.calls.length === 1)).toBe(true)
  })

  it('fails clearly on an old DSH and never attempts overlay fallback', () => {
    const slots = { spec: () => undefined, inject: vi.fn(), register: vi.fn() }
    const ctx = { get: (name: string) => name === 'slots' ? slots : undefined, provide: vi.fn() }
    expect(() => apply(ctx as never)).toThrow(/requires .*ui-layout.*overlay fallback is disabled/i)
    expect(slots.inject).not.toHaveBeenCalled()
  })
})
