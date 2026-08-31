/**
 * Bounded browser pane reducer (browser-pane 2.2).
 *
 * Consumes validated PaneEventEnvelopeV1-shaped events against the local
 * phase machine: duplicate events drop, gaps invalidate (reconcile), a
 * generation or context/session/page/epoch switch resets state, late events
 * from an older generation never overwrite newer facts, and receipts land as
 * typed outcomes. Pure and synchronous — the controller owns IO.
 *
 * @module @yeisme/dsh-client-ui-browser-pane
 */
import type { BrowserPaneEventV1, BrowserPaneSnapshotV1 } from '@yeisme/dsh-browser-host'

export type BrowserPanePhase = 'unavailable' | 'needs_contract' | 'search_only' | 'loading' | 'live' | 'stale' | 'reconciling'

export interface BrowserPaneStateV1 {
  readonly phase: BrowserPanePhase
  readonly snapshot: BrowserPaneSnapshotV1 | undefined
  readonly lastSequence: number
  readonly generation: number
  readonly activePageRef: string | undefined
  readonly lastReceipt: { readonly actionId: string; readonly status: string } | undefined
}

export const BROWSER_PANE_INITIAL_STATE: BrowserPaneStateV1 = Object.freeze({
  phase: 'loading',
  snapshot: undefined,
  lastSequence: 0,
  generation: 0,
  activePageRef: undefined,
  lastReceipt: undefined,
}) as BrowserPaneStateV1

export type BrowserPaneAction =
  | { readonly type: 'snapshot'; readonly snapshot: BrowserPaneSnapshotV1 }
  | { readonly type: 'event'; readonly event: BrowserPaneEventV1 }
  | { readonly type: 'invalidate' }
  | { readonly type: 'reconciled'; readonly snapshot: BrowserPaneSnapshotV1 }
  | { readonly type: 'provider_unavailable'; readonly reason: 'needs_contract' | 'search_only' | 'unavailable' }
  | { readonly type: 'switch_page'; readonly pageRef: string }

export function reduceBrowserPane(state: BrowserPaneStateV1, action: BrowserPaneAction): BrowserPaneStateV1 {
  switch (action.type) {
    case 'snapshot': {
      const generationJump = state.generation !== 0 && action.snapshot.generation !== state.generation
      return {
        phase: action.snapshot.freshness === 'offline' ? 'stale' : 'live',
        snapshot: action.snapshot,
        lastSequence: action.snapshot.cursor,
        generation: action.snapshot.generation,
        activePageRef: action.snapshot.activePageRef ?? state.activePageRef,
        lastReceipt: generationJump ? undefined : state.lastReceipt,
      }
    }
    case 'event': {
      // Late events from an older generation never overwrite newer facts.
      if (state.generation !== 0 && action.event.generation !== state.generation) {
        return state.phase === 'reconciling' ? state : { ...state, phase: 'reconciling' }
      }
      // Duplicate (replayed sequence) drops.
      if (action.event.sequence <= state.lastSequence) return state
      // Gap → invalidate (caller reconciles; no synthetic facts).
      if (action.event.sequence > state.lastSequence + 1) {
        return { ...state, phase: 'reconciling' }
      }
      const snapshot = state.snapshot === undefined ? undefined : { ...state.snapshot, cursor: action.event.sequence }
      let lastReceipt = state.lastReceipt
      if (action.event.kind === 'receipt') {
        lastReceipt = { actionId: 'owner', status: action.event.safeSummary }
      }
      return { ...state, snapshot, lastSequence: action.event.sequence, lastReceipt, phase: 'live' }
    }
    case 'invalidate':
      return { ...state, phase: 'reconciling' }
    case 'reconciled':
      return reduceBrowserPane({ ...state, lastSequence: 0 }, { type: 'snapshot', snapshot: action.snapshot })
    case 'provider_unavailable':
      return { ...BROWSER_PANE_INITIAL_STATE, phase: action.reason === 'unavailable' ? 'unavailable' : action.reason }
    case 'switch_page':
      return state.activePageRef === action.pageRef ? state : { ...state, activePageRef: action.pageRef }
  }
}
