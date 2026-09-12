import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { inspectEikonaGenerationReceipt } from '../src/eikona-generation-receipt.ts'
const operation = `own_${'a'.repeat(24)}`
const run = `run_owner_${createHash('sha256').update(operation).digest('hex').slice(0, 32)}`
const base = { schema: 'eikona.owner.receipt.v1', receipt_ref: operation, operation_ref: operation, state: 'succeeded', outcome_refs: [run] }
it('accepts only the original canonical run as a completed generation', () => {
  expect(inspectEikonaGenerationReceipt(base, operation)).toMatchObject({ status: 'observed', generationConfirmed: true, runId: run })
})
it.each(['accepted', 'running', 'unknown', 'failed', 'partial', 'cancelled', 'cancel_requested', 'rejected'])('preserves %s without claiming completion', state => {
  expect(inspectEikonaGenerationReceipt({ ...base, state })).toMatchObject({ status: 'observed', ownerState: state, generationConfirmed: false })
})
it.each([
  { ...base, outcome_refs: [] }, { ...base, outcome_refs: ['run_other'] },
  { ...base, receipt_ref: `own_${'b'.repeat(24)}` },
  { ...base, outcome_refs: [run, run] }, { ...base, child_refs: ['child'] },
  { ...base, provider_payload: 'private' },
])('does not accept inconsistent or unbounded result %j', value => {
  expect(inspectEikonaGenerationReceipt(value)).toEqual({ status: 'unconfirmed' })
})
it('rejects a different operation during reconciliation', () => {
  expect(inspectEikonaGenerationReceipt(base, `own_${'b'.repeat(24)}`)).toEqual({ status: 'unconfirmed' })
  expect(inspectEikonaGenerationReceipt({ ...base, state: 'running', outcome_refs: [] })).toMatchObject({ status: 'observed', generationConfirmed: false })
})
