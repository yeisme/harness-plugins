/**
 * File/Document module wire contract.
 *
 * These types are safe projections only. They never carry raw filesystem
 * paths, bearer URLs, credentials, or unbounded text.
 *
 * @module @yeisme/dsh-file-document/types
 */

export const FILE_ENTRY_KINDS = ['file', 'directory', 'document', 'pdf', 'text', 'image', 'archive', 'binary'] as const
export type FileEntryKind = (typeof FILE_ENTRY_KINDS)[number]

export interface FileEntryV1 {
  /** Stable opaque id, never a filesystem path. */
  id: string
  /** Optional opaque parent directory id; absent entries are roots. */
  parentId?: string
  /** Display name without path components. */
  name: string
  kind: FileEntryKind
  /** MIME type when known. */
  mediaType?: string
  /** Encoded byte size when known. */
  size?: number
  /** Optional safe summary. */
  summary?: string
  /** Capability flags: preview/open/download. */
  capabilities: readonly ('preview' | 'open' | 'download')[]
}

export type FileEntryValidation =
  | { ok: true; value: FileEntryV1 }
  | { ok: false; error: string }

const ID_RE = /^[A-Za-z0-9._~-]{1,128}$/
const NAME_MAX = 200
const SUMMARY_MAX = 300

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

/** Validate a safe file entry projection. */
export function validateFileEntry(value: unknown): FileEntryValidation {
  if (!isRecord(value)) return { ok: false, error: 'entry must be an object' }
  const { id, parentId, name, kind, mediaType, size, summary, capabilities } = value
  if (typeof id !== 'string' || !ID_RE.test(id)) return { ok: false, error: `id invalid: ${String(id)}` }
  if (parentId !== undefined && (typeof parentId !== 'string' || !ID_RE.test(parentId) || parentId === id)) {
    return { ok: false, error: `parentId invalid for ${String(id)}` }
  }
  if (typeof name !== 'string' || name.length === 0 || name.length > NAME_MAX || /[\\/\r\n]/.test(name)) {
    return { ok: false, error: `name invalid: ${String(name)}` }
  }
  if (typeof kind !== 'string' || !(FILE_ENTRY_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, error: `kind invalid: ${String(kind)}` }
  }
  if (mediaType !== undefined && (typeof mediaType !== 'string' || mediaType.length > 120)) {
    return { ok: false, error: `mediaType invalid for ${String(id)}` }
  }
  if (size !== undefined && (typeof size !== 'number' || !Number.isFinite(size) || size < 0)) {
    return { ok: false, error: `size invalid for ${String(id)}` }
  }
  if (summary !== undefined && (typeof summary !== 'string' || summary.length > SUMMARY_MAX)) {
    return { ok: false, error: `summary invalid for ${String(id)}` }
  }
  if (!isStringArray(capabilities) || capabilities.some(capability => !['preview', 'open', 'download'].includes(capability))) {
    return { ok: false, error: `capabilities invalid for ${String(id)}` }
  }
  const result: FileEntryV1 = {
    id,
    ...parentId === undefined ? {} : { parentId },
    name,
    kind: kind as FileEntryKind,
    ...mediaType === undefined ? {} : { mediaType },
    ...size === undefined ? {} : { size },
    ...summary === undefined ? {} : { summary },
    capabilities: [...capabilities] as FileEntryV1['capabilities'],
  }
  return { ok: true, value: result }
}

/** Type guard built on the same validation. */
export function isFileEntry(value: unknown): value is FileEntryV1 {
  return validateFileEntry(value).ok
}
