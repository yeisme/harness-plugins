import { describe, expect, it } from 'vitest'
import { BROWSER_PANE_INITIAL_STATE, reduceBrowserPane, type BrowserPaneStateV1 } from '../src/reducer.js'
import { gateBrowserPaneSurfaces, phaseMayShowPageState } from '../src/phases.js'

const snapshot = { schemaVersion: 'browser.automation.projection.v0.1', generation: 2, cursor: 10, freshness: 'fresh', safeMessage: 'ok', pages: [{ pageRef: 'page:1', location: { protocol: 'https:', host: 'example.com', pathDigest: 'a1b2c3d4e5', title: 'E' }, status: 'ready', agentActivityCount: 0 }], activePageRef: 'page:1', controlHolder: 'agent' } as never

function state(phase: BrowserPaneStateV1['phase'], withSnapshot: boolean): BrowserPaneStateV1 {
  let s = reduceBrowserPane(BROWSER_PANE_INITIAL_STATE, { type: 'snapshot', snapshot })
  if (phase === 'unavailable' || phase === 'needs_contract' || phase === 'search_only') {
    return reduceBrowserPane(s, { type: 'provider_unavailable', reason: phase })
  }
  if (phase === 'reconciling') return reduceBrowserPane(s, { type: 'invalidate' })
  if (phase === 'stale') return { ...s, phase: 'stale' }
  return withSnapshot ? s : { ...BROWSER_PANE_INITIAL_STATE }
}

describe('surface gating (browser-pane 2.3)', () => {
  it('search_only/needs_contract/unavailable never render live controls or fake page state', () => {
    for (const phase of ['search_only', 'needs_contract', 'unavailable'] as const) {
      const gating = gateBrowserPaneSurfaces(state(phase, true))
      expect(gating, phase).toMatchObject({ liveControls: false, pageState: false })
      expect(gating.reason).toBe(phase)
    }
  })

  it('search fallback is suggested only in search_only', () => {
    expect(gateBrowserPaneSurfaces(state('search_only', true)).suggestSearchFallback).toBe(true)
    expect(gateBrowserPaneSurfaces(state('needs_contract', true)).suggestSearchFallback).toBe(false)
  })

  it('stale keeps read-only page state without live controls; live enables both', () => {
    expect(gateBrowserPaneSurfaces(state('stale', true))).toMatchObject({ liveControls: false, pageState: true, reason: 'stale' })
    expect(gateBrowserPaneSurfaces(state('live', true))).toMatchObject({ liveControls: true, pageState: true, reason: 'ok' })
  })

  it('page state renders only when a validated snapshot exists', () => {
    expect(phaseMayShowPageState('reconciling', true)).toBe(true)
    expect(phaseMayShowPageState('reconciling', false)).toBe(false)
  })
})
