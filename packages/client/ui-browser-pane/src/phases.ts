/**
 * Local phases and provider status gating (browser-pane 2.3).
 *
 * `search_only`, `needs_contract`, and `unavailable` must never render live
 * controls or fake page state: this module derives, from the reducer state
 * plus the probe result, which surface regions are enabled — fail-closed.
 *
 * @module @yeisme/dsh-client-ui-browser-pane
 */
import type { BrowserPanePhase, BrowserPaneStateV1 } from './reducer.js'

export interface BrowserPaneSurfaceGatingV1 {
  /** Live viewport / navigation / control surfaces render at all. */
  readonly liveControls: boolean
  /** Any page state (tabs, location, status) may be shown. */
  readonly pageState: boolean
  /** Honest reason code surfaced to the user. */
  readonly reason: 'ok' | 'search_only' | 'needs_contract' | 'unavailable' | 'stale' | 'reconciling' | 'loading'
  /** Suggested search handoff when only search is available. */
  readonly suggestSearchFallback: boolean
}

export function gateBrowserPaneSurfaces(state: BrowserPaneStateV1): BrowserPaneSurfaceGatingV1 {
  const phase = state.phase
  switch (phase) {
    case 'unavailable':
    case 'needs_contract':
    case 'search_only':
      return { liveControls: false, pageState: false, reason: phase, suggestSearchFallback: phase === 'search_only' }
    case 'stale':
      return { liveControls: false, pageState: true, reason: 'stale', suggestSearchFallback: false }
    case 'reconciling':
    case 'loading':
      return { liveControls: false, pageState: state.snapshot !== undefined, reason: phase, suggestSearchFallback: false }
    case 'live':
      return { liveControls: true, pageState: true, reason: 'ok', suggestSearchFallback: false }
  }
}

/** Guard: a phase renders fake page state only if a validated snapshot exists. */
export function phaseMayShowPageState(phase: BrowserPanePhase, snapshotExists: boolean): boolean {
  return gateBrowserPaneSurfaces({ phase, snapshot: snapshotExists ? {} as never : undefined, lastSequence: 0, generation: 0, activePageRef: undefined, lastReceipt: undefined }).pageState
}
