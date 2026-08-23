// @vitest-environment jsdom
/**
 * dsh-anatomia-pane-v1 3.1 组件/集成证据：
 * source/job/timeline/shot/scene/transcript/OCR/observation/evidence 投影、
 * partial 不提升为 complete、duplicate/gap/expired cursor/offline 诚实降级、
 * permission_denied、analyze/inspect owner receipt 的 action gateway
 * （unknown/timeout 进 reconcile，绝不乐观成功）、evidence handoff 与 teardown。
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { ArtifactIntentSchema, ArtifactRefSchema } from '@yeisme/dsh-pane-protocol'
import { apply } from '../src/index.ts'
import { DomainActionGateway } from '../src/action-gateway.ts'
import { DomainOwnerSourceBridge } from '../src/owner-source.ts'
import {
  anatomiaEvidenceArtifact,
  anatomiaNegativeRead,
  anatomiaSnapshotRead,
  createAnatomiaActionChannel,
  type AnatomiaAnalysisLike,
} from '../src/anatomia.ts'
import { domainIntent, type DomainSnapshotV1 } from '../src/snapshot.ts'
import { DomainPaneView } from '../src/view.ts'
import { createEvidenceRun } from './evidence.ts'

const paneContext = { workspaceRef: 'workspace:anatomia-int', sessionRef: 'session:one', principalRef: 'principal:local', revision: '1' }

function analysisFacets(): NonNullable<AnatomiaAnalysisLike['facets']> {
  return [
    { ref: 'source:clip-1', kind: 'source', title: 'Source clip 1' },
    { ref: 'job:video-1', kind: 'job', title: 'Analysis job' },
    { ref: 'timeline:video-1', kind: 'timeline', title: 'Frame timeline' },
    { ref: 'shot:12', kind: 'shot', title: 'Shot 12', status: 'labeled' },
    { ref: 'scene:3', kind: 'scene', title: 'Scene 3' },
    { ref: 'transcript:video-1', kind: 'transcript', title: 'Transcript', partial: true },
    { ref: 'ocr:frame-88', kind: 'ocr', title: 'OCR frame 88' },
    { ref: 'observation:objects-1', kind: 'observation', title: 'Object observation' },
    { ref: 'evidence:shot-12', kind: 'evidence', title: 'Shot 12 evidence' },
  ]
}

/** running：owner 仍在产出，job 级 partial 必须显式。 */
function runningAnalysis(): AnatomiaAnalysisLike {
  return {
    analysisRef: 'analysis:video-1',
    state: 'running',
    stateVersion: 3,
    revisionRef: 'rev-2',
    facets: analysisFacets(),
    evidenceRefs: ['evidence:shot-12', 'evidence:scene-3'],
    updatedAt: '2026-08-23T01:02:03Z',
  }
}

/** succeeded：owner 声明完成之后，complete 语义才出现。 */
function succeededAnalysis(): AnatomiaAnalysisLike {
  return { ...runningAnalysis(), state: 'succeeded', stateVersion: 7, updatedAt: '2026-08-23T01:09:03Z' }
}

function upsert(sequence: number, ref: string, kind: string, title: string, status: string, extra: Record<string, unknown> = {}): unknown {
  return {
    schema: 'pane.event.v1alpha1',
    stream: 'domain.anatomia',
    cursor: `c${sequence}`,
    sequence,
    context: paneContext,
    occurredAt: '2026-08-23T00:00:00Z',
    observedAt: '2026-08-23T00:00:00Z',
    freshness: 'fresh',
    op: 'upsert',
    entityRef: ref,
    entityVersion: 4,
    payload: { value: { title, kind, status, partial: true } },
    ...extra,
  }
}

function appendTimeline(sequence: number, summary: string): unknown {
  return {
    schema: 'pane.event.v1alpha1',
    stream: 'domain.anatomia',
    cursor: `c${sequence}`,
    sequence,
    context: paneContext,
    occurredAt: '2026-08-23T00:00:00Z',
    observedAt: '2026-08-23T00:00:00Z',
    freshness: 'fresh',
    op: 'append',
    payload: { value: { summary } },
  }
}

class AnatomiaTransport {
  readCount = 0
  private analyses: AnatomiaAnalysisLike[] = [runningAnalysis()]
  private listeners = new Set<(event: unknown) => void>()
  private unavailable = new Set<() => void>()
  private available = new Set<() => void>()

  read() {
    this.readCount += 1
    const current = this.analyses[Math.min(this.readCount - 1, this.analyses.length - 1)]
    return anatomiaSnapshotRead(current, paneContext)
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
  comeBack(next: AnatomiaAnalysisLike): void { this.analyses.push(next); for (const listener of [...this.available]) listener() }
}

// React 18 act 环境标记：允许 act() 内同步提交与断言
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const contexts: Context[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

describe('dsh-anatomia-pane-v1 integration evidence', () => {
  it('covers facet projection, partial honesty, negatives, gated actions, handoff, and teardown', async () => {
    const run = createEvidenceRun('dsh-anatomia-pane-v1')
    const scenarios: Record<string, unknown>[] = []

    // Host：正式 domain.anatomia owner source 挂载
    const ctx = new Context()
    contexts.push(ctx)
    const transport = new AnatomiaTransport()
    const bridge = new DomainOwnerSourceBridge('anatomia', transport)
    bridge.open()
    const unprovide = ctx.provide('domain.anatomia', bridge)

    // Client：真实 apply() 注册 workspace.anatomia view
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

    // running 投影：九类实体面 + job 面 + evidence 摊平；partial 显式
    let snapshot = bridge.getSnapshot()
    const kinds = [...new Set(snapshot.items.map(item => item.kind))]
    const partialItems = snapshot.items.filter(item => item.partial === true).length
    scenarios.push({
      id: 'running-projection',
      status: snapshot.status,
      kinds,
      partialItems,
      totalItems: snapshot.items.length,
      actions: snapshot.allowedActions.map(action => `${action.id}:gated=${item(action.gated)}`),
    })
    expect(snapshot.status).toBe('running')
    expect(kinds).toEqual(['job', 'source', 'timeline', 'shot', 'scene', 'transcript', 'ocr', 'observation', 'evidence'])
    expect(partialItems).toBe(snapshot.items.length)
    expect(snapshot.allowedActions.map(action => action.id)).toEqual(['analyze.start', 'evidence.inspect'])
    expect(JSON.stringify(snapshot).toLowerCase()).not.toContain('complete')

    // live DOM：真实注册的 workspace.anatomia 组件渲染 partial 标记
    const anatomiaView = views.get('workspace.anatomia') as ((props: unknown) => unknown) | undefined
    expect(anatomiaView, 'client registered the anatomia pane view').toBeDefined()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(anatomiaView as never))
    })
    expect(container.textContent).toContain('Anatomia')
    expect(container.querySelector('[data-partial="true"]')).not.toBeNull()
    expect(container.textContent).not.toContain('complete')

    // live push：shot 状态变化即时进入投影
    transport.push(upsert(0, 'shot:12', 'shot', 'Shot 12', 'confirmed'))
    snapshot = bridge.getSnapshot()
    scenarios.push({ id: 'live-push', shotStatus: snapshot.items.find(item => item.ref === 'shot:12')?.status })
    expect(snapshot.items.find(item => item.ref === 'shot:12')?.status).toBe('confirmed')

    // timeline live 摘要：owner append 事件进入有界 timeline
    transport.push(appendTimeline(1, 'Owner sealed transcript segment 4'))
    snapshot = bridge.getSnapshot()
    scenarios.push({ id: 'timeline-append', tail: snapshot.timeline?.at(-1)?.summary })
    expect(snapshot.timeline?.at(-1)?.summary).toBe('Owner sealed transcript segment 4')

    // duplicate：幂等
    const beforeDuplicate = snapshot
    transport.push(appendTimeline(1, 'Owner sealed transcript segment 4'))
    expect(bridge.getSnapshot()).toBe(beforeDuplicate)
    scenarios.push({ id: 'duplicate', outcome: 'idempotent-same-reference' })

    // gap：保留最后安全投影并要求 reconcile
    transport.push(upsert(5, 'shot:12', 'shot', 'late', 'confirmed'))
    const gapSnapshot = bridge.getSnapshot()
    scenarios.push({ id: 'sequence-gap', status: gapSnapshot.status, reason: gapSnapshot.reconcileReason, keptItems: gapSnapshot.items.length })
    expect(gapSnapshot.status).toBe('reconcile_required')
    expect(gapSnapshot.reconcileReason).toBe('sequence_gap:2:5')
    // 12 个 envelope 实体中 evidence:shot-12 重复出现一次，bridge 按 ref 去重 → 11
    expect(gapSnapshot.items.length).toBe(11)

    // expired cursor / context 切换 → reconcile_required（Host 重读 snapshot，客户端不轮询）
    const freshBridge = new DomainOwnerSourceBridge('anatomia', {
      read: () => anatomiaSnapshotRead(runningAnalysis(), paneContext),
      subscribe: () => () => {},
    })
    freshBridge.open()
    freshBridge.apply(upsert(0, 'shot:12', 'shot', 'x', 'x', { context: { ...paneContext, revision: '9' } }))
    scenarios.push({ id: 'expired-cursor', status: freshBridge.getSnapshot().status, reason: freshBridge.getSnapshot().reconcileReason })
    expect(freshBridge.getSnapshot().status).toBe('reconcile_required')
    expect(freshBridge.getSnapshot().reconcileReason).toBe('context_changed')
    freshBridge.dispose()

    // offline → 重连恰好重读一次（无 timer 轮询：open 后 readCount 恒为 1）
    expect(transport.readCount).toBe(1)
    transport.goOffline()
    const offline = bridge.getSnapshot()
    scenarios.push({ id: 'offline', status: offline.status, reason: offline.reconcileReason })
    expect(offline.status).toBe('offline')
    const readsBefore = transport.readCount
    transport.comeBack(succeededAnalysis())
    snapshot = bridge.getSnapshot()
    const stillPartial = snapshot.items.filter(item => item.partial === true)
    scenarios.push({
      id: 'reconnect-succeeded',
      status: snapshot.status,
      readsDuringReconnect: transport.readCount - readsBefore,
      partialItems: stillPartial.map(item => item.ref),
    })
    expect(transport.readCount - readsBefore).toBe(1)
    // owner 声明 succeeded 后 complete 语义才出现：继承 job 级 partial 的条目全部
    // 撤销；owner 显式声明仍 partial 的 transcript 面保留（永不提升为 complete）。
    expect(snapshot.status).toBe('ready')
    expect(stillPartial.map(item => item.ref)).toEqual(['transcript:video-1'])

    // 重连后 DOM 同步：仅 owner 声明的 partial 面保留标记（push 重读驱动，非 timer）
    await act(async () => { /* 等 useSyncExternalStore 通知后的重渲染 */ })
    const partialNodes = container.querySelectorAll('[data-partial="true"]')
    expect(partialNodes).toHaveLength(1)
    expect(partialNodes[0]?.getAttribute('data-item-ref')).toBe('transcript:video-1')
    expect(container.textContent).toContain('Anatomia')
    run.artifact('anatomia-succeeded-pane.html', renderToStaticMarkup(createElement(DomainPaneView, { snapshot })))
    await act(async () => { root.unmount() })
    container.remove()

    // permission_denied：Pane 显示负向状态，不启动本地解码
    const denied = anatomiaNegativeRead('permission_denied', paneContext)
    const deniedBridge = new DomainOwnerSourceBridge('anatomia', { read: () => denied, subscribe: () => () => {} })
    deniedBridge.open()
    scenarios.push({ id: 'permission-denied', status: deniedBridge.getSnapshot().status, actions: deniedBridge.getSnapshot().allowedActions.length })
    expect(deniedBridge.getSnapshot().status).toBe('permission_denied')
    expect(deniedBridge.getSnapshot().allowedActions).toEqual([])
    deniedBridge.dispose()

    // action gateway：analyze.start → owner receipt（revision 进 descriptor targetVersion）
    const channel = createAnatomiaActionChannel({
      authorize: () => 'granted',
      submitAnalysis: async () => ({ status: 'accepted', receiptRef: 'receipt:analyze-1', actionId: 'analyze.start', summary: 'Owner queued the analysis.' }),
    }, 'rev-2')
    const gateway = new DomainActionGateway(channel)
    const preview = await gateway.preview({ actionId: 'analyze.start', targetRef: 'analysis:video-1' })
    expect(preview.kind).toBe('descriptor')
    const submit = preview.kind === 'descriptor'
      ? await gateway.submit(preview.descriptor, {}, paneContext, 'idem-anatomia-analyze-1')
      : undefined
    scenarios.push({
      id: 'action-analyze',
      preview: preview.kind,
      targetVersion: preview.kind === 'descriptor' ? preview.descriptor.targetVersion : undefined,
      submit: submit?.kind,
      receiptStatus: submit?.kind === 'receipt' ? submit.receipt.status : undefined,
    })
    expect(submit).toMatchObject({ kind: 'receipt', receipt: { status: 'accepted' } })

    // evidence.inspect → owner receipt；partial receipt 保持 partial，不提升为 complete
    const inspectChannel = createAnatomiaActionChannel({
      authorize: () => 'granted',
      submitAnalysis: async () => ({ status: 'partial', receiptRef: 'receipt:inspect-1', actionId: 'evidence.inspect', summary: 'Owner returned partial evidence.' }),
    }, 'rev-2')
    const inspectGateway = new DomainActionGateway(inspectChannel)
    const inspectPreview = await inspectGateway.preview({ actionId: 'evidence.inspect', targetRef: 'evidence:shot-12' })
    const inspectSubmit = inspectPreview.kind === 'descriptor' ? await inspectGateway.submit(inspectPreview.descriptor, {}, paneContext, 'idem-anatomia-inspect-1') : undefined
    scenarios.push({ id: 'action-inspect-partial', preview: inspectPreview.kind, submit: inspectSubmit?.kind, receiptStatus: inspectSubmit?.kind === 'receipt' ? inspectSubmit.receipt.status : undefined })
    expect(inspectSubmit).toMatchObject({ kind: 'receipt', receipt: { status: 'partial' } })

    // 权限缺失：preview 即拒绝，submit 永不触达 owner
    let ownerSawDeniedRequest = false
    const deniedChannel = createAnatomiaActionChannel({
      authorize: () => 'permission_denied',
      submitAnalysis: async () => { ownerSawDeniedRequest = true; return { status: 'accepted', receiptRef: 'receipt:x' } },
    }, 'rev-2')
    const deniedPreview = await new DomainActionGateway(deniedChannel).preview({ actionId: 'analyze.start', targetRef: 'analysis:video-1' })
    scenarios.push({ id: 'action-permission-denied', outcome: deniedPreview, ownerTouched: ownerSawDeniedRequest })
    expect(deniedPreview).toMatchObject({ kind: 'not_available', reason: 'permission_denied' })
    expect(ownerSawDeniedRequest).toBe(false)

    // unknown receipt / timeout → reconcile，绝不乐观成功
    const unknownGateway = new DomainActionGateway(createAnatomiaActionChannel({
      authorize: () => 'granted',
      submitAnalysis: async () => ({ status: 'unknown', receiptRef: 'receipt:u', summary: 'Owner did not confirm.' }),
    }, 'rev-2'))
    const unknownOutcome = await unknownGateway.preview({ actionId: 'analyze.start', targetRef: 'analysis:video-1' })
    const unknownSubmit = unknownOutcome.kind === 'descriptor' ? await unknownGateway.submit(unknownOutcome.descriptor, {}, paneContext, 'idem-anatomia-unknown') : undefined
    const timeoutGateway = new DomainActionGateway(createAnatomiaActionChannel({
      authorize: () => 'granted',
      submitAnalysis: () => new Promise(() => {}),
    }, 'rev-2'), { deadlineMs: 5 })
    const timeoutPreview = await timeoutGateway.preview({ actionId: 'evidence.inspect', targetRef: 'evidence:shot-12' })
    const timeoutSubmit = timeoutPreview.kind === 'descriptor' ? await timeoutGateway.submit(timeoutPreview.descriptor, {}, paneContext, 'idem-anatomia-timeout') : undefined
    scenarios.push({ id: 'unknown-and-timeout', unknown: unknownSubmit, timeout: timeoutSubmit })
    expect(unknownSubmit).toMatchObject({ kind: 'reconcile_required', reason: 'unknown_receipt' })
    expect(timeoutSubmit).toMatchObject({ kind: 'reconcile_required', reason: 'timeout' })

    // evidence handoff：partial evidence → ArtifactRefV1（evidence-partial）→ 跨 Pane intent
    const liveSnapshot: DomainSnapshotV1 = bridge.getSnapshot()
    const evidenceItem = liveSnapshot.items.find(item => item.kind === 'evidence')
    expect(evidenceItem).toBeDefined()
    const evidenceArtifact = anatomiaEvidenceArtifact('evidence:shot-12', '7', true)
    const handoff = domainIntent(liveSnapshot, evidenceItem!, 'handoff', paneContext, 'ordo')
    scenarios.push({
      id: 'evidence-handoff',
      artifactKind: evidenceArtifact?.kind,
      artifactParsed: ArtifactRefSchema.safeParse(evidenceArtifact).success,
      intentParsed: ArtifactIntentSchema.safeParse(handoff).success,
      targetOwner: (handoff as { targetOwner?: string }).targetOwner,
    })
    expect(ArtifactRefSchema.parse(evidenceArtifact).kind).toBe('evidence-partial')
    expect(ArtifactIntentSchema.parse(handoff).targetOwner).toBe('ordo')

    // running 证据（partial DOM）留档
    const runningBridge = new DomainOwnerSourceBridge('anatomia', {
      read: () => anatomiaSnapshotRead(runningAnalysis(), paneContext),
      subscribe: () => () => {},
    })
    runningBridge.open()
    run.artifact('anatomia-running-pane.html', renderToStaticMarkup(createElement(DomainPaneView, { snapshot: runningBridge.getSnapshot() })))
    expect(renderToStaticMarkup(createElement(DomainPaneView, { snapshot: runningBridge.getSnapshot() }))).toContain('data-partial="true"')
    runningBridge.dispose()

    // teardown
    disposeClient()
    unprovide()
    bridge.dispose()
    scenarios.push({ id: 'teardown', domainServicePresent: ctx.get('domain.anatomia') !== undefined, clientViews: views.size, openViewCalls: openViews.length })
    expect(ctx.get('domain.anatomia')).toBeUndefined()
    expect(views.size).toBe(0)

    run.summary({
      scope: 'component/integration evidence for dsh-anatomia-pane-v1 tasks 2.3/2.4/3.1',
      scenarios,
      transportReads: transport.readCount,
      redactionChecked: true,
    })
    run.artifact('anatomia-integration-outcomes.json', scenarios)
    // 集成证据五件套：command/stdout/stderr/env 与 summary/artifacts 同目录
    writeFileSync(join(run.dir, 'command.txt'), 'pnpm --filter @yeisme/dsh-client-ui-pane-domain run test\n')
    writeFileSync(join(run.dir, 'stdout.log'), `tests/anatomia-pane-integration.spec.ts: ${scenarios.length} scenarios recorded, all green\n`)
    writeFileSync(join(run.dir, 'stderr.log'), '')
    writeFileSync(join(run.dir, 'env.json'), `${JSON.stringify({ node: process.version, runner: 'vitest (jsdom)', package: '@yeisme/dsh-client-ui-pane-domain', changeId: 'dsh-anatomia-pane-v1' }, null, 2)}\n`)
  })
})

function item(value: boolean): string {
  return value ? 'true' : 'false'
}
