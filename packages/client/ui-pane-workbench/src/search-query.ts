import { serializeWorkspaceSearchCacheKeyV2, WorkspaceSearchResultCache, type WorkspaceSearchCacheKeyV1 } from './search-cache.js'
import { projectWorkspaceSearch, type WorkspaceSearchFiltersV1, type WorkspaceSearchProjectionV1 } from './search-group.js'
import type { WorkspaceSearchCandidateV1 } from './search-identity.js'
import { hasSearchCenterConstraints, searchCenterControlKey, type SearchCenterControls } from './search-controls.js'
import type { SearchCenterSourceRegistry, SearchCenterProviderPage } from './search-source-registry.js'
import { sourcePreviewResults, type SearchCenterScope, type SearchCenterSourceDescriptor, type SearchCenterSourceRequest } from './search-source.js'
import type { SearchCenterResourceKind } from './search-catalog.js'

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
  /** Current owner proof is required before retaining results after a read failure. */
  isAuthorizationCurrent?(generation: string): boolean
  /** Internal change notification; does not expand the legacy owner wire contract. */
  subscribe?(listener: () => void): () => void
  /** Opt-in: validates every requested advanced control before querying its owner. */
  readonly negotiatesControls?: boolean
  search(request: {
    readonly query: string
    readonly projectRef?: string
    readonly allAccessibleProjects: boolean
    readonly cursor?: string
    readonly limit: number
    readonly locale: string
    readonly controls?: SearchCenterControls
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
  readonly browse?: boolean
  readonly previewLimit?: number
  readonly controls?: SearchCenterControls
  /** Opt-in source lane. Missing scope never falls back to a broader owner scope. */
  readonly sources?: {
    readonly scope: SearchCenterScope
    readonly kinds: readonly SearchCenterResourceKind[]
    readonly filters: Readonly<Record<string, string>>
    readonly owner?: string
  }
}

export interface WorkspaceSearchProviderGroup {
  readonly descriptor: SearchCenterSourceDescriptor
  readonly page: Omit<SearchCenterProviderPage, 'status'> & { readonly status: SearchCenterProviderPage['status'] | 'idle' | 'loading' }
  readonly updating: boolean
}

interface SourceJob { readonly id: string; readonly request: SearchCenterSourceRequest; readonly append: boolean; readonly generation: number }

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
  readonly sources?: readonly WorkspaceSearchProviderGroup[]
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
  private deferredSelection = false
  private readonly cache = new WorkspaceSearchResultCache(serializeWorkspaceSearchCacheKeyV2)
  private openCycle = true
  private disposed = false
  private requestInvalidated = false
  private request: WorkspaceSearchRequestV1 | undefined
  private sourceRegistry: SearchCenterSourceRegistry | undefined
  private sourceConnection: object | undefined
  private sourceUnsubscribe: (() => void) | undefined
  private sourceGeneration = 0
  private sourceDebounce: unknown
  private readonly sourceGroups = new Map<string, WorkspaceSearchProviderGroup>()
  private readonly sourceReads = new Map<string, AbortController>()
  private readonly sourceCursors = new Map<string, Set<string>>()
  private sourceQueue: SourceJob[] = []

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
      candidates: localCandidates,
      remoteItems: historyVisible,
      filters: request?.filters,
      sessionLoadedCount: historyVisible.length,
      sessionTotalUnknown: this.history.nextCursor !== undefined || this.history.status === 'partial' || this.history.status === 'loading',
      browse: request?.browse,
      previewLimit: request?.previewLimit,
      controls: request?.controls,
      locale: request?.locale,
    })
    const sourceResults = sourcePreviewResults([...this.sourceGroups.values()].flatMap(group => group.page.results), request?.previewLimit ?? 5)
    const selectedKey = this.selectedKey !== undefined && [...projection.visibleItems, ...sourceResults].some(item => item.stableKey === this.selectedKey)
      ? this.selectedKey
      : this.deferredSelection ? undefined : projection.visibleItems[0]?.stableKey ?? sourceResults[0]?.stableKey
    return {
      generation: this.generation,
      local: projection,
      history: this.history,
      ...(this.sourceRegistry === undefined ? {} : { sources: [...this.sourceGroups.values()] }),
      ...(selectedKey === undefined ? {} : { selectedKey }),
      ...(this.deferredSelection && selectedKey === undefined ? { notice: 'selectionUnavailable' } : {}),
    }
  }

  setRequest(request: WorkspaceSearchRequestV1): void {
    if (this.disposed) return
    const previous = this.request
    if (previous !== undefined && (this.sourceRequestKey(previous) !== this.sourceRequestKey(request) || !this.sameQuery(previous, request))) {
      this.deferredSelection = false
      this.selectedKey = undefined
    }
    const invalidated = this.requestInvalidated
    this.requestInvalidated = false
    this.request = request
    if (invalidated || previous === undefined || this.sourceRequestKey(previous) !== this.sourceRequestKey(request)) this.restartSources(request)
    if (!invalidated && previous !== undefined && this.sameQuery(previous, request) && previous.composing === request.composing) {
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
    if (request.filters.timeRange === 'unsupported') {
      this.history = { status: 'disabled', reason: 'time:unavailable', loadedCount: 0, slow: false, updating: false }
      this.emit()
      return
    }
    if (hasSearchCenterConstraints(request.controls) && this.adapter.negotiatesControls !== true) {
      this.history = { status: 'unknown', reason: 'source_controls_unsupported', loadedCount: 0, slow: false, updating: false }
      this.emit()
      return
    }
    if (request.composing || (request.query.trim().length === 0 && !request.browse)) {
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
    if (this.disposed || !this.openCycle || this.abort !== undefined || request === undefined || this.history.nextCursor === undefined || this.adapter?.capability !== 'available') return
    this.run(this.generation, request, this.history.nextCursor, true)
  }

  retry(): void {
    const request = this.request
    if (request === undefined || this.adapter?.capability !== 'available') return
    this.run(this.generation, request, undefined, false)
  }

  refreshSource(): void {
    if (this.disposed || !this.openCycle) return
    const request = this.request
    this.invalidate('source')
    if (request !== undefined) this.setRequest(request)
  }

  connectSources(registry: SearchCenterSourceRegistry): () => void {
    if (this.disposed) return () => {}
    this.sourceUnsubscribe?.()
    const connection = {}
    this.sourceConnection = connection
    this.sourceRegistry = registry
    const unsubscribe = registry.subscribe(() => { this.restartSources(this.request); this.emit() })
    this.sourceUnsubscribe = unsubscribe
    this.restartSources(this.request)
    this.emit()
    return () => {
      unsubscribe()
      if (this.sourceConnection !== connection) return
      this.cancelSources()
      this.sourceRegistry = undefined
      this.sourceUnsubscribe = undefined
      this.sourceConnection = undefined
      this.emit()
    }
  }

  loadSourcePage(id: string, retry = false): void {
    const group = this.sourceGroups.get(id)
    const request = this.request
    if (this.disposed || !this.openCycle || !group || !request?.sources || request.composing
      || this.sourceReads.has(id) || this.sourceQueue.some(job => job.id === id)
      || (!retry && group.page.nextCursor === undefined)) return
    const sourceRequest = this.ownerRequest(group.descriptor, request, retry ? undefined : group.page.nextCursor)
    if (!sourceRequest) return
    if (retry) {
      this.sourceCursors.delete(id)
      this.sourceGroups.set(id, { ...group, page: { status: 'idle', results: [] }, updating: false })
    }
    this.sourceQueue.push({ id, request: sourceRequest, append: !retry, generation: this.sourceGeneration })
    this.drainSources()
  }

  select(stableKey: string, options?: { readonly deferUntilVisible?: boolean }): void {
    this.selectedKey = stableKey
    this.deferredSelection = options?.deferUntilVisible === true
    this.emit()
  }

  invalidate(reason: 'permission' | 'registry' | 'locale' | 'close' | 'profile' | 'source'): void {
    this.cancelSources()
    this.generation += 1
    this.cancelInFlight()
    this.historyItems = []
    this.selectedKey = undefined
    this.deferredSelection = false
    this.history = historyStateFromCapability(this.adapter?.capability ?? 'unavailable', this.adapter?.reason)
    if (reason === 'permission') {
      this.cache.clear()
      this.historyItems = []
      this.history = { status: 'error', reason: 'permission_denied', loadedCount: 0, slow: false, updating: false }
    } else if (reason === 'close') {
      if (this.adapter?.permissionGeneration === undefined) this.cache.clear()
      this.openCycle = false
    } else if (reason === 'profile' || reason === 'locale' || reason === 'source' || reason === 'registry') {
      this.cache.clear()
    }
    // Keep local filtering intact, but re-query an explicitly refreshed request.
    this.requestInvalidated = true
    this.emit()
  }

  open(): void {
    this.openCycle = true
  }

  dispose(): void {
    this.disposed = true
    this.cancelInFlight()
    this.sourceUnsubscribe?.()
    this.sourceUnsubscribe = undefined
    this.cancelSources()
    this.historyItems = []
    this.cache.clear()
    this.listeners.clear()
  }

  private sourceRequestKey(request: WorkspaceSearchRequestV1): string {
    return JSON.stringify([request.query, request.composing, request.profileRef, request.locale, request.browse, request.sources, request.controls?.sort ?? 'relevance'])
  }

  private ownerRequest(descriptor: SearchCenterSourceDescriptor, request: WorkspaceSearchRequestV1, cursor?: string): SearchCenterSourceRequest | undefined {
    const source = request.sources
    if (!source || (source.owner !== undefined && source.owner !== descriptor.owner)) return undefined
    const kinds = source.kinds.filter(kind => descriptor.resourceKinds.includes(kind))
    if (kinds.length === 0) return undefined
    return { query: request.query, scope: source.scope, kinds, filters: source.filters, sort: request.controls?.sort ?? 'relevance', limit: 20,
      ...(cursor === undefined ? {} : { cursor }) }
  }

  private restartSources(request: WorkspaceSearchRequestV1 | undefined): void {
    this.cancelSources()
    if (this.disposed || !this.openCycle || !request?.sources || !this.sourceRegistry) return
    const jobs: SourceJob[] = []
    for (const descriptor of this.sourceRegistry.getSnapshot()) {
      const ownerRequest = this.ownerRequest(descriptor, request)
      if (!ownerRequest) continue
      this.sourceGroups.set(descriptor.id, { descriptor, page: { status: 'idle', results: [] }, updating: false })
      jobs.push({ id: descriptor.id, request: ownerRequest, append: false, generation: this.sourceGeneration })
    }
    if (request.composing || (!request.browse && request.query.trim().length === 0)) return
    this.sourceDebounce = this.clock.setTimeout(() => {
      this.sourceDebounce = undefined
      this.sourceQueue.push(...jobs)
      this.drainSources()
    }, SEARCH_DEBOUNCE_MS)
  }

  private drainSources(): void {
    const limit = SEARCH_FANOUT_LIMIT - (this.adapter?.capability === 'available' ? 1 : 0)
    while (!this.disposed && this.openCycle && this.sourceRegistry && this.sourceReads.size < limit && this.sourceQueue.length > 0) {
      const job = this.sourceQueue.shift()!
      const group = this.sourceGroups.get(job.id)
      if (job.generation !== this.sourceGeneration || !group) continue
      const abort = new AbortController()
      this.sourceReads.set(job.id, abort)
      this.sourceGroups.set(job.id, { ...group, updating: true })
      const loading = this.clock.setTimeout(() => {
        if (job.generation !== this.sourceGeneration || abort.signal.aborted) return
        const current = this.sourceGroups.get(job.id)!
        this.sourceGroups.set(job.id, { ...current, page: { ...current.page, status: current.page.results.length > 0 ? current.page.status : 'loading' } })
        this.emit()
      }, SEARCH_LOADING_DELAY_MS)
      const timeout = this.clock.setTimeout(() => {
        if (job.generation !== this.sourceGeneration || abort.signal.aborted) return
        abort.abort()
        this.sourceGroups.set(job.id, { descriptor: group.descriptor, page: { status: 'error', reason: 'source_timeout', results: [] }, updating: false })
        this.emit()
      }, SEARCH_TIMEOUT_MS)
      void this.sourceRegistry.query(job.id, job.request, abort.signal).then(page => {
        if (job.generation !== this.sourceGeneration || abort.signal.aborted) return
        const previous = this.sourceGroups.get(job.id)!
        if (page.status === 'ready' || page.status === 'partial') {
          const results = [...new Map((job.append ? [...previous.page.results, ...page.results] : page.results).map(result => [result.stableKey, result])).values()]
          const cursors = this.sourceCursors.get(job.id) ?? new Set<string>()
          if (job.request.cursor !== undefined) cursors.add(job.request.cursor)
          this.sourceCursors.set(job.id, cursors)
          if (page.nextCursor !== undefined && cursors.has(page.nextCursor)) {
            page = { status: 'partial', reason: 'pagination_stalled', results }
          } else page = { ...page, results }
        }
        this.sourceGroups.set(job.id, { descriptor: group.descriptor, page, updating: false })
        this.emit()
      }).catch(() => {
        if (job.generation !== this.sourceGeneration || abort.signal.aborted) return
        this.sourceGroups.set(job.id, { descriptor: group.descriptor, page: { status: 'error', reason: 'source_query_failed', results: [] }, updating: false })
        this.emit()
      }).finally(() => {
        this.clock.clearTimeout(loading)
        this.clock.clearTimeout(timeout)
        if (this.sourceReads.get(job.id) === abort) this.sourceReads.delete(job.id)
        this.drainSources()
      })
    }
  }

  private cancelSources(): void {
    this.sourceGeneration += 1
    if (this.sourceDebounce !== undefined) this.clock.clearTimeout(this.sourceDebounce)
    this.sourceDebounce = undefined
    for (const abort of this.sourceReads.values()) abort.abort()
    this.sourceReads.clear()
    this.sourceQueue = []
    this.sourceGroups.clear()
    this.sourceCursors.clear()
  }

  private run(generation: number, request: WorkspaceSearchRequestV1, cursor: string | undefined, append: boolean): void {
    if (this.disposed || !this.openCycle || this.adapter?.capability !== 'available' || this.adapter.search === undefined) return
    this.cancelInFlight()
    if (hasSearchCenterConstraints(request.controls) && this.adapter.negotiatesControls !== true) {
      this.historyItems = []
      this.history = { status: 'unknown', reason: 'source_controls_unsupported', loadedCount: 0, slow: false, updating: false }
      this.emit()
      return
    }
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
    this.timeoutHandle = this.clock.setTimeout(() => {
      if (generation !== this.generation || abort.signal.aborted) return
      abort.abort()
      this.abort = undefined
      this.clearTimers()
      this.failSource('search_timeout', true)
      this.emit()
    }, SEARCH_TIMEOUT_MS)
    let response: Promise<WorkspaceSearchHistoryPageV1>
    try { response = this.adapter.search({
      query: request.query.trim(),
      allAccessibleProjects: request.filters.allAccessibleProjects,
      locale: request.locale,
      limit: 20,
      ...(request.controls === undefined ? {} : { controls: request.controls }),
      ...(request.filters.projectRef === undefined ? {} : { projectRef: request.filters.projectRef }),
      ...(cursor === undefined ? {} : { cursor }),
    }, abort.signal) } catch { response = Promise.reject(new Error('search_failed')) }
    void response.then(page => {
      if (generation !== this.generation || abort.signal.aborted) return
      this.clearTimers()
      this.abort = undefined
      if (page.status === 'permission_denied') {
        this.invalidate('permission')
        return
      }
      if (page.status === 'offline' || page.status === 'contract_mismatch') {
        this.failSource(page.reason ?? page.status, this.clock.now() - startedAt >= SEARCH_SLOW_MS, page.status === 'contract_mismatch')
        this.emit()
        return
      }
      const incoming = uniqueByKey(append ? [...this.historyItems, ...page.items] : page.items)
      this.historyItems = incoming
      if (this.adapter?.permissionGeneration !== undefined || this.openCycle) {
        this.cache.set(this.cacheKey(request, cursor), page.items, this.clock.now(), page.nextCursor)
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
      this.abort = undefined
      this.failSource('search_failed', this.clock.now() - startedAt >= SEARCH_SLOW_MS)
      this.emit()
    })
  }

  private failSource(reason: string, slow: boolean, contractMismatch = false): void {
    let authorized = false
    try {
      const generation = this.adapter?.permissionGeneration
      authorized = generation !== undefined && this.adapter?.isAuthorizationCurrent?.(generation) === true
    } catch { /* Missing authorization proof must not retain private content. */ }
    if (!authorized || contractMismatch) {
      this.historyItems = []
      this.cache.clear()
    }
    this.history = {
      status: contractMismatch ? 'unknown' : this.historyItems.length > 0 ? 'stale' : 'error',
      reason, loadedCount: this.historyItems.length, slow, updating: false,
    }
  }

  private cacheKey(request: WorkspaceSearchRequestV1, cursor = ''): WorkspaceSearchCacheKeyV1 {
    return {
      profileRef: request.profileRef,
      permissionGeneration: this.adapter?.permissionGeneration,
      projectScope: request.filters.allAccessibleProjects ? 'all-accessible' : request.filters.projectRef ?? 'unspecified',
      // Only the owner may decide whether case/normalization changes query meaning.
      query: request.query.trim(),
      category: request.filters.category,
      filters: JSON.stringify([
        request.filters.openedOnly ? 'opened' : '',
        request.filters.status ?? '',
        request.filters.pluginOwner ?? '',
        request.filters.timeRange ?? '',
        searchCenterControlKey(request.controls),
        request.browse === true,
      ]),
      sort: 'stable',
      locale: request.locale,
      cursor,
    }
  }

  private sameQuery(left: WorkspaceSearchRequestV1, right: WorkspaceSearchRequestV1): boolean {
    return serializeWorkspaceSearchCacheKeyV2(this.cacheKey(left)) === serializeWorkspaceSearchCacheKeyV2(this.cacheKey(right))
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
