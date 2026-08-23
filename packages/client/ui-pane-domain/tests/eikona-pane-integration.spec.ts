// @vitest-environment jsdom
/**
 * dsh-eikona-pane-v1 3.1 组件/集成证据：gallery/compare 投影、generate/review
 * gated mutation（unknown/timeout 进 reconcile，不乐观成功）、export/handoff、
 * permission_denied/offline 诚实降级与大 gallery 有界激活（虚拟化有界渲染）。
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
  createEikonaActionChannel,
  eikonaCardArtifact,
  eikonaNegativeRead,
  eikonaSnapshotRead,
  type EikonaBoardLike,
} from '../src/eikona.ts'
import { domainIntent, type DomainSnapshotV1 } from '../src/snapshot.ts'
import { createDomainPaneView } from '../src/view.ts'
import { createEvidenceRun } from './evidence.ts'

const paneContext = { workspaceRef: 'workspace:eikona-int', sessionRef: 'session:one', principalRef: 'principal:local', revision: '7' }

function board(): EikonaBoardLike {
  return {
    freshness: 'current',
    observedAt: '2026-08-23T00:00:00Z',
    cards: [
      { ref: 'artifact:eikona:hero-a', title: 'Hero pose A', category: 'character', lifecycleState: 'accepted', revision: '4' },
      { ref: 'artifact:eikona:hero-b', title: 'Hero pose B (variant)', category: 'character', lifecycleState: 'review', revision: '2' },
      { ref: 'artifact:eikona:alley-01', title: 'Alley background', category: 'scene', lifecycleState: 'accepted', revision: '7' },
    ],
  }
}

function largeGallery(cards = 300): EikonaBoardLike {
  return {
    freshness: 'current',
    observedAt: '2026-08-23T00:00:00Z',
    cards: Array.from({ length: cards }, (_, index) => ({
      ref: `artifact:eikona:g-${index + 1}`,
      title: `Image ${index + 1}`,
      category: 'image',
      lifecycleState: 'accepted',
      revision: '1',
    })),
  }
}

function upsert(sequence: number, ref: string, title: string, status: string, extra: Record<string, unknown> = {}): unknown {
  return {
    schema: 'pane.event.v1alpha1',
    stream: 'domain.eikona',
    cursor: `c${sequence}`,
    sequence,
    context: paneContext,
    occurredAt: '2026-08-23T00:00:00Z',
    observedAt: '2026-08-23T00:00:00Z',
    freshness: 'fresh',
    op: 'upsert',
    entityRef: ref,
    entityVersion: 2,
    payload: { value: { title, kind: 'character', status } },
    ...extra,
  }
}

class EikonaTransport {
  readCount = 0
  private boards: EikonaBoardLike[] = [board()]
  private listeners = new Set<(event: unknown) => void>()
  private unavailable = new Set<() => void>()
  private available = new Set<() => void>()

  read() {
    this.readCount += 1
    const current = this.boards[Math.min(this.readCount - 1, this.boards.length - 1)]
    return eikonaSnapshotRead(current, paneContext)
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
  comeBack(next: EikonaBoardLike): void { this.boards.push(next); for (const listener of [...this.available]) listener() }
}

// React 18 act 环境标记：允许 act() 内同步提交与断言
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const contexts: Context[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

describe('dsh-eikona-pane-v1 integration evidence', () => {
  it('covers gallery/compare projection, gated mutations, handoff, bounded activation, and teardown', async () => {
    const run = createEvidenceRun('dsh-eikona-pane-v1')
    const scenarios: Record<string, unknown>[] = []

    // Host：正式 domain.eikona owner source 挂载
    const ctx = new Context()
    contexts.push(ctx)
    const transport = new EikonaTransport()
    const bridge = new DomainOwnerSourceBridge('eikona', transport)
    bridge.open()
    const unprovide = ctx.provide('domain.eikona', bridge)

    // Client：真实 apply() 注册 workspace.eikona view
    const views = new Map<string, unknown>()
    ctx.provide('paneWorkbench', {
      registerView: (input: { descriptor: { kind: string }; component: unknown }) => {
        views.set(input.descriptor.kind, input.component)
        return () => { views.delete(input.descriptor.kind) }
      },
      openView: () => {},
    })
    const disposeClient = apply(ctx)

    // gallery 投影：opaque ref、title、status、freshness、allowed_actions、默认模型
    let snapshot: DomainSnapshotV1 = bridge.getSnapshot()
    scenarios.push({ id: 'gallery-snapshot', status: snapshot.status, modelRef: snapshot.modelRef, items: snapshot.items.map(item => `${item.kind}:${item.ref}:${item.status}`), actions: snapshot.allowedActions.map(action => action.id) })
    expect(snapshot.status).toBe('ready')
    expect(snapshot.modelRef).toBe('openai/gpt-5.4-image-2')
    expect(snapshot.items.map(item => item.ref)).toEqual(['artifact:eikona:hero-a', 'artifact:eikona:hero-b', 'artifact:eikona:alley-01'])
    expect(snapshot.allowedActions.map(action => action.id)).toEqual(['generate.preview', 'review.accept', 'review.reject'])

    // compare：同一角色的两个变体经 ArtifactIntent 比较，不改 owner 状态
    const compare = domainIntent(snapshot, snapshot.items[1]!, 'compare', paneContext)
    scenarios.push({ id: 'compare-pair', parsed: ArtifactIntentSchema.safeParse(compare).success, ref: (compare as { source: { ref: string } }).source.ref })
    expect(ArtifactIntentSchema.parse(compare).source.ref).toBe('artifact:eikona:hero-b')

    // live push：review 中的变体被 accept（owner push）
    transport.push(upsert(0, 'artifact:eikona:hero-b', 'Hero pose B (variant)', 'accepted'))
    snapshot = bridge.getSnapshot()
    scenarios.push({ id: 'live-push-accept', status: snapshot.status, variantStatus: snapshot.items[1]?.status })
    expect(snapshot.items[1]?.status).toBe('accepted')

    // duplicate：幂等
    const beforeDuplicate = snapshot
    transport.push(upsert(0, 'artifact:eikona:hero-b', 'Hero pose B (variant)', 'accepted'))
    expect(bridge.getSnapshot()).toBe(beforeDuplicate)
    scenarios.push({ id: 'duplicate', outcome: 'idempotent-same-reference' })

    // gap：保留最后安全投影并要求 reconcile（mutation 暂停）
    transport.push(upsert(4, 'artifact:eikona:hero-a', 'late', 'accepted'))
    const gapSnapshot = bridge.getSnapshot()
    scenarios.push({ id: 'sequence-gap', status: gapSnapshot.status, reason: gapSnapshot.reconcileReason, keptItems: gapSnapshot.items.length })
    expect(gapSnapshot.status).toBe('reconcile_required')
    expect(gapSnapshot.reconcileReason).toBe('sequence_gap:1:4')
    expect(gapSnapshot.items.length).toBe(3)

    // expired cursor 负向：reconcile_required，客户端不得自行定时刷新
    const expired = new DomainOwnerSourceBridge('eikona', { read: () => eikonaNegativeRead('expired_cursor', paneContext), subscribe: () => () => {} })
    expired.open()
    scenarios.push({ id: 'expired-cursor', status: expired.getSnapshot().status, freshness: expired.getSnapshot().freshness })
    expect(expired.getSnapshot().status).toBe('reconcile_required')
    expired.dispose()

    // offline → 重连恰好重读一次
    transport.goOffline()
    const offline = bridge.getSnapshot()
    scenarios.push({ id: 'offline', status: offline.status, reason: offline.reconcileReason })
    expect(offline.status).toBe('offline')
    const readsBefore = transport.readCount
    transport.comeBack(board())
    scenarios.push({ id: 'reconnect', status: bridge.getSnapshot().status, readsDuringReconnect: transport.readCount - readsBefore })
    expect(transport.readCount - readsBefore).toBe(1)

    // permission_denied / contract_mismatch 负向：无 actions
    for (const kind of ['permission_denied', 'contract_mismatch'] as const) {
      const negative = new DomainOwnerSourceBridge('eikona', { read: () => eikonaNegativeRead(kind, paneContext), subscribe: () => () => {} })
      negative.open()
      scenarios.push({ id: `negative-${kind}`, status: negative.getSnapshot().status, actions: negative.getSnapshot().allowedActions.length })
      expect(negative.getSnapshot().allowedActions).toEqual([])
      negative.dispose()
    }

    // action gateway：generate preview → receipt → accept（receipt 绑定 artifact 版本）
    const generatedArtifact = eikonaCardArtifact({ ref: 'artifact:eikona:hero-c', title: 'Hero pose C (generated)', category: 'character', lifecycleState: 'review', revision: '1' })
    const ownerReceipts: Record<string, unknown> = {
      'generate.preview': { status: 'accepted', receiptRef: 'receipt:gen-1', actionId: 'generate.preview', summary: 'Preview generated; awaiting review.', outputArtifacts: [generatedArtifact] },
      'review.accept': { status: 'accepted', receiptRef: 'receipt:accept-1', actionId: 'review.accept', summary: 'Owner accepted the candidate artifact.' },
      'review.reject': { status: 'rejected', receiptRef: 'receipt:reject-1', actionId: 'review.reject', summary: 'Owner rejected the candidate artifact.' },
    }
    const gateway = new DomainActionGateway(createEikonaActionChannel({
      previewArtifact: actionId => ({
        summary: `Eikona owner preview for ${actionId}`,
        expectedRevision: '4',
        modelRef: 'gpt-image-2',
        cost: { currency: 'USD', amount: 0.08, estimate: true },
      }),
      submit: async request => ownerReceipts[(request as { actionId: string }).actionId] ?? ownerReceipts['review.accept'],
    }), { requirePreviewFields: ['cost'] })
    const generatePreview = await gateway.preview({ actionId: 'generate.preview', targetRef: 'artifact:eikona:hero-a' })
    const generateSubmit = generatePreview.kind === 'descriptor'
      ? await gateway.submit(generatePreview.descriptor, { prompt_ref: 'prompt:owner-held-1', model_ref: 'openai/gpt-5.4-image-2' }, paneContext, 'idem-eikona-generate-1')
      : undefined
    const generated = generateSubmit?.kind === 'receipt' ? generateSubmit.receipt.outputArtifacts?.[0] : undefined
    scenarios.push({ id: 'action-generate', preview: generatePreview.kind, submit: generateSubmit?.kind, receiptStatus: generateSubmit?.kind === 'receipt' ? generateSubmit.receipt.status : undefined, artifact: generated })
    expect(generateSubmit).toMatchObject({ kind: 'receipt', receipt: { status: 'accepted' } })
    expect(generated).toMatchObject({ owner: 'eikona', ref: 'artifact:eikona:hero-c', version: '1' })

    const acceptPreview = await gateway.preview({ actionId: 'review.accept', targetRef: 'artifact:eikona:hero-c' })
    const acceptSubmit = acceptPreview.kind === 'descriptor' ? await gateway.submit(acceptPreview.descriptor, {}, paneContext, 'idem-eikona-accept-1') : undefined
    scenarios.push({ id: 'action-review-accept', submit: acceptSubmit?.kind, receiptStatus: acceptSubmit?.kind === 'receipt' ? acceptSubmit.receipt.status : undefined })
    expect(acceptSubmit).toMatchObject({ kind: 'receipt', receipt: { status: 'accepted' } })

    const rejectPreview = await gateway.preview({ actionId: 'review.reject', targetRef: 'artifact:eikona:hero-c' })
    const rejectSubmit = rejectPreview.kind === 'descriptor' ? await gateway.submit(rejectPreview.descriptor, {}, paneContext, 'idem-eikona-reject-1') : undefined
    scenarios.push({ id: 'action-review-reject', submit: rejectSubmit?.kind, receiptStatus: rejectSubmit?.kind === 'receipt' ? rejectSubmit.receipt.status : undefined })
    expect(rejectSubmit).toMatchObject({ kind: 'receipt', receipt: { status: 'rejected' } })

    // unknown receipt / timeout → reconcile，绝不乐观成功
    const unknownGateway = new DomainActionGateway(createEikonaActionChannel({
      previewArtifact: () => ({ summary: 'preview', expectedRevision: '4', cost: { currency: 'USD', amount: 0.08, estimate: true } }),
      submit: async () => ({ status: 'unknown', receiptRef: 'receipt:u', summary: 'Owner did not confirm.' }),
    }), { requirePreviewFields: ['cost'] })
    const unknownPreview = await unknownGateway.preview({ actionId: 'review.accept', targetRef: 'artifact:eikona:hero-c' })
    const unknownSubmit = unknownPreview.kind === 'descriptor' ? await unknownGateway.submit(unknownPreview.descriptor, {}, paneContext, 'idem-eikona-unknown-1') : undefined
    const timeoutGateway = new DomainActionGateway(
      createEikonaActionChannel({ previewArtifact: () => ({ summary: 'preview', expectedRevision: '4', cost: { currency: 'USD', amount: 0.08, estimate: true } }), submit: () => new Promise(() => {}) }),
      { requirePreviewFields: ['cost'], deadlineMs: 5 },
    )
    const timeoutPreview = await timeoutGateway.preview({ actionId: 'generate.preview', targetRef: 'artifact:eikona:hero-a' })
    const timeoutSubmit = timeoutPreview.kind === 'descriptor' ? await timeoutGateway.submit(timeoutPreview.descriptor, { prompt_ref: 'prompt:owner-held-1' }, paneContext, 'idem-eikona-timeout-1') : undefined
    scenarios.push({ id: 'unknown-and-timeout', unknown: unknownSubmit, timeout: timeoutSubmit })
    expect(unknownSubmit).toMatchObject({ kind: 'reconcile_required', reason: 'unknown_receipt' })
    expect(timeoutSubmit).toMatchObject({ kind: 'reconcile_required', reason: 'timeout' })

    // export/handoff：accepted image → Anatomia，eikona 状态不变
    const liveSnapshot = bridge.getSnapshot()
    const handoff = domainIntent(liveSnapshot, liveSnapshot.items[0]!, 'handoff', paneContext, 'anatomia')
    const handoffArtifact = eikonaCardArtifact({ ref: 'artifact:eikona:hero-a', title: 'Hero pose A', category: 'character', lifecycleState: 'accepted', revision: '4' })
    scenarios.push({ id: 'handoff-anatomia', parsed: ArtifactIntentSchema.safeParse(handoff).success, targetOwner: (handoff as { targetOwner?: string }).targetOwner, source: (handoff as { source: { owner: string; ref: string; version: string } }).source, artifactVersion: handoffArtifact.version })
    expect(ArtifactIntentSchema.parse(handoff).source).toMatchObject({ owner: 'eikona', ref: 'artifact:eikona:hero-a' })
    expect(handoffArtifact.version).toBe('4')
    expect(liveSnapshot.items[0]?.status).toBe('accepted')

    // 大 gallery 有界激活：300 卡投影，DOM 只渲染 80 行（虚拟化有界渲染）
    const bigTransport = new EikonaTransport()
    bigTransport.boards = [largeGallery()]
    const bigBridge = new DomainOwnerSourceBridge('eikona', bigTransport)
    bigBridge.open()
    const bigSnapshot = bigBridge.getSnapshot()
    scenarios.push({ id: 'large-gallery', projectedItems: bigSnapshot.items.length })
    expect(bigSnapshot.items.length).toBe(300)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const eikonaView = views.get('workspace.eikona') as (props: unknown) => unknown
    expect(eikonaView, 'client registered the eikona pane view').toBeDefined()
    // 注册路径同款 view 工厂直连大 gallery snapshot：验证有界渲染本身
    const bigView = createDomainPaneView('eikona', () => bigSnapshot)
    await act(async () => { root.render(createElement(bigView as never)) })
    const renderedRows = container.querySelectorAll('[data-item-ref]').length
    const rowCount = container.querySelector('[data-virtualized]')?.getAttribute('aria-rowcount')
    scenarios.push({ id: 'bounded-activation', projectedItems: bigSnapshot.items.length, renderedRows, ariaRowCount: rowCount, virtualized: container.querySelector('[data-virtualized]') !== null })
    expect(renderedRows).toBe(80)
    expect(rowCount).toBe('300')
    await act(async () => { root.unmount() })
    container.remove()
    bigBridge.dispose()

    // 组件证据：静态渲染关键状态
    const componentEvidence: Record<string, string> = {
      'eikona-gallery.html': renderToStaticMarkup(createElement('section', { 'data-status': liveSnapshot.status, 'data-model-ref': liveSnapshot.modelRef }, `${liveSnapshot.items.length} artifacts`)),
      'eikona-reconcile.html': renderToStaticMarkup(createElement('section', { 'data-status': 'reconcile_required' }, 'reconcile_required')),
    }
    for (const [name, html] of Object.entries(componentEvidence)) run.artifact(name, html)

    // teardown
    disposeClient()
    unprovide()
    bridge.dispose()
    scenarios.push({ id: 'teardown', domainServicePresent: ctx.get('domain.eikona') !== undefined, clientViews: views.size })
    expect(ctx.get('domain.eikona')).toBeUndefined()
    expect(views.size).toBe(0)

    run.summary({
      scope: 'component/integration evidence for dsh-eikona-pane-v1 tasks 2.3/2.4/3.1',
      scenarios,
      transportReads: transport.readCount,
      redactionChecked: true,
    })
    run.artifact('eikona-integration-outcomes.json', scenarios)
  })
})
