import { describe, expect, it } from 'vitest'
import { BROWSER_PANE_INITIAL_STATE, reduceBrowserPane, type BrowserPaneStateV1 } from '../src/reducer.js'
import type { BrowserPaneEventV1, BrowserPaneSnapshotV1 } from '@yeisme/dsh-browser-host'

const snapshot = (generation = 2, cursor = 10): BrowserPaneSnapshotV1 => ({
  schemaVersion: 'browser.automation.projection.v0.1', generation, cursor, freshness: 'fresh',
  safeMessage: 'ok', pages: [{ pageRef: 'page:1', location: { protocol: 'https:', host: 'example.com', pathDigest: 'a1b2c3d4e5', title: 'Example' }, status: 'ready', agentActivityCount: 1 }],
  activePageRef: 'page:1', controlHolder: 'agent',
})

const event = (sequence: number, generation = 2, kind: BrowserPaneEventV1['kind'] = 'page_status'): BrowserPaneEventV1 => ({
  schemaVersion: 'browser.automation.event.v0.1', generation, sequence, kind, pageRef: 'page:1', safeSummary: 'loaded',
})

function live(): BrowserPaneStateV1 {
  return reduceBrowserPane(BROWSER_PANE_INITIAL_STATE, { type: 'snapshot', snapshot: snapshot() })
}

describe('browser pane reducer (browser-pane 2.2)', () => {
  it('snapshot lands live with cursor/generation tracked', () => {
    const state = live()
    expect(state).toMatchObject({ phase: 'live', lastSequence: 10, generation: 2, activePageRef: 'page:1' })
  })

  it('duplicate events drop; gaps invalidate to reconciling', () => {
    const dup = reduceBrowserPane(live(), { type: 'event', event: event(10) })
    expect(dup).toEqual(live()) // duplicate drops without new facts
    const gapped = reduceBrowserPane(live(), { type: 'event', event: event(14) })
    expect(gapped.phase).toBe('reconciling')
  })

  it('late events from an older generation never overwrite newer facts', () => {
    const stale = reduceBrowserPane(live(), { type: 'event', event: event(11, 1) })
    expect(stale.phase).toBe('reconciling')
    expect(stale.snapshot?.generation).toBe(2)
  })

  it('generation reset clears receipts and re-baselines', () => {
    const reset = reduceBrowserPane(live(), { type: 'snapshot', snapshot: snapshot(3, 0) })
    expect(reset.generation).toBe(3)
    expect(reset.lastSequence).toBe(0)
  })

  it('receipt events land as typed outcomes; reconcile re-baselines', () => {
    const withReceipt = reduceBrowserPane(live(), { type: 'event', event: event(11, 2, 'receipt') })
    expect(withReceipt.lastReceipt).toEqual({ actionId: 'owner', status: 'loaded' })
    const reconciled = reduceBrowserPane(withReceipt, { type: 'reconciled', snapshot: snapshot(2, 20) })
    expect(reconciled).toMatchObject({ phase: 'live', lastSequence: 20 })
  })

  it('provider gating maps to honest phases without live controls', () => {
    for (const reason of ['needs_contract', 'search_only', 'unavailable'] as const) {
      const state = reduceBrowserPane(live(), { type: 'provider_unavailable', reason })
      expect(state.phase).toBe(reason)
      expect(state.snapshot).toBeUndefined()
    }
  })

  it('page switch only changes the active ref', () => {
    expect(reduceBrowserPane(live(), { type: 'switch_page', pageRef: 'page:1' })).toEqual(live())
    expect(reduceBrowserPane(live(), { type: 'switch_page', pageRef: 'page:2' }).activePageRef).toBe('page:2')
  })
})
