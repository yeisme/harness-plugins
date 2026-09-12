import { expect, it } from 'vitest'
import { PaneActionReceiptSchema } from '@yeisme/dsh-pane-protocol'
import { eikonaGenerationPaneReceipt } from '../src/eikona-generation-pane-receipt.ts'

it.each(['accepted', 'running', 'unknown', 'cancel_requested', 'partial', 'failed', 'rejected', 'cancelled', 'succeeded'] as const)('maps owner %s into the shared Pane receipt without adopting assets', ownerState => {
  const result = eikonaGenerationPaneReceipt({ status: 'observed', operationRef: `own_${'a'.repeat(24)}`, receiptRef: `own_${'a'.repeat(24)}`, ownerState, generationConfirmed: ownerState === 'succeeded', runId: 'run_owner_fixture' })
  expect(PaneActionReceiptSchema.safeParse(result).success).toBe(true)
  expect(result.status === 'completed').toBe(ownerState === 'succeeded')
  expect(result.outputArtifacts).toBeUndefined()
  expect(result.evidenceRefs).toEqual(['run_owner_fixture'])
  if (ownerState === 'partial') expect(result.status).toBe('partial')
  if (ownerState === 'cancelled') expect(result.summary).toContain('cancellation')
})
it('keeps failed reconciliation unresolved even after permission changes', () => {
  expect(eikonaGenerationPaneReceipt({ status: 'permission_denied' }, 'reconcile').status).toBe('reconcile_required')
  expect(eikonaGenerationPaneReceipt({ status: 'unconfirmed' }).status).toBe('unknown')
  expect(eikonaGenerationPaneReceipt({ status: 'permission_denied' }).status).toBe('rejected')
})
