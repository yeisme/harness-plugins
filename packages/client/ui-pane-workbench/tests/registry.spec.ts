import { describe, expect, it, vi } from 'vitest'
import { PanePluginRegistry, PaneRegistrationError, buildArtifactIntent } from '../src/index.js'
import { context, imageArtifact, runtimePlugin } from './fixtures.js'

function environment(generation = 1) {
  return {
    generation,
    dshApiVersion: '0.1.0-rc.6',
    capabilities: new Set(['pane.event.v1']),
    permissions: new Set(['media.review']),
  }
}

describe('pane plugin registry', () => {
  it('registers two independent mock providers through the same public path', () => {
    const registry = new PanePluginRegistry(environment())
    const notesDispose = registry.register(runtimePlugin('pinax.notes-preview'))
    const mediaDispose = registry.register(runtimePlugin('sonora.media-review', { permission: 'media.review' }))
    expect(registry.snapshot().map(entry => entry.definition.id)).toEqual([
      'pinax.notes-preview',
      'sonora.media-review',
    ])
    notesDispose()
    expect(registry.snapshot()).toHaveLength(1)
    mediaDispose()
    expect(registry.snapshot()).toEqual([])
  })

  it('rejects duplicate plugin ids and missing capabilities', () => {
    const registry = new PanePluginRegistry(environment())
    registry.register(runtimePlugin('pinax.notes-preview'))
    expect(() => registry.register(runtimePlugin('pinax.notes-preview'))).toThrow(PaneRegistrationError)
    expect(() => registry.register(runtimePlugin('browser.session', { capability: 'browser.session.v1' })))
      .toThrow(/missing capabilities/)
  })

  it('rejects missing local component factories', () => {
    const registry = new PanePluginRegistry(environment())
    const plugin = runtimePlugin('pinax.notes-preview')
    expect(() => registry.register({ ...plugin, viewFactories: {} })).toThrow(/no local factory/)
  })

  it('clears all registrations and ignores late events after generation reset', () => {
    const registry = new PanePluginRegistry(environment(1))
    registry.register(runtimePlugin('pinax.notes-preview'))
    registry.resetGeneration(environment(2))
    expect(registry.snapshot()).toEqual([])
    expect(registry.applyEvent('pinax.notes-preview', 1, {})).toBeUndefined()
  })

  it('requires monotonically increasing safe generations', () => {
    expect(() => new PanePluginRegistry(environment(-1))).toThrow(/non-negative safe integer/)
    const registry = new PanePluginRegistry(environment(2))
    expect(() => registry.resetGeneration(environment(1))).toThrow(/newer generation/)
  })

  it('notifies subscribers on register and dispose without leaking callbacks', () => {
    const registry = new PanePluginRegistry(environment())
    const listener = vi.fn()
    const unsubscribe = registry.subscribe(listener)
    const dispose = registry.register(runtimePlugin('pinax.notes-preview'))
    dispose()
    unsubscribe()
    registry.register(runtimePlugin('sonora.media-review', { permission: 'media.review' }))
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('keeps mutation and disposer delivery when a subscriber throws', () => {
    const onListenerError = vi.fn()
    const registry = new PanePluginRegistry({ ...environment(), onListenerError })
    const throwing = vi.fn(() => { throw new Error('subscriber failed') })
    const following = vi.fn()
    registry.subscribe(throwing)
    registry.subscribe(following)

    const dispose = registry.register(runtimePlugin('pinax.notes-preview'))
    expect(typeof dispose).toBe('function')
    expect(registry.snapshot()).toHaveLength(1)
    expect(following).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ definition: expect.objectContaining({ id: 'pinax.notes-preview' }) })]))

    dispose()
    expect(registry.snapshot()).toEqual([])
    expect(following).toHaveBeenLastCalledWith([])
    expect(onListenerError).toHaveBeenCalledTimes(3)
  })

  it('builds one typed handoff shape for every interaction entrypoint', () => {
    const options = {
      intent: 'handoff' as const,
      source: imageArtifact,
      targetOwner: 'pinax',
      targetPaneKind: 'pinax.note',
      context,
      idempotencyKey: 'handoff-0001',
    }
    expect(buildArtifactIntent(options)).toEqual(buildArtifactIntent({ ...options }))
  })
})
