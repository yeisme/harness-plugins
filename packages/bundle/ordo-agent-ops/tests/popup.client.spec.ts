import { describe, expect, it } from 'vitest'
import {
  applyOrdoPopupKey,
  canSubmitOrdoPopupMutation,
  createOrdoPopupItems,
  createOrdoPopupState,
  openOrdoPopup,
  selectOrdoPopupItem,
} from '../src/client/popup.ts'
import type { OrdoAgentOpsSnapshot } from '../src/client/contracts.ts'

function snapshot(overrides: Partial<OrdoAgentOpsSnapshot> = {}): OrdoAgentOpsSnapshot {
  return {
    schemaVersion: 'ordo.agent_ops.snapshot.v1alpha1',
    snapshotRef: 'snapshot-1' as OrdoAgentOpsSnapshot['snapshotRef'],
    snapshotVersion: 1,
    generatedAt: '2026-08-14T00:00:00.000Z',
    state: 'ready',
    freshness: 'fresh',
    reasonCode: 'owner_snapshot',
    source: 'owner',
    safeMessage: 'owner projection',
    run: {
      runRef: 'run-1' as never,
      state: 'active',
      safeTitle: 'Safe run summary',
      taskCount: 3,
      completedTaskCount: 1,
      attentionCount: 0,
    },
    ...overrides,
  }
}

describe('Ordo local popup menu', () => {
  it('builds exact /ordo lines from the safe snapshot and never from free text', () => {
    const items = createOrdoPopupItems(snapshot())
    expect(items.map((item) => item.line)).toEqual([
      '/ordo status run-1',
      '/ordo preview current',
      '/ordo approvals',
      '/ordo evidence',
      '/ordo capacity',
      '/ordo help',
      '/ordo qualify current',
      '/ordo reconcile run-1',
      '/ordo approve current-decision',
    ])
    expect(items.every((item) => item.line.startsWith('/ordo '))).toBe(true)
  })

  it('selects the focused exact line and focuses the Agent Ops panel', () => {
    let state = openOrdoPopup(createOrdoPopupState(snapshot()))
    state = applyOrdoPopupKey(state, { key: 'ArrowDown' })
    const selected = selectOrdoPopupItem(state)
    expect(selected.line).toBe('/ordo preview current')
    expect(selected.state.panelFocused).toBe(true)
    expect(selected.state.open).toBe(false)
    expect(selected.state.announcement).toContain('Agent Ops panel focused')
  })

  it('disables mutations when the snapshot is stale, offline, denied, or mismatched', () => {
    for (const blocked of [
      snapshot({ freshness: 'stale', state: 'stale', reasonCode: 'context_stale' }),
      snapshot({ freshness: 'offline', state: 'offline', reasonCode: 'owner_projection_unavailable' }),
      snapshot({ state: 'permission_denied', reasonCode: 'permission_denied' }),
      snapshot({ state: 'contract_mismatch', reasonCode: 'contract_mismatch' }),
    ]) {
      expect(canSubmitOrdoPopupMutation(blocked)).toBe(false)
      const items = createOrdoPopupItems(blocked)
      expect(items.filter((item) => item.mutation).every((item) => item.disabled)).toBe(true)
      const selected = selectOrdoPopupItem({
        ...openOrdoPopup(createOrdoPopupState(blocked)),
        focusedIndex: items.findIndex((item) => item.id === 'reconcile'),
      })
      expect(selected.line).toBeUndefined()
    }
  })

  it('keeps keyboard focus, screen-reader copy, and reduced motion on the local model', () => {
    let state = createOrdoPopupState(snapshot(), true)
    expect(state.reducedMotion).toBe(true)
    state = applyOrdoPopupKey(state, { key: 'Enter' })
    expect(state.open).toBe(true)
    expect(state.announcement).toContain('/ordo status run-1')
    state = applyOrdoPopupKey(state, { key: 'ArrowUp' })
    expect(state.items[state.focusedIndex]?.id).toBe('approve')
    expect(state.announcement).toContain('unavailable')
    state = applyOrdoPopupKey(state, { key: 'Escape' })
    expect(state.open).toBe(false)
    expect(state.announcement).toBe('Ordo command menu closed')
  })
})
