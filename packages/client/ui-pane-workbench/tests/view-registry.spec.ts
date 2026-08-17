import { describe, expect, it, vi } from 'vitest'
import { PaneViewRegistry, PaneViewRegistrationError } from '../src/index.js'
import { pluginDefinition } from './fixtures.js'

describe('local pane view registry', () => {
  it('keeps registration and later notifications when a subscriber throws', () => {
    const onListenerError = vi.fn()
    const registry = new PaneViewRegistry({ capabilities: new Set(), onListenerError })
    const throwing = vi.fn(() => { throw new Error('subscriber failed') })
    const following = vi.fn()
    registry.subscribe(throwing)
    registry.subscribe(following)

    const dispose = registry.registerView({
      descriptor: pluginDefinition('pinax.notes-preview').views[0],
      component: () => null,
    })
    expect(typeof dispose).toBe('function')
    expect(registry.snapshot()).toHaveLength(1)
    expect(following).toHaveBeenCalledTimes(1)

    dispose()
    expect(registry.snapshot()).toEqual([])
    expect(following).toHaveBeenCalledTimes(2)
    expect(onListenerError).toHaveBeenCalledTimes(2)
  })

  it('rejects remote component selection fields before mutation', () => {
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    expect(() => registry.registerView({
      descriptor: pluginDefinition('pinax.notes-preview').views[0],
      component: () => null,
      componentUrl: 'https://unsafe.invalid/view.js',
    })).toThrow(PaneViewRegistrationError)
    expect(registry.snapshot()).toEqual([])
  })
})
