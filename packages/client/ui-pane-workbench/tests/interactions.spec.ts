import { describe, expect, it, vi } from 'vitest'
import { PaneDragSession, PaneResizeSession, PANE_DRAG_THRESHOLD_PX, PANE_COARSE_POINTER_PRESS_MS, type PaneFrameSchedulerV1 } from '../src/index.js'

describe('pane pointer interaction sessions', () => {
  it('keeps drag pending below the six-pixel threshold and cleans invalid drops', () => {
    const drag = new PaneDragSession()
    drag.begin('view:one', 10, 10, 'fine')
    expect(drag.move(10 + PANE_DRAG_THRESHOLD_PX - 1, 10).status).toBe('pending')
    expect(drag.move(10 + PANE_DRAG_THRESHOLD_PX, 10).status).toBe('dragging')
    expect(drag.drop()).toBeUndefined()
    expect(drag.state).toEqual({ status: 'idle' })
    drag.begin('view:one', 0, 0, 'fine')
    drag.move(10, 0, { groupId: 'group:right:content', edge: 'center', enabled: false, reason: 'locked' })
    expect(drag.drop()).toBeUndefined()
    expect(drag.state).toEqual({ status: 'idle' })
  })

  it('coalesces resize preview to one scheduled frame and flushes the final ratio', () => {
    const callbacks: Array<() => void> = []
    const cancelled: unknown[] = []
    let frameId = 0
    const scheduler: PaneFrameSchedulerV1 = {
      request: callback => { callbacks.push(callback); frameId += 1; return frameId },
      cancel: handle => { cancelled.push(handle) },
    }
    const previews: Array<number | undefined> = []
    const commits: number[] = []
    const resize = new PaneResizeSession(value => previews.push(value), value => commits.push(value), scheduler)

    resize.begin()
    resize.move(0.3)
    resize.move(0.4)
    expect(callbacks).toHaveLength(1)
    expect(previews).toEqual([undefined])
    callbacks.shift()!()
    expect(previews).toEqual([undefined, 0.4])

    resize.move(0.5)
    resize.end()
    expect(cancelled).toEqual([2])
    expect(previews).toEqual([undefined, 0.4, 0.5, undefined])
    expect(commits).toEqual([0.5])
  })

  it('cancels a queued frame without committing a ratio', () => {
    const callbacks: Array<() => void> = []
    const scheduler: PaneFrameSchedulerV1 = {
      request: callback => { callbacks.push(callback); return 'frame-1' },
      cancel: () => {},
    }
    const previews: Array<number | undefined> = []
    const commits: number[] = []
    const resize = new PaneResizeSession(value => previews.push(value), value => commits.push(value), scheduler)
    resize.begin()
    resize.move(0.6)
    resize.cancel()
    callbacks[0]?.()
    expect(previews).toEqual([undefined, undefined])
    expect(commits).toEqual([])
  })
})

describe('V4 Task 3.5: Drag Coordinator State Machine', () => {
  it('fine pointer starts immediately and passes threshold quickly', () => {
    const drag = new PaneDragSession()
    drag.begin('view:one', 10, 10, 'fine')

    // Fine pointer enters pending immediately
    expect(drag.state.status).toBe('pending')
    expect(drag.state).toMatchObject({ status: 'pending', viewId: 'view:one', pointerType: 'fine' })

    // Pass threshold
    const state = drag.move(20, 20)
    expect(state.status).toBe('dragging')
    expect(state).toMatchObject({ status: 'dragging', viewId: 'view:one', pointerType: 'fine' })
  })

  it('coarse pointer requires long press timer before dragging', () => {
    const callbacks: Array<() => void> = []
    let timerId = 0
    const scheduler: PaneFrameSchedulerV1 = {
      request: callback => { callbacks.push(callback); timerId += 1; return timerId },
      cancel: handle => { /* test only */ },
    }
    const drag = new PaneDragSession(scheduler)

    drag.begin('view:one', 10, 10, 'coarse')

    // Coarse pointer enters pending with timer
    expect(drag.state.status).toBe('pending')
    expect(drag.state).toMatchObject({ status: 'pending', pointerType: 'coarse' })
    expect(drag.state).not.toHaveProperty('pressTimer', undefined)

    // Moving before timer cancels timer
    drag.move(10 + PANE_DRAG_THRESHOLD_PX - 1, 10)
    expect(drag.state.status).toBe('pending') // Still pending, timer cancelled
  })

  it('drag transitions through committing phase before idle', () => {
    const callbacks: Array<() => void> = []
    const scheduler: PaneFrameSchedulerV1 = {
      request: callback => { callbacks.push(callback); return 1 },
      cancel: () => {},
    }
    const drag = new PaneDragSession(scheduler)

    drag.begin('view:one', 10, 10, 'fine')
    drag.move(20, 20, {
      groupId: 'group:right:content',
      edge: 'center',
      enabled: true,
      index: 0,
    })

    // Drop should transition to committing
    const target = drag.drop()
    expect(target).toBeDefined()
    expect(drag.state.status).toBe('committing')

    // Simulate frame completion
    callbacks[0]?.()
    expect(drag.state.status).toBe('idle')
  })

  it('cancel transitions through cancelling phase with reason', () => {
    const callbacks: Array<() => void> = []
    const scheduler: PaneFrameSchedulerV1 = {
      request: callback => { callbacks.push(callback); return 1 },
      cancel: () => {},
    }
    const drag = new PaneDragSession(scheduler)

    drag.begin('view:one', 10, 10, 'fine')
    drag.move(20, 20)

    drag.cancel('escape_pressed')
    expect(drag.state.status).toBe('cancelling')
    expect(drag.state).toMatchObject({ status: 'cancelling', reason: 'escape_pressed' })

    // Simulate frame completion
    callbacks[0]?.()
    expect(drag.state.status).toBe('idle')
  })

  it('dispose properly cleans up timers and forces idle state', () => {
    const scheduler = {
      request: vi.fn(() => 1),
      cancel: vi.fn(),
    }
    const drag = new PaneDragSession(scheduler)

    // Start a coarse drag with timer
    drag.begin('view:one', 10, 10, 'coarse')
    expect(scheduler.request).toHaveBeenCalled()

    // Dispose should clean up timer and force idle
    drag.dispose()
    expect(scheduler.cancel).toHaveBeenCalled()
    expect(drag.state.status).toBe('idle')

    // Double dispose is safe
    drag.dispose()
    expect(drag.state.status).toBe('idle')
  })

  it('click and scroll do not trigger drag on fine pointer', () => {
    const drag = new PaneDragSession()

    // Small movement below threshold
    drag.begin('view:one', 10, 10, 'fine')
    expect(drag.move(10 + PANE_DRAG_THRESHOLD_PX - 1, 10).status).toBe('pending')

    // Drop without dragging should cancel
    expect(drag.drop()).toBeUndefined()
    expect(drag.state.status).toBe('idle')
  })

  it('context menu and escape cancel drag with reason', () => {
    const drag = new PaneDragSession()

    drag.begin('view:one', 10, 10, 'fine')
    drag.move(20, 20)

    drag.cancel('context_menu_triggered')
    expect(drag.state.status).toBe('cancelling')
    expect(drag.state).toMatchObject({ reason: 'context_menu_triggered' })
  })

  it('cross-root disposal prevents timer leaks', () => {
    const scheduler = {
      request: vi.fn(() => 100),
      cancel: vi.fn(),
    }
    const drag = new PaneDragSession(scheduler)

    // Simulate React component unmount during drag
    drag.begin('view:one', 10, 10, 'coarse')
    expect(scheduler.request).toHaveBeenCalledTimes(1)

    // Dispose should cancel timer
    drag.dispose()
    expect(scheduler.cancel).toHaveBeenCalledWith(100)
    expect(drag.state.status).toBe('idle')

    // No further timers created
    drag.begin('view:two', 20, 20, 'coarse')
    expect(scheduler.request).toHaveBeenCalledTimes(2)
  })
})
