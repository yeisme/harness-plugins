import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionStatusBindingRegistry, type SessionStatusSource } from '../src/binding.ts'
import { SESSION_STATUS_SCHEMA_VERSION, type SessionStatusSnapshotV1 } from '../src/wire.ts'

function snapshot(sessionRef: string, revision: number): SessionStatusSnapshotV1 {
  return {
    schemaVersion: SESSION_STATUS_SCHEMA_VERSION,
    revision,
    generatedAt: '2026-09-05T08:00:00.000Z',
    freshness: 'fresh',
    status: 'ready',
    session: { sessionRef, label: sessionRef, lifecycle: 'idle' },
    context: {
      status: 'ready',
      usedTokens: 1200,
      limitTokens: 10000,
      remainingRatio: 0.88,
      source: 'token-meter',
      safeMessage: 'Context remaining from owner token meter',
    },
    limits: [],
  }
}

interface FakeSource extends SessionStatusSource {
  readonly snapshot: ReturnType<typeof vi.fn>
  readonly events: string[]
}

function fakeSource(options: { readonly feed?: boolean; readonly fail?: boolean } = {}): FakeSource & { emit(sessionRef: string): void } {
  const events: string[] = []
  const listeners = new Map<string, Set<() => void>>()
  const snapshotFn = vi.fn(async (input: { sessionRef: string }) => {
    events.push(`snapshot:${input.sessionRef}`)
    if (options.fail === true) return { ok: false as const, code: 'source_unavailable' as const, message: 'source unavailable' }
    return { ok: true as const, specVersion: '1.0' as const, snapshot: snapshot(input.sessionRef, 1) }
  })
  const source: FakeSource & { emit(sessionRef: string): void } = {
    events,
    snapshot: snapshotFn,
    emit(sessionRef: string) {
      for (const listener of listeners.get(sessionRef) ?? []) listener()
    },
    ...(options.feed === true
      ? {
        subscribeVersion(sessionRef: string, listener: () => void) {
          events.push(`subscribe:${sessionRef}`)
          const set = listeners.get(sessionRef) ?? new Set<() => void>()
          set.add(listener)
          listeners.set(sessionRef, set)
          return () => {
            events.push(`unsubscribe:${sessionRef}`)
            set.delete(listener)
          }
        },
      }
      : {}),
  }
  return source
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

describe('session status binding', () => {
  it('isolates A and B: B updates never touch the A binding', async () => {
    const source = fakeSource({ feed: true })
    const registry = new SessionStatusBindingRegistry({ coalesceMs: 250 })
    const a = registry.acquire('sess_a', source)
    const b = registry.acquire('sess_b', source)
    await flush()
    source.emit('sess_b')
    await vi.advanceTimersByTimeAsync(300)
    expect(source.events.filter(event => event === 'snapshot:sess_a')).toHaveLength(1)
    expect(source.events.filter(event => event === 'snapshot:sess_b')).toHaveLength(2)
    expect(a.getSnapshot().snapshot?.session.sessionRef).toBe('sess_a')
    registry.dispose()
  })

  it('discards a late reply after close (permission revocation path)', async () => {
    let resolve: ((value: unknown) => void) | undefined
    const source = fakeSource()
    source.snapshot.mockImplementation(() => new Promise(res => { resolve = res }))
    const registry = new SessionStatusBindingRegistry()
    const binding = registry.acquire('sess_a', source)
    const listener = vi.fn()
    binding.subscribe(listener)
    registry.release(binding) // last consumer leaves → cancel/discard
    resolve?.({ ok: true, specVersion: '1.0', snapshot: snapshot('sess_a', 1) })
    await flush()
    expect(binding.getSnapshot().status).toBe('loading') // late reply never published
    expect(registry.size).toBe(0)
    registry.dispose()
  })

  it('subscribes before the first read and re-reads on a during-read update', async () => {
    let calls = 0
    const source = fakeSource({ feed: true })
    source.snapshot.mockImplementation(async (input: { sessionRef: string }) => {
      source.events.push(`snapshot:${input.sessionRef}`)
      calls += 1
      return { ok: true as const, specVersion: '1.0' as const, snapshot: snapshot(input.sessionRef, calls) }
    })
    const registry = new SessionStatusBindingRegistry()
    const binding = registry.acquire('sess_a', source)
    expect(source.events[0]).toBe('subscribe:sess_a')
    source.emit('sess_a') // lands while the first read is in flight
    await flush()
    await flush()
    expect(calls).toBe(2)
    expect(binding.getSnapshot().snapshot?.revision).toBe(2)
    registry.dispose()
  })

  it('coalesces notifications to at most one re-read per 250ms', async () => {
    const source = fakeSource({ feed: true })
    const registry = new SessionStatusBindingRegistry({ coalesceMs: 250 })
    registry.acquire('sess_a', source)
    await flush()
    source.emit('sess_a')
    source.emit('sess_a')
    await vi.advanceTimersByTimeAsync(100)
    expect(source.events.filter(event => event === 'snapshot:sess_a')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(300)
    expect(source.events.filter(event => event === 'snapshot:sess_a')).toHaveLength(2)
    registry.dispose()
  })

  it('shares one binding per session and releases with the last consumer', async () => {
    const source = fakeSource({ feed: true })
    const registry = new SessionStatusBindingRegistry()
    const first = registry.acquire('sess_a', source)
    const second = registry.acquire('sess_a', source)
    expect(first).toBe(second)
    expect(source.events.filter(event => event === 'subscribe:sess_a')).toHaveLength(1)
    registry.release(first)
    expect(registry.size).toBe(1)
    registry.release(second)
    expect(registry.size).toBe(0)
    expect(source.events).toContain('unsubscribe:sess_a')
    registry.dispose()
  })

  it('reconnect re-reads the authoritative snapshot only (no replay)', async () => {
    const source = fakeSource({ feed: true })
    const registry = new SessionStatusBindingRegistry()
    const binding = registry.acquire('sess_a', source)
    await flush()
    const before = [...source.events]
    await binding.reconnect()
    await flush()
    expect(source.events.slice(before.length)).toEqual(['snapshot:sess_a'])
    registry.dispose()
  })

  it('provider replacement releases the old subscription before the new read', async () => {
    const oldSource = fakeSource({ feed: true })
    const newSource = fakeSource({ feed: true })
    const registry = new SessionStatusBindingRegistry()
    const binding = registry.acquire('sess_a', oldSource)
    await flush()
    registry.attachSource(newSource)
    await flush()
    expect(oldSource.events).toContain('unsubscribe:sess_a')
    expect(newSource.events[0]).toBe('subscribe:sess_a')
    expect(newSource.events[1]).toBe('snapshot:sess_a')
    expect(binding.getSnapshot().status).toBe('ready')
    registry.dispose()
  })

  it('explicit error retry keeps the old value marked stale; no automatic retry', async () => {
    let fail = false
    const source = fakeSource()
    source.snapshot.mockImplementation(async (input: { sessionRef: string }) => {
      source.events.push(`snapshot:${input.sessionRef}`)
      return fail
        ? { ok: false as const, code: 'source_unavailable' as const, message: 'source unavailable' }
        : { ok: true as const, specVersion: '1.0' as const, snapshot: snapshot(input.sessionRef, 1) }
    })
    const registry = new SessionStatusBindingRegistry()
    const binding = registry.acquire('sess_a', source)
    await flush()
    expect(binding.getSnapshot().status).toBe('ready')
    fail = true
    await binding.refresh()
    const state = binding.getSnapshot()
    expect(state.status).toBe('error')
    expect(state.stale).toBe(true)
    expect(state.snapshot?.revision).toBe(1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(source.snapshot).toHaveBeenCalledTimes(2) // no automatic retry
    registry.dispose()
  })

  it('reports subscription:false without a feed seam (manual refresh only)', async () => {
    const source = fakeSource() // no subscribeVersion
    const registry = new SessionStatusBindingRegistry()
    const binding = registry.acquire('sess_a', source)
    await flush()
    expect(binding.getSnapshot().subscription).toBe(false)
    registry.dispose()
  })
})
