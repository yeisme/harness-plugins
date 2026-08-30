import { describe, expect, it } from 'vitest'
import {
  createRadarPaneState,
  renderRadarPane,
  updateRadarPane,
} from '../src/pane.js'
import type { RadarProjectionV1 } from '../src/contracts.js'
import { FAKE_RADAR_DEMO_PROJECTION } from '../src/provider.js'

function loaded(): ReturnType<typeof createRadarPaneState> {
  return updateRadarPane(createRadarPaneState(80, 24), {
    type: 'projection_loaded',
    projection: FAKE_RADAR_DEMO_PROJECTION as RadarProjectionV1,
  })
}

describe('radar pane fixed-size snapshots', () => {
  it('list view 80x24', () => {
    expect(renderRadarPane(loaded(), 80, 24)).toMatchSnapshot()
  })

  it('detail view 80x24', () => {
    const state = updateRadarPane(loaded(), { type: 'open_detail', ref: 'opp:demo-1' })
    expect(renderRadarPane(state, 80, 24)).toMatchSnapshot()
  })

  it('compare view 100x16', () => {
    let state = loaded()
    state = updateRadarPane(state, { type: 'key', key: 'c' })
    state = updateRadarPane(state, { type: 'key', key: 'down' })
    state = updateRadarPane(state, { type: 'key', key: 'c' })
    state = updateRadarPane(state, { type: 'start_compare' })
    expect(renderRadarPane(state, 100, 16)).toMatchSnapshot()
  })

  it('offline status 60x12', () => {
    const state = updateRadarPane(loaded(), {
      type: 'projection_failed',
      status: 'offline',
      message: 'radar owner unreachable',
    })
    expect(renderRadarPane(state, 60, 12)).toMatchSnapshot()
  })
})
