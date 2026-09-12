import { createHash } from 'node:crypto'
import { z } from 'zod'

const operationRef = z.string().regex(/^own_[a-f0-9]{24}$/u)
const receipt = z.object({
  schema: z.literal('eikona.owner.receipt.v1'), receipt_ref: operationRef, operation_ref: operationRef,
  contract_id: z.literal('eikona.generation.submit.v1'), action: z.literal('eikona.generation.submit'),
  state: z.enum(['accepted', 'running', 'succeeded', 'rejected', 'failed', 'partial', 'cancelled', 'cancel_requested', 'unknown']),
  outcome_refs: z.array(z.string().max(160)).max(1).optional(), child_refs: z.array(z.string()).max(0).optional(),
  reason_code: z.string().regex(/^[A-Za-z0-9._-]{1,160}$/u).optional(),
  created_at: z.string().datetime({ offset: true }), updated_at: z.string().datetime({ offset: true }),
}).strict()
const submitted = receipt.omit({ contract_id: true, action: true, created_at: true, updated_at: true })

/** Receipt facts never imply adoption or permission to repeat generation. */
export function inspectEikonaGenerationReceipt(input: unknown, expectedOperation?: string) {
  const parsed = z.union([receipt, submitted]).safeParse(input)
  if (!parsed.success) return { status: 'unconfirmed' as const }
  const value = parsed.data
  const runId = `run_owner_${createHash('sha256').update(value.operation_ref).digest('hex').slice(0, 32)}`
  const outcome = value.outcome_refs?.[0]
  if (value.receipt_ref !== value.operation_ref || (expectedOperation !== undefined && value.operation_ref !== expectedOperation)
    || (outcome !== undefined && outcome !== runId) || (value.state === 'succeeded' && outcome === undefined)) return { status: 'unconfirmed' as const }
  return { status: 'observed' as const, operationRef: value.operation_ref, receiptRef: value.receipt_ref, ownerState: value.state,
    generationConfirmed: value.state === 'succeeded', ...(outcome === undefined ? {} : { runId: outcome }),
    ...(value.reason_code === undefined ? {} : { reasonCode: value.reason_code }) }
}

/** Reconcile must carry the full generation contract identity, unlike submit. */
export function inspectEikonaRecoveredGenerationReceipt(input: unknown, expectedOperation?: string) {
  const parsed = receipt.safeParse(input)
  return parsed.success ? inspectEikonaGenerationReceipt(parsed.data, expectedOperation) : { status: 'unconfirmed' as const }
}
