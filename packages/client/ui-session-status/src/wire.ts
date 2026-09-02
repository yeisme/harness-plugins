/**
 * Wire mirror of `@yeisme/dsh-session-status-host` (field-for-field).
 *
 * Structural parse only: no zod in the browser ModuleLoader face.
 */

export const SESSION_STATUS_SCHEMA_VERSION = 'session.status.snapshot.v1alpha1' as const
export const SESSION_STATUS_SPEC_VERSION = '1.0' as const

export type SessionStatusFreshness = 'fresh' | 'stale' | 'unknown'
export type SessionStatusOverall = 'ready' | 'partial' | 'unavailable'
export type SessionLifecycle =
  | 'idle'
  | 'running'
  | 'waiting_approval'
  | 'error'
  | 'offline'
  | 'unknown'
export type SourceStatus = 'ready' | 'stale' | 'unavailable' | 'unsupported'
export type LimitScope = 'rolling' | 'calendar' | 'account' | 'unknown'

export interface SessionIdentityV1 {
  readonly sessionRef: string
  readonly label: string
  readonly lifecycle: SessionLifecycle
}

export interface SessionRuntimeSummaryV1 {
  readonly providerId?: string
  readonly modelLabel?: string
  readonly presetLabel?: string
  readonly reasoningLabel?: string
  readonly permissionLabel?: string
}

export interface SessionContextStatusV1 {
  readonly status: SourceStatus
  readonly usedTokens?: number
  readonly limitTokens?: number
  readonly remainingRatio?: number
  readonly updatedAt?: string
  readonly source: 'token-meter' | 'owner-projection' | 'none'
  readonly safeMessage: string
}

export interface SessionLimitWindowV1 {
  readonly id: string
  readonly label: string
  readonly scope: LimitScope
  readonly status: SourceStatus
  readonly remainingRatio?: number
  readonly resetAt?: string
  readonly safeMessage: string
}

export interface SessionStatusSnapshotV1 {
  readonly schemaVersion: typeof SESSION_STATUS_SCHEMA_VERSION
  readonly revision: number
  readonly generatedAt: string
  readonly freshness: SessionStatusFreshness
  readonly status: SessionStatusOverall
  readonly session: SessionIdentityV1
  readonly runtime?: SessionRuntimeSummaryV1
  readonly context: SessionContextStatusV1
  readonly limits: readonly SessionLimitWindowV1[]
}

export type SessionStatusSnapshotAnswerV1 =
  | { readonly ok: true; readonly specVersion: typeof SESSION_STATUS_SPEC_VERSION; readonly snapshot: SessionStatusSnapshotV1 }
  | { readonly ok: false; readonly code: 'remote_unavailable' | 'invalid_session_ref' | 'source_unavailable'; readonly message: string }

const CREDENTIAL_KEY = /^(api[_-]?key|authorization|cookie|token|password|secret|bearer)$/iu
const FORBIDDEN_VALUE = /(api[_-]?key|bearer\s|authorization|sk-[a-z0-9]|https?:\/\/|\/home\/|\/var\/)/iu
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasCredentialKey(value: unknown): boolean {
  if (!isRecord(value)) return false
  return Object.keys(value).some(key => CREDENTIAL_KEY.test(key) || hasCredentialKey(value[key]))
}

function hasForbiddenText(value: unknown): boolean {
  if (typeof value === 'string') return FORBIDDEN_VALUE.test(value)
  if (Array.isArray(value)) return value.some(hasForbiddenText)
  if (isRecord(value)) return Object.values(value).some(hasForbiddenText)
  return false
}

const LIFECYCLES = new Set(['idle', 'running', 'waiting_approval', 'error', 'offline', 'unknown'])
const SOURCE_STATUSES = new Set(['ready', 'stale', 'unavailable', 'unsupported'])
const OVERALL = new Set(['ready', 'partial', 'unavailable'])
const FRESHNESS = new Set(['fresh', 'stale', 'unknown'])
const CONTEXT_SOURCES = new Set(['token-meter', 'owner-projection', 'none'])
const LIMIT_SCOPES = new Set(['rolling', 'calendar', 'account', 'unknown'])

function asString(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null
}

function asRatio(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined
}

function parseContext(value: unknown): SessionContextStatusV1 | null {
  if (!isRecord(value)) return null
  if (typeof value.status !== 'string' || !SOURCE_STATUSES.has(value.status)) return null
  if (typeof value.source !== 'string' || !CONTEXT_SOURCES.has(value.source)) return null
  const safeMessage = asString(value.safeMessage, 200)
  if (safeMessage === null) return null
  const remainingRatio = asRatio(value.remainingRatio)
  const context: SessionContextStatusV1 = {
    status: value.status as SourceStatus,
    source: value.source as SessionContextStatusV1['source'],
    safeMessage,
  }
  return {
    ...context,
    ...(typeof value.usedTokens === 'number' ? { usedTokens: value.usedTokens } : {}),
    ...(typeof value.limitTokens === 'number' ? { limitTokens: value.limitTokens } : {}),
    ...(remainingRatio === undefined ? {} : { remainingRatio }),
    ...(typeof value.updatedAt === 'string' ? { updatedAt: value.updatedAt } : {}),
  }
}

function parseLimit(value: unknown): SessionLimitWindowV1 | null {
  if (!isRecord(value)) return null
  const id = asString(value.id, 64)
  const label = asString(value.label, 160)
  const safeMessage = asString(value.safeMessage, 200)
  if (id === null || label === null || safeMessage === null) return null
  if (typeof value.scope !== 'string' || !LIMIT_SCOPES.has(value.scope)) return null
  if (typeof value.status !== 'string' || !SOURCE_STATUSES.has(value.status)) return null
  const remainingRatio = asRatio(value.remainingRatio)
  return {
    id,
    label,
    scope: value.scope as LimitScope,
    status: value.status as SourceStatus,
    safeMessage,
    ...(remainingRatio === undefined ? {} : { remainingRatio }),
    ...(typeof value.resetAt === 'string' ? { resetAt: value.resetAt } : {}),
  }
}

/**
 * Structural parse of a host snapshot. Unknown/credential/short shapes
 * degrade to null rather than inventing remaining ratios.
 */
export function parseSessionStatusSnapshot(value: unknown): SessionStatusSnapshotV1 | null {
  if (!isRecord(value)) return null
  if (hasCredentialKey(value) || hasForbiddenText(value)) return null
  if (value.schemaVersion !== SESSION_STATUS_SCHEMA_VERSION) return null
  if (typeof value.revision !== 'number' || !Number.isFinite(value.revision)) return null
  if (typeof value.generatedAt !== 'string') return null
  if (typeof value.freshness !== 'string' || !FRESHNESS.has(value.freshness)) return null
  if (typeof value.status !== 'string' || !OVERALL.has(value.status)) return null
  if (!isRecord(value.session)) return null
  const sessionRef = asString(value.session.sessionRef, 128)
  const label = asString(value.session.label, 160)
  if (sessionRef === null || label === null || !SAFE_REF.test(sessionRef) || /[\\/]/.test(sessionRef)) {
    return null
  }
  if (typeof value.session.lifecycle !== 'string' || !LIFECYCLES.has(value.session.lifecycle)) {
    return null
  }
  const context = parseContext(value.context)
  if (context === null) return null
  if (!Array.isArray(value.limits) || value.limits.length > 4) return null
  const limits: SessionLimitWindowV1[] = []
  for (const row of value.limits) {
    const parsed = parseLimit(row)
    if (parsed === null) return null
    limits.push(parsed)
  }
  return {
    schemaVersion: SESSION_STATUS_SCHEMA_VERSION,
    revision: value.revision,
    generatedAt: value.generatedAt,
    freshness: value.freshness as SessionStatusFreshness,
    status: value.status as SessionStatusOverall,
    session: {
      sessionRef,
      label,
      lifecycle: value.session.lifecycle as SessionLifecycle,
    },
    context,
    limits,
  }
}

export function unavailableClientSnapshot(reason: string): SessionStatusSnapshotV1 {
  return {
    schemaVersion: SESSION_STATUS_SCHEMA_VERSION,
    revision: 0,
    generatedAt: '1970-01-01T00:00:00.000Z',
    freshness: 'unknown',
    status: 'unavailable',
    session: { sessionRef: 'unknown', label: 'Session', lifecycle: 'unknown' },
    context: {
      status: 'unavailable',
      source: 'none',
      safeMessage: reason,
    },
    limits: [],
  }
}
