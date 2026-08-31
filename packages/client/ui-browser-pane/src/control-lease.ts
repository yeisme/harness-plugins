/**
 * Exclusive browser control lease state machine (browser-pane 2.6).
 *
 * `browser.control.takeover` / `browser.control.release` ride this machine:
 * one holder at a time, no dual control, no input replay, no optimistic
 * changes — every transition lands only on an owner receipt. While the human
 * holds the lease, agent input is paused by the owner (BrowserControlLeaseV1)
 * and local input flows only after `granted`.
 *
 * @module @yeisme/dsh-client-ui-browser-pane
 */
export type BrowserControlLeaseState =
  | { readonly holder: 'agent' | 'none' }
  | { readonly holder: 'human'; readonly expiresAt: string }
  | { readonly holder: 'human-pending' }

export type BrowserControlLeaseEvent =
  | { readonly type: 'takeover_requested' }
  | { readonly type: 'takeover_granted'; readonly expiresAt: string }
  | { readonly type: 'takeover_denied'; readonly reason: string }
  | { readonly type: 'takeover_expired' }
  | { readonly type: 'release_requested' }
  | { readonly type: 'release_confirmed' }
  | { readonly type: 'owner_changed'; readonly holder: 'agent' | 'human' | 'none'; readonly expiresAt?: string | undefined }
  | { readonly type: 'invalidated' }

export const BROWSER_CONTROL_INITIAL: BrowserControlLeaseState = { holder: 'agent' }

/** Pure transition table; `undefined` results are ignored (no optimistic flips). */
export function reduceBrowserControlLease(
  state: BrowserControlLeaseState,
  event: BrowserControlLeaseEvent,
): BrowserControlLeaseState {
  switch (event.type) {
    case 'takeover_requested':
      return state.holder === 'agent' || state.holder === 'none' ? { holder: 'human-pending' } : state
    case 'takeover_granted':
      return state.holder === 'human-pending' ? { holder: 'human', expiresAt: event.expiresAt } : state
    case 'takeover_denied':
      return state.holder === 'human-pending' ? { holder: 'agent' } : state
    case 'takeover_expired':
      return state.holder === 'human' ? { holder: 'agent' } : state
    case 'release_requested':
      return state.holder === 'human' ? state : state // stays until the receipt; request alone never flips
    case 'release_confirmed':
      return state.holder === 'human' ? { holder: 'agent' } : state
    case 'owner_changed':
      if (event.holder === 'human') {
        return event.expiresAt === undefined ? state : { holder: 'human', expiresAt: event.expiresAt }
      }
      return { holder: event.holder }
    case 'invalidated':
      return state.holder === 'human-pending' ? { holder: 'agent' } : state
  }
}

/** Input may flow locally only while the human lease is granted (non-bearer). */
export function controlLeaseAllowsLocalInput(state: BrowserControlLeaseState): boolean {
  return state.holder === 'human'
}
