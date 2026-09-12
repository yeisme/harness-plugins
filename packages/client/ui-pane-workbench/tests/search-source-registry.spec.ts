import { describe, expect, it, vi } from 'vitest'
import { SearchCenterSourceRegistry, searchSourcesFor, type SearchCenterOwnerPage, type SearchCenterOwnerSource } from '../src/search-source-registry.js'
import type { SearchCenterResource, SearchCenterSourceRequest } from '../src/search-source.js'

const resource = (overrides: Partial<SearchCenterResource> = {}): SearchCenterResource => ({ owner: 'dsh.tools', ref: 'skill:review', revision: 'v1', kind: 'skill', title: 'Review', sessionRef: 's1', ...overrides })
const request: SearchCenterSourceRequest = { query: 'review', scope: { kind: 'session', ref: 's1' }, kinds: ['skill'], filters: {}, sort: 'relevance' }
const signal = () => new AbortController().signal
function source(search: SearchCenterOwnerSource['search'] = async () => ({ status: 'ready', resources: [resource()] })): SearchCenterOwnerSource {
  return { descriptor: { id: 'tools.session', owner: 'dsh.tools', resourceKinds: ['skill', 'mcp-tool'], coverage: 'catalog', scopes: ['session'], filters: [], sorts: ['relevance'], pagination: true, preview: false, open: true }, search, open: vi.fn(async () => ({ status: 'opened' })) }
}

describe('owner search source registration and read contracts', () => {
  it('settles removed or aborted reads even if the owner never completes', async () => {
    for (const mode of ['remove', 'abort', 'dispose'] as const) {
      const registry = new SearchCenterSourceRegistry()
      let ownerSignal!: AbortSignal
      const remove = registry.register(source((_request, signal) => { ownerSignal = signal; return new Promise(() => {}) }))
      const abort = new AbortController()
      const pending = registry.query('tools.session', request, abort.signal)
      if (mode === 'remove') remove()
      else if (mode === 'dispose') registry.dispose()
      else abort.abort()
      expect(ownerSignal.aborted).toBe(true)
      expect(await pending).toMatchObject({ status: 'disabled', results: [] })
    }
  })

  it('rolls back a subscription that publishes and then throws', () => {
    const registry = new SearchCenterSourceRegistry()
    expect(() => registry.register({ ...source(), subscribe: listener => { listener(); throw new Error('failed') } })).toThrow('search_source_subscription_failed')
    expect(registry.getSnapshot()).toEqual([])
  })

  it('rejects unsupported scope or filter before contacting the owner', async () => {
    const registry = new SearchCenterSourceRegistry()
    const search = vi.fn(async () => ({ status: 'ready' as const, resources: [] }))
    registry.register(source(search))
    expect(await registry.query('tools.session', { ...request, scope: { kind: 'workspace', ref: 'w1' } }, signal())).toMatchObject({ status: 'disabled', reason: 'scope_unsupported', results: [] })
    expect(await registry.query('tools.session', { ...request, filters: { status: 'running' } }, signal())).toMatchObject({ status: 'disabled', reason: 'filter_unsupported' })
    expect(search).not.toHaveBeenCalled()
  })

  it('retains partial and unknown totals, collapses canonical duplicates, and distinguishes versions', async () => {
    const registry = new SearchCenterSourceRegistry()
    registry.register(source(async () => ({ status: 'partial', resources: [resource(), resource({ kind: 'mcp-tool' }), resource({ revision: 'v2' })], nextCursor: 'cursor:next' })))
    const page = await registry.query('tools.session', { ...request, kinds: ['skill', 'mcp-tool'] }, signal())
    expect(page).toMatchObject({ status: 'partial', nextCursor: 'cursor:next' })
    expect(page.total).toBeUndefined()
    expect(page.results).toHaveLength(2)
    expect(page.results.every(result => result.adapter === 'source')).toBe(true)
    expect(new Set(page.results.map(result => result.stableKey)).size).toBe(2)
  })

  it.each(['denied', 'offline', 'error'] as const)('removes samples, counts and cursors from a %s page', async status => {
    const registry = new SearchCenterSourceRegistry()
    registry.register(source(async () => ({ status, resources: [resource()], nextCursor: 'do-not-expose', total: 24 })))
    const page = await registry.query('tools.session', request, signal())
    expect(page).toEqual({ status, reason: `source_${status}`, results: [] })
  })

  it.each([{ owner: 'other.owner' }, { sessionRef: 's2' }])('rejects resources outside the owner or requested session (%j)', async overrides => {
    const registry = new SearchCenterSourceRegistry()
    registry.register(source(async () => ({ status: 'ready', resources: [resource(overrides)] })))
    expect(await registry.query('tools.session', request, signal())).toMatchObject({ status: 'error', reason: 'source_resource_invalid', results: [] })
  })

  it('discards an uncancellable page after source removal or abort', async () => {
    for (const abortRequest of [false, true]) {
      const registry = new SearchCenterSourceRegistry()
      let resolve!: (page: SearchCenterOwnerPage) => void
      const remove = registry.register(source(() => new Promise(done => { resolve = done })))
      const abort = new AbortController()
      const pending = registry.query('tools.session', request, abort.signal)
      if (abortRequest) abort.abort(); else remove()
      resolve({ status: 'ready', resources: [resource()] })
      expect(await pending).toMatchObject({ status: 'disabled', results: [], reason: abortRequest ? 'query_aborted' : 'source_removed' })
      registry.dispose()
    }
  })

  it('invalidates in-flight reads and previously returned open targets on a source change', async () => {
    const registry = new SearchCenterSourceRegistry()
    let changed!: () => void
    const owner = source()
    registry.register({ ...owner, subscribe: listener => { changed = listener; return () => {} } })
    const page = await registry.query('tools.session', request, signal())
    changed()
    expect(await registry.open(page.results[0]!)).toEqual({ status: 'unavailable' })
    expect(owner.open).not.toHaveBeenCalled()
    let resolve!: (page: SearchCenterOwnerPage) => void
    owner.search = () => new Promise(done => { resolve = done })
    registry.dispose()
    const current = new SearchCenterSourceRegistry()
    current.register({ ...owner, subscribe: listener => { changed = listener; return () => {} } })
    const pending = current.query('tools.session', request, signal())
    changed(); resolve({ status: 'ready', resources: [resource()] })
    expect(await pending).toEqual({ status: 'stale', results: [], reason: 'source_changed' })
  })

  it('opens only its own issued result with the captured scope and rejects forged or replaced targets', async () => {
    const registry = new SearchCenterSourceRegistry()
    const first = source()
    const remove = registry.register(first)
    const page = await registry.query('tools.session', request, signal())
    expect(await registry.open({ ...page.results[0]! })).toEqual({ status: 'unavailable' })
    expect(await registry.open(page.results[0]!)).toEqual({ status: 'opened' })
    expect(first.open).toHaveBeenCalledWith(resource(), { kind: 'session', ref: 's1' })
    remove()
    const next = source()
    registry.register(next)
    remove()
    expect(registry.getSnapshot()).toHaveLength(1)
    expect(await registry.open(page.results[0]!)).toEqual({ status: 'unavailable' })
    expect(next.open).not.toHaveBeenCalled()
  })

  it('copies only declared display fields and isolates registries by controller', async () => {
    const registry = searchSourcesFor({})
    const descriptor = { ...source().descriptor, extraInternalField: 'not-for-ui' }
    registry.register({ ...source(async () => ({ status: 'ready', resources: [{ ...resource(), extraInternalField: 'not-for-ui' }] })), descriptor })
    expect(registry.getSnapshot()[0]).not.toHaveProperty('extraInternalField')
    const page = await registry.query('tools.session', request, signal())
    expect(page.results[0]!.adapter === 'source' && page.results[0]!.resource).not.toHaveProperty('extraInternalField')
    expect(searchSourcesFor({}).getSnapshot()).toEqual([])
    expect(Object.isFrozen(registry.getSnapshot()[0]!.resourceKinds)).toBe(true)
  })

  it('releases all subscriptions and prevents a disposed registry from being reused', () => {
    const registry = new SearchCenterSourceRegistry()
    const off = vi.fn()
    registry.register({ ...source(), subscribe: () => off })
    registry.dispose(); registry.dispose()
    expect(off).toHaveBeenCalledTimes(1)
    expect(registry.getSnapshot()).toEqual([])
    expect(() => registry.register(source())).toThrow('search_registry_disposed')
  })

  it('does not advertise a reader without a connected preview contract', () => {
    const registry = new SearchCenterSourceRegistry()
    const owner = source()
    expect(() => registry.register({ ...owner, descriptor: { ...owner.descriptor, preview: true } })).toThrow('search_source_contract_mismatch')
  })
})
