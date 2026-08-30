/**
 * Pure JSON tree formatter (V3 4.5 tree mode).
 *
 * Parses owner-provided JSON and renders an indented box-drawing tree as
 * plain text lines — no HTML construction, no execution, no path/URL
 * interpretation. Depth and output size are bounded; unparseable input
 * returns undefined so callers fall back to the plain source viewer.
 *
 * @module @yeisme/dsh-file-document/client
 */

const MAX_DEPTH = 12
const MAX_LINES = 2_000
const MAX_STRING = 240

function previewValue(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return `Array(${value.length})`
  if (typeof value === 'object') return `Object(${Object.keys(value).length})`
  if (typeof value === 'string') return JSON.stringify(value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value)
  return String(value)
}

function emit(value: unknown, prefix: string, depth: number, lines: string[]): void {
  if (lines.length >= MAX_LINES || depth > MAX_DEPTH) {
    if (lines.length < MAX_LINES) lines.push(`${prefix}…`)
    return
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const last = index === value.length - 1
      const branch = `${prefix}${last ? '└─ ' : '├─ '}`
      const leaf = Array.isArray(item) || (item !== null && typeof item === 'object')
      lines.push(`${branch}[${index}]${leaf ? '' : `: ${previewValue(item)}`}`.trimEnd())
      if (leaf) emit(item, `${prefix}${last ? '   ' : '│  '}`, depth + 1, lines)
    }
    return
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    for (const [index, [key, item]] of entries.entries()) {
      const last = index === entries.length - 1
      const branch = `${prefix}${last ? '└─ ' : '├─ '}`
      const leaf = Array.isArray(item) || (item !== null && typeof item === 'object')
      const safeKey = key.length > MAX_STRING ? `${key.slice(0, MAX_STRING)}…` : key
      lines.push(`${branch}${safeKey}${leaf ? '' : `: ${previewValue(item)}`}`.trimEnd())
      if (leaf) emit(item, `${prefix}${last ? '   ' : '│  '}`, depth + 1, lines)
    }
  }
}

/** Bounded JSON tree lines, or undefined when the source is not valid JSON. */
export function formatJsonTree(source: string): string | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    return undefined
  }
  const lines: string[] = [previewValue(parsed)]
  emit(parsed, '', 1, lines)
  return lines.length > MAX_LINES ? lines.slice(0, MAX_LINES).join('\n') + '\n…' : lines.join('\n')
}
