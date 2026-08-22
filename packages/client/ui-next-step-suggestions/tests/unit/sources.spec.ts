import { describe, expect, it } from 'vitest'
import { SuggestionSourceRegistry } from '../../src/client/sources.ts'
import type { SuggestionSource } from '../../src/client/types.ts'

const source: SuggestionSource = {
  id: 'demo',
  getSuggestions: () => [],
}

describe('SuggestionSourceRegistry', () => {
  it('registers and lists sources in order', () => {
    const registry = new SuggestionSourceRegistry()
    const dispose = registry.registerSource(source)
    expect(registry.list()).toEqual([source])
    dispose()
    expect(registry.list()).toEqual([])
  })
})
