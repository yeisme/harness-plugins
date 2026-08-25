/**
 * Visible preview state machine (V3 3.4): resolving/loading/ready/partial/
 * stale/unsupported/error/offline, version refresh/compare, and one live
 * access handle. Intentional abort never flashes error.
 *
 * @module @yeisme/dsh-rich-media/preview
 */

import { PreviewRendererRegistry } from './registry.ts'
import { PreviewRenditionCache } from './cache.ts'
import {
  isPreviewAccessAbort,
  LocalResourcePreviewHost,
  PreviewAccessError,
  serializePreviewAccessForPane,
} from './access.ts'
import type {
  PreviewAccessHandleV1,
  PreviewAccessSnapshotV1,
  PreviewRenditionKind,
  PreviewResourceV1,
  PreviewVisibleState,
  ResourcePreviewHostV1,
} from './types.ts'
import { previewCacheKey, previewResourceKey } from './types.ts'

export interface PreviewVisibleRecord {
  state: PreviewVisibleState
  cacheKey?: string | undefined
  resourceKey?: string | undefined
  version?: string | undefined
  rendition?: PreviewRenditionKind | undefined
  loaded?: number | undefined
  total?: number | undefined
  truncated?: boolean | undefined
  reason?: string | undefined
  compareVersion?: string | undefined
  keepOld?: boolean | undefined
}

export interface PreviewSessionOptions {
  host: ResourcePreviewHostV1
  cache?: PreviewRenditionCache | undefined
  registry?: PreviewRendererRegistry | undefined
}

export interface PreviewOpenOptions {
  rendition?: PreviewRenditionKind | undefined
  signal?: AbortSignal | undefined
}

const EMPTY: PreviewVisibleRecord = { state: 'resolving' }

function isOfflineError(error: unknown): boolean {
  return error instanceof PreviewAccessError && error.code === 'offline'
}

/** One live preview view: serial old-release then new-activate. */
export class PreviewSessionController {
  private readonly cache: PreviewRenditionCache
  private readonly registry: PreviewRendererRegistry | undefined
  private generation = 0
  private handle: PreviewAccessHandleV1 | undefined
  private record: PreviewVisibleRecord = { ...EMPTY }
  private resource: PreviewResourceV1 | undefined
  private versionUnsub: (() => void) | undefined

  constructor(private readonly options: PreviewSessionOptions) {
    this.cache = options.cache ?? new PreviewRenditionCache()
    this.registry = options.registry
  }

  get state(): PreviewVisibleState { return this.record.state }
  get visible(): PreviewVisibleRecord { return { ...this.record } }
  liveHandle(): PreviewAccessHandleV1 | undefined { return this.handle }

  /** Persistable view facts. Never includes URL/object URL/stream/worker. */
  paneProjection(): PreviewVisibleRecord & { access?: PreviewAccessSnapshotV1 } {
    const access = this.handle === undefined ? undefined : serializePreviewAccessForPane(this.handle)
    return access === undefined ? { ...this.record } : { ...this.record, access }
  }

  async open(resource: PreviewResourceV1, options: PreviewOpenOptions = {}): Promise<PreviewVisibleRecord> {
    return this.activate(resource, options, { replace: true })
  }

  async switchTo(resource: PreviewResourceV1, options: PreviewOpenOptions = {}): Promise<PreviewVisibleRecord> {
    return this.activate(resource, options, { replace: true })
  }

  async refresh(signal?: AbortSignal): Promise<PreviewVisibleRecord> {
    if (this.resource === undefined) return this.commit({ state: 'unsupported', reason: 'no-resource' })
    const rendition = this.record.rendition
    return this.activate(this.resource, { rendition, signal }, { replace: true, refresh: true })
  }

  async compare(resource: PreviewResourceV1, options: PreviewOpenOptions = {}): Promise<PreviewVisibleRecord> {
    const previous = this.record.version
    return this.activate(resource, options, { replace: false, compareVersion: previous })
  }

  markStale(version?: string): PreviewVisibleRecord {
    if (this.record.state !== 'ready' && this.record.state !== 'partial') return this.visible
    return this.commit({
      ...this.record,
      state: 'stale',
      ...(version === undefined ? {} : { reason: `updated:${version}` }),
    })
  }

  markOffline(reason = 'offline'): PreviewVisibleRecord {
    return this.commit({ ...this.record, state: 'offline', reason })
  }

  abort(reason = 'abort'): PreviewVisibleRecord {
    this.generation += 1
    if (this.record.cacheKey !== undefined) this.cache.delete(this.record.cacheKey, reason)
    this.handle?.abort?.(reason)
    this.handle?.release(reason)
    this.handle = undefined
    const state = this.record.state === 'error' || this.record.state === 'resolving'
      ? (this.resource === undefined ? 'resolving' : 'loading')
      : this.record.state
    return this.commit({ ...this.record, state, reason })
  }

  close(): PreviewVisibleRecord { return this.teardown('close') }
  evict(): PreviewVisibleRecord { return this.teardown('evict') }
  unload(): PreviewVisibleRecord { return this.teardown('unload') }

  private teardown(reason: 'close' | 'evict' | 'unload'): PreviewVisibleRecord {
    this.generation += 1
    this.versionUnsub?.()
    this.versionUnsub = undefined
    this.releaseLive(reason)
    if (this.record.cacheKey !== undefined) this.cache.delete(this.record.cacheKey, reason)
    this.resource = undefined
    return this.commit({ state: 'resolving', reason })
  }

  private releaseLive(reason: string): void {
    this.handle?.release(reason)
    this.handle = undefined
  }

  private commit(record: PreviewVisibleRecord): PreviewVisibleRecord {
    this.record = { ...record }
    return this.visible
  }

  private async activate(
    resource: PreviewResourceV1,
    options: PreviewOpenOptions,
    mode: { replace: boolean; refresh?: boolean; compareVersion?: string },
  ): Promise<PreviewVisibleRecord> {
    const gen = ++this.generation
    const rendition = options.rendition ?? 'original'
    const cacheKey = previewCacheKey(resource.ref, rendition)
    this.resource = resource
    this.bindVersion(resource)
    const previous = this.handle
    this.handle = undefined
    if (previous !== undefined) {
      const previousSnap = previous.getSnapshot()
      const previousKey = previewCacheKey(
        { owner: previousSnap.owner, ref: previousSnap.ref, version: previousSnap.version },
        previousSnap.rendition,
      )
      this.cache.unpin(previousKey)
      if (mode.replace) {
        if (!this.cache.delete(previousKey, 'switch')) previous.release('switch')
      } else {
        this.cache.set(previous)
      }
    }
    this.commit({
      state: 'resolving',
      cacheKey,
      resourceKey: previewResourceKey(resource.ref),
      version: resource.ref.version,
      rendition,
      ...(mode.compareVersion === undefined ? {} : { compareVersion: mode.compareVersion, keepOld: true }),
    })

    if (this.registry !== undefined && this.registry.resolve({ mediaType: resource.mediaType, family: resource.family }) === undefined) {
      return this.commit({ ...this.record, state: 'unsupported', reason: 'no-renderer' })
    }

    if (this.generation !== gen) return this.visible
    this.commit({ ...this.record, state: 'loading' })

    try {
      const handle = await this.options.host.resolveAccess(resource, options.signal)
      if (this.generation !== gen || options.signal?.aborted) {
        handle?.release('abort')
        return this.visible.state === 'error' ? this.commit({ ...this.visible, state: 'loading', reason: 'abort' }) : this.visible
      }
      if (handle === undefined) {
        return this.commit({ ...this.record, state: 'unsupported', reason: 'no-access' })
      }
      this.handle = handle
      this.cache.set(handle)
      this.cache.pin(cacheKey)
      const snapshot = handle.getSnapshot()
      let truncated = false
      let loaded: number | undefined
      let total: number | undefined
      if (handle.readTextWindow !== undefined) {
        const window = await handle.readTextWindow({ offset: 0, length: 4096 }, options.signal)
        truncated = window.truncated
        loaded = window.loaded
        total = window.total
      }
      if (this.generation !== gen) return this.visible
      return this.commit({
        ...this.record,
        state: truncated ? 'partial' : 'ready',
        version: snapshot.version,
        rendition: snapshot.rendition,
        cacheKey,
        ...(loaded === undefined ? {} : { loaded }),
        ...(total === undefined ? {} : { total }),
        ...(truncated ? { truncated: true } : {}),
      })
    } catch (error) {
      if (this.generation !== gen || isPreviewAccessAbort(error) || options.signal?.aborted) {
        return this.visible.state === 'error'
          ? this.commit({ ...this.visible, state: 'loading', reason: 'abort' })
          : this.visible
      }
      if (isOfflineError(error)) return this.commit({ ...this.record, state: 'offline', reason: 'offline' })
      const reason = error instanceof Error ? error.message : 'preview failed'
      return this.commit({ ...this.record, state: 'error', reason })
    }
  }

  private bindVersion(resource: PreviewResourceV1): void {
    this.versionUnsub?.()
    this.versionUnsub = this.options.host.subscribeVersion?.(resource.ref, version => {
      if (version !== resource.ref.version) this.markStale(version)
    })
  }
}

export function createPreviewSession(host: ResourcePreviewHostV1, cache?: PreviewRenditionCache): PreviewSessionController {
  return new PreviewSessionController({ host, cache })
}

export function createLocalPreviewSession(owner: string, source?: ConstructorParameters<typeof LocalResourcePreviewHost>[0]['source']): PreviewSessionController {
  return new PreviewSessionController({ host: new LocalResourcePreviewHost({ owner, source }) })
}
