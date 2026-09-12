import { z } from 'zod'

const ref = z.string().min(1).max(512)
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const identity = { batchRef: ref, digest, planDigest: digest, idempotencyKey: z.string().min(1).max(128).refine(value => value.trim() === value && value.length > 0) }
export const eikonaBatchLookupSchema = z.object({ batchRef: ref, idempotencyKey: identity.idempotencyKey }).strict()
export const eikonaBatchReconcileSchema = z.object(identity).strict()
export const eikonaBatchSubmitSchema = z.object({ ...identity, confirmed: z.literal(true), allowUnknownCost: z.boolean() }).strict()
const operationRef = z.string().max(128).regex(/^eikona-batch:[A-Za-z0-9][A-Za-z0-9._:-]{0,114}$/u).refine(value => !value.includes('..'))
const wire = z.object({
  schema_version: z.literal('eikona.batch_operation_preview.v1'), project_ref: ref,
  operation_ref: operationRef, request_batch_ref: ref, request_batch_digest: digest, plan_digest: digest,
  status: z.enum(['planned', 'blocked', 'queued', 'running', 'partial', 'succeeded', 'failed', 'cancelling', 'cancelled']),
  terminal: z.boolean(), attempt_count: z.number().int().nonnegative(), successful_count: z.number().int().nonnegative(),
  failed_count: z.number().int().nonnegative(), cancelled_count: z.number().int().nonnegative(),
}).strict().refine(value => value.terminal === ['partial', 'succeeded', 'failed', 'cancelled'].includes(value.status))

/** Owner facts only: a confirmed observation is not candidate adoption or delivery. */
export function inspectEikonaBatchOperation(input: unknown, expected: { projectRef: string; batchRef: string; digest?: string; planDigest?: string }) {
  const parsed = wire.safeParse(input)
  if (!parsed.success) return { status: 'unconfirmed' } as const
  const value = parsed.data
  if (value.project_ref !== expected.projectRef || value.request_batch_ref !== expected.batchRef || (expected.digest !== undefined && value.request_batch_digest !== expected.digest) || (expected.planDigest !== undefined && value.plan_digest !== expected.planDigest)) return { status: 'unconfirmed' } as const
  return { status: 'observed' as const, projectRef: value.project_ref, batchRef: value.request_batch_ref, digest: value.request_batch_digest, planDigest: value.plan_digest, operationRef: value.operation_ref, operationStatus: value.status, terminal: value.terminal, attemptCount: value.attempt_count, successfulCount: value.successful_count, failedCount: value.failed_count, cancelledCount: value.cancelled_count }
}
