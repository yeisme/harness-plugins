// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { apply, inject, PANE_CORE_HOST_CONTRACT, probePaneWorkbenchHost } from '../src/client.js'
import { getActiveLocale, setActiveLocale } from '../src/i18n/locale.js'

describe('Pane Workbench V2 DSH assembly', () => {
  it('registers with the optional DSH locale runtime and follows hot switches', () => {
    setActiveLocale('en')
    const slots = {
      spec: () => undefined,
      inject: vi.fn((_name: string, setup: () => () => void) => setup()),
      register: vi.fn(() => vi.fn()),
    }
    let active = 'zh'
    const listeners = new Set<() => void>()
    const disposeDictionaries = vi.fn()
    const locale = {
      register: vi.fn(() => disposeDictionaries),
      getLocale: () => ({ active }),
      subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    }
    const ctx = {
      get: (name: string) => name === 'slots' ? slots : name === 'locale' ? locale : undefined,
      provide: vi.fn(),
    }

    const dispose = apply(ctx as never)
    expect(locale.register).toHaveBeenCalledWith('paneWorkbench', expect.objectContaining({ zh: expect.any(Object), en: expect.any(Object) }))
    expect(getActiveLocale()).toBe('zh')

    active = 'en'
    for (const listener of listeners) listener()
    expect(getActiveLocale()).toBe('en')

    dispose()
    expect(disposeDictionaries).toHaveBeenCalledOnce()
    expect(listeners.size).toBe(0)
  })

  it('attaches one layout owner and registers only the official Right/Bottom slots', () => {
    expect(inject).toEqual(['slots', 'sessions'])
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
    expect(injected).not.toContain('sidebar.footer.action')
    expect(registered.map(entry => entry.name)).toEqual(['shell.workspace.right', 'shell.workspace.bottom'])
    expect(provide).toHaveBeenCalledWith('paneWorkbench', expect.any(Object))

    const face = provide.mock.calls.find(call => call[0] === 'paneWorkbench')?.[1] as {
      views: { get(kind: string): { showInPicker?: boolean } | undefined }
      controller: { getSnapshot(): { views: Record<string, { kind: string }> } }
    }
    const coreHost = workspaceLayout.attach.mock.calls[0]?.[2] as { open(id: 'dsh.tool-details'): void; close(id: 'dsh.tool-details'): void }
    expect(face.views.get('dsh.tool-details')).toBeUndefined()
    coreHost.open('dsh.tool-details')
    expect(Object.values(face.controller.getSnapshot().views).some(view => view.kind === 'dsh.tool-details')).toBe(false)
    currentSession = 'session:two'
    for (const listener of sessionListeners) listener()
    expect(Object.values(face.controller.getSnapshot().views).some(view => view.kind === 'dsh.tool-details')).toBe(false)
    coreHost.open('dsh.tool-details')
    expect(Object.values(face.controller.getSnapshot().views).some(view => view.kind === 'dsh.tool-details')).toBe(false)
    coreHost.close('dsh.tool-details')
    expect(Object.values(face.controller.getSnapshot().views).some(view => view.kind === 'dsh.tool-details')).toBe(false)

    dispose()
    expect(layoutHandle.dispose).toHaveBeenCalledOnce()
    expect(registered.every(entry => entry.dispose.mock.calls.length === 1)).toBe(true)
    expect(face.views.get('dsh.tool-details')).toBeUndefined()
    expect(sessionListeners.size).toBe(0)
  })

  it('mounts the official overlay host on an old DSH', () => {
    const slots = {
      spec: () => undefined,
      inject: vi.fn((_name: string, setup: () => () => void) => setup()),
      register: vi.fn(() => vi.fn()),
    }
    const ctx = { get: (name: string) => name === 'slots' ? slots : undefined, provide: vi.fn() }
    const probe = probePaneWorkbenchHost(ctx)
    expect(probe.available).toBe(false)
    expect(probe.missing).toEqual(expect.arrayContaining(['workspaceLayout', 'shell.workspace.right', 'shell.workspace.bottom']))
    const dispose = apply(ctx as never)
    expect(slots.inject).toHaveBeenCalledWith('shell.overlay', expect.any(Function))
    expect(ctx.provide).toHaveBeenCalledWith('paneWorkbench', expect.any(Object))
    const face = ctx.provide.mock.calls[0]?.[1] as {
      registerView(input: unknown): () => void
      openView(input: unknown): void
      controller: {
        getSnapshot(): {
          regions: { right: { visible: boolean }; bottom: { visible: boolean } }
          views: Record<string, { region: string; groupId: string }>
          groups: Record<string, { region: string }>
        }
        dispatch(intent: { type: string; viewId?: string; targetGroupId?: string; edge?: string }): { accepted: boolean; reason?: string }
      }
    }
    face.registerView({
      descriptor: { kind: 'test.bottom', label: 'Bottom Tool', componentKey: 'bottom-tool', role: 'utility', preferredRegion: 'bottom', retention: 'recreate', singleton: true },
      component: () => null,
    })
    face.openView({ kind: 'test.bottom', resourceKey: 'test:bottom', role: 'utility', preferredRegion: 'bottom', retention: 'recreate', singleton: true, pinned: true, title: 'Bottom Tool' })
    const overlayState = face.controller.getSnapshot()
    const opened = Object.values(overlayState.views)[0]
    // Tier 0 collapse is render-time only: the canonical region/group is never rewritten.
    expect(opened?.region).toBe('bottom')
    expect(overlayState.groups[opened?.groupId ?? '']?.region).toBe('bottom')
    expect(overlayState.regions.bottom.visible).toBe(true)
    expect(overlayState.regions.right.visible).toBe(false)
    // Host-geometry intents are gated before dispatch with the standard reason.
    const gated = face.controller.dispatch({ type: 'split_with_view', viewId: opened?.id ?? '', targetGroupId: opened?.groupId ?? '', edge: 'right' })
    expect(gated.accepted).toBe(false)
    expect(gated.reason).toBe('reason.geometryTier0')
    expect(face.controller.getSnapshot().groups['group:bottom:utility']?.tabs).toHaveLength(1)
    dispose()
  })

  it('fail-closes on contradictory workspace slot declarations instead of mounting half-functional', () => {
    const slots = {
      spec: (name: string) => name.startsWith('shell.workspace.') ? { kind: 'single', scope: 'root' } : undefined,
      inject: vi.fn((_name: string, setup: () => () => void) => setup()),
      register: vi.fn(() => vi.fn()),
    }
    const workspaceLayout = { attach: vi.fn() }
    const provide = vi.fn()
    const ctx = {
      get: (name: string) => name === 'slots' ? slots : name === 'workspaceLayout' ? workspaceLayout : undefined,
      provide,
    }
    const probe = probePaneWorkbenchHost(ctx)
    expect(probe.available).toBe(false)
    expect(probe.reason).toMatch(/workspace\.core-pane\.v1/)
    expect(probe.missing).toContain('workspace.core-pane.v1')
    // apply() must not throw, but the contradictory host (both slots declared,
    // core-pane contract missing) mounts nothing and provides nothing.
    const dispose = apply(ctx as never)
    expect(typeof dispose).toBe('function')
    expect(workspaceLayout.attach).not.toHaveBeenCalled()
    expect(slots.inject).not.toHaveBeenCalledWith('shell.overlay', expect.any(Function))
    expect(provide).not.toHaveBeenCalledWith('paneWorkbench', expect.any(Object))
    dispose()
  })

  it('uses overlay with residual workspaceLayout and no workspace slots', () => {
    const slots = {
      spec: () => undefined,
      inject: vi.fn((_name: string, setup: () => () => void) => setup()),
      register: vi.fn(() => vi.fn()),
    }
    const workspaceLayout = { attach: vi.fn() }
    const provide = vi.fn()
    const ctx = {
      get: (name: string) => name === 'slots' ? slots : name === 'workspaceLayout' ? workspaceLayout : undefined,
      provide,
    }
    const probe = probePaneWorkbenchHost(ctx)
    expect(probe.available).toBe(false)
    expect(probe.missing).toEqual(expect.arrayContaining(['workspace.core-pane.v1', 'shell.workspace.right', 'shell.workspace.bottom']))
    const dispose = apply(ctx as never)
    expect(workspaceLayout.attach).not.toHaveBeenCalled()
    expect(slots.inject).toHaveBeenCalledWith('shell.overlay', expect.any(Function))
    expect(provide).toHaveBeenCalledWith('paneWorkbench', expect.any(Object))
    dispose()
  })

  it('upgrades the overlay to the Core host on seam hot-plug without losing state', () => {
    const slotSpecs: Record<string, unknown> = {}
    const registered: Array<{ name: string; dispose: ReturnType<typeof vi.fn> }> = []
    const slots = {
      spec: (name: string) => slotSpecs[name],
      inject: (_name: string, setup: () => () => void) => { const dispose = setup(); return () => dispose() },
      register: (input: { name: string }) => { const dispose = vi.fn(); registered.push({ name: input.name, dispose }); return dispose },
    }
    let workspaceLayout: unknown
    const layoutHandle = {
      update: vi.fn(),
      getSnapshot: () => ({ attached: true, rightVisible: false, bottomVisible: false, rightWidth: 480, bottomRatio: 0.34, activeRegion: 'right' as const }),
      subscribe: () => () => {},
      dispose: vi.fn(),
    }
    const attach = vi.fn(() => layoutHandle)
    const commandListeners = new Set<() => void>()
    const commands = {
      list: () => [],
      subscribe: (listener: () => void) => { commandListeners.add(listener); return () => commandListeners.delete(listener) },
    }
    const provide = vi.fn()
    const ctx = {
      get: (name: string) => name === 'slots' ? slots
        : name === 'workspaceLayout' ? workspaceLayout
          : name === 'commands' ? commands
            : undefined,
      provide,
    }
    const dispose = apply(ctx as never)
    expect(registered.map(entry => entry.name)).toEqual(['shell.overlay'])
    const face = provide.mock.calls[0]?.[1] as {
      registerView(input: unknown): () => void
      openView(input: unknown): void
      experienceTier: { getSnapshot(): { tier: number } }
      controller: {
        getSnapshot(): {
          views: Record<string, { id: string; pinned: boolean; groupId: string }>
          activeGroupId?: string
          groups: Record<string, { activeTabId?: string }>
          maximizedGroupId?: string
        }
        dispatch(intent: { type: string; groupId?: string }): { accepted: boolean; reason?: string }
      }
    }
    face.registerView({
      descriptor: { kind: 'test.tool', label: 'Tool', componentKey: 'tool', role: 'content', preferredRegion: 'right', retention: 'recreate', singleton: false },
      component: () => null,
    })
    face.registerView({
      descriptor: { kind: 'test.bottom', label: 'Bottom Tool', componentKey: 'bottom-tool', role: 'utility', preferredRegion: 'bottom', retention: 'recreate', singleton: false },
      component: () => null,
    })
    face.openView({ kind: 'test.tool', resourceKey: 'test:one', role: 'content', preferredRegion: 'right', retention: 'recreate', singleton: false, pinned: true, title: 'One' })
    face.openView({ kind: 'test.bottom', resourceKey: 'test:two', role: 'utility', preferredRegion: 'bottom', retention: 'recreate', singleton: false, title: 'Two' })
    const before = face.controller.getSnapshot()
    expect(Object.keys(before.views)).toHaveLength(2)
    expect(face.experienceTier.getSnapshot().tier).toBe(0)

    // Seam hot-plug: workspace slots + core-pane contract appear, the command surface announces it.
    workspaceLayout = { corePaneVersion: PANE_CORE_HOST_CONTRACT, attach }
    slotSpecs['shell.workspace.right'] = { kind: 'single', scope: 'root' }
    slotSpecs['shell.workspace.bottom'] = { kind: 'single', scope: 'root' }
    for (const listener of commandListeners) listener()

    expect(face.experienceTier.getSnapshot().tier).toBe(1)
    expect(attach).toHaveBeenCalledTimes(1)
    expect(registered.map(entry => entry.name)).toEqual(['shell.overlay', 'shell.workspace.right', 'shell.workspace.bottom'])
    // The overlay chrome is unmounted exactly once; the runtime (and canonical state) is reused.
    expect(registered[0]?.dispose).toHaveBeenCalledOnce()
    expect(provide).toHaveBeenCalledTimes(1)
    const after = face.controller.getSnapshot()
    expect(Object.keys(after.views)).toEqual(Object.keys(before.views))
    expect(Object.values(after.views).map(view => view.pinned)).toEqual(Object.values(before.views).map(view => view.pinned))
    expect(after.activeGroupId).toBe(before.activeGroupId)
    // The Tier 1 attach reports the live canonical visibility, not a reset layout.
    expect(attach.mock.calls[0]?.[1]).toMatchObject({ bottomVisible: true })
    // The geometry gate is open after the upgrade: maximize reaches the reducer.
    const view = Object.values(after.views)[0]!
    const result = face.controller.dispatch({ type: 'maximize_group', groupId: view.groupId })
    expect(result.reason).not.toBe('reason.geometryTier0')
    expect(face.controller.getSnapshot().maximizedGroupId).toBe(view.groupId)
    dispose()
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
