/**
 * DSH Rich Media wire contract.
 *
 * This module is intentionally dependency-free and headless. It defines the
 * safe `MediaRefV1` envelope that Host adapters may pass to browser clients.
 * A `MediaRefV1` never carries raw filesystem paths, bearer URLs, credentials,
 * provider payloads, or unbounded user text.
 *
 * @module @yeisme/dsh-rich-media/types
 */

export const MEDIA_KINDS = ['image', 'audio', 'video', 'pdf', 'document', 'text', 'file'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

export const MEDIA_CAPABILITIES = ['play', 'download', 'extract_text', 'open', 'preview'] as const
export type MediaCapability = (typeof MEDIA_CAPABILITIES)[number]

export interface MediaRefV1 {
  /** Canonical owner identifier, for example `dsh`, `eikona`, `sonora`, or `anatomia`. */
  owner: string
  /** Display category. The actual capability is decided by mediaType plus owner. */
  kind: MediaKind
  /** Opaque storage identifier. Never a filesystem path or raw URL. */
  ref: string
  /** Owner-side version string used for optimistic concurrency and freshness checks. */
  version: string
  /** MIME type from the owning storage/adapter. */
  mediaType: string
  /** Encoded byte size when known. */
  size?: number
  /** Intrinsic width in pixels for raster images/video. */
  width?: number
  /** Intrinsic height in pixels for raster images/video. */
  height?: number
  /** Duration in milliseconds for audio/video. */
  duration?: number
  /** Optional poster image for audio/video cards. */
  poster?: MediaRefV1
  /** Safe display title. Must not contain credentials or private paths. */
  title: string
  /** Bounded safe summary shown in list/compact contexts. */
  summary?: string
  /** Owner-authorized capabilities; unknown capabilities fail validation. */
  capabilities: readonly MediaCapability[]
}

export interface MediaResolveUrl {
  /** Short-lived browser URL authorized by the Host for one media ref. */
  url: string
  /** ISO timestamp after which the URL must be re-resolved. */
  expiresAt: string
}

export type MediaRefValidation =
  | { ok: true; value: MediaRefV1 }
  | { ok: false; error: string }

const OWNER_MAX = 64
const REF_MAX = 512
const TITLE_MAX = 200
const SUMMARY_MAX = 500
const MEDIA_TYPE_RE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i
const VERSION_RE = /^[A-Za-z0-9._~-]{1,128}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function hasNoUnsafeChars(value: string): boolean {
  return !/[\u0000-\u001f\u007f\r\n]/.test(value)
}

function validatePoster(poster: unknown): string | undefined {
  if (poster === undefined) return undefined
  const result = validateMediaRefV1(poster)
  if (!result.ok) return `poster.${result.error}`
  if (result.value.kind !== 'image') return 'poster.kind must be image'
  return undefined
}

/** Validate a wire value as a safe `MediaRefV1`. */
export function validateMediaRefV1(value: unknown): MediaRefValidation {
  if (!isRecord(value)) return { ok: false, error: 'value must be an object' }
  const { owner, kind, ref, version, mediaType, size, width, height, duration, poster, title, summary, capabilities } = value

  if (typeof owner !== 'string' || owner.length === 0 || owner.length > OWNER_MAX || !hasNoUnsafeChars(owner)) {
    return { ok: false, error: `owner must be a clean string of 1..${OWNER_MAX} characters` }
  }
  if (typeof kind !== 'string' || !(MEDIA_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, error: `kind must be one of: ${MEDIA_KINDS.join(', ')}` }
  }
  if (typeof ref !== 'string' || ref.length === 0 || ref.length > REF_MAX || !hasNoUnsafeChars(ref) || /[\\/]/.test(ref)) {
    return { ok: false, error: `ref must be a clean opaque string of 1..${REF_MAX} characters without path separators` }
  }
  if (typeof version !== 'string' || !VERSION_RE.test(version)) {
    return { ok: false, error: 'version must match a short safe version token' }
  }
  if (typeof mediaType !== 'string' || !MEDIA_TYPE_RE.test(mediaType)) {
    return { ok: false, error: 'mediaType must be a valid MIME type' }
  }
  if (size !== undefined && (!isFiniteNumber(size) || size < 0)) {
    return { ok: false, error: 'size must be a non-negative finite number' }
  }
  if (width !== undefined && (!isFiniteNumber(width) || width <= 0)) {
    return { ok: false, error: 'width must be a positive finite number' }
  }
  if (height !== undefined && (!isFiniteNumber(height) || height <= 0)) {
    return { ok: false, error: 'height must be a positive finite number' }
  }
  if (duration !== undefined && (!isFiniteNumber(duration) || duration < 0)) {
    return { ok: false, error: 'duration must be a non-negative finite number' }
  }
  if (typeof title !== 'string' || title.length === 0 || title.length > TITLE_MAX || !hasNoUnsafeChars(title)) {
    return { ok: false, error: `title must be a clean string of 1..${TITLE_MAX} characters` }
  }
  if (summary !== undefined && (typeof summary !== 'string' || summary.length > SUMMARY_MAX || !hasNoUnsafeChars(summary))) {
    return { ok: false, error: `summary must be a clean string up to ${SUMMARY_MAX} characters` }
  }
  if (!isStringArray(capabilities) || capabilities.some(capability => !(MEDIA_CAPABILITIES as readonly string[]).includes(capability))) {
    return { ok: false, error: `capabilities must be a subset of: ${MEDIA_CAPABILITIES.join(', ')}` }
  }
  const posterError = validatePoster(poster)
  if (posterError !== undefined) return { ok: false, error: posterError }

  const result: MediaRefV1 = {
    owner,
    kind: kind as MediaKind,
    ref,
    version,
    mediaType,
    ...size === undefined ? {} : { size },
    ...width === undefined ? {} : { width },
    ...height === undefined ? {} : { height },
    ...duration === undefined ? {} : { duration },
    ...poster === undefined ? {} : { poster: poster as MediaRefV1 },
    title,
    ...summary === undefined ? {} : { summary },
    capabilities: [...capabilities] as MediaRefV1['capabilities'],
  }
  return { ok: true, value: result }
}

/** Type guard built on the same validation. */
export function isMediaRefV1(value: unknown): value is MediaRefV1 {
  return validateMediaRefV1(value).ok
}
