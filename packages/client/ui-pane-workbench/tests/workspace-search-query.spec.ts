import { describe, expect, it, vi } from 'vitest'
import { serializeWorkspaceSearchCacheKey, serializeWorkspaceSearchCacheKeyV2, WorkspaceSearchResultCache } from '../src/search-cache.js'
import {
  probeWorkspaceSearchHistoryAdapter,
  WorkspaceSearchCoordinator,
  type WorkspaceSearchClockV1,
  type WorkspaceSearchHistoryAdapterV1,
} from '../src/search-query.js'
import { DEFAULT_WORKSPACE_SEARCH_FILTERS } from '../src/search-group.js'
import { workspaceSearchStableKey, type WorkspaceSearchCandidateV1 } from '../src/search-identity.js'
import { SearchCenterSourceRegistry, type SearchCenterOwnerSource } from '../src/search-source-registry.js'
import { WorkspaceSearchPreferenceStore } from '../src/search-preferences.js'

function pane(title: string): WorkspaceSearchCandidateV1 {
  return {
    kind: 'pane',
    stableKey: workspaceSearchStableKey('pane', 'git', 'git.status', 'view:git.status'),
    title,
    semanticIcon: 'git',
    ownerRef: 'git',
    openTarget: { type: 'pane', owner: 'git', viewKind: 'git.status', resourceKey: 'view:git.status' },
    availability: 'available',
    aliases: [title],
    keywords: ['git.status'],
    opened: false,
    recent: false,
    frequent: true,
    compatibility: false,
    sideEffect: false,
    openOnly: false,
    mergedCommandIds: [],
  }
}

function session(title: string, ref: string): WorkspaceSearchCandidateV1 {
  return {
    kind: 'session',
    stableKey: workspaceSearchStableKey('session', 'dsh.session', ref),
    title,
    semanticIcon: 'message',
    ownerRef: 'dsh.session',
    openTarget: { type: 'session', owner: 'dsh.session', sessionRef: ref },
    availability: 'available',
    aliases: [ref],
    keywords: [],
    opened: false,
    recent: false,
    frequent: false,
    compatibility: false,
    sideEffect: false,
    openOnly: false,
    mergedCommandIds: [],
  }
}

function fakeClock(): WorkspaceSearchClockV1 & { readonly advance: (ms: number) => void; nowMs: number } {
  let nowMs = 0
  const timers: Array<{ at: number; callback: () => void; id: number }> = []
  let nextId = 1
  return {
    get nowMs() { return nowMs },
    now: () => nowMs,
    setTimeout: (callback, ms) => {
      const id = nextId++
      timers.push({ at: nowMs + ms, callback, id })
      return id
    },
    clearTimeout: handle => {
      const index = timers.findIndex(timer => timer.id === handle)
      if (index >= 0) timers.splice(index, 1)
    },
    advance: (ms: number) => {
      nowMs += ms
      const due = timers.filter(timer => timer.at <= nowMs).sort((left, right) => left.at - right.at)
      for (const timer of due) {
        const index = timers.indexOf(timer)
        if (index >= 0) timers.splice(index, 1)
        timer.callback()
      }
    },
  }
}

const filters = DEFAULT_WORKSPACE_SEARCH_FILTERS

describe('workspace search history probe', () => {
  it('records available, unavailable, and contract_mismatch without treating design completion as runtime', () => {
    expect(probeWorkspaceSearchHistoryAdapter({})).toMatchObject({ capability: 'unavailable' })
    expect(probeWorkspaceSearchHistoryAdapter({ search: () => undefined, capability: 'pane.conversation-search.v1' })).toMatchObject({ capability: 'available' })
    expect(probeWorkspaceSearchHistoryAdapter({ search: 'nope' })).toMatchObject({ capability: 'contract_mismatch' })
  })
})

describe('workspace search coordinator', () => {
  it('holds a deferred handoff selection instead of substituting an immediately available result', async () => {
    const clock = fakeClock()
    let resolve!: (page: { status: 'ready'; items: WorkspaceSearchCandidateV1[] }) => void
    const target = session('Git discussion', 's1')
    const coordinator = new WorkspaceSearchCoordinator(() => [pane('Git')], { capability: 'available', search: () => new Promise(done => { resolve = done }) }, clock)
    const request = { query: 'git', composing: false, filters, locale: 'en', profileRef: 'p1' }
    coordinator.setRequest(request)
    coordinator.select(target.stableKey, { deferUntilVisible: true })
    expect(coordinator.getSnapshot().selectedKey).toBeUndefined()
    expect(coordinator.getSnapshot().notice).toBe('selectionUnavailable')
    clock.advance(200)
    resolve({ status: 'ready', items: [target] })
    await Promise.resolve()
    expect(coordinator.getSnapshot().selectedKey).toBe(target.stableKey)
    coordinator.select('missing', { deferUntilVisible: true })
    coordinator.setRequest({ ...request, query: 'Git ' })
    expect(coordinator.getSnapshot().selectedKey).toBe(pane('Git').stableKey)
    coordinator.dispose()
  })

  it('refreshes a changed source without reusing its old cached page or accepting an uncancellable response', async () => {
    const clock = fakeClock()
    let resolveOld!: (page: { status: 'ready'; items: WorkspaceSearchCandidateV1[] }) => void
    const search = vi.fn()
      .mockResolvedValueOnce({ status: 'ready', items: [session('Private old title', 's1')] })
      .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
      .mockResolvedValueOnce({ status: 'ready', items: [session('Current title', 's2')] })
    const coordinator = new WorkspaceSearchCoordinator(() => [], { capability: 'available', search }, clock)
    const request = { query: 'title', composing: false, filters, locale: 'en', profileRef: 'p1' }
    coordinator.setRequest(request); clock.advance(200); await Promise.resolve()
    expect(coordinator.getSnapshot().history.loadedCount).toBe(1)
    coordinator.retry()
    coordinator.refreshSource()
    expect(coordinator.getSnapshot().local.visibleItems).toEqual([])
    resolveOld({ status: 'ready', items: [session('Revoked private title', 's1')] })
    await Promise.resolve()
    expect(coordinator.getSnapshot().local.visibleItems).toEqual([])
    clock.advance(200); await Promise.resolve()
    expect(coordinator.getSnapshot().local.visibleItems.map(item => item.title)).toEqual(['Current title'])
    coordinator.dispose()
    coordinator.refreshSource()
    expect(search).toHaveBeenCalledTimes(3)
  })

  it.each([false, true])('requires current authorization proof to retain offline summaries (%s)', async authorized => {
    const clock = fakeClock()
    const search = vi.fn()
      .mockResolvedValueOnce({ status: 'ready', items: [session('Private title', 's1')], nextCursor: 'next' })
      .mockResolvedValueOnce({ status: 'offline', items: [] })
    const coordinator = new WorkspaceSearchCoordinator(() => [], {
      capability: 'available', permissionGeneration: 'g1', search,
      isAuthorizationCurrent: generation => generation === 'g1' && authorized,
    }, clock)
    coordinator.setRequest({ query: 'title', composing: false, filters, locale: 'en', profileRef: 'p1' })
    clock.advance(200); await Promise.resolve()
    coordinator.retry(); await Promise.resolve()
    const snapshot = coordinator.getSnapshot()
    expect(snapshot.history.status).toBe(authorized ? 'stale' : 'error')
    expect(snapshot.history.loadedCount).toBe(authorized ? 1 : 0)
    expect(snapshot.local.visibleItems).toHaveLength(authorized ? 1 : 0)
    expect(snapshot.history.nextCursor).toBeUndefined()
    coordinator.dispose()
  })

  it('does not normalize owner queries or confuse empty discovery with source browsing', async () => {
    const clock = fakeClock()
    const search = vi.fn(async () => ({ status: 'ready' as const, items: [] }))
    const coordinator = new WorkspaceSearchCoordinator(() => [], { capability: 'available', search }, clock)
    const request = { query: 'ID', composing: false, filters, locale: 'en', profileRef: 'p1' }
    coordinator.setRequest(request); clock.advance(200); await Promise.resolve()
    coordinator.setRequest({ ...request, query: 'id' }); clock.advance(200); await Promise.resolve()
    expect(search.mock.calls).toHaveLength(2)
    coordinator.setRequest({ ...request, query: '' }); clock.advance(200)
    expect(search.mock.calls).toHaveLength(2)
    coordinator.setRequest({ ...request, query: '', browse: true }); clock.advance(200); await Promise.resolve()
    expect(search.mock.calls).toHaveLength(3)
    coordinator.dispose()
  })

  it('turns a synchronous owner exception into a recoverable source error', async () => {
    const clock = fakeClock()
    const coordinator = new WorkspaceSearchCoordinator(() => [], { capability: 'available', search: () => { throw new Error('owner unavailable') } }, clock)
    coordinator.setRequest({ query: 'title', composing: false, filters, locale: 'en', profileRef: 'p1' })
    expect(() => clock.advance(200)).not.toThrow()
    await Promise.resolve(); await Promise.resolve()
    expect(coordinator.getSnapshot().history).toMatchObject({ status: 'error', reason: 'search_failed', loadedCount: 0 })
    coordinator.dispose()
  })

  it('requires an adapter to negotiate advanced controls instead of filtering its first page', () => {
    const clock = fakeClock()
    const search = vi.fn(async () => ({ items: [session('Planning', 's1')], status: 'ready' as const }))
    const coordinator = new WorkspaceSearchCoordinator(() => [pane('Git')], { capability: 'available', search }, clock)
    coordinator.setRequest({ query: 'git', composing: false, filters, locale: 'en', profileRef: 'p1', controls: { sort: 'name' } })
    clock.advance(500)
    coordinator.retry()
    expect(search).not.toHaveBeenCalled()
    expect(coordinator.getSnapshot().history).toMatchObject({ status: 'unknown', reason: 'source_controls_unsupported' })
    expect(coordinator.getSnapshot().local.visibleItems[0]?.title).toBe('Git')
    coordinator.dispose()
  })

  it('preserves the local query after invalidation and re-queries an explicitly refreshed request', () => {
    const clock = fakeClock()
    const search = vi.fn(() => new Promise<never>(() => {}))
    const coordinator = new WorkspaceSearchCoordinator(() => [pane('Git')], { capability: 'available', search }, clock)
    const request = { query: 'no-match', composing: false, filters, locale: 'en', profileRef: 'p1' }
    coordinator.setRequest(request)
    clock.advance(200)
    coordinator.invalidate('permission')
    expect(coordinator.getSnapshot().local.query).toBe('no-match')
    expect(coordinator.getSnapshot().local.visibleItems).toEqual([])
    coordinator.setRequest(request)
    clock.advance(200)
    expect(search).toHaveBeenCalledTimes(2)
    coordinator.dispose()
  })

  it.each(['permission', 'profile', 'locale', 'close'] as const)('does not accept an uncancellable response after %s invalidation', async reason => {
    const clock = fakeClock()
    let resolve!: (page: { items: WorkspaceSearchCandidateV1[]; status: 'ready' }) => void
    const coordinator = new WorkspaceSearchCoordinator(() => [], {
      capability: 'available',
      search: () => new Promise(done => { resolve = done }),
    }, clock)
    coordinator.setRequest({ query: 'private', composing: false, filters, locale: 'en', profileRef: 'p1' })
    clock.advance(200)
    coordinator.invalidate(reason)
    resolve({ items: [session('Private result', 's1')], status: 'ready' })
    await Promise.resolve()
    expect(coordinator.getSnapshot().local.visibleItems).toEqual([])
    expect(coordinator.getSnapshot().history.loadedCount).toBe(0)
    coordinator.dispose()
  })

  it('settles a timeout even when the owner never resolves and allows explicit retry', async () => {
    const clock = fakeClock()
    const search = vi.fn(() => new Promise<never>(() => {}))
    const coordinator = new WorkspaceSearchCoordinator(() => [pane('Git')], { capability: 'available', search }, clock)
    coordinator.setRequest({ query: 'git', composing: false, filters, locale: 'en', profileRef: 'p1' })
    clock.advance(200)
    clock.advance(30_000)
    expect(coordinator.getSnapshot().history).toMatchObject({ status: 'error', reason: 'search_timeout', updating: false })
    expect(coordinator.getSnapshot().local.visibleItems[0]?.title).toBe('Git')
    coordinator.retry()
    expect(search).toHaveBeenCalledTimes(2)
    coordinator.dispose()
    coordinator.retry()
    expect(search).toHaveBeenCalledTimes(2)
  })

  it('does not start duplicate load-more requests for the same cursor', async () => {
    const clock = fakeClock()
    const search = vi.fn()
      .mockResolvedValueOnce({ items: [session('Planning 1', 's1')], status: 'ready', nextCursor: 'p2' })
      .mockImplementation(() => new Promise(() => {}))
    const coordinator = new WorkspaceSearchCoordinator(() => [], { capability: 'available', search }, clock)
    coordinator.setRequest({ query: 'planning', composing: false, filters, locale: 'en', profileRef: 'p1' })
    clock.advance(200)
    await Promise.resolve()
    coordinator.loadMore()
    coordinator.loadMore()
    expect(search).toHaveBeenCalledTimes(2)
    coordinator.dispose()
  })

  it('keeps local results while a delayed generation cannot overwrite a newer query', async () => {
    const clock = fakeClock()
    let resolveFirst: ((value: { items: readonly WorkspaceSearchCandidateV1[]; status: 'ready' }) => void) | undefined
    const adapter: WorkspaceSearchHistoryAdapterV1 = {
      capability: 'available',
      permissionGeneration: 'gen-1',
      search: (request, signal) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')))
        if (request.query === 'alpha') {
          resolveFirst = resolve
          return
        }
        resolve({ items: [session('Beta', 'session:beta')], status: 'ready' })
      }),
    }
    const coordinator = new WorkspaceSearchCoordinator(() => [pane('Git')], adapter, clock)
    coordinator.setRequest({ query: 'alpha', composing: false, filters, locale: 'en', profileRef: 'profile:a', projectRef: 'workspace:a' })
    clock.advance(200)
    coordinator.setRequest({ query: 'beta', composing: false, filters, locale: 'en', profileRef: 'profile:a', projectRef: 'workspace:a' })
    clock.advance(200)
    resolveFirst?.({ items: [session('Alpha', 'session:alpha')], status: 'ready' })
    await Promise.resolve()
    const snapshot = coordinator.getSnapshot()
    expect(snapshot.local.visibleItems.some(item => item.title === 'Alpha')).toBe(false)
    expect(snapshot.local.visibleItems.some(item => item.title === 'Beta')).toBe(true)
    expect(snapshot.generation).toBeGreaterThan(1)
  })

  it('does not send remote queries during IME composition', () => {
    const clock = fakeClock()
    const search = vi.fn(async () => ({ items: [], status: 'ready' as const }))
    const adapter: WorkspaceSearchHistoryAdapterV1 = { capability: 'available', search }
    const coordinator = new WorkspaceSearchCoordinator(() => [pane('Git')], adapter, clock)
    coordinator.setRequest({ query: '中', composing: true, filters, locale: 'zh', profileRef: 'profile:a' })
    clock.advance(500)
    expect(search).not.toHaveBeenCalled()
  })

  it('discards a late page after filters change', async () => {
    const clock = fakeClock()
    let resolvePage: ((value: { items: readonly WorkspaceSearchCandidateV1[]; status: 'ready'; nextCursor?: string }) => void) | undefined
    const adapter: WorkspaceSearchHistoryAdapterV1 = {
      capability: 'available',
      permissionGeneration: 'gen-1',
      search: (_request, signal) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')))
        resolvePage = resolve
      }),
    }
    const coordinator = new WorkspaceSearchCoordinator(() => [pane('Git')], adapter, clock)
    coordinator.setRequest({ query: 'git', composing: false, filters, locale: 'en', profileRef: 'profile:a' })
    clock.advance(200)
    coordinator.setRequest({
      query: 'git',
      composing: false,
      filters: { ...filters, openedOnly: true },
      locale: 'en',
      profileRef: 'profile:a',
    })
    clock.advance(200)
    resolvePage?.({ items: [session('Stale page', 'session:stale')], status: 'ready', nextCursor: 'cursor-1' })
    await Promise.resolve()
    expect(coordinator.getSnapshot().local.visibleItems.some(item => item.title === 'Stale page')).toBe(false)
  })
})

describe('workspace search cache', () => {
  it('keeps delimiter-bearing fields and an actual open-cycle generation distinct', () => {
    const base = { profileRef: 'p', projectScope: 'w', query: 'q', category: 'all', filters: '', sort: 'stable', locale: 'en', cursor: '' }
    expect(serializeWorkspaceSearchCacheKeyV2({ ...base, projectScope: 'w\u001fq' })).not.toBe(serializeWorkspaceSearchCacheKeyV2({ ...base, query: 'q\u001fq' }))
    expect(serializeWorkspaceSearchCacheKey(base)).toBe(['p', 'open-cycle', 'w', 'q', 'all', '', 'stable', 'en', ''].join('\u001f'))
    expect(serializeWorkspaceSearchCacheKeyV2(base)).not.toBe(serializeWorkspaceSearchCacheKeyV2({ ...base, permissionGeneration: 'open-cycle' }))
    const left = { ...base, query: 'q\u001fall', category: 'pane' }
    const right = { ...base, query: 'q', category: 'all\u001fpane' }
    expect(serializeWorkspaceSearchCacheKeyV2(left)).not.toBe(serializeWorkspaceSearchCacheKeyV2(right))
  })

  it('does not cache a truncated page with a cursor past the omitted rows', () => {
    const cache = new WorkspaceSearchResultCache()
    const key = { profileRef: 'p', projectScope: 'w', query: 'q', category: 'all', filters: '', sort: 'stable', locale: 'en', cursor: '' }
    cache.set(key, [pane('old')], 0)
    cache.set(key, Array.from({ length: 1001 }, (_, index) => session('title', String(index))), 1, 'after-1001')
    expect(cache.get(key, 2)).toBeUndefined()
    expect(cache.size).toBe(0)
  })

  it('isolates profile, project, locale, and permission generation', () => {
    const cache = new WorkspaceSearchResultCache()
    const base = {
      profileRef: 'p1',
      permissionGeneration: 'g1',
      projectScope: 'workspace:a',
      query: 'git',
      category: 'all',
      filters: '',
      sort: 'stable',
      locale: 'en',
      cursor: '',
    }
    cache.set(base, [pane('Git')], 1_000)
    expect(cache.get({ ...base, profileRef: 'p2' }, 1_010)).toBeUndefined()
    expect(cache.get({ ...base, projectScope: 'workspace:b' }, 1_010)).toBeUndefined()
    expect(cache.get({ ...base, locale: 'zh' }, 1_010)).toBeUndefined()
    expect(cache.get(base, 1_010)?.items[0]?.title).toBe('Git')
    expect(cache.get(base, 1_000 + 5 * 60_000 + 1)).toBeUndefined()
  })
})

describe('workspace search preferences', () => {
  it('records successful opens only, never query text, and keeps stale projects from expanding', () => {
    const values = new Map<string, string>()
    const store = new WorkspaceSearchPreferenceStore({
      getItem: key => values.get(key),
      setItem: (key, value) => { values.set(key, value) },
      removeItem: key => { values.delete(key) },
    })
    store.recordOpen('pane:git:git.status:view:git.status', '2026-09-05T00:00:00.000Z')
    store.saveNamedFilter({
      id: 'named:dev',
      label: 'Dev',
      filters: { category: 'pane', allAccessibleProjects: false, openedOnly: false, showCompatibility: false, projectRef: 'workspace:gone' },
    })
    const raw = values.get('yeisme.dsh.workspace-search:v1') ?? ''
    expect(raw.includes('git.status')).toBe(true)
    expect(raw.includes('query')).toBe(false)
    const restored = store.restoreNamedFilter('named:dev', new Set(['workspace:current']))
    expect(restored.staleProject).toBe(true)
    expect(restored.filters?.projectRef).toBe('workspace:gone')
    expect(restored.filters?.allAccessibleProjects).toBe(false)
  })
})


function provider(id: string, search: SearchCenterOwnerSource['search']): SearchCenterOwnerSource {
  return { descriptor: { id, owner: id, resourceKinds: ['skill'], coverage: 'catalog', scopes: ['profile'], filters: [], sorts: ['relevance'], pagination: true, preview: false, open: false }, search }
}
const sourceRequest = { query: 'git', composing: false, filters, locale: 'en', profileRef: 'p1', sources: { scope: { kind: 'profile' as const }, kinds: ['skill' as const], filters: {} } }
const sourceItem = (owner: string, ref = '1') => ({ owner, ref, kind: 'skill' as const, title: 'Git review' })
async function settleSources() { for (let index = 0; index < 16; index++) await Promise.resolve() }

describe('unified coordinator source lane', () => {
  it('shares the concurrency budget with legacy history and releases queued reads progressively', async () => {
    const clock = fakeClock(), registry = new SearchCenterSourceRegistry()
    const resolvers: Array<() => void> = []
    const calls: string[] = []
    for (const id of ['a', 'b', 'c', 'd']) registry.register(provider(id, () => {
      calls.push(id)
      return new Promise(resolve => { resolvers.push(() => resolve({ status: 'ready', resources: [sourceItem(id)] })) })
    }))
    const coordinator = new WorkspaceSearchCoordinator(() => [pane('Git')], { capability: 'available', search: () => new Promise(() => {}) }, clock)
    coordinator.connectSources(registry); coordinator.setRequest(sourceRequest); clock.advance(200)
    expect(calls).toEqual(['a', 'b'])
    expect(coordinator.getSnapshot().local.visibleItems.map(item => item.title)).toEqual(['Git'])
    resolvers[0]!(); await settleSources()
    expect(calls).toEqual(['a', 'b', 'c'])
    expect(coordinator.getSnapshot().sources?.[0]?.page.results).toHaveLength(1)
    coordinator.dispose(); await settleSources()
    expect(calls).toEqual(['a', 'b', 'c'])
    expect(coordinator.getSnapshot().sources).toEqual([])
  })

  it('deduplicates load-more gestures and terminates a repeated cursor without inventing a total', async () => {
    const clock = fakeClock(), registry = new SearchCenterSourceRegistry()
    const search = vi.fn(async request => ({ status: 'partial' as const, resources: [sourceItem('a', request.cursor ? '2' : '1')], nextCursor: 'cursor:repeat' }))
    registry.register(provider('a', search))
    const coordinator = new WorkspaceSearchCoordinator(() => [], undefined, clock)
    coordinator.connectSources(registry); coordinator.setRequest(sourceRequest); clock.advance(200); await settleSources()
    coordinator.loadSourcePage('a'); coordinator.loadSourcePage('a'); await settleSources()
    expect(search).toHaveBeenCalledTimes(2)
    expect(coordinator.getSnapshot().sources?.[0]?.page).toMatchObject({ status: 'partial', reason: 'pagination_stalled' })
    expect(coordinator.getSnapshot().sources?.[0]?.page.results).toHaveLength(2)
    expect(coordinator.getSnapshot().sources?.[0]?.page.nextCursor).toBeUndefined()
    expect(coordinator.getSnapshot().sources?.[0]?.page.total).toBeUndefined()
    coordinator.dispose()
  })

  it('does not let a slow or failed source suppress successful sources and allows isolated retry', async () => {
    const clock = fakeClock(), registry = new SearchCenterSourceRegistry()
    const slow = vi.fn(() => new Promise<never>(() => {}))
    const fast = vi.fn(async () => ({ status: 'ready' as const, resources: [sourceItem('fast')] }))
    registry.register(provider('slow', slow)); registry.register(provider('fast', fast))
    const coordinator = new WorkspaceSearchCoordinator(() => [], undefined, clock)
    coordinator.connectSources(registry); coordinator.setRequest(sourceRequest); clock.advance(200); await settleSources()
    clock.advance(30_000); await settleSources()
    expect(coordinator.getSnapshot().sources?.find(group => group.descriptor.id === 'slow')?.page).toMatchObject({ status: 'error', reason: 'source_timeout', results: [] })
    expect(coordinator.getSnapshot().sources?.find(group => group.descriptor.id === 'fast')?.page.results).toHaveLength(1)
    coordinator.loadSourcePage('slow', true)
    expect(slow).toHaveBeenCalledTimes(2)
    expect(fast).toHaveBeenCalledTimes(1)
    coordinator.dispose()
  })

  it('keeps IME quiet and discards source responses after query changes', async () => {
    const clock = fakeClock(), registry = new SearchCenterSourceRegistry()
    let resolve!: (value: { status: 'ready'; resources: ReturnType<typeof sourceItem>[] }) => void
    const search = vi.fn(() => new Promise<{ status: 'ready'; resources: ReturnType<typeof sourceItem>[] }>(done => { resolve = done }))
    registry.register(provider('a', search))
    const coordinator = new WorkspaceSearchCoordinator(() => [], undefined, clock)
    coordinator.connectSources(registry); coordinator.setRequest({ ...sourceRequest, composing: true }); clock.advance(500)
    expect(search).not.toHaveBeenCalled()
    coordinator.setRequest(sourceRequest); clock.advance(200)
    coordinator.setRequest({ ...sourceRequest, query: 'new query' })
    resolve({ status: 'ready', resources: [sourceItem('a')] }); await settleSources()
    expect(coordinator.getSnapshot().sources?.[0]?.page.results).toEqual([])
    coordinator.dispose()
  })
})
