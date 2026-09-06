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

/* ------------------------------------------------------------------ *
 * session.insights.snapshot.v1alpha1 — additive whole-history query  *
 * (see openspec dsh-session-insights-and-status §3/§4). Unknown       *
 * numbers are null or absent — never zero-filled.                     *
 * ------------------------------------------------------------------ */

export const SESSION_INSIGHTS_SCHEMA_VERSION = 'session.insights.snapshot.v1alpha1' as const
export const SESSION_INSIGHTS_DEFAULT_LIMIT = 50 as const
export const SESSION_INSIGHTS_MAX_LIMIT = 200 as const
export const SESSION_INSIGHTS_BREAKDOWN_BOUND = 50 as const

export type SessionInsightsScope = 'session' | 'run' | 'range'

export interface SessionInsightsQueryInputV1 {
  /** Opaque safe ref; the host re-validates access on every call. */
  readonly sessionRef: string
  readonly scope?: SessionInsightsScope
  /** Required for scope=run; must belong to the session (no latest-run fill-in). */
  readonly runRef?: string
  /** Half-open [from,to) ISO bounds; required for scope=range. */
  readonly from?: string
  readonly to?: string
  /** IANA zone used by callers to pick calendar boundaries (today/week). */
  readonly timeZone?: string
  readonly includeDescendants?: boolean
  readonly cursor?: string
  readonly limit?: number
}

/** Disjoint buckets; null when the value is unknown (never zero-filled). */
export interface SessionInsightsBucketsV1 {
  readonly uncachedInputTokens: number | null
  readonly outputTokens: number | null
  readonly cacheReadTokens: number | null
  readonly cacheWriteTokens: number | null
}

export type SessionInsightsCostKind = 'settled' | 'estimate'

export interface SessionInsightsCostV1 {
  readonly kind: SessionInsightsCostKind
  /** Official decimal string; never a reparsed float. */
  readonly amount: string
  /** ISO-4217 code; costs of different currencies are never summed together. */
  readonly currency: string
  readonly source?: string
  readonly effectiveAt?: string
}

export interface SessionInsightsCoverageV1 {
  readonly status: 'complete' | 'partial' | 'unknown'
  readonly knownRequests?: number
  readonly missingUsageRequests?: number
  readonly availableRange?: { readonly from: string; readonly to: string }
  readonly missingReason?: string
}

export interface SessionInsightsSourceV1 {
  readonly history: 'session_query' | 'unavailable'
  readonly context: 'session_projections' | 'unavailable'
  readonly cost: 'provider_settled' | 'price_snapshot' | 'unknown'
}

export interface SessionInsightsContextV1 {
  readonly status: 'available' | 'unavailable'
  readonly used?: number
  readonly limit?: number
  readonly remaining?: number
  readonly reason?: string
}

export interface SessionInsightsBreakdownRowV1 {
  readonly key: string
  readonly label: string
  readonly requestCount: number
  readonly buckets: SessionInsightsBucketsV1
}

export interface SessionInsightsBreakdownV1 {
  readonly rows: readonly SessionInsightsBreakdownRowV1[]
  /** True when rows were cut at the 50-row bound; totals still cover all. */
  readonly truncated: boolean
}

export interface SessionInsightsRequestRowV1 {
  readonly attemptRef: string
  readonly requestRef?: string
  readonly runRef?: string
  readonly sessionRef: string
  readonly eventRef?: string
  readonly happenedAt?: string
  readonly buckets: SessionInsightsBucketsV1 | null
  readonly model?: string
  readonly provider?: string
  readonly cost?: SessionInsightsCostV1
  readonly durationMs?: number
  readonly status: 'completed' | 'cancelled' | 'failed' | 'unknown'
}

export interface SessionInsightsTotalsV1 {
  readonly buckets: SessionInsightsBucketsV1
  readonly requestCount: number | null
  readonly missingUsageRequests?: number
  /** Sum of per-request durations — NOT wall clock (parallel requests sum). */
  readonly sumRequestDurationMs: number | null
  /** First-to-last request span; never the sum of request durations. */
  readonly wallClockMs: number | null
  /** Per kind+currency sums; absent when no cost data exists at all. */
  readonly cost?: readonly SessionInsightsCostV1[]
}

/** Fork-seed (inherited) history, shown separately and never re-charged. */
export interface SessionInsightsInheritedV1 {
  readonly requestCount: number
  readonly buckets: SessionInsightsBucketsV1
}

export interface SessionInsightsDescendantsV1 {
  readonly status: 'merged' | 'unavailable'
  readonly reason?: string
  readonly requestCount?: number
  readonly buckets?: SessionInsightsBucketsV1
}

export type SessionInsightsReasonCode =
  | 'history_source_unavailable'
  | 'history_read_failed'
  | 'run_scope_unavailable'
  | 'bucket_semantics_unknown'
  | 'usage_missing'
  | 'timestamps_missing'
  | 'descendant_merge_unverified'
  | 'context_source_unavailable'

export interface SessionInsightsSnapshotV1 {
  readonly schemaVersion: typeof SESSION_INSIGHTS_SCHEMA_VERSION
  readonly sessionRef: string
  readonly scope: SessionInsightsScope
  readonly revision: number
  readonly generatedAt: string
  readonly freshness: 'fresh' | 'stale' | 'unknown'
  readonly coverage: SessionInsightsCoverageV1
  readonly source: SessionInsightsSourceV1
  readonly totals: SessionInsightsTotalsV1
  readonly context: SessionInsightsContextV1
  readonly inherited?: SessionInsightsInheritedV1
  readonly descendants?: SessionInsightsDescendantsV1
  readonly byModel: SessionInsightsBreakdownV1
  readonly byProvider: SessionInsightsBreakdownV1
  readonly requests: readonly SessionInsightsRequestRowV1[]
  readonly nextCursor?: string
  readonly truncated: boolean
  readonly reasonCode?: SessionInsightsReasonCode
  readonly safeMessage?: string
}

export type SessionInsightsQueryOkV1 = {
  readonly ok: true
  readonly specVersion: typeof TOKEN_USAGE_SPEC_VERSION
  readonly snapshot: SessionInsightsSnapshotV1
}

export type SessionInsightsQueryFailureCode =
  | 'invalid_input'
  | 'invalid_cursor'
  | 'stale_cursor'
  | 'session_inaccessible'
  | 'insights_unavailable'

export type SessionInsightsQueryFailureV1 = {
  readonly ok: false
  readonly code: SessionInsightsQueryFailureCode
  readonly message: string
}

export type SessionInsightsQueryResultV1 = SessionInsightsQueryOkV1 | SessionInsightsQueryFailureV1

export interface TokenUsageQueryCapabilityV1 {
  readonly available: boolean
  readonly schemaVersion?: typeof SESSION_INSIGHTS_SCHEMA_VERSION
  readonly reason?: string
}

export interface TokenUsageCapabilitiesV1 {
  readonly query: TokenUsageQueryCapabilityV1
}

export type TokenUsageCapabilitiesOkV1 = {
  readonly ok: true
  readonly specVersion: typeof TOKEN_USAGE_SPEC_VERSION
  readonly capabilities: TokenUsageCapabilitiesV1
}
