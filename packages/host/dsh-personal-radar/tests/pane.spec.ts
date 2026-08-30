import { describe, expect, it } from 'vitest'
import {
  createRadarPaneState,
  renderRadarPane,
  updateRadarPane,
  type RadarPaneStateV1,
} from '../src/pane.js'
import { RADAR_STATUSES, type RadarProjectionV1 } from '../src/contracts.js'
import { FAKE_RADAR_DEMO_PROJECTION } from '../src/provider.js'

function loaded(overrides: Partial<RadarProjectionV1> = {}): RadarPaneStateV1 {
  return updateRadarPane(createRadarPaneState(80, 24), {
    type: 'projection_loaded',
    projection: { ...FAKE_RADAR_DEMO_PROJECTION, ...overrides } as RadarProjectionV1,
  })
}

describe('radar pane reducer lifecycle', () => {
  it('rebuilds from owner refs after a reload', () => {
    const before = loaded()
    const reopened = createRadarPaneState(80, 24)
    const after = updateRadarPane(reopened, {
      type: 'projection_loaded',
      projection: FAKE_RADAR_DEMO_PROJECTION as RadarProjectionV1,
    })
    expect(after.projection?.editionRef).toBe(before.projection?.editionRef)
    expect(after.view).toBe('list')
  })

  it('opens detail for a known ref and shows three scores, reasons, and limitations', () => {
    const state = updateRadarPane(loaded(), { type: 'open_detail', ref: 'opp:demo-1' })
    expect(state.view).toBe('detail')
    const frame = renderRadarPane(state)
    expect(frame).toContain('market 82 · personal fit 91 · risk 24')
    expect(frame).toContain('rising 7-day demand')
    expect(frame).toContain('platform signal is china-only')
  })

  it('rejects unknown refs without leaving the list view', () => {
    const state = updateRadarPane(loaded(), { type: 'open_detail', ref: 'opp:nope' })
    expect(state.view).toBe('list')
    expect(state.message).toContain('unknown opportunity ref')
  })

  it('compare requires two selections and stays discardable', () => {
    let state = loaded()
    state = updateRadarPane(state, { type: 'start_compare' })
    expect(state.view).toBe('list')
    expect(state.message).toContain('select two opportunities')
    state = updateRadarPane(state, { type: 'key', key: 'c' })
    state = updateRadarPane(state, { type: 'key', key: 'down' })
    state = updateRadarPane(state, { type: 'key', key: 'c' })
    state = updateRadarPane(state, { type: 'start_compare' })
    expect(state.view).toBe('compare')
    state = updateRadarPane(state, { type: 'key', key: 'escape' })
    expect(state.view).toBe('list')
  })

  it('blocks mutations while not ready and announces the safe next action', () => {
    const state = updateRadarPane(loaded({ status: 'offline' }), { type: 'key', key: 's' })
    expect(state.message).toContain('mutation disabled while offline')
  })

  it('restores focus to the opportunity context after a receipt', () => {
    let state = loaded()
    state = updateRadarPane(state, { type: 'key', key: 'down' })
    const ref = state.projection!.opportunities[state.focusIndex]!.opportunityRef
    state = updateRadarPane(state, { type: 'action_submitted', ref })
    expect(state.status).toBe('action_pending')
    state = updateRadarPane(state, { type: 'action_receipt', ref, outcome: 'submitted', message: 'saved' })
    expect(state.status).toBe('ready')
    expect(state.projection!.opportunities[state.focusIndex]!.opportunityRef).toBe(ref)
    expect(state.focusMemory).toBeUndefined()
  })

  it('unknown receipts move the pane to reconcile_required', () => {
    let state = loaded()
    state = updateRadarPane(state, { type: 'action_submitted', ref: 'opp:demo-1' })
    state = updateRadarPane(state, { type: 'action_receipt', ref: 'opp:demo-1', outcome: 'unknown', message: 'owner outcome unknown' })
    expect(state.status).toBe('reconcile_required')
    expect(state.message).toContain('Reconcile by run ref')
    expect(renderRadarPane(state)).toContain('reconcile required')
  })

  it('covers the full status matrix with a safe next action each', () => {
    for (const status of RADAR_STATUSES) {
      const state = updateRadarPane(createRadarPaneState(), { type: 'projection_failed', status, message: `forced ${status}` })
      expect(state.status).toBe(status)
      expect(state.message).toBeTruthy()
      expect(renderRadarPane(state)).toContain(status.replace(/_/gu, ' '))
    }
  })

  it('stale projections stay read-only with a refresh hint', () => {
    const state = loaded({ status: 'stale' })
    const frame = renderRadarPane(state)
    expect(frame).toContain('stale edition')
    expect(frame).toContain('refresh')
  })
})

describe('radar pane fixed-size rendering', () => {
  it('renders deterministic frames at fixed sizes', () => {
    const state = loaded()
    const wide = renderRadarPane(state, 80, 24)
    expect(wide.split('\n')).toHaveLength(24)
    for (const line of wide.split('\n')) expect(line.length).toBe(80)
    const narrow = renderRadarPane(state, 40, 12)
    expect(narrow.split('\n')).toHaveLength(12)
    for (const line of narrow.split('\n')) expect(line.length).toBe(40)
  })

  it('degrades compare to sequential detail on narrow screens', () => {
    let state = loaded()
    state = updateRadarPane(state, { type: 'key', key: 'c' })
    state = updateRadarPane(state, { type: 'key', key: 'down' })
    state = updateRadarPane(state, { type: 'key', key: 'c' })
    state = updateRadarPane(state, { type: 'start_compare' })
    const narrow = renderRadarPane(state, 60, 16)
    expect(narrow).toContain('narrow layout')
    expect(narrow).not.toContain(' | ')
    const wide = renderRadarPane(state, 100, 16)
    expect(wide).toContain(' | ')
  })

  it('keyboard focus order is stable across the list', () => {
    let state = loaded()
    state = updateRadarPane(state, { type: 'key', key: 'down' })
    state = updateRadarPane(state, { type: 'key', key: 'down' })
    state = updateRadarPane(state, { type: 'key', key: 'down' })
    expect(state.focusIndex).toBe(2)
    state = updateRadarPane(state, { type: 'key', key: 'down' })
    expect(state.focusIndex).toBe(2)
    state = updateRadarPane(state, { type: 'key', key: 'up' })
    expect(state.focusIndex).toBe(1)
  })
})
