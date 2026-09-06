import { describe, expect, it, vi } from 'vitest'
import {
  SessionInaccessibleError,
  SessionInsightsEngine,
  type RawUsageSample,
  type SessionContextRead,
  type SessionHistoryRead,
  type SessionHistorySource,
} from '../src/insights.ts'
import { parseInsightsQueryInput, parseInsightsSnapshot } from '../src/projection.ts'
import { samplesFromSessionLog } from '../src/session-query-source.ts'

const NOW = Date.UTC(2026, 7, 28, 12, 0, 0) // 2026-08-27 +1d noon UTC
const SECRET_SHAPES = /(api[_-]?key|bearer|authorization|sk-[a-z0-9]|api\.deepseek\.com)/iu

function sample(overrides: Partial<RawUsageSample> & { attemptRef: string }): RawUsageSample {
  return { kind: 'final', usage: { inputTokens: 10, outputTokens: 5 }, ...overrides }
}

class MockSource implements SessionHistorySource {
  readonly id = 'session_query' as const
  readonly reads = new Map<string, SessionHistoryRead>()
  readonly errors = new Map<string, unknown>()
  readonly contexts = new Map<string, SessionContextRead>()
  listDescendants?: (sessionRef: string) => Promise<readonly string[]>

  async read(sessionRef: string): Promise<SessionHistoryRead> {
    const error = this.errors.get(sessionRef)
    if (error !== undefined) throw error
    const read = this.reads.get(sessionRef)
    if (read === undefined) throw new SessionInaccessibleError()
    return read
  }

  async readContext(sessionRef: string): Promise<SessionContextRead | undefined> {
    return this.contexts.get(sessionRef)
  }
}

function makeEngine(source: MockSource, options: { chunkSize?: number; schedule?: () => Promise<void> } = {}) {
  return new SessionInsightsEngine(source, {
    now: () => NOW,
    ...(options.chunkSize === undefined ? {} : { chunkSize: options.chunkSize }),
    ...(options.schedule === undefined ? {} : { schedule: options.schedule }),
  })
}

async function queryOk(engine: SessionInsightsEngine, input: Parameters<SessionInsightsEngine['query']>[0]) {
  const result = await engine.query(input)
  if (!result.ok) throw new Error(`expected ok result, got ${result.code}: ${result.message}`)
  return result.snapshot
}

describe('authorized session query', () => {
  it('serves a complete historical session without any new model request', async () => {
    const source = new MockSource()
    source.reads.set('session-a', {
      complete: true,
      samples: [sample({ attemptRef: 't1-s1' }), sample({ attemptRef: 't2-s1', usage: { inputTokens: 4, outputTokens: 2 } })],
    })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(snapshot.coverage.status).toBe('complete')
    expect(snapshot.totals.requestCount).toBe(2)
    expect(snapshot.totals.buckets).toEqual({
      uncachedInputTokens: 14,
      outputTokens: 7,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
    expect(snapshot.source.history).toBe('session_query')
    expect(() => parseInsightsSnapshot(snapshot)).not.toThrow()
  })

  it('rejects inaccessible sessions with a safe reason and no foreign data', async () => {
    const source = new MockSource()
    source.reads.set('session-secret', { complete: true, samples: [sample({ attemptRef: 't1-s1' })] })
    const engine = makeEngine(source)
    const result = await engine.query({ sessionRef: 'session-other' })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.code).toBe('session_inaccessible')
    expect(JSON.stringify(result)).not.toContain('session-secret')
  })

  it('rejects a runRef that does not belong to the session', async () => {
    const source = new MockSource()
    source.reads.set('session-a', {
      complete: true,
      samples: [sample({ attemptRef: 't1-s1', runRef: 'run-1' })],
    })
    const engine = makeEngine(source)
    const result = await engine.query({ sessionRef: 'session-a', scope: 'run', runRef: 'run-9' })
    expect(result).toMatchObject({ ok: false, code: 'invalid_input' })
    const scoped = await queryOk(engine, { sessionRef: 'session-a', scope: 'run', runRef: 'run-1' })
    expect(scoped.totals.requestCount).toBe(1)
  })

  it('marks run scope unavailable when the source cannot attribute runs', async () => {
    const source = new MockSource()
    source.reads.set('session-a', { complete: true, samples: [sample({ attemptRef: 't1-s1' })] })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a', scope: 'run', runRef: 'run-1' })
    expect(snapshot.coverage.status).toBe('unknown')
    expect(snapshot.reasonCode).toBe('run_scope_unavailable')
    expect(snapshot.totals.buckets.uncachedInputTokens).toBeNull()
  })
})

describe('coverage and zero values', () => {
  it('reports partial with known numbers and the missing-usage count', async () => {
    const source = new MockSource()
    const samples: RawUsageSample[] = []
    for (let index = 0; index < 8; index += 1) samples.push(sample({ attemptRef: `a-${index}` }))
    samples.push(sample({ attemptRef: 'a-8', usage: undefined, status: 'failed' }))
    samples.push(sample({ attemptRef: 'a-9', usage: undefined, status: 'cancelled' }))
    source.reads.set('session-a', { complete: true, samples })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(snapshot.coverage).toMatchObject({ status: 'partial', knownRequests: 10, missingUsageRequests: 2 })
    expect(snapshot.reasonCode).toBe('usage_missing')
    expect(snapshot.totals.buckets.uncachedInputTokens).toBe(80)
    // Cancelled/failed rows stay visible with null buckets, not zero-filled.
    const failed = snapshot.requests.find(row => row.attemptRef === 'a-8')
    expect(failed?.status).toBe('failed')
    expect(failed?.buckets).toBeNull()
  })

  it('keeps usage of cancelled/failed requests when the owner reported it', async () => {
    const source = new MockSource()
    source.reads.set('session-a', {
      complete: true,
      samples: [sample({ attemptRef: 'a-1', status: 'cancelled' })],
    })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(snapshot.coverage.status).toBe('complete')
    expect(snapshot.totals.buckets.uncachedInputTokens).toBe(10)
    expect(snapshot.requests[0]?.status).toBe('cancelled')
  })

  it('never fabricates the denominator when the total request count is unknown', async () => {
    const source = new MockSource()
    source.reads.set('session-a', {
      complete: false,
      missingReason: 'history tail unavailable',
      samples: [sample({ attemptRef: 'a-1' }), sample({ attemptRef: 'a-2', usage: undefined })],
    })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(snapshot.coverage.status).toBe('partial')
    expect(snapshot.coverage.knownRequests).toBe(2)
    expect(snapshot.coverage.missingUsageRequests).toBeUndefined()
  })

  it('allows zeros only when the owner confirmed an empty range', async () => {
    const source = new MockSource()
    source.reads.set('session-a', { complete: true, samples: [] })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(snapshot.coverage.status).toBe('complete')
    expect(snapshot.totals.requestCount).toBe(0)
    expect(snapshot.totals.buckets).toEqual({
      uncachedInputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
  })

  it('never zero-fills unknown coverage after a failed history read', async () => {
    const source = new MockSource()
    source.errors.set('session-a', new Error('persistence exploded'))
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(snapshot.coverage.status).toBe('unknown')
    expect(snapshot.reasonCode).toBe('history_read_failed')
    expect(snapshot.totals.buckets).toEqual({
      uncachedInputTokens: null,
      outputTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
    })
    expect(snapshot.totals.requestCount).toBeNull()
    expect(snapshot.freshness).toBe('unknown')
  })
})

describe('idempotent aggregation and bucket normalization', () => {
  it('counts the final cumulative sample once after streaming chunks', async () => {
    const source = new MockSource()
    source.reads.set('session-a', {
      complete: true,
      samples: [
        sample({ attemptRef: 't1-s1', kind: 'chunk', usage: { inputTokens: 10, outputTokens: 5 } }),
        sample({ attemptRef: 't1-s1', kind: 'chunk', usage: { inputTokens: 15, outputTokens: 7 } }),
        sample({ attemptRef: 't1-s1', kind: 'final', usage: { inputTokens: 20, outputTokens: 8 } }),
      ],
    })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(snapshot.totals.requestCount).toBe(1)
    expect(snapshot.totals.buckets.uncachedInputTokens).toBe(20)
    expect(snapshot.totals.buckets.outputTokens).toBe(8)

    // Replaying the same events (HMR / re-subscription) changes nothing.
    const revision = engine.revisionOf('session-a')
    const again = await queryOk(engine, { sessionRef: 'session-a' })
    expect(again.revision).toBe(revision)
    expect(again.totals.buckets.uncachedInputTokens).toBe(20)
  })

  it('counts distinct retry attempts separately', async () => {
    const source = new MockSource()
    source.reads.set('session-a', {
      complete: true,
      samples: [
        sample({ attemptRef: 't1-s1', requestRef: 'req-1', usage: { inputTokens: 10, outputTokens: 5 } }),
        sample({ attemptRef: 't1-s2', requestRef: 'req-1', usage: { inputTokens: 7, outputTokens: 3 } }),
      ],
    })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(snapshot.totals.requestCount).toBe(2)
    expect(snapshot.totals.buckets.uncachedInputTokens).toBe(17)
    expect(snapshot.totals.buckets.outputTokens).toBe(8)
  })

  it('bumps the revision on an equal-total bucket reclassification', async () => {
    const source = new MockSource()
    const read: SessionHistoryRead = {
      complete: true,
      samples: [sample({ attemptRef: 't1-s1', usage: { inputTokens: 100, outputTokens: 50 } })],
    }
    source.reads.set('session-a', read)
    const engine = makeEngine(source)
    const first = await queryOk(engine, { sessionRef: 'session-a' })
    source.reads.set('session-a', {
      complete: true,
      samples: [sample({ attemptRef: 't1-s1', usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 30 } })],
    })
    const second = await queryOk(engine, { sessionRef: 'session-a' })
    expect(second.revision).toBeGreaterThan(first.revision)
    expect(second.totals.buckets).toEqual({
      uncachedInputTokens: 100,
      outputTokens: 20,
      cacheReadTokens: 30,
      cacheWriteTokens: 0,
    })
  })

  it('marks unknown bucket semantics partial and never guesses the subtraction', async () => {
    const source = new MockSource()
    source.reads.set('session-a', {
      complete: true,
      samples: [
        sample({ attemptRef: 'a-1', usage: { inputTokens: 10, outputTokens: 5 } }),
        sample({ attemptRef: 'a-2', usage: { inputTokens: 100, outputTokens: 40, cacheReadTokens: 60 }, bucketSemantics: 'unknown' }),
      ],
    })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(snapshot.coverage.status).toBe('partial')
    expect(snapshot.reasonCode).toBe('bucket_semantics_unknown')
    expect(snapshot.totals.buckets.uncachedInputTokens).toBe(10)
    expect(snapshot.totals.buckets.cacheReadTokens).toBe(0)
  })

  it('normalizes providers that include cache inside input', async () => {
    const source = new MockSource()
    source.reads.set('session-a', {
      complete: true,
      samples: [
        sample({
          attemptRef: 'a-1',
          usage: { inputTokens: 100, outputTokens: 40, cacheReadTokens: 30, cacheWriteTokens: 10 },
          bucketSemantics: 'cache_in_input',
        }),
      ],
    })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(snapshot.coverage.status).toBe('complete')
    expect(snapshot.totals.buckets).toEqual({
      uncachedInputTokens: 60,
      outputTokens: 40,
      cacheReadTokens: 30,
      cacheWriteTokens: 10,
    })
  })

  it('keeps consumption across compaction and host restart without double counting', async () => {
    const samples = [sample({ attemptRef: 't1-s1' }), sample({ attemptRef: 't2-s1', usage: { inputTokens: 4, outputTokens: 2 } })]
    const first = new MockSource()
    first.reads.set('session-a', { complete: true, samples })
    const before = await queryOk(makeEngine(first), { sessionRef: 'session-a' })
    // "Restart": a brand-new engine re-reads the same complete log.
    const second = new MockSource()
    second.reads.set('session-a', { complete: true, samples })
    const after = await queryOk(makeEngine(second), { sessionRef: 'session-a' })
    expect(after.totals.buckets).toEqual(before.totals.buckets)
    expect(after.totals.requestCount).toBe(2)
  })
})

describe('context stays independent from consumption', () => {
  it('shows context while history consumption is unavailable', async () => {
    const source = new MockSource()
    source.errors.set('session-a', new Error('history gone'))
    source.contexts.set('session-a', { used: 1200, limit: 4000 })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(snapshot.coverage.status).toBe('unknown')
    expect(snapshot.context).toEqual({ status: 'available', used: 1200, limit: 4000, remaining: 2800 })
    expect(snapshot.source.context).toBe('session_projections')
  })

  it('reports context unavailable with a reason when the seam is absent', async () => {
    const source = new MockSource()
    source.reads.set('session-a', { complete: true, samples: [sample({ attemptRef: 'a-1' })] })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(snapshot.context.status).toBe('unavailable')
    expect(snapshot.context.reason).toBeTruthy()
    expect(snapshot.source.context).toBe('unavailable')
    // Consumption stays complete — context failure never bleeds into totals.
    expect(snapshot.coverage.status).toBe('complete')
  })
})

describe('event time and durations', () => {
  const FROM = '2026-08-27T00:00:00.000Z'
  const TO = '2026-08-28T00:00:00.000Z'

  it('attributes ranges by actual request time on a half-open [from,to) interval', async () => {
    const source = new MockSource()
    source.reads.set('session-a', {
      complete: true,
      samples: [
        sample({ attemptRef: 'yesterday', happenedAt: Date.parse('2026-08-26T23:00:00.000Z') }),
        sample({ attemptRef: 'at-from', happenedAt: Date.parse(FROM) }),
        sample({ attemptRef: 'midday', happenedAt: Date.parse('2026-08-27T12:00:00.000Z') }),
        sample({ attemptRef: 'at-to', happenedAt: Date.parse(TO) }),
        sample({ attemptRef: 'no-time' }),
      ],
    })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a', scope: 'range', from: FROM, to: TO, timeZone: 'Asia/Shanghai' })
    const included = snapshot.requests.map(row => row.attemptRef).sort()
    expect(included).toEqual(['at-from', 'midday'])
    // Yesterday's consumption is not attributed to today; the timestamp-less
    // request is range-attribution unknown, never counted into today.
    expect(snapshot.reasonCode).toBe('timestamps_missing')
    expect(snapshot.coverage.status).toBe('partial')
    expect(snapshot.totals.requestCount).toBe(2)
  })

  it('keeps the sum of request durations separate from wall clock', async () => {
    const start = Date.parse('2026-08-27T10:00:00.000Z')
    const source = new MockSource()
    source.reads.set('session-a', {
      complete: true,
      samples: [
        sample({ attemptRef: 'a-1', happenedAt: start, durationMs: 5000 }),
        sample({ attemptRef: 'a-2', happenedAt: start, durationMs: 5000 }),
      ],
    })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    // Two parallel 5s requests: 10s of request time, 5s of wall clock.
    expect(snapshot.totals.sumRequestDurationMs).toBe(10_000)
    expect(snapshot.totals.wallClockMs).toBe(5_000)
  })

  it('marks durations unknown instead of partially summing', async () => {
    const source = new MockSource()
    source.reads.set('session-a', {
      complete: true,
      samples: [sample({ attemptRef: 'a-1', durationMs: 100 }), sample({ attemptRef: 'a-2' })],
    })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(snapshot.totals.sumRequestDurationMs).toBeNull()
    expect(snapshot.totals.wallClockMs).toBeNull()
  })
})

describe('fork and sub-agent attribution', () => {
  it('shows inherited fork history separately without re-charging it', async () => {
    const source = new MockSource()
    source.reads.set('session-a', {
      complete: true,
      samples: [
        sample({ attemptRef: 'seed-1', inherited: true, usage: { inputTokens: 50, outputTokens: 20 } }),
        sample({ attemptRef: 'live-1', usage: { inputTokens: 10, outputTokens: 5 } }),
      ],
    })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(snapshot.totals.buckets.uncachedInputTokens).toBe(10)
    expect(snapshot.totals.requestCount).toBe(1)
    expect(snapshot.inherited).toEqual({
      requestCount: 1,
      buckets: { uncachedInputTokens: 50, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 },
    })
  })

  it('merges verified descendants once by authoritative attempt identity', async () => {
    const source = new MockSource()
    source.reads.set('parent', {
      complete: true,
      samples: [sample({ attemptRef: 't1-s1', usage: { inputTokens: 10, outputTokens: 5 } })],
    })
    source.reads.set('child', {
      complete: true,
      samples: [
        // The parent summary already carries this attempt: count once.
        sample({ attemptRef: 't1-s1', usage: { inputTokens: 10, outputTokens: 5 } }),
        sample({ attemptRef: 't9-s9', usage: { inputTokens: 7, outputTokens: 3 } }),
      ],
    })
    source.listDescendants = async () => ['child']
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'parent', includeDescendants: true })
    expect(snapshot.descendants).toMatchObject({ status: 'merged', requestCount: 1 })
    expect(snapshot.totals.buckets.uncachedInputTokens).toBe(17)
    expect(snapshot.totals.requestCount).toBe(2)
  })

  it('disables merging with an explicit reason when the owner relation is unproven', async () => {
    const source = new MockSource()
    source.reads.set('parent', {
      complete: true,
      samples: [sample({ attemptRef: 't1-s1' })],
    })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'parent', includeDescendants: true })
    expect(snapshot.descendants?.status).toBe('unavailable')
    expect(snapshot.descendants?.reason).toBeTruthy()
    expect(snapshot.reasonCode).toBe('descendant_merge_unverified')
    expect(snapshot.coverage.status).toBe('partial')
    expect(snapshot.totals.buckets.uncachedInputTokens).toBe(10)
  })
})

describe('bounded pagination and revision consistency', () => {
  function bigSource(count: number) {
    const source = new MockSource()
    const samples: RawUsageSample[] = []
    for (let index = 0; index < count; index += 1) {
      samples.push(sample({ attemptRef: `a-${String(index).padStart(6, '0')}`, happenedAt: Date.UTC(2026, 7, 1) + index }))
    }
    source.reads.set('session-big', { complete: true, samples })
    return source
  }

  it('pages a 10,000-request session within the 200-row wire bound', async () => {
    const source = bigSource(10_000)
    const yields = vi.fn(async () => {})
    const engine = makeEngine(source, { chunkSize: 500, schedule: yields })
    const first = await queryOk(engine, { sessionRef: 'session-big' })
    expect(first.requests).toHaveLength(50) // default page size
    expect(first.nextCursor).toBeDefined()
    expect(first.truncated).toBe(true)
    // Totals always cover the verified whole range, not the current page.
    expect(first.totals.requestCount).toBe(10_000)
    expect(first.totals.buckets.uncachedInputTokens).toBe(100_000)
    expect(yields.mock.calls.length).toBeGreaterThan(0)

    let cursor: string | undefined = (await queryOk(engine, { sessionRef: 'session-big', limit: 200 })).nextCursor
    let seen = 200
    while (cursor !== undefined) {
      const page = await queryOk(engine, { sessionRef: 'session-big', limit: 200, cursor })
      expect(page.requests.length).toBeLessThanOrEqual(200)
      seen += page.requests.length
      cursor = page.nextCursor
      if (seen > 10_000) throw new Error('pagination overran')
    }
    expect(seen).toBe(10_000)
  })

  it('reports aggregation progress while chunking large histories', async () => {
    const source = bigSource(3_000)
    const engine = makeEngine(source, { chunkSize: 1_000 })
    const progress: [number, number][] = []
    await engine.query({ sessionRef: 'session-big' }, { onProgress: (done, total) => progress.push([done, total]) })
    expect(progress.length).toBeGreaterThan(0)
    expect(progress.at(-1)).toEqual([3_000, 3_000])
  })

  it('returns stale_cursor when the revision moved under a cursor', async () => {
    const source = bigSource(120)
    const engine = makeEngine(source)
    const first = await queryOk(engine, { sessionRef: 'session-big' })
    expect(first.nextCursor).toBeDefined()
    // New usage arrives before the next page is read.
    source.reads.set('session-big', {
      complete: true,
      samples: [
        ...source.reads.get('session-big')!.samples,
        sample({ attemptRef: 'late-1' }),
      ],
    })
    const result = await engine.query({ sessionRef: 'session-big', cursor: first.nextCursor })
    expect(result).toMatchObject({ ok: false, code: 'stale_cursor' })
  })

  it('rejects tampered or foreign cursors', async () => {
    const source = bigSource(120)
    const engine = makeEngine(source)
    const first = await queryOk(engine, { sessionRef: 'session-big' })
    const tampered = await engine.query({ sessionRef: 'session-big', cursor: 'not-a-cursor' })
    expect(tampered).toMatchObject({ ok: false, code: 'invalid_cursor' })
    const foreign = await engine.query({ sessionRef: 'session-big', limit: 10, cursor: first.nextCursor })
    expect(foreign).toMatchObject({ ok: false, code: 'invalid_cursor' })
  })
})

describe('cost accounting', () => {
  it('sums settled costs per currency with decimal strings, never mixing kinds', async () => {
    const source = new MockSource()
    source.reads.set('session-a', {
      complete: true,
      samples: [
        sample({ attemptRef: 'a-1', cost: { kind: 'settled', amount: '0.10', currency: 'CNY' } }),
        sample({ attemptRef: 'a-2', cost: { kind: 'settled', amount: '0.20', currency: 'CNY' } }),
        sample({ attemptRef: 'a-3', cost: { kind: 'settled', amount: '1.00', currency: 'USD' } }),
        sample({ attemptRef: 'a-4', cost: { kind: 'estimate', amount: '0.05', currency: 'CNY', source: 'price-snapshot-2026-08', effectiveAt: '2026-08-01T00:00:00.000Z' } }),
      ],
    })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(snapshot.source.cost).toBe('provider_settled')
    expect(snapshot.totals.cost).toEqual([
      { kind: 'settled', amount: '0.3', currency: 'CNY' },
      { kind: 'settled', amount: '1', currency: 'USD' },
      { kind: 'estimate', amount: '0.05', currency: 'CNY', source: 'price-snapshot-2026-08', effectiveAt: '2026-08-01T00:00:00.000Z' },
    ])
  })

  it('reports cost unknown when no price source or settlement exists', async () => {
    const source = new MockSource()
    source.reads.set('session-a', { complete: true, samples: [sample({ attemptRef: 'a-1' })] })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(snapshot.source.cost).toBe('unknown')
    expect(snapshot.totals.cost).toBeUndefined()
  })

  it('marks estimate-only costs as price-snapshot sourced', async () => {
    const source = new MockSource()
    source.reads.set('session-a', {
      complete: true,
      samples: [sample({ attemptRef: 'a-1', cost: { kind: 'estimate', amount: '0.01', currency: 'USD', source: 'price-snapshot-2026-08', effectiveAt: '2026-08-01T00:00:00.000Z' } })],
    })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(snapshot.source.cost).toBe('price_snapshot')
  })
})

describe('bounded breakdowns', () => {
  it('caps byModel and byProvider at 50 rows while totals cover everything', async () => {
    const source = new MockSource()
    const samples: RawUsageSample[] = []
    for (let index = 0; index < 60; index += 1) {
      samples.push(
        sample({
          attemptRef: `a-${index}`,
          model: `model-${String(index).padStart(2, '0')}`,
          provider: `provider-${String(index).padStart(2, '0')}`,
          usage: { inputTokens: index + 1, outputTokens: 1 },
        }),
      )
    }
    source.reads.set('session-a', { complete: true, samples })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(snapshot.byModel.rows).toHaveLength(50)
    expect(snapshot.byModel.truncated).toBe(true)
    expect(snapshot.byProvider.rows).toHaveLength(50)
    expect(snapshot.byProvider.truncated).toBe(true)
    expect(snapshot.totals.requestCount).toBe(60)
    expect(snapshot.totals.buckets.uncachedInputTokens).toBe((60 * 61) / 2)
  })
})

describe('wire safety', () => {
  it('rejects credential-shaped extra fields in the query input', () => {
    expect(parseInsightsQueryInput({ sessionRef: 'session-a', apiKey: 'sk-x' })).toBeUndefined()
    expect(parseInsightsQueryInput({ sessionRef: '/abs/path' })).toBeUndefined()
    expect(parseInsightsQueryInput({ sessionRef: 'session-a', limit: 201 })).toBeUndefined()
    expect(parseInsightsQueryInput({ sessionRef: 'session-a', scope: 'run' })).toBeUndefined()
    expect(parseInsightsQueryInput({ sessionRef: 'session-a', scope: 'range', from: '2026-08-27T00:00:00.000Z' })).toBeUndefined()
    expect(parseInsightsQueryInput({ sessionRef: 'session-a', timeZone: 'Not/AZone' })).toBeUndefined()
    expect(parseInsightsQueryInput({ sessionRef: 'session-a', timeZone: 'Asia/Shanghai' })).toBeDefined()
  })

  it('drops owner samples carrying credential-shaped or path refs', async () => {
    const source = new MockSource()
    source.reads.set('session-a', {
      complete: true,
      samples: [
        sample({ attemptRef: '/etc/passwd' }),
        sample({ attemptRef: 'ok?apikey=sk-x' }),
        sample({ attemptRef: 'good-1', requestRef: 'sk-shaped\\path' }),
        sample({ attemptRef: 'good-2' }),
      ],
    })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(snapshot.requests.map(row => row.attemptRef)).toEqual(['good-2'])
    expect(SECRET_SHAPES.test(JSON.stringify(snapshot))).toBe(false)
  })

  it('rejects snapshots carrying credential-shaped extra fields', async () => {
    const source = new MockSource()
    source.reads.set('session-a', { complete: true, samples: [sample({ attemptRef: 'a-1' })] })
    const engine = makeEngine(source)
    const snapshot = await queryOk(engine, { sessionRef: 'session-a' })
    expect(() => parseInsightsSnapshot(snapshot)).not.toThrow()
    expect(() => parseInsightsSnapshot({ ...snapshot, apiKey: 'sk-leak' })).toThrow()
  })
})

describe('samplesFromSessionLog mapping', () => {
  it('folds streaming chunks and the final message into one attempt', () => {
    const samples = samplesFromSessionLog([
      { type: 'request/context', seq: 0, time: 100, data: { provider: 'deepseek-official', model: 'deepseek-chat' } },
      { type: 'step/start', seq: 1, time: 1000, data: { turn: 1, step: 1 } },
      { type: 'assistant/chunk', seq: 2, time: 1100, data: { turn: 1, step: 1, chunk: { type: 'usage', usage: { inputTokens: 10, outputTokens: 5 } } } },
      { type: 'assistant/message', seq: 3, time: 1200, data: { turn: 1, step: 1, message: {}, usage: { inputTokens: 20, outputTokens: 8, cacheReadTokens: 4 } } },
      { type: 'step/end', seq: 4, time: 1300, data: { turn: 1, step: 1 } },
    ])
    expect(samples).toHaveLength(2)
    expect(samples.every(row => row.attemptRef === 't1-s1')).toBe(true)
    expect(samples[1]).toMatchObject({
      kind: 'final',
      provider: 'deepseek-official',
      model: 'deepseek-chat',
      happenedAt: 1000,
      usage: { inputTokens: 20, outputTokens: 8, cacheReadTokens: 4 },
    })
  })

  it('marks pre-seed events as inherited fork history', () => {
    const samples = samplesFromSessionLog([
      { type: 'step/start', seq: 0, time: 100, data: { turn: 1, step: 1 } },
      { type: 'assistant/message', seq: 1, time: 200, data: { turn: 1, step: 1, message: {}, usage: { inputTokens: 50, outputTokens: 20 } } },
      { type: 'session/end-seed', seq: 2, time: 300, data: {} },
      { type: 'step/start', seq: 3, time: 400, data: { turn: 2, step: 1 } },
      { type: 'assistant/message', seq: 4, time: 500, data: { turn: 2, step: 1, message: {}, usage: { inputTokens: 10, outputTokens: 5 } } },
    ])
    const inherited = samples.filter(row => row.inherited === true)
    const live = samples.filter(row => row.inherited !== true)
    expect(inherited.map(row => row.attemptRef)).toEqual(['t1-s1'])
    expect(live.map(row => row.attemptRef)).toEqual(['t2-s1'])
  })

  it('keeps closed steps without usage as unknown-consumption requests', () => {
    const samples = samplesFromSessionLog([
      { type: 'step/start', seq: 0, time: 100, data: { turn: 1, step: 1 } },
      { type: 'step/end', seq: 1, time: 200, data: { turn: 1, step: 1 } },
    ])
    expect(samples).toHaveLength(1)
    expect(samples[0]).toMatchObject({ attemptRef: 't1-s1', kind: 'final', happenedAt: 100 })
    expect(samples[0]?.usage).toBeUndefined()
  })
})
