import { describe, expect, it } from 'vitest'
import { PaneDragSession, PaneResizeSession, PANE_DRAG_THRESHOLD_PX, type PaneFrameSchedulerV1 } from '../src/index.js'

describe('pane pointer interaction sessions', () => {
  it('keeps drag pending below the six-pixel threshold and cleans invalid drops', () => {
    const drag = new PaneDragSession()
    drag.begin('view:one', 10, 10)
    expect(drag.move(10 + PANE_DRAG_THRESHOLD_PX - 1, 10).status).toBe('pending')
    expect(drag.move(10 + PANE_DRAG_THRESHOLD_PX, 10).status).toBe('dragging')
    expect(drag.drop()).toBeUndefined()
    expect(drag.state).toEqual({ status: 'idle' })
    drag.begin('view:one', 0, 0)
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
