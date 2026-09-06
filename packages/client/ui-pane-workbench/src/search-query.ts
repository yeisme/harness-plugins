import { serializeWorkspaceSearchCacheKey, WorkspaceSearchResultCache, type WorkspaceSearchCacheKeyV1 } from './search-cache.js'
import { projectWorkspaceSearch, type WorkspaceSearchFiltersV1, type WorkspaceSearchProjectionV1 } from './search-group.js'
import type { WorkspaceSearchCandidateV1 } from './search-identity.js'

export type WorkspaceSearchSourceStatusV1 =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'partial'
  | 'stale'
  | 'error'
  | 'disabled'
  | 'unknown'

export type WorkspaceSearchHistoryCapabilityV1 =
  | 'available'
  | 'offline'
  | 'denied'
  | 'contract_mismatch'
  | 'unavailable'

export interface WorkspaceSearchHistoryPageV1 {
  readonly items: readonly WorkspaceSearchCandidateV1[]
  readonly nextCursor?: string
  readonly status: 'ready' | 'partial' | 'permission_denied' | 'offline' | 'contract_mismatch'
  readonly reason?: string
}

export interface WorkspaceSearchHistoryAdapterV1 {
  readonly capability: WorkspaceSearchHistoryCapabilityV1
  readonly reason?: string
  readonly permissionGeneration?: string
  search(request: {
    readonly query: string
    readonly projectRef?: string
    readonly allAccessibleProjects: boolean
    readonly cursor?: string
    readonly limit: number
    readonly locale: string
  }, signal: AbortSignal): Promise<WorkspaceSearchHistoryPageV1>
}

export interface WorkspaceSearchClockV1 {
  now(): number
  setTimeout(callback: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export const DEFAULT_SEARCH_CLOCK: WorkspaceSearchClockV1 = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export const SEARCH_DEBOUNCE_MS = 200
export const SEARCH_LOADING_DELAY_MS = 150
export const SEARCH_SLOW_MS = 8_000
export const SEARCH_TIMEOUT_MS = 30_000
export const SEARCH_FANOUT_LIMIT = 3

export interface WorkspaceSearchRequestV1 {
  readonly query: string
  readonly composing: boolean
  readonly filters: WorkspaceSearchFiltersV1
  readonly locale: string
  readonly profileRef: string
  readonly projectRef?: string
}

export interface WorkspaceSearchSourceStateV1 {
  readonly status: WorkspaceSearchSourceStatusV1
  readonly reason?: string
  readonly loadedCount: number
  readonly nextCursor?: string
  readonly slow: boolean
  readonly updating: boolean
}

export interface WorkspaceSearchSnapshotV1 {
  readonly generation: number
  readonly local: WorkspaceSearchProjectionV1
  readonly history: WorkspaceSearchSourceStateV1
  readonly selectedKey?: string
  readonly notice?: string
}

export function probeWorkspaceSearchHistoryAdapter(input: {
  readonly search?: unknown
  readonly capability?: string
}): { readonly capability: WorkspaceSearchHistoryCapabilityV1; readonly reason?: string } {
  if (input.search === undefined) return { capability: 'unavailable', reason: 'history_owner_missing' }
  if (typeof input.search !== 'function') return { capability: 'contract_mismatch', reason: 'history_search_not_callable' }
  if (input.capability !== undefined && input.capability !== 'pane.conversation-search.v1' && input.capability !== 'pane.workspace-search.v1') {
    return { capability: 'contract_mismatch', reason: 'history_capability_unknown' }
  }
  return { capability: 'available' }
}

function historyStateFromCapability(capability: WorkspaceSearchHistoryCapabilityV1, reason?: string): WorkspaceSearchSourceStateV1 {
  if (capability === 'available') return { status: 'idle', loadedCount: 0, slow: false, updating: false }
  if (capability === 'offline') return { status: 'error', reason: reason ?? 'offline', loadedCount: 0, slow: false, updating: false }
  if (capability === 'denied') return { status: 'error', reason: reason ?? 'permission_denied', loadedCount: 0, slow: false, updating: false }
  if (capability === 'contract_mismatch') return { status: 'unknown', reason: reason ?? 'contract_mismatch', loadedCount: 0, slow: false, updating: false }
  return { status: 'disabled', reason: reason ?? 'history_owner_missing', loadedCount: 0, slow: false, updating: false }
}

export class WorkspaceSearchCoordinator {
  private generation = 0
  private abort: AbortController | undefined
  private debounceHandle: unknown
  private loadingHandle: unknown
  private slowHandle: unknown
  private timeoutHandle: unknown
  private historyItems: WorkspaceSearchCandidateV1[] = []
  private history: WorkspaceSearchSourceStateV1
  private selectedKey: string | undefined
  private readonly cache = new WorkspaceSearchResultCache()
  private openCycle = true
  private disposed = false
  private request: WorkspaceSearchRequestV1 | undefined

  constructor(
    private readonly locals: () => readonly WorkspaceSearchCandidateV1[],
    private readonly adapter: WorkspaceSearchHistoryAdapterV1 | undefined,
    private readonly clock: WorkspaceSearchClockV1 = DEFAULT_SEARCH_CLOCK,
    private readonly listeners = new Set<() => void>(),
  ) {
    this.history = historyStateFromCapability(adapter?.capability ?? 'unavailable', adapter?.reason)
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot(): WorkspaceSearchSnapshotV1 {
    const request = this.request
    const localCandidates = this.locals()
    const historyVisible = this.history.status === 'disabled' || this.history.status === 'unknown'
      ? []
      : this.historyItems
    const projection = projectWorkspaceSearch({
      query: request?.query ?? '',
      candidates: [...localCandidates, ...historyVisible],
      filters: request?.filters,
      sessionLoadedCount: historyVisible.length,
      sessionTotalUnknown: this.history.nextCursor !== undefined || this.history.status === 'partial' || this.history.status === 'loading',
    })
    const selectedKey = this.selectedKey !== undefined && projection.visibleItems.some(item => item.stableKey === this.selectedKey)
      ? this.selectedKey
      : projection.visibleItems[0]?.stableKey
    return {
      generation: this.generation,
      local: projection,
      history: this.history,
      ...(selectedKey === undefined ? {} : { selectedKey }),
    }
  }

  setRequest(request: WorkspaceSearchRequestV1): void {
    if (this.disposed) return
    const previous = this.request
    this.request = request
    if (previous !== undefined && this.sameQuery(previous, request) && previous.composing === request.composing) {
      this.emit()
      return
    }
    this.generation += 1
    this.cancelInFlight()
    this.historyItems = []
    if (this.adapter?.capability !== 'available') {
      this.history = historyStateFromCapability(this.adapter?.capability ?? 'unavailable', this.adapter?.reason)
      this.emit()
      return
    }
    if (request.composing || request.query.trim().length === 0) {
      this.history = { status: 'idle', loadedCount: 0, slow: false, updating: false }
      this.emit()
      return
    }
    const cacheKey = this.cacheKey(request)
    const cached = this.cache.get(cacheKey, this.clock.now())
    if (cached !== undefined) {
      this.historyItems = [...cached.items]
      this.history = {
        status: this.cache.isFresh(cached, this.clock.now()) ? 'ready' : 'stale',
        loadedCount: cached.items.length,
        nextCursor: cached.nextCursor,
        slow: false,
        updating: true,
      }
      this.emit()
    } else {
      this.history = { status: 'idle', loadedCount: 0, slow: false, updating: false }
      this.emit()
    }
    this.debounceHandle = this.clock.setTimeout(() => this.run(this.generation, request, undefined, false), SEARCH_DEBOUNCE_MS)
  }

  loadMore(): void {
    const request = this.request
    if (request === undefined || this.history.nextCursor === undefined || this.adapter?.capability !== 'available') return
    this.run(this.generation, request, this.history.nextCursor, true)
  }

  retry(): void {
    const request = this.request
    if (request === undefined || this.adapter?.capability !== 'available') return
    this.run(this.generation, request, undefined, false)
  }

  select(stableKey: string): void {
    this.selectedKey = stableKey
    this.emit()
  }

  invalidate(reason: 'permission' | 'registry' | 'locale' | 'close' | 'profile'): void {
    if (reason === 'permission') {
      this.cache.clear()
      this.historyItems = []
      this.history = { status: 'error', reason: 'permission_denied', loadedCount: 0, slow: false, updating: false }
    } else if (reason === 'close') {
      this.cancelInFlight()
      if (this.adapter?.permissionGeneration === undefined) this.cache.clear()
      this.openCycle = false
    } else if (reason === 'profile' || reason === 'locale') {
      this.cache.clear()
    }
    this.emit()
  }

  open(): void {
    this.openCycle = true
  }

  dispose(): void {
    this.disposed = true
    this.cancelInFlight()
    this.listeners.clear()
  }

  private run(generation: number, request: WorkspaceSearchRequestV1, cursor: string | undefined, append: boolean): void {
    if (this.adapter?.capability !== 'available' || this.adapter.search === undefined) return
    if (!append) this.cancelInFlight()
    const abort = new AbortController()
    this.abort = abort
    const startedAt = this.clock.now()
    if (!append && this.historyItems.length === 0) {
      this.loadingHandle = this.clock.setTimeout(() => {
        if (generation !== this.generation || abort.signal.aborted) return
        this.history = { ...this.history, status: 'loading' }
        this.emit()
      }, SEARCH_LOADING_DELAY_MS)
    }
    this.slowHandle = this.clock.setTimeout(() => {
      if (generation !== this.generation || abort.signal.aborted) return
      this.history = { ...this.history, slow: true }
      this.emit()
    }, SEARCH_SLOW_MS)
    this.timeoutHandle = this.clock.setTimeout(() => abort.abort(), SEARCH_TIMEOUT_MS)
    void this.adapter.search({
      query: request.query.trim(),
      allAccessibleProjects: request.filters.allAccessibleProjects,
      locale: request.locale,
      limit: 20,
      ...(request.filters.projectRef === undefined ? {} : { projectRef: request.filters.projectRef }),
      ...(cursor === undefined ? {} : { cursor }),
    }, abort.signal).then(page => {
      if (generation !== this.generation || abort.signal.aborted) return
      this.clearTimers()
      if (page.status === 'permission_denied') {
        this.invalidate('permission')
        return
      }
      if (page.status === 'offline' || page.status === 'contract_mismatch') {
        this.history = {
          status: page.status === 'offline' ? 'error' : 'unknown',
          reason: page.reason ?? page.status,
          loadedCount: this.historyItems.length,
          slow: this.clock.now() - startedAt >= SEARCH_SLOW_MS,
          updating: false,
          nextCursor: this.history.nextCursor,
        }
        this.emit()
        return
      }
      const incoming = uniqueByKey(append ? [...this.historyItems, ...page.items] : page.items)
      this.historyItems = incoming
      if (this.adapter?.permissionGeneration !== undefined || this.openCycle) {
        this.cache.set(this.cacheKey(request, cursor), incoming, this.clock.now(), page.nextCursor)
      }
      this.history = {
        status: incoming.length === 0 ? 'empty' : page.status === 'partial' ? 'partial' : 'ready',
        loadedCount: incoming.length,
        nextCursor: page.nextCursor,
        slow: false,
        updating: false,
        ...(page.reason === undefined ? {} : { reason: page.reason }),
      }
      this.emit()
    }).catch(() => {
      if (generation !== this.generation || abort.signal.aborted) return
      this.clearTimers()
      this.history = {
        status: 'error',
        reason: 'search_failed',
        loadedCount: this.historyItems.length,
        nextCursor: this.history.nextCursor,
        slow: this.clock.now() - startedAt >= SEARCH_SLOW_MS,
        updating: false,
      }
      this.emit()
    })
  }

  private cacheKey(request: WorkspaceSearchRequestV1, cursor = ''): WorkspaceSearchCacheKeyV1 {
    return {
      profileRef: request.profileRef,
      permissionGeneration: this.adapter?.permissionGeneration,
      projectScope: request.filters.allAccessibleProjects ? 'all-accessible' : request.filters.projectRef ?? 'unspecified',
      query: request.query.trim().normalize('NFKC').toLocaleLowerCase(),
      category: request.filters.category,
      filters: [
        request.filters.openedOnly ? 'opened' : '',
        request.filters.status ?? '',
        request.filters.pluginOwner ?? '',
        request.filters.timeRange ?? '',
      ].join(','),
      sort: 'stable',
      locale: request.locale,
      cursor,
    }
  }

  private sameQuery(left: WorkspaceSearchRequestV1, right: WorkspaceSearchRequestV1): boolean {
    return serializeWorkspaceSearchCacheKey(this.cacheKey(left)) === serializeWorkspaceSearchCacheKey(this.cacheKey(right))
  }

  private cancelInFlight(): void {
    this.abort?.abort()
    this.abort = undefined
    this.clearTimers()
  }

  private clearTimers(): void {
    if (this.debounceHandle !== undefined) this.clock.clearTimeout(this.debounceHandle)
    if (this.loadingHandle !== undefined) this.clock.clearTimeout(this.loadingHandle)
    if (this.slowHandle !== undefined) this.clock.clearTimeout(this.slowHandle)
    if (this.timeoutHandle !== undefined) this.clock.clearTimeout(this.timeoutHandle)
    this.debounceHandle = undefined
    this.loadingHandle = undefined
    this.slowHandle = undefined
    this.timeoutHandle = undefined
  }

  private emit(): void {
    for (const listener of this.listeners) {
      try { listener() } catch { /* one subscriber cannot stall search */ }
    }
  }
}

function uniqueByKey(items: readonly WorkspaceSearchCandidateV1[]): WorkspaceSearchCandidateV1[] {
  const seen = new Set<string>()
  const next: WorkspaceSearchCandidateV1[] = []
  for (const item of items) {
    if (seen.has(item.stableKey)) continue
    seen.add(item.stableKey)
    next.push(item)
  }
  return next
}
