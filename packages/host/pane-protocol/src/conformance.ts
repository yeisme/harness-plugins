/**
 * Shared Pane event conformance fixtures. Owner adapters and the client
 * reducer MUST fold these cases to the same status / reconcile reason.
 *
 * @module @yeisme/dsh-pane-protocol/conformance
 */

import {
  PANE_EVENT_SCHEMA,
  type PaneContextV1,
  type PaneEventEnvelopeV1,
} from './index.ts'

export interface PaneConformanceCase {
  readonly id: string
  readonly events: readonly unknown[]
  readonly expectedStatus: string
  readonly expectedReconcileReason?: string
  readonly expectSameReferenceOnLast?: boolean
}

const context: PaneContextV1 = {
  workspaceRef: 'workspace:conformance',
  sessionRef: 'session:one',
  principalRef: 'principal:local',
  revision: '1',
}

function envelope(
  op: PaneEventEnvelopeV1['op'],
  sequence: number,
  payload: unknown,
  extra: Record<string, unknown> = {},
): unknown {
  return {
    schema: PANE_EVENT_SCHEMA,
    stream: 'conformance.stream',
    cursor: `c${sequence}`,
    sequence,
    context,
    occurredAt: '2026-08-21T00:00:00Z',
    observedAt: '2026-08-21T00:00:00Z',
    freshness: 'fresh',
    op,
    payload,
    ...extra,
  }
}

const snapshot = envelope('snapshot', -1, {
  entities: [{ ref: 'note:1', version: 1, value: { title: 'Safe' } }],
  timeline: [],
  receipts: [],
})

/** Ordered cases shared by protocol consumers and the client reducer. */
export const PANE_CONFORMANCE_CASES: readonly PaneConformanceCase[] = [
  {
    id: 'snapshot-required',
    events: [envelope('upsert', 0, { value: { title: 'ignored' } }, { entityRef: 'note:1', entityVersion: 1 })],
    expectedStatus: 'reconcile_required',
    expectedReconcileReason: 'snapshot_required',
  },
  {
    id: 'snapshot-live',
    events: [
      snapshot,
      envelope('upsert', 0, { value: { title: 'Two' } }, { entityRef: 'note:1', entityVersion: 2 }),
    ],
    expectedStatus: 'ready',
  },
  {
    id: 'duplicate-sequence',
    events: [
      envelope('snapshot', 3, { entities: [] }),
      envelope('append', 3, { value: 'duplicate' }),
    ],
    expectedStatus: 'ready',
    expectSameReferenceOnLast: true,
  },
  {
    id: 'sequence-gap',
    events: [snapshot, envelope('append', 6, { value: 'late' })],
    expectedStatus: 'reconcile_required',
    expectedReconcileReason: 'sequence_gap:0:6',
  },
  {
    id: 'expired-cursor-context-switch',
    events: [
      snapshot,
      envelope('append', 0, { value: 'ok' }, {
        context: { ...context, revision: '2' },
      }),
    ],
    expectedStatus: 'reconcile_required',
    expectedReconcileReason: 'context_changed',
  },
  {
    id: 'permission-denied',
    events: [envelope('snapshot', -1, { entities: [] }, { status: 'permission_denied', freshness: 'unknown' })],
    expectedStatus: 'permission_denied',
  },
  {
    id: 'contract-mismatch',
    events: [snapshot, envelope('append', 0, { value: { rawPrompt: 'private' } })],
    expectedStatus: 'contract_mismatch',
  },
  {
    id: 'offline',
    events: [envelope('snapshot', -1, { entities: [] }, { status: 'offline', freshness: 'unknown' })],
    expectedStatus: 'offline',
  },
  {
    id: 'unknown-receipt',
    events: [
      snapshot,
      envelope('action_receipt', 0, {
        status: 'unknown',
        receiptRef: 'receipt:unknown',
        actionId: 'demo.action',
        summary: 'Owner did not confirm',
      }),
    ],
    expectedStatus: 'unknown',
  },
  {
    id: 'action-receipt-approval',
    events: [
      snapshot,
      envelope('action_receipt', 0, {
        status: 'approval_required',
        receiptRef: 'receipt:1',
        actionId: 'render.audio',
        summary: 'Voice rights approval required',
      }),
    ],
    expectedStatus: 'approval_required',
  },
  {
    id: 'idempotent-duplicate-receipt-sequence',
    events: [
      snapshot,
      envelope('action_receipt', 0, {
        status: 'accepted',
        receiptRef: 'receipt:dup',
        actionId: 'note.save',
        summary: 'Saved',
      }),
      envelope('action_receipt', 0, {
        status: 'accepted',
        receiptRef: 'receipt:dup',
        actionId: 'note.save',
        summary: 'Saved',
      }),
    ],
    expectedStatus: 'ready',
    expectSameReferenceOnLast: true,
  },
]
