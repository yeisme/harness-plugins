import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SessionInsightsBindingRegistry,
  sessionInsightsTargetKey,
  type SessionInsightsSource,
} from '../src/client/insights-binding.ts'
import { SESSION_INSIGHTS_SCHEMA_VERSION, type SessionInsightsSnapshotV1 } from '../src/wire.ts'

function snapshot(sessionRef: string, revision: number, requestCount = 1): SessionInsightsSnapshotV1 {
  return {
    schemaVersion: SESSION_INSIGHTS_SCHEMA_VERSION,
    sessionRef,
    scope: 'session',
    revision,
    generatedAt: '2026-09-05T08:00:00.000Z',
    freshness: 'fresh',
    coverage: { status: 'complete', knownRequests: requestCount },
    source: { history: 'session_query', context: 'session_projections', cost: 'unknown' },
    totals: {
      buckets: { uncachedInputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 },
      requestCount,
      sumRequestDurationMs: 100,
      wallClockMs: 90,
    },
    context: { status: 'unavailable', reason: 'no context' },
    byModel: { rows: [], truncated: false },
    byProvider: { rows: [], truncated: false },
    requests: [{ attemptRef: `att_r${revision}`, sessionRef, buckets: { uncachedInputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 }, status: 'completed' }],
    truncated: false,
  }
}

interface FakeSource extends SessionInsightsSource {
  readonly query: ReturnType<typeof vi.fn>
  readonly subscribeVersion: ReturnType<typeof vi.fn> | undefined
  readonly events: string[]
}

function fakeSource(options: { readonly feed?: boolean; readonly answer?: (input: { sessionRef?: string }) => unknown } = {}): FakeSource {
  const events: string[] = []
  const feed = options.feed === true
  const listeners = new Map<string, Set<() => void>>()
  const query = vi.fn(async (input: { sessionRef?: string }) => {
    events.push(`query:${input.sessionRef ?? '?'}`)
    const answer = options.answer?.(input)
    return answer ?? { ok: true as const, specVersion: '1.0' as const, snapshot: snapshot(String(input.sessionRef), 1) }
  })
  const subscribeVersion = feed
    ? vi.fn((sessionRef: string, listener: () => void) => {
      events.push(`subscribe:${sessionRef}`)
      const set = listeners.get(sessionRef) ?? new Set<() => void>()
      set.add(listener)
      listeners.set(sessionRef, set)
      return () => {
        events.push(`unsubscribe:${sessionRef}`)
        set.delete(listener)
      }
    })
    : undefined
  return {
    events,
    query,
    subscribeVersion,
    ...(feed ? { emit(sessionRef: string) { for (const listener of listeners.get(sessionRef) ?? []) listener() } } : {}),
  } as FakeSource & { emit(sessionRef: string): void }
}

const flush = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('session insights binding', () => {
  it('isolates A and B side by side: B updates never touch A', async () => {
    const source = fakeSource({ feed: true }) as FakeSource & { emit(sessionRef: string): void }
    const registry = new SessionInsightsBindingRegistry({ coalesceMs: 250 })
    const a = registry.acquire({ sessionRef: 'sess_a', scope: 'session' }, source)
    const b = registry.acquire({ sessionRef: 'sess_b', scope: 'session' }, source)
    await flush()
    expect(a.getSnapshot().snapshot?.sessionRef).toBe('sess_a')
    expect(b.getSnapshot().snapshot?.sessionRef).toBe('sess_b')
    source.emit('sess_b')
    await vi.advanceTimersByTimeAsync(300)
    expect(source.events.filter(event => event === 'query:sess_b')).toHaveLength(2)
    expect(source.events.filter(event => event === 'query:sess_a')).toHaveLength(1)
    expect(a.getSnapshot().snapshot?.revision).toBe(1)
    registry.release(a)
    registry.release(b)
    registry.dispose()
  })

  it('discards a late A reply after an explicit switch to B', async () => {
    let resolveA: ((value: unknown) => void) | undefined
    const source = fakeSource()
    source.query.mockImplementation((input: { sessionRef?: string }) => {
      if (input.sessionRef === 'sess_a') {
        return new Promise(resolve => { resolveA = resolve })
      }
      return Promise.resolve({ ok: true as const, specVersion: '1.0' as const, snapshot: snapshot('sess_b', 9) })
    })
    const registry = new SessionInsightsBindingRegistry()
    const bindingA = registry.acquire({ sessionRef: 'sess_a', scope: 'session' }, source)
    const aListener = vi.fn()
    bindingA.subscribe(aListener)
    expect(bindingA.getSnapshot().status).toBe('loading')
    // Explicit switch: release A (last consumer) and bind B before A settles.
    registry.release(bindingA)
    const bindingB = registry.acquire({ sessionRef: 'sess_b', scope: 'session' }, source)
    resolveA?.({ ok: true, specVersion: '1.0', snapshot: snapshot('sess_a', 5) })
    await flush()
    expect(bindingA.getSnapshot().status).toBe('loading') // never published A
    expect(bindingB.getSnapshot().status).toBe('ready')
    expect(bindingB.getSnapshot().snapshot?.revision).toBe(9)
    expect(registry.size).toBe(1)
    registry.dispose()
  })

  it('subscribes to version notifications before the first snapshot read', async () => {
    const source = fakeSource({ feed: true })
    const registry = new SessionInsightsBindingRegistry()
    const binding = registry.acquire({ sessionRef: 'sess_a', scope: 'session' }, source)
    expect(source.events[0]).toBe('subscribe:sess_a')
    expect(source.events[1]).toBe('query:sess_a')
    await flush()
    expect(binding.getSnapshot().status).toBe('ready')
    registry.dispose()
  })

  it('re-reads when an update arrived during the in-flight read (no startup gap)', async () => {
    let calls = 0
    const source = fakeSource({
      feed: true,
      answer: input => {
        calls += 1
        return { ok: true, specVersion: '1.0', snapshot: snapshot(String(input.sessionRef), calls) }
      },
    }) as FakeSource & { emit(sessionRef: string): void }
    const registry = new SessionInsightsBindingRegistry()
    const binding = registry.acquire({ sessionRef: 'sess_a', scope: 'session' }, source)
    // The version notification lands while the first read is in flight.
    source.emit('sess_a')
    await flush()
    await flush()
    expect(calls).toBe(2)
    expect(binding.getSnapshot().snapshot?.revision).toBe(2)
    registry.dispose()
  })

  it('coalesces change notifications to at most one re-read per 250ms', async () => {
    const source = fakeSource({ feed: true }) as FakeSource & { emit(sessionRef: string): void }
    const registry = new SessionInsightsBindingRegistry({ coalesceMs: 250 })
    registry.acquire({ sessionRef: 'sess_a', scope: 'session' }, source)
    await flush()
    source.emit('sess_a')
    source.emit('sess_a')
    source.emit('sess_a')
    await vi.advanceTimersByTimeAsync(100)
    expect(source.events.filter(event => event === 'query:sess_a')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(300)
    expect(source.events.filter(event => event === 'query:sess_a')).toHaveLength(2)
    registry.dispose()
  })

  it('shares one binding across surfaces and releases it with the last consumer', async () => {
    const source = fakeSource({ feed: true })
    const registry = new SessionInsightsBindingRegistry()
    const first = registry.acquire({ sessionRef: 'sess_a', scope: 'session' }, source)
    const second = registry.acquire({ sessionRef: 'sess_a', scope: 'session' }, source)
    expect(first).toBe(second)
    expect(first.consumerCount).toBe(2)
    expect(source.events.filter(event => event === 'subscribe:sess_a')).toHaveLength(1)
    await flush()
    registry.release(first)
    expect(registry.size).toBe(1) // still shared by the second surface
    registry.release(second)
    expect(registry.size).toBe(0) // last consumer released → disposed
    expect(source.events).toContain('unsubscribe:sess_a')
    registry.dispose()
  })

  it('scopes identity into the key (same session, different scope = different binding)', () => {
    expect(sessionInsightsTargetKey({ sessionRef: 's', scope: 'session' }))
      .not.toBe(sessionInsightsTargetKey({ sessionRef: 's', scope: 'run', runRef: 'r1' }))
  })

  it('reconnect re-reads the authoritative snapshot only (no replays)', async () => {
    const source = fakeSource({ feed: true }) as FakeSource & { emit(sessionRef: string): void }
    const registry = new SessionInsightsBindingRegistry()
    const binding = registry.acquire({ sessionRef: 'sess_a', scope: 'session' }, source)
    await flush()
    const before = [...source.events]
    await binding.reconnect()
    await flush()
    const after = source.events.slice(before.length)
    expect(after).toEqual(['query:sess_a']) // one read-only re-read, nothing else
    registry.dispose()
  })

  it('provider replacement releases the old subscription before binding the new source', async () => {
    const oldSource = fakeSource({ feed: true })
    const newSource = fakeSource({ feed: true })
    const registry = new SessionInsightsBindingRegistry()
    const binding = registry.acquire({ sessionRef: 'sess_a', scope: 'session' }, oldSource)
    await flush()
    registry.attachSource(newSource)
    await flush()
    const unsubscribeIndex = oldSource.events.indexOf('unsubscribe:sess_a')
    expect(unsubscribeIndex).toBeGreaterThan(-1)
    expect(newSource.events[0]).toBe('subscribe:sess_a')
    expect(newSource.events[1]).toBe('query:sess_a')
    expect(binding.getSnapshot().status).toBe('ready')
    registry.dispose()
  })

  it('keeps the old value stale on error and never retries automatically', async () => {
    let fail = false
    const source = fakeSource({
      answer: input => fail
        ? { ok: false, code: 'insights_unavailable', message: 'history read failed' }
        : { ok: true, specVersion: '1.0', snapshot: snapshot(String(input.sessionRef), 1) },
    })
    const registry = new SessionInsightsBindingRegistry()
    const binding = registry.acquire({ sessionRef: 'sess_a', scope: 'session' }, source)
    await flush()
    expect(binding.getSnapshot().status).toBe('ready')
    fail = true
    await binding.refresh()
    await flush()
    const state = binding.getSnapshot()
    expect(state.status).toBe('error')
    expect(state.message).toBe('history read failed')
    expect(state.snapshot?.revision).toBe(1) // old value kept
    expect(state.stale).toBe(true)
    await vi.advanceTimersByTimeAsync(5000)
    expect(source.query).toHaveBeenCalledTimes(2) // no automatic retry
    registry.dispose()
  })

  it('stale_cursor keeps the current pages and asks for an explicit first-page re-read', async () => {
    const paged = snapshot('sess_a', 1)
    const first = { ...paged, nextCursor: 'cursor-1' }
    let calls = 0
    const source = fakeSource({
      answer: () => {
        calls += 1
        if (calls === 1) return { ok: true, specVersion: '1.0', snapshot: first }
        return { ok: false, code: 'stale_cursor', message: 'cursor invalidated by a newer revision' }
      },
    })
    const registry = new SessionInsightsBindingRegistry()
    const binding = registry.acquire({ sessionRef: 'sess_a', scope: 'session' }, source)
    await flush()
    await binding.loadMore()
    await flush()
    const state = binding.getSnapshot()
    expect(state.staleCursor).toBe(true)
    expect(state.snapshot?.requests).toHaveLength(1) // pages kept
    registry.dispose()
  })

  it('loadMore appends the next page de-duplicated by attemptRef', async () => {
    const first = { ...snapshot('sess_a', 1), nextCursor: 'cursor-1' }
    const secondPage = {
      ...snapshot('sess_a', 1),
      requests: [
        { attemptRef: 'att_r1', sessionRef: 'sess_a', buckets: null, status: 'completed' as const }, // duplicate
        { attemptRef: 'att_new', sessionRef: 'sess_a', buckets: null, status: 'failed' as const },
      ],
    }
    let calls = 0
    const source = fakeSource({
      answer: () => {
        calls += 1
        return { ok: true, specVersion: '1.0', snapshot: calls === 1 ? first : secondPage }
      },
    })
    const registry = new SessionInsightsBindingRegistry()
    const binding = registry.acquire({ sessionRef: 'sess_a', scope: 'session' }, source)
    await flush()
    await binding.loadMore()
    await flush()
    expect(binding.getSnapshot().snapshot?.requests.map(row => row.attemptRef)).toEqual(['att_r1', 'att_new'])
    registry.dispose()
  })

  it('reports subscription:false when the host has no feed seam (manual refresh only)', async () => {
    const source = fakeSource() // no subscribeVersion
    const registry = new SessionInsightsBindingRegistry()
    const binding = registry.acquire({ sessionRef: 'sess_a', scope: 'session' }, source)
    await flush()
    expect(binding.getSnapshot().subscription).toBe(false)
    registry.dispose()
  })

  it('HMR dispose discards in-flight replies and releases the feed', async () => {
    let resolve: ((value: unknown) => void) | undefined
    const source = fakeSource({ feed: true })
    source.query.mockImplementation(() => new Promise(res => { resolve = res }))
    const registry = new SessionInsightsBindingRegistry()
    const binding = registry.acquire({ sessionRef: 'sess_a', scope: 'session' }, source)
    const listener = vi.fn()
    binding.subscribe(listener)
    registry.dispose()
    resolve?.({ ok: true, specVersion: '1.0', snapshot: snapshot('sess_a', 1) })
    await flush()
    expect(listener).not.toHaveBeenCalled()
    expect(source.events).toContain('unsubscribe:sess_a')
  })
})
