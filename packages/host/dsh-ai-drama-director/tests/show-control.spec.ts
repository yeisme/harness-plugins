import { describe, expect, it, vi } from 'vitest'
import {
  PANE_ARTIFACT_SCHEMA,
  PANE_ACTION_DESCRIPTOR_SCHEMA,
  PANE_ACTION_REQUEST_SCHEMA,
  type PaneActionDescriptorV1,
} from '@yeisme/dsh-pane-protocol'
import {
  DRAMA_SHOW_CONTROL_ASSET_PAGE_SCHEMA,
  DRAMA_SHOW_CONTROL_DELIVERY_SCHEMA,
  DRAMA_SHOW_CONTROL_EPISODE_PAGE_SCHEMA,
  DRAMA_SHOW_CONTROL_REVIEW_PAGE_SCHEMA,
  DRAMA_SHOW_CONTROL_SNAPSHOT_SCHEMA,
  DramaShowControlOwnerDirectory,
  createDramaShowControlGateway,
  normalizeDramaShowAssetQuery,
  normalizeDramaShowEpisodeQuery,
  normalizeDramaShowReviewQuery,
  validateDramaShowActionPreviewRequest,
  validateDramaShowControlBinding,
  validateDramaShowControlSnapshot,
  validateDramaShowEpisodePage,
  verifyDramaShowControlAdapter,
  type DramaShowControlBindingV1,
  type DramaShowControlOwnerAdapterV1,
} from '../src/index.js'

const binding: DramaShowControlBindingV1 = {
  tenantRef: 'tenant:one',
  workspaceRef: 'workspace:one',
  principalRef: 'principal:one',
  runtimeGeneration: 'runtime:one',
  showRef: 'show:one',
  contextRevision: 'revision:one',
}

function descriptor(): PaneActionDescriptorV1 {
  return {
    schema: PANE_ACTION_DESCRIPTOR_SCHEMA,
    descriptorRef: 'descriptor:review-batch:one',
    owner: 'ordo',
    actionId: 'drama.review.batch',
    label: 'Review selected targets',
    targetRef: 'batch:review:one',
    targetVersion: 'v1',
    context: { workspaceRef: binding.workspaceRef, revision: binding.contextRevision },
    risk: 'medium',
    confirmation: 'confirm',
    expiresAt: '2999-01-01T00:00:00.000Z',
    preview: { summary: 'Review two explicitly selected targets.' },
    fields: [],
  }
}

function adapter(overrides: Partial<DramaShowControlOwnerAdapterV1> = {}): DramaShowControlOwnerAdapterV1 {
  const snapshot = {
    schemaVersion: DRAMA_SHOW_CONTROL_SNAPSHOT_SCHEMA,
    snapshotRef: 'show:snapshot:one',
    snapshotVersion: 1,
    generatedAt: '2026-08-29T00:00:00.000Z',
    showRef: binding.showRef,
    showVersion: 'v1',
    title: 'Rain City',
    status: 'ready' as const,
    freshness: 'fresh' as const,
    safeMessage: 'Show projection ready.',
    summary: { episodeCount: 2, activeEpisodeCount: 1, reviewCount: 1, attentionCount: 1, assetCount: 1, deliveryReadyCount: 1 },
    blockerRefs: [],
    evidenceRefs: ['evidence:show:one'],
  }
  const episodes = {
    schemaVersion: DRAMA_SHOW_CONTROL_EPISODE_PAGE_SCHEMA,
    snapshotRef: snapshot.snapshotRef,
    snapshotVersion: 1,
    showRef: binding.showRef,
    status: 'ready' as const,
    freshness: 'fresh' as const,
    safeMessage: 'Episodes ready.',
    items: [{ ref: 'episode:one', version: 'v2', title: 'Arrival', ordinal: 1, stage: 'shots' as const, status: 'running' as const, progress: 0.6, attentionCount: 1, evidenceRefs: [] }],
  }
  const reviews = {
    schemaVersion: DRAMA_SHOW_CONTROL_REVIEW_PAGE_SCHEMA,
    snapshotRef: snapshot.snapshotRef,
    snapshotVersion: 1,
    showRef: binding.showRef,
    status: 'ready' as const,
    freshness: 'fresh' as const,
    safeMessage: 'Reviews ready.',
    items: [{ ref: 'review:one', version: 'v1', episodeRef: 'episode:one', owner: 'eikona', title: 'Shot review', status: 'pending' as const, risk: 'medium' as const, artifact: { schema: PANE_ARTIFACT_SCHEMA, owner: 'eikona', kind: 'video', ref: 'artifact:shot:one', version: 'v1', mediaType: 'video/mp4', title: 'Shot one', evidenceRefs: [], capabilities: ['open', 'compare'] }, annotation: { artifactRef: 'artifact:shot:one', artifactVersion: 'v1', quoteDigest: 'a'.repeat(64), allowedKinds: ['image-point' as const, 'image-region' as const] }, evidenceRefs: [] }],
  }
  const assets = {
    schemaVersion: DRAMA_SHOW_CONTROL_ASSET_PAGE_SCHEMA,
    snapshotRef: snapshot.snapshotRef,
    snapshotVersion: 1,
    showRef: binding.showRef,
    status: 'ready' as const,
    freshness: 'fresh' as const,
    safeMessage: 'Assets ready.',
    items: [{ ref: 'asset:one', version: 'v1', episodeRef: 'episode:one', owner: 'eikona', kind: 'image', title: 'Rain plate', status: 'ready', evidenceRefs: [] }],
  }
  const delivery = {
    schemaVersion: DRAMA_SHOW_CONTROL_DELIVERY_SCHEMA,
    snapshotRef: snapshot.snapshotRef,
    snapshotVersion: 1,
    generatedAt: snapshot.generatedAt,
    showRef: binding.showRef,
    status: 'ready' as const,
    freshness: 'fresh' as const,
    safeMessage: 'Delivery projection ready.',
    readyCount: 1,
    totalCount: 1,
    items: [{ ref: 'delivery:one', version: 'v1', previousVersion: 'v0', versionDifference: { changed: true, summary: 'Final mix and captions changed.' }, episodeRef: 'episode:one', title: 'Episode one master', status: 'ready' as const, rightsStatus: 'ready' as const, rightsSummary: 'Rights cleared.', evidenceStatus: 'ready' as const, evidenceSummary: 'Evidence complete.', blockerRefs: [], evidenceRefs: ['evidence:delivery:one'], actions: [{ actionId: 'drama.delivery.submit', label: 'Submit master', kind: 'submit' as const }], receiptHistory: [{ status: 'completed' as const, receiptRef: 'receipt:delivery:one', owner: 'ordo', actionId: 'drama.delivery.prepare', summary: 'Prepared.' }] }],
    blockerRefs: [],
    evidenceRefs: ['evidence:delivery:one'],
  }
  return {
    id: 'adapter:show-control:test',
    snapshot: async () => snapshot,
    episodes: async () => episodes,
    reviews: async () => reviews,
    assets: async () => assets,
    delivery: async () => delivery,
    previewAction: async () => descriptor(),
    dispatch: async request => ({ status: 'completed', receiptRef: 'receipt:show-control:one', owner: request.owner, actionId: request.actionId, summary: 'Owner completed the batch.' }),
    ...overrides,
  }
}

describe('show-control contracts', () => {
  it('accepts a frozen safe binding and rejects unknown or unsafe fields', () => {
    expect(validateDramaShowControlBinding(binding)).toBe(true)
    expect(validateDramaShowControlBinding({ ...binding, tenantRef: 'https://unsafe.invalid' })).toBe(false)
    expect(validateDramaShowControlBinding({ ...binding, extra: 'field' })).toBe(false)
  })

  it('normalizes page size to 50 and rejects more than 100, stale cursors, and unknown fields', () => {
    expect(normalizeDramaShowEpisodeQuery({ showRef: binding.showRef })?.limit).toBe(50)
    expect(normalizeDramaShowReviewQuery({ showRef: binding.showRef, limit: 100 })?.limit).toBe(100)
    expect(normalizeDramaShowAssetQuery({ showRef: binding.showRef, limit: 101 })).toBeUndefined()
    expect(normalizeDramaShowEpisodeQuery({ showRef: binding.showRef, cursor: '/home/private' })).toBeUndefined()
    expect(normalizeDramaShowReviewQuery({ showRef: binding.showRef, unknown: true })).toBeUndefined()
  })

  it('limits batch previews to unique explicitly versioned loaded targets', () => {
    expect(validateDramaShowActionPreviewRequest({ showRef: binding.showRef, actionId: 'review.batch', targetRefs: ['review:one'], targetVersions: { 'review:one': 'v1' } })).toBe(true)
    expect(validateDramaShowActionPreviewRequest({ showRef: binding.showRef, actionId: 'review.batch', targetRefs: ['review:one', 'review:one'], targetVersions: { 'review:one': 'v1' } })).toBe(false)
    expect(validateDramaShowActionPreviewRequest({ showRef: binding.showRef, actionId: 'review.batch', targetRefs: Array.from({ length: 101 }, (_, index) => `review:${index}`), targetVersions: {} })).toBe(false)
    expect(validateDramaShowActionPreviewRequest({ showRef: binding.showRef, actionId: 'review.repair', targetRefs: ['review:one'], targetVersions: { 'review:one': 'v1' }, annotationBatchRef: 'batch:annotation:one', idempotencyKey: 'preview:annotation:one' })).toBe(true)
  })

  it('rejects unknown owner projection fields and unbounded timestamps', async () => {
    const owner = adapter()
    const snapshot = await owner.snapshot(binding)
    const episodes = await owner.episodes({ showRef: binding.showRef, limit: 50 }, binding)
    expect(validateDramaShowControlSnapshot({ ...snapshot, unknown: true })).toBe(false)
    expect(validateDramaShowControlSnapshot({ ...snapshot, generatedAt: 'not-a-time' })).toBe(false)
    expect(validateDramaShowEpisodePage({ ...episodes, unknown: true })).toBe(false)
    expect(validateDramaShowEpisodePage({ ...episodes, items: [{ ...episodes.items[0], unknown: true }] })).toBe(false)
  })
})

describe('show-control owner gateway', () => {
  it('degrades honestly when no domain adapter is installed', async () => {
    const gateway = createDramaShowControlGateway({ binding, directory: new DramaShowControlOwnerDirectory() })
    await expect(gateway.snapshot(binding.showRef)).resolves.toMatchObject({ status: 'needs_contract', freshness: 'unknown' })
    await expect(gateway.episodes({ showRef: binding.showRef })).resolves.toMatchObject({ status: 'needs_contract', items: [] })
    await expect(gateway.delivery(binding.showRef)).resolves.toMatchObject({ status: 'needs_contract', items: [] })
  })

  it('binds every read to one show and validates adapter pages', async () => {
    const directory = new DramaShowControlOwnerDirectory()
    const unregister = directory.register(adapter())
    const gateway = createDramaShowControlGateway({ binding, directory })
    await expect(gateway.snapshot(binding.showRef)).resolves.toMatchObject({ status: 'ready', title: 'Rain City' })
    await expect(gateway.episodes({ showRef: binding.showRef })).resolves.toMatchObject({ items: [{ ref: 'episode:one' }] })
    await expect(gateway.reviews({ showRef: binding.showRef })).resolves.toMatchObject({ items: [{ annotation: { artifactVersion: 'v1' } }] })
    await expect(gateway.delivery(binding.showRef)).resolves.toMatchObject({ items: [{ versionDifference: { changed: true }, receiptHistory: [{ status: 'completed' }] }] })
    await expect(gateway.reviews({ showRef: 'show:other' })).resolves.toMatchObject({ status: 'contract_mismatch', items: [] })
    await expect(gateway.snapshot('show:other')).resolves.toMatchObject({ status: 'permission_denied' })
    unregister()
  })

  it('requires preview-before-submit context fencing and never retries unknown dispatch', async () => {
    const dispatch = vi.fn(async () => { throw new Error('uncertain') })
    const directory = new DramaShowControlOwnerDirectory()
    directory.register(adapter({ dispatch }))
    const gateway = createDramaShowControlGateway({ binding, directory })
    const preview = await gateway.previewAction({ showRef: binding.showRef, actionId: 'drama.review.batch', targetRefs: ['review:one'], targetVersions: { 'review:one': 'v1' } })
    expect(preview.descriptorRef).toBe('descriptor:review-batch:one')
    const receipt = await gateway.dispatch({
      schema: PANE_ACTION_REQUEST_SCHEMA,
      descriptorRef: preview.descriptorRef,
      owner: preview.owner,
      actionId: preview.actionId,
      expectedTargetRef: preview.targetRef,
      expectedTargetVersion: preview.targetVersion,
      context: preview.context,
      idempotencyKey: 'show-control:test:one',
      values: {},
    })
    expect(receipt).toMatchObject({ status: 'reconcile_required', reconcileReason: 'settlement_unknown' })
    expect(dispatch).toHaveBeenCalledOnce()
  })

  it('runs typed fake adapter conformance without storing domain state', async () => {
    await expect(verifyDramaShowControlAdapter(adapter(), binding)).resolves.toEqual({ ok: true, failures: [] })
  })
})
