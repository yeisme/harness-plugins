// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-runtime/client', () => import('../../../bundle/ordo-agent-ops/tests/browser-runtime.mock.ts'))
vi.mock('@deepseek-ai/dsh-client-locale/client', () => import('../../../bundle/ordo-agent-ops/tests/browser-runtime.mock.ts'))
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => import('../../../bundle/ordo-agent-ops/tests/browser-runtime.mock.ts'))

import {
  applyOrdoPopupKey,
  canSubmitOrdoPopupMutation,
  createOrdoPopupState,
  openOrdoPopup,
  selectOrdoPopupItem,
} from '../src/client/index.ts'
import type { OrdoAgentOpsSnapshot } from '../src/client/index.ts'

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

describe('ui-ordo-agent-ops local popup shim', () => {
  it('re-exports the local popup model and submits only exact snapshot lines', () => {
    const selected = selectOrdoPopupItem(openOrdoPopup(createOrdoPopupState(snapshot())))
    expect(selected.line).toBe('/ordo status run-1')
    expect(selected.state.panelFocused).toBe(true)
  })

  it('keeps mutations closed on stale snapshots and remains keyboard reachable', () => {
    const blocked = snapshot({ freshness: 'stale', state: 'stale', reasonCode: 'context_stale' })
    expect(canSubmitOrdoPopupMutation(blocked)).toBe(false)
    let state = applyOrdoPopupKey(createOrdoPopupState(blocked, true), { key: 'Enter' })
    expect(state.open).toBe(true)
    expect(state.reducedMotion).toBe(true)
    state = applyOrdoPopupKey(state, { key: 'Escape' })
    expect(state.open).toBe(false)
  })
})
