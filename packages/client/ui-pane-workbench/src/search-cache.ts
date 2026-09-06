import type { WorkspaceSearchCandidateV1 } from './search-identity.js'

export const WORKSPACE_SEARCH_CACHE_PAGE_LIMIT = 32
export const WORKSPACE_SEARCH_CACHE_ITEM_LIMIT = 1_000
export const WORKSPACE_SEARCH_CACHE_TTL_MS = 30_000
export const WORKSPACE_SEARCH_CACHE_STALE_MS = 5 * 60_000

export interface WorkspaceSearchCacheKeyV1 {
  readonly profileRef: string
  readonly permissionGeneration?: string
  readonly projectScope: string
  readonly query: string
  readonly category: string
  readonly filters: string
  readonly sort: string
  readonly locale: string
  readonly cursor: string
}

export interface WorkspaceSearchCachePageV1 {
  readonly items: readonly WorkspaceSearchCandidateV1[]
  readonly nextCursor?: string
  readonly storedAt: number
  readonly key: string
}

export function serializeWorkspaceSearchCacheKey(key: WorkspaceSearchCacheKeyV1): string {
  return [
    key.profileRef,
    key.permissionGeneration ?? 'open-cycle',
    key.projectScope,
    key.query,
    key.category,
    key.filters,
    key.sort,
    key.locale,
    key.cursor,
  ].join('\u001f')
}

export class WorkspaceSearchResultCache {
  private readonly pages = new Map<string, WorkspaceSearchCachePageV1>()
  private readonly order: string[] = []
  private itemCount = 0

  get(key: WorkspaceSearchCacheKeyV1, now: number): WorkspaceSearchCachePageV1 | undefined {
    const serialized = serializeWorkspaceSearchCacheKey(key)
    const page = this.pages.get(serialized)
    if (page === undefined) return undefined
    if (now - page.storedAt > WORKSPACE_SEARCH_CACHE_STALE_MS) {
      this.delete(serialized)
      return undefined
    }
    this.touch(serialized)
    return page
  }

  isFresh(page: WorkspaceSearchCachePageV1, now: number): boolean {
    return now - page.storedAt <= WORKSPACE_SEARCH_CACHE_TTL_MS
  }

  set(key: WorkspaceSearchCacheKeyV1, items: readonly WorkspaceSearchCandidateV1[], now: number, nextCursor?: string): void {
    const serialized = serializeWorkspaceSearchCacheKey(key)
    const previous = this.pages.get(serialized)
    if (previous !== undefined) this.itemCount -= previous.items.length
    const page: WorkspaceSearchCachePageV1 = {
      items: items.slice(0, WORKSPACE_SEARCH_CACHE_ITEM_LIMIT),
      storedAt: now,
      key: serialized,
      ...(nextCursor === undefined ? {} : { nextCursor }),
    }
    this.pages.set(serialized, page)
    this.itemCount += page.items.length
    this.touch(serialized)
    this.evict()
  }

  clearScope(matcher: (key: string) => boolean): void {
    for (const key of [...this.pages.keys()]) {
      if (matcher(key)) this.delete(key)
    }
  }

  clear(): void {
    this.pages.clear()
    this.order.length = 0
    this.itemCount = 0
  }

  get size(): number {
    return this.pages.size
  }

  private touch(key: string): void {
    const index = this.order.indexOf(key)
    if (index >= 0) this.order.splice(index, 1)
    this.order.push(key)
  }

  private delete(key: string): void {
    const page = this.pages.get(key)
    if (page === undefined) return
    this.pages.delete(key)
    this.itemCount -= page.items.length
    const index = this.order.indexOf(key)
    if (index >= 0) this.order.splice(index, 1)
  }

  private evict(): void {
    while (this.pages.size > WORKSPACE_SEARCH_CACHE_PAGE_LIMIT || this.itemCount > WORKSPACE_SEARCH_CACHE_ITEM_LIMIT) {
      const oldest = this.order[0]
      if (oldest === undefined) break
      this.delete(oldest)
    }
  }
}
