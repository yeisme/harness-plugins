/**
 * Abortable, releasable preview access (V3 3.3). Official DSH
 * inspect/rendition seams stay disabled via probe. Access URL, object URL,
 * stream, and worker live only on the handle — never in Pane state.
 *
 * @module @yeisme/dsh-rich-media/preview
 */

import type {
  OfficialDshPreviewSeamProbeV1,
  PreviewAccessHandleV1,
  PreviewAccessSnapshotV1,
  PreviewByteRangeRequestV1,
  PreviewPlaybackSourceV1,
  PreviewReleaseReason,
  PreviewRenditionKind,
  PreviewRenditionRequestV1,
  PreviewResourceRefV1,
  PreviewResourceV1,
  PreviewTablePageRequestV1,
  PreviewTableColumnV1,
  PreviewTablePageV1,
  PreviewTextWindowRequestV1,
  PreviewTextWindowV1,
  ResourcePreviewHostV1,
} from './types.ts'
import { PREVIEW_RENDITIONS, previewCacheKey, previewResourceKey } from './types.ts'

export const TEXT_WINDOW_MAX = 64 * 1024
export const TABLE_PAGE_MAX = 200
export const BYTE_RANGE_MAX = 256 * 1024

export type PreviewAccessErrorCode =
  | 'aborted'
  | 'released'
  | 'fenced'
  | 'bounds'
  | 'unsupported'
  | 'official_seam_disabled'
  | 'offline'
  | 'mismatch'
  | 'expired'

export class PreviewAccessError extends Error {
  override readonly name = 'PreviewAccessError'
  constructor(readonly code: PreviewAccessErrorCode, message: string) {
    super(message)
  }
}

export const OFFICIAL_DSH_PREVIEW_SEAM_PROBE: OfficialDshPreviewSeamProbeV1 = Object.freeze({
  officialInspectEnabled: false,
  officialOpenRenditionEnabled: false,
  officialReadWindowEnabled: false,
  officialReadRangeEnabled: false,
  officialVersionSubscribeEnabled: false,
  officialReleaseEnabled: false,
  reason: 'seam-unpublished',
})

/** Official inspect/rendition/window/range stay off until task 7.2. */
export function probeOfficialDshPreviewSeam(_ctx?: unknown): OfficialDshPreviewSeamProbeV1 {
  return OFFICIAL_DSH_PREVIEW_SEAM_PROBE
}

export function isOfficialDshPreviewSeamEnabled(probe: OfficialDshPreviewSeamProbeV1 = OFFICIAL_DSH_PREVIEW_SEAM_PROBE): boolean {
  return probe.officialInspectEnabled
    || probe.officialOpenRenditionEnabled
    || probe.officialReadWindowEnabled
    || probe.officialReadRangeEnabled
    || probe.officialVersionSubscribeEnabled
    || probe.officialReleaseEnabled
}

export async function officialDshInspect(_ref?: PreviewResourceRefV1, _signal?: AbortSignal): Promise<never> {
  throw new PreviewAccessError('official_seam_disabled', 'official DSH inspect seam is unpublished')
}

export async function officialDshOpenRendition(_request?: PreviewRenditionRequestV1, _signal?: AbortSignal): Promise<never> {
  throw new PreviewAccessError('official_seam_disabled', 'official DSH openRendition seam is unpublished')
}

export function isPreviewAccessAbort(error: unknown): boolean {
  return error instanceof PreviewAccessError && error.code === 'aborted'
    || (error instanceof DOMException && error.name === 'AbortError')
    || (error instanceof Error && error.name === 'AbortError')
}

export function parsePreviewRendition(value: unknown): PreviewRenditionKind {
  if (typeof value === 'string' && (PREVIEW_RENDITIONS as readonly string[]).includes(value)) {
    return value as PreviewRenditionKind
  }
  throw new PreviewAccessError('unsupported', 'unknown preview rendition')
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new PreviewAccessError('aborted', 'preview access aborted')
}

function boundLength(requested: number, max: number): number {
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new PreviewAccessError('bounds', 'range length must be a positive finite number')
  }
  return Math.min(Math.floor(requested), max)
}

function boundOffset(offset: number): number {
  if (!Number.isFinite(offset) || offset < 0) {
    throw new PreviewAccessError('bounds', 'range offset must be a non-negative finite number')
  }
  return Math.floor(offset)
}

export interface PreviewOwnerSourceV1 {
  inspect?(ref: PreviewResourceRefV1, signal?: AbortSignal): Promise<PreviewResourceV1 | undefined>
  open?(request: PreviewRenditionRequestV1): Promise<PreviewAccessHandleInput | undefined>
  subscribeVersion?(ref: PreviewResourceRefV1, listener: (version: string) => void): () => void
}

export interface PreviewAccessHandleInput {
  resource: PreviewResourceV1
  rendition?: PreviewRenditionKind | undefined
  expiresAt?: string | undefined
  url?: string | undefined
  objectUrl?: string | undefined
  stream?: { cancel?(reason?: unknown): void | Promise<void> } | undefined
  worker?: { terminate(): void } | undefined
  capabilities?: readonly string[] | undefined
  text?: string | undefined
  table?: readonly (readonly string[])[] | undefined
  /** Optional additive column schema emitted with every table page. */
  columns?: readonly PreviewTableColumnV1[] | undefined
  bytes?: Uint8Array | undefined
  playback?: PreviewPlaybackSourceV1 | undefined
  onRelease?: ((reason: string) => void) | undefined
  signal?: AbortSignal | undefined
}

interface LiveHandle extends PreviewAccessHandleV1 {
  readonly cacheKey: string
  readonly byteSize: number
  readonly rendition: PreviewRenditionKind
}

function revokeObjectUrl(url: string | undefined): void {
  if (url === undefined || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return
  if (url.startsWith('blob:') || url.startsWith('filesystem:')) URL.revokeObjectURL(url)
}

/** Persistable handle facts. Strips URL/object URL/stream/worker. */
export function serializePreviewAccessForPane(handle: PreviewAccessHandleV1): PreviewAccessSnapshotV1 {
  return handle.getSnapshot()
}

export function createPreviewAccessHandle(input: PreviewAccessHandleInput): PreviewAccessHandleV1 {
  const rendition = input.rendition ?? 'original'
  parsePreviewRendition(rendition)
  const expiresAt = input.expiresAt ?? new Date(Date.now() + 60_000).toISOString()
  const capabilities = Object.freeze([...(input.capabilities ?? input.resource.capabilities)])
  const listeners = new Set<() => void>()
  let released = false
  let aborted = false
  const abortController = new AbortController()
  const parent = input.signal
  const onParentAbort = (): void => { abortHandle('abort') }
  parent?.addEventListener('abort', onParentAbort, { once: true })

  const notify = (): void => {
    for (const listener of [...listeners]) listener()
  }

  const snapshot = (): PreviewAccessSnapshotV1 => ({
    owner: input.resource.ref.owner,
    ref: input.resource.ref.ref,
    version: input.resource.ref.version,
    rendition,
    expiresAt,
    released,
    capabilities,
  })

  const assertUsable = (signal?: AbortSignal): void => {
    throwIfAborted(signal)
    if (released) throw new PreviewAccessError('released', 'preview access handle is released')
    if (aborted || abortController.signal.aborted || parent?.aborted) {
      throw new PreviewAccessError('aborted', 'preview access handle is aborted')
    }
    if (Date.parse(expiresAt) <= Date.now()) throw new PreviewAccessError('expired', 'preview access handle expired')
  }

  const disposeSecrets = (): void => {
    revokeObjectUrl(input.objectUrl)
    void input.stream?.cancel?.('released')
    input.worker?.terminate()
  }

  const releaseHandle = (reason: PreviewReleaseReason | string = 'close'): void => {
    if (released) return
    released = true
    parent?.removeEventListener('abort', onParentAbort)
    disposeSecrets()
    input.onRelease?.(String(reason))
    notify()
  }

  const abortHandle = (reason = 'abort'): void => {
    if (released || aborted) return
    aborted = true
    abortController.abort()
    releaseHandle(reason)
  }

  const handle: LiveHandle = {
    expiresAt,
    cacheKey: previewCacheKey(input.resource.ref, rendition),
    byteSize: input.bytes?.byteLength ?? input.text?.length ?? 0,
    rendition,
    release: releaseHandle,
    abort: abortHandle,
    getSnapshot: snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    async readTextWindow(request: PreviewTextWindowRequestV1, signal?: AbortSignal): Promise<PreviewTextWindowV1> {
      assertUsable(signal)
      if (input.text === undefined) throw new PreviewAccessError('unsupported', 'text window is not authorized')
      const offset = boundOffset(request.offset)
      const length = boundLength(request.length, TEXT_WINDOW_MAX)
      const text = input.text.slice(offset, offset + length)
      return {
        text,
        offset,
        loaded: text.length,
        total: input.text.length,
        truncated: offset + text.length < input.text.length,
      }
    },
    async readTablePage(request: PreviewTablePageRequestV1, signal?: AbortSignal): Promise<PreviewTablePageV1> {
      assertUsable(signal)
      if (input.table === undefined) throw new PreviewAccessError('unsupported', 'table page is not authorized')
      if (!Number.isFinite(request.page) || request.page < 1) {
        throw new PreviewAccessError('bounds', 'table page must be >= 1')
      }
      const pageSize = boundLength(request.pageSize, TABLE_PAGE_MAX)
      const start = (Math.floor(request.page) - 1) * pageSize
      const rows = input.table.slice(start, start + pageSize)
      return {
        rows,
        ...input.columns === undefined ? {} : { columns: input.columns },
        page: Math.floor(request.page),
        pageSize,
        loaded: rows.length,
        total: input.table.length,
        truncated: start + rows.length < input.table.length,
      }
    },
    async readByteRange(request: PreviewByteRangeRequestV1, signal?: AbortSignal): Promise<Uint8Array> {
      assertUsable(signal)
      if (input.bytes === undefined) throw new PreviewAccessError('unsupported', 'byte range is not authorized')
      const offset = boundOffset(request.offset)
      const length = boundLength(request.length, BYTE_RANGE_MAX)
      return input.bytes.slice(offset, offset + length)
    },
    async resolvePlaybackSource(signal?: AbortSignal): Promise<PreviewPlaybackSourceV1> {
      assertUsable(signal)
      if (input.playback !== undefined) return { kind: input.playback.kind, expiresAt: input.playback.expiresAt }
      if (input.objectUrl !== undefined) return { kind: 'object-url', expiresAt }
      if (input.stream !== undefined) return { kind: 'stream', expiresAt }
      if (input.url !== undefined) return { kind: 'url', expiresAt }
      throw new PreviewAccessError('unsupported', 'playback source is not authorized')
    },
  }

  Object.defineProperty(handle, 'url', {
    value: input.url ?? input.objectUrl,
    enumerable: false,
    configurable: true,
    writable: false,
  })

  return handle
}

export interface LocalResourcePreviewHostOptions {
  owner: string
  sessionId?: string | undefined
  providerId?: string | undefined
  source?: PreviewOwnerSourceV1 | undefined
}

/** Local owner host. Does not call official DSH inspect/rendition. */
export class LocalResourcePreviewHost implements ResourcePreviewHostV1 {
  readonly previewHostVersion = '0.1.0-rc.1' as const
  private readonly live = new Set<PreviewAccessHandleV1>()
  private fenced = false
  private sessionId: string
  private providerId: string | undefined

  constructor(private readonly options: LocalResourcePreviewHostOptions) {
    this.sessionId = options.sessionId ?? 'session'
    this.providerId = options.providerId
  }

  get fenceState(): { sessionId: string; providerId?: string; fenced: boolean } {
    return this.providerId === undefined
      ? { sessionId: this.sessionId, fenced: this.fenced }
      : { sessionId: this.sessionId, providerId: this.providerId, fenced: this.fenced }
  }

  liveHandleCount(): number { return this.live.size }

  private assertOwner(ref: PreviewResourceRefV1): void {
    if (this.fenced) throw new PreviewAccessError('fenced', 'preview host is fenced')
    if (ref.owner !== this.options.owner) {
      throw new PreviewAccessError('mismatch', 'preview ref is not owned by this host')
    }
  }

  private track(handle: PreviewAccessHandleV1): PreviewAccessHandleV1 {
    this.live.add(handle)
    handle.subscribe(() => {
      if (handle.getSnapshot().released) this.live.delete(handle)
    })
    return handle
  }

  async inspect(ref: PreviewResourceRefV1, signal?: AbortSignal): Promise<PreviewResourceV1> {
    throwIfAborted(signal)
    this.assertOwner(ref)
    const inspected = await this.options.source?.inspect?.(ref, signal)
    if (inspected === undefined) throw new PreviewAccessError('unsupported', 'owner inspect is unavailable')
    if (inspected.ref.owner !== this.options.owner || inspected.ref.ref !== ref.ref) {
      throw new PreviewAccessError('mismatch', 'inspect result does not match the requested ref')
    }
    return inspected
  }

  async resolveAccess(resource: PreviewResourceV1, signal?: AbortSignal): Promise<PreviewAccessHandleV1 | undefined> {
    return this.openRendition({ resource, rendition: 'original', signal }, signal)
  }

  async openRendition(request: PreviewRenditionRequestV1, signal?: AbortSignal): Promise<PreviewAccessHandleV1 | undefined> {
    const abort = request.signal ?? signal
    throwIfAborted(abort)
    this.assertOwner(request.resource.ref)
    const rendition = request.rendition ?? 'original'
    parsePreviewRendition(rendition)
    const opened = await this.options.source?.open?.({ ...request, rendition, signal: abort })
    if (opened === undefined) return undefined
    if (opened.resource.ref.owner !== this.options.owner) {
      throw new PreviewAccessError('mismatch', 'opened resource is not owned by this host')
    }
    throwIfAborted(abort)
    return this.track(createPreviewAccessHandle({ ...opened, rendition, signal: abort }))
  }

  subscribeVersion(ref: PreviewResourceRefV1, listener: (version: string) => void): () => void {
    this.assertOwner(ref)
    return this.options.source?.subscribeVersion?.(ref, listener) ?? (() => {})
  }

  fence(reason: 'session' | 'provider' | 'unload' = 'session'): void {
    this.fenced = true
    this.releaseAll(reason === 'provider' ? 'fence' : reason === 'unload' ? 'unload' : 'fence')
  }

  switchSession(sessionId: string): void {
    if (sessionId === this.sessionId && !this.fenced) return
    this.releaseAll('fence')
    this.sessionId = sessionId
    this.fenced = false
  }

  disposeProvider(providerId?: string): void {
    if (providerId !== undefined && this.providerId !== undefined && providerId !== this.providerId) return
    this.releaseAll('fence')
    this.fenced = true
  }

  releaseAll(reason: PreviewReleaseReason | string = 'unload'): void {
    for (const handle of [...this.live]) handle.release(reason)
    this.live.clear()
  }
}

export function previewResourceIdentity(resource: PreviewResourceV1): string {
  return `${previewResourceKey(resource.ref)}@${resource.ref.version}`
}

const ACCESS_SECRET_KEYS = new Set([
  'url', 'objectUrl', 'objectURL', 'stream', 'worker', 'href', 'src', 'blob', 'mediasource',
])

/** True when a persistable/Pane projection leaked an access secret. */
export function paneStateContainsAccessSecrets(state: unknown): boolean {
  const seen = new Set<unknown>()
  const walk = (value: unknown): boolean => {
    if (value === null || value === undefined) return false
    if (typeof value === 'string') {
      return /^(?:blob:|filesystem:|https?:\/\/|data:)/i.test(value) || value.includes('://')
    }
    if (typeof value !== 'object') return false
    if (seen.has(value)) return false
    seen.add(value)
    if (Array.isArray(value)) return value.some(walk)
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (ACCESS_SECRET_KEYS.has(key)) return true
      if (walk(nested)) return true
    }
    return false
  }
  return walk(state)
}
