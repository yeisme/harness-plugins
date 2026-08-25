/**
 * Count + byte bounded in-memory LRU for authorized preview renditions
 * (V3 3.4). Keys are owner/ref/version/rendition. Content never writes to
 * localStorage or IndexedDB.
 *
 * @module @yeisme/dsh-rich-media/preview
 */

import type { PreviewAccessHandleV1, PreviewRenditionKind, PreviewResourceRefV1 } from './types.ts'
import { previewCacheKey } from './types.ts'

export const PREVIEW_CACHE_DEFAULT_MAX_ENTRIES = 8
export const PREVIEW_CACHE_DEFAULT_MAX_BYTES = 4 * 1024 * 1024

export interface PreviewCacheEntry {
  readonly cacheKey: string
  readonly bytes: number
  readonly handle: PreviewAccessHandleV1
}

export interface PreviewRenditionCacheOptions {
  maxEntries?: number | undefined
  maxBytes?: number | undefined
}

export interface PreviewCacheSize {
  count: number
  bytes: number
}

function entryBytes(handle: PreviewAccessHandleV1, explicit?: number): number {
  if (explicit !== undefined && Number.isFinite(explicit) && explicit >= 0) return explicit
  const sized = handle as PreviewAccessHandleV1 & { byteSize?: number }
  return typeof sized.byteSize === 'number' && Number.isFinite(sized.byteSize) ? sized.byteSize : 0
}

/** In-memory LRU. Eviction always releases the access handle. */
export class PreviewRenditionCache {
  private readonly maxEntries: number
  private readonly maxBytes: number
  private readonly entries = new Map<string, PreviewCacheEntry>()
  private readonly pinned = new Set<string>()
  private bytes = 0

  constructor(options: PreviewRenditionCacheOptions = {}) {
    this.maxEntries = Math.max(1, options.maxEntries ?? PREVIEW_CACHE_DEFAULT_MAX_ENTRIES)
    this.maxBytes = Math.max(1, options.maxBytes ?? PREVIEW_CACHE_DEFAULT_MAX_BYTES)
  }

  key(ref: PreviewResourceRefV1, rendition: PreviewRenditionKind = 'original'): string {
    return previewCacheKey(ref, rendition)
  }

  size(): PreviewCacheSize {
    return { count: this.entries.size, bytes: this.bytes }
  }

  has(cacheKey: string): boolean { return this.entries.has(cacheKey) }
  pin(cacheKey: string): void { this.pinned.add(cacheKey) }
  unpin(cacheKey: string): void { this.pinned.delete(cacheKey) }

  get(cacheKey: string): PreviewCacheEntry | undefined {
    const entry = this.entries.get(cacheKey)
    if (entry === undefined) return undefined
    this.entries.delete(cacheKey)
    this.entries.set(cacheKey, entry)
    return entry
  }

  set(handle: PreviewAccessHandleV1, bytes?: number): PreviewCacheEntry {
    const snapshot = handle.getSnapshot()
    const cacheKey = previewCacheKey(
      { owner: snapshot.owner, ref: snapshot.ref, version: snapshot.version },
      snapshot.rendition,
    )
    const existing = this.entries.get(cacheKey)
    if (existing?.handle === handle) {
      this.entries.delete(cacheKey)
      this.entries.set(cacheKey, existing)
      return existing
    }
    if (existing !== undefined) this.delete(cacheKey, 'replace')
    const entry: PreviewCacheEntry = { cacheKey, bytes: entryBytes(handle, bytes), handle }
    this.entries.set(cacheKey, entry)
    this.bytes += entry.bytes
    this.evictOverflow()
    return entry
  }

  delete(cacheKey: string, reason: string = 'evict'): boolean {
    const entry = this.entries.get(cacheKey)
    if (entry === undefined) return false
    this.entries.delete(cacheKey)
    this.pinned.delete(cacheKey)
    this.bytes = Math.max(0, this.bytes - entry.bytes)
    entry.handle.release(reason)
    return true
  }

  clear(reason: string = 'fence'): void {
    for (const key of [...this.entries.keys()]) this.delete(key, reason)
  }

  private evictOverflow(): void {
    for (const [key, entry] of this.entries) {
      if (this.entries.size <= this.maxEntries && this.bytes <= this.maxBytes) return
      if (this.pinned.has(key) || this.entries.size === 1) continue
      this.entries.delete(key)
      this.bytes = Math.max(0, this.bytes - entry.bytes)
      entry.handle.release('evict')
    }
  }
}

/** Persistence projection: identity only, never content or access sources. */
export function previewCachePersistenceProjection(cache: PreviewRenditionCache): readonly string[] {
  return []
}

export function previewStorageTargets(): readonly string[] {
  return []
}
