import { searchCenterResourceKinds } from './search-catalog.js'
import { searchCenterRequestSupport, sourceSearchCenterResult, type SearchCenterResource, type SearchCenterResult, type SearchCenterScope, type SearchCenterSourceDescriptor, type SearchCenterSourceRequest } from './search-source.js'

export interface SearchCenterOwnerPage {
  readonly status: 'ready' | 'partial' | 'offline' | 'denied' | 'disabled' | 'error'
  readonly resources: readonly SearchCenterResource[]
  readonly nextCursor?: string
  readonly total?: number
}

export interface SearchCenterOwnerSource {
  /** Opt in before receiving the additional local open AbortSignal argument. */
  readonly cancellableOpen?: boolean
  /** Directory registration currently requires preview:false until the Reader contract is connected. */
  readonly descriptor: SearchCenterSourceDescriptor
  search(request: SearchCenterSourceRequest, signal: AbortSignal): Promise<SearchCenterOwnerPage>
  subscribe?(listener: () => void): () => void
  open?(resource: SearchCenterResource, scope: SearchCenterScope, signal?: AbortSignal): Promise<{ readonly status: 'opened' | 'denied' | 'unavailable' }>
}

export interface SearchCenterProviderPage {
  readonly status: SearchCenterOwnerPage['status'] | 'stale'
  readonly results: readonly SearchCenterResult[]
  readonly reason?: string
  readonly nextCursor?: string
  readonly total?: number
}

interface Binding {
  readonly source: SearchCenterOwnerSource
  readonly descriptor: SearchCenterSourceDescriptor
  revision: number
  readonly reads: Set<AbortController>
  unsubscribe?: () => void
}

const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:/@-]{0,199}$/
const bounded = (value: unknown, maximum: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= maximum
const kinds = new Set(searchCenterResourceKinds('all'))
const empty = (status: SearchCenterProviderPage['status'], reason: string): SearchCenterProviderPage => ({ status, reason, results: [] })

/** Owner registry only; scheduling, debounce and presentation stay in the search coordinator. */
export class SearchCenterSourceRegistry {
  private readonly bindings = new Map<string, Binding>()
  private readonly listeners = new Set<() => void>()
  private readonly origins = new WeakMap<SearchCenterResult, { binding: Binding; revision: number; scope: SearchCenterScope }>()
  private snapshot: readonly SearchCenterSourceDescriptor[] = Object.freeze([])
  private disposed = false

  getSnapshot = (): readonly SearchCenterSourceDescriptor[] => this.snapshot
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }

  register(source: SearchCenterOwnerSource): () => void {
    const descriptor = source?.descriptor
    if (this.disposed) throw new Error('search_registry_disposed')
    if (!descriptor || typeof descriptor.id !== 'string' || typeof descriptor.owner !== 'string' || !idPattern.test(descriptor.id) || !idPattern.test(descriptor.owner)
      || typeof source.search !== 'function' || !Array.isArray(descriptor.resourceKinds) || descriptor.resourceKinds.length === 0
      || descriptor.resourceKinds.some(kind => !kinds.has(kind))
      || !Array.isArray(descriptor.scopes) || descriptor.scopes.length === 0 || descriptor.scopes.some(scope => !['profile', 'workspace', 'session'].includes(scope))
      || !Array.isArray(descriptor.sorts) || descriptor.sorts.length === 0 || descriptor.sorts.some(sort => !['relevance', 'name', 'updated'].includes(sort))
      || !Array.isArray(descriptor.filters) || descriptor.filters.some(filter => !idPattern.test(filter))
      || !['catalog', 'metadata', 'fulltext', 'unknown'].includes(descriptor.coverage)
      || typeof descriptor.pagination !== 'boolean' || typeof descriptor.preview !== 'boolean' || typeof descriptor.open !== 'boolean'
      || descriptor.preview || (descriptor.open && typeof source.open !== 'function')) throw new Error('search_source_contract_mismatch')
    const id = descriptor.id
    if (this.bindings.has(id)) throw new Error('search_source_duplicate')
    const binding: Binding = { source, revision: 0, reads: new Set(), descriptor: Object.freeze({ id: descriptor.id, owner: descriptor.owner, coverage: descriptor.coverage, pagination: descriptor.pagination, preview: false, open: descriptor.open,
      resourceKinds: Object.freeze([...descriptor.resourceKinds]), scopes: Object.freeze([...descriptor.scopes]),
      sorts: Object.freeze([...descriptor.sorts]), filters: Object.freeze([...descriptor.filters]),
    }) }
    this.bindings.set(id, binding)
    try {
      binding.unsubscribe = source.subscribe?.(() => {
        if (this.bindings.get(id) !== binding) return
        binding.revision += 1
        for (const read of binding.reads) read.abort()
        this.publish()
      })
    } catch {
      this.bindings.delete(id)
      this.publish()
      throw new Error('search_source_subscription_failed')
    }
    this.publish()
    return () => {
      if (this.bindings.get(id) !== binding) return
      this.bindings.delete(id)
      for (const read of binding.reads) read.abort()
      try { binding.unsubscribe?.() } finally { this.publish() }
    }
  }

  async query(id: string, request: SearchCenterSourceRequest, signal: AbortSignal): Promise<SearchCenterProviderPage> {
    const binding = this.bindings.get(id)
    if (!binding) return empty('disabled', 'source_missing')
    if (signal.aborted) return empty('disabled', 'query_aborted')
    const support = searchCenterRequestSupport(binding.descriptor, request)
    if (!support.supported) return empty('disabled', support.reason)
    const limit = request.limit ?? 20
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || request.kinds.length === 0 || typeof request.query !== 'string' || request.query.length > 4096
      || (request.scope.kind !== 'profile' && !bounded(request.scope.ref, 2048))) return empty('error', 'request_invalid')
    const revision = binding.revision
    const scope: SearchCenterScope = Object.freeze(request.scope.kind === 'profile' ? { kind: 'profile' } : { kind: request.scope.kind, ref: request.scope.ref })
    const ownerRequest = Object.freeze({ query: request.query, sort: request.sort, ...(request.cursor === undefined ? {} : { cursor: request.cursor }), limit, scope, kinds: Object.freeze([...request.kinds]), filters: Object.freeze({ ...request.filters }) })
    let page: SearchCenterOwnerPage
    const read = new AbortController()
    binding.reads.add(read)
    const cancel = () => read.abort()
    signal.addEventListener('abort', cancel, { once: true })
    let resolveAbort!: (page: SearchCenterOwnerPage) => void
    const cancelled = new Promise<SearchCenterOwnerPage>(resolve => { resolveAbort = resolve })
    const abortRead = () => resolveAbort({ status: 'disabled', resources: [] })
    read.signal.addEventListener('abort', abortRead, { once: true })
    try { page = await Promise.race([binding.source.search(ownerRequest, read.signal), cancelled]) }
    catch { return empty('error', 'source_query_failed') }
    finally {
      signal.removeEventListener('abort', cancel)
      read.signal.removeEventListener('abort', abortRead)
      binding.reads.delete(read)
    }
    if (signal.aborted) return empty('disabled', 'query_aborted')
    if (this.bindings.get(id) !== binding) return empty('disabled', 'source_removed')
    if (binding.revision !== revision) return empty('stale', 'source_changed')
    if (!page || !['ready', 'partial', 'offline', 'denied', 'disabled', 'error'].includes(page.status)) return empty('error', 'source_page_invalid')
    // Failure pages cannot leak titles, counts, cursors, or samples.
    if (page.status !== 'ready' && page.status !== 'partial') return empty(page.status, `source_${page.status}`)
    if (!Array.isArray(page.resources) || page.resources.length > limit
      || (page.nextCursor !== undefined && (!binding.descriptor.pagination || !bounded(page.nextCursor, 4096)))
      || (page.total !== undefined && (!Number.isSafeInteger(page.total) || page.total < page.resources.length))) return empty('error', 'source_page_invalid')
    const results: SearchCenterResult[] = []
    const seen = new Set<string>()
    for (const item of page.resources) {
      if (!item || item.owner !== binding.descriptor.owner || !request.kinds.includes(item.kind)
        || !bounded(item.ref, 2048) || !bounded(item.title, 512)
        || (item.revision !== undefined && !bounded(item.revision, 256))
        || (item.description !== undefined && (typeof item.description !== 'string' || item.description.length > 8192))
        || (item.projectRef !== undefined && !bounded(item.projectRef, 2048))
        || (item.sessionRef !== undefined && !bounded(item.sessionRef, 2048))
        || (item.status !== undefined && !bounded(item.status, 120))
        || (item.sourceLabel !== undefined && !bounded(item.sourceLabel, 200))
        || (item.availability !== undefined && !['available', 'disabled', 'unavailable'].includes(item.availability))
        || (scope.kind === 'workspace' && item.projectRef !== scope.ref)
        || (scope.kind === 'session' && item.sessionRef !== scope.ref)) return empty('error', 'source_resource_invalid')
      const resource: SearchCenterResource = Object.freeze({ owner: item.owner, ref: item.ref, kind: item.kind, title: item.title,
        ...(item.revision === undefined ? {} : { revision: item.revision }), ...(item.description === undefined ? {} : { description: item.description }),
        ...(item.projectRef === undefined ? {} : { projectRef: item.projectRef }), ...(item.sessionRef === undefined ? {} : { sessionRef: item.sessionRef }),
        ...(item.availability === undefined ? {} : { availability: item.availability }),
        ...(item.status === undefined ? {} : { status: item.status }), ...(item.sourceLabel === undefined ? {} : { sourceLabel: item.sourceLabel }),
      })
      const result = Object.freeze(sourceSearchCenterResult(binding.descriptor, resource))
      if (seen.has(result.stableKey)) continue
      seen.add(result.stableKey)
      this.origins.set(result, { binding, revision, scope })
      results.push(result)
    }
    return { status: page.status, results, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }), ...(page.total === undefined ? {} : { total: page.total }) }
  }

  async open(result: SearchCenterResult, signal?: AbortSignal): Promise<{ readonly status: 'opened' | 'denied' | 'unavailable' | 'unconfirmed' }> {
    const origin = this.origins.get(result)
    if (signal?.aborted || !origin || result.adapter !== 'source' || this.bindings.get(result.sourceId) !== origin.binding
      || origin.binding.revision !== origin.revision || !origin.binding.descriptor.open || !origin.binding.source.open
      || (result.resource.availability !== undefined && result.resource.availability !== 'available')) return { status: 'unavailable' }
    let onAbort: (() => void) | undefined
    try {
      const open = origin.binding.source.open
      const receipt = await new Promise<{ readonly status: 'opened' | 'denied' | 'unavailable' }>((resolve, reject) => {
        if (signal?.aborted) { resolve({ status: 'unavailable' }); return }
        onAbort = () => resolve({ status: 'unavailable' })
        signal?.addEventListener('abort', onAbort, { once: true })
        const operation = signal === undefined || origin.binding.source.cancellableOpen !== true ? open.call(origin.binding.source, result.resource, origin.scope) : open.call(origin.binding.source, result.resource, origin.scope, signal)
        Promise.resolve(operation).then(resolve, reject)
      })
      if (signal?.aborted || this.bindings.get(result.sourceId) !== origin.binding || origin.binding.revision !== origin.revision) return { status: 'unconfirmed' }
      return receipt && ['opened', 'denied', 'unavailable'].includes(receipt.status) ? { status: receipt.status } : { status: 'unconfirmed' }
    } catch { return { status: 'unconfirmed' } }
    finally { if (onAbort) signal?.removeEventListener('abort', onAbort) }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const bindings = [...this.bindings.values()]
    this.bindings.clear()
    for (const binding of bindings) {
      for (const read of binding.reads) read.abort()
      try { binding.unsubscribe?.() } catch { /* Release every owner subscription. */ }
    }
    this.publish()
    this.listeners.clear()
  }

  private publish(): void {
    this.snapshot = Object.freeze([...this.bindings.values()].map(binding => binding.descriptor))
    for (const listener of this.listeners) { try { listener() } catch { /* One consumer cannot block invalidation. */ } }
  }
}

const registries = new WeakMap<object, SearchCenterSourceRegistry>()
export function searchSourcesFor(controller: object): SearchCenterSourceRegistry {
  let registry = registries.get(controller)
  if (!registry) { registry = new SearchCenterSourceRegistry(); registries.set(controller, registry) }
  return registry
}
