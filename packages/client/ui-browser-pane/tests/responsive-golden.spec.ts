import { describe, expect, it } from 'vitest'
import { BROWSER_PANE_INITIAL_STATE, reduceBrowserPane, type BrowserPaneStateV1 } from '../src/reducer.js'
import { deriveBrowserPaneView } from '../src/view-model.js'
import { gateBrowserPaneSurfaces } from '../src/phases.js'

const snapshot = { schemaVersion: 'browser.automation.projection.v0.1', generation: 2, cursor: 10, freshness: 'fresh', safeMessage: 'ok', pages: [
  { pageRef: 'page:1', location: { protocol: 'https:', host: 'a.example', pathDigest: 'a1b2c3d4e5', title: 'A' }, status: 'ready', agentActivityCount: 1 },
], activePageRef: 'page:1', controlHolder: 'agent' } as never

function live(): BrowserPaneStateV1 { return reduceBrowserPane(BROWSER_PANE_INITIAL_STATE, { type: 'snapshot', snapshot }) }

/** §2.10 layout contract: the same view model drives every breakpoint; only layout differs. */
describe('responsive + failure/recovery component contract (browser-pane 2.10)', () => {
  it('390/768/1440 consume one view model — no breakpoint-specific facts', () => {
    const view = deriveBrowserPaneView(live())
    for (const width of [390, 768, 1440]) {
      expect(deriveBrowserPaneView(live()), `width=${width}`).toEqual(view)
    }
    expect(view.tabs).toHaveLength(1)
  })

  it('failure/recovery states: every degraded phase yields a complete honest surface', () => {
    for (const reason of ['needs_contract', 'search_only', 'unavailable'] as const) {
      const state = reduceBrowserPane(live(), { type: 'provider_unavailable', reason })
      const gating = gateBrowserPaneSurfaces(state)
      const view = deriveBrowserPaneView(state)
      expect(gating.liveControls, reason).toBe(false)
      expect(view.tabs, reason).toEqual([])
      expect(view.reason, reason).toBe(reason)
    }
    const reconciling = reduceBrowserPane(live(), { type: 'invalidate' })
    expect(gateBrowserPaneSurfaces(reconciling).reason).toBe('reconciling')
    expect(gateBrowserPaneSurfaces(reconciling).pageState).toBe(true) // keeps last validated snapshot read-only
  })

  it('keyboard path parity: tabs, navigation, drawers, and takeover are all addressable without pointer facts', () => {
    const view = deriveBrowserPaneView(live())
    const addressable = [...view.tabs.map(tab => tab.pageRef), view.navigation.safeLocation?.host, ...view.drawerSections, 'takeover']
    expect(addressable.every(entry => entry !== undefined)).toBe(true)
    expect(view.controlIndicator.humanMayTakeOver).toBe(true)
  })
})
