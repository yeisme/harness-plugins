/**
 * Format classification shared by the pane dispatcher and the desktop
 * file-entry mapping (file-preview-formats). One table decides which
 * renderer family a mediaType routes to; unknown types stay `binary`
 * and degrade honestly.
 *
 * @module @yeisme/dsh-rich-media/client
 */

export const DOCX_MEDIA_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const XLSX_MEDIA_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const XLSSM_MEDIA_TYPE = 'application/vnd.ms-excel.sheet.macroenabled.12'
export const PPTX_MEDIA_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

export type DocumentPreviewKind = 'text' | 'csv' | 'sheet' | 'docx' | 'pdf' | 'binary'

const TEXT_MEDIA_TYPES = new Set([
  'text/plain', 'text/markdown', 'text/html', 'text/css', 'text/javascript',
  'application/json', 'application/x-ndjson', 'application/yaml', 'application/toml',
  'application/xml', 'application/javascript', 'application/x-yaml', 'text/x-markdown',
])

const CSV_MEDIA_TYPES = new Set(['text/csv', 'text/tab-separated-values'])

const SHEET_MEDIA_TYPES = new Set([XLSX_MEDIA_TYPE, XLSSM_MEDIA_TYPE])

/** Route one media type to a preview renderer family. */
export function documentPreviewKindOf(mediaType: string): DocumentPreviewKind {
  const normalized = mediaType.toLowerCase()
  if (normalized === 'application/pdf') return 'pdf'
  if (CSV_MEDIA_TYPES.has(normalized)) return 'csv'
  if (SHEET_MEDIA_TYPES.has(normalized)) return 'sheet'
  if (normalized === DOCX_MEDIA_TYPE) return 'docx'
  if (TEXT_MEDIA_TYPES.has(normalized) || normalized.startsWith('text/')) return 'text'
  if (normalized.endsWith('+json') || normalized.endsWith('+xml')) return 'text'
  return 'binary'
}

export interface FileEntryClassification {
  readonly kind: 'image' | 'audio' | 'video' | 'pdf' | 'document' | 'text'
  readonly mediaType: string
}

const EXTENSION_MEDIA_TYPES: Readonly<Record<string, FileEntryClassification>> = Object.freeze({
  csv: { kind: 'document', mediaType: 'text/csv' },
  tsv: { kind: 'document', mediaType: 'text/tab-separated-values' },
  tab: { kind: 'document', mediaType: 'text/tab-separated-values' },
  txt: { kind: 'text', mediaType: 'text/plain' },
  text: { kind: 'text', mediaType: 'text/plain' },
  log: { kind: 'text', mediaType: 'text/plain' },
  md: { kind: 'text', mediaType: 'text/markdown' },
  markdown: { kind: 'text', mediaType: 'text/markdown' },
  json: { kind: 'text', mediaType: 'application/json' },
  jsonl: { kind: 'text', mediaType: 'application/x-ndjson' },
  ndjson: { kind: 'text', mediaType: 'application/x-ndjson' },
  yaml: { kind: 'text', mediaType: 'application/yaml' },
  yml: { kind: 'text', mediaType: 'application/yaml' },
  toml: { kind: 'text', mediaType: 'application/toml' },
  xml: { kind: 'text', mediaType: 'application/xml' },
  html: { kind: 'text', mediaType: 'text/html' },
  htm: { kind: 'text', mediaType: 'text/html' },
  css: { kind: 'text', mediaType: 'text/css' },
  js: { kind: 'text', mediaType: 'text/javascript' },
  mjs: { kind: 'text', mediaType: 'text/javascript' },
  cjs: { kind: 'text', mediaType: 'text/javascript' },
  ts: { kind: 'text', mediaType: 'text/plain' },
  tsx: { kind: 'text', mediaType: 'text/plain' },
  py: { kind: 'text', mediaType: 'text/plain' },
  go: { kind: 'text', mediaType: 'text/plain' },
  rs: { kind: 'text', mediaType: 'text/plain' },
  sh: { kind: 'text', mediaType: 'text/plain' },
  sql: { kind: 'text', mediaType: 'text/plain' },
  // 音视频族（file-preview-dispatch）：常见容器/编码扩展统一进媒体预览；
  // 能否解码由浏览器元素如实表达，播放渲染器不伪造成功。
  flac: { kind: 'audio', mediaType: 'audio/flac' },
  opus: { kind: 'audio', mediaType: 'audio/opus' },
  aac: { kind: 'audio', mediaType: 'audio/aac' },
  ogg: { kind: 'audio', mediaType: 'audio/ogg' },
  aif: { kind: 'audio', mediaType: 'audio/aiff' },
  aiff: { kind: 'audio', mediaType: 'audio/aiff' },
  wma: { kind: 'audio', mediaType: 'audio/x-ms-wma' },
  mid: { kind: 'audio', mediaType: 'audio/midi' },
  midi: { kind: 'audio', mediaType: 'audio/midi' },
  mkv: { kind: 'video', mediaType: 'video/x-matroska' },
  avi: { kind: 'video', mediaType: 'video/x-msvideo' },
  flv: { kind: 'video', mediaType: 'video/x-flv' },
  mts: { kind: 'video', mediaType: 'video/mp2t' },
  m2ts: { kind: 'video', mediaType: 'video/mp2t' },
  '3gp': { kind: 'video', mediaType: 'video/3gpp' },
  ogm: { kind: 'video', mediaType: 'video/x-ogm' },
  // 归档族（file-preview-dispatch）：zip 族带标准 MIME（exact-MIME 命中归档
  // 列表渲染器）；其余归档自然落 binary family 的有界 hex 视图。
  zip: { kind: 'document', mediaType: 'application/zip' },
  jar: { kind: 'document', mediaType: 'application/java-archive' },
  tar: { kind: 'document', mediaType: 'application/x-tar' },
  gz: { kind: 'document', mediaType: 'application/gzip' },
  tgz: { kind: 'document', mediaType: 'application/gzip' },
  bz2: { kind: 'document', mediaType: 'application/x-bzip2' },
  xz: { kind: 'document', mediaType: 'application/x-xz' },
  '7z': { kind: 'document', mediaType: 'application/x-7z-compressed' },
  rar: { kind: 'document', mediaType: 'application/vnd.rar' },
  pdf: { kind: 'pdf', mediaType: 'application/pdf' },
  docx: { kind: 'document', mediaType: DOCX_MEDIA_TYPE },
  xlsx: { kind: 'document', mediaType: XLSX_MEDIA_TYPE },
  xlsm: { kind: 'document', mediaType: XLSSM_MEDIA_TYPE },
  pptx: { kind: 'document', mediaType: PPTX_MEDIA_TYPE },
  doc: { kind: 'document', mediaType: 'application/msword' },
  xls: { kind: 'document', mediaType: 'application/vnd.ms-excel' },
  odt: { kind: 'document', mediaType: 'application/vnd.oasis.opendocument.text' },
  ods: { kind: 'document', mediaType: 'application/vnd.oasis.opendocument.spreadsheet' },
  odp: { kind: 'document', mediaType: 'application/vnd.oasis.opendocument.presentation' },
})

/** Classify a file name (+ optional declared media type) into a preview kind. */
export function classifyFileEntry(name: string, declaredMediaType: string | undefined): FileEntryClassification | undefined {
  const extension = name.includes('.') === true ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : undefined
  const byExtension = extension === undefined ? undefined : EXTENSION_MEDIA_TYPES[extension]
  if (byExtension !== undefined) return byExtension
  if (declaredMediaType === undefined) return undefined
  const normalized = declaredMediaType.toLowerCase()
  if (normalized.startsWith('image/')) return { kind: 'image', mediaType: normalized }
  if (normalized.startsWith('audio/')) return { kind: 'audio', mediaType: normalized }
  if (normalized.startsWith('video/')) return { kind: 'video', mediaType: normalized }
  if (normalized === 'application/pdf') return { kind: 'pdf', mediaType: normalized }
  const routed = documentPreviewKindOf(normalized)
  if (routed === 'text') return { kind: 'text', mediaType: normalized }
  if (routed === 'csv' || routed === 'sheet' || routed === 'docx') return { kind: 'document', mediaType: normalized }
  if (routed === 'binary') return { kind: 'document', mediaType: normalized === '' ? 'application/octet-stream' : normalized }
  return undefined
}
