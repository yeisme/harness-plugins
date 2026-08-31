import { describe, expect, it } from 'vitest'
import { BROWSER_CONTROL_INITIAL, controlLeaseAllowsLocalInput, reduceBrowserControlLease } from '../src/control-lease.js'

const expiry = new Date(Date.now() + 30_000).toISOString()

describe('exclusive control lease state machine (browser-pane 2.6)', () => {
  it('takeover arms pending and only the owner grant flips to human', () => {
    const pending = reduceBrowserControlLease(BROWSER_CONTROL_INITIAL, { type: 'takeover_requested' })
    expect(pending).toEqual({ holder: 'human-pending' })
    expect(reduceBrowserControlLease(pending, { type: 'takeover_granted', expiresAt: expiry })).toEqual({ holder: 'human', expiresAt: expiry })
  })

  it('no dual control: a second takeover request while human is a no-op', () => {
    const human = { holder: 'human', expiresAt: expiry } as const
    expect(reduceBrowserControlLease(human, { type: 'takeover_requested' })).toBe(human)
  })

  it('no optimistic changes: denial keeps agent; release waits for the receipt', () => {
    const pending = reduceBrowserControlLease(BROWSER_CONTROL_INITIAL, { type: 'takeover_requested' })
    expect(reduceBrowserControlLease(pending, { type: 'takeover_denied', reason: 'busy' })).toEqual({ holder: 'agent' })
    const human = reduceBrowserControlLease(pending, { type: 'takeover_granted', expiresAt: expiry })
    const afterRequest = reduceBrowserControlLease(human, { type: 'release_requested' })
    expect(afterRequest).toBe(human) // request alone never flips
    expect(reduceBrowserControlLease(human, { type: 'release_confirmed' })).toEqual({ holder: 'agent' })
  })

  it('expiry and invalidation return control to the agent; local input gates on granted human', () => {
    const human = reduceBrowserControlLease(reduceBrowserControlLease(BROWSER_CONTROL_INITIAL, { type: 'takeover_requested' }), { type: 'takeover_granted', expiresAt: expiry })
    expect(controlLeaseAllowsLocalInput(human)).toBe(true)
    expect(controlLeaseAllowsLocalInput(BROWSER_CONTROL_INITIAL)).toBe(false)
    expect(controlLeaseAllowsLocalInput({ holder: 'human-pending' })).toBe(false)
    expect(reduceBrowserControlLease(human, { type: 'takeover_expired' })).toEqual({ holder: 'agent' })
  })

  it('owner_changed mirrors the authoritative holder without expiry-less human states', () => {
    expect(reduceBrowserControlLease(BROWSER_CONTROL_INITIAL, { type: 'owner_changed', holder: 'human' })).toEqual({ holder: 'agent' }) // expiry missing → ignored
    expect(reduceBrowserControlLease(BROWSER_CONTROL_INITIAL, { type: 'owner_changed', holder: 'human', expiresAt: expiry })).toEqual({ holder: 'human', expiresAt: expiry })
    expect(reduceBrowserControlLease({ holder: 'human', expiresAt: expiry }, { type: 'owner_changed', holder: 'none' })).toEqual({ holder: 'none' })
  })
})
