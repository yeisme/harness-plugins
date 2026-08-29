/**
 * Wire mirror of `@yeisme/dsh-token-usage-host` (field-for-field).
 *
 * No zod/typert runtime dependency (single-file ModuleLoader contract):
 * parsing is structural and the bundle-level sync test pins the two sides
 * against drift.
 *
 * @module @yeisme/dsh-client-ui-token-usage/wire
 */

export interface TokenBucketsV1 {
  readonly uncachedInputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
}

export interface TokenUsageSessionRowV1 {
  readonly sessionRef: string
  readonly label: string
  readonly buckets: TokenBucketsV1
}

export interface TokenUsageProviderRowV1 {
  readonly providerId: string
  readonly label: string
  readonly buckets: TokenBucketsV1
}

export interface TokenUsageSnapshotV1 {
  readonly schemaVersion: 'token.usage.snapshot.v1alpha1'
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
  readonly truncated: boolean
}

export interface TokenBalanceInfoV1 {
  readonly currency: 'CNY' | 'USD'
  readonly totalBalance: string
  readonly grantedBalance: string
  readonly toppedUpBalance: string
}

export interface TokenBalanceSnapshotV1 {
  readonly schemaVersion: 'token.balance.snapshot.v1alpha1'
  readonly status: 'ready' | 'unavailable' | 'unsupported' | 'error'
  readonly freshness: 'fresh' | 'stale' | 'unknown'
  readonly generatedAt: string
  readonly reasonCode?: 'provider_not_deepseek' | 'credential_missing' | 'network_failed' | 'contract_mismatch'
  readonly safeMessage: string
  readonly isAvailable?: boolean
  readonly infos?: readonly TokenBalanceInfoV1[]
}

export type TokenUsageSnapshotAnswerV1 =
  | { readonly ok: true; readonly specVersion: '1.0'; readonly usage: TokenUsageSnapshotV1; readonly balance: TokenBalanceSnapshotV1 }
  | { readonly ok: false; readonly code: 'remote_unavailable' | 'balance_unavailable'; readonly message: string }

export type TokenUsageRefreshAnswerV1 =
  | { readonly ok: true; readonly specVersion: '1.0'; readonly balance: TokenBalanceSnapshotV1 }
  | { readonly ok: false; readonly code: 'remote_unavailable' | 'balance_unavailable'; readonly message: string }

export interface TokenUsageRemoteFace {
  snapshot(): Promise<TokenUsageSnapshotAnswerV1>
  refreshBalance(): Promise<TokenUsageRefreshAnswerV1>
}

export const EMPTY_BUCKETS: TokenBucketsV1 = Object.freeze({
  uncachedInputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
})
