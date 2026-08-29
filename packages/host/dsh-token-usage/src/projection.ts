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
  TOKEN_BALANCE_SCHEMA_VERSION,
  TOKEN_USAGE_SCHEMA_VERSION,
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
