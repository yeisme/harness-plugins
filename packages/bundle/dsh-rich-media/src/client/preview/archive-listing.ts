/**
 * Owner-side archive entry listing (V3 4.8). Reads ONLY the zip central
 * directory (entry names + uncompressed sizes) — never decompresses, never
 * executes, never touches local file data. The renderer receives this
 * owner-issued bounded list; when the owner cannot produce one the archive
 * stays in the honest unsupported state (no client extraction fallback).
 *
 * @module @yeisme/dsh-rich-media/client
 */

export const ZIP_ARCHIVE_MEDIA_TYPES: ReadonlySet<string> = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/java-archive',
])

/** Maximum entries an owner list carries; more entries stay unlisted. */
export const ARCHIVE_ENTRY_LIST_MAX = 200
/** Maximum entry-name length carried per entry; longer names truncate honestly. */
export const ARCHIVE_ENTRY_NAME_MAX = 200
/** EOCD backward scan window: 64 KiB zip64 comment cap + EOCD record. */
const EOCD_SCAN_WINDOW = 65_536 + 22
/** Hard budget on central-directory bytes parsed per call. */
const CENTRAL_DIRECTORY_SCAN_MAX = 4 * 1024 * 1024
/** Central-directory file header fixed size (before name/extra/comment). */
const CENTRAL_HEADER_FIXED = 46
/** EOCD record size without the trailing comment. */
const EOCD_FIXED = 22

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const ZIP64_COUNT_SENTINEL = 0xffff
const REPLACEMENT = '�'
const ELLIPSIS = '…'

/** One owner-listed archive entry. Name is sanitized, bounded metadata only. */
export interface ArchiveEntryV1 {
  readonly name: string
  readonly uncompressedSize: number | undefined
  readonly isDirectory: boolean
  readonly nameTruncated: boolean
}

/** Owner-issued bounded archive entry list. */
export interface ArchiveEntryListV1 {
  readonly entries: readonly ArchiveEntryV1[]
  /** Honest entry count from the archive metadata (lower bound for zip64). */
  readonly totalEntries: number
  readonly listedEntries: number
  /** True when the archive holds more entries than the list cap. */
  readonly truncated: boolean
  /** True when central-directory parsing stopped on a malformed record. */
  readonly malformed: boolean
  /** Sum of uncompressed sizes across listed entries (display budget input). */
  readonly expandedBytesTotal: number
}

export function isZipArchiveMediaType(mediaType: string | undefined): boolean {
  return mediaType !== undefined && ZIP_ARCHIVE_MEDIA_TYPES.has(mediaType.toLowerCase())
}

function readU16LE(bytes: Uint8Array, offset: number): number {
  const lo = bytes[offset]
  const hi = bytes[offset + 1]
  return lo === undefined || hi === undefined ? 0 : lo | (hi << 8)
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  const b0 = bytes[offset]
  const b1 = bytes[offset + 1]
  const b2 = bytes[offset + 2]
  const b3 = bytes[offset + 3]
  return b0 === undefined || b1 === undefined || b2 === undefined || b3 === undefined
    ? 0
    : (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0
}

function sanitizeEntryName(raw: string): { name: string; truncated: boolean } {
  let name = ''
  for (const char of raw) {
    const code = char.codePointAt(0) ?? 0
    name += code < 32 || code === 127 ? REPLACEMENT : char
  }
  if (name.length <= ARCHIVE_ENTRY_NAME_MAX) return { name, truncated: false }
  return { name: name.slice(0, ARCHIVE_ENTRY_NAME_MAX) + ELLIPSIS, truncated: true }
}

function findEocdOffset(bytes: Uint8Array): number | undefined {
  const windowStart = Math.max(0, bytes.byteLength - EOCD_SCAN_WINDOW)
  for (let offset = bytes.byteLength - EOCD_FIXED; offset >= windowStart; offset -= 1) {
    if (readU32LE(bytes, offset) === EOCD_SIGNATURE) return offset
  }
  return undefined
}

/**
 * List zip entries from the central directory. Returns `undefined` when the
 * bytes carry no zip end-of-central-directory record (not a zip / honest
 * unknown). Never reads local file data — the compressed payload region is
 * never touched, so a corrupted or hostile payload cannot affect the list.
 */
export function parseZipEntryList(bytes: Uint8Array): ArchiveEntryListV1 | undefined {
  const eocd = findEocdOffset(bytes)
  if (eocd === undefined) return undefined
  const declaredEntries = readU16LE(bytes, eocd + 10)
  const centralSize = readU32LE(bytes, eocd + 12)
  const centralOffset = readU32LE(bytes, eocd + 16)
  const zip64 = declaredEntries === ZIP64_COUNT_SENTINEL
  const end = Math.min(bytes.byteLength, centralOffset + Math.min(centralSize, CENTRAL_DIRECTORY_SCAN_MAX))
  let offset = centralOffset
  const entries: ArchiveEntryV1[] = []
  let malformed = false
  let expandedBytesTotal = 0
  while (entries.length < ARCHIVE_ENTRY_LIST_MAX && offset + CENTRAL_HEADER_FIXED <= end) {
    if (readU32LE(bytes, offset) !== CENTRAL_SIGNATURE) {
      malformed = true
      break
    }
    const uncompressedSize = readU32LE(bytes, offset + 24)
    const nameLength = readU16LE(bytes, offset + 28)
    const extraLength = readU16LE(bytes, offset + 30)
    const commentLength = readU16LE(bytes, offset + 32)
    const nameStart = offset + CENTRAL_HEADER_FIXED
    const nextOffset = nameStart + nameLength + extraLength + commentLength
    if (nameStart + nameLength > end || nextOffset <= offset) {
      malformed = true
      break
    }
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(nameStart, nameStart + nameLength))
    const sanitized = sanitizeEntryName(decoded)
    const isDirectory = sanitized.name.endsWith('/')
    entries.push({
      name: sanitized.name,
      uncompressedSize: isDirectory ? undefined : uncompressedSize,
      isDirectory,
      nameTruncated: sanitized.truncated,
    })
    if (!isDirectory) expandedBytesTotal += uncompressedSize
    offset = nextOffset
  }
  const listedEntries = entries.length
  const totalEntries = zip64
    ? Math.max(ZIP64_COUNT_SENTINEL, listedEntries)
    : Math.max(declaredEntries, listedEntries)
  return {
    entries,
    totalEntries,
    listedEntries,
    truncated: zip64 || totalEntries > listedEntries || offset + CENTRAL_HEADER_FIXED <= end,
    malformed,
    expandedBytesTotal,
  }
}
