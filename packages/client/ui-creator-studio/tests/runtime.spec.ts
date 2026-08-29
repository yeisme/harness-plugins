import { describe, expect, it, vi } from 'vitest'
import { CreatorStudioController } from '../src/controller.ts'
import {
  CREATOR_STUDIO_RUNTIME_SCHEMA,
  createCreatorStudioRuntime,
} from '../src/runtime.ts'
import { action, creatorSnapshot } from './fixtures.ts'

describe('CreatorStudioRuntimeV1', () => {
  it('shares the controller snapshot, subscription, reads, and owner receipts', async () => {
    const remote = {
      snapshot: vi.fn(async () => ({ ok: true as const, value: creatorSnapshot() })),
      dispatch: vi.fn(async () => ({ ok: true as const, value: {
        status: 'completed' as const,
        receiptRef: 'receipt:runtime:one',
        owner: 'auctra',
        actionId: 'auctra.create',
      } })),
      resolveArtifact: vi.fn(async () => ({ ok: true as const, value: null })),
    }
    const controller = new CreatorStudioController(remote)
    const runtime = createCreatorStudioRuntime(controller)
    const listener = vi.fn()
    const unsubscribe = runtime.subscribe(listener)

    expect(runtime).toMatchObject({
      schemaVersion: CREATOR_STUDIO_RUNTIME_SCHEMA,
      mode: 'shared',
      canMutate: true,
    })
    expect(runtime.getSnapshot()).toBe(controller.store.getSnapshot())
    await runtime.refresh()
    expect(runtime.getSnapshot().snapshot?.snapshotRef).toBe(creatorSnapshot().snapshotRef)
    expect(listener).toHaveBeenCalled()

    const descriptor = action('auctra', 'text')
    const receipt = await runtime.dispatchAction(descriptor, { brief: 'episode plan' })
    expect(receipt.status).toBe('completed')
    expect(remote.dispatch).toHaveBeenCalledOnce()

    unsubscribe()
    controller.dispose()
  })
})
