import { expect, it } from 'vitest'
import { PaneActionReceiptSchema } from '@yeisme/dsh-pane-protocol'
import { eikonaAdoptionPaneReceipt } from '../src/eikona-pane-receipt.ts'
it('keeps unknown transport outcomes recoverable and never invents adopted artifacts', () => {
  const receipt = eikonaAdoptionPaneReceipt('eikona.adopt', { status: 'unconfirmed' })
  expect(PaneActionReceiptSchema.safeParse(receipt).success).toBe(true)
  expect(receipt.status).toBe('unknown')
  expect(receipt.reconcileReason).toBeTruthy()
  expect(receipt.outputArtifacts).toBeUndefined()
})
it('uses confirmed owner decision evidence and preserves the original receipt', () => {
  const receipt = eikonaAdoptionPaneReceipt('eikona.adopt', { status: 'observed', operationRef: 'own_aaaaaaaaaaaaaaaaaaaaaaaa', receiptRef: 'own_aaaaaaaaaaaaaaaaaaaaaaaa', ownerState: 'succeeded', adoptionConfirmed: true, decisionRef: 'decision:run:candidate:v1' })
  expect(PaneActionReceiptSchema.safeParse(receipt).success).toBe(true)
  expect(receipt).toMatchObject({ status: 'completed', receiptRef: 'own_aaaaaaaaaaaaaaaaaaaaaaaa', evidenceRefs: ['decision:run:candidate:v1'] })
})

it('retains original receipt identity for every unsettled owner state', () => {
  for (const state of ['accepted', 'running', 'partial', 'cancel_requested', 'cancelled', 'unknown'] as const) {
    const receipt = eikonaAdoptionPaneReceipt('eikona.adopt', { status: 'observed', operationRef: 'own_aaaaaaaaaaaaaaaaaaaaaaaa', receiptRef: 'own_aaaaaaaaaaaaaaaaaaaaaaaa', ownerState: state, adoptionConfirmed: false })
    expect(PaneActionReceiptSchema.safeParse(receipt).success).toBe(true)
    expect(receipt).toMatchObject({ status: 'unknown', receiptRef: 'own_aaaaaaaaaaaaaaaaaaaaaaaa', reconcileReason: 'owner_operation_unsettled' })
    expect(receipt.outputArtifacts).toBeUndefined()
  }
})

it('projects explicit owner rejection separately from ambiguous transport failure', () => {
  for (const state of ['failed', 'rejected'] as const) {
    expect(eikonaAdoptionPaneReceipt('eikona.adopt', { status: 'observed', operationRef: 'own_aaaaaaaaaaaaaaaaaaaaaaaa', receiptRef: 'own_aaaaaaaaaaaaaaaaaaaaaaaa', ownerState: state, adoptionConfirmed: false }).status).toBe(state)
  }
  for (const status of ['unconfirmed', 'unavailable'] as const) {
    expect(eikonaAdoptionPaneReceipt('eikona.adopt', { status }).status).toBe('unknown')
  }
})

it('does not turn reconciliation access failure into terminal rejection', () => {
  for (const status of ['permission_denied', 'needs_contract', 'invalid_input', 'unavailable', 'unconfirmed'] as const) {
    const receipt = eikonaAdoptionPaneReceipt('eikona.adopt', { status }, 'reconcile')
    expect(receipt.status).toBe('reconcile_required')
    expect(receipt.reconcileReason).toBeTruthy()
    expect(PaneActionReceiptSchema.safeParse(receipt).success).toBe(true)
  }
})
