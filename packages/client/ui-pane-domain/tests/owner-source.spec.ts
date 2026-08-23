import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { PANE_CONFORMANCE_CASES } from '@yeisme/dsh-pane-protocol/conformance'
import {
  DomainOwnerSourceBridge,
  createDomainOwnerFoldState,
  foldDomainOwnerEvent,
  mountDomainOwnerSource,
  type DomainOwnerEventTransport,
} from '../src/owner-source.ts'

const context = {
  workspaceRef: 'workspace:demo',
  sessionRef: 'session:one',
  principalRef: 'principal:local',
  revision: '1',
}

function snapshotEnvelope(sequence = -1, entities: unknown[] = [], extra: Record<string, unknown> = {}): unknown {
  return {
    schema: 'pane.event.v1alpha1',
    stream: 'domain.sonora',
    cursor: `c${sequence}`,
    sequence,
    context,
    occurredAt: '2026-08-21T00:00:00Z',
    observedAt: '2026-08-21T00:00:00Z',
    freshness: 'fresh',
    op: 'snapshot',
    payload: { entities, timeline: [], receipts: [] },
    ...extra,
  }
}

function takeEntity(ref: string, title: string, status = 'ready'): unknown {
  return { ref, version: 1, value: { title, kind: 'take', status } }
}

function upsertEvent(sequence: number, ref: string, title: string, extra: Record<string, unknown> = {}): unknown {
  return {
    schema: 'pane.event.v1alpha1',
    stream: 'domain.sonora',
    cursor: `c${sequence}`,
    sequence,
    context,
    occurredAt: '2026-08-21T00:00:00Z',
    observedAt: '2026-08-21T00:00:00Z',
    freshness: 'fresh',
    op: 'upsert',
    entityRef: ref,
    entityVersion: 2,
    payload: { value: { title, kind: 'take', status: 'ready' } },
    ...extra,
  }
}

class TransportFixture implements DomainOwnerEventTransport {
  readonly pushed: unknown[] = []
  private listeners = new Set<(event: unknown) => void>()
  private unavailableListeners = new Set<() => void>()
  private availableListeners = new Set<() => void>()
  readCount = 0
  reads: unknown[] = [snapshotEnvelope(-1, [takeEntity('take:1', 'Take one')])]
  actions: { id: string; gated: boolean }[] | undefined = [{ id: 'render.take', gated: true }]

  read(): { snapshot: unknown; actions?: { id: string; gated: boolean }[] } {
    this.readCount += 1
    const snapshot = this.reads[Math.min(this.readCount - 1, this.reads.length - 1)]
    if (snapshot instanceof Error) throw snapshot
    return { snapshot, actions: this.actions }
  }

  subscribe(listener: (event: unknown) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  onUnavailable(listener: () => void): () => void {
    this.unavailableListeners.add(listener)
    return () => { this.unavailableListeners.delete(listener) }
  }

  onAvailable(listener: () => void): () => void {
    this.availableListeners.add(listener)
    return () => { this.availableListeners.delete(listener) }
  }

  push(event: unknown): void {
    this.pushed.push(event)
    for (const listener of [...this.listeners]) listener(event)
  }

  goOffline(): void { for (const listener of [...this.unavailableListeners]) listener() }
  comeBack(): void { for (const listener of [...this.availableListeners]) listener() }
}

let contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

describe('foldDomainOwnerEvent conformance', () => {
  it('folds every shared pane conformance case to the same status and reason', () => {
    for (const item of PANE_CONFORMANCE_CASES) {
      let state = createDomainOwnerFoldState()
      let previous = state
      for (const nextEvent of item.events) {
        previous = state
        state = foldDomainOwnerEvent(state, nextEvent)
      }
      expect(state.status, item.id).toBe(item.expectedStatus)
      if (item.expectedReconcileReason !== undefined) {
        expect(state.reconcileReason, item.id).toBe(item.expectedReconcileReason)
      }
      if (item.expectSameReferenceOnLast === true) {
        expect(state, item.id).toBe(previous)
      }
    }
  })
})

describe('DomainOwnerSourceBridge', () => {
  it('reads the snapshot exactly once at open and derives owner items and actions', () => {
    const transport = new TransportFixture()
    const bridge = new DomainOwnerSourceBridge('sonora', transport)
    bridge.open()
    const snapshot = bridge.getSnapshot()
    expect(transport.readCount).toBe(1)
    expect(snapshot.owner).toBe('sonora')
    expect(snapshot.status).toBe('ready')
    expect(snapshot.freshness).toBe('fresh')
    expect(snapshot.items).toHaveLength(1)
    expect(snapshot.items[0]).toMatchObject({ ref: 'take:1', title: 'Take one', kind: 'take', status: 'ready' })
    expect(snapshot.allowedActions).toEqual([{ id: 'render.take', gated: true }])
    bridge.dispose()
  })

  it('never polls: no timer refetch after open, push events drive every update', () => {
    vi.useFakeTimers()
    try {
      const transport = new TransportFixture()
      const bridge = new DomainOwnerSourceBridge('sonora', transport)
      const seen: string[] = []
      bridge.open()
      bridge.subscribe(snapshot => seen.push(snapshot.status))
      vi.advanceTimersByTime(30_000)
      expect(transport.readCount).toBe(1)

      transport.push(upsertEvent(0, 'take:1', 'Take one live'))
      expect(bridge.getSnapshot().items[0]?.title).toBe('Take one live')
      expect(seen).toEqual(['ready'])
      bridge.dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it('treats duplicate push events as idempotent and keeps the same snapshot reference', () => {
    const transport = new TransportFixture()
    const bridge = new DomainOwnerSourceBridge('sonora', transport)
    bridge.open()
    const before = bridge.getSnapshot()
    transport.push(upsertEvent(0, 'take:1', 'dup'))
    const after = bridge.getSnapshot()
    expect(after.title ?? after.items[0]?.title).toBeDefined()
    transport.push(upsertEvent(0, 'take:1', 'dup again'))
    expect(bridge.getSnapshot()).toBe(after)
    expect(after).not.toBe(before)
    bridge.dispose()
  })

  it('keeps the last safe projection on a sequence gap and demands reconcile', () => {
    const transport = new TransportFixture()
    const bridge = new DomainOwnerSourceBridge('sonora', transport)
    bridge.open()
    transport.push(upsertEvent(4, 'take:1', 'late'))
    const snapshot = bridge.getSnapshot()
    expect(snapshot.status).toBe('reconcile_required')
    expect(snapshot.reconcileReason).toBe('sequence_gap:0:4')
    expect(snapshot.items[0]?.title).toBe('Take one')
    bridge.dispose()
  })

  it('maps an expired cursor (context switch) to reconcile_required', () => {
    const transport = new TransportFixture()
    const bridge = new DomainOwnerSourceBridge('sonora', transport)
    bridge.open()
    transport.push(upsertEvent(0, 'take:1', 'other context', {
      context: { ...context, revision: '2' },
    }))
    expect(bridge.getSnapshot().status).toBe('reconcile_required')
    expect(bridge.getSnapshot().reconcileReason).toBe('context_changed')
    bridge.dispose()
  })

  it('folds unsafe payloads to contract_mismatch without leaking them', () => {
    const transport = new TransportFixture()
    const bridge = new DomainOwnerSourceBridge('sonora', transport)
    bridge.open()
    transport.push(upsertEvent(0, 'take:1', 'leaky', {
      payload: { value: { title: 'x', rawPrompt: 'private' } },
    }))
    const snapshot = bridge.getSnapshot()
    expect(snapshot.status).toBe('contract_mismatch')
    expect(JSON.stringify(snapshot)).not.toContain('private')
    bridge.dispose()
  })

  it('shows offline when the channel drops and re-reads exactly once after it returns', () => {
    const transport = new TransportFixture()
    const bridge = new DomainOwnerSourceBridge('sonora', transport)
    bridge.open()
    transport.goOffline()
    expect(bridge.getSnapshot().status).toBe('offline')

    transport.reads.push(snapshotEnvelope(-1, [takeEntity('take:1', 'Take one after reconnect')]))
    transport.comeBack()
    expect(transport.readCount).toBe(2)
    expect(bridge.getSnapshot().status).toBe('ready')
    expect(bridge.getSnapshot().items[0]?.title).toBe('Take one after reconnect')
    bridge.dispose()
  })

  it('degrades a throwing owner read to offline instead of an empty ready pane', () => {
    const transport = new TransportFixture()
    transport.reads[0] = new Error('owner unreachable')
    const bridge = new DomainOwnerSourceBridge('sonora', transport)
    bridge.open()
    const snapshot = bridge.getSnapshot()
    expect(snapshot.status).toBe('offline')
    expect(snapshot.items).toEqual([])
    expect(snapshot.freshness).toBe('unknown')
    bridge.dispose()
  })

  it('notifies subscribers only when the projection actually changes', () => {
    const transport = new TransportFixture()
    const bridge = new DomainOwnerSourceBridge('sonora', transport)
    const updates: string[] = []
    bridge.subscribe(snapshot => updates.push(snapshot.status))
    bridge.open()
    transport.push(upsertEvent(0, 'take:1', 'live'))
    expect(updates).toEqual(['ready', 'ready'])
    transport.push(upsertEvent(0, 'take:1', 'duplicate'))
    expect(updates).toEqual(['ready', 'ready'])
    bridge.dispose()
  })

  it('dispose unsubscribes the transport and stops accepting pushes', () => {
    const transport = new TransportFixture()
    const bridge = new DomainOwnerSourceBridge('sonora', transport)
    bridge.open()
    bridge.dispose()
    transport.push(upsertEvent(0, 'take:1', 'after dispose'))
    expect(bridge.getSnapshot().items[0]?.title).toBe('Take one')
  })
})

describe('mountDomainOwnerSource', () => {
  it('mounts the formal domain.<owner> service on the host context and removes it on dispose', () => {
    const ctx = new Context()
    contexts.push(ctx)
    const transport = new TransportFixture()
    const dispose = mountDomainOwnerSource(ctx, 'sonora', transport)
    const service = ctx.get('domain.sonora') as { getSnapshot: () => { status: string } } | undefined
    expect(service?.getSnapshot().status).toBe('ready')
    transport.push(upsertEvent(0, 'take:1', 'live'))
    expect((ctx.get('domain.sonora') as { getSnapshot: () => { items: { title: string }[] } }).getSnapshot().items[0]?.title).toBe('live')
    dispose()
    expect(ctx.get('domain.sonora')).toBeUndefined()
  })
})
