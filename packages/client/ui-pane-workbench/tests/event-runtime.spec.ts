import { describe, expect, it } from 'vitest'
import { PANE_CONFORMANCE_CASES } from '@yeisme/dsh-pane-protocol/conformance'
import { applyPaneEvent, createPaneProjectionState } from '../src/index.js'
import { event } from './fixtures.js'

describe('pane event runtime', () => {
  it('requires a snapshot before incremental events', () => {
    const initial = createPaneProjectionState(1)
    const next = applyPaneEvent(initial, event('upsert', 0, { value: { title: 'ignored' } }, {
      entityRef: 'note:1',
      entityVersion: 1,
    }))
    expect(next.status).toBe('reconcile_required')
    expect(next.reconcileReason).toBe('snapshot_required')
  })

  it('folds snapshot and contiguous entity updates', () => {
    const initial = createPaneProjectionState(1)
    const snapshot = applyPaneEvent(initial, event('snapshot', -1, {
      entities: [{ ref: 'note:1', version: 1, value: { title: 'One' } }],
      timeline: [],
    }))
    const updated = applyPaneEvent(snapshot, event('upsert', 0, { value: { title: 'Two' } }, {
      entityRef: 'note:1',
      entityVersion: 2,
    }))
    expect(updated.status).toBe('ready')
    expect(updated.entities['note:1']).toEqual({ ref: 'note:1', version: 2, value: { title: 'Two' } })
    expect(updated.sequence).toBe(0)
  })

  it('returns the same state for duplicate or older sequence numbers', () => {
    const snapshot = applyPaneEvent(createPaneProjectionState(1), event('snapshot', 3, { entities: [] }))
    expect(applyPaneEvent(snapshot, event('append', 3, { value: 'duplicate' }))).toBe(snapshot)
    expect(applyPaneEvent(snapshot, event('append', 2, { value: 'older' }))).toBe(snapshot)
  })

  it('preserves the last safe projection on a sequence gap', () => {
    const snapshot = applyPaneEvent(createPaneProjectionState(1), event('snapshot', 3, {
      entities: [{ ref: 'note:1', version: 1, value: { title: 'Safe' } }],
    }))
    const gap = applyPaneEvent(snapshot, event('append', 6, { value: 'late' }))
    expect(gap.status).toBe('reconcile_required')
    expect(gap.reconcileReason).toBe('sequence_gap:4:6')
    expect(gap.entities).toBe(snapshot.entities)
  })

  it('records bounded owner receipts without inferring success from a request', () => {
    const snapshot = applyPaneEvent(createPaneProjectionState(1), event('snapshot', -1, { entities: [] }))
    const approval = applyPaneEvent(snapshot, event('action_receipt', 0, {
      status: 'approval_required',
      receiptRef: 'receipt:1',
      actionId: 'render.audio',
      summary: 'Voice rights approval required',
    }))
    expect(approval.status).toBe('approval_required')
    expect(approval.receipts).toHaveLength(1)
  })

  it('marks invalidated projections stale with an owner reason', () => {
    const snapshot = applyPaneEvent(createPaneProjectionState(1), event('snapshot', -1, { entities: [] }))
    const stale = applyPaneEvent(snapshot, event('invalidate', 0, { reason: 'owner_revision_changed' }))
    expect(stale.status).toBe('stale')
    expect(stale.freshness).toBe('stale')
    expect(stale.reconcileReason).toBe('owner_revision_changed')
  })

  it('fails closed on unsafe or malformed payloads', () => {
    const snapshot = applyPaneEvent(createPaneProjectionState(1), event('snapshot', -1, { entities: [] }))
    const invalid = applyPaneEvent(snapshot, event('append', 0, { value: { rawPrompt: 'private' } }))
    expect(invalid.status).toBe('contract_mismatch')
  })
})
describe('shared pane conformance fixtures', () => {
  it('folds every shared case to the same status as owner adapters', () => {
    for (const item of PANE_CONFORMANCE_CASES) {
      let state = createPaneProjectionState(1)
      let previous = state
      for (const nextEvent of item.events) {
        previous = state
        state = applyPaneEvent(state, nextEvent)
      }
      expect(state.status, item.id).toBe(item.expectedStatus)
      if (item.expectedReconcileReason !== undefined) {
        expect(state.reconcileReason, item.id).toBe(item.expectedReconcileReason)
      }
      if (item.expectSameReferenceOnLast === true) {
        expect(state, item.id).toBe(previous)
      }
    }
  })
})
