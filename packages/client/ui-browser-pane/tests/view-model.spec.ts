import { describe, expect, it } from 'vitest'
import { BROWSER_PANE_INITIAL_STATE, reduceBrowserPane, type BrowserPaneStateV1 } from '../src/reducer.js'
import { deriveBrowserPaneView } from '../src/view-model.js'

const snapshot = { schemaVersion: 'browser.automation.projection.v0.1', generation: 2, cursor: 10, freshness: 'fresh', safeMessage: 'ok', pages: [
  { pageRef: 'page:1', location: { protocol: 'https:', host: 'a.example', pathDigest: 'a1b2c3d4e5', title: 'A' }, status: 'ready', agentActivityCount: 0 },
  { pageRef: 'page:2', location: { protocol: 'https:', host: 'b.example', pathDigest: 'b1b2c3d4e5', title: undefined }, status: 'loading', agentActivityCount: 0 },
], activePageRef: 'page:1', controlHolder: 'agent' } as never

function live(): BrowserPaneStateV1 { return reduceBrowserPane(BROWSER_PANE_INITIAL_STATE, { type: 'snapshot', snapshot }) }

describe('browser pane view model (browser-pane 2.4)', () => {
  it('live state renders tabs, safe navigation, viewport binding, and control indicator', () => {
    const view = deriveBrowserPaneView(live())
    expect(view.tabs).toHaveLength(2)
    expect(view.tabs[0]).toMatchObject({ host: 'a.example', active: true, status: 'ready' })
    expect(view.tabs[1]).toMatchObject({ title: 'b.example', active: false }) // falls back to host
    expect(view.navigation.safeLocation).toEqual({ protocol: 'https:', host: 'a.example' })
    expect(view.navigation).toMatchObject({ canGoBack: true, canReload: true })
    expect(view.viewportPageRef).toBe('page:1')
    expect(view.controlIndicator).toEqual({ holder: 'agent', humanMayTakeOver: true })
    expect(view.drawerSections).toContain('receipt')
  })

  it('caps tabs at 32 owner pages', () => {
    const flood = { ...snapshot, pages: Array.from({ length: 40 }, (_, i) => ({ pageRef: `page:${i}`, location: { protocol: 'https:' as const, host: 'x.example', pathDigest: 'a1b2c3d4e5', title: 'x' }, status: 'ready' as const, agentActivityCount: 0 })) } as never
    const view = deriveBrowserPaneView(reduceBrowserPane(BROWSER_PANE_INITIAL_STATE, { type: 'snapshot', snapshot: flood }))
    expect(view.tabs).toHaveLength(32)
  })

  it('degraded phases render no tabs, viewport, or controls — only the honest reason', () => {
    const degraded = reduceBrowserPane(live(), { type: 'provider_unavailable', reason: 'search_only' })
    const view = deriveBrowserPaneView(degraded)
    expect(view.tabs).toEqual([])
    expect(view.viewportPageRef).toBeUndefined()
    expect(view.navigation).toMatchObject({ canGoBack: false, canReload: false })
    expect(view.controlIndicator.humanMayTakeOver).toBe(false)
    expect(view.drawerSections).toEqual([])
    expect(view.reason).toBe('search_only')
  })

  it('stale keeps read-only tabs and drawers without live controls or takeover', () => {
    const stale = { ...live(), phase: 'stale' as const }
    const view = deriveBrowserPaneView(stale)
    expect(view.tabs).toHaveLength(2)
    expect(view.viewportPageRef).toBeUndefined()
    expect(view.controlIndicator.humanMayTakeOver).toBe(false)
  })
})
