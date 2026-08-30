import { describe, expect, it } from 'vitest'
import {
  RADAR_FIXED_ARGV,
  dispatchRadarIntent,
  isSafeRadarBinary,
  resolveRadarSpawn,
  type RadarSpawnDescriptorV1,
} from '../src/adapter.js'
import { RADAR_INTENT_SCHEMA, type RadarIntentV1 } from '../src/contracts.js'

function intent(kind: RadarIntentV1['kind'], refs: readonly string[] = []): RadarIntentV1 {
  return {
    schema: RADAR_INTENT_SCHEMA,
    kind,
    opportunityRefs: refs,
    idempotencyKey: `radar-${kind}-${refs.join('.')}`,
    confirmed: kind === 'refresh',
  }
}

const runnerOk = async (_descriptor: RadarSpawnDescriptorV1) => ({ ok: true, receipt: { outcome: 'submitted' as const, reason: 'ok' } })

describe('radar fixed-command adapter', () => {
  it('spawns the frozen argv for the intent lane', () => {
    const spawn = resolveRadarSpawn({ binary: 'radar' }, intent('save', ['opp:demo-1']))
    expect(spawn).toBeDefined()
    expect(spawn!.argv).toEqual([...RADAR_FIXED_ARGV, '--lane', 'curator'])
    expect(spawn!.request.tool).toBe('radar.execute')
    expect(spawn!.request.args['action']).toBe('feedback_add')
    expect(spawn!.request.args['feedback']).toBe('save')
  })

  it('maps refresh to operator edition_build only', () => {
    const spawn = resolveRadarSpawn({ binary: 'radar' }, intent('refresh'))
    expect(spawn!.argv).toEqual([...RADAR_FIXED_ARGV, '--lane', 'operator'])
    expect(spawn!.request.args['action']).toBe('edition_build')
    expect(JSON.stringify(spawn!.request.args)).not.toMatch(/collect|daily_run/)
  })

  it('maps open/compare to the reader search lane', () => {
    const spawn = resolveRadarSpawn({ binary: 'radar' }, intent('compare', ['opp:a', 'opp:b']))
    expect(spawn!.argv).toContain('--lane')
    expect(spawn!.request.tool).toBe('radar.search')
    expect(spawn!.request.lane).toBe('reader')
  })

  it('fails closed on unsafe binary names', () => {
    expect(isSafeRadarBinary('radar')).toBe(true)
    expect(isSafeRadarBinary('/usr/bin/radar')).toBe(false)
    expect(isSafeRadarBinary('radar --evil')).toBe(false)
    expect(isSafeRadarBinary('../radar')).toBe(false)
    expect(resolveRadarSpawn({ binary: '/tmp/radar' }, intent('open', []))).toBeUndefined()
  })

  it('fails closed when the runner rejects', async () => {
    const result = await dispatchRadarIntent({ binary: 'radar' }, intent('save', ['opp:x']), async () => {
      throw new Error('spawn blew up')
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('spawn_failed')
  })

  it('surfaces unknown outcomes without retrying', async () => {
    const result = await dispatchRadarIntent({ binary: 'radar' }, intent('save', ['opp:x']), async () => ({
      ok: false,
      error: 'killed mid-flight',
    }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.receipt.outcome).toBe('unknown')
      expect(result.receipt.idempotencyKey).toBe('radar-save-opp:x')
    }
  })

  it('passes through owner receipts unchanged', async () => {
    const result = await dispatchRadarIntent({ binary: 'radar' }, intent('refresh'), runnerOk)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.receipt.outcome).toBe('submitted')
  })
})
