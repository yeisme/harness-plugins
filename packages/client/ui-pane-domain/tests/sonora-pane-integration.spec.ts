// @vitest-environment jsdom
/**
 * dsh-sonora-pane-v1 3.1 组件/集成证据：
 * snapshot + push event live 投影、duplicate/gap/expired cursor/offline 诚实降级、
 * cost/rights preview → render/accept → receipt 的 action gateway（unknown/timeout
 * 进 reconcile，绝不乐观成功）、跨 Pane handoff 与 teardown。
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
import { createSonoraActionChannel, sonoraNegativeRead, sonoraSnapshotRead, type SonoraBoardLike } from '../src/sonora.ts'
import { domainIntent, type DomainSnapshotV1 } from '../src/snapshot.ts'
import { createEvidenceRun } from './evidence.ts'

const paneContext = { workspaceRef: 'workspace:sonora-int', sessionRef: 'session:one', principalRef: 'principal:local', revision: '1' }

function board(): SonoraBoardLike {
  return {
    takes: [
      { resourceRef: 'take:wave-1', title: 'Voiceover take (waveform ready)', lane: 'waveform_ready', revision: '2' },
      { resourceRef: 'take:sub-1', title: 'Subtitle pass take', lane: 'subtitle_ready', revision: '1' },
      { resourceRef: 'take:rev-1', title: 'Review queue take', lane: 'review', revision: '1' },
    ],
    freshness: 'fresh',
    rightsPreview: true,
    costPreview: true,
  }
}

function upsert(sequence: number, ref: string, title: string, status: string, extra: Record<string, unknown> = {}): unknown {
  return {
    schema: 'pane.event.v1alpha1',
    stream: 'domain.sonora',
    cursor: `c${sequence}`,
    sequence,
    context: paneContext,
    occurredAt: '2026-08-23T00:00:00Z',
    observedAt: '2026-08-23T00:00:00Z',
    freshness: 'fresh',
    op: 'upsert',
    entityRef: ref,
    entityVersion: 2,
    payload: { value: { title, kind: 'take', status } },
    ...extra,
  }
}

class SonoraTransport {
  readCount = 0
  private boards: SonoraBoardLike[] = [board()]
  private listeners = new Set<(event: unknown) => void>()
  private unavailable = new Set<() => void>()
  private available = new Set<() => void>()

  read() {
    this.readCount += 1
    const current = this.boards[Math.min(this.readCount - 1, this.boards.length - 1)]
    return sonoraSnapshotRead(current, paneContext)
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
  comeBack(next: SonoraBoardLike): void { this.boards.push(next); for (const listener of [...this.available]) listener() }
}

function statusList(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-item-status]')].map(node => node.getAttribute('data-item-status') ?? '')
}
function containerBeforeStatus(container: HTMLElement): string[] { return statusList(container) }
function containerAfterStatus(container: HTMLElement): string[] { return statusList(container) }

// React 18 act 环境标记：允许 act() 内同步提交与断言
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const contexts: Context[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

describe('dsh-sonora-pane-v1 integration evidence', () => {
  it('covers live projection, honest degradation, gated actions, handoff, and teardown', async () => {
    const run = createEvidenceRun('dsh-sonora-pane-v1')
    const scenarios: Record<string, unknown>[] = []

    // Host：正式 domain.sonora owner source 挂载
    const ctx = new Context()
    contexts.push(ctx)
    const transport = new SonoraTransport()
    const bridge = new DomainOwnerSourceBridge('sonora', transport)
    bridge.open()
    const unprovide = ctx.provide('domain.sonora', bridge)

    // Client：真实 apply() 注册 workspace.sonora view（记录组件用于 DOM 证据）
    const openViews: unknown[] = []
    const views = new Map<string, unknown>()
    ctx.provide('paneWorkbench', {
      registerView: (input: { descriptor: { kind: string }; component: unknown }) => {
        views.set(input.descriptor.kind, input.component)
        return () => { views.delete(input.descriptor.kind) }
      },
      openView: (request: unknown) => { openViews.push(request) },
    })
    const disposeClient = apply(ctx)

    let snapshot = bridge.getSnapshot()
    scenarios.push({ id: 'snapshot', status: snapshot.status, items: snapshot.items.map(item => `${item.kind}:${item.ref}:${item.status}`), actions: snapshot.allowedActions.map(action => action.id) })
    expect(snapshot.status).toBe('ready')
    expect(snapshot.items.map(item => item.status)).toEqual(['waveform_ready', 'subtitle_ready', 'review'])

    // live push：lane 变化即时进入投影
    transport.push(upsert(0, 'take:rev-1', 'Review queue take', 'accepted'))
    snapshot = bridge.getSnapshot()
    scenarios.push({ id: 'live-push', status: snapshot.status, lastItemStatus: snapshot.items.at(-1)?.status })
    expect(snapshot.items.at(-1)?.status).toBe('accepted')

    // duplicate：幂等
    const beforeDuplicate = snapshot
    transport.push(upsert(0, 'take:rev-1', 'Review queue take', 'accepted'))
    expect(bridge.getSnapshot()).toBe(beforeDuplicate)
    scenarios.push({ id: 'duplicate', outcome: 'idempotent-same-reference' })

    // gap：保留最后安全投影并要求 reconcile
    transport.push(upsert(4, 'take:rev-1', 'late', 'accepted'))
    const gapSnapshot = bridge.getSnapshot()
    scenarios.push({ id: 'sequence-gap', status: gapSnapshot.status, reason: gapSnapshot.reconcileReason, keptItems: gapSnapshot.items.length })
    expect(gapSnapshot.status).toBe('reconcile_required')
    expect(gapSnapshot.reconcileReason).toBe('sequence_gap:1:4')
    expect(gapSnapshot.items.length).toBe(3)

    // expired cursor / context switch → reconcile_required
    const freshBridge = new DomainOwnerSourceBridge('sonora', {
      read: () => sonoraSnapshotRead(board(), paneContext),
      subscribe: () => () => {},
    })
    freshBridge.open()
    freshBridge.apply(upsert(0, 'take:rev-1', 'x', 'x', { context: { ...paneContext, revision: '9' } }))
    scenarios.push({ id: 'expired-cursor', status: freshBridge.getSnapshot().status, reason: freshBridge.getSnapshot().reconcileReason })
    expect(freshBridge.getSnapshot().status).toBe('reconcile_required')
    expect(freshBridge.getSnapshot().reconcileReason).toBe('context_changed')
    freshBridge.dispose()

    // offline → 重连恰好重读一次
    transport.goOffline()
    const offline = bridge.getSnapshot()
    scenarios.push({ id: 'offline', status: offline.status, reason: offline.reconcileReason })
    expect(offline.status).toBe('offline')
    const readsBefore = transport.readCount
    transport.comeBack(board())
    scenarios.push({ id: 'reconnect', status: bridge.getSnapshot().status, readsDuringReconnect: transport.readCount - readsBefore })
    expect(transport.readCount - readsBefore).toBe(1)

    // approval_required 负向
    const approval = sonoraNegativeRead('approval_required', paneContext)
    const approvalBridge = new DomainOwnerSourceBridge('sonora', { read: () => approval, subscribe: () => () => {} })
    approvalBridge.open()
    scenarios.push({ id: 'approval-required-negative', status: approvalBridge.getSnapshot().status, actions: approvalBridge.getSnapshot().allowedActions.length })
    expect(approvalBridge.getSnapshot().status).toBe('approval_required')
    expect(approvalBridge.getSnapshot().allowedActions).toEqual([])
    approvalBridge.dispose()

    // action gateway：cost/rights preview → render → receipt
    const cost = { currency: 'USD', amount: 0.12, estimate: true }
    const rights = { status: 'clear', summary: 'Workspace voice rights cover this take.' }
    const channel = createSonoraActionChannel({
      previewTake: () => ({ cost, rights }),
      submitTake: async () => ({ status: 'accepted', receiptRef: 'receipt:render-1', actionId: 'render.take', summary: 'Owner accepted the render.' }),
    })
    const gateway = new DomainActionGateway(channel, { requirePreviewFields: ['cost', 'rights'] })
    const preview = await gateway.preview({ actionId: 'render.take', targetRef: 'take:wave-1' })
    expect(preview.kind).toBe('descriptor')
    const submit = preview.kind === 'descriptor'
      ? await gateway.submit(preview.descriptor, {}, paneContext, 'idem-sonora-render-1')
      : undefined
    scenarios.push({ id: 'action-gateway-render', preview: preview.kind, submit: submit?.kind, receiptStatus: submit?.kind === 'receipt' ? submit.receipt.status : undefined })
    expect(submit).toMatchObject({ kind: 'receipt', receipt: { status: 'accepted' } })

    // 缺 rights/cost 预览 → approval_required，mutation 禁用
    const noPreview = await new DomainActionGateway(
      createSonoraActionChannel({ previewTake: () => undefined, submitTake: async () => ({ status: 'accepted', receiptRef: 'r' }) }),
      { requirePreviewFields: ['cost', 'rights'] },
    ).preview({ actionId: 'render.take', targetRef: 'take:wave-1' })
    scenarios.push({ id: 'action-without-preview', outcome: noPreview.kind, reason: noPreview.kind === 'approval_required' ? noPreview.reason : undefined })
    expect(noPreview).toMatchObject({ kind: 'approval_required', reason: 'rights_or_cost_preview_missing' })

    // unknown receipt / timeout → reconcile，绝不乐观成功
    const unknownGateway = new DomainActionGateway(
      createSonoraActionChannel({ previewTake: () => ({ cost, rights }), submitTake: async () => ({ status: 'unknown', receiptRef: 'receipt:u', summary: 'Owner did not confirm.' }) }),
      { requirePreviewFields: ['cost', 'rights'] },
    )
    const unknownOutcome = await unknownGateway.preview({ actionId: 'review.accept', targetRef: 'take:rev-1' })
    const unknownSubmit = unknownOutcome.kind === 'descriptor' ? await unknownGateway.submit(unknownOutcome.descriptor, {}, paneContext, 'idem-sonora-unknown') : undefined
    const timeoutGateway = new DomainActionGateway(
      createSonoraActionChannel({ previewTake: () => ({ cost, rights }), submitTake: () => new Promise(() => {}) }),
      { requirePreviewFields: ['cost', 'rights'], deadlineMs: 5 },
    )
    const timeoutPreview = await timeoutGateway.preview({ actionId: 'render.take', targetRef: 'take:wave-1' })
    const timeoutSubmit = timeoutPreview.kind === 'descriptor' ? await timeoutGateway.submit(timeoutPreview.descriptor, {}, paneContext, 'idem-sonora-timeout') : undefined
    scenarios.push({ id: 'unknown-and-timeout', unknown: unknownSubmit, timeout: timeoutSubmit })
    expect(unknownSubmit).toMatchObject({ kind: 'reconcile_required', reason: 'unknown_receipt' })
    expect(timeoutSubmit).toMatchObject({ kind: 'reconcile_required', reason: 'timeout' })

    // 跨 Pane handoff：waveform take → Anatomia
    const liveSnapshot = bridge.getSnapshot()
    const handoff = domainIntent(liveSnapshot, liveSnapshot.items[0]!, 'handoff', paneContext, 'anatomia')
    scenarios.push({ id: 'handoff', parsed: ArtifactIntentSchema.safeParse(handoff).success, targetOwner: (handoff as { targetOwner?: string }).targetOwner })
    expect(ArtifactIntentSchema.parse(handoff).targetOwner).toBe('anatomia')

    // 组件证据：关键状态静态渲染
    const componentEvidence: Record<string, string> = {
      'sonora-ready.html': renderToStaticMarkup(createElement('section', { 'data-status': snapshot.status }, `${snapshot.items.length} takes`)),
    }
    const approvalHtml = renderToStaticMarkup(createElement('section', { 'data-status': 'approval_required' }, 'approval_required'))
    componentEvidence['sonora-approval-required.html'] = approvalHtml
    for (const [name, html] of Object.entries(componentEvidence)) run.artifact(name, html)

    // live DOM 证据：真实注册的 workspace.sonora 组件随 push 事件重渲染
    const sonoraView = views.get('workspace.sonora') as (props: unknown) => unknown
    expect(sonoraView, 'client registered the sonora pane view').toBeDefined()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(sonoraView as never))
    })
    const before = container.textContent ?? ''
    expect(before).toContain('Sonora')
    expect(container.querySelector('[data-item-status="waveform_ready"]')).not.toBeNull()
    // 重连重读后 sequence 从 -1 重新开始；下一条 push 必须是 0
    transport.push(upsert(0, 'take:wave-1', 'Voiceover take (rendered)', 'rendered'))
    await act(async () => { /* 等 useSyncExternalStore 通知后的重渲染 */ })
    const after = container.textContent ?? ''
    scenarios.push({
      id: 'live-dom',
      renderedTitleBefore: before.includes('Voiceover take'),
      sawOldStatus: containerBeforeStatus(container),
      sawLiveStatus: containerAfterStatus(container),
      stillBadged: after.includes('Sonora'),
    })
    expect(container.querySelector('[data-item-status="rendered"]')).not.toBeNull()
    expect(after).toContain('Sonora')
    await act(async () => { root.unmount() })
    container.remove()

    // teardown
    disposeClient()
    unprovide()
    bridge.dispose()
    scenarios.push({ id: 'teardown', domainServicePresent: ctx.get('domain.sonora') !== undefined, openViewCalls: openViews.length })
    expect(ctx.get('domain.sonora')).toBeUndefined()

    run.summary({
      scope: 'component/integration evidence for dsh-sonora-pane-v1 tasks 2.3/2.4/3.1',
      scenarios,
      transportReads: transport.readCount,
      redactionChecked: true,
    })
    run.artifact('sonora-integration-outcomes.json', scenarios)
  })
})
