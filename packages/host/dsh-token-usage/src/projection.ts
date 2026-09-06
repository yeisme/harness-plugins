/**
 * Whitelist validation for the tokenUsage Remote projections.
 *
 * Unsafe payloads are rejected whole — unknown fields never pass, amounts
 * stay strings, and refs must satisfy the safe-ref shape before they leave
 * the host. Validators are pure; the ledger and balance client call them.
 *
 * @module @yeisme/dsh-token-usage-host/projection
 */

import { z } from 'zod'
import {
  SESSION_INSIGHTS_BREAKDOWN_BOUND,
  SESSION_INSIGHTS_MAX_LIMIT,
  SESSION_INSIGHTS_SCHEMA_VERSION,
  TOKEN_BALANCE_SCHEMA_VERSION,
  TOKEN_USAGE_SCHEMA_VERSION,
  type SessionInsightsQueryInputV1,
  type SessionInsightsSnapshotV1,
  type TokenBalanceSnapshotV1,
  type TokenUsageSnapshotV1,
} from './types.ts'

const nonNegativeInt = z.number().finite().int().nonnegative()

export const tokenBucketsSchema = z.strictObject({
  uncachedInputTokens: nonNegativeInt,
  outputTokens: nonNegativeInt,
  cacheReadTokens: nonNegativeInt,
  cacheWriteTokens: nonNegativeInt,
})

/** Opaque refs reject path/URL/credential shapes outright. */
export const safeSessionRefSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u)
  .refine(value => !/[\\/]/u.test(value), { message: 'path separators rejected' })

const safeLabelSchema = z.string().min(1).max(160)

const sessionRowSchema = z.strictObject({
  sessionRef: safeSessionRefSchema,
  label: safeLabelSchema,
  buckets: tokenBucketsSchema,
})

const providerRowSchema = z.strictObject({
  providerId: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9._-]*$/u),
  label: safeLabelSchema,
  buckets: tokenBucketsSchema,
})

const usageSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(TOKEN_USAGE_SCHEMA_VERSION),
  generatedAt: z.string().datetime(),
  freshness: z.enum(['fresh', 'stale', 'unknown']),
  currentSession: sessionRowSchema.optional(),
  windows: z.strictObject({
    today: tokenBucketsSchema,
    week: tokenBucketsSchema,
    process: tokenBucketsSchema,
  }),
  bySession: z.array(sessionRowSchema).max(20),
  byProvider: z.array(providerRowSchema).max(64),
  truncated: z.boolean(),
})

const balanceInfoSchema = z.strictObject({
  currency: z.enum(['CNY', 'USD']),
  totalBalance: z.string().regex(/^\d+(\.\d+)?$/u),
  grantedBalance: z.string().regex(/^\d+(\.\d+)?$/u),
  toppedUpBalance: z.string().regex(/^\d+(\.\d+)?$/u),
})

const balanceSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(TOKEN_BALANCE_SCHEMA_VERSION),
  status: z.enum(['ready', 'unavailable', 'unsupported', 'error']),
  freshness: z.enum(['fresh', 'stale', 'unknown']),
  generatedAt: z.string().datetime(),
  reasonCode: z
    .enum(['provider_not_deepseek', 'credential_missing', 'network_failed', 'contract_mismatch'])
    .optional(),
  safeMessage: z.string().min(1).max(200),
  isAvailable: z.boolean().optional(),
  infos: z.array(balanceInfoSchema).max(4).optional(),
})

/** Validate a usage snapshot built by the ledger; throws zod error when unsafe. */
export function parseUsageSnapshot(value: unknown): TokenUsageSnapshotV1 {
  // The cast only erases zod's optional-field `| undefined` variance against
  // exactOptionalPropertyTypes; the whitelist check above is the real gate.
  return usageSnapshotSchema.parse(value) as TokenUsageSnapshotV1
}

/** Validate a balance snapshot; throws zod error when unsafe. */
export function parseBalanceSnapshot(value: unknown): TokenBalanceSnapshotV1 {
  return balanceSnapshotSchema.parse(value) as TokenBalanceSnapshotV1
}

/**
 * Reject non-finite/negative bucket payloads from the projection feed before
 * they can touch the ledger. Returns null for anything not a safe bucket set.
 */
export function readBucketsPayload(value: unknown):
  | { readonly uncachedInputTokens: number; readonly outputTokens: number; readonly cacheReadTokens: number; readonly cacheWriteTokens: number }
  | null {
  const parsed = tokenBucketsSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/* ------------------------------------------------------------------ *
 * session.insights.snapshot.v1alpha1 whitelist                        *
 * ------------------------------------------------------------------ */

const safeRefSchema = safeSessionRefSchema

const ianaTimeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(value => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value })
      return true
    } catch {
      return false
    }
  }, { message: 'IANA time zone required' })

/** Query input whitelist. Unknown (credential-shaped) keys are rejected. */
export const insightsQueryInputSchema = z
  .strictObject({
    sessionRef: safeRefSchema,
    scope: z.enum(['session', 'run', 'range']).optional(),
    runRef: safeRefSchema.optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    timeZone: ianaTimeZoneSchema.optional(),
    includeDescendants: z.boolean().optional(),
    cursor: z.string().min(1).max(512).optional(),
    limit: z.number().finite().int().min(1).max(SESSION_INSIGHTS_MAX_LIMIT).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.scope === 'run' && value.runRef === undefined) {
      ctx.addIssue({ code: 'custom', message: 'scope=run requires runRef' })
    }
    if (value.scope === 'range' && (value.from === undefined || value.to === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'scope=range requires from and to' })
    }
  })

/** Parse a query input; returns undefined for anything off the whitelist. */
export function parseInsightsQueryInput(value: unknown): SessionInsightsQueryInputV1 | undefined {
  const parsed = insightsQueryInputSchema.safeParse(value)
  return parsed.success ? (parsed.data as SessionInsightsQueryInputV1) : undefined
}

const nullableCount = z.number().finite().int().nonnegative().nullable()

const insightsBucketsSchema = z.strictObject({
  uncachedInputTokens: nullableCount,
  outputTokens: nullableCount,
  cacheReadTokens: nullableCount,
  cacheWriteTokens: nullableCount,
})

const decimalAmountSchema = z.string().regex(/^\d+(\.\d+)?$/u)

const insightsCostSchema = z.strictObject({
  kind: z.enum(['settled', 'estimate']),
  amount: decimalAmountSchema,
  currency: z.string().regex(/^[A-Z]{3}$/u),
  source: z.string().min(1).max(120).optional(),
  effectiveAt: z.string().datetime().optional(),
})

const insightsCoverageSchema = z.strictObject({
  status: z.enum(['complete', 'partial', 'unknown']),
  knownRequests: z.number().finite().int().nonnegative().optional(),
  missingUsageRequests: z.number().finite().int().nonnegative().optional(),
  availableRange: z
    .strictObject({ from: z.string().datetime(), to: z.string().datetime() })
    .optional(),
  missingReason: z.string().min(1).max(200).optional(),
})

const insightsSourceSchema = z.strictObject({
  history: z.enum(['session_query', 'unavailable']),
  context: z.enum(['session_projections', 'unavailable']),
  cost: z.enum(['provider_settled', 'price_snapshot', 'unknown']),
})

const insightsContextSchema = z.strictObject({
  status: z.enum(['available', 'unavailable']),
  used: z.number().finite().int().nonnegative().optional(),
  limit: z.number().finite().int().nonnegative().optional(),
  remaining: z.number().finite().int().nonnegative().optional(),
  reason: z.string().min(1).max(200).optional(),
})

const breakdownRowSchema = z.strictObject({
  key: z.string().min(1).max(160),
  label: z.string().min(1).max(160),
  requestCount: z.number().finite().int().nonnegative(),
  buckets: insightsBucketsSchema,
})

const breakdownSchema = z.strictObject({
  rows: z.array(breakdownRowSchema).max(SESSION_INSIGHTS_BREAKDOWN_BOUND),
  truncated: z.boolean(),
})

const requestRowSchema = z.strictObject({
  attemptRef: safeRefSchema,
  requestRef: safeRefSchema.optional(),
  runRef: safeRefSchema.optional(),
  sessionRef: safeRefSchema,
  eventRef: safeRefSchema.optional(),
  happenedAt: z.string().datetime().optional(),
  buckets: insightsBucketsSchema.nullable(),
  model: z.string().min(1).max(160).optional(),
  provider: z.string().min(1).max(64).optional(),
  cost: insightsCostSchema.optional(),
  durationMs: z.number().finite().nonnegative().optional(),
  status: z.enum(['completed', 'cancelled', 'failed', 'unknown']),
})

const insightsTotalsSchema = z.strictObject({
  buckets: insightsBucketsSchema,
  requestCount: nullableCount,
  missingUsageRequests: z.number().finite().int().nonnegative().optional(),
  sumRequestDurationMs: nullableCount,
  wallClockMs: nullableCount,
  cost: z.array(insightsCostSchema).max(16).optional(),
})

const insightsReasonCodeSchema = z.enum([
  'history_source_unavailable',
  'history_read_failed',
  'run_scope_unavailable',
  'bucket_semantics_unknown',
  'usage_missing',
  'timestamps_missing',
  'descendant_merge_unverified',
  'context_source_unavailable',
])

const insightsSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(SESSION_INSIGHTS_SCHEMA_VERSION),
  sessionRef: safeRefSchema,
  scope: z.enum(['session', 'run', 'range']),
  revision: z.number().finite().int().nonnegative(),
  generatedAt: z.string().datetime(),
  freshness: z.enum(['fresh', 'stale', 'unknown']),
  coverage: insightsCoverageSchema,
  source: insightsSourceSchema,
  totals: insightsTotalsSchema,
  context: insightsContextSchema,
  inherited: z
    .strictObject({ requestCount: z.number().finite().int().nonnegative(), buckets: insightsBucketsSchema })
    .optional(),
  descendants: z
    .strictObject({
      status: z.enum(['merged', 'unavailable']),
      reason: z.string().min(1).max(200).optional(),
      requestCount: z.number().finite().int().nonnegative().optional(),
      buckets: insightsBucketsSchema.optional(),
    })
    .optional(),
  byModel: breakdownSchema,
  byProvider: breakdownSchema,
  requests: z.array(requestRowSchema).max(SESSION_INSIGHTS_MAX_LIMIT),
  nextCursor: z.string().min(1).max(512).optional(),
  truncated: z.boolean(),
  reasonCode: insightsReasonCodeSchema.optional(),
  safeMessage: z.string().min(1).max(300).optional(),
})

/** Validate an insights snapshot; throws zod error when unsafe. */
export function parseInsightsSnapshot(value: unknown): SessionInsightsSnapshotV1 {
  return insightsSnapshotSchema.parse(value) as SessionInsightsSnapshotV1
}
