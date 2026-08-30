import { describe, expect, it } from 'vitest'
import { RADAR_INTENT_SCHEMA, type RadarIntentKind, type RadarIntentV1 } from '../src/contracts.js'
import {
  RADAR_INTENT_OPERATIONS,
  isOperatorRefreshOnly,
  validateRadarIntersection,
  type RadarCapabilitySnapshotV1,
} from '../src/intersection.js'
import { createFakeRadarProvider } from '../src/provider.js'

function intent(kind: RadarIntentKind, refs: readonly string[] = [], confirmed = false): RadarIntentV1 {
  return {
    schema: RADAR_INTENT_SCHEMA,
    kind,
    opportunityRefs: refs,
    idempotencyKey: `radar-${kind}-${refs.join('.')}`,
    confirmed,
  }
}

function capabilities(overrides: Record<string, string> = {}): RadarCapabilitySnapshotV1 {
  const fake = createFakeRadarProvider()
  return { spec: fake.handoffSpec, capabilities: { ...fake.capabilitiesOutput.capabilities, ...overrides } }
}

describe('radar lane/operation/capability intersection', () => {
  it('accepts reader search intents with refs in range', () => {
    const result = validateRadarIntersection(intent('compare', ['opp:a', 'opp:b']), capabilities())
    expect(result.ok).toBe(true)
  })

  it('accepts curator feedback intents', () => {
    expect(validateRadarIntersection(intent('save', ['opp:a']), capabilities()).ok).toBe(true)
    expect(validateRadarIntersection(intent('dismiss', ['opp:a']), capabilities()).ok).toBe(true)
  })

  it('collapses the operator intersection to edition_build', () => {
    expect(isOperatorRefreshOnly(RADAR_INTENT_OPERATIONS.refresh.action ?? '')).toBe(true)
    expect(isOperatorRefreshOnly('collect')).toBe(false)
    expect(isOperatorRefreshOnly('daily_run')).toBe(false)
    expect(JSON.stringify(Object.values(RADAR_INTENT_OPERATIONS))).not.toMatch(/collect|daily_run|cluster_build|score/)
  })

  it('rejects unconfirmed refresh as missing_confirmation', () => {
    const result = validateRadarIntersection(intent('refresh'), capabilities())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing_confirmation')
    expect(validateRadarIntersection(intent('refresh', [], true), capabilities()).ok).toBe(true)
  })

  it('rejects lane violations when the needed lane is unavailable', () => {
    const result = validateRadarIntersection(intent('save', ['opp:a']), capabilities(), ['reader'])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('lane_violation')
  })

  it('rejects capabilities that are not ready', () => {
    const result = validateRadarIntersection(intent('save', ['opp:a']), capabilities({ personal_profile_feedback: 'blocked' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('capability_blocked')
  })

  it('rejects spec mismatches as capability_blocked', () => {
    const result = validateRadarIntersection(intent('open', []), { spec: 'radar.mcp.handoff.v0', capabilities: {} })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('capability_blocked')
  })

  it('rejects ref-count violations as missing_ref', () => {
    const result = validateRadarIntersection(intent('compare', ['opp:a']), capabilities())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing_ref')
  })

  it('rejects unregistered kinds with a stable code', () => {
    const forged = { ...intent('open', []), kind: 'collect' } as unknown as RadarIntentV1
    const result = validateRadarIntersection(forged, capabilities())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('unregistered_intent')
  })
})
