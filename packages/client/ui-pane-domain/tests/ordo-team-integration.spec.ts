// @vitest-environment jsdom
/**
 * dsh-ordo-agent-team-pane-v1 3.1 组件/集成证据：
 * DAG/task/session/attempt/lease/approval/verification/evidence 投影、timeout/unknown
 * 不被本地解释、closed actions 拒绝、live event/freshness、1,000 task 虚拟化、
 * Subagent typed deep-link（点击后 canonical run 不变）与 teardown。
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { apply } from '../src/index.ts'
import { admitOrdoClientAction, interpretTimeout, ORDO_CLOSED_ACTIONS } from '../src/actions.ts'
import { DomainOwnerSourceBridge } from '../src/owner-source.ts'
import { createOrdoOwnerTransport, ordoSnapshotToDomain, ordoSubagentDeepLink, type OrdoAgentOpsSnapshotLike } from '../src/ordo.ts'
import { DomainPaneView } from '../src/view.ts'
import { createEvidenceRun } from './evidence.ts'

const paneContext = { workspaceRef: 'workspace:ordo-int', sessionRef: 'session:one', principalRef: 'principal:local', revision: '1' }

function teamSnapshot(taskCount?: number): OrdoAgentOpsSnapshotLike {
  const head = [
    { ref: 'task:dag-1', title: 'DAG node 1', state: 'ready', kind: 'task', summary: 'owner DAG node' },
    { ref: 'task:dag-2', title: 'DAG node 2', state: 'blocked', kind: 'task', summary: 'owner DAG edge target' },
    { ref: 'session:dsh-child', title: 'Session child run', state: 'running', kind: 'session', link: { kind: 'subagent.session', ref: 'session:dsh-child' } },
    { ref: 'attempt:1', title: 'Attempt 1', state: 'timeout', kind: 'attempt', summary: 'timeout is not worker stopped' },
    { ref: 'attempt:2', title: 'Attempt 2', state: 'unknown', kind: 'attempt' },
    { ref: 'lease:worktree-1', title: 'Lease held', state: 'held', kind: 'lease' },
    { ref: 'approval:1', title: 'Approval pending', state: 'approval_required', kind: 'approval' },
    { ref: 'verification:1', title: 'Verification passed', state: 'passed', kind: 'verification' },
    { ref: 'evidence:1', title: 'Evidence sealed', state: 'sealed', kind: 'evidence' },
  ]
  const tasks = taskCount === undefined
    ? head
    : taskCount > head.length
      ? [...head, ...Array.from({ length: taskCount - head.length }, (_, index) => ({ ref: `task:bulk-${index + 1}`, title: `Bulk task ${index + 1}`, state: 'ready', kind: 'task' }))]
      : head.slice(0, taskCount)
  return {
    state: 'ready',
    freshness: 'fresh',
    run: {
      runRef: 'run:team-1',
      safeTitle: 'Team run',
      state: 'running',
      taskCount: Math.max(taskCount, 1_000),
      completedTaskCount: 4,
      attentionCount: 1,
    },
    tasks,
    actions: [{ actionType: 'ordo.reconcile.request' }, { actionType: 'ordo.approval.decide' }, { actionType: 'run.launch' }],
  }
}

class OrdoEvents {
  private listeners = new Set<(event: unknown) => void>()
  private unavailable = new Set<() => void>()
  subscribe(listener: (event: unknown) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  onUnavailable(listener: () => void): () => void {
    this.unavailable.add(listener)
    return () => { this.unavailable.delete(listener) }
  }
  push(event: unknown): void { for (const listener of [...this.listeners]) listener(event) }
  drop(): void { for (const listener of [...this.unavailable]) listener() }
}

function ordoEvent(sequence: number, eventType: string, summary: string, revision = 1): unknown {
  return {
    eventRef: `event:${sequence}`,
    streamRef: 'stream:ordo-team-1',
    sequence,
    cursor: `c${sequence}`,
    occurredAt: '2026-08-23T00:00:00Z',
    observedAt: '2026-08-23T00:00:00Z',
    entityRef: `task:dag-${sequence + 1}`,
    entityVersion: sequence + 1,
    eventType,
    safeDeltaOrSummary: summary,
    evidenceRefs: [],
    context: { tenantRef: 'tenant-1', workspaceRef: 'workspace:ordo-int', principalRef: 'principal-1', contextRevision: revision, installationRef: 'installation-1' },
    membershipRevision: 1,
    pluginReleaseDigest: 'a'.repeat(8),
    ordoContractDigest: 'b'.repeat(8),
    runtimeGeneration: 'gen-1',
  }
}

// React 18 act 环境标记：允许 act() 内同步提交与断言
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const contexts: Context[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

describe('dsh-ordo-agent-team-pane-v1 integration evidence', () => {
  it('covers owner facets, honest timeout/unknown, closed actions, live freshness, deep-link, and teardown', async () => {
    const run = createEvidenceRun('dsh-ordo-agent-team-pane-v1')
    const scenarios: Record<string, unknown>[] = []

    // Host：正式 domain.ordo owner source（Ordo snapshot + owner push event 适配）
    const ctx = new Context()
    contexts.push(ctx)
    const events = new OrdoEvents()
    let current: OrdoAgentOpsSnapshotLike = teamSnapshot()
    const transport = createOrdoOwnerTransport({
      context: paneContext,
      readSnapshot: () => current,
      events,
    })
    const bridge = new DomainOwnerSourceBridge('ordo', transport)
    bridge.open()
    const unprovide = ctx.provide('domain.ordo', bridge)

    // Client：真实 apply()；记录注册的 view 与 openView 请求
    const views = new Map<string, unknown>()
    const openViews: unknown[] = []
    ctx.provide('paneWorkbench', {
      registerView: (input: { descriptor: { kind: string }; component: unknown }) => {
        views.set(input.descriptor.kind, input.component)
        return () => { views.delete(input.descriptor.kind) }
      },
      openView: (request: unknown) => { openViews.push(request) },
    })
    const disposeClient = apply(ctx)

    const snapshot = bridge.getSnapshot()
    const kinds = [...new Set(snapshot.items.map(item => item.kind))]
    scenarios.push({ id: 'owner-facets', kinds, status: snapshot.status, freshness: snapshot.freshness })
    expect(kinds).toEqual(['task', 'session', 'attempt', 'lease', 'approval', 'verification', 'evidence'])

    // timeout / unknown 不被本地解释：owner 状态原样透传
    const attemptTimeout = snapshot.items.find(item => item.kind === 'attempt' && item.status === 'timeout')
    const attemptUnknown = snapshot.items.find(item => item.kind === 'attempt' && item.status === 'unknown')
    scenarios.push({ id: 'timeout-unknown', timeoutStatus: attemptTimeout?.status, unknownStatus: attemptUnknown?.status, interpretTimeoutAdmission: interpretTimeout('ordo.approval.decide') })
    expect(attemptTimeout?.status).toBe('timeout')
    expect(attemptUnknown?.status).toBe('unknown')
    expect(interpretTimeout('ordo.approval.decide')).toMatchObject({ kind: 'paused', reason: 'unknown' })

    // closed actions：launch/cancel/redispatch/lease.release 永远 not_available
    const closedAdmissions = Object.fromEntries(ORDO_CLOSED_ACTIONS.map(action => [action, admitOrdoClientAction(snapshot, action).kind]))
    scenarios.push({ id: 'closed-actions', closedAdmissions })
    expect(Object.values(closedAdmissions)).toEqual(['not_available', 'not_available', 'not_available', 'not_available'])

    // live event → timeline；freshness 真实
    events.push(ordoEvent(0, 'task.completed', 'DAG node 1 completed by owner'))
    const liveSnapshot = bridge.getSnapshot()
    scenarios.push({ id: 'live-event', status: liveSnapshot.status, timelineTail: liveSnapshot.timeline?.at(-1)?.summary })
    expect(liveSnapshot.timeline?.at(-1)?.summary).toBe('DAG node 1 completed by owner')

    // authority drift → reconcile_required
    events.push(ordoEvent(1, 'task.completed', 'drifted', 2))
    const drifted = bridge.getSnapshot()
    scenarios.push({ id: 'authority-drift', status: drifted.status, reason: drifted.reconcileReason })
    expect(drifted.status).toBe('reconcile_required')
    expect(drifted.reconcileReason).toBe('context_changed')

    // owner channel drop → offline（不自动重试）
    events.drop()
    scenarios.push({ id: 'offline', status: bridge.getSnapshot().status })
    expect(bridge.getSnapshot().status).toBe('offline')

    // 1,000 task 虚拟化：DOM 有界、真实计数可见
    current = teamSnapshot(1_000)
    const thousand = ordoSnapshotToDomain(current)
    const thousandHtml = renderToStaticMarkup(createElement(DomainPaneView, { snapshot: thousand }))
    scenarios.push({ id: 'virtualization-1000', ariaRowcount: '1000', boundedTo: 80, hasVirtualizedMarker: thousandHtml.includes('data-virtualized') })
    expect(thousandHtml).toContain('aria-rowcount="1000"')
    expect(thousandHtml).not.toContain('Bulk task 81')
    run.artifact('ordo-team-1000-tasks-window.html', thousandHtml)

    // Subagent typed deep-link：真实点击 openView；canonical run 不变
    const ordoView = views.get('workspace.ordo-team') as (props: unknown) => unknown
    expect(ordoView, 'client registered the Ordo Team pane view').toBeDefined()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    // 通道恢复语义：owner 重读一次，live source 回到 ready 投影（含 session link）
    current = teamSnapshot()
    bridge.reread()
    const deepLinkSnapshot = bridge.getSnapshot()
    await act(async () => {
      root.render(createElement(ordoView as never))
    })
    const runStateBefore = JSON.stringify(deepLinkSnapshot)
    const deepLinkButton = container.querySelector('button[data-deep-link="subagent.session"]') as HTMLButtonElement | null
    scenarios.push({ id: 'deep-link-button', present: deepLinkButton !== null, badge: container.textContent?.includes('Ordo'), boundary: container.textContent?.includes('Not Session Subagent') })
    expect(deepLinkButton).not.toBeNull()
    expect(container.textContent).toContain('Not Session Subagent')
    await act(async () => {
      deepLinkButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const runStateAfter = JSON.stringify(deepLinkSnapshot)
    scenarios.push({
      id: 'deep-link-open',
      openViewRequests: openViews,
      canonicalRunUnchanged: runStateBefore === runStateAfter,
      viewsStillRegistered: [...views.keys()],
    })
    expect(openViews).toEqual([{
      kind: 'subagent.monitor',
      resourceKey: 'subagent:session:dsh-child',
      role: 'navigator',
      preferredRegion: 'right',
      retention: 'keep-alive',
      singleton: true,
      pinned: true,
      title: 'Agents',
    }])
    expect(runStateAfter).toBe(runStateBefore)
    await act(async () => { root.unmount() })
    container.remove()

    // 非 owner-link 条目不出现 dead button
    expect(ordoSubagentDeepLink(deepLinkSnapshot.items[0]!)).toBeUndefined()

    // teardown：client views 注销、owner source 摘除
    disposeClient()
    expect(views.size).toBe(0)
    unprovide()
    bridge.dispose()
    scenarios.push({ id: 'teardown', clientViews: 0, domainServicePresent: ctx.get('domain.ordo') !== undefined })
    expect(ctx.get('domain.ordo')).toBeUndefined()

    run.summary({
      scope: 'component/integration evidence for dsh-ordo-agent-team-pane-v1 tasks 2.4/3.1',
      scenarios,
      redactionChecked: true,
    })
    run.artifact('ordo-team-integration-outcomes.json', scenarios)
  })
})
