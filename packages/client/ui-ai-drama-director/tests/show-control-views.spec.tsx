// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { DramaShowControlRemoteV1 } from '@yeisme/dsh-ai-drama-director'
import { DramaShowControlController, type DramaSelectionAnnotationOwnerV1 } from '../src/client/show-control-controller.js'
import { createDramaShowControlViewFactories, DRAMA_SHOW_CONTROL_VIEW_REGISTRATIONS } from '../src/client/show-control-views.js'

afterEach(cleanup)

const artifact = (ref: string, kind: 'image' | 'audio' | 'video' = 'image') => ({
  owner: 'eikona', ref, version: 'v1', kind, mediaType: kind === 'image' ? 'image/png' : `${kind}/mp4`, title: ref, capabilities: ['open', 'compare'] as const,
})

function remote(): DramaShowControlRemoteV1 {
  return {
    snapshot: vi.fn(async showRef => ({ schemaVersion: 'drama.show-control.snapshot.v1alpha1', snapshotRef: 'show:snapshot:one', snapshotVersion: 1, generatedAt: '2026-08-29T00:00:00Z', showRef, showVersion: 'v1', title: 'Rain Show', status: 'ready', freshness: 'fresh', safeMessage: 'Owner projection is fresh.', summary: { episodeCount: 2, activeEpisodeCount: 1, reviewCount: 2, attentionCount: 1, assetCount: 2, deliveryReadyCount: 1 }, blockerRefs: [], evidenceRefs: ['evidence:show'] })),
    episodes: vi.fn(async query => ({ schemaVersion: 'drama.show-control.episode-page.v1alpha1', snapshotRef: 'show:snapshot:one', snapshotVersion: 1, showRef: query.showRef, status: 'ready', freshness: 'fresh', safeMessage: 'Episodes ready.', items: [
      { ref: 'episode:1', version: 'v1', title: 'Arrival', ordinal: 1, stage: 'shots', status: 'running', progress: 0.5, attentionCount: 1, evidenceRefs: [] },
      { ref: 'episode:2', version: 'v1', title: 'Reveal', ordinal: 2, stage: 'review', status: 'ready', progress: 1, attentionCount: 0, evidenceRefs: [] },
    ] })),
    reviews: vi.fn(async query => ({ schemaVersion: 'drama.show-control.review-page.v1alpha1', snapshotRef: 'show:snapshot:one', snapshotVersion: 1, showRef: query.showRef, status: 'ready', freshness: 'fresh', safeMessage: 'Reviews ready.', items: [
      { ref: 'review:1', version: 'v1', episodeRef: 'episode:1', owner: 'eikona', title: 'Frame review', status: 'pending', risk: 'medium', artifact: artifact('video:1', 'video'), annotation: { artifactRef: 'video:1', artifactVersion: 'v1', quoteDigest: 'a'.repeat(64), allowedKinds: ['media-frame', 'media-time-point', 'media-time-region'] }, evidenceRefs: [] },
      { ref: 'review:2', version: 'v1', episodeRef: 'episode:2', owner: 'scaena', title: 'Cut review', status: 'pending', risk: 'high', artifact: artifact('video:2', 'video'), annotation: { artifactRef: 'video:2', artifactVersion: 'v1', quoteDigest: 'b'.repeat(64), allowedKinds: ['media-frame', 'media-time-point', 'media-time-region'] }, evidenceRefs: [] },
    ] })),
    assets: vi.fn(async query => ({ schemaVersion: 'drama.show-control.asset-page.v1alpha1', snapshotRef: 'show:snapshot:one', snapshotVersion: 1, showRef: query.showRef, status: 'ready', freshness: 'fresh', safeMessage: 'Assets ready.', items: [
      { ref: 'asset:1', version: 'v1', episodeRef: 'episode:1', owner: 'eikona', kind: 'image', title: 'Key frame', status: 'ready', artifact: artifact('image:asset:1'), rightsSummary: 'cleared', evidenceRefs: [] },
      { ref: 'asset:2', version: 'v2', episodeRef: 'episode:2', owner: 'sonora', kind: 'audio', title: 'Final mix', status: 'ready', artifact: { ...artifact('audio:asset:2', 'audio'), owner: 'sonora', version: 'v2' }, rightsSummary: 'cleared', evidenceRefs: [] },
    ] })),
    delivery: vi.fn(async showRef => ({ schemaVersion: 'drama.show-control.delivery.v1alpha1', snapshotRef: 'show:snapshot:one', snapshotVersion: 1, generatedAt: '2026-08-29T00:00:00Z', showRef, status: 'ready', freshness: 'fresh', safeMessage: 'One of two deliverables is ready.', readyCount: 1, totalCount: 2, items: [
      { ref: 'delivery:1', version: 'v1', previousVersion: 'v0', versionDifference: { changed: true, summary: 'Captions updated.' }, episodeRef: 'episode:1', title: 'Episode master', status: 'ready', rightsStatus: 'ready', rightsSummary: 'Cleared.', evidenceStatus: 'ready', evidenceSummary: 'Complete.', blockerRefs: [], evidenceRefs: ['evidence:delivery:1'], actions: [{ actionId: 'drama.delivery.submit', label: 'Submit master', kind: 'submit' }], receiptHistory: [{ status: 'completed', receiptRef: 'receipt:delivery:1', owner: 'ordo', actionId: 'drama.delivery.prepare', summary: 'Prepared.' }] },
      { ref: 'delivery:2', version: 'v1', episodeRef: 'episode:2', title: 'Episode master', status: 'blocked', rightsStatus: 'attention', rightsSummary: 'Music cue needs review.', evidenceStatus: 'blocked', evidenceSummary: 'Rights evidence missing.', blockerRefs: ['blocker:rights'], evidenceRefs: [], actions: [{ actionId: 'drama.delivery.remediate', label: 'Resolve rights', kind: 'remediate' }, { actionId: 'drama.delivery.submit', label: 'Submit master', kind: 'submit' }], receiptHistory: [{ status: 'unknown', receiptRef: 'receipt:delivery:2', owner: 'ordo', actionId: 'drama.delivery.prepare', reconcileReason: 'settlement_unknown' }] },
    ], blockerRefs: ['blocker:rights'], evidenceRefs: ['evidence:delivery:1'] })),
    previewAction: vi.fn(async request => ({ schema: 'pane.action-descriptor.v1alpha1', descriptorRef: 'descriptor:show:one', owner: 'ordo', actionId: request.actionId, label: 'Owner batch preview', targetRef: 'batch:show:one', targetVersion: 'v1', context: { workspaceRef: 'workspace:one', revision: 'revision:one' }, risk: 'medium', confirmation: 'confirm', expiresAt: '2999-01-01T00:00:00Z', preview: { summary: 'Owner-authored preview.' }, fields: [] })),
    dispatch: vi.fn(async request => ({ status: 'completed', receiptRef: 'receipt:show:one', owner: request.owner, actionId: request.actionId, summary: 'Owner completed the batch.' })),
  }
}

function selectionOwner(): DramaSelectionAnnotationOwnerV1 {
  let anchors: Array<Record<string, unknown>> = []
  return {
    version: '0.1.0-rc.1', capability: 'selection-annotation',
    publishAnchor: draft => { const anchor = { ...draft, anchorId: `anchor:${anchors.length + 1}`, createdAt: '2026-08-29T00:00:00Z', freshness: 'fresh' as const }; anchors = [...anchors, anchor]; return anchor as never },
    createBatch: input => ({ batchId: 'batch:ui:one', title: input.title, anchors: anchors as never, status: 'draft', createdAt: '2026-08-29T00:00:00Z' }),
    submitBatch: () => ({ batchId: 'batch:ui:one', title: 'Drama review annotations', anchors: anchors.map((anchor, index) => ({ ...anchor, marker: index + 1 })) as never, status: 'submitted', createdAt: '2026-08-29T00:00:00Z', submittedAt: '2026-08-29T00:00:01Z' }),
    buildAgentRequest: () => ({ batchId: 'batch:ui:one', title: 'Drama review annotations', markers: anchors.map((anchor, index) => ({ marker: index + 1, label: `#${index + 1}`, kind: anchor.kind, quotePreview: anchor.quotePreview, freshness: 'fresh' })), untrustedContext: true, replyContract: 'reply-must-reference-markers' }) as never,
  }
}

async function readyController(withAnnotations = false) {
  const owner = remote()
  const controller = new DramaShowControlController(owner, withAnnotations ? selectionOwner() : undefined)
  controller.bind('show:one', 'revision:one')
  await controller.refresh()
  return { controller, owner }
}

describe('show-control panes', () => {
  it('registers four schema-valid additive views and renders honest disabled states without an adapter', () => {
    expect(DRAMA_SHOW_CONTROL_VIEW_REGISTRATIONS.map(item => item.descriptor.kind)).toEqual(['drama.show-board', 'drama.review-inbox', 'drama.asset-wall', 'drama.delivery'])
    const factories = createDramaShowControlViewFactories({ disabledReason: 'missing show-control owner projection', refresh: async () => {}, openArtifact: vi.fn() })
    for (const registration of DRAMA_SHOW_CONTROL_VIEW_REGISTRATIONS) {
      const view = render(factories[registration.descriptor.componentKey]!())
      expect(screen.getByText(`${registration.descriptor.label} unavailable`)).toBeTruthy()
      expect(screen.getByText('missing show-control owner projection')).toBeTruthy()
      view.unmount()
    }
  })

  it('renders the Episode Board and enforces preview-before-submit', async () => {
    const { controller, owner } = await readyController()
    const factories = createDramaShowControlViewFactories({ controller, refresh: () => controller.refresh(), openArtifact: vi.fn() })
    render(factories['drama-show-control-showboard']!())
    expect(screen.getByText('1. Arrival')).toBeTruthy()
    const preview = screen.getByRole('button', { name: /Preview context switch/ }) as HTMLButtonElement
    expect(preview.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select episode:1' }))
    expect(preview.disabled).toBe(false)
    fireEvent.click(preview)
    expect(await screen.findByText('Owner-authored preview.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Submit once' }))
    expect(await screen.findByText('Owner completed the batch.')).toBeTruthy()
    expect(owner.previewAction).toHaveBeenCalledOnce()
    expect(owner.dispatch).toHaveBeenCalledOnce()
  })

  it('compares explicitly selected cross-episode reviews and loads Asset Wall on demand', async () => {
    const { controller, owner } = await readyController()
    const openArtifact = vi.fn()
    const factories = createDramaShowControlViewFactories({ controller, refresh: () => controller.refresh(), openArtifact })
    const inbox = render(factories['drama-show-control-reviewinbox']!())
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select review:1' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select review:2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open left' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open right' }))
    expect(openArtifact).toHaveBeenCalledTimes(2)
    expect(openArtifact).toHaveBeenNthCalledWith(1, expect.objectContaining({ ref: 'video:1', version: 'v1' }), true)
    inbox.unmount()

    render(factories['drama-show-control-assetwall']!())
    await waitFor(() => expect(owner.assets).toHaveBeenCalledOnce())
    expect(await screen.findByText('Key frame')).toBeTruthy()
    expect(screen.getByText('Final mix')).toBeTruthy()
  })

  it('submits selected review anchors to the selection owner and previews a repair handoff', async () => {
    const { controller, owner } = await readyController(true)
    const factories = createDramaShowControlViewFactories({ controller, refresh: () => controller.refresh(), openArtifact: vi.fn() })
    render(factories['drama-show-control-reviewinbox']!())
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select review:1' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Bounded note' }), { target: { value: 'Tighten the reaction beat.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit annotation batch (1)' }))
    expect(await screen.findByText(/batch:ui:one · submitted/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Preview repair handoff' }))
    await waitFor(() => expect(owner.previewAction).toHaveBeenCalledWith(expect.objectContaining({ annotationBatchRef: 'batch:ui:one' })))
  })

  it('renders delivery rights, evidence, blockers, and responsive CSS', async () => {
    const { controller } = await readyController()
    const factories = createDramaShowControlViewFactories({ controller, refresh: () => controller.refresh(), openArtifact: vi.fn() })
    render(factories['drama-show-control-delivery']!())
    expect(screen.getByText('Rights · attention')).toBeTruthy()
    expect(screen.getByText('Evidence · blocked')).toBeTruthy()
    expect(screen.getByText('1 blockers')).toBeTruthy()
    expect(screen.getByText(/Captions updated/)).toBeTruthy()
    expect(screen.getByText(/receipt:delivery:2/)).toBeTruthy()
    expect((screen.getAllByRole('button', { name: 'Submit master' })[1] as HTMLButtonElement).disabled).toBe(true)
    expect([...document.querySelectorAll('style')].some(style => style.textContent?.includes('@media(max-width:390px)'))).toBe(true)
  })
})
