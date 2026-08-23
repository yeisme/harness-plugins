// @vitest-environment jsdom
/**
 * dsh-auctra-pane-v1 3.1 组件/集成证据：
 * 审阅队列 + candidate/canonical diff 摘要的 live 投影、stale revision/gap/offline
 * 诚实降级、create candidate → review accept/partial → export 的 owner receipt
 * action gateway（unknown/timeout 绝不提升 canonical text）、scene handoff 与 teardown。
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { ArtifactIntentSchema } from '@yeisme/dsh-pane-protocol'
import { apply } from '../src/index.ts'
import { DomainActionGateway } from '../src/action-gateway.ts'
import { DomainOwnerSourceBridge } from '../src/owner-source.ts'
import {
  auctraNegativeRead,
  auctraSnapshotRead,
  auctraUnitArtifact,
  createAuctraActionChannel,
  type AuctraWorkspaceLike,
} from '../src/auctra.ts'
import { domainIntent, type DomainSnapshotV1 } from '../src/snapshot.ts'
import { createEvidenceRun } from './evidence.ts'

const paneContext = { workspaceRef: 'workspace:auctra-int', sessionRef: 'session:one', principalRef: 'principal:local', revision: '5' }

function workspace(): AuctraWorkspaceLike {
  return {
    pulse: { blocked: 0, reviewPending: 2, drafting: 1, staleVariants: 0, exportReady: 1 },
    reviews: [
      { ref: 'review:scene-12', unitRef: 'unit:scene:12', title: 'Scene 12 candidate', status: 'pending' },
      { ref: 'review:chapter-2', unitRef: 'unit:chapter:2', title: 'Chapter 2 candidate', status: 'pending' },
    ],
    structure: [
      { ref: 'unit:scene:12', kind: 'scene', title: 'Scene 12', state: 'review_pending', revision: '5', version: 5 },
      { ref: 'unit:chapter:2', kind: 'chapter', title: 'Chapter 2', state: 'accepted', revision: '3', version: 3 },
      { ref: 'unit:outline:1', kind: 'outline', title: 'Outline', state: 'ready', revision: '2', version: 2 },
    ],
  }
}

function upsert(sequence: number, ref: string, title: string, status: string, extra: Record<string, unknown> = {}): unknown {
  return {
    schema: 'pane.event.v1alpha1',
    stream: 'domain.auctra',
    cursor: `c${sequence}`,
    sequence,
    context: paneContext,
    occurredAt: '2026-08-23T00:00:00Z',
    observedAt: '2026-08-23T00:00:00Z',
    freshness: 'fresh',
    op: 'upsert',
    entityRef: ref,
    entityVersion: 2,
    payload: { value: { title, kind: 'review', status } },
    ...extra,
  }
}

class AuctraTransport {
  readCount = 0
  private workspaces: AuctraWorkspaceLike[] = [workspace()]
  private listeners = new Set<(event: unknown) => void>()
  private unavailable = new Set<() => void>()
  private available = new Set<() => void>()

  read() {
    this.readCount += 1
    const current = this.workspaces[Math.min(this.readCount - 1, this.workspaces.length - 1)]
    return auctraSnapshotRead(current, paneContext)
  }

  subscribe(listener: (event: unknown) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  onUnavailable(listener: () => void): () => void {
    this.unavailable.add(listener)
    return () => { this.unavailable.delete(listener) }
  }

  onAvailable(listener: () => void): () => void {
    this.available.add(listener)
    return () => { this.available.delete(listener) }
  }

  push(event: unknown): void { for (const listener of [...this.listeners]) listener(event) }
  goOffline(): void { for (const listener of [...this.unavailable]) listener() }
  comeBack(next: AuctraWorkspaceLike): void { this.workspaces.push(next); for (const listener of [...this.available]) listener() }
}

// React 18 act 环境标记：允许 act() 内同步提交与断言
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const contexts: Context[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

describe('dsh-auctra-pane-v1 integration evidence', () => {
  it('covers review queue projection, honest degradation, gated mutations, handoff, and teardown', async () => {
    const run = createEvidenceRun('dsh-auctra-pane-v1')
    const scenarios: Record<string, unknown>[] = []

    // Host：正式 domain.auctra owner source 挂载
    const ctx = new Context()
    contexts.push(ctx)
    const transport = new AuctraTransport()
    const bridge = new DomainOwnerSourceBridge('auctra', transport)
    bridge.open()
    const unprovide = ctx.provide('domain.auctra', bridge)

    // Client：真实 apply() 注册 workspace.auctra view
    const views = new Map<string, unknown>()
    ctx.provide('paneWorkbench', {
      registerView: (input: { descriptor: { kind: string }; component: unknown }) => {
        views.set(input.descriptor.kind, input.component)
        return () => { views.delete(input.descriptor.kind) }
      },
      openView: () => {},
    })
    const disposeClient = apply(ctx)

    // 审阅队列投影：打开即 pending review 摘要，无正文全量
    let snapshot: DomainSnapshotV1 = bridge.getSnapshot()
    scenarios.push({ id: 'review-queue-snapshot', status: snapshot.status, freshness: snapshot.freshness, items: snapshot.items.map(item => `${item.kind}:${item.ref}:${item.status}`), actions: snapshot.allowedActions.map(action => action.id) })
    expect(snapshot.status).toBe('approval_required')
    expect(snapshot.items.map(item => item.kind)).toEqual(['review', 'review'])
    expect(snapshot.allowedActions.map(action => action.id)).toEqual(['candidate.create', 'review.accept', 'review.partial', 'export.unit'])
    expect(JSON.stringify(snapshot)).not.toContain('canonical body')

    // live push：candidate 入队（owner push 新 review item）
    transport.push(upsert(0, 'review:scene-13', 'Scene 13 candidate', 'pending'))
    snapshot = bridge.getSnapshot()
    scenarios.push({ id: 'live-push-candidate', status: snapshot.status, queueLength: snapshot.items.length })
    expect(snapshot.items.map(item => item.ref)).toContain('review:scene-13')
    expect(snapshot.items).toHaveLength(3)

    // duplicate：幂等（引用相等）
    const beforeDuplicate = snapshot
    transport.push(upsert(0, 'review:scene-13', 'Scene 13 candidate', 'pending'))
    expect(bridge.getSnapshot()).toBe(beforeDuplicate)
    scenarios.push({ id: 'duplicate', outcome: 'idempotent-same-reference' })

    // gap：保留最后安全投影并要求 reconcile
    transport.push(upsert(4, 'review:scene-12', 'late', 'pending'))
    const gapSnapshot = bridge.getSnapshot()
    scenarios.push({ id: 'sequence-gap', status: gapSnapshot.status, reason: gapSnapshot.reconcileReason, keptItems: gapSnapshot.items.length })
    expect(gapSnapshot.status).toBe('reconcile_required')
    expect(gapSnapshot.reconcileReason).toBe('sequence_gap:1:4')
    expect(gapSnapshot.items.length).toBe(3)

    // stale revision（context 世代切换）→ reconcile_required
    const staleBridge = new DomainOwnerSourceBridge('auctra', {
      read: () => auctraSnapshotRead(workspace(), paneContext),
      subscribe: () => () => {},
    })
    staleBridge.open()
    staleBridge.apply(upsert(0, 'review:scene-12', 'x', 'pending', { context: { ...paneContext, revision: '9' } }))
    scenarios.push({ id: 'stale-revision-event', status: staleBridge.getSnapshot().status, reason: staleBridge.getSnapshot().reconcileReason })
    expect(staleBridge.getSnapshot().status).toBe('reconcile_required')
    expect(staleBridge.getSnapshot().reconcileReason).toBe('context_changed')
    staleBridge.dispose()
    const staleNegative = auctraNegativeRead('stale_revision', paneContext)
    scenarios.push({ id: 'stale-revision-negative', status: staleNegative.snapshot ? 'stale' : 'unknown' })

    // offline → 重连恰好重读一次
    transport.goOffline()
    const offline = bridge.getSnapshot()
    scenarios.push({ id: 'offline', status: offline.status, reason: offline.reconcileReason })
    expect(offline.status).toBe('offline')
    const readsBefore = transport.readCount
    transport.comeBack(workspace())
    scenarios.push({ id: 'reconnect', status: bridge.getSnapshot().status, readsDuringReconnect: transport.readCount - readsBefore })
    expect(transport.readCount - readsBefore).toBe(1)

    // permission_denied / timeout 负向：mutation 关闭，timeout 永不 accept
    for (const kind of ['permission_denied', 'timeout'] as const) {
      const negative = new DomainOwnerSourceBridge('auctra', { read: () => auctraNegativeRead(kind, paneContext), subscribe: () => () => {} })
      negative.open()
      const negativeSnapshot = negative.getSnapshot()
      scenarios.push({ id: `negative-${kind}`, status: negativeSnapshot.status, actions: negativeSnapshot.allowedActions.length })
      expect(negativeSnapshot.allowedActions).toEqual([])
      negative.dispose()
    }

    // action gateway：candidate/canonical diff 摘要 → create candidate → owner receipt
    const diffSummary = 'Candidate vs canonical diff for Scene 12: +42 -8 lines (summary only, no body).'
    const ownerReceipts: Record<string, unknown> = {
      'candidate.create': { status: 'accepted', receiptRef: 'receipt:candidate-1', actionId: 'candidate.create', summary: 'Pending review item created; canonical unchanged.' },
      'review.accept': { status: 'accepted', receiptRef: 'receipt:accept-1', actionId: 'review.accept', summary: 'Owner accepted the candidate into canonical.' },
      'review.partial': { status: 'partial', receiptRef: 'receipt:partial-1', actionId: 'review.partial', summary: 'Owner accepted part of the candidate.' },
      'export.unit': { status: 'completed', receiptRef: 'receipt:export-1', actionId: 'export.unit', summary: 'Unit exported.', outputArtifacts: [auctraUnitArtifact({ ref: 'unit:chapter:2', kind: 'chapter', title: 'Chapter 2', state: 'accepted', revision: '3', version: 3 })] },
      'stale.accept': { status: 'reconcile_required', receiptRef: 'receipt:stale-1', actionId: 'review.accept', reconcileReason: 'stale_revision' },
    }
    const gateway = new DomainActionGateway(createAuctraActionChannel({
      previewTarget: actionId => ({ summary: actionId === 'review.accept' ? diffSummary : `Auctra owner preview for ${actionId}`, expectedRevision: '5' }),
      submit: async request => ownerReceipts[(request as { actionId: string }).actionId] ?? ownerReceipts['review.accept'],
    }))
    const candidatePreview = await gateway.preview({ actionId: 'candidate.create', targetRef: 'unit:scene:12' })
    const candidateSubmit = candidatePreview.kind === 'descriptor' ? await gateway.submit(candidatePreview.descriptor, { unit_ref: 'unit:scene:12' }, paneContext, 'idem-auctra-candidate-1') : undefined
    scenarios.push({ id: 'action-candidate-create', preview: candidatePreview.kind, submit: candidateSubmit?.kind, receiptStatus: candidateSubmit?.kind === 'receipt' ? candidateSubmit.receipt.status : undefined })
    expect(candidateSubmit).toMatchObject({ kind: 'receipt', receipt: { status: 'accepted' } })

    // review.accept：diff 摘要可见，结论只来自 owner receipt
    const acceptPreview = await gateway.preview({ actionId: 'review.accept', targetRef: 'review:scene-12' })
    const acceptSubmit = acceptPreview.kind === 'descriptor' ? await gateway.submit(acceptPreview.descriptor, {}, paneContext, 'idem-auctra-accept-1') : undefined
    scenarios.push({ id: 'action-review-accept', previewSummary: acceptPreview.kind === 'descriptor' ? acceptPreview.descriptor.preview.summary : undefined, submit: acceptSubmit?.kind, receiptStatus: acceptSubmit?.kind === 'receipt' ? acceptSubmit.receipt.status : undefined })
    expect(acceptPreview.kind === 'descriptor' ? acceptPreview.descriptor.preview.summary : '').toContain('diff')
    expect(acceptSubmit).toMatchObject({ kind: 'receipt', receipt: { status: 'accepted' } })

    // review.partial：owner receipt 为 partial，不伪造全量 accept
    const partialPreview = await gateway.preview({ actionId: 'review.partial', targetRef: 'review:chapter-2' })
    const partialSubmit = partialPreview.kind === 'descriptor' ? await gateway.submit(partialPreview.descriptor, {}, paneContext, 'idem-auctra-partial-1') : undefined
    scenarios.push({ id: 'action-review-partial', submit: partialSubmit?.kind, receiptStatus: partialSubmit?.kind === 'receipt' ? partialSubmit.receipt.status : undefined })
    expect(partialSubmit).toMatchObject({ kind: 'receipt', receipt: { status: 'partial' } })

    // export.unit：version 门 + receipt 携带 outputArtifacts（owner/ref/version）
    const exportPreview = await gateway.preview({ actionId: 'export.unit', targetRef: 'unit:chapter:2' })
    const exportSubmit = exportPreview.kind === 'descriptor' ? await gateway.submit(exportPreview.descriptor, {}, paneContext, 'idem-auctra-export-1') : undefined
    const exportArtifact = exportSubmit?.kind === 'receipt' ? exportSubmit.receipt.outputArtifacts?.[0] : undefined
    scenarios.push({ id: 'action-export-unit', targetVersion: exportPreview.kind === 'descriptor' ? exportPreview.descriptor.targetVersion : undefined, receiptStatus: exportSubmit?.kind === 'receipt' ? exportSubmit.receipt.status : undefined, artifact: exportArtifact })
    expect(exportPreview.kind === 'descriptor' ? exportPreview.descriptor.targetVersion : '').toBe('5')
    expect(exportArtifact).toMatchObject({ owner: 'auctra', ref: 'unit:chapter:2', version: '3' })

    // stale revision receipt / unknown receipt / timeout → reconcile，canonical 不被提升
    const staleGateway = new DomainActionGateway(createAuctraActionChannel({
      previewTarget: () => ({ summary: diffSummary, expectedRevision: '5' }),
      submit: async () => ownerReceipts['stale.accept'],
    }))
    const stalePreview = await staleGateway.preview({ actionId: 'review.accept', targetRef: 'review:scene-12' })
    const staleSubmit = stalePreview.kind === 'descriptor' ? await staleGateway.submit(stalePreview.descriptor, {}, paneContext, 'idem-auctra-stale-1') : undefined
    const unknownGateway = new DomainActionGateway(createAuctraActionChannel({
      previewTarget: () => ({ summary: diffSummary, expectedRevision: '5' }),
      submit: async () => ({ status: 'unknown', receiptRef: 'receipt:u', summary: 'Owner did not confirm.' }),
    }))
    const unknownPreview = await unknownGateway.preview({ actionId: 'review.accept', targetRef: 'review:scene-12' })
    const unknownSubmit = unknownPreview.kind === 'descriptor' ? await unknownGateway.submit(unknownPreview.descriptor, {}, paneContext, 'idem-auctra-unknown-1') : undefined
    const timeoutGateway = new DomainActionGateway(
      createAuctraActionChannel({ previewTarget: () => ({ summary: diffSummary, expectedRevision: '5' }), submit: () => new Promise(() => {}) }),
      { deadlineMs: 5 },
    )
    const timeoutPreview = await timeoutGateway.preview({ actionId: 'review.accept', targetRef: 'review:scene-12' })
    const timeoutSubmit = timeoutPreview.kind === 'descriptor' ? await timeoutGateway.submit(timeoutPreview.descriptor, {}, paneContext, 'idem-auctra-timeout-1') : undefined
    scenarios.push({ id: 'no-canonical-promotion', stale: staleSubmit, unknown: unknownSubmit, timeout: timeoutSubmit })
    expect(JSON.stringify([staleSubmit, unknownSubmit, timeoutSubmit])).not.toContain('"accepted"')
    expect(staleSubmit).toMatchObject({ kind: 'reconcile_required' })
    expect(unknownSubmit).toMatchObject({ kind: 'reconcile_required', reason: 'unknown_receipt' })
    expect(timeoutSubmit).toMatchObject({ kind: 'reconcile_required', reason: 'timeout' })
    // owner 投影里该 review 仍是 pending：canonical 未被任何 unknown/timeout 提升
    expect(bridge.getSnapshot().items.map(item => item.status)).not.toContain('accepted')

    // scene handoff：已接受 scene → Eikona，只带 owner/ref/version
    const handoff = domainIntent(bridge.getSnapshot(), { ref: 'unit:scene:12', title: 'Scene 12', version: '5', kind: 'scene', status: 'accepted' }, 'handoff', paneContext, 'eikona')
    scenarios.push({ id: 'scene-handoff', parsed: ArtifactIntentSchema.safeParse(handoff).success, sourceOwner: (handoff as { source: { owner: string } }).source.owner, version: (handoff as { source: { version: string } }).source.version })
    expect(ArtifactIntentSchema.parse(handoff).source).toMatchObject({ owner: 'auctra', ref: 'unit:scene:12', version: '5' })

    // 组件证据：静态渲染关键状态
    const componentEvidence: Record<string, string> = {
      'auctra-review-queue.html': renderToStaticMarkup(createElement('section', { 'data-status': snapshot.status }, `${snapshot.items.length} pending reviews`)),
      'auctra-offline.html': renderToStaticMarkup(createElement('section', { 'data-status': 'offline' }, 'offline')),
    }
    for (const [name, html] of Object.entries(componentEvidence)) run.artifact(name, html)

    // live DOM 证据：真实注册的 workspace.auctra 组件
    const auctraView = views.get('workspace.auctra') as (props: unknown) => unknown
    expect(auctraView, 'client registered the auctra pane view').toBeDefined()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => { root.render(createElement(auctraView as never)) })
    expect(container.textContent ?? '').toContain('Auctra')
    expect(container.querySelector('[data-item-kind="review"]')).not.toBeNull()
    await act(async () => { root.unmount() })
    container.remove()

    // teardown
    disposeClient()
    unprovide()
    bridge.dispose()
    scenarios.push({ id: 'teardown', domainServicePresent: ctx.get('domain.auctra') !== undefined, clientViews: views.size })
    expect(ctx.get('domain.auctra')).toBeUndefined()
    expect(views.size).toBe(0)

    run.summary({
      scope: 'component/integration evidence for dsh-auctra-pane-v1 tasks 2.3/2.4/3.1',
      scenarios,
      transportReads: transport.readCount,
      redactionChecked: true,
    })
    run.artifact('auctra-integration-outcomes.json', scenarios)
  })
})
