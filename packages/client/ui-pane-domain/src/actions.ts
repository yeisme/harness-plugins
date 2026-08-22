/** Owner action admission. The Pane never infers success from timeout or local UI. */

import type { PaneStatus } from '@yeisme/dsh-pane-protocol'
import type { DomainActionV1, DomainSnapshotV1 } from './snapshot.js'

export type DomainActionAdmission =
  | { readonly kind: 'allowed'; readonly actionId: string }
  | { readonly kind: 'approval_required'; readonly actionId: string }
  | { readonly kind: 'not_available'; readonly actionId: string; readonly reason: string }
  | { readonly kind: 'paused'; readonly actionId: string; readonly reason: string }

const PAUSED: readonly PaneStatus[] = ['reconcile_required', 'offline', 'contract_mismatch', 'permission_denied', 'unknown']

export function admitDomainAction(snapshot: DomainSnapshotV1, actionId: string): DomainActionAdmission {
  if (PAUSED.includes(snapshot.status)) {
    return { kind: 'paused', actionId, reason: snapshot.status }
  }
  const action = snapshot.allowedActions.find((item: DomainActionV1) => item.id === actionId)
  if (action === undefined) {
    return { kind: 'not_available', actionId, reason: 'owner did not publish this action' }
  }
  if (action.gated) return { kind: 'approval_required', actionId }
  return { kind: 'allowed', actionId }
}

export function interpretTimeout(actionId: string): DomainActionAdmission {
  return { kind: 'paused', actionId, reason: 'unknown' }
}

export const ORDO_OPEN_ACTIONS = ['ordo.reconcile.request', 'ordo.approval.decide'] as const
export const ORDO_CLOSED_ACTIONS = ['run.launch', 'run.cancel', 'run.redispatch', 'lease.release'] as const

export function admitOrdoClientAction(snapshot: DomainSnapshotV1, actionId: string): DomainActionAdmission {
  if ((ORDO_CLOSED_ACTIONS as readonly string[]).includes(actionId)) {
    return { kind: 'not_available', actionId, reason: 'not_available' }
  }
  return admitDomainAction(snapshot, actionId)
}
