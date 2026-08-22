import { describe, expect, it, vi } from 'vitest'
import { PaneWorkbenchController } from '../src/controller.js'
import type { PaneWorkspaceLayoutHandle, PaneWorkspaceLayoutSnapshot } from '../src/controller.js'
import { PaneWorkspacePersistenceAdapter } from '../src/persistence.js'

describe('PaneWorkbenchController', () => {
  it('starts hidden and show/hide notify subscribers', () => {
    const controller = new PaneWorkbenchController()
    expect(controller.isVisible).toBe(false)
    const listener = vi.fn()
    const unsubscribe = controller.subscribe(listener)
    controller.show()
    expect(controller.isVisible).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    controller.hide()
    expect(controller.isVisible).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    controller.show()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('openView reveals the workbench before dispatching', () => {
    const controller = new PaneWorkbenchController()
    const dispatch = vi.fn()
    controller.attach(dispatch)
    controller.openView({
      kind: 'subagent.monitor',
      resourceKey: 'subagent:root',
      role: 'navigator',
      preferredRegion: 'right',
      retention: 'keep-alive',
      singleton: true,
      pinned: true,
      title: 'Agents',
    })
    expect(controller.isVisible).toBe(true)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'open_view',
      request: expect.objectContaining({ kind: 'subagent.monitor' }),
    })
  })

  it('queues openView before attach and flushes it on attach', () => {
    const controller = new PaneWorkbenchController()
    controller.openView({
      kind: 'file.tree',
      resourceKey: 'workspace:root',
      role: 'navigator',
      preferredRegion: 'right',
      retention: 'recreate',
      singleton: true,
      pinned: true,
      title: 'Files',
    })
    expect(controller.isVisible).toBe(true)
    const dispatch = vi.fn()
    const detach = controller.attach(dispatch)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'open_view',
      request: expect.objectContaining({ kind: 'file.tree' }),
    })
    detach()
    dispatch.mockClear()
    controller.openView({
      kind: 'file.tree',
      resourceKey: 'workspace:root',
      role: 'navigator',
      preferredRegion: 'right',
      retention: 'recreate',
      singleton: true,
    })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('synchronizes region visibility, AppFrame resize and Escape restore through one layout handle', () => {
    let snapshot: PaneWorkspaceLayoutSnapshot = {
      attached: true,
      rightVisible: false,
      bottomVisible: false,
      rightWidth: 480,
      bottomRatio: 0.34,
      activeRegion: 'right',
    }
    const listeners = new Set<() => void>()
    const updates: object[] = []
    const handle: PaneWorkspaceLayoutHandle = {
      update: (patch) => {
        updates.push(patch)
        snapshot = { ...snapshot, ...patch }
        for (const listener of listeners) listener()
      },
      getSnapshot: () => snapshot,
      subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
      dispose: vi.fn(),
    }
    const controller = new PaneWorkbenchController()
    controller.bindWorkspaceLayout(handle)
    controller.openView({
      kind: 'file.preview', resourceKey: 'file:README.md', role: 'content', preferredRegion: 'right',
      retention: 'snapshot', singleton: false, pinned: true,
    })
    expect(snapshot.rightVisible).toBe(true)
    expect(updates.length).toBeGreaterThan(0)

    snapshot = { ...snapshot, rightWidth: 600 }
    for (const listener of listeners) listener()
    expect(controller.getSnapshot().regions.right.size).toBeCloseTo(0.4)

    const groupId = controller.getSnapshot().activeGroupId!
    controller.dispatch({ type: 'maximize_group', groupId })
    expect(snapshot.maximizedRegion).toBe('right')
    snapshot = { ...snapshot, maximizedRegion: undefined }
    for (const listener of listeners) listener()
    expect(controller.getSnapshot().maximizedGroupId).toBeUndefined()
  })

  it('coordinates an atomic cross-region move and rolls back an invalid drop', () => {
    const controller = new PaneWorkbenchController()
    controller.openView({ kind: 'file.preview', resourceKey: 'file:one', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false, pinned: true })
    controller.openView({ kind: 'terminal.session', resourceKey: 'terminal:one', role: 'utility', preferredRegion: 'bottom', retention: 'keep-alive', singleton: false, pinned: true })
    const file = Object.values(controller.getSnapshot().views).find(view => view.kind === 'file.preview')!
    const bottomGroup = controller.getSnapshot().groups['group:bottom:utility']!
    controller.drag.begin(file.id, 0, 0)
    controller.drag.move(20, 0, { groupId: bottomGroup.id, edge: 'center', enabled: true })
    expect(controller.drag.drop()?.accepted).toBe(true)
    expect(controller.getSnapshot().views[file.id]?.region).toBe('bottom')

    const moved = controller.getSnapshot().views[file.id]!
    controller.drag.begin(moved.id, 0, 0)
    controller.drag.move(20, 0, { groupId: 'missing', edge: 'center', enabled: false, reason: 'invalid' })
    expect(controller.drag.drop()).toBeUndefined()
    expect(controller.getSnapshot().views[file.id]?.region).toBe('bottom')
  })

  it('keeps an opened view when the first concrete session arrives after startup', () => {
    const values = new Map<string, string>()
    const persistence = new PaneWorkspacePersistenceAdapter({
      getItem: key => values.get(key),
      setItem: (key, value) => { values.set(key, value) },
      removeItem: key => { values.delete(key) },
    })
    const controller = new PaneWorkbenchController({ persistence })
    controller.openView({
      kind: 'file.tree', resourceKey: 'workspace:root', role: 'navigator', preferredRegion: 'right',
      retention: 'recreate', singleton: true, pinned: true, title: 'Files',
    })

    controller.switchSession('session-late')

    expect(controller.getSnapshot().regions.right.visible).toBe(true)
    expect(Object.values(controller.getSnapshot().views)).toEqual([
      expect.objectContaining({ kind: 'file.tree', title: 'Files', region: 'right' }),
    ])
    expect([...values.keys()].some(key => key.includes('preset:session:session-late:'))).toBe(true)
  })

  it('restores independent Pane layouts while switching between concrete sessions', () => {
    const values = new Map<string, string>()
    const persistence = new PaneWorkspacePersistenceAdapter({
      getItem: key => values.get(key),
      setItem: (key, value) => { values.set(key, value) },
      removeItem: key => { values.delete(key) },
    })
    const controller = new PaneWorkbenchController({ persistence })
    controller.switchSession('session-a')
    controller.openView({
      kind: 'file.tree', resourceKey: 'workspace:a', role: 'navigator', preferredRegion: 'right',
      retention: 'recreate', singleton: true, pinned: true, title: 'Files A',
    })

    controller.switchSession('session-b')
    expect(Object.keys(controller.getSnapshot().views)).toHaveLength(0)
    controller.openView({
      kind: 'terminal.session', resourceKey: 'terminal:b', role: 'utility', preferredRegion: 'bottom',
      retention: 'keep-alive', singleton: true, pinned: true, title: 'Terminal B',
    })

    controller.switchSession('session-a')
    expect(Object.values(controller.getSnapshot().views)).toEqual([
      expect.objectContaining({ kind: 'file.tree', title: 'Files A', region: 'right' }),
    ])
    controller.switchSession('session-b')
    expect(Object.values(controller.getSnapshot().views)).toEqual([
      expect.objectContaining({ kind: 'terminal.session', title: 'Terminal B', region: 'bottom' }),
    ])
  })
})
