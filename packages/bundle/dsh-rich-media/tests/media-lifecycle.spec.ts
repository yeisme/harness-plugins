import { describe, expect, it } from 'vitest'
import { MediaLifecycleController, MediaLifecycleError } from '../src/client/media-lifecycle.ts'

describe('MediaLifecycleController', () => {
  it('suspend keeps only bounded memory and activate restores it once', () => {
    const controller = new MediaLifecycleController()
    const kept = controller.suspend({ currentTime: 12.5, zoom: 2, extra: 'dropped' } as never)
    expect(kept).toEqual({ currentTime: 12.5, zoom: 2 })
    expect(controller.state).toBe('suspended')
    const restored = controller.activate()
    expect(restored).toEqual({ currentTime: 12.5, zoom: 2 })
    expect(controller.state).toBe('active')
    // activating an already-active view yields empty memory, not stale state
    expect(controller.activate()).toEqual({})
  })

  it('release is terminal and guards every later transition', () => {
    const controller = new MediaLifecycleController()
    controller.release()
    expect(controller.state).toBe('released')
    expect(() => controller.suspend()).toThrow(MediaLifecycleError)
    expect(() => controller.activate()).toThrow(MediaLifecycleError)
    expect(() => controller.recordAccess()).toThrow(MediaLifecycleError)
    expect(() => controller.handleExpired()).toThrow(MediaLifecycleError)
  })

  it('expired handles re-resolve and resolutions are counted', () => {
    const controller = new MediaLifecycleController()
    controller.recordAccess()
    expect(controller.handleExpired()).toBe('re-resolve')
    controller.recordAccess()
    expect(controller.accessResolutions).toBe(2)
  })

  it('suspend and activate round-trips do not double count or resurrect memory', () => {
    const controller = new MediaLifecycleController()
    controller.suspend({ currentTime: 1 })
    controller.activate()
    controller.suspend({ zoom: 3 })
    expect(controller.activate()).toEqual({ zoom: 3 })
  })

  it('applyVisibility suspends hidden hosts and activates visible ones', () => {
    const controller = new MediaLifecycleController()
    expect(controller.applyVisibility(false, { currentTime: 4 })).toBe('suspended')
    expect(controller.applyVisibility(true)).toBe('active')
    controller.release()
    expect(controller.applyVisibility(true)).toBe('released')
  })
})
