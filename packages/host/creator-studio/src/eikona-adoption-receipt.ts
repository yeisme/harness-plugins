import { z } from 'zod'
const operationRef = z.string().regex(/^own_[a-f0-9]{24}$/u)
const receipt = z.object({ schema: z.literal('eikona.owner.receipt.v1'), receipt_ref: operationRef, operation_ref: operationRef,
  contract_id: z.literal('eikona.review.decide.v1'), action: z.literal('eikona.review.decide'),
  state: z.enum(['accepted', 'running', 'succeeded', 'rejected', 'failed', 'partial', 'cancelled', 'cancel_requested', 'unknown']),
  outcome_refs: z.array(z.string().max(512)).max(1).optional(), child_refs: z.array(z.string()).max(0).optional(),
  reason_code: z.string().regex(/^[A-Za-z0-9._-]{1,160}$/u).optional(),
  created_at: z.string().datetime({ offset: true }), updated_at: z.string().datetime({ offset: true }),
}).strict()
// The fixed submit route returns SubmitResponse; receipt lookup returns Receipt.
const submissionReceipt = receipt.omit({ contract_id: true, action: true, created_at: true, updated_at: true })

/** Original-key recovery uses the full owner receipt when no preview version was persisted. */
export function inspectEikonaRecoveredAdoptionReceipt(input: unknown, expected: { runId: string; candidateId: string }) {
  const parsed = receipt.safeParse(input)
  if (!parsed.success) return { status: 'unconfirmed' as const }
  const value = parsed.data, prefix = `decision:${expected.runId}:${expected.candidateId}:v`
  const outcome = value.outcome_refs?.[0]
  if (value.operation_ref !== value.receipt_ref || (outcome !== undefined && (!outcome.startsWith(prefix)
    || !/^[1-9][0-9]{0,14}$/u.test(outcome.slice(prefix.length)))) || (value.state === 'succeeded' && outcome === undefined)) return { status: 'unconfirmed' as const }
  return { status: 'observed' as const, operationRef: value.operation_ref, receiptRef: value.receipt_ref, ownerState: value.state,
    adoptionConfirmed: value.state === 'succeeded', ...(outcome === undefined ? {} : { decisionRef: outcome }),
    ...(value.reason_code === undefined ? {} : { reasonCode: value.reason_code }) }
}

/** HTTP acceptance is not candidate adoption; confirm only the fixed decision outcome. */
export function inspectEikonaAdoptionReceipt(input: unknown, expected: { runId: string; candidateId: string; decisionVersion: number; operationRef?: string }) {
  const parsed = z.union([receipt, submissionReceipt]).safeParse(input)
  if (!parsed.success || !Number.isSafeInteger(expected.decisionVersion) || expected.decisionVersion < 0 || expected.decisionVersion >= Number.MAX_SAFE_INTEGER) return { status: 'unconfirmed' as const }
  const value = parsed.data
  if (expected.operationRef !== undefined && value.operation_ref !== expected.operationRef) return { status: 'unconfirmed' as const }
  const outcome = `decision:${expected.runId}:${expected.candidateId}:v${expected.decisionVersion + 1}`
  if (value.receipt_ref !== value.operation_ref || value.outcome_refs?.some(ref => ref !== outcome)
    || (value.state === 'succeeded' && value.outcome_refs?.[0] !== outcome)) return { status: 'unconfirmed' as const }
  return { status: 'observed' as const, operationRef: value.operation_ref, receiptRef: value.receipt_ref,
    ownerState: value.state, adoptionConfirmed: value.state === 'succeeded',
    ...(value.outcome_refs?.[0] === undefined ? {} : { decisionRef: outcome }),
    ...(value.reason_code === undefined ? {} : { reasonCode: value.reason_code }),
  }
}
