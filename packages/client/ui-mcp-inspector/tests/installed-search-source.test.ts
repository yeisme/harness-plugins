import { describe, expect, it, vi } from 'vitest'
import { normalizeToolHubClientError } from '../src/client/remote.ts'
import { createInstalledToolsSearchSource } from '../src/client/installed-search-source.ts'
import type { ToolHubCatalogV1, ToolHubItemV1 } from '../src/client/wire.ts'

const skill = (index = 0, overrides: Partial<ToolHubItemV1> = {}): ToolHubItemV1 => ({ id: `skill:review${index}`, family: 'skill', origin: 'skill', name: `review${index}`, label: `review${index}`, description: '审阅 changes', source: 'user-dsh', availability: 'available', enabled: true, canToggle: true, ...overrides })
const catalog = (items: readonly ToolHubItemV1[] = [skill()]): ToolHubCatalogV1 => ({ ok: true, specVersion: '1.0', complete: true, generation: 1, skillsAvailable: true, toolsAvailable: true, mcpInventoryAvailable: true, items })
const request = { query: 'review', scope: { kind: 'profile' }, kinds: ['skill', 'native-tool'], filters: {}, sort: 'relevance', limit: 20 }

describe('installed Tools owner search adapter', () => {
  it('does not match an excluded private description and then hide only its displayed snippet', async () => {
    const binding = createInstalledToolsSearchSource({ read: async () => catalog([skill(0, { description: 'secret = fixture-only' })]), open: async () => true })
    expect(await binding.source.search({ ...request, query: 'fixture-only' }, new AbortController().signal)).toMatchObject({ resources: [] })
    binding.dispose()
  })
  it('notifies consumers when an issued target has disappeared before opening', async () => {
    let current = catalog()
    const open = vi.fn(async () => true)
    const binding = createInstalledToolsSearchSource({ read: async () => current, open })
    const changed = vi.fn()
    binding.source.subscribe(changed)
    const page = await binding.source.search(request, new AbortController().signal)
    current = catalog([])
    expect(await binding.source.open(page.resources[0]!, { kind: 'profile' })).toEqual({ status: 'unavailable' })
    expect(changed).toHaveBeenCalledTimes(1)
    expect(open).not.toHaveBeenCalled()
  })

  it('invalidates once on denied opening and does not loop on subsequent denied reads', async () => {
    let allowed = true
    const binding = createInstalledToolsSearchSource({ read: async () => {
      if (!allowed) throw normalizeToolHubClientError({ status: 403 })
      return catalog(Array.from({ length: 21 }, (_, index) => skill(index)))
    }, open: vi.fn(async () => true) })
    const changed = vi.fn()
    binding.source.subscribe(changed)
    const page = await binding.source.search(request, new AbortController().signal)
    const cursor = 'nextCursor' in page ? page.nextCursor : undefined
    expect(cursor).toBeDefined()
    allowed = false
    expect(await binding.source.open(page.resources[0]!, { kind: 'profile' })).toEqual({ status: 'denied' })
    expect(changed).toHaveBeenCalledTimes(1)
    expect((await binding.source.search(request, new AbortController().signal)).status).toBe('denied')
    expect(changed).toHaveBeenCalledTimes(1)
    allowed = true
    expect((await binding.source.search({ ...request, cursor }, new AbortController().signal)).status).toBe('error')
  })

  it('retains available native metadata when the Skills catalog is unavailable', async () => {
    const native = skill(0, { id: 'tool:read', family: 'native', origin: 'native', name: 'read', label: 'read' })
    const binding = createInstalledToolsSearchSource({ read: async () => ({ ...catalog([native]), skillsAvailable: false, complete: false }), open: async () => true })
    expect(await binding.source.search({ ...request, query: 'read' }, new AbortController().signal)).toMatchObject({ status: 'partial', resources: [{ kind: 'native-tool' }] })
    expect(await binding.source.search({ ...request, kinds: ['skill'] }, new AbortController().signal)).toMatchObject({ status: 'disabled', resources: [] })
  })

  it('distinguishes permission loss from an offline owner without expanding the legacy error-code enum', async () => {
    const error = normalizeToolHubClientError({ status: 403, message: 'Forbidden' })
    expect(error.code).toBe('unknown')
    expect(error.accessDenied).toBe(true)
    const binding = createInstalledToolsSearchSource({ read: async () => { throw error }, open: async () => true })
    expect(await binding.source.search(request, new AbortController().signal)).toEqual({ status: 'denied', resources: [] })
  })

  it('separates disabled tool status from the ability to read its details and does not call enablement', async () => {
    const item = skill(0, { availability: 'disabled', enabled: false })
    const open = vi.fn(async () => true)
    const binding = createInstalledToolsSearchSource({ read: async () => catalog([item]), open })
    const page = await binding.source.search(request, new AbortController().signal)
    expect(page).toMatchObject({ status: 'ready', resources: [{ status: 'disabled', availability: 'available', revision: 'catalog:1', sourceLabel: 'user-dsh' }] })
    expect(open).not.toHaveBeenCalled()
    await expect(binding.source.open(page.resources[0]!, { kind: 'profile' })).resolves.toEqual({ status: 'opened' })
    expect(open).toHaveBeenCalledWith(item)
  })

  it('does not turn MCP server summaries into individual MCP tools', async () => {
    const binding = createInstalledToolsSearchSource({ read: async () => catalog([skill(), skill(1, { id: 'mcp:server', family: 'mcp', origin: 'mcp', toolCount: 12 })]), open: async () => true })
    expect(binding.source.descriptor.resourceKinds).toEqual(['skill', 'native-tool'])
    const page = await binding.source.search(request, new AbortController().signal)
    expect(page.resources).toHaveLength(1)
    expect(page.resources[0]!.kind).toBe('skill')
  })

  it('searches Chinese, normalized English and opaque IDs in the owner metadata', async () => {
    const binding = createInstalledToolsSearchSource({ read: async () => catalog(), open: async () => true })
    for (const query of ['审阅', 'ＲＥＶＩＥＷ', 'skill:review0']) {
      expect((await binding.source.search({ ...request, query }, new AbortController().signal)).resources).toHaveLength(1)
    }
  })

  it('filters the full catalog before paging and rejects a cursor after the source changes', async () => {
    let current = catalog(Array.from({ length: 25 }, (_, index) => skill(index)))
    const binding = createInstalledToolsSearchSource({ read: async () => current, open: async () => true })
    const first = await binding.source.search(request, new AbortController().signal)
    expect(first.resources).toHaveLength(20)
    expect('total' in first && first.total).toBe(25)
    const cursor = 'nextCursor' in first ? first.nextCursor : undefined
    expect(cursor).toBeDefined()
    const second = await binding.source.search({ ...request, cursor }, new AbortController().signal)
    expect(second.resources).toHaveLength(5)
    current = catalog([...current.items, skill(26)])
    expect(await binding.source.search({ ...request, cursor }, new AbortController().signal)).toMatchObject({ status: 'error', resources: [] })
  })

  it('keeps incomplete metadata partial and refuses to claim global sorting or status filtering', async () => {
    const binding = createInstalledToolsSearchSource({ read: async () => ({ ...catalog(), complete: false }), open: async () => true })
    const page = await binding.source.search(request, new AbortController().signal)
    expect(page.status).toBe('partial')
    expect('total' in page).toBe(false)
    expect(await binding.source.search({ ...request, sort: 'name' }, new AbortController().signal)).toMatchObject({ status: 'disabled' })
    expect(await binding.source.search({ ...request, filters: { status: 'disabled' } }, new AbortController().signal)).toMatchObject({ status: 'disabled' })
  })

  it('distinguishes same-name origins without guessing an ambiguous original detail target', async () => {
    const binding = createInstalledToolsSearchSource({ read: async () => catalog([skill(0, { source: 'project' }), skill(0, { source: 'user' })]), open: vi.fn(async () => true) })
    const page = await binding.source.search(request, new AbortController().signal)
    expect(new Set(page.resources.map(item => item.ref)).size).toBe(2)
    expect(page.resources.every(item => item.availability === 'unavailable')).toBe(true)
    expect(await binding.source.open(page.resources[0]!, { kind: 'profile' })).toEqual({ status: 'unavailable' })
  })

  it('does not widen project or session queries into the installed profile catalog', async () => {
    const read = vi.fn(async () => catalog())
    const binding = createInstalledToolsSearchSource({ read, open: async () => true })
    for (const kind of ['workspace', 'session']) expect(await binding.source.search({ ...request, scope: { kind, ref: 'one' } }, new AbortController().signal)).toMatchObject({ status: 'disabled' })
    expect(read).not.toHaveBeenCalled()
  })

  it('shares uncancellable catalog reads between changing queries without starting extra owner requests', async () => {
    let resolve!: (value: ToolHubCatalogV1) => void
    const read = vi.fn(() => new Promise<ToolHubCatalogV1>(done => { resolve = done }))
    const binding = createInstalledToolsSearchSource({ read, open: async () => true })
    const abort = new AbortController()
    const first = binding.source.search(request, abort.signal)
    await Promise.resolve()
    abort.abort()
    const second = binding.source.search({ ...request, query: '审阅' }, new AbortController().signal)
    expect(read).toHaveBeenCalledTimes(1)
    resolve(catalog())
    expect((await first).resources).toEqual([])
    expect((await second).resources).toHaveLength(1)
    expect(read).toHaveBeenCalledTimes(1)
  })
})
