import { describe, expect, it } from 'vitest'
import { isRadarBadgeVisible, summarizeRadarBadge } from '../src/badge.js'
import { validateRadarProjection, type RadarProjectionV1 } from '../src/contracts.js'
import { FAKE_RADAR_DEMO_PROJECTION } from '../src/provider.js'

function projection(overrides: Partial<RadarProjectionV1>): RadarProjectionV1 {
  return { ...FAKE_RADAR_DEMO_PROJECTION, ...overrides } as RadarProjectionV1
}

describe('radar context badge', () => {
  it('renders the compact ready summary', () => {
    const badge = summarizeRadarBadge(projection({ status: 'ready' }))
    expect(badge.text).toBe('Radar · 3 fits · 2 new · fresh 38m')
    expect(badge.icon).not.toBe('')
    expect(badge.action).toBe('open_pane')
    expect(validateRadarProjection(projection({ status: 'ready' }))).toBe(true)
  })

  it('expresses every state as text + icon + aria, never color only', () => {
    const states = ['ready', 'empty', 'degraded', 'stale', 'offline', 'permission_denied', 'contract_mismatch', 'action_pending', 'reconcile_required'] as const
    for (const status of states) {
      const badge = summarizeRadarBadge(projection({ status }))
      expect(badge.text.length).toBeGreaterThan(0)
      expect(badge.icon.length).toBeGreaterThan(0)
      expect(badge.ariaLabel.length).toBeGreaterThan(badge.text.length)
      expect(badge.ariaLabel.toLowerCase()).toContain('radar')
    }
  })

  it('degrades offline to a read-only marker with observed time', () => {
    const badge = summarizeRadarBadge(projection({ status: 'offline', observedAt: 1_787_500_000_000 }))
    expect(badge.action).toBe('read_only')
    expect(badge.text).toContain('offline')
    expect(badge.ariaLabel).toContain('Mutations are disabled')
  })

  it('labels stale and degraded states with their safe next action', () => {
    const stale = summarizeRadarBadge(projection({ status: 'stale' }))
    expect(stale.text).toContain('stale')
    expect(stale.ariaLabel).toContain('refresh')
    const degraded = summarizeRadarBadge(projection({ status: 'degraded' }))
    expect(degraded.text).toContain('degraded')
  })

  it('hides the badge for states that carry no summary', () => {
    expect(isRadarBadgeVisible('ready')).toBe(true)
    expect(isRadarBadgeVisible('degraded')).toBe(true)
    expect(isRadarBadgeVisible('offline')).toBe(true)
    expect(isRadarBadgeVisible('empty')).toBe(true)
    expect(isRadarBadgeVisible('permission_denied')).toBe(false)
  })

  it('a11y: disabled states announce the reason in the accessible name', () => {
    const denied = summarizeRadarBadge(projection({ status: 'permission_denied' }))
    expect(denied.ariaLabel).toContain('permission denied')
    const mismatch = summarizeRadarBadge(projection({ status: 'contract_mismatch' }))
    expect(mismatch.ariaLabel).toContain('contract mismatch')
  })
})
