import type { PaneActionReceiptV1 } from '@yeisme/dsh-pane-protocol'
import type { EikonaDiscoveryClient } from './eikona-discovery-client.ts'
import { EIKONA_GENERATE_ACTION } from './eikona-generation-request.ts'

type Result = Awaited<ReturnType<EikonaDiscoveryClient['submitGeneration']>>
/** Run evidence is not an adopted artifact or a delivery receipt. */
export function eikonaGenerationPaneReceipt(result: Result, phase: 'submit' | 'reconcile' = 'submit'): PaneActionReceiptV1 {
  const base = { owner: 'eikona', actionId: EIKONA_GENERATE_ACTION }
  if (result.status !== 'observed') {
    const rejected = phase === 'submit' && ['invalid_input', 'permission_denied', 'needs_contract'].includes(result.status)
    return { ...base, receiptRef: 'eikona:generation:unconfirmed', status: rejected ? 'rejected' : phase === 'reconcile' ? 'reconcile_required' : 'unknown',
      summary: rejected ? 'Eikona generation was not admitted.' : 'Eikona generation is unconfirmed. Reconcile the original request without submitting again.',
      ...(!rejected ? { reconcileReason: 'original_generation_unconfirmed' } : {}) }
  }
  const observed = { ...base, receiptRef: result.receiptRef, ...(result.runId ? { evidenceRefs: [result.runId] } : {}) }
  if (result.generationConfirmed && result.runId) return { ...observed, status: 'completed', summary: 'Eikona confirmed generation. Review the candidates before adoption or delivery.' }
  if (result.ownerState === 'partial') return { ...observed, status: 'partial', summary: 'Eikona reported partial generation. Preserve completed results and inspect the original run.', reconcileReason: 'generation_partial' }
  if (result.ownerState === 'failed' || result.ownerState === 'rejected') return { ...observed, status: result.ownerState, summary: 'Eikona generation did not succeed. Inspect the original run before any new approval.' }
  // The shared Pane vocabulary has no cancelled terminal: expose the owner
  // fact in the summary without pretending cancellation is successful output.
  if (result.ownerState === 'cancelled') return { ...observed, status: 'failed', summary: 'Eikona confirmed generation cancellation. Existing run evidence is retained.' }
  return { ...observed, status: 'unknown', summary: `Eikona generation state: ${result.ownerState}. Reconcile the original operation.`, reconcileReason: 'owner_generation_unsettled' }
}
