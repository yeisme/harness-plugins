/**
 * Browser pane view model (browser-pane 2.4).
 *
 * Derives the non-singleton `dsh.browser` view's renderable regions from the
 * gated reducer state: page tabs, navigation toolbar with safe location
 * display, video viewport binding, control indicator, and the activity/
 * evidence/download/receipt drawer rows. Pure projection — the React layer
 * (2.10) renders exactly these shapes and nothing else.
 *
 * @module @yeisme/dsh-client-ui-browser-pane
 */
import type { BrowserPaneSnapshotV1 } from '@yeisme/dsh-browser-host'
import type { BrowserPaneStateV1 } from './reducer.js'
import { gateBrowserPaneSurfaces } from './phases.js'

export interface BrowserPageTabV1 {
  readonly pageRef: string
  readonly host: string
  readonly title: string
  readonly active: boolean
  readonly status: string
}

export interface BrowserNavigationViewV1 {
  /** Redacted safe location for display; never the full target. */
  readonly safeLocation: { readonly protocol: string; readonly host: string } | undefined
  readonly canGoBack: boolean
  readonly canGoForward: boolean
  readonly canReload: boolean
  readonly canStop: boolean
}

export type BrowserDrawerSection = 'activity' | 'evidence' | 'download' | 'receipt'

export interface BrowserPaneViewModelV1 {
  readonly tabs: readonly BrowserPageTabV1[]
  readonly navigation: BrowserNavigationViewV1
  readonly viewportPageRef: string | undefined
  readonly controlIndicator: { readonly holder: 'agent' | 'human' | 'none'; readonly humanMayTakeOver: boolean }
  readonly drawerSections: readonly BrowserDrawerSection[]
  readonly phase: BrowserPaneStateV1['phase']
  readonly reason: string
}

const MAX_TABS = 32

/** Builds the view model; degraded phases yield empty tabs/viewport and no controls. */
export function deriveBrowserPaneView(state: BrowserPaneStateV1): BrowserPaneViewModelV1 {
  const gating = gateBrowserPaneSurfaces(state)
  const snapshot: BrowserPaneSnapshotV1 | undefined = gating.pageState ? state.snapshot : undefined
  const tabs = (snapshot?.pages ?? []).slice(0, MAX_TABS).map(page => ({
    pageRef: page.pageRef,
    host: page.location.host,
    title: page.location.title ?? page.location.host,
    active: page.pageRef === state.activePageRef,
    status: page.status,
  }))
  const activePage = snapshot?.pages.find(page => page.pageRef === state.activePageRef)
  return {
    tabs,
    navigation: {
      safeLocation: activePage === undefined ? undefined : { protocol: activePage.location.protocol, host: activePage.location.host },
      canGoBack: gating.liveControls,
      canGoForward: gating.liveControls,
      canReload: gating.liveControls,
      canStop: gating.liveControls,
    },
    viewportPageRef: gating.liveControls ? state.activePageRef : undefined,
    controlIndicator: {
      holder: snapshot?.controlHolder ?? 'none',
      humanMayTakeOver: gating.liveControls && snapshot?.controlHolder !== 'human',
    },
    drawerSections: gating.pageState ? ['activity', 'evidence', 'download', 'receipt'] : [],
    phase: state.phase,
    reason: gating.reason,
  }
}
