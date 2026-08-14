import { describe, expect, it, vi } from 'vitest'
import { OrdoAgentOpsController } from '../src/client/controller.ts'
import type { OrdoAgentOpsSnapshot } from '@deepseek-ai/dsh-api-remotes/client'

const snapshot: OrdoAgentOpsSnapshot = {
  schemaVersion: 'ordo.agent_ops.snapshot.v1alpha1',
  snapshotRef: 'snapshot-1' as OrdoAgentOpsSnapshot['snapshotRef'],
  snapshotVersion: 1,
  generatedAt: '2026-08-14T00:00:00.000Z',
  state: 'needs_contract',
  freshness: 'offline',
  reasonCode: 'owner_read_contract_unavailable',
  source: 'owner-gated',
  safeMessage: 'owner projection is not mounted',
}

function readableSnapshot(version: number, ref = 'snapshot-1'): OrdoAgentOpsSnapshot {
  return {
    schemaVersion: 'ordo.agent_ops.snapshot.v1alpha1',
    snapshotRef: ref as OrdoAgentOpsSnapshot['snapshotRef'],
    snapshotVersion: version,
    generatedAt: '2026-08-14T00:00:00.000Z',
    state: 'ready',
    freshness: 'fresh',
    reasonCode: 'owner_snapshot',
    source: 'owner',
    safeMessage: 'owner projection',
    context: {
      tenantRef: 'tenant-1' as never,
      workspaceRef: 'workspace-1' as never,
      principalRef: 'principal-1' as never,
      contextRevision: 1,
      installationRef: 'installation-1' as never,
    },
    run: {
      runRef: 'run-1' as never,
      state: 'active',
      safeTitle: 'Safe run summary',
      taskCount: 3,
      completedTaskCount: version,
      attentionCount: 0,
    },
  }
}

describe('OrdoAgentOpsController', () => {
  it('single-flights reads and publishes the owner state', async () => {
    const snapshotRead = vi.fn().mockResolvedValue({ ok: true, value: snapshot } as const)
    const controller = new OrdoAgentOpsController({ snapshot: snapshotRead })
    const first = controller.refresh()
    const second = controller.refresh()
    expect(first).toBe(second)
    await first
    expect(snapshotRead).toHaveBeenCalledOnce()
    expect(controller.store.getSnapshot()).toMatchObject({ phase: 'ready', snapshot })
  })

  it('drops a late answer after reset', async () => {
    let resolve: ((result: { ok: true; value: OrdoAgentOpsSnapshot }) => void) | undefined
    const snapshotRead = vi.fn(() => new Promise<{ ok: true; value: OrdoAgentOpsSnapshot }>((done) => { resolve = done }))
    const controller = new OrdoAgentOpsController({ snapshot: snapshotRead })
    const read = controller.refresh()
    controller.reset()
    resolve?.({ ok: true, value: snapshot })
    await read
    expect(controller.store.getSnapshot()).toEqual({ phase: 'cold', snapshot: null, errorCode: null })
  })

  it('keeps remote failure codes without rendering raw transport details', async () => {
    const controller = new OrdoAgentOpsController({
      snapshot: async () => ({
        ok: false,
        error: { code: 'CONTRACT_MISMATCH', message: 'ignored by the compact client', details: {} },
      }),
    })
    await controller.refresh()
    expect(controller.store.getSnapshot()).toEqual({ phase: 'error', snapshot: null, errorCode: 'CONTRACT_MISMATCH' })
  })

  it('ignores a duplicate snapshot version idempotently', async () => {
    const projection = readableSnapshot(1)
    const snapshotRead = vi.fn().mockResolvedValue({ ok: true, value: projection } as const)
    const controller = new OrdoAgentOpsController({ snapshot: snapshotRead })
    await controller.refresh()
    const first = controller.store.getSnapshot()
    await controller.refresh()
    expect(snapshotRead).toHaveBeenCalledTimes(2)
    expect(controller.store.getSnapshot()).toEqual({ phase: 'ready', snapshot: projection, errorCode: null })
    expect(controller.store.getSnapshot().snapshot).toBe(first.snapshot)
  })

  it('advances the cursor on a newer snapshot version', async () => {
    const projections = [readableSnapshot(1), readableSnapshot(2)]
    const snapshotRead = vi.fn(async () => ({ ok: true, value: projections.shift()! } as const))
    const controller = new OrdoAgentOpsController({ snapshot: snapshotRead })
    await controller.refresh()
    await controller.refresh()
    expect(controller.store.getSnapshot().snapshot?.snapshotVersion).toBe(2)
    expect(controller.store.getSnapshot().snapshot?.run?.completedTaskCount).toBe(2)
  })

  it('fails closed on a version regression and reconciles on the next read', async () => {
    const projections = [readableSnapshot(2), readableSnapshot(1), readableSnapshot(1)]
    const snapshotRead = vi.fn(async () => ({ ok: true, value: projections.shift()! } as const))
    const controller = new OrdoAgentOpsController({ snapshot: snapshotRead })
    await controller.refresh()
    await controller.refresh()
    expect(controller.store.getSnapshot()).toEqual({ phase: 'error', snapshot: null, errorCode: 'owner_cursor_drift' })
    await controller.refresh()
    expect(controller.store.getSnapshot()).toMatchObject({ phase: 'ready', errorCode: null })
    expect(controller.store.getSnapshot().snapshot?.snapshotVersion).toBe(1)
  })

  it('fails closed when the snapshot ref rotates under an established cursor', async () => {
    const projections = [readableSnapshot(1), readableSnapshot(1, 'snapshot-rotated')]
    const snapshotRead = vi.fn(async () => ({ ok: true, value: projections.shift()! } as const))
    const controller = new OrdoAgentOpsController({ snapshot: snapshotRead })
    await controller.refresh()
    await controller.refresh()
    expect(controller.store.getSnapshot()).toEqual({ phase: 'error', snapshot: null, errorCode: 'owner_cursor_drift' })
  })

  it('keeps the cursor across non-readable owner states', async () => {
    const projections = [readableSnapshot(1), snapshot, readableSnapshot(1), readableSnapshot(2)]
    const snapshotRead = vi.fn(async () => ({ ok: true, value: projections.shift()! } as const))
    const controller = new OrdoAgentOpsController({ snapshot: snapshotRead })
    await controller.refresh()
    await controller.refresh()
    expect(controller.store.getSnapshot()).toMatchObject({ phase: 'ready', snapshot })
    await controller.refresh()
    expect(controller.store.getSnapshot().snapshot?.snapshotVersion).toBe(1)
    await controller.refresh()
    expect(controller.store.getSnapshot().snapshot?.snapshotVersion).toBe(2)
  })

  it('maps a read disconnect to a safe error without synthesizing terminal run state', async () => {
    let fail = false
    const snapshotRead = vi.fn(async () => {
      if (fail) throw new Error('owner stream disconnected')
      return { ok: true, value: readableSnapshot(1) } as const
    })
    const controller = new OrdoAgentOpsController({ snapshot: snapshotRead })
    await controller.refresh()
    expect(controller.store.getSnapshot().snapshot?.run?.state).toBe('active')
    fail = true
    await controller.refresh()
    expect(controller.store.getSnapshot()).toEqual({ phase: 'error', snapshot: null, errorCode: 'remote_read_failed' })
  })
})
