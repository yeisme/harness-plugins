import { describe, expect, it, vi } from 'vitest'
import { CreatorStudioController } from '../src/controller.ts'
import { action, creatorSnapshot } from './fixtures.ts'

describe('CreatorStudioController', () => {
  it('reconciles using only the original key and never resubmits on lookup failure or rejection', async () => {
    const dispatch = vi.fn(async () => { throw new Error('lost response') })
    const reconcile = vi.fn().mockRejectedValueOnce(new Error('lookup failure'))
      .mockResolvedValueOnce({ ok: true, value: { status: 'rejected', receiptRef: 'receipt:denied', owner: 'eikona', actionId: 'eikona.create' } })
      .mockResolvedValue({ ok: true, value: { status: 'completed', receiptRef: 'receipt:original', owner: 'eikona', actionId: 'eikona.create' } })
    const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }), dispatch, reconcile,
      resolveArtifact: async () => ({ ok: true, value: null }) })
    const descriptor = action('eikona', 'image')
    await controller.refresh()
    await controller.dispatchAction(descriptor, { brief: 'synthetic generation input' })
    expect((await controller.reconcileAction(descriptor)).status).toBe('unknown')
    expect((await controller.reconcileAction(descriptor)).status).toBe('unknown')
    await controller.dispatchAction(descriptor, { brief: 'must not submit' })
    expect(dispatch).toHaveBeenCalledOnce()
    const original = (dispatch.mock.calls as unknown as [[{ idempotencyKey: string }]])[0][0]
    expect(reconcile.mock.calls[0]![0]).toMatchObject({ idempotencyKey: original.idempotencyKey, owner: 'eikona', actionId: 'eikona.create' })
    expect(reconcile.mock.calls[0]![0]).not.toHaveProperty('values')
    expect(JSON.stringify(reconcile.mock.calls)).not.toContain('synthetic generation input')
    expect((await controller.reconcileAction(descriptor)).status).toBe('completed')
    expect(controller.store.getSnapshot().lastReceipt?.receiptRef).toBe('receipt:original')
    expect(dispatch).toHaveBeenCalledOnce()
  })
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
    await controller.refresh()
    await controller.dispatchAction({ ...action('eikona', 'image'), descriptorRef: 'action:refreshed' }, { brief: 'changed' })
    controller.reset()
    await controller.refresh()
    await controller.dispatchAction(action('eikona', 'image'), { brief: 'again' })
    expect(remote.dispatch).toHaveBeenCalledOnce()
  })

  it('blocks a repeated click while pending and does not publish a late receipt into another project', async () => {
    let snapshot = creatorSnapshot()
    let settle!: (value: any) => void
    const dispatch = vi.fn(() => new Promise<any>(resolve => { settle = resolve }))
    const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: snapshot }), dispatch,
      resolveArtifact: async () => ({ ok: true, value: null }) })
    await controller.refresh()
    const first = controller.dispatchAction(action('eikona', 'image'), { brief: 'one' })
    await controller.refresh()
    expect((await controller.dispatchAction(action('eikona', 'image'), { brief: 'two' })).status).toBe('pending')
    expect(dispatch).toHaveBeenCalledOnce()
    const context = { ...snapshot.context!, projectRef: 'project:two', revision: '2' }
    snapshot = { ...snapshot, snapshotRef: 'snapshot:two', snapshotVersion: 2, context,
      owners: snapshot.owners.map(owner => ({ ...owner, context, actions: owner.actions.map(item => ({ ...item, context })) })) }
    await controller.refresh()
    settle({ ok: true, value: { status: 'completed', receiptRef: 'receipt:first', owner: 'eikona', actionId: 'eikona.create' } })
    await first
    expect(controller.store.getSnapshot().snapshot?.context?.projectRef).toBe('project:two')
    expect(controller.store.getSnapshot().lastReceipt).toBeNull()
  })

  it('treats a receipt for another action as unknown and allows a deliberate new attempt after confirmed failure', async () => {
    const dispatch = vi.fn().mockResolvedValueOnce({ ok: true, value: { status: 'failed', receiptRef: 'receipt:failed', owner: 'eikona', actionId: 'eikona.create' } })
      .mockResolvedValue({ ok: true, value: { status: 'completed', receiptRef: 'receipt:wrong', owner: 'sonora', actionId: 'sonora.create' } })
    const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }), dispatch,
      resolveArtifact: async () => ({ ok: true, value: null }) })
    await controller.refresh()
    expect((await controller.dispatchAction(action('eikona', 'image'), { brief: 'one' })).status).toBe('failed')
    expect((await controller.dispatchAction(action('eikona', 'image'), { brief: 'two' })).status).toBe('unknown')
    await controller.dispatchAction(action('eikona', 'image'), { brief: 'three' })
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(dispatch.mock.calls[0]![0].idempotencyKey).not.toBe(dispatch.mock.calls[1]![0].idempotencyKey)
  })

  it('loads project-scoped asset pages and clears them on context reset', async () => {
    const remote = {
      snapshot: vi.fn(async () => ({ ok: true as const, value: creatorSnapshot() })),
      dispatch: vi.fn(async () => ({ ok: true as const, value: { status: 'accepted' as const, receiptRef: 'receipt:one' } })),
      resolveArtifact: vi.fn(async () => ({ ok: true as const, value: null })),
      assets: vi.fn(async () => ({ ok: true as const, value: {
        schemaVersion: 'creator.asset.page.v1alpha1' as const,
        scope: 'current_project' as const,
        status: 'ready' as const,
        freshness: 'fresh' as const,
        reasonCode: 'asset_page' as const,
        safeMessage: 'Assets ready.',
        items: [{ owner: 'eikona' as const, projectRef: 'project:one', ref: 'image:one', version: '1', kind: 'image', title: 'Image one', status: 'ready', evidenceRefs: [] }],
        unavailableOwners: [],
      } })),
    }
    const controller = new CreatorStudioController(remote)
    await controller.refresh()
    await controller.loadAssets({ scope: 'current_project' })
    expect(controller.store.getSnapshot()).toMatchObject({ assetPhase: 'ready', assetItems: [{ projectRef: 'project:one' }] })
    controller.reset()
    expect(controller.store.getSnapshot()).toMatchObject({ assetPhase: 'cold', assetItems: [], assetNextCursor: null })
  })

  it('submits an Ordo approval once and preserves unknown settlement', async () => {
    const decideApproval = vi.fn(async () => { throw new Error('uncertain') })
    const controller = new CreatorStudioController({
      snapshot: async () => ({ ok: true, value: creatorSnapshot() }),
      dispatch: async () => ({ ok: true, value: { status: 'accepted', receiptRef: 'receipt:one' } }),
      resolveArtifact: async () => ({ ok: true, value: null }),
      decideApproval,
    })
    await controller.refresh()
    const receipt = await controller.decideApproval('decision:one')
    expect(receipt).toMatchObject({ status: 'unknown', reconcileReason: 'settlement_unknown' })
    expect(decideApproval).toHaveBeenCalledOnce()
  })

  it('clears asset pages when the frozen project context changes', async () => {
    const first = creatorSnapshot()
    let snapshot = first
    const controller = new CreatorStudioController({
      snapshot: async () => ({ ok: true, value: snapshot }),
      dispatch: async () => ({ ok: true, value: { status: 'accepted', receiptRef: 'receipt:one' } }),
      resolveArtifact: async () => ({ ok: true, value: null }),
      assets: async () => ({ ok: true, value: { schemaVersion: 'creator.asset.page.v1alpha1', scope: 'current_project', status: 'ready', freshness: 'fresh', reasonCode: 'asset_page', safeMessage: 'Assets ready.', items: [{ owner: 'eikona', projectRef: 'project:one', ref: 'image:one', version: '1', kind: 'image', title: 'Image one', status: 'ready', evidenceRefs: [] }], unavailableOwners: [] } }),
    })
    await controller.refresh()
    await controller.loadAssets({ scope: 'current_project' })
    const context = { ...first.context!, projectRef: 'project:two', revision: '2' }
    snapshot = {
      ...first,
      snapshotRef: 'creator:studio:runtime:2:1',
      snapshotVersion: 2,
      context,
      owners: first.owners.map(owner => ({ ...owner, context, actions: owner.actions.map(item => ({ ...item, context })) })),
    }
    await controller.refresh()
    expect(controller.store.getSnapshot()).toMatchObject({ assetPhase: 'cold', assetItems: [], snapshot: { context: { projectRef: 'project:two' } } })
  })
})
