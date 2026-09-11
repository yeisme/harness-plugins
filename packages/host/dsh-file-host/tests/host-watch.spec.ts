// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createExplorerFileHost, FILE_WATCH_CAPABILITY, probeFileWatch } from '../src/index.ts'
import type { FileWatchEventV1 } from '../src/index.ts'

class StubEventSource {
  static readonly instances: StubEventSource[] = []
  readonly listeners = new Map<string, (event: { readonly data: string }) => void>()
  onerror: (() => void) | undefined
  closed = false
  readonly url: string

  constructor(url: string) {
    this.url = url
    StubEventSource.instances.push(this)
  }

  addEventListener(name: string, listener: (event: { readonly data: string }) => void): void {
    this.listeners.set(name, listener)
  }

  emit(name: string, data: unknown): void {
    this.listeners.get(name)?.({ data: JSON.stringify(data) })
  }

  close(): void { this.closed = true }
}

const validEvent = (overrides: Partial<FileWatchEventV1> = {}): FileWatchEventV1 => ({
  cursor: 'g1:s7',
  sequence: 7,
  op: 'created',
  entryRef: 'file-abc123',
  parentRef: 'dir-def456',
  occurredAt: '2026-09-11T00:00:00.000Z',
  ...overrides,
})

describe('createExplorerFileHost watch (dsh-explorer-live-watch)', () => {
  beforeEach(() => {
    StubEventSource.instances.length = 0
    vi.stubGlobal('EventSource', StubEventSource as unknown as typeof EventSource)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  const hostOf = () => createExplorerFileHost({
    fetchImpl: (async () => ({ ok: true, json: async () => ({ ok: true, value: {} }) })) as typeof fetch,
    sessionId: () => 'sess-1',
  })

  it('advertises the capability and reports live through probeFileWatch', () => {
    const host = hostOf()
    expect(host.capabilities).toContain(FILE_WATCH_CAPABILITY)
    expect(typeof host.watch).toBe('function')
    expect(probeFileWatch(host)).toMatchObject({ live: true, freshness: 'fresh' })
  })

  it('opens the stream on subscribe, snapshots the cursor, dispatches valid events', () => {
    const host = hostOf()
    const seen: FileWatchEventV1[] = []
    const handle = host.watch()
    expect(handle.capability).toBe(FILE_WATCH_CAPABILITY)
    expect(handle.snapshotCursor()).toBe('0')
    const unsubscribe = handle.subscribe(event => { seen.push(event) })
    const source = StubEventSource.instances.at(-1)!
    expect(source.url).toBe('/yeisme-files/api/fs.watch.streamV1?sessionId=sess-1')
    source.emit('cursor', { cursor: 'g1:s5' })
    expect(handle.snapshotCursor()).toBe('g1:s5')
    source.emit('fs', validEvent())
    expect(seen).toHaveLength(1)
    expect(seen[0]!.entryRef).toBe('file-abc123')
    expect(handle.snapshotCursor()).toBe('g1:s7')
    unsubscribe()
  })

  it('drops malformed and path-shaped events without breaking the subscription', () => {
    const host = hostOf()
    const seen: FileWatchEventV1[] = []
    const unsubscribe = host.watch().subscribe(event => { seen.push(event) })
    const source = StubEventSource.instances.at(-1)!
    source.emit('fs', validEvent({ entryRef: '/etc/passwd' as string }))
    source.emit('fs', validEvent({ op: 'teleported' as FileWatchEventV1['op'] }))
    source.emit('fs', validEvent({ sequence: Number.NaN }))
    source.emit('fs', 'not-an-object')
    expect(seen).toHaveLength(0)
    source.emit('fs', validEvent())
    expect(seen).toHaveLength(1)
    unsubscribe()
  })

  it('reconnects with the latest cursor after a stream error and closes on the last unsubscribe', () => {
    vi.useFakeTimers()
    const host = hostOf()
    const seen: FileWatchEventV1[] = []
    const unsubscribe = host.watch().subscribe(event => { seen.push(event) })
    const first = StubEventSource.instances.at(-1)!
    first.emit('cursor', { cursor: 'g1:s9' })
    first.onerror?.()
    expect(first.closed).toBe(true)
    vi.advanceTimersByTime(1_000)
    const second = StubEventSource.instances.at(-1)!
    expect(second).not.toBe(first)
    expect(second.url).toContain('since=g1%3As9')
    second.emit('fs', validEvent({ cursor: 'g1:s10', sequence: 10 }))
    expect(seen).toHaveLength(1)
    unsubscribe()
    expect(second.closed).toBe(true)
  })

  it('keeps the stream open while any listener remains', () => {
    const host = hostOf()
    const first = host.watch().subscribe(() => {})
    const second = host.watch().subscribe(() => {})
    const source = StubEventSource.instances.at(-1)!
    first()
    expect(source.closed).toBe(false)
    second()
    expect(source.closed).toBe(true)
  })

  it('does not open a stream without a session owner', () => {
    const host = createExplorerFileHost({
      fetchImpl: (async () => ({ ok: true, json: async () => ({ ok: true, value: {} }) })) as typeof fetch,
      sessionId: () => undefined,
    })
    const unsubscribe = host.watch().subscribe(() => {})
    expect(StubEventSource.instances).toHaveLength(0)
    unsubscribe()
  })
})
