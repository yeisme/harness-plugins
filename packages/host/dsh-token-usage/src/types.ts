/**
 * Wire types for the tokenUsage Remote.
 *
 * `v1alpha1` snapshots are pre-1.0: additive optional fields may land inside
 * this change; renames/removals go through the evolutionary-change-policy
 * after release. Amounts stay official strings — no numeric reparse.
 *
 * @module @yeisme/dsh-token-usage-host/types
 */

/** Disjoint token buckets as published by the official `tokenUsage` projection. */
export interface TokenBucketsV1 {
  readonly uncachedInputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
}

export const TOKEN_USAGE_SCHEMA_VERSION = 'token.usage.snapshot.v1alpha1' as const
export const TOKEN_BALANCE_SCHEMA_VERSION = 'token.balance.snapshot.v1alpha1' as const
export const TOKEN_USAGE_SPEC_VERSION = '1.0' as const
export const TOKEN_USAGE_REMOTE_SERVICE_KEY = 'tokenUsage' as const

export interface TokenUsageSessionRowV1 {
  /** Opaque safe ref (see SAFE_SESSION_REF); never a path, URL, or credential. */
  readonly sessionRef: string
  /** Safe human label derived from the session id. */
  readonly label: string
  readonly buckets: TokenBucketsV1
}

export interface TokenUsageProviderRowV1 {
  readonly providerId: string
  readonly label: string
  readonly buckets: TokenBucketsV1
}

export interface TokenUsageSnapshotV1 {
  readonly schemaVersion: typeof TOKEN_USAGE_SCHEMA_VERSION
  readonly generatedAt: string
  readonly freshness: 'fresh' | 'stale' | 'unknown'
  readonly currentSession?: TokenUsageSessionRowV1
  readonly windows: {
    readonly today: TokenBucketsV1
    readonly week: TokenBucketsV1
    readonly process: TokenBucketsV1
  }
  readonly bySession: readonly TokenUsageSessionRowV1[]
  readonly byProvider: readonly TokenUsageProviderRowV1[]
  /** True when bySession was cut at the bound (default 20). */
  readonly truncated: boolean
}

export type TokenBalanceStatus = 'ready' | 'unavailable' | 'unsupported' | 'error'

export type TokenBalanceReasonCode =
  | 'provider_not_deepseek'
  | 'credential_missing'
  | 'network_failed'
  | 'contract_mismatch'

export interface TokenBalanceInfoV1 {
  readonly currency: 'CNY' | 'USD'
  readonly totalBalance: string
  readonly grantedBalance: string
  readonly toppedUpBalance: string
}

export interface TokenBalanceSnapshotV1 {
  readonly schemaVersion: typeof TOKEN_BALANCE_SCHEMA_VERSION
  readonly status: TokenBalanceStatus
  readonly freshness: 'fresh' | 'stale' | 'unknown'
  readonly generatedAt: string
  readonly reasonCode?: TokenBalanceReasonCode
  readonly safeMessage: string
  readonly isAvailable?: boolean
  readonly infos?: readonly TokenBalanceInfoV1[]
}

export type TokenUsageSnapshotOkV1 = {
  readonly ok: true
  readonly specVersion: typeof TOKEN_USAGE_SPEC_VERSION
  readonly usage: TokenUsageSnapshotV1
  readonly balance: TokenBalanceSnapshotV1
}

export type TokenUsageRefreshOkV1 = {
  readonly ok: true
  readonly specVersion: typeof TOKEN_USAGE_SPEC_VERSION
  readonly balance: TokenBalanceSnapshotV1
}

export type TokenUsageFailureV1 = {
  readonly ok: false
  readonly code: 'remote_unavailable' | 'balance_unavailable'
  readonly message: string
}
