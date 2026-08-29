import { describe, expect, it } from 'vitest'
import { BY_SESSION_BOUND, TokenLedger, utcDayKey, utcWeekKey } from '../src/ledger.ts'

const T0 = Date.UTC(2026, 7, 27, 10, 0, 0) // 2026-08-27 (Thursday)

function buckets(uncachedInputTokens: number, outputTokens: number, cacheReadTokens = 0, cacheWriteTokens = 0) {
  return { uncachedInputTokens, outputTokens, cacheReadTokens, cacheWriteTokens }
}

describe('utc window keys', () => {
  it('derives the UTC day key', () => {
    expect(utcDayKey(T0)).toBe('2026-08-27')
    expect(utcDayKey(Date.UTC(2026, 7, 27, 23, 59, 59))).toBe('2026-08-27')
    expect(utcDayKey(Date.UTC(2026, 7, 28, 0, 0, 0))).toBe('2026-08-28')
  })

  it('derives Monday-start UTC ISO week keys', () => {
    expect(utcWeekKey(T0)).toBe('2026-W35')
    expect(utcWeekKey(Date.UTC(2026, 7, 23))).toBe('2026-W34') // Sunday belongs to the prior week
    expect(utcWeekKey(Date.UTC(2026, 7, 24))).toBe('2026-W35') // Monday starts the week
    expect(utcWeekKey(Date.UTC(2026, 0, 1))).toBe('2026-W01')
  })
})

describe('TokenLedger fold semantics', () => {
  it('counts the first observation once (process-start semantics)', () => {
    const ledger = new TokenLedger()
    ledger.observeTokenUsage('session-a', buckets(100, 50), T0)
    const snap = ledger.snapshot({ now: T0 })
    expect(snap.windows.process).toEqual(buckets(100, 50))
    expect(snap.bySession).toHaveLength(1)
    expect(snap.currentSession?.sessionRef).toBe('session-a')
  })

  it('folds signed deltas, not repeated totals', () => {
    const ledger = new TokenLedger()
    ledger.observeTokenUsage('session-a', buckets(100, 50), T0)
    ledger.observeTokenUsage('session-a', buckets(150, 60), T0 + 1_000)
    expect(ledger.snapshot({ now: T0 }).windows.process).toEqual(buckets(150, 60))

    // Replacement sample lowers a step's totals: the delta folds back down.
    ledger.observeTokenUsage('session-a', buckets(140, 55), T0 + 2_000)
    expect(ledger.snapshot({ now: T0 }).windows.process).toEqual(buckets(140, 55))
  })

  it('skips payloads that are not safe bucket sets', () => {
    const ledger = new TokenLedger()
    ledger.observeTokenUsage('session-a', null, T0)
    ledger.observeTokenUsage('session-a', { uncachedInputTokens: -5, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, T0)
    ledger.observeTokenUsage('session-a', { uncachedInputTokens: 1.5, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, T0)
    ledger.observeTokenUsage('../escape', buckets(10, 0), T0)
    ledger.observeTokenUsage('session/with/slash', buckets(10, 0), T0)
    ledger.observeTokenUsage('ok-session', buckets(0, 0, 7, 0), T0)
    const snap = ledger.snapshot({ now: T0 })
    expect(snap.bySession.map(row => row.sessionRef)).toEqual(['ok-session'])
    expect(snap.windows.process).toEqual(buckets(0, 0, 7, 0))
  })

  it('attributes providers from request/context and defaults to unknown', () => {
    const ledger = new TokenLedger()
    ledger.observeProvider('session-a', 'deepseek-official')
    ledger.observeTokenUsage('session-a', buckets(10, 5), T0)
    ledger.observeTokenUsage('session-b', buckets(3, 2), T0)
    const snap = ledger.snapshot({ now: T0 })
    expect(snap.byProvider.map(row => row.providerId)).toEqual(['deepseek-official', 'unknown'])
    expect(snap.byProvider.find(row => row.providerId === 'unknown')?.label).toBe('Unknown provider')
    expect(ledger.lastProvider()).toBe('deepseek-official')
  })

  it('splits day windows and never subtracts when a session leaves the list', () => {
    const ledger = new TokenLedger()
    ledger.observeTokenUsage('session-a', buckets(10, 0), Date.UTC(2026, 7, 26))
    ledger.observeTokenUsage('session-b', buckets(5, 0), T0)
    ledger.forget('session-a')
    const snap = ledger.snapshot({ now: T0 + 60_000 })
    expect(snap.windows.today).toEqual(buckets(5, 0))
    expect(snap.windows.week).toEqual(buckets(15, 0))
    expect(snap.windows.process).toEqual(buckets(15, 0))
  })

  it('bounds bySession at 20 rows and reports truncation', () => {
    const ledger = new TokenLedger()
    for (let index = 0; index < BY_SESSION_BOUND + 5; index += 1) {
      ledger.observeTokenUsage(`session-${index}`, buckets(index + 1, 0), T0 + index)
    }
    const snap = ledger.snapshot({ now: T0 + 10_000 })
    expect(snap.bySession).toHaveLength(BY_SESSION_BOUND)
    expect(snap.truncated).toBe(true)
    // Most recent activity first.
    expect(snap.bySession[0]?.sessionRef).toBe(`session-${BY_SESSION_BOUND + 4}`)
    expect(snap.currentSession?.sessionRef).toBe(`session-${BY_SESSION_BOUND + 4}`)
  })

  it('marks freshness unknown before any observation', () => {
    const ledger = new TokenLedger()
    const snap = ledger.snapshot({ now: T0 })
    expect(snap.freshness).toBe('unknown')
    expect(snap.currentSession).toBeUndefined()
    expect(snap.byProvider).toEqual([])
    expect(snap.truncated).toBe(false)
  })
})
