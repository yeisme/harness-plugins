import { describe, expect, it } from 'vitest'
import { deriveTokenUsageViewModel, formatTokens } from '../src/client/projection.ts'
import { EMPTY_BUCKETS, type TokenBalanceSnapshotV1, type TokenUsageSnapshotV1 } from '../src/wire.ts'

function usage(overrides: Partial<TokenUsageSnapshotV1> = {}): TokenUsageSnapshotV1 {
  return {
    schemaVersion: 'token.usage.snapshot.v1alpha1',
    generatedAt: '2026-08-27T12:00:00.000Z',
    freshness: 'fresh',
    windows: {
      today: { uncachedInputTokens: 30_000, outputTokens: 5_000, cacheReadTokens: 0, cacheWriteTokens: 0 },
      week: { uncachedInputTokens: 1_150_000, outputTokens: 90_000, cacheReadTokens: 0, cacheWriteTokens: 0 },
      process: { uncachedInputTokens: 1_200_000, outputTokens: 95_000, cacheReadTokens: 0, cacheWriteTokens: 0 },
    },
    bySession: [
      { sessionRef: 'session-1', label: 'session-1', buckets: { uncachedInputTokens: 900, outputTokens: 1_200, cacheReadTokens: 0, cacheWriteTokens: 0 } },
    ],
    byProvider: [{ providerId: 'unknown', label: 'Unknown provider', buckets: EMPTY_BUCKETS }],
    truncated: false,
    ...overrides,
  }
}

function balance(overrides: Partial<TokenBalanceSnapshotV1> = {}): TokenBalanceSnapshotV1 {
  return {
    schemaVersion: 'token.balance.snapshot.v1alpha1',
    status: 'unsupported',
    freshness: 'unknown',
    generatedAt: '2026-08-27T12:00:00.000Z',
    reasonCode: 'provider_not_deepseek',
    safeMessage: 'Balance is available for the DeepSeek official route only.',
    ...overrides,
  }
}

describe('formatTokens', () => {
  it('formats exact small counts and compact large ones', () => {
    expect(formatTokens(0)).toBe('0')
    expect(formatTokens(9_999)).toBe('9999')
    expect(formatTokens(12_400)).toBe('12.4k')
    expect(formatTokens(1_240_000)).toBe('1.2M')
    expect(formatTokens(Number.NaN)).toBe('—')
    expect(formatTokens(-3)).toBe('—')
  })
})

describe('deriveTokenUsageViewModel', () => {
  it('derives window sums, rows, and the ready balance', () => {
    const model = deriveTokenUsageViewModel({
      usage: usage({ currentSession: { sessionRef: 'session-1', label: 'session-1', buckets: { uncachedInputTokens: 900, outputTokens: 1_200, cacheReadTokens: 0, cacheWriteTokens: 0 } } }),
      balance: balance({
        status: 'ready',
        freshness: 'fresh',
        isAvailable: true,
        infos: [{ currency: 'CNY', totalBalance: '110.00', grantedBalance: '10.00', toppedUpBalance: '100.00' }],
      }),
    })
    expect(model.usageAvailable).toBe(true)
    expect(model.currentSession).toEqual({ label: 'session-1', text: formatTokens(2_100) })
    expect(model.todayText).toBe('35.0k')
    expect(model.weekText).toBe('1.2M')
    expect(model.processText).toBe('1.3M')
    expect(model.bySession).toEqual([{ label: 'session-1', text: formatTokens(2_100) }])
    expect(model.balance).toMatchObject({
      visible: true,
      lines: ['CNY 110.00'],
      canRefresh: true,
      message: null,
    })
  })

  it('reports unavailable usage and passes the balance message through', () => {
    const model = deriveTokenUsageViewModel({
      usage: usage({ freshness: 'unknown', bySession: [], byProvider: [], windows: { today: EMPTY_BUCKETS, week: EMPTY_BUCKETS, process: EMPTY_BUCKETS } }),
      balance: balance(),
    })
    expect(model.usageAvailable).toBe(false)
    expect(model.balance.visible).toBe(false)
    expect(model.balance.message).toBe('Balance is available for the DeepSeek official route only.')
  })

  it('degrades short shapes instead of throwing and keeps truncation visible', () => {
    const model = deriveTokenUsageViewModel({
      usage: usage({ truncated: true, windows: undefined as never }),
      balance: undefined,
    })
    expect(model.usageAvailable).toBe(true)
    expect(model.todayText).toBe('0')
    expect(model.truncated).toBe(true)
    expect(model.balance.canRefresh).toBe(true)
    expect(model.balance.message).toBeNull()
  })
})
