import { describe, expect, it, vi } from 'vitest'
import { CreatorStudioController } from '../src/controller.ts'
import { action, creatorSnapshot } from './fixtures.ts'

describe('CreatorStudioController', () => {
  it('reads a validated snapshot and dispatches ephemeral values once', async () => {
    const snapshot = creatorSnapshot()
    const remote = {
      snapshot: vi.fn(async () => ({ ok: true as const, value: snapshot })),
      dispatch: vi.fn(async () => ({ ok: true as const, value: { status: 'completed' as const, receiptRef: 'receipt:eikona:1', owner: 'eikona', actionId: 'eikona.create', summary: 'Created.' } })),
      resolveArtifact: vi.fn(async () => ({ ok: true as const, value: { url: 'https://media.invalid/one', expiresAt: '2999-01-01T00:00:00Z' } })),
    }
    const controller = new CreatorStudioController(remote)
    await controller.refresh()
    expect(controller.store.getSnapshot().snapshot?.production?.currentStage).toBe('shots')
    const descriptor = action('eikona', 'image')
    const receipt = await controller.dispatchAction(descriptor, { brief: 'Rainy city at night' })
    expect(receipt.status).toBe('completed')
    expect(remote.dispatch).toHaveBeenCalledTimes(1)
    expect(remote.dispatch.mock.calls[0]?.[0]).toMatchObject({ descriptorRef: descriptor.descriptorRef, values: { brief: 'Rainy city at night' } })
    expect(JSON.stringify(controller.store.getSnapshot())).not.toContain('Rainy city at night')
    await expect(controller.resolveArtifact(snapshot.owners[0]!.resources[0]!.artifact!)).resolves.toBe('https://media.invalid/one')
  })

  it('preserves unknown settlement without retrying the mutation', async () => {
    const remote = {
      snapshot: vi.fn(async () => ({ ok: true as const, value: creatorSnapshot() })),
      dispatch: vi.fn(async () => { throw new Error('uncertain transport') }),
      resolveArtifact: vi.fn(async () => ({ ok: true as const, value: null })),
    }
    const controller = new CreatorStudioController(remote)
    await controller.refresh()
    const receipt = await controller.dispatchAction(action('eikona', 'image'), { brief: 'one' })
    expect(receipt.status).toBe('unknown')
    expect(receipt.reconcileReason).toBe('settlement_unknown')
    expect(remote.dispatch).toHaveBeenCalledOnce()
  })
})
