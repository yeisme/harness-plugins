import { describe, expect, it } from 'vitest'
import {
  assembleSessionStatusSnapshot,
  contextTone,
  projectContext,
} from '../src/projection.ts'
import { SessionStatusService } from '../src/service.ts'

describe('session status projection', () => {
  it('does not invent context remaining from a process ledger', () => {
    const context = projectContext({})
    expect(context.status).toBe('unavailable')
    expect(context.source).toBe('none')
    expect(context.usedTokens).toBeUndefined()
    expect(context.remainingRatio).toBeUndefined()
  })

  it('publishes used/limit/remaining only from owner token-meter facts', () => {
    const snapshot = assembleSessionStatusSnapshot({
      session: { sessionRef: 'sess_1', label: 'Main', lifecycle: 'running' },
      tokenMeter: { usedTokens: 1200, limitTokens: 10000, updatedAt: '2026-09-01T00:00:00.000Z' },
      generatedAt: '2026-09-01T00:00:00.000Z',
    })
    expect(snapshot.status).toBe('ready')
    expect(snapshot.context.usedTokens).toBe(1200)
    expect(snapshot.context.limitTokens).toBe(10000)
    expect(snapshot.context.remainingRatio).toBe(0.88)
    expect(snapshot.context.source).toBe('token-meter')
  })

  it('keeps limits unsupported when no adapter is registered', () => {
    const snapshot = assembleSessionStatusSnapshot({
      session: { sessionRef: 'sess_1', label: 'Main', lifecycle: 'idle' },
      generatedAt: '2026-09-01T00:00:00.000Z',
    })
    expect(snapshot.limits).toEqual([])
    expect(snapshot.status).toBe('partial')
  })

  it('bounds adapter windows at four and never copies balance amounts', () => {
    const adapters = Array.from({ length: 6 }, (_, index) => ({
      id: `a${index}`,
      snapshot: () => ({
        id: `w${index}`,
        label: `Window ${index}`,
        scope: 'rolling' as const,
        status: 'ready' as const,
        remainingRatio: 0.5,
        safeMessage: 'owner window',
      }),
    }))
    const snapshot = assembleSessionStatusSnapshot({
      session: { sessionRef: 'sess_1', label: 'Main', lifecycle: 'idle' },
      tokenMeter: { usedTokens: 1, limitTokens: 10 },
      adapters,
      generatedAt: '2026-09-01T00:00:00.000Z',
    })
    expect(snapshot.limits).toHaveLength(4)
    expect(JSON.stringify(snapshot)).not.toMatch(/balance|apiKey|sk-/)
  })

  it('maps remaining-ratio tones without blocking', () => {
    expect(contextTone(0.88, 'ready')).toBe('neutral')
    expect(contextTone(0.20, 'ready')).toBe('warning')
    expect(contextTone(0.08, 'ready')).toBe('critical')
    expect(contextTone(undefined, 'unavailable')).toBe('neutral')
  })
})

describe('SessionStatusService', () => {
  it('rejects an unsafe session ref', () => {
    const service = new SessionStatusService()
    const result = service.snapshot({ sessionRef: '/abs/path' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('invalid_session_ref')
    }
  })

  it('returns partial when only identity is present', () => {
    const service = new SessionStatusService({
      lookup: {
        identity: sessionRef => ({ sessionRef, label: 'Main', lifecycle: 'idle' }),
      },
      now: () => new Date('2026-09-01T00:00:00.000Z'),
    })
    const result = service.snapshot({ sessionRef: 'sess_1' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.snapshot.status).toBe('partial')
      expect(result.snapshot.context.status).toBe('unavailable')
      expect(result.snapshot.context.remainingRatio).toBeUndefined()
    }
  })
})
