import { expect, it } from 'vitest'
import { inspectEikonaAdoptionReceipt } from '../src/eikona-adoption-receipt.ts'
const expected = { runId: 'run', candidateId: 'candidate', decisionVersion: 0 }
function fixture(state = 'succeeded') { return { schema: 'eikona.owner.receipt.v1', operation_ref: `own_${'a'.repeat(24)}`, receipt_ref: `own_${'a'.repeat(24)}`, contract_id: 'eikona.review.decide.v1', action: 'eikona.review.decide', state, created_at: '2026-09-08T00:00:00Z', updated_at: '2026-09-08T00:00:00Z' } }
it('confirms only a succeeded receipt for the expected candidate and next decision version', () => {
  expect(inspectEikonaAdoptionReceipt({ ...fixture(), outcome_refs: ['decision:run:candidate:v1'] }, expected)).toMatchObject({ status: 'observed', adoptionConfirmed: true })
  for (const input of [fixture(), { ...fixture(), outcome_refs: ['decision:run:other:v1'] }, { ...fixture(), outcome_refs: ['decision:run:candidate:v2'] }, { ...fixture(), child_refs: ['unexpected'] }]) {
    expect(inspectEikonaAdoptionReceipt(input, expected).status).toBe('unconfirmed')
  }
})
it('preserves accepted and unknown operation identities without claiming adoption', () => {
  for (const state of ['accepted', 'running', 'unknown', 'rejected', 'failed']) {
    expect(inspectEikonaAdoptionReceipt(fixture(state), expected)).toMatchObject({ status: 'observed', ownerState: state, adoptionConfirmed: false })
  }
})

it('accepts the actual compact submit response only with its exact fixed outcome', () => {
  const full = fixture()
  const compact = { schema: full.schema, operation_ref: full.operation_ref, receipt_ref: full.receipt_ref, state: 'succeeded', outcome_refs: ['decision:run:candidate:v1'] }
  expect(inspectEikonaAdoptionReceipt(compact, expected)).toMatchObject({ status: 'observed', adoptionConfirmed: true })
  expect(inspectEikonaAdoptionReceipt({ ...compact, action: 'unverified-partial-contract' }, expected).status).toBe('unconfirmed')
})

it('rejects another operation even when the candidate outcome matches', () => {
  const input = { ...fixture(), outcome_refs: ['decision:run:candidate:v1'] }
  expect(inspectEikonaAdoptionReceipt(input, { ...expected, operationRef: `own_${'b'.repeat(24)}` }).status).toBe('unconfirmed')
  expect(inspectEikonaAdoptionReceipt(input, { ...expected, operationRef: input.operation_ref })).toMatchObject({ status: 'observed', adoptionConfirmed: true })
})
