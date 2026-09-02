/**
 * Wire types for session.status.snapshot.v1alpha1.
 *
 * Context remaining is an owner fact, never process-ledger math.
 * Provider limits are adapter windows, never balance amounts.
 */

export const SESSION_STATUS_SCHEMA_VERSION = 'session.status.snapshot.v1alpha1' as const
export const SESSION_STATUS_SPEC_VERSION = '1.0' as const
export const SESSION_STATUS_REMOTE_SERVICE_KEY = 'sessionStatus' as const
export const SESSION_STATUS_LIMIT_BOUND = 4

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

export type SessionStatusSnapshotOkV1 = {
  readonly ok: true
  readonly specVersion: typeof SESSION_STATUS_SPEC_VERSION
  readonly snapshot: SessionStatusSnapshotV1
}

export type SessionStatusFailureV1 = {
  readonly ok: false
  readonly code: 'remote_unavailable' | 'invalid_session_ref' | 'source_unavailable'
  readonly message: string
}
