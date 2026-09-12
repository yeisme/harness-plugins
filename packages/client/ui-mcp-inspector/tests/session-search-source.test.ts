import { describe, expect, it, vi } from 'vitest'
import { createSessionToolsSearchSource } from '../src/client/session-search-source.ts'
import { sessionCatalogRemote } from '../src/client/session-catalog.ts'
import { SearchCenterSourceRegistry } from '../../ui-pane-workbench/src/search-source-registry.ts'
import type { ToolHubCatalogV1, ToolHubItemV1 } from '../src/client/wire.ts'

const request = (ref: string) => ({ query: '', scope: { kind: 'session' as const, ref }, kinds: ['skill', 'mcp-tool', 'native-tool'] as const,
  filters: {}, sort: 'relevance' as const, limit: 20 })

describe('Session Tools source boundary', () => {
  it('classifies an owner scope-resolution failure as disabled rather than a successful global fallback', async () => {
    const list = async () => ({ ok: false, error: { code: 'gateway/internal', details: { reason: 'session_scope_unavailable' } } })
    const ctx = { get: (key: string) => key === 'remote' ? { referenceTools: { list }, skills: { list } } : undefined }
    const source = createSessionToolsSearchSource({ listSessionIds: () => ['a'], read: ref => sessionCatalogRemote(ctx as never, ref, { requireResolvedScope: true }).list(), open: async () => true })
    expect(await source.source.search(request('a'), new AbortController().signal)).toEqual({ status: 'disabled', resources: [] })
    source.dispose()
  })
  it('does not treat an old catalog without resolved-scope proof as session search coverage', async () => {
    const ctx = { get: (key: string) => key === 'remote' ? {
      referenceTools: { list: async () => ({ ok: true, value: { tools: [{ name: 'read' }] } }) },
      skills: { list: async () => ({ ok: true, value: { skills: [], catalogComplete: true } }) },
    } : undefined }
    expect(await sessionCatalogRemote(ctx as never, 'a').list()).toMatchObject({ ok: true, complete: true })
    const source = createSessionToolsSearchSource({ listSessionIds: () => ['a'], read: ref => sessionCatalogRemote(ctx as never, ref, { requireResolvedScope: true }).list(), open: async () => true })
    expect(await source.source.search(request('a'), new AbortController().signal)).toEqual({ status: 'disabled', resources: [] })
    source.dispose()
  })
  it('retains an explicit permission denial from the original session namespaces', async () => {
    const list = vi.fn(async () => ({ ok: false, error: { status: 403, code: 'permission_denied' } }))
    const ctx = { get: (key: string) => key === 'remote' ? { referenceTools: { list }, skills: { list } } : undefined }
    const source = createSessionToolsSearchSource({ listSessionIds: () => ['a'], read: ref => sessionCatalogRemote(ctx as never, ref, { requireResolvedScope: true }).list(), open: async () => true })
    expect(await source.source.search(request('a'), new AbortController().signal)).toEqual({ status: 'denied', resources: [] })
    source.dispose()
  })
  it('consumes original session catalogs, keeps same-name identities separate and opens the original Session', async () => {
    let sessions = ['a', 'b']
    const tools = vi.fn(async (_input: { sessionId: string }) => ({ ok: true, value: { scopeResolved: true, tools: [
      { name: 'read', description: 'Shared tool' }, { name: 'mcp__repo__read', description: 'Shared MCP tool' },
    ] } }))
    const skills = vi.fn(async (_input: { sessionId: string }) => ({ ok: true, value: { scopeResolved: true, catalogComplete: true, skills: [{ name: 'review', description: 'Shared Skill', modelInvocable: true }] } }))
    const execute = vi.fn(), readBody = vi.fn()
    const ctx = { get: (key: string) => key === 'remote' ? { referenceTools: { list: tools, execute }, skills: { list: skills, get: readBody } } : undefined }
    const open = vi.fn(async (_ref: string, _item: ToolHubItemV1) => true)
    const source = createSessionToolsSearchSource({ listSessionIds: () => sessions, read: ref => sessionCatalogRemote(ctx as never, ref, { requireResolvedScope: true }).list(), open })
    const registry = new SearchCenterSourceRegistry()
    registry.register(source.source)
    const [a, b] = await Promise.all(['a', 'b'].map(ref => registry.query(source.source.descriptor.id, request(ref), new AbortController().signal)))
    expect(a!.status).toBe('ready'); expect(b!.status).toBe('ready')
    expect(a!.results.map(item => item.kind).sort()).toEqual(['mcp-tool', 'native-tool', 'skill'])
    expect(a!.results.every(item => item.adapter === 'source' && item.resource.sessionRef === 'a')).toBe(true)
    expect(b!.results.every(item => item.adapter === 'source' && item.resource.sessionRef === 'b')).toBe(true)
    expect(a!.results.some(item => b!.results.some(other => other.stableKey === item.stableKey))).toBe(false)
    expect(await registry.open(a!.results[0]!)).toEqual({ status: 'opened' })
    expect(open).toHaveBeenLastCalledWith('a', expect.anything())
    const resource = a!.results[0]!
    if (resource.adapter !== 'source') throw new Error('Expected source resource')
    expect(await source.source.open(resource.resource, { kind: 'session', ref: 'b' })).toEqual({ status: 'unavailable' })
    const count = tools.mock.calls.length
    expect(await registry.query(source.source.descriptor.id, { ...request('a'), scope: { kind: 'profile' } }, new AbortController().signal)).toMatchObject({ status: 'disabled' })
    sessions = ['b']; source.notify('a')
    expect(await registry.query(source.source.descriptor.id, request('a'), new AbortController().signal)).toMatchObject({ status: 'denied', results: [] })
    expect(tools).toHaveBeenCalledTimes(count)
    expect(execute).not.toHaveBeenCalled(); expect(readBody).not.toHaveBeenCalled()
    registry.dispose(); source.dispose()
  })

  it('rejects cross-session cursors and stale metadata despite an unchanged owner generation', async () => {
    let description = 'first snapshot'
    const read = async (): Promise<ToolHubCatalogV1> => ({ ok: true, specVersion: '1.0', complete: true, generation: 1,
      skillsAvailable: true, toolsAvailable: true, mcpInventoryAvailable: false, items: Array.from({ length: 3 }, (_, index) => ({
        id: `skill:review-${index}`, name: `review-${index}`, label: `Review ${index}`, description, family: 'skill', origin: 'skill', source: 'session.skills', availability: 'available', enabled: true, canToggle: false,
      })) })
    const open = vi.fn(async () => true)
    const source = createSessionToolsSearchSource({ listSessionIds: () => ['a', 'b'], read, open })
    const first = await source.source.search({ ...request('a'), limit: 1 }, new AbortController().signal)
    expect('nextCursor' in first && first.nextCursor).toBeTruthy()
    if (!('nextCursor' in first)) throw new Error('Expected next page')
    expect(await source.source.search({ ...request('b'), limit: 1, cursor: first.nextCursor }, new AbortController().signal)).toMatchObject({ status: 'error', resources: [] })
    const hit = first.resources[0]!
    expect(hit.revision).toMatch(/^catalog-sha256:/)
    description = 'changed snapshot'
    expect(await source.source.open(hit, { kind: 'session', ref: 'a' })).toEqual({ status: 'unavailable' })
    expect(open).not.toHaveBeenCalled()
    source.dispose()
  })

  it('invalidates changed owner metadata without adopting unverified observations as search data', async () => {
    const catalog: ToolHubCatalogV1 = { ok: true, specVersion: '1.0', complete: true, generation: 1,
      skillsAvailable: true, toolsAvailable: true, mcpInventoryAvailable: false, items: [{
        id: 'skill:review', name: 'review', label: 'Review', description: 'Strict catalog', family: 'skill', origin: 'skill', source: 'session.skills', availability: 'available', enabled: true, canToggle: false,
      }] }
    const read = vi.fn(async () => catalog), open = vi.fn(async () => true)
    const source = createSessionToolsSearchSource({ listSessionIds: () => ['a', 'b'], read, open })
    const registry = new SearchCenterSourceRegistry()
    registry.register(source.source)
    const first = await registry.query(source.source.descriptor.id, request('a'), new AbortController().signal)
    const changed = vi.fn(); source.source.subscribe(changed)
    source.observe('a', { ...catalog, items: [...catalog.items] })
    source.observe('b', { ...catalog, items: [] })
    expect(changed).not.toHaveBeenCalled()
    expect(await registry.open(first.results[0]!)).toEqual({ status: 'opened' })
    open.mockClear()
    source.observe('a', { ...catalog, items: [{ ...catalog.items[0]!, description: 'Unverified observation' }] })
    expect(changed).toHaveBeenCalledOnce()
    expect(await registry.open(first.results[0]!)).toEqual({ status: 'unavailable' })
    expect(open).not.toHaveBeenCalled()
    const next = await registry.query(source.source.descriptor.id, request('a'), new AbortController().signal)
    expect(next.results[0]).toMatchObject({ resource: { description: 'Strict catalog' } })
    source.dispose(); registry.dispose()
  })

  it('rejects an in-flight first catalog when a newer owner observation arrives', async () => {
    let finish!: (value: ToolHubCatalogV1) => void
    const source = createSessionToolsSearchSource({ listSessionIds: () => ['a'], read: () => new Promise(resolve => { finish = resolve }), open: async () => true })
    const pending = source.source.search(request('a'), new AbortController().signal)
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    const catalog: ToolHubCatalogV1 = { ok: true, specVersion: '1.0', complete: true, generation: 1, skillsAvailable: true, toolsAvailable: true, mcpInventoryAvailable: false, items: [] }
    source.observe('a', catalog)
    finish({ ...catalog, items: [{ id: 'skill:removed', name: 'removed', label: 'Removed Skill', family: 'skill', origin: 'skill', source: 'session.skills', availability: 'available', enabled: true, canToggle: false }] })
    expect(await pending).toMatchObject({ resources: [] })
    source.dispose()
  })

  it('withholds a late catalog after its Session is removed', async () => {
    let sessions = ['a'], finish!: (value: ToolHubCatalogV1) => void
    const source = createSessionToolsSearchSource({ listSessionIds: () => sessions, read: () => new Promise(resolve => { finish = resolve }), open: async () => true })
    const pending = source.source.search(request('a'), new AbortController().signal)
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    sessions = []
    finish({ ok: true, specVersion: '1.0', complete: true, generation: 1, skillsAvailable: true, toolsAvailable: true, mcpInventoryAvailable: false, items: [] })
    expect(await pending).toEqual({ status: 'denied', resources: [] })
    source.dispose()
  })
})
