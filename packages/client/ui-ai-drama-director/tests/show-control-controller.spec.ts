import { describe, expect, it, vi } from 'vitest'
import type { DramaShowControlRemoteV1, DramaShowEpisodeV1 } from '@yeisme/dsh-ai-drama-director'
import { DramaShowControlController, type DramaSelectionAnnotationOwnerV1 } from '../src/client/show-control-controller.js'

function episode(index: number): DramaShowEpisodeV1 {
  return { ref: `episode:${index}`, version: 'v1', title: `Episode ${index}`, ordinal: index, stage: 'shots', status: 'running', progress: 0.5, attentionCount: 0, evidenceRefs: [] }
}

function remote(overrides: Partial<DramaShowControlRemoteV1> = {}): DramaShowControlRemoteV1 {
  return {
    snapshot: vi.fn(async showRef => ({ schemaVersion: 'drama.show-control.snapshot.v1alpha1', snapshotRef: 'show:snapshot:one', snapshotVersion: 1, generatedAt: '2026-08-29T00:00:00Z', showRef, showVersion: 'v1', title: 'Show one', status: 'ready', freshness: 'fresh', safeMessage: 'Ready.', summary: { episodeCount: 1, activeEpisodeCount: 1, reviewCount: 1, attentionCount: 0, assetCount: 1, deliveryReadyCount: 1 }, blockerRefs: [], evidenceRefs: [] })),
    episodes: vi.fn(async query => ({ schemaVersion: 'drama.show-control.episode-page.v1alpha1', snapshotRef: 'show:snapshot:one', snapshotVersion: 1, showRef: query.showRef, status: 'ready', freshness: 'fresh', safeMessage: 'Ready.', items: [episode(1)] })),
    reviews: vi.fn(async query => ({ schemaVersion: 'drama.show-control.review-page.v1alpha1', snapshotRef: 'show:snapshot:one', snapshotVersion: 1, showRef: query.showRef, status: 'ready', freshness: 'fresh', safeMessage: 'Ready.', items: [{ ref: 'review:one', version: 'v1', episodeRef: 'episode:1', owner: 'eikona', title: 'Review one', status: 'pending', risk: 'medium', artifact: { owner: 'eikona', ref: 'video:one', version: 'cut-v1', kind: 'video', mediaType: 'video/mp4', title: 'Review one', capabilities: ['open', 'compare'] }, annotation: { artifactRef: 'video:one', artifactVersion: 'cut-v1', quoteDigest: 'a'.repeat(64), allowedKinds: ['media-frame', 'media-time-point', 'media-time-region'] }, evidenceRefs: [] }] })),
    assets: vi.fn(async query => ({ schemaVersion: 'drama.show-control.asset-page.v1alpha1', snapshotRef: 'show:snapshot:one', snapshotVersion: 1, showRef: query.showRef, status: 'ready', freshness: 'fresh', safeMessage: 'Ready.', items: [{ ref: 'asset:one', version: 'v1', episodeRef: 'episode:1', owner: 'eikona', kind: 'image', title: 'Asset one', status: 'ready', evidenceRefs: [] }] })),
    delivery: vi.fn(async showRef => ({ schemaVersion: 'drama.show-control.delivery.v1alpha1', snapshotRef: 'show:snapshot:one', snapshotVersion: 1, generatedAt: '2026-08-29T00:00:00Z', showRef, status: 'ready', freshness: 'fresh', safeMessage: 'Ready.', readyCount: 1, totalCount: 1, items: [{ ref: 'delivery:one', version: 'v1', episodeRef: 'episode:1', title: 'Master one', status: 'ready', rightsStatus: 'ready', evidenceStatus: 'ready', blockerRefs: [], evidenceRefs: [] }], blockerRefs: [], evidenceRefs: [] })),
    previewAction: vi.fn(async request => ({ schema: 'pane.action-descriptor.v1alpha1', descriptorRef: 'descriptor:batch:one', owner: 'ordo', actionId: request.actionId, label: 'Batch action', targetRef: 'batch:one', targetVersion: 'v1', context: { workspaceRef: 'workspace:one', revision: 'revision:one' }, risk: 'medium', confirmation: 'confirm', expiresAt: '2999-01-01T00:00:00Z', preview: { summary: 'Batch preview.' }, fields: [] })),
    dispatch: vi.fn(async request => ({ status: 'completed', receiptRef: 'receipt:batch:one', owner: request.owner, actionId: request.actionId, summary: 'Completed.' })),
    ...overrides,
  }
}

function selectionOwner(): DramaSelectionAnnotationOwnerV1 & { readonly calls: { readonly drafts: unknown[]; readonly batches: unknown[] } } {
  const drafts: unknown[] = []
  const batches: unknown[] = []
  const anchors: Array<Record<string, unknown>> = []
  return {
    version: '0.1.0-rc.1',
    capability: 'selection-annotation',
    calls: { drafts, batches },
    publishAnchor(draft) {
      drafts.push(draft)
      const anchor = { ...draft, anchorId: `anchor:${anchors.length + 1}`, createdAt: '2026-08-29T00:00:00Z', freshness: 'fresh' as const }
      anchors.push(anchor)
      return anchor as never
    },
    createBatch(input) {
      batches.push(input)
      return { batchId: 'batch:review:one', title: input.title, anchors: anchors as never, status: 'draft', createdAt: '2026-08-29T00:00:00Z' }
    },
    submitBatch() {
      return { batchId: 'batch:review:one', title: 'Drama review annotations (1)', anchors: anchors.map((anchor, index) => ({ ...anchor, marker: index + 1 })) as never, status: 'submitted', createdAt: '2026-08-29T00:00:00Z', submittedAt: '2026-08-29T00:00:01Z' }
    },
    buildAgentRequest() {
      return { batchId: 'batch:review:one', title: 'Drama review annotations (1)', markers: anchors.map((anchor, index) => ({ marker: index + 1, label: `#${index + 1}`, kind: anchor.kind, quotePreview: anchor.quotePreview, freshness: 'fresh' })), untrustedContext: true, replyContract: 'reply-must-reference-markers' } as never
    },
  }
}

describe('DramaShowControlController', () => {
  it('binds one show, refreshes the default lanes, and keeps Asset Wall on demand', async () => {
    const owner = remote()
    const controller = new DramaShowControlController(owner)
    controller.bind('show:one', 'revision:one')
    await controller.refresh()
    expect(controller.store.getSnapshot()).toMatchObject({ phase: 'ready', episodePhase: 'ready', reviewPhase: 'ready', deliveryPhase: 'ready', assetPhase: 'cold' })
    expect(owner.snapshot).toHaveBeenCalledOnce()
    expect(owner.assets).not.toHaveBeenCalled()
    await controller.loadAssets({ limit: 50 })
    expect(controller.store.getSnapshot()).toMatchObject({ assetPhase: 'ready', assetItems: [{ ref: 'asset:one' }] })
  })

  it('preserves explicit selection across pagination, enforces 100, and clears on filter or context changes', async () => {
    const first = Array.from({ length: 100 }, (_, index) => episode(index + 1))
    const owner = remote({
      episodes: vi.fn(async query => ({ schemaVersion: 'drama.show-control.episode-page.v1alpha1', snapshotRef: 'show:snapshot:one', snapshotVersion: 1, showRef: query.showRef, status: 'ready', freshness: 'fresh', safeMessage: 'Ready.', items: query.cursor === undefined ? first : [episode(101)], ...(query.cursor === undefined ? { nextCursor: 'cursor:two' } : {}) })),
    })
    const controller = new DramaShowControlController(owner)
    controller.bind('show:one', 'revision:one')
    await controller.loadEpisodes({ limit: 100 })
    controller.toggleSelection({ kind: 'episode', ref: 'episode:1', version: 'v1' })
    await controller.loadEpisodes({ limit: 100, cursor: 'cursor:two' }, true)
    expect(controller.store.getSnapshot().selected).toHaveLength(1)
    for (const item of controller.store.getSnapshot().episodeItems) controller.toggleSelection({ kind: 'episode', ref: item.ref, version: item.version })
    expect(controller.store.getSnapshot().selected).toHaveLength(100)
    controller.toggleSelection({ kind: 'episode', ref: 'episode:1', version: 'v1' })
    expect(controller.store.getSnapshot().selectionMessage).toContain('100')
    await controller.loadEpisodes({ limit: 50, status: 'ready' })
    expect(controller.store.getSnapshot().selected).toEqual([])
    controller.toggleSelection({ kind: 'episode', ref: 'episode:1', version: 'v1' })
    controller.bind('show:two', 'revision:two')
    expect(controller.store.getSnapshot()).toMatchObject({ showRef: 'show:two', selected: [], episodeItems: [] })
  })

  it('previews one owner batch descriptor, submits once, and never retries unknown settlement', async () => {
    const dispatch = vi.fn(async () => { throw new Error('uncertain') })
    const owner = remote({ dispatch })
    const controller = new DramaShowControlController(owner)
    controller.bind('show:one', 'revision:one')
    await controller.loadReviews({ limit: 50 })
    controller.toggleSelection({ kind: 'review', ref: 'review:one', version: 'v1' })
    await expect(controller.previewAction('drama.review.batch')).resolves.toMatchObject({ descriptorRef: 'descriptor:batch:one' })
    const receipt = await controller.dispatchPreview()
    expect(receipt).toMatchObject({ status: 'unknown', reconcileReason: 'settlement_unknown' })
    expect(dispatch).toHaveBeenCalledOnce()
    expect(controller.store.getSnapshot().selected).toHaveLength(1)
  })

  it('drops late pages after show context changes', async () => {
    let resolvePage: ((value: Awaited<ReturnType<DramaShowControlRemoteV1['episodes']>>) => void) | undefined
    const episodes = vi.fn(() => new Promise<Awaited<ReturnType<DramaShowControlRemoteV1['episodes']>>>(resolve => { resolvePage = resolve }))
    const controller = new DramaShowControlController(remote({ episodes }))
    controller.bind('show:one', 'revision:one')
    const pending = controller.loadEpisodes({ limit: 50 })
    controller.bind('show:two', 'revision:two')
    resolvePage?.({ schemaVersion: 'drama.show-control.episode-page.v1alpha1', snapshotRef: 'show:snapshot:one', snapshotVersion: 1, showRef: 'show:one', status: 'ready', freshness: 'fresh', safeMessage: 'Ready.', items: [episode(1)] })
    await pending
    expect(controller.store.getSnapshot()).toMatchObject({ showRef: 'show:two', episodeItems: [], episodePhase: 'cold' })
    expect(episodes).toHaveBeenCalledOnce()
  })

  it('clears stale receipts and selections when snapshot identity changes', async () => {
    let version = 1
    const owner = remote({ snapshot: vi.fn(async showRef => ({ schemaVersion: 'drama.show-control.snapshot.v1alpha1', snapshotRef: `show:snapshot:${version}`, snapshotVersion: version, generatedAt: '2026-08-29T00:00:00Z', showRef, showVersion: `v${version}`, title: 'Show one', status: 'ready', freshness: 'fresh', safeMessage: 'Ready.', summary: { episodeCount: 1, activeEpisodeCount: 1, reviewCount: 1, attentionCount: 0, assetCount: 1, deliveryReadyCount: 1 }, blockerRefs: [], evidenceRefs: [] })) })
    const controller = new DramaShowControlController(owner)
    controller.bind('show:one', 'revision:one')
    await controller.refresh()
    controller.toggleSelection({ kind: 'episode', ref: 'episode:1', version: 'v1' })
    await controller.previewAction('drama.episode.open')
    version = 2
    await controller.refresh()
    expect(controller.store.getSnapshot()).toMatchObject({ snapshot: { snapshotVersion: 2 }, selected: [], previewDescriptor: null, lastReceipt: null })
  })

  it('hands version-fenced media anchors to the selection owner and carries its batch into repair preview', async () => {
    const owner = remote()
    const annotations = selectionOwner()
    const controller = new DramaShowControlController(owner, annotations)
    controller.bind('show:one', 'revision:one')
    await controller.refresh()
    controller.toggleSelection({ kind: 'review', ref: 'review:one', version: 'v1' })
    expect(controller.submitAnnotations([{ reviewRef: 'review:one', reviewVersion: 'v1', kind: 'media-time-region', note: 'Tighten the pause.', startMs: 1_000, endMs: 2_500 }])).toMatchObject({ batchId: 'batch:review:one', status: 'submitted' })
    expect(annotations.calls.drafts).toEqual([expect.objectContaining({ kind: 'media-time-region', artifactRef: 'video:one', artifactVersion: 'cut-v1', startMs: 1_000, endMs: 2_500 })])
    await controller.previewAction('drama.review.repair', { annotationBatchRef: 'batch:review:one' })
    expect(owner.previewAction).toHaveBeenCalledWith(expect.objectContaining({ annotationBatchRef: 'batch:review:one', idempotencyKey: expect.stringContaining('show-control:preview:') }))
    expect(controller.store.getSnapshot()).toMatchObject({ annotationPhase: 'ready', annotationAgentRequest: { markers: [{ label: '#1' }] } })
  })

  it('fails closed when owner annotation metadata no longer matches the artifact version', async () => {
    const annotations = selectionOwner()
    const owner = remote({ reviews: vi.fn(async query => ({ schemaVersion: 'drama.show-control.review-page.v1alpha1', snapshotRef: 'show:snapshot:one', snapshotVersion: 1, showRef: query.showRef, status: 'ready', freshness: 'fresh', safeMessage: 'Ready.', items: [{ ref: 'review:one', version: 'v1', episodeRef: 'episode:1', owner: 'eikona', title: 'Review one', status: 'pending', risk: 'medium', artifact: { owner: 'eikona', ref: 'video:one', version: 'cut-v2', kind: 'video', mediaType: 'video/mp4', title: 'Review one', capabilities: ['open'] }, annotation: { artifactRef: 'video:one', artifactVersion: 'cut-v1', quoteDigest: 'a'.repeat(64), allowedKinds: ['media-time-point'] }, evidenceRefs: [] }] })) })
    const controller = new DramaShowControlController(owner, annotations)
    controller.bind('show:one', 'revision:one')
    await controller.loadReviews({ limit: 50 })
    expect(controller.submitAnnotations([{ reviewRef: 'review:one', reviewVersion: 'v1', kind: 'media-time-point', note: 'Stale.', timeMs: 1_000 }])).toBeUndefined()
    expect(annotations.calls.drafts).toEqual([])
    expect(controller.store.getSnapshot().annotationMessage).toContain('version_mismatch')
  })
})
