import { describe, expect, it } from 'vitest'
import { dispatchRadarIntent } from '../src/adapter.js'
import { parseRadarCommand } from '../src/commands.js'
import { validateRadarIntersection } from '../src/intersection.js'
import { createFakeRadarProvider } from '../src/provider.js'
import { probeRadarCapability } from '../src/probe.js'
import { validateRadarIntent, type RadarIntentV1 } from '../src/contracts.js'

const CONFIG = { binary: 'radar' } as const

async function dispatch(line: string, fake: ReturnType<typeof createFakeRadarProvider>, confirm = false) {
  const parsed = parseRadarCommand(line)
  expect(parsed.ok).toBe(true)
  if (!parsed.ok) throw new Error(parsed.reason)
  const intent: RadarIntentV1 = confirm ? { ...parsed.intent, confirmed: true } : parsed.intent
  const intersection = validateRadarIntersection(intent, {
    spec: fake.handoffSpec,
    capabilities: fake.capabilitiesOutput.capabilities,
  })
  expect(intersection.ok).toBe(true)
  if (!intersection.ok) throw new Error(intersection.detail)
  return dispatchRadarIntent(CONFIG, intent, fake.runner)
}

describe('fake radar provider conformance', () => {
  it('probes ready against the fake provider fixtures', async () => {
    const fake = createFakeRadarProvider()
    const probe = await probeRadarCapability({
      binary: 'radar',
      checkBinary: async () => true,
      handoffSpec: fake.handoffSpec,
      capabilities: fake.capabilitiesOutput,
      paneSlotAvailable: true,
    })
    expect(probe.ready).toBe(true)
  })

  it('save/dismiss reach the curator lane and return owner receipts', async () => {
    const fake = createFakeRadarProvider()
    const saved = await dispatch('/drama radar save opp:demo-1', fake)
    expect(saved.ok && saved.receipt.outcome === 'submitted').toBe(true)
    const dismissed = await dispatch('/drama radar dismiss opp:demo-2', fake)
    expect(dismissed.ok && dismissed.receipt.outcome === 'submitted').toBe(true)
    expect(fake.receiptLog.map(entry => entry.lane)).toEqual(['curator', 'curator'])
	expect(fake.requests[0]?.args['input']).toMatchObject({ kind: 'saved' })
	expect(fake.requests[1]?.args['input']).toMatchObject({ kind: 'dismissed' })
  })

  it('refresh reaches only edition_build on the operator lane', async () => {
    const fake = createFakeRadarProvider()
    const refreshed = await dispatch('/drama radar refresh', fake, true)
    expect(refreshed.ok && refreshed.receipt.outcome === 'submitted').toBe(true)
    expect(fake.requests.at(-1)?.lane).toBe('operator')
    expect(fake.requests.at(-1)?.args['action']).toBe('edition_build')
  })

  it('open/compare reach the reader search lane', async () => {
    const fake = createFakeRadarProvider()
    await dispatch('/drama radar compare opp:a opp:b', fake)
    expect(fake.requests.at(-1)?.lane).toBe('reader')
    expect(fake.requests.at(-1)?.tool).toBe('radar.search')
  })
})

describe('contract negative cases', () => {
  it('unregistered intents never reach the spawn layer', async () => {
    const fake = createFakeRadarProvider()
    const forged = {
      schema: 'dsh.radar.intent.v1',
      kind: 'collect',
      opportunityRefs: [],
      idempotencyKey: 'radar-collect-x',
      confirmed: true,
    } as unknown as RadarIntentV1
    const intersection = validateRadarIntersection(forged, {
      spec: fake.handoffSpec,
      capabilities: fake.capabilitiesOutput.capabilities,
    })
    expect(intersection.ok).toBe(false)
    const dispatchResult = await dispatchRadarIntent(CONFIG, forged, fake.runner)
    expect(dispatchResult.ok).toBe(false)
    if (!dispatchResult.ok) expect(dispatchResult.reason).toBe('unregistered_method')
    expect(fake.requests).toHaveLength(0)
  })

  it('daily_run is rejected as an unknown intent, never dispatched', async () => {
    const fake = createFakeRadarProvider()
    const forged = {
      schema: 'dsh.radar.intent.v1',
      kind: 'daily_run',
      opportunityRefs: [],
      idempotencyKey: 'radar-daily_run-x',
      confirmed: true,
    } as unknown as RadarIntentV1
    expect(validateRadarIntent(forged)).toBe(false)
    const dispatchResult = await dispatchRadarIntent(CONFIG, forged, fake.runner)
    expect(dispatchResult.ok).toBe(false)
    expect(fake.requests).toHaveLength(0)
  })

  it('lane-escalated intents are refused before dispatch', async () => {
    const fake = createFakeRadarProvider()
    const parsed = parseRadarCommand('/drama radar save opp:demo-1')
    if (!parsed.ok) throw new Error('parse failed')
    const intersection = validateRadarIntersection(parsed.intent, {
      spec: fake.handoffSpec,
      capabilities: fake.capabilitiesOutput.capabilities,
    }, ['reader'])
    expect(intersection.ok).toBe(false)
    if (!intersection.ok) expect(intersection.reason).toBe('lane_violation')
    expect(fake.requests).toHaveLength(0)
  })

  it('stale/unsafe refs fail intent validation', async () => {
    const parsed = parseRadarCommand('/drama radar save https://phish.example/opp')
    expect(parsed.ok).toBe(false)
    const forged = {
      schema: 'dsh.radar.intent.v1',
      kind: 'save',
      opportunityRefs: ['../etc/passwd'],
      idempotencyKey: 'radar-save-evil',
      confirmed: false,
    } as unknown as RadarIntentV1
    expect(validateRadarIntent(forged)).toBe(false)
  })

  it('the fake owner rejects out-of-lane actions defensively', async () => {
    const fake = createFakeRadarProvider()
    const result = await fake.runner({
      binary: 'radar',
      argv: ['mcp', '--transport', 'stdio', '--lane', 'reader'],
      request: { tool: 'radar.execute', lane: 'reader', args: { action: 'feedback_add', opportunity_ref: 'opp:x' } },
    })
    expect(result.ok).toBe(true)
    expect(result.receipt?.outcome).toBe('rejected')
  })
})
