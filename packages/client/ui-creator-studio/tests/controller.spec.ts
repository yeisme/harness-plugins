import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { CreatorStudioController } from '../src/controller.ts'
import { action, creatorSnapshot } from './fixtures.ts'

it('sends advertised large text separately and retains only the original key for unknown recovery', async () => {
  const descriptor = { ...action('eikona', 'image'), fields: [{ key: 'body', kind: 'textarea' as const, label: 'Text', required: true, maxLength: 16384 }], textBody: { field: 'body', maxBytes: 2 * 1024 * 1024 } }
  const dispatch = vi.fn(async (_request: unknown) => ({ ok: true as const, value: { status: 'unknown' as const, owner: descriptor.owner, actionId: descriptor.actionId, receiptRef: 'receipt:large' } }))
  const reconcile = vi.fn(async (_request: unknown) => ({ ok: true as const, value: { status: 'completed' as const, owner: descriptor.owner, actionId: descriptor.actionId, receiptRef: 'receipt:large' } }))
  const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }), dispatch, reconcile })
  await controller.refresh()
  const content = 'large draft '.repeat(2000)
  await controller.dispatchAction(descriptor, { body: content })
  const sent = dispatch.mock.calls[0]![0] as { values: object; textBody: { content: string }; idempotencyKey: string }
  expect(sent.values).toEqual({})
  expect(sent.textBody.content === content).toBe(true)
  expect(JSON.stringify(controller.store.getSnapshot()).includes(content)).toBe(false)
  await controller.reconcileAction(descriptor)
  expect(dispatch).toHaveBeenCalledOnce()
  expect(reconcile.mock.calls[0]![0]).toMatchObject({ idempotencyKey: sent.idempotencyKey })
  expect(JSON.stringify(reconcile.mock.calls[0]![0]).includes('textBody')).toBe(false)
  controller.dispose()
})

it('exposes unresolved state only for the matching target and releases it after reconciliation', async () => {
  const descriptor = action('eikona', 'image'), snapshot = creatorSnapshot()
  const dispatch = vi.fn(async () => ({ ok: true as const, value: { status: 'unknown' as const, owner: 'eikona', actionId: descriptor.actionId, receiptRef: 'receipt:original' } }))
  const reconcile = vi.fn(async () => ({ ok: true as const, value: { status: 'completed' as const, owner: 'eikona', actionId: descriptor.actionId, receiptRef: 'receipt:original' } }))
  const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: snapshot }), dispatch, reconcile })
  await controller.refresh()
  expect(controller.hasUnresolvedAction(descriptor)).toBe(false)
  await controller.dispatchAction(descriptor, { brief: 'draft' })
  expect(controller.hasUnresolvedAction(descriptor)).toBe(true)
  expect(controller.hasUnresolvedAction({ ...descriptor, descriptorRef: 'refreshed:descriptor' })).toBe(true)
  expect(controller.hasUnresolvedAction({ ...descriptor, targetRef: 'target:other' })).toBe(false)
  expect(controller.hasUnresolvedAction({ ...descriptor, context: { ...descriptor.context, projectRef: 'project:other' } })).toBe(false)
  await controller.reconcileAction(descriptor)
  expect(controller.hasUnresolvedAction(descriptor)).toBe(false)
  expect(dispatch).toHaveBeenCalledOnce()
})

it('rejects late, reset and mismatched candidate selection responses without retry', async () => {
  const selection = { artifactRef: 'eikona://artifacts/run/candidate', contentDigest: 'a'.repeat(64) }
  const releases: ((value: any) => void)[] = []
  const select = vi.fn(() => new Promise<any>(resolve => releases.push(resolve)))
  const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }), dispatch: vi.fn(), selectEikonaCandidate: select })
  await controller.refresh()
  const first = controller.selectEikonaCandidate({ selection })
  const second = controller.selectEikonaCandidate({ selection: null })
  releases[1]!({ ok: true, value: { status: 'cleared' } })
  expect(await second).toEqual({ status: 'cleared' })
  releases[0]!({ ok: true, value: { status: 'selected', selection } })
  expect(await first).toEqual({ status: 'superseded' })
  const third = controller.selectEikonaCandidate({ selection })
  releases[2]!({ ok: true, value: { status: 'selected', selection: { ...selection, contentDigest: 'b'.repeat(64) } } })
  expect(await third).toEqual({ status: 'unconfirmed' })
  const fourth = controller.selectEikonaCandidate({ selection })
  controller.reset()
  releases[3]!({ ok: true, value: { status: 'selected', selection } })
  expect(await fourth).toEqual({ status: 'permission_denied' })
  expect(select).toHaveBeenCalledTimes(4)
})

describe('CreatorStudioController', () => {
  it('keeps a recovery save unconfirmed after reset and never retries or marks the document saved', async () => {
    let release!: (result: { ok: true; value: unknown }) => void
    const save = vi.fn(() => new Promise<{ ok: true; value: unknown }>(resolve => { release = resolve }))
    const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }), dispatch: vi.fn(),
      resolveArtifact: async () => ({ ok: true, value: null }), saveAuctraRecoveryDraft: save })
    await controller.refresh()
    const version = '0:' + 'a'.repeat(64)
    const input = { base: { artifact: { schema: 'pane.artifact.v1alpha1' as const, owner: 'auctra', kind: 'text', ref: 'auctra:working-copy:note', version, mediaType: 'text/plain', title: 'Note', evidenceRefs: [], capabilities: [] }, contentRevision: version, content: 'original' }, content: 'PRIVATE_BUFFER' }
    const pending = controller.saveAuctraRecoveryDraft(input)
    expect(save).toHaveBeenCalledOnce()
    controller.reset()
    release({ ok: true, value: { status: 'ready' } })
    expect(await pending).toEqual({ status: 'unconfirmed' })
    expect(save).toHaveBeenCalledOnce()
    expect(controller.store.getSnapshot().lastReceipt).toBeNull()
    expect(JSON.stringify(controller.store.getSnapshot())).not.toContain('PRIVATE_BUFFER')
    controller.dispose()
  })

  it.each(['reset', 'dispose', 'project', 'principal'] as const)('discards recovery list and body after %s', async change => {
    let snapshot = creatorSnapshot()
    let releaseList!: (value: { ok: true; value: unknown }) => void
    let releaseRead!: (value: { ok: true; value: unknown }) => void
    const list = vi.fn(() => new Promise<{ ok: true; value: unknown }>(resolve => { releaseList = resolve }))
    const read = vi.fn(() => new Promise<{ ok: true; value: unknown }>(resolve => { releaseRead = resolve }))
    const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: snapshot }), dispatch: vi.fn(),
      resolveArtifact: async () => ({ ok: true, value: null }), listAuctraRecoveryDrafts: list, readAuctraRecoveryDraft: read })
    expect(await controller.listAuctraRecoveryDrafts()).toEqual({ status: 'unavailable' })
    expect(list).not.toHaveBeenCalled()
    await controller.refresh()
    const pendingList = controller.listAuctraRecoveryDrafts()
    const pendingRead = controller.readAuctraRecoveryDraft({ ref: 'auctra:editor-recovery:' + 'a'.repeat(32) + ':erd-' + 'b'.repeat(32), unitRef: 'text:note', baseVersion: '0:' + 'c'.repeat(64), revision: 1, contentDigest: 'd'.repeat(64), byteLength: 4, updatedAt: '2026-09-08T00:00:00Z' })
    if (change === 'reset') controller.reset()
    else if (change === 'dispose') controller.dispose()
    else {
      const key = change === 'project' ? 'projectRef' : 'principalRef'
      snapshot = JSON.parse(JSON.stringify(snapshot).replaceAll(snapshot.context![key]!, 'other:scope'))
      await controller.refresh()
    }
    releaseList({ ok: true, value: { status: 'ready', drafts: [] } })
    releaseRead({ ok: true, value: { status: 'ready', content: 'PRIVATE_RECOVERY_BODY' } })
    expect(await pendingList).toEqual({ status: 'permission_denied' })
    expect(await pendingRead).toEqual({ status: 'permission_denied' })
    expect(JSON.stringify(controller.store.getSnapshot())).not.toContain('PRIVATE_RECOVERY_BODY')
    controller.dispose()
  })

  it('queries a listed recovery without an execution descriptor or dispatch', async () => {
    const snapshot = creatorSnapshot(), descriptor = action('eikona', 'image')
    const request = { schema: 'pane.action-reconcile-request.v1alpha1' as const, owner: descriptor.owner, actionId: descriptor.actionId,
      expectedTargetRef: descriptor.targetRef, context: snapshot.context!, idempotencyKey: 'stored-recovery-key' }
    const page = { schemaVersion: 'creator.operation-recovery-page.v1alpha1' as const, status: 'ready' as const, context: snapshot.context!, operations: [{ request, targetVersion: '1' }] }
    const dispatch = vi.fn(), reconcile = vi.fn(async () => ({ ok: true as const, value: { owner: descriptor.owner, actionId: descriptor.actionId, status: 'completed' as const, receiptRef: 'receipt:original' } }))
    const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: snapshot }), dispatch, reconcile,
      resolveArtifact: async () => ({ ok: true, value: null }), listOperationRecoveries: async () => ({ ok: true, value: page }) })
    await controller.refresh()
    expect(await controller.listOperationRecoveries()).toEqual(page)
    expect(reconcile).not.toHaveBeenCalled()
    expect((await controller.reconcileStoredOperation(request)).status).toBe('completed')
    expect(dispatch).not.toHaveBeenCalled()
    expect(reconcile.mock.calls[0]?.[0]).toEqual(request)
    controller.dispose()
  })
  it.each(['principalRef', 'projectRef'] as const)('rejects a recalled original identity from another %s before dispatch', async field => {
    const descriptor = action('eikona', 'image')
    const original = { schema: 'pane.action-reconcile-request.v1alpha1' as const, owner: descriptor.owner, actionId: descriptor.actionId,
      expectedTargetRef: descriptor.targetRef, context: { ...descriptor.context, [field]: 'other:scope' }, idempotencyKey: 'other-original-key' }
    const dispatch = vi.fn()
    const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }), dispatch,
      resolveArtifact: async () => ({ ok: true, value: null }), recallOperationIdentity: async () => ({ ok: true, value: original }) })
    await controller.refresh()
    expect((await controller.dispatchAction(descriptor, { brief: 'local draft' })).status).toBe('unknown')
    expect(dispatch).not.toHaveBeenCalled()
    controller.dispose()
  })
  it('restores a stored original key before dispatch and reconciles without sending a replacement', async () => {
    const descriptor = action('eikona', 'image')
    const original = { schema: 'pane.action-reconcile-request.v1alpha1' as const, owner: descriptor.owner, actionId: descriptor.actionId,
      expectedTargetRef: descriptor.targetRef, context: descriptor.context, idempotencyKey: 'stored-original-key' }
    const dispatch = vi.fn(), reconcile = vi.fn(async () => ({ ok: true as const, value: { owner: descriptor.owner, actionId: descriptor.actionId, status: 'completed' as const, receiptRef: 'receipt:original' } }))
    const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }), dispatch, reconcile,
      resolveArtifact: async () => ({ ok: true, value: null }), recallOperationIdentity: async () => ({ ok: true, value: original }) })
    await controller.refresh()
    expect((await controller.dispatchAction(descriptor, { brief: 'new local draft' })).status).toBe('reconcile_required')
    expect(dispatch).not.toHaveBeenCalled()
    expect((await controller.reconcileAction(descriptor)).status).toBe('completed')
    expect(reconcile.mock.calls[0]?.[0]).toMatchObject({ idempotencyKey: 'stored-original-key' })
    expect(reconcile.mock.calls[0]?.[0]).not.toHaveProperty('values')
    controller.dispose()
  })
  it('does not dispatch after context resets during original-key preflight', async () => {
    const descriptor = action('eikona', 'image')
    let resolve!: (value: { ok: true; value: null }) => void
    const dispatch = vi.fn(), recall = vi.fn(() => new Promise<{ ok: true; value: null }>(done => { resolve = done }))
    const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }), dispatch,
      resolveArtifact: async () => ({ ok: true, value: null }), recallOperationIdentity: recall })
    await controller.refresh()
    const result = controller.dispatchAction(descriptor, { brief: 'pending draft' })
    expect(recall).toHaveBeenCalledOnce()
    controller.reset()
    resolve({ ok: true, value: null })
    expect((await result).status).toBe('unknown')
    expect(dispatch).not.toHaveBeenCalled()
    controller.dispose()
  })
  it('candidate pages require initialized context and discard replies after reset', async () => {
    const artifact = { schema: 'pane.artifact.v1alpha1' as const, owner: 'auctra', kind: 'text', ref: 'auctra:working-copy:fixture',
      version: '1:fixture', mediaType: 'text/plain', title: 'Working Copy', capabilities: [], evidenceRefs: [] }
    const query = { schemaVersion: 'creator.candidate-query.v1alpha1' as const, artifact, limit: 1 }
    const page = { schemaVersion: 'creator.candidate-page.v1alpha1' as const, status: 'ready' as const, artifact, candidates: [] }
    const readCandidatePage = vi.fn(async () => ({ ok: true as const, value: page }))
    const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }),
      dispatch: vi.fn(), resolveArtifact: async () => ({ ok: true, value: null }), readCandidatePage })
    expect((await controller.readCandidatePage(query)).status).toBe('unavailable')
    expect(readCandidatePage).not.toHaveBeenCalled()
    await controller.refresh()
    expect(await controller.readCandidatePage(query)).toEqual(page)
    let resolve!: (value: { ok: true; value: typeof page }) => void
    readCandidatePage.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const pending = controller.readCandidatePage(query)
    controller.reset()
    resolve({ ok: true, value: page })
    expect((await pending).status).toBe('permission_denied')
    expect(readCandidatePage).toHaveBeenCalledTimes(2)
    controller.dispose()
  })
  it('retains partial operation identity across repeated lookups until authoritative completion', async () => {
    const partial = { status: 'partial' as const, receiptRef: 'receipt:partial', owner: 'eikona', actionId: 'eikona.create' }
    const dispatch = vi.fn(async () => ({ ok: true as const, value: partial }))
    const reconcile = vi.fn().mockResolvedValueOnce({ ok: true, value: partial }).mockResolvedValueOnce({ ok: true, value: { ...partial, status: 'completed' } })
    const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }), dispatch, reconcile, resolveArtifact: async () => ({ ok: true, value: null }) })
    await controller.refresh()
    const descriptor = action('eikona', 'image')
    expect((await controller.dispatchAction(descriptor, { brief: 'synthetic partial operation' })).status).toBe('partial')
    expect((await controller.dispatchAction(descriptor, { brief: 'must not submit again' })).status).toBe('partial')
    expect((await controller.reconcileAction(descriptor)).status).toBe('partial')
    expect((await controller.dispatchAction(descriptor, { brief: 'still must not submit' })).status).toBe('partial')
    expect((await controller.reconcileAction(descriptor)).status).toBe('completed')
    expect(dispatch).toHaveBeenCalledTimes(1)
    const original = dispatch.mock.calls[0]![0] as any
    expect(reconcile).toHaveBeenCalledTimes(2)
    for (const [request] of reconcile.mock.calls) {
      expect(request.idempotencyKey).toBe(original.idempotencyKey)
      expect(request.expectedTargetRef).toBe(original.expectedTargetRef)
      expect(request).not.toHaveProperty('values')
    }
    controller.dispose()
  })

  it('reads capabilities only after context initialization and discards reset-time replies', async () => {
    const catalog = { validation_level: 'capability_probe' as const, profiles: [], diagnostics_available: true }
    const readTranscriptionCatalog = vi.fn(async () => ({ ok: true as const, value: catalog }))
    const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }),
      dispatch: vi.fn(), resolveArtifact: async () => ({ ok: true, value: null }), readTranscriptionCatalog })
    expect(await controller.readTranscriptionCatalog()).toBeUndefined()
    expect(readTranscriptionCatalog).not.toHaveBeenCalled()
    await controller.refresh()
    expect(await controller.readTranscriptionCatalog()).toEqual(catalog)
    let resolve!: (value: { ok: true; value: typeof catalog }) => void
    readTranscriptionCatalog.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const pending = controller.readTranscriptionCatalog()
    controller.reset()
    resolve({ ok: true, value: catalog })
    expect(await pending).toBeUndefined()
    controller.dispose()
  })
  it('restores an original operation identity from Host storage after a new controller instance', async () => {
    const identity = { schema: 'pane.action-reconcile-request.v1alpha1' as const, owner: 'auctra' as const, actionId: 'working-copy.candidate.adopt',
      expectedTargetRef: 'auctra:working-copy:note', context: creatorSnapshot().context!, idempotencyKey: 'creator-persisted-key' }
    const dispatch = vi.fn(async () => { throw new Error('lost response') })
    const recallOperationIdentity = vi.fn(async () => ({ ok: true as const, value: identity }))
    const reconcile = vi.fn(async () => ({ ok: true as const, value: { status: 'completed' as const, receiptRef: 'receipt:adopted', owner: 'auctra', actionId: 'working-copy.candidate.adopt',
      summary: 'Auctra adopted the candidate into the Working Copy. Checkpoint, Review, and Canon stay separate.' } }))
    const first = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }), dispatch, reconcile, resolveArtifact: async () => ({ ok: true, value: null }) })
    await first.refresh()
    const descriptor = { ...action('auctra', 'text', 'working-copy.candidate.adopt'), targetRef: identity.expectedTargetRef }
    expect((await first.dispatchAction(descriptor, { candidate_ref: 'cand-one' })).status).toBe('unknown')
    first.dispose()
    const restored = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }), dispatch, reconcile, recallOperationIdentity, resolveArtifact: async () => ({ ok: true, value: null }) })
    await restored.refresh()
    const receipt = await restored.reconcileAction(descriptor)
    expect(receipt.status).toBe('completed')
    expect(recallOperationIdentity).toHaveBeenCalledWith({ owner: 'auctra', actionId: 'working-copy.candidate.adopt', expectedTargetRef: identity.expectedTargetRef })
    expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'creator-persisted-key', owner: 'auctra' }))
    expect(reconcile.mock.calls[0]![0]).not.toHaveProperty('values')
    expect(dispatch).toHaveBeenCalledOnce()
    restored.dispose()
  })

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

it('discards a late Eikona page after reset without storing it or retrying', async () => {
  let release!: (value: { ok: true; value: { status: 'ready'; items: [] } }) => void
  const read = vi.fn(() => new Promise<{ ok: true; value: { status: 'ready'; items: [] } }>(resolve => { release = resolve }))
  const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }), dispatch: vi.fn(), readEikonaAssetPage: read })
  await controller.refresh()
  const pending = controller.readEikonaAssetPage({ limit: 20 })
  expect(read).toHaveBeenCalledWith({ limit: 20 })
  controller.reset()
  release({ ok: true, value: { status: 'ready', items: [] } })
  expect(await pending).toEqual({ status: 'permission_denied' })
  expect(read).toHaveBeenCalledOnce()
  controller.dispose()
})
it('keeps a late approval unconfirmed after reset and never repeats the approval', async () => {
  let release!: (value: { ok: true; value: { status: 'unconfirmed' } }) => void
  const approve = vi.fn(() => new Promise<{ ok: true; value: { status: 'unconfirmed' } }>(resolve => { release = resolve }))
  const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }), dispatch: vi.fn(), approveEikonaPreparation: approve })
  await controller.refresh()
  const input = { preparation_ref: `egp_${'a'.repeat(64)}`, expected_digest: 'b'.repeat(64), max_cost_usd: 0.5, max_images: 1, allow_unknown_cost: true, confirmed: true, expires_in_seconds: 60 }
  expect(await controller.approveEikonaPreparation({ ...input, confirmed: false })).toEqual({ status: 'invalid_input' })
  expect(approve).not.toHaveBeenCalled()
  const pending = controller.approveEikonaPreparation(input)
  controller.reset()
  release({ ok: true, value: { status: 'unconfirmed' } })
  expect(await pending).toEqual({ status: 'unconfirmed' })
  expect(approve).toHaveBeenCalledOnce()
  controller.dispose()
})

it('discards late preparation after reset without repeating the owner write', async () => {
  let release!: (value: { ok: true; value: { status: 'unconfirmed' } }) => void
  const prepare = vi.fn(() => new Promise<{ ok: true; value: { status: 'unconfirmed' } }>(resolve => { release = resolve }))
  const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }), dispatch: vi.fn(), prepareEikonaGeneration: prepare })
  await controller.refresh()
  expect(await controller.prepareEikonaGeneration({ prompt_id: 'prompt', prompt_version: 0 })).toEqual({ status: 'invalid_input' })
  expect(prepare).not.toHaveBeenCalled()
  const pending = controller.prepareEikonaGeneration({ prompt_id: 'prompt', prompt_version: 1 })
  expect(prepare).toHaveBeenCalledWith({ prompt_id: 'prompt', prompt_version: 1 })
  controller.reset()
  release({ ok: true, value: { status: 'unconfirmed' } })
  expect(await pending).toEqual({ status: 'permission_denied' })
  expect(prepare).toHaveBeenCalledOnce()
  controller.dispose()
})

it('discards a late Eikona review after reset and validates the requested run', async () => {
  const review = { status: 'ready' as const, runId: 'run', projectId: 'project', observedAt: '2026-09-08T00:00:00Z', ownerDecision: 'pending' as const, admissionState: 'unknown' as const, canDecide: true, canSupersede: false, candidates: [] }
  let finish!: (value: { ok: true; value: typeof review }) => void
  const read = vi.fn(() => new Promise<{ ok: true; value: typeof review }>(resolve => { finish = resolve }))
  const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }), dispatch: vi.fn(), readEikonaReview: read })
  await controller.refresh()
  const pending = controller.readEikonaReview({ runId: 'run' })
  controller.reset(); finish({ ok: true, value: review })
  expect(await pending).toEqual({ status: 'permission_denied' })
  expect(read).toHaveBeenCalledOnce()
  await controller.refresh()
  const wrongRun = controller.readEikonaReview({ runId: 'other' })
  finish({ ok: true, value: review })
  expect(await wrongRun).toEqual({ status: 'unconfirmed' })
  expect(await controller.readEikonaReview({ runId: '../escape' })).toEqual({ status: 'invalid_input' })
  expect(read).toHaveBeenCalledTimes(2)
  controller.dispose()
})

it('verifies candidate bytes without storing them in the controller snapshot', async () => {
  const raw = 'candidate bytes', digest = createHash('sha256').update(raw).digest('hex')
  const query = { artifactRef: 'eikona://artifacts/run/one', contentDigest: digest, idempotencyKey: 'fixed-preview', confirmed: true as const }
  let base64 = btoa(raw)
  const read = vi.fn(async () => ({ ok: true as const, value: { status: 'ready' as const, value: { artifactRef: query.artifactRef, contentDigest: digest, mediaType: 'image/png' as const, byteLength: raw.length, base64 } } }))
  const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }), dispatch: vi.fn(), readEikonaCandidateImage: read })
  await controller.refresh()
  expect((await controller.readEikonaCandidateImage(query)).status).toBe('ready')
  expect(JSON.stringify(controller.store.getSnapshot())).not.toContain(base64)
  base64 = btoa('different bytes')
  expect((await controller.readEikonaCandidateImage(query)).status).toBe('unconfirmed')
  expect(read).toHaveBeenCalledTimes(2)
  controller.dispose()
})

it('refreshes owner actions after a confirmed approval without dispatching generation', async () => {
  const input = { preparation_ref: `egp_${'a'.repeat(64)}`, expected_digest: 'b'.repeat(64), max_cost_usd: 0.5, max_images: 1, allow_unknown_cost: true, confirmed: true, expires_in_seconds: 60 }
  const snapshot = vi.fn(async () => ({ ok: true as const, value: creatorSnapshot() }))
  const dispatch = vi.fn()
  const approved = { status: 'approved' as const, approvalRef: `ega_${'c'.repeat(64)}`, preparationRef: input.preparation_ref, digest: input.expected_digest, projectId: 'one', maxCostUSD: 0.5, maxImages: 1 as const, allowUnknownCost: true as const, expiresAt: new Date(Date.now() + 60000).toISOString() }
  const controller = new CreatorStudioController({ snapshot, dispatch, approveEikonaPreparation: async () => ({ ok: true, value: approved }) })
  await controller.refresh()
  expect(await controller.approveEikonaPreparation(input)).toEqual(approved)
  await vi.waitFor(() => expect(snapshot).toHaveBeenCalledTimes(2))
  expect(dispatch).not.toHaveBeenCalled()
  controller.dispose()
})


it('refreshes actions only after a matching confirmed revocation and never dispatches', async () => {
  const approvalRef = `ega_${'c'.repeat(64)}`
  const snapshot = vi.fn(async () => ({ ok: true as const, value: creatorSnapshot() }))
  const dispatch = vi.fn()
  const revoke = vi.fn(async () => ({ ok: true as const, value: { status: 'revoked' as const, approvalRef } }))
  const controller = new CreatorStudioController({ snapshot, dispatch, revokeEikonaPreparationApproval: revoke })
  await controller.refresh()
  revoke.mockResolvedValueOnce({ ok: true, value: { status: 'revoked', approvalRef: `ega_${'d'.repeat(64)}` } })
  expect(await controller.revokeEikonaPreparationApproval({ approvalRef, confirmed: true })).toEqual({ status: 'unconfirmed' })
  expect(snapshot).toHaveBeenCalledTimes(1)
  expect(await controller.revokeEikonaPreparationApproval({ approvalRef, confirmed: true })).toEqual({ status: 'revoked', approvalRef })
  await vi.waitFor(() => expect(snapshot).toHaveBeenCalledTimes(2))
  expect(dispatch).not.toHaveBeenCalled()
  controller.dispose()
})


it('ignores a revocation response after the controller is disposed', async () => {
  const approvalRef = `ega_${'e'.repeat(64)}`
  let release!: (value: { ok: true; value: { status: 'revoked'; approvalRef: string } }) => void
  const snapshot = vi.fn(async () => ({ ok: true as const, value: creatorSnapshot() }))
  const controller = new CreatorStudioController({ snapshot, dispatch: vi.fn(), revokeEikonaPreparationApproval: () => new Promise(resolve => { release = resolve }) })
  await controller.refresh()
  const pending = controller.revokeEikonaPreparationApproval({ approvalRef, confirmed: true })
  controller.dispose()
  release({ ok: true, value: { status: 'revoked', approvalRef } })
  expect(await pending).toEqual({ status: 'unconfirmed' })
  expect(snapshot).toHaveBeenCalledTimes(1)
})


it.each(['revoked', 'expired', 'consumed'] as const)('refreshes actions after read-only approval reconciliation reports %s', async state => {
  const approvalRef = `ega_${'f'.repeat(64)}`
  const now = Date.now()
  const value = { status: 'observed' as const, approvalRef, preparationRef: `egp_${'a'.repeat(64)}`, digest: 'b'.repeat(64), projectId: 'one', revoked: state === 'revoked', expired: state === 'expired', ...(state === 'consumed' ? { consumedOperation: `own_${'c'.repeat(24)}` } : {}), expiresAt: new Date(now + (state === 'expired' ? -60000 : 60000)).toISOString(), observedAt: new Date(now).toISOString() }
  const snapshot = vi.fn(async () => ({ ok: true as const, value: creatorSnapshot() }))
  const dispatch = vi.fn(), revoke = vi.fn()
  const controller = new CreatorStudioController({ snapshot, dispatch, revokeEikonaPreparationApproval: revoke, readEikonaApprovalStatus: async () => ({ ok: true, value }) })
  await controller.refresh()
  expect(await controller.readEikonaApprovalStatus({ approvalRef })).toEqual(value)
  await vi.waitFor(() => expect(snapshot).toHaveBeenCalledTimes(2))
  expect(dispatch).not.toHaveBeenCalled()
  expect(revoke).not.toHaveBeenCalled()
  controller.dispose()
})
it('reads a fixed batch without executing and rejects a changed digest', async () => {
  const input = { batchRef: 'batch:one', digest: `sha256:${'a'.repeat(64)}` }
  let digest = input.digest
  const dispatch = vi.fn()
  const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }), dispatch, readEikonaBatchInput: async () => ({ ok: true, value: { status: 'ready', projectRef: 'project:owner', ...input, digest, requestCount: 1, candidateCount: 2, executionAuthorized: false } }) })
  await controller.refresh()
  expect(await controller.readEikonaBatchInput(input)).toMatchObject({ status: 'ready', candidateCount: 2 })
  digest = `sha256:${'b'.repeat(64)}`
  expect(await controller.readEikonaBatchInput(input)).toEqual({ status: 'unconfirmed' })
  expect(dispatch).not.toHaveBeenCalled()
  controller.dispose()
})
it('returns blocked planning facts without executing and rejects a substituted plan input', async () => {
 const input = { batchRef: 'batch:one', digest: `sha256:${'a'.repeat(64)}` }
 let digest = input.digest
 const dispatch = vi.fn()
 const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: creatorSnapshot() }), dispatch, readEikonaBatchPlan: async () => ({ ok: true, value: { status: 'ready', projectRef: 'project:owner', ...input, digest, planDigest: `sha256:${'b'.repeat(64)}`, planStatus: 'blocked', requestCount: 1, estimatedCalls: 1, maxParallelRequests: 1, maxProviderCalls: 1, costEstimateKnown: false, blockers: [{ requestId: 'request:one', code: 'COST_ESTIMATE_UNKNOWN' }], executionAuthorized: false } }) })
 await controller.refresh()
 expect(await controller.readEikonaBatchPlan(input)).toMatchObject({ status: 'ready', planStatus: 'blocked', costEstimateKnown: false, executionAuthorized: false })
 digest = `sha256:${'c'.repeat(64)}`
 expect(await controller.readEikonaBatchPlan(input)).toEqual({ status: 'unconfirmed' })
 expect(dispatch).not.toHaveBeenCalled()
 controller.dispose()
})

it.each(['ready', 'blocked', 'lost'] as const)('refreshes Host actions after a %s batch plan read without dispatching', async mode => {
  const input = { batchRef: 'batch:one', digest: `sha256:${'a'.repeat(64)}` }
  const snapshot = vi.fn(async () => ({ ok: true as const, value: creatorSnapshot() })), dispatch = vi.fn()
  const controller = new CreatorStudioController({ snapshot, dispatch, readEikonaBatchPlan: async () => {
    if (mode === 'lost') throw new Error('fixture response loss')
    return { ok: true, value: { status: 'ready', projectRef: 'project:owner', ...input, planDigest: `sha256:${'b'.repeat(64)}`, planStatus: mode, requestCount: 1, estimatedCalls: 1, maxParallelRequests: 1, maxProviderCalls: 1, costEstimateKnown: false, executionAuthorized: false, blockers: mode === 'blocked' ? [{ requestId: 'one', code: 'missing' }] : [] } }
  } })
  await controller.refresh()
  await controller.readEikonaBatchPlan(input)
  await vi.waitFor(() => expect(snapshot).toHaveBeenCalledTimes(2))
  expect(dispatch).not.toHaveBeenCalled()
  controller.dispose()
})

it('does not refresh actions for a late plan response after disposal', async () => {
  let release!: () => void
  const snapshot = vi.fn(async () => ({ ok: true as const, value: creatorSnapshot() }))
  const controller = new CreatorStudioController({ snapshot, dispatch: vi.fn(), readEikonaBatchPlan: async () => {
    await new Promise<void>(resolve => { release = resolve })
    return { ok: true, value: { status: 'unconfirmed' } }
  } })
  await controller.refresh()
  const pending = controller.readEikonaBatchPlan({ batchRef: 'batch:one', digest: `sha256:${'a'.repeat(64)}` })
  controller.dispose(); release()
  expect(await pending).toEqual({ status: 'unconfirmed' })
  expect(snapshot).toHaveBeenCalledTimes(1)
})

it('waits for an older snapshot and then requests fresh actions after inspecting a batch', async () => {
  let release!: () => void
  const snapshot = vi.fn(async () => ({ ok: true as const, value: creatorSnapshot() }))
  const dispatch = vi.fn()
  const controller = new CreatorStudioController({ snapshot, dispatch, readEikonaBatchPlan: async () => ({ ok: true, value: { status: 'unconfirmed' } }) })
  await controller.refresh()
  snapshot.mockImplementationOnce(async () => {
    await new Promise<void>(resolve => { release = resolve })
    return { ok: true, value: creatorSnapshot() }
  })
  const olderRead = controller.refresh()
  await controller.readEikonaBatchPlan({ batchRef: 'batch:one', digest: `sha256:${'a'.repeat(64)}` })
  expect(snapshot).toHaveBeenCalledTimes(2)
  release(); await olderRead
  await vi.waitFor(() => expect(snapshot).toHaveBeenCalledTimes(3))
  expect(dispatch).not.toHaveBeenCalled()
  controller.dispose()
})
it('reads only the requested member page and rejects substituted operations without execution', async () => {
  let operationRef = 'eikona-batch:one'
  const read = vi.fn(async () => ({ ok: true as const, value: { status: 'ready' as const, projectRef: 'project:owner', operationRef, batchRef: 'batch:one', digest: `sha256:${'a'.repeat(64)}`, planDigest: `sha256:${'b'.repeat(64)}`, offset: 0, total: 1, items: [{ requestId: 'one', status: 'succeeded' as const, runRef: 'run_one' }] } }))
  const dispatch = vi.fn(), snapshot = vi.fn(async () => ({ ok: true as const, value: creatorSnapshot() }))
  const controller = new CreatorStudioController({ snapshot, dispatch, readEikonaBatchMembers: read })
  await controller.refresh()
  expect(await controller.readEikonaBatchMembers({ operationRef })).toMatchObject({ status: 'ready', total: 1 })
  expect(read).toHaveBeenCalledWith({ operationRef, offset: 0, limit: 50 })
  operationRef = 'eikona-batch:other'
  expect(await controller.readEikonaBatchMembers({ operationRef: 'eikona-batch:one' })).toEqual({ status: 'unconfirmed' })
  expect(await controller.readEikonaBatchMembers({ operationRef, projectRef: 'foreign' })).toEqual({ status: 'invalid_input' })
  expect(read).toHaveBeenCalledTimes(2)
  expect(snapshot).toHaveBeenCalledTimes(1)
  expect(dispatch).not.toHaveBeenCalled()
  controller.dispose()
})


describe('independent owner reads', () => {
  it('refreshes Eikona while Scaena is pending without calling the aggregate route', async () => {
    const snapshot = vi.fn()
    let finish!: (value: unknown) => void
    const remote = { snapshot, dispatch: vi.fn(), resolveArtifact: vi.fn(), snapshotOwner: vi.fn(async (owner: string) => {
      if (owner === 'scaena') return new Promise(resolve => { finish = resolve })
      const value = creatorSnapshot()
      return { ok: true, value: { ...value, owners: value.owners.filter(item => item.owner === owner) } }
    }) }
    const eikona = new CreatorStudioController(remote as never, 'eikona')
    const scaena = new CreatorStudioController(remote as never, 'scaena')
    const pending = scaena.refresh()
    await eikona.refresh()
    expect(eikona.store.getSnapshot().phase).toBe('ready')
    expect(scaena.store.getSnapshot().phase).toBe('loading')
    expect(snapshot).not.toHaveBeenCalled()
    const value = creatorSnapshot()
    finish({ ok: true, value: { ...value, owners: value.owners.filter(item => item.owner === 'scaena') } })
    await pending
    expect(scaena.store.getSnapshot().phase).toBe('ready')
    eikona.dispose(); scaena.dispose()
  })
  it('rejects an aggregate response on an owner route and does not fall back to aggregate reads', async () => {
    const snapshot = vi.fn(async () => ({ ok: true as const, value: creatorSnapshot() }))
    const remote = { snapshot, snapshotOwner: snapshot, dispatch: vi.fn(), resolveArtifact: vi.fn() }
    const controller = new CreatorStudioController(remote, 'eikona')
    await controller.refresh()
    expect(controller.store.getSnapshot().phase).toBe('error')
    expect(controller.store.getSnapshot().snapshot).toBeNull()
    expect(snapshot).toHaveBeenCalledOnce()
    controller.dispose()
    const missing = new CreatorStudioController({ ...remote, snapshotOwner: undefined } as never, 'eikona')
    await missing.refresh()
    expect(missing.store.getSnapshot().errorCode).toBe('owner_snapshot_unavailable')
    expect(snapshot).toHaveBeenCalledOnce()
    missing.dispose()
  })
})


it('retains domain content as stale on owner offline but never retains executable actions', async () => {
  const value = creatorSnapshot()
  let offline = false
  const controller = new CreatorStudioController({ snapshot: vi.fn(), dispatch: vi.fn(), snapshotOwner: async () => ({ ok: true, value: { ...value,
    snapshotVersion: offline ? 2 : 1,
    owners: value.owners.filter(owner => owner.owner === 'eikona').map(owner => offline ? { ...owner, status: 'offline', freshness: 'unknown', resources: [], actions: [] } : owner),
  } }) }, 'eikona')
  await controller.refresh()
  const resources = controller.store.getSnapshot().snapshot!.owners[0]!.resources
  offline = true
  await controller.refresh()
  expect(controller.store.getSnapshot()).toMatchObject({ phase: 'error', errorCode: 'owner_offline', snapshot: { freshness: 'stale', owners: [{ freshness: 'stale', actions: [], resources }] } })
  controller.dispose()
})
