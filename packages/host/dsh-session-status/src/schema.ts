/**
 * Strict whitelist for session status snapshots.
 *
 * Unknown fields, credential-shaped keys, URLs, absolute paths, and
 * over-long labels fail the whole payload. Limits are capped at 4.
 */

import { z } from 'zod'
import {
  SESSION_STATUS_LIMIT_BOUND,
  SESSION_STATUS_SCHEMA_VERSION,
  type SessionStatusSnapshotV1,
} from './types.ts'

const CREDENTIAL_KEY = /^(api[_-]?key|authorization|cookie|token|password|secret|bearer)$/iu
const FORBIDDEN_VALUE = /(api[_-]?key|bearer\s|authorization|sk-[a-z0-9]|https?:\/\/|\/home\/|\/var\/|\\[a-z]:\\)/iu

export const safeSessionRefSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u)
  .refine(value => !/[\\/]/u.test(value), { message: 'path separators rejected' })

const safeLabelSchema = z.string().min(1).max(160)
const safeMessageSchema = z.string().min(1).max(200)

function rejectCredentialKeys(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true
  return !Object.keys(value as Record<string, unknown>).some(key => CREDENTIAL_KEY.test(key))
}

function rejectForbiddenText(value: unknown): boolean {
  if (typeof value === 'string') {
    return !FORBIDDEN_VALUE.test(value)
  }
  if (Array.isArray(value)) {
    return value.every(rejectForbiddenText)
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(rejectForbiddenText)
  }
  return true
}

const ratioSchema = z.number().finite().min(0).max(1)
const tokenCountSchema = z.number().finite().int().nonnegative()

const sessionIdentitySchema = z.strictObject({
  sessionRef: safeSessionRefSchema,
  label: safeLabelSchema,
  lifecycle: z.enum(['idle', 'running', 'waiting_approval', 'error', 'offline', 'unknown']),
})

const runtimeSchema = z.strictObject({
  providerId: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9._-]*$/u).optional(),
  modelLabel: z.string().min(1).max(80).optional(),
  presetLabel: z.string().min(1).max(80).optional(),
  reasoningLabel: z.string().min(1).max(80).optional(),
  permissionLabel: z.string().min(1).max(80).optional(),
})

const contextSchema = z.strictObject({
  status: z.enum(['ready', 'stale', 'unavailable', 'unsupported']),
  usedTokens: tokenCountSchema.optional(),
  limitTokens: tokenCountSchema.optional(),
  remainingRatio: ratioSchema.optional(),
  updatedAt: z.string().datetime().optional(),
  source: z.enum(['token-meter', 'owner-projection', 'none']),
  safeMessage: safeMessageSchema,
})

const limitSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9._-]*$/u),
  label: safeLabelSchema,
  scope: z.enum(['rolling', 'calendar', 'account', 'unknown']),
  status: z.enum(['ready', 'stale', 'unavailable', 'unsupported']),
  remainingRatio: ratioSchema.optional(),
  resetAt: z.string().datetime().optional(),
  safeMessage: safeMessageSchema,
})

export const sessionStatusSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(SESSION_STATUS_SCHEMA_VERSION),
  revision: z.number().finite().int().nonnegative(),
  generatedAt: z.string().datetime(),
  freshness: z.enum(['fresh', 'stale', 'unknown']),
  status: z.enum(['ready', 'partial', 'unavailable']),
  session: sessionIdentitySchema,
  runtime: runtimeSchema.optional(),
  context: contextSchema,
  limits: z.array(limitSchema).max(SESSION_STATUS_LIMIT_BOUND),
}).refine(rejectCredentialKeys, { message: 'credential-shaped keys rejected' })
  .refine(rejectForbiddenText, { message: 'forbidden payload text rejected' })

export function parseSessionStatusSnapshot(value: unknown): SessionStatusSnapshotV1 {
  return sessionStatusSnapshotSchema.parse(value) as SessionStatusSnapshotV1
}

export function parseSafeSessionRef(value: unknown): string {
  return safeSessionRefSchema.parse(value)
}
