import { describe, expect, it, vi } from 'vitest'
import { WorkspaceSearchResultCache } from '../src/search-cache.js'
import {
  probeWorkspaceSearchHistoryAdapter,
  WorkspaceSearchCoordinator,
  type WorkspaceSearchClockV1,
  type WorkspaceSearchHistoryAdapterV1,
} from '../src/search-query.js'
import { DEFAULT_WORKSPACE_SEARCH_FILTERS } from '../src/search-group.js'
import { workspaceSearchStableKey, type WorkspaceSearchCandidateV1 } from '../src/search-identity.js'
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
