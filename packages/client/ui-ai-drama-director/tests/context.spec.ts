import { describe, expect, it } from 'vitest'
import type { DramaContextV1 } from '@yeisme/dsh-ai-drama-director'
import { createDramaContextStore } from '../src/client/context.js'
import { createDramaEvidenceEmitter } from '../src/client/evidence.js'
import type { DramaEvidenceRecordV1 } from '@yeisme/dsh-ai-drama-director'

function contextV1(freshness: DramaContextV1['freshness'] = 'fresh', revision = 'rev:1'): DramaContextV1 {
  return {
    schema: 'drama.context.v1',
    workspaceRef: 'ws:1',
    projectRef: 'pr:1',
    showRef: 'show:1',
    episodeRef: 'ep:1',
    ownerVersions: { drama: 'v1' },
    contextRevision: revision,
    freshness,
  }
}

describe('createDramaContextStore', () => {
  it('stays unavailable without a transport and disables mutation', async () => {
    const store = createDramaContextStore({})
    const snapshot = await store.refresh()
    expect(snapshot.status).toBe('unavailable')
    expect(snapshot.mutationsEnabled).toBe(false)
    expect(snapshot.mutationReason).toBe('missing drama owner projection')
  })

  it('resolves a fresh context and enables mutations', async () => {
    const store = createDramaContextStore({ transport: { snapshot: async () => contextV1() } })
    const snapshot = await store.refresh()
    expect(snapshot.status).toBe('ready')
    expect(snapshot.mutationsEnabled).toBe(true)
    expect(snapshot.context?.showRef).toBe('show:1')
  })

  it('does not contact the transport until asked (no polling)', async () => {
    let calls = 0
    const store = createDramaContextStore({
      transport: {
        snapshot: async () => {
          calls += 1
          return contextV1('stale')
        },
      },
    })
    expect(calls).toBe(0)
    const snapshot = await store.refresh()
    expect(snapshot.status).toBe('stale')
    expect(snapshot.mutationsEnabled).toBe(false)
    expect(snapshot.mutationReason).toContain('stale')
    // No automatic retry after a degraded snapshot.
    await Promise.resolve()
    expect(calls).toBe(1)
  })

  it.each(['offline', 'gap'] as const)('disables mutation when freshness is %s', async (freshness) => {
    const store = createDramaContextStore({ transport: { snapshot: async () => contextV1(freshness) } })
    const snapshot = await store.refresh()
    expect(snapshot.status).toBe(freshness)
    expect(snapshot.mutationsEnabled).toBe(false)
  })

  it('treats a contract-invalid snapshot as partial and fail-closed', async () => {
    const store = createDramaContextStore({ transport: { snapshot: async () => ({ schema: 'nope' }) } })
    const snapshot = await store.refresh()
    expect(snapshot.status).toBe('partial')
    expect(snapshot.mutationsEnabled).toBe(false)
  })

  it('treats a throwing transport as partial, never throwing itself', async () => {
    const store = createDramaContextStore({
      transport: {
        snapshot: async () => {
          throw new Error('owner offline')
        },
      },
    })
    const snapshot = await store.refresh()
    expect(snapshot.status).toBe('partial')
    expect(snapshot.mutationsEnabled).toBe(false)
  })

  it('emits context_recovered with the recovery duration after a degraded period', async () => {
    const records: DramaEvidenceRecordV1[] = []
    let tick = 1_000
    let freshness: DramaContextV1['freshness'] = 'stale'
    const store = createDramaContextStore({
      transport: { snapshot: async () => contextV1(freshness) },
      emitter: createDramaEvidenceEmitter(record => records.push(record)),
      now: () => tick,
    })

    await store.refresh()
    expect(records).toHaveLength(0)

    tick = 2_500
    freshness = 'fresh'
    const snapshot = await store.reconcile()
    expect(snapshot.status).toBe('ready')
    const recovered = records.find(record => record.kind === 'context_recovered')
    expect(recovered?.durationMs).toBe(1_500)
    expect(JSON.stringify(recovered)).not.toMatch(/show:1|ws:1|https?:/i)
  })

  it('does not emit recovery when a fresh context only drifts revision', async () => {
    const records: DramaEvidenceRecordV1[] = []
    let revision = 'rev:1'
    const store = createDramaContextStore({
      transport: { snapshot: async () => contextV1('fresh', revision) },
      emitter: createDramaEvidenceEmitter(record => records.push(record)),
    })
    await store.refresh()
    revision = 'rev:2'
    await store.reconcile()
    expect(records.filter(record => record.kind === 'context_recovered')).toHaveLength(0)
  })

  it('notifies subscribers on refresh', async () => {
    const store = createDramaContextStore({ transport: { snapshot: async () => contextV1() } })
    let notified = 0
    const unsubscribe = store.subscribe(() => {
      notified += 1
    })
    await store.refresh()
    expect(notified).toBe(1)
    unsubscribe()
    await store.refresh()
    expect(notified).toBe(1)
  })
})
