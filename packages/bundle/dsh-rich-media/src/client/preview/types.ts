/**
 * Resource Preview platform contracts (V3 differentiation lane, media path).
 *
 * These types are intentionally dependency-free and headless. A
 * `PreviewResourceV1` is a safe projection: it carries an opaque owner-issued
 * ref, never a path, URL, header, credential, or body. Byte access always
 * flows through an owner-provided `ResourcePreviewHostV1` that returns a
 * short-lived access handle.
 *
 * @module @yeisme/dsh-rich-media/preview
 */

/** Preview families resolved deterministically from mediaType/kind. */
export const PREVIEW_FAMILIES = ['image', 'audio', 'video', 'pdf', 'text', 'table', 'binary'] as const
export type PreviewFamily = (typeof PREVIEW_FAMILIES)[number]

/** Source projection kinds that may enter the preview platform. */
export const PREVIEW_SOURCE_KINDS = ['media', 'file', 'attachment', 'artifact'] as const
export type PreviewSourceKind = (typeof PREVIEW_SOURCE_KINDS)[number]

/** Opaque owner-issued resource reference; only the issuing owner resolves it. */
export interface PreviewResourceRefV1 {
  /** Canonical owner identifier, e.g. `dsh`, `eikona`, `sonora`. */
  owner: string
  /** Opaque storage identifier. Never a path, URL, or credential. */
  ref: string
  /** Owner-side version for optimistic concurrency and freshness. */
  version: string
}

/** Safe preview projection for one resource. */
export interface PreviewResourceV1 {
  /** Stable key: `owner:ref`. */
  key: string
  /** Which owner projection this resource came from. */
  sourceKind: PreviewSourceKind
  /** Opaque reference; resolution stays with the issuing owner host. */
  ref: PreviewResourceRefV1
  /** Safe display title. */
  title: string
  /** MIME type from the owning storage/adapter. */
  mediaType: string
  /** Deterministically resolved preview family. */
  family: PreviewFamily
  size?: number
  width?: number
  height?: number
  /** Duration in milliseconds for audio/video. */
  duration?: number
  /** Bounded safe summary. */
  summary?: string
  /** Owner-authorized capability tokens. */
  capabilities: readonly string[]
}

/** Short-lived byte access granted by the owner host for one resource. */
export interface PreviewAccessHandleV1 {
  /** Owner-authorized short-lived URL. Never constructed by the browser. */
  url: string
  /** ISO timestamp after which the handle must be re-resolved. */
  expiresAt: string
  /** Releases the handle; idempotent. */
  release(): void
}

/** Owner-side access resolver. Deny-by-default: undefined means no preview. */
export interface ResourcePreviewHostV1 {
  readonly previewHostVersion: '0.1.0-rc.1'
  resolveAccess(resource: PreviewResourceV1): Promise<PreviewAccessHandleV1 | undefined>
}

/** Typed cross-module intent emitted by preview surfaces. */
export interface PreviewIntentV1 {
  kind: 'open' | 'compare' | 'download' | 'attach'
  resourceKeys: readonly string[]
}

export interface PreviewRendererProps {
  resource: PreviewResourceV1
  /** Absent until the owner host grants access. */
  access: PreviewAccessHandleV1 | undefined
  labels?: Record<string, string> | undefined
  onIntent?: ((intent: PreviewIntentV1) => void) | undefined
}

export type PreviewRendererComponentType = (props: PreviewRendererProps) => unknown
/** Lazy boundary: heavy renderers load behind this loader, never statically. */
export type PreviewRendererLoader = () => Promise<PreviewRendererComponentType>

/** Renderer registration descriptor. `id` is a namespaced plain string — the
 * projection surface never registers code or package names as behavior. */
export interface PreviewRendererDescriptorV1 {
  id: string
  families: readonly PreviewFamily[]
  /** Exact MIME types this renderer prefers, e.g. `image/svg+xml`. */
  mediaTypes?: readonly string[] | undefined
  /** Higher wins within the same resolution stage. */
  priority?: number | undefined
  load: PreviewRendererLoader
}

/** Keys a preview projection must never carry. */
export const FORBIDDEN_RESOURCE_KEYS = [
  'path', 'url', 'headers', 'header', 'token', 'cookie', 'credential', 'credentials',
  'body', 'content', 'password', 'secret', 'bearer',
] as const

const OWNER_MAX = 64
const REF_MAX = 256
const TITLE_MAX = 200
const SUMMARY_MAX = 500

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

function isCleanString(value: unknown, max: number): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value)
}

/** Parse and validate one preview resource projection. */
export function parsePreviewResource(input: unknown): ParseResult<PreviewResourceV1> {
  if (typeof input !== 'object' || input === null) return { ok: false, error: 'resource must be an object' }
  const record = input as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if ((FORBIDDEN_RESOURCE_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: `forbidden field on preview resource: ${key}` }
    }
  }
  const ref = record.ref
  if (typeof ref !== 'object' || ref === null) return { ok: false, error: 'ref must be an object' }
  const { owner, ref: opaqueRef, version } = ref as Record<string, unknown>
  if (!isCleanString(owner, OWNER_MAX) || /[\\/]/.test(owner as string)) return { ok: false, error: 'ref.owner must be a clean string without path separators' }
  if (!isCleanString(opaqueRef, REF_MAX) || /[\\/]|:\/\//.test(opaqueRef as string)) return { ok: false, error: 'ref.ref must be a clean opaque string without path separators or URLs' }
  if (typeof version !== 'string' || version.length === 0 || version.length > 64) return { ok: false, error: 'ref.version must be a short token' }
  if (!(PREVIEW_SOURCE_KINDS as readonly string[]).includes(record.sourceKind as string)) return { ok: false, error: 'sourceKind must be one of the preview source kinds' }
  if (!(PREVIEW_FAMILIES as readonly string[]).includes(record.family as string)) return { ok: false, error: 'family must be one of the preview families' }
  if (!isCleanString(record.title, TITLE_MAX)) return { ok: false, error: 'title must be a clean bounded string' }
  if (typeof record.mediaType !== 'string' || !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(record.mediaType)) return { ok: false, error: 'mediaType must be a valid MIME type' }
  if (record.summary !== undefined && !isCleanString(record.summary, SUMMARY_MAX)) return { ok: false, error: 'summary must be a clean bounded string' }
  for (const numeric of ['size', 'width', 'height', 'duration'] as const) {
    const value = record[numeric]
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
      return { ok: false, error: `${numeric} must be a non-negative finite number` }
    }
  }
  if (!Array.isArray(record.capabilities) || record.capabilities.some(c => typeof c !== 'string')) {
    return { ok: false, error: 'capabilities must be an array of strings' }
  }
  const value: PreviewResourceV1 = {
    key: `${owner}:${opaqueRef}`,
    sourceKind: record.sourceKind as PreviewSourceKind,
    ref: { owner: owner as string, ref: opaqueRef as string, version: version as string },
    title: record.title as string,
    mediaType: record.mediaType as string,
    family: record.family as PreviewFamily,
    ...record.size === undefined ? {} : { size: record.size as number },
    ...record.width === undefined ? {} : { width: record.width as number },
    ...record.height === undefined ? {} : { height: record.height as number },
    ...record.duration === undefined ? {} : { duration: record.duration as number },
    ...record.summary === undefined ? {} : { summary: record.summary as string },
    capabilities: [...record.capabilities as string[]],
  }
  return { ok: true, value }
}

/** Stable resource key from a ref. */
export function previewResourceKey(ref: PreviewResourceRefV1): string {
  return `${ref.owner}:${ref.ref}`
}
