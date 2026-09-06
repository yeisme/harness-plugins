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
  /** Additive capability probe; absent on old hosts — never guessed by calling. */
  capabilities?(): Promise<TokenUsageCapabilitiesAnswerV1>
  /** Additive whole-history query; only invoked after capabilities() confirms it. */
  query?(input: SessionInsightsQueryInputV1): Promise<SessionInsightsQueryResultV1>
  /**
   * Optional version-notification seam (session-scoped, push). Old hosts do
   * not expose it: callers then offer manual refresh only and must never
   * promise live updates.
   */
  subscribeVersion?(sessionRef: string, listener: () => void): () => void
}

export const EMPTY_BUCKETS: TokenBucketsV1 = Object.freeze({
  uncachedInputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
})

/* ------------------------------------------------------------------ *
 * session.insights.snapshot.v1alpha1 — mirror of the host contract.   *
 * Unknown numbers are null or absent, never zero-filled. Parsing is   *
 * structural (no zod in the browser) and fails closed on credential-  *
 * shaped keys, forbidden text, or unsafe refs.                        *
 * ------------------------------------------------------------------ */

export const SESSION_INSIGHTS_SCHEMA_VERSION = 'session.insights.snapshot.v1alpha1' as const
export const SESSION_INSIGHTS_MAX_LIMIT = 200 as const

export type SessionInsightsScope = 'session' | 'run' | 'range'

export interface SessionInsightsQueryInputV1 {
  readonly sessionRef: string
  readonly scope?: SessionInsightsScope
  readonly runRef?: string
  readonly from?: string
  readonly to?: string
  readonly timeZone?: string
  readonly includeDescendants?: boolean
  readonly cursor?: string
  readonly limit?: number
}

export interface SessionInsightsBucketsV1 {
  readonly uncachedInputTokens: number | null
  readonly outputTokens: number | null
  readonly cacheReadTokens: number | null
  readonly cacheWriteTokens: number | null
}

export interface SessionInsightsCostV1 {
  readonly kind: 'settled' | 'estimate'
  readonly amount: string
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
  readonly sumRequestDurationMs: number | null
  readonly wallClockMs: number | null
  readonly cost?: readonly SessionInsightsCostV1[]
}

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

export type SessionInsightsQueryFailureCode =
  | 'invalid_input'
  | 'invalid_cursor'
  | 'stale_cursor'
  | 'session_inaccessible'
  | 'insights_unavailable'

export type SessionInsightsQueryResultV1 =
  | { readonly ok: true; readonly specVersion: '1.0'; readonly snapshot: SessionInsightsSnapshotV1 }
  | { readonly ok: false; readonly code: SessionInsightsQueryFailureCode; readonly message: string }

export interface TokenUsageCapabilitiesV1 {
  readonly query: {
    readonly available: boolean
    readonly schemaVersion?: typeof SESSION_INSIGHTS_SCHEMA_VERSION
    readonly reason?: string
  }
}

export type TokenUsageCapabilitiesAnswerV1 =
  | { readonly ok: true; readonly specVersion: '1.0'; readonly capabilities: TokenUsageCapabilitiesV1 }

/* ------------------------- strict parsers ------------------------- */

const CREDENTIAL_KEY = /^(api[_-]?key|authorization|cookie|token|password|secret|bearer)$/iu
const FORBIDDEN_VALUE = /(api[_-]?key|bearer\s|authorization|sk-[a-z0-9]|https?:\/\/|\/home\/|\/var\/)/iu
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u
const DECIMAL_AMOUNT = /^\d+(\.\d+)?$/u
const CURRENCY_CODE = /^[A-Z]{3}$/u

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

/** Opaque safe ref guard shared by query inputs and snapshot rows. */
export function isSafeInsightsRef(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 128
    && SAFE_REF.test(value)
    && !/[\\/]/u.test(value)
}

function asNullableCount(value: unknown): number | null {
  if (value === null) return null
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0 ? value : null
}

function asCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0 ? value : undefined
}

function asText(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : undefined
}

function parseInsightsBuckets(value: unknown): SessionInsightsBucketsV1 | null {
  if (!isRecord(value)) return null
  const buckets: SessionInsightsBucketsV1 = {
    uncachedInputTokens: asNullableCount(value.uncachedInputTokens),
    outputTokens: asNullableCount(value.outputTokens),
    cacheReadTokens: asNullableCount(value.cacheReadTokens),
    cacheWriteTokens: asNullableCount(value.cacheWriteTokens),
  }
  // A present-but-invalid number must not silently degrade to "unknown".
  for (const key of ['uncachedInputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'] as const) {
    const raw = value[key]
    if (raw !== null && raw !== undefined && buckets[key] === null) return null
  }
  return buckets
}

function parseInsightsCost(value: unknown): SessionInsightsCostV1 | null {
  if (!isRecord(value)) return null
  if (value.kind !== 'settled' && value.kind !== 'estimate') return null
  if (typeof value.amount !== 'string' || !DECIMAL_AMOUNT.test(value.amount)) return null
  if (typeof value.currency !== 'string' || !CURRENCY_CODE.test(value.currency)) return null
  const source = asText(value.source, 120)
  const effectiveAt = asText(value.effectiveAt, 64)
  return {
    kind: value.kind,
    amount: value.amount,
    currency: value.currency,
    ...(source === undefined ? {} : { source }),
    ...(effectiveAt === undefined ? {} : { effectiveAt }),
  }
}

function parseBreakdown(value: unknown): SessionInsightsBreakdownV1 | null {
  if (!isRecord(value) || !Array.isArray(value.rows) || value.rows.length > 50) return null
  if (typeof value.truncated !== 'boolean') return null
  const rows: SessionInsightsBreakdownRowV1[] = []
  for (const row of value.rows) {
    if (!isRecord(row)) return null
    const key = asText(row.key, 160)
    const label = asText(row.label, 160)
    const requestCount = asCount(row.requestCount)
    const buckets = parseInsightsBuckets(row.buckets)
    if (key === undefined || label === undefined || requestCount === undefined || buckets === null) return null
    rows.push({ key, label, requestCount, buckets })
  }
  return { rows, truncated: value.truncated }
}

function parseRequestRow(value: unknown): SessionInsightsRequestRowV1 | null {
  if (!isRecord(value)) return null
  if (!isSafeInsightsRef(value.attemptRef) || !isSafeInsightsRef(value.sessionRef)) return null
  for (const ref of ['requestRef', 'runRef', 'eventRef'] as const) {
    if (value[ref] !== undefined && !isSafeInsightsRef(value[ref])) return null
  }
  if (value.status !== 'completed' && value.status !== 'cancelled' && value.status !== 'failed' && value.status !== 'unknown') return null
  if (value.buckets !== null && parseInsightsBuckets(value.buckets) === null) return null
  if (value.cost !== undefined && parseInsightsCost(value.cost) === null) return null
  return value as unknown as SessionInsightsRequestRowV1
}

const INSIGHTS_REASON_CODES = new Set([
  'history_source_unavailable',
  'history_read_failed',
  'run_scope_unavailable',
  'bucket_semantics_unknown',
  'usage_missing',
  'timestamps_missing',
  'descendant_merge_unverified',
  'context_source_unavailable',
])

/**
 * Structural parse of a session insights snapshot. Credential-shaped keys,
 * forbidden text, unsafe refs, and short shapes all degrade to null — the
 * caller must never zero-fill or guess.
 */
export function parseSessionInsightsSnapshot(value: unknown): SessionInsightsSnapshotV1 | null {
  if (!isRecord(value)) return null
  if (hasCredentialKey(value) || hasForbiddenText(value)) return null
  if (value.schemaVersion !== SESSION_INSIGHTS_SCHEMA_VERSION) return null
  if (!isSafeInsightsRef(value.sessionRef)) return null
  if (value.scope !== 'session' && value.scope !== 'run' && value.scope !== 'range') return null
  if (typeof value.revision !== 'number' || !Number.isInteger(value.revision) || value.revision < 0) return null
  if (typeof value.generatedAt !== 'string') return null
  if (value.freshness !== 'fresh' && value.freshness !== 'stale' && value.freshness !== 'unknown') return null
  if (!isRecord(value.coverage) || (value.coverage.status !== 'complete' && value.coverage.status !== 'partial' && value.coverage.status !== 'unknown')) return null
  if (!isRecord(value.source) || !isRecord(value.totals) || !isRecord(value.context)) return null
  const totalsBuckets = parseInsightsBuckets(value.totals.buckets)
  if (totalsBuckets === null) return null
  const requestCount = asNullableCount(value.totals.requestCount)
  if (value.totals.requestCount !== null && value.totals.requestCount !== undefined && requestCount === null) return null
  if (value.totals.cost !== undefined) {
    if (!Array.isArray(value.totals.cost) || value.totals.cost.length > 16) return null
    for (const cost of value.totals.cost) {
      if (parseInsightsCost(cost) === null) return null
    }
  }
  if (value.context.status !== 'available' && value.context.status !== 'unavailable') return null
  const byModel = parseBreakdown(value.byModel)
  const byProvider = parseBreakdown(value.byProvider)
  if (byModel === null || byProvider === null) return null
  if (!Array.isArray(value.requests) || value.requests.length > SESSION_INSIGHTS_MAX_LIMIT) return null
  const requests: SessionInsightsRequestRowV1[] = []
  for (const row of value.requests) {
    const parsed = parseRequestRow(row)
    if (parsed === null) return null
    requests.push(parsed)
  }
  if (typeof value.truncated !== 'boolean') return null
  if (value.reasonCode !== undefined && (typeof value.reasonCode !== 'string' || !INSIGHTS_REASON_CODES.has(value.reasonCode))) return null
  if (value.safeMessage !== undefined && asText(value.safeMessage, 300) === undefined) return null
  if (value.nextCursor !== undefined && (typeof value.nextCursor !== 'string' || value.nextCursor.length > 512)) return null
  return value as unknown as SessionInsightsSnapshotV1
}

/** Strict query-input whitelist used by the Remote parameter codec. */
export function parseSessionInsightsQueryInput(value: unknown): SessionInsightsQueryInputV1 {
  if (!isRecord(value)) throw new TypeError('tokenUsage.query input must be a record')
  if (hasCredentialKey(value) || hasForbiddenText(value)) {
    throw new TypeError('tokenUsage.query input carries forbidden material')
  }
  if (!isSafeInsightsRef(value.sessionRef)) throw new TypeError('tokenUsage.query input: sessionRef must be a safe ref')
  if (value.scope !== undefined && value.scope !== 'session' && value.scope !== 'run' && value.scope !== 'range') {
    throw new TypeError('tokenUsage.query input: scope invalid')
  }
  if (value.scope === 'run' && !isSafeInsightsRef(value.runRef)) throw new TypeError('tokenUsage.query input: scope=run requires runRef')
  if (value.scope === 'range' && (typeof value.from !== 'string' || typeof value.to !== 'string')) {
    throw new TypeError('tokenUsage.query input: scope=range requires from/to')
  }
  if (value.runRef !== undefined && !isSafeInsightsRef(value.runRef)) throw new TypeError('tokenUsage.query input: runRef must be a safe ref')
  if (value.cursor !== undefined && (typeof value.cursor !== 'string' || value.cursor.length === 0 || value.cursor.length > 512)) {
    throw new TypeError('tokenUsage.query input: cursor invalid')
  }
  if (value.limit !== undefined && (typeof value.limit !== 'number' || !Number.isInteger(value.limit) || value.limit < 1 || value.limit > SESSION_INSIGHTS_MAX_LIMIT)) {
    throw new TypeError('tokenUsage.query input: limit out of range')
  }
  return value as unknown as SessionInsightsQueryInputV1
}

/** Parse a query answer; failure codes pass through, stale_cursor stays typed. */
export function parseSessionInsightsQueryResult(value: unknown): SessionInsightsQueryResultV1 | null {
  if (!isRecord(value) || typeof value.ok !== 'boolean') return null
  if (hasCredentialKey(value) || hasForbiddenText(value)) return null
  if (!value.ok) {
    if (typeof value.code !== 'string' || typeof value.message !== 'string' || value.message.length > 300) return null
    return value as unknown as SessionInsightsQueryResultV1
  }
  if (value.specVersion !== '1.0') return null
  const snapshot = parseSessionInsightsSnapshot(value.snapshot)
  if (snapshot === null) return null
  return { ok: true, specVersion: '1.0', snapshot }
}

/** Parse the capabilities answer; unknown shapes degrade to "no query". */
export function parseTokenUsageCapabilitiesAnswer(value: unknown): TokenUsageCapabilitiesV1 | null {
  if (!isRecord(value) || value.ok !== true || value.specVersion !== '1.0') return null
  if (hasCredentialKey(value) || hasForbiddenText(value)) return null
  if (!isRecord(value.capabilities) || !isRecord(value.capabilities.query)) return null
  const query = value.capabilities.query
  if (typeof query.available !== 'boolean') return null
  if (query.available && query.schemaVersion !== SESSION_INSIGHTS_SCHEMA_VERSION) return null
  if (query.reason !== undefined && asText(query.reason, 200) === undefined) return null
  return { query: query as unknown as TokenUsageCapabilitiesV1['query'] }
}
