import type { PaneActionReceiptV1 } from '@yeisme/dsh-pane-protocol'
import type { EikonaDiscoveryClient } from './eikona-discovery-client.ts'

type AdoptionResult = Awaited<ReturnType<EikonaDiscoveryClient['submitAdoption']>>
/** Project transport facts into the existing Pane recovery contract. */
export function eikonaAdoptionPaneReceipt(actionId: string, result: AdoptionResult, phase: 'submit' | 'reconcile' = 'submit'): PaneActionReceiptV1 {
  const base = { owner: 'eikona', actionId }
  if (result.status !== 'observed') {
    if (phase === 'reconcile') return { ...base, receiptRef: 'eikona:adoption:unconfirmed', status: 'reconcile_required',
      summary: 'The original Eikona adoption could not be confirmed. Restore access and reconcile the same request.', reconcileReason: 'original_request_unconfirmed' }
    const rejected = result.status === 'invalid_input' || result.status === 'permission_denied' || result.status === 'needs_contract'
    return { ...base, receiptRef: 'eikona:adoption:unconfirmed', status: rejected ? 'rejected' : 'unknown',
      summary: rejected ? 'Eikona adoption was not admitted.' : 'Eikona adoption is unconfirmed. Reconcile the original request.',
      ...(!rejected ? { reconcileReason: 'original_request_unconfirmed' } : {}),
    }
  }
  const receiptRef = result.receiptRef
  if (result.adoptionConfirmed && result.decisionRef) return { ...base, receiptRef, status: 'completed', summary: 'Eikona confirmed candidate adoption.', evidenceRefs: [result.decisionRef] }
  if (result.ownerState === 'rejected' || result.ownerState === 'failed') return { ...base, receiptRef, status: result.ownerState, summary: 'Eikona did not adopt this candidate.' }
  return { ...base, receiptRef, status: 'unknown', summary: 'Eikona adoption has not settled. Reconcile the original request.', reconcileReason: 'owner_operation_unsettled' }
}
