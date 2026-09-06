import { describe, expect, it } from 'vitest'
import {
  parseSessionInsightsQueryInput,
  parseSessionInsightsQueryResult,
  parseSessionInsightsSnapshot,
  parseTokenUsageCapabilitiesAnswer,
  SESSION_INSIGHTS_SCHEMA_VERSION,
  type SessionInsightsSnapshotV1,
} from '../src/wire.ts'

function validSnapshot(overrides: Record<string, unknown> = {}): SessionInsightsSnapshotV1 {
  return {
    schemaVersion: SESSION_INSIGHTS_SCHEMA_VERSION,
    sessionRef: 'sess_a',
    scope: 'session',
    revision: 7,
    generatedAt: '2026-09-05T08:00:00.000Z',
    freshness: 'fresh',
    coverage: { status: 'complete', knownRequests: 2 },
    source: { history: 'session_query', context: 'session_projections', cost: 'provider_settled' },
    totals: {
      buckets: { uncachedInputTokens: 1000, outputTokens: 200, cacheReadTokens: null, cacheWriteTokens: 0 },
      requestCount: 2,
      sumRequestDurationMs: 3000,
      wallClockMs: 1800,
      cost: [{ kind: 'settled', amount: '0.0123', currency: 'CNY' }],
    },
    context: { status: 'available', used: 1200, limit: 10000, remaining: 8800 },
    byModel: {
      rows: [{ key: 'deepseek-chat', label: 'deepseek-chat', requestCount: 2, buckets: { uncachedInputTokens: 1000, outputTokens: 200, cacheReadTokens: null, cacheWriteTokens: 0 } }],
      truncated: false,
    },
    byProvider: {
      rows: [{ key: 'deepseek-official', label: 'deepseek-official', requestCount: 2, buckets: { uncachedInputTokens: 1000, outputTokens: 200, cacheReadTokens: null, cacheWriteTokens: 0 } }],
      truncated: false,
    },
    requests: [
      { attemptRef: 'att_1', requestRef: 'req_1', runRef: 'run_1', sessionRef: 'sess_a', eventRef: 'evt_1', happenedAt: '2026-09-05T07:59:00.000Z', buckets: { uncachedInputTokens: 600, outputTokens: 120, cacheReadTokens: null, cacheWriteTokens: 0 }, model: 'deepseek-chat', provider: 'deepseek-official', durationMs: 1200, status: 'completed' },
      { attemptRef: 'att_2', sessionRef: 'sess_a', buckets: null, status: 'unknown' },
    ],
    truncated: false,
    ...overrides,
  } as SessionInsightsSnapshotV1
}

describe('session insights wire parse', () => {
  it('mirrors a valid snapshot field-for-field, keeping null buckets unknown', () => {
    const parsed = parseSessionInsightsSnapshot(validSnapshot())
    expect(parsed?.revision).toBe(7)
    expect(parsed?.totals.buckets.cacheReadTokens).toBeNull()
    expect(parsed?.requests[1]?.buckets).toBeNull()
    expect(parsed?.totals.cost?.[0]?.amount).toBe('0.0123')
  })

  it('drops credential-shaped keys anywhere in the payload', () => {
    expect(parseSessionInsightsSnapshot({ ...validSnapshot(), apiKey: 'sk-secret' })).toBeNull()
    expect(parseSessionInsightsSnapshot({
      ...validSnapshot(),
      requests: [{ attemptRef: 'att_1', sessionRef: 'sess_a', buckets: null, status: 'completed', authorization: 'Bearer x' }],
    })).toBeNull()
  })

  it('drops forbidden text (paths, URLs, provider key material)', () => {
    expect(parseSessionInsightsSnapshot({
      ...validSnapshot(),
      coverage: { status: 'partial', missingReason: 'read /home/user/log failed' },
    })).toBeNull()
    expect(parseSessionInsightsSnapshot({
      ...validSnapshot(),
      safeMessage: 'see https://example.com/internal',
    })).toBeNull()
  })

  it('rejects unsafe refs and wrong schema versions', () => {
    expect(parseSessionInsightsSnapshot({ ...validSnapshot(), sessionRef: '../etc/passwd' })).toBeNull()
    expect(parseSessionInsightsSnapshot({ ...validSnapshot(), schemaVersion: 'token.usage.snapshot.v1alpha1' })).toBeNull()
    expect(parseSessionInsightsSnapshot({
      ...validSnapshot(),
      requests: [{ attemptRef: 'att/1', sessionRef: 'sess_a', buckets: null, status: 'completed' }],
    })).toBeNull()
  })

  it('rejects invalid bucket numbers instead of zero-filling', () => {
    expect(parseSessionInsightsSnapshot({
      ...validSnapshot(),
      totals: { ...validSnapshot().totals, buckets: { uncachedInputTokens: Number.NaN, outputTokens: 1, cacheReadTokens: null, cacheWriteTokens: 0 } },
    })).toBeNull()
    expect(parseSessionInsightsSnapshot({
      ...validSnapshot(),
      totals: { ...validSnapshot().totals, buckets: { uncachedInputTokens: -3, outputTokens: 1, cacheReadTokens: null, cacheWriteTokens: 0 } },
    })).toBeNull()
  })

  it('enforces the 50-row breakdown and 200-row wire bounds', () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({
      key: `m${index}`, label: `m${index}`, requestCount: 1,
      buckets: { uncachedInputTokens: 1, outputTokens: 1, cacheReadTokens: null, cacheWriteTokens: null },
    }))
    expect(parseSessionInsightsSnapshot({ ...validSnapshot(), byModel: { rows, truncated: true } })).toBeNull()
    const requests = Array.from({ length: 201 }, (_, index) => ({
      attemptRef: `att_${index}`, sessionRef: 'sess_a', buckets: null, status: 'completed' as const,
    }))
    expect(parseSessionInsightsSnapshot({ ...validSnapshot(), requests, truncated: true })).toBeNull()
  })

  it('rejects malformed cost rows (summed currencies stay impossible)', () => {
    expect(parseSessionInsightsSnapshot({
      ...validSnapshot(),
      totals: { ...validSnapshot().totals, cost: [{ kind: 'settled', amount: 'abc', currency: 'CNY' }] },
    })).toBeNull()
    expect(parseSessionInsightsSnapshot({
      ...validSnapshot(),
      totals: { ...validSnapshot().totals, cost: [{ kind: 'settled', amount: '1.0', currency: 'cny' }] },
    })).toBeNull()
  })
})

describe('session insights query result parse', () => {
  it('passes typed failure codes through (stale_cursor stays typed)', () => {
    const parsed = parseSessionInsightsQueryResult({ ok: false, code: 'stale_cursor', message: 'cursor stale' })
    expect(parsed).toMatchObject({ ok: false, code: 'stale_cursor' })
  })

  it('rejects credential-shaped failures and invalid ok answers', () => {
    expect(parseSessionInsightsQueryResult({ ok: false, code: 'stale_cursor', message: 'x', token: 'abc' })).toBeNull()
    expect(parseSessionInsightsQueryResult({ ok: true, specVersion: '1.0', snapshot: { schemaVersion: 'wrong' } })).toBeNull()
  })
})

describe('tokenUsage capabilities parse', () => {
  it('accepts the owner declaration', () => {
    expect(parseTokenUsageCapabilitiesAnswer({
      ok: true,
      specVersion: '1.0',
      capabilities: { query: { available: true, schemaVersion: SESSION_INSIGHTS_SCHEMA_VERSION } },
    })).toMatchObject({ query: { available: true } })
    expect(parseTokenUsageCapabilitiesAnswer({
      ok: true,
      specVersion: '1.0',
      capabilities: { query: { available: false, reason: 'old host' } },
    })).toMatchObject({ query: { available: false, reason: 'old host' } })
  })

  it('rejects unknown shapes and version lies', () => {
    expect(parseTokenUsageCapabilitiesAnswer({ ok: true, specVersion: '1.0', capabilities: { query: { available: true } } })).toBeNull()
    expect(parseTokenUsageCapabilitiesAnswer({ ok: true, specVersion: '1.0', capabilities: { query: { available: 'yes' } } })).toBeNull()
    expect(parseTokenUsageCapabilitiesAnswer({ ok: true, specVersion: '2.0', capabilities: { query: { available: false } } })).toBeNull()
  })
})

describe('session insights query input whitelist', () => {
  it('accepts the documented fields', () => {
    expect(parseSessionInsightsQueryInput({ sessionRef: 'sess_a', scope: 'run', runRef: 'run_1', limit: 200 }))
      .toMatchObject({ sessionRef: 'sess_a', scope: 'run' })
  })

  it('rejects credential keys, unsafe refs, and out-of-range limits', () => {
    expect(() => parseSessionInsightsQueryInput({ sessionRef: 'sess_a', apiKey: 'sk-x' })).toThrow()
    expect(() => parseSessionInsightsQueryInput({ sessionRef: 'a/b' })).toThrow()
    expect(() => parseSessionInsightsQueryInput({ sessionRef: 'sess_a', limit: 201 })).toThrow()
    expect(() => parseSessionInsightsQueryInput({ sessionRef: 'sess_a', scope: 'run' })).toThrow()
    expect(() => parseSessionInsightsQueryInput({ sessionRef: 'sess_a', scope: 'range', from: '2026-09-01T00:00:00Z' })).toThrow()
  })
})
