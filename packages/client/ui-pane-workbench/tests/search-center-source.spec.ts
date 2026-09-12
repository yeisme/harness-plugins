import { describe, expect, it, vi } from 'vitest'
import { SEARCH_CENTER_FAMILIES, searchCenterFamily, searchCenterResourceKinds } from '../src/search-catalog.js'
import { legacySearchCenterResult, searchCenterRequestSupport, sourceSearchCenterResult, type SearchCenterSourceDescriptor, type SearchCenterSourceRequest } from '../src/search-source.js'
import { collectWorkspaceSearchCandidates } from '../src/search-identity.js'
import { PaneViewRegistry } from '../src/view-registry.js'
import { createSearchHandoffChannel, searchHandoffChannel, continueInSearchPane } from '../src/search-handoff.js'
import { PaneWorkbenchController } from '../src/controller.js'
import { DEFAULT_WORKSPACE_SEARCH_FILTERS } from '../src/search-group.js'
import { DSH_WORKSPACE_SEARCH_VIEW_KIND, DSH_WORKSPACE_SEARCH_RESOURCE_KEY } from '../src/core-pane.js'
import { createPaneWorkspace } from '../src/workspace.js'

const source: SearchCenterSourceDescriptor = {
  id: 'installed-skills', owner: 'dsh.skills', resourceKinds: ['skill'], coverage: 'catalog',
  scopes: ['session'], filters: ['availability'], sorts: ['relevance'], pagination: false, preview: false, open: true,
}
const request: SearchCenterSourceRequest = {
  query: 'test', scope: { kind: 'session', ref: 's1' }, kinds: ['skill'], filters: {}, sort: 'relevance',
}

describe('search center taxonomy and source boundaries', () => {
  it('keeps the destination context when an existing search pane cannot be activated', () => {
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    const controller = new PaneWorkbenchController({ registry })
    for (const kind of [DSH_WORKSPACE_SEARCH_VIEW_KIND, 'other']) registry.registerView({ descriptor: { kind, label: kind, componentKey: kind, role: 'utility', preferredRegion: 'right', retention: 'recreate', singleton: true }, component: () => null })
    controller.openView({ kind: DSH_WORKSPACE_SEARCH_VIEW_KIND, resourceKey: DSH_WORKSPACE_SEARCH_RESOURCE_KEY, role: 'utility', preferredRegion: 'right', retention: 'recreate', singleton: true, pinned: true })
    controller.openView({ kind: 'other', resourceKey: 'other', role: 'utility', preferredRegion: 'right', retention: 'recreate', singleton: true, pinned: true })
    expect(Object.values(controller.getSnapshot().views).some(view => view.kind === DSH_WORKSPACE_SEARCH_VIEW_KIND)).toBe(true)
    const original = { query: 'original', category: 'all' as const, filters: DEFAULT_WORKSPACE_SEARCH_FILTERS, controls: { sort: 'relevance' as const }, previewLimit: 5 }
    searchHandoffChannel(controller).send(original)
    vi.spyOn(controller, 'openView').mockImplementation(() => {})
    expect(continueInSearchPane(controller, registry, { ...original, query: 'replacement' })).toBe(false)
    expect(searchHandoffChannel(controller).getSnapshot()?.query).toBe('original')
    controller.dispose()
  })

  it('isolates pending handoffs by controller and only acknowledges the matching delivery', () => {
    const first = new PaneWorkbenchController({ registry: new PaneViewRegistry({ capabilities: new Set() }) })
    const second = new PaneWorkbenchController({ registry: new PaneViewRegistry({ capabilities: new Set() }) })
    const channel = searchHandoffChannel(first)
    const state = { query: 'private draft', category: 'all' as const, filters: { ...DEFAULT_WORKSPACE_SEARCH_FILTERS, projectRef: 'w1', allAccessibleProjects: false }, controls: { sort: 'name' as const }, previewLimit: 5 }
    channel.send(state)
    const previous = channel.getSnapshot()!
    state.filters.projectRef = 'w2'
    expect(channel.getSnapshot()!.filters.projectRef).toBe('w1')
    expect(searchHandoffChannel(second).getSnapshot()).toBeUndefined()
    channel.send({ ...state, query: 'newer query' })
    channel.acknowledge(previous)
    expect(channel.getSnapshot()!.query).toBe('newer query')
    channel.acknowledge(channel.getSnapshot()!)
    expect(channel.getSnapshot()).toBeUndefined()
    expect(createSearchHandoffChannel().getSnapshot()).toBeUndefined()
    first.dispose(); second.dispose()
  })

  it('waits for the matching receiver and expires or cancels undelivered context', async () => {
    vi.useFakeTimers()
    try {
      const channel = createSearchHandoffChannel()
      const state = { query: 'draft', category: 'all' as const, filters: DEFAULT_WORKSPACE_SEARCH_FILTERS, controls: { sort: 'relevance' as const }, previewLimit: 5 }
      const abort = new AbortController()
      const first = channel.request(state, abort.signal)
      const stale = channel.getSnapshot()!
      abort.abort()
      expect(await first).toBe(false)
      expect(channel.getSnapshot()).toBeUndefined()
      expect(channel.acknowledge(stale)).toBe(false)
      const second = channel.request(state, new AbortController().signal)
      const expired = channel.getSnapshot()!
      await vi.advanceTimersByTimeAsync(3000)
      expect(await second).toBe(false)
      expect(channel.acknowledge(expired)).toBe(false)
      const third = channel.request(state, new AbortController().signal)
      const replaced = channel.getSnapshot()!
      const fourth = channel.request({ ...state, query: 'latest' }, new AbortController().signal)
      expect(await third).toBe(false)
      expect(channel.acknowledge(replaced)).toBe(false)
      expect(channel.acknowledge(channel.getSnapshot()!)).toBe(true)
      expect(await fourth).toBe(true)
      expect(vi.getTimerCount()).toBe(0)
    } finally { vi.useRealTimers() }
  })

  it('keeps eight families and 35 distinct second-level resources without treating recent as a resource kind', () => {
    const kinds = searchCenterResourceKinds('all')
    expect(SEARCH_CENTER_FAMILIES).toHaveLength(8)
    expect(kinds).toHaveLength(35)
    expect(new Set(kinds).size).toBe(35)
    expect(kinds).not.toContain('recent')
    expect(searchCenterResourceKinds('tools')).toContain('mcp-resource')
    expect(searchCenterResourceKinds('skill')).toEqual(['skill'])
    expect(searchCenterFamily('skill')).toBe('tools')
  })

  it.each([
    [{ scope: { kind: 'workspace', ref: 'p1' } }, 'scope_unsupported'],
    [{ kinds: ['mcp-resource'] }, 'kind_unsupported'],
    [{ filters: { updatedAfter: '2026-01-01' } }, 'filter_unsupported'],
    [{ sort: 'updated' }, 'sort_unsupported'],
    [{ cursor: 'page2' }, 'pagination_unsupported'],
  ] as const)('does not weaken unsupported request %s', (extra, reason) => {
    expect(searchCenterRequestSupport(source, { ...request, ...extra })).toEqual({ supported: false, reason })
    expect(searchCenterRequestSupport(source, request)).toEqual({ supported: true })
  })

  it('keeps source, revision and reference identity independent from title and category', () => {
    const resource = { owner: source.owner, ref: 'skill:a:b', revision: 'v1', title: 'Review', kind: 'skill' as const }
    const first = sourceSearchCenterResult(source, resource)
    expect(sourceSearchCenterResult(source, { ...resource, title: '审阅' }).stableKey).toBe(first.stableKey)
    expect(sourceSearchCenterResult(source, { ...resource, revision: 'v2' }).stableKey).not.toBe(first.stableKey)
    expect(sourceSearchCenterResult({ ...source, id: 'other-installation' }, resource).stableKey).not.toBe(first.stableKey)
    expect(sourceSearchCenterResult(source, { ...resource, ref: 'skill:a', revision: 'b:v1' }).stableKey).not.toBe(first.stableKey)
    expect(() => sourceSearchCenterResult(source, { ...resource, ref: '' })).toThrow('search_resource_identity_missing')
    expect(() => sourceSearchCenterResult(source, { ...resource, owner: 'different' })).toThrow('search_resource_owner_mismatch')
  })

  it('adapts an unchanged legacy registration without requiring source metadata', () => {
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    registry.registerView({ descriptor: { kind: 'git', label: 'Git', componentKey: 'git', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true }, component: () => null })
    const candidate = collectWorkspaceSearchCandidates({ registrations: registry.snapshot(), state: createPaneWorkspace(), profile: { schema: 'pane.management.v1', groups: [], favoritePaneKinds: [], recentPaneKinds: [] } })[0]!
    const result = legacySearchCenterResult(candidate)
    expect(result).toMatchObject({ adapter: 'legacy', kind: 'pane', stableKey: candidate.stableKey })
    if (result.adapter === 'legacy') expect(result.candidate).toBe(candidate)
    expect(legacySearchCenterResult({ ...candidate, compatibility: true })).toMatchObject({ kind: 'compatibility-entry', stableKey: candidate.stableKey })
  })
})
