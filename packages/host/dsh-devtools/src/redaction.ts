import { createHash } from 'node:crypto'
import { isAbsolute, relative, resolve } from 'node:path'
import type { DevtoolsSeverity } from './types.ts'

const FORBIDDEN_KEY = /authorization|api.?key|password|cookie|secret|raw.?prompt|system.?prompt|provider.?payload|tool.?arguments?|private.?tool/i
const FORBIDDEN_VALUE = /(?:\bBearer\s+[A-Za-z0-9._~+\/-]+=*|\bsk-[A-Za-z0-9_-]{8,}|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|(?:^|[\s"'])\/(?:Users|home|workspaces|private|var|tmp)\/[^\s"']+)/i

function shape(value: unknown): string {
  if (value instanceof Error) return `error:${safeErrorCode(value) ?? value.name}`
  if (Array.isArray(value)) return `array:${value.length}`
  if (value === null) return 'null'
  return typeof value
}

export function safeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const value = (error as { code?: unknown }).code
  return typeof value === 'string' && /^[A-Z][A-Z0-9_.-]{0,63}$/.test(value) ? value : undefined
}

export function logFingerprint(source: string, severity: DevtoolsSeverity, args: readonly unknown[]): string {
  const pattern = `${source}\0${severity}\0${args.map(shape).join(',')}`
  return `sha256:${createHash('sha256').update(pattern).digest('hex').slice(0, 16)}`
}

export function safeIdentifier(value: unknown, fallback = 'unknown'): string {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().slice(0, 80)
  return /^[A-Za-z0-9_.:/-]+$/.test(normalized) ? normalized : fallback
}

export function opaqueRef(prefix: string, value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined
  return `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 12)}`
}

export function safeLogSummary(source: string, severity: DevtoolsSeverity): string {
  return `${severity} log from ${safeIdentifier(source, 'runtime')}; details redacted`
}

export function normalizeScriptUrl(url: string, workspaceRoot = process.cwd()): string {
  if (url === '' || url.startsWith('node:') || url.startsWith('internal/')) return url
  let path = url
  if (url.startsWith('file://')) {
    try { path = new URL(url).pathname } catch { return '<external>' }
  }
  if (!isAbsolute(path)) return path.slice(0, 240)
  const root = resolve(workspaceRoot)
  const rel = relative(root, path)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel) ? rel : '<external>'
}

export function containsForbiddenContent(value: unknown, seen = new Set<unknown>()): boolean {
  if (typeof value === 'string') return FORBIDDEN_VALUE.test(value)
  if (typeof value !== 'object' || value === null) return false
  if (seen.has(value)) return false
  seen.add(value)
  if (Array.isArray(value)) return value.some(item => containsForbiddenContent(item, seen))
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => (
    FORBIDDEN_KEY.test(key) || containsForbiddenContent(item, seen)
  ))
}
