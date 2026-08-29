import { describe, expect, it, vi } from 'vitest'
import {
  PaneDragCoordinator,
  createDragGhostPayload,
  intentForDragTarget,
  isReducedMotion,
  listKeyboardMoveTargets,
  planCrossRootFlip,
  planCrossRootViewLifecycle,
} from '../src/drag-coordinator.js'
import {
  PANE_DRAG_COARSE_HOLD_MS,
  PANE_DRAG_THRESHOLD_PX,
  PaneDragSession,
  resolveDropTargetFromPoint,
  shouldIgnoreDragStart,
  type PaneFrameSchedulerV1,
} from '../src/interactions.js'
import { createPaneWorkspace, reducePaneWorkspace } from '../src/workspace.js'

function scheduler(): PaneFrameSchedulerV1 & { flush(): void } {
  const callbacks: Array<() => void> = []
  return {
    request(callback) {
      callbacks.push(callback)
      return callbacks.length
    },
    cancel() {
      callbacks.length = 0
    },
    flush() {
      const next = callbacks.shift()
      next?.()
    },
  }
}

function workspaceWithView() {
  return reducePaneWorkspace(createPaneWorkspace(), {
    type: 'open_view',
    request: {
      kind: 'file.text',
      resourceKey: 'file:one',
      role: 'content',
      preferredRegion: 'right',
      retention: 'recreate',
      singleton: false,
      preview: false,
      pinned: true,
      title: 'one.md',
    },
  }).state
}

describe('V4 Task 3.5-3.8 drag coordinator', () => {
  it('keeps click, scroll, and context menu from starting a drag', () => {
    expect(shouldIgnoreDragStart({ clientX: 1, clientY: 1, type: 'contextmenu', button: 2 })).toBe(true)
    expect(shouldIgnoreDragStart({ clientX: 1, clientY: 1, type: 'scroll' })).toBe(true)
    const session = new PaneDragSession()
    session.begin('view:one', 0, 0, { clientX: 0, clientY: 0, type: 'contextmenu', button: 2 })
    expect(session.state.status).toBe('idle')
    session.begin('view:one', 10, 10, 'fine', 0)
    expect(session.move(10 + PANE_DRAG_THRESHOLD_PX - 1, 10).status).toBe('pending')
    expect(session.move(10 + PANE_DRAG_THRESHOLD_PX, 10).status).toBe('dragging')
  })

  it('holds coarse pointers pending until the long-press gate', () => {
    const session = new PaneDragSession()
    session.begin('view:one', 0, 0, 'coarse', 0)
    expect(session.move(20, 0, undefined, PANE_DRAG_COARSE_HOLD_MS - 1).status).toBe('pending')
    expect(session.move(20, 0, undefined, PANE_DRAG_COARSE_HOLD_MS).status).toBe('dragging')
  })

  it('coalesces pointermove visuals and dispatches only on drop', () => {
    const frames = scheduler()
    let state = workspaceWithView()
    const viewId = Object.keys(state.views)[0]!
    const dispatches: string[] = []
    const coordinator = new PaneDragCoordinator(
      () => state,
      intent => {
        dispatches.push(intent.type)
        const result = reducePaneWorkspace(state, intent)
        state = result.state
        return result
      },
      frames,
    )
    coordinator.begin(viewId, 10, 10, 'fine', 0)
    coordinator.move(20, 10, { groupId: 'group:right:content', edge: 'center', enabled: true, index: 0 }, 20)
    coordinator.move(40, 10, { groupId: 'group:right:content', edge: 'center', enabled: true, index: 0 }, 30)
    expect(dispatches).toEqual([])
    expect(coordinator.getSnapshot().dispatchCount).toBe(0)
    frames.flush()
    expect(coordinator.getSnapshot().drag.status).toBe('dragging')
    expect(coordinator.getSnapshot().visuals.ghost?.viewId).toBe(viewId)
    expect(coordinator.getSnapshot().visuals.ghost).not.toHaveProperty('body')
    const result = coordinator.drop()
    expect(result?.accepted).toBe(true)
    expect(dispatches).toEqual(['reorder_view'])
    expect(coordinator.getSnapshot().dispatchCount).toBe(1)
  })

  it('cancels a cross-root generation without committing', () => {
    const frames = scheduler()
    const state = workspaceWithView()
    const viewId = Object.keys(state.views)[0]!
    let dispatched = 0
    const coordinator = new PaneDragCoordinator(() => state, intent => {
      dispatched += 1
      return reducePaneWorkspace(state, intent)
    }, frames)
    coordinator.begin(viewId, 0, 0)
    coordinator.move(20, 0, { groupId: 'group:bottom:utility', edge: 'center', enabled: true }, 20)
    frames.flush()
    const generation = coordinator.getSnapshot().generation
    coordinator.cancel()
    expect(dispatched).toBe(0)
    expect(coordinator.getSnapshot().drag.status).toBe('idle')
    expect(coordinator.getSnapshot().generation).toBe(generation)
  })

  it('uses real default timestamps so a drag can leave the source pane after the sticky interval', () => {
    const frames = scheduler()
    const state = workspaceWithView()
    const viewId = Object.keys(state.views)[0]!
    const clock = vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(120)
    const coordinator = new PaneDragCoordinator(() => state, intent => reducePaneWorkspace(state, intent), frames)
    try {
      coordinator.begin(viewId, 0, 0)
      coordinator.move(20, 0, { groupId: 'group:right:content', edge: 'center', enabled: true })
      frames.flush()
      coordinator.move(20, 600, { groupId: 'group:bottom:utility', edge: 'center', enabled: true })
      frames.flush()
      expect(coordinator.getSnapshot().target?.groupId).toBe('group:bottom:utility')
    } finally {
      clock.mockRestore()
    }
  })

  it('lets an explicit release target win when the pointer stops inside a new attachment zone', () => {
    const frames = scheduler()
    let state = workspaceWithView()
    const viewId = Object.keys(state.views)[0]!
    const coordinator = new PaneDragCoordinator(() => state, intent => {
      const result = reducePaneWorkspace(state, intent)
      state = result.state
      return result
    }, frames)
    coordinator.begin(viewId, 0, 0, 'fine', 0)
    coordinator.move(20, 0, { groupId: 'group:right:content', edge: 'center', enabled: true }, 20)
    frames.flush()
    const result = coordinator.drop({ groupId: 'group:bottom:utility', edge: 'center', enabled: true })
    expect(result?.accepted).toBe(true)
    expect(state.views[viewId]?.groupId).toBe('group:bottom:utility')
  })

  it('reuses pointer target math for keyboard move and disabled reasons', () => {
    const zone = {
      groupId: 'group:right:content',
      rect: { x: 0, y: 0, width: 640, height: 400 },
      locked: false,
      visibleGroupCount: 4,
      splitDepth: 2,
    }
    const pointer = resolveDropTargetFromPoint(630, 200, zone)
    expect(pointer.edge).toBe('right')
    expect(pointer.enabled).toBe(false)
    expect(pointer.reason).toBe('split_limit')
    const state = workspaceWithView()
    const viewId = Object.keys(state.views)[0]!
    const keyboard = listKeyboardMoveTargets(state, viewId, [zone])
    const keyboardEdge = keyboard.find(target => target.edge === 'right')
    expect(keyboardEdge?.enabled).toBe(pointer.enabled)
    expect(keyboardEdge?.reason).toBe(pointer.reason)
    expect(intentForDragTarget(viewId, 'group:right:content', { groupId: 'group:bottom:utility', edge: 'center', enabled: true }).type).toBe('move_view')
    expect(intentForDragTarget(viewId, 'group:right:content', { groupId: 'group:right:content', edge: 'right', enabled: true }).type).toBe('split_with_view')
  })

  it('plans FLIP only when motion is allowed and never double-mounts media or terminal', () => {
    const first = { 'view:one': { x: 0, y: 0, width: 80, height: 32 } }
    const last = { 'view:one': { x: 40, y: 0, width: 80, height: 32 } }
    expect(planCrossRootFlip(first, last, 'full', false)).toHaveLength(1)
    expect(planCrossRootFlip(first, last, 'reduced', false)).toEqual([])
    expect(isReducedMotion('system', true)).toBe(true)
    expect(planCrossRootViewLifecycle('terminal.session', 'view:term')).toMatchObject({
      steps: ['suspend-old', 'activate-new'],
      allowDoubleMount: false,
    })
    expect(planCrossRootViewLifecycle('media.player', 'view:media').kind).toBe('media')
    const ghost = createDragGhostPayload(workspaceWithView(), Object.keys(workspaceWithView().views)[0]!, 1, 2)
    expect(ghost).not.toHaveProperty('body')
  })
})
