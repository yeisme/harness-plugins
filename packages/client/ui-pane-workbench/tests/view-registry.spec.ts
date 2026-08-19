import { describe, expect, it, vi } from 'vitest'
import {
  PaneViewRegistry,
  PaneViewRegistrationError,
  createPaneWorkspace,
  markOrphanedPaneViews,
  reducePaneWorkspace,
} from '../src/index.js'
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
    for (const field of ['componentUrl', 'moduleName', 'iframe']) {
      expect(() => registry.registerView({
        descriptor: pluginDefinition('pinax.notes-preview').views[0],
        component: () => null,
        [field]: 'untrusted-component',
      })).toThrow(PaneViewRegistrationError)
    }
    expect(registry.snapshot()).toEqual([])
  })

  it('gates capabilities before registration and orphan-recovers on disposer', () => {
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    expect(() => registry.registerView({
      descriptor: pluginDefinition('pinax.notes-preview').views[0],
      component: () => null,
      requiredCapabilities: ['pane.notes.v1'],
    })).toThrow(/capabilit/iu)

    const admitted = new PaneViewRegistry({ capabilities: new Set(['pane.notes.v1']) })
    const dispose = admitted.registerView({
      descriptor: pluginDefinition('pinax.notes-preview').views[0],
      component: () => null,
      requiredCapabilities: ['pane.notes.v1'],
    })
    const state = reducePaneWorkspace(createPaneWorkspace(), {
      type: 'open_view',
      request: {
        kind: 'pinax.notes-preview.view',
        resourceKey: 'artifact:notes:1',
        role: 'content',
        preferredRegion: 'right',
        retention: 'recreate',
        singleton: false,
      },
    }).state
    dispose()
    expect(markOrphanedPaneViews(state, admitted).views[Object.keys(state.views)[0]!]?.status).toBe('orphaned')
  })
})
