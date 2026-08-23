import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DomainOwnerSourceBridge } from '../src/owner-source.ts'
import { ordoSnapshotToDomain, createOrdoOwnerTransport, ordoSubagentDeepLink, type OrdoAgentOpsSnapshotLike } from '../src/ordo.ts'
import { DomainPaneView } from '../src/view.ts'
import type { DomainSnapshotV1 } from '../src/snapshot.ts'

const context = { workspaceRef: 'workspace:ordo-demo', sessionRef: 'session:one', principalRef: 'principal:local', revision: '1' }

function teamSnapshot(): OrdoAgentOpsSnapshotLike {
  return {
    state: 'ready',
    freshness: 'fresh',
    run: {
      runRef: 'run:team-1',
      safeTitle: 'Team run',
      state: 'running',
      taskCount: 1000,
      completedTaskCount: 4,
      attentionCount: 1,
    },
    tasks: [
      { ref: 'task:dag-1', title: 'Render scene 1', state: 'completed', kind: 'task', summary: 'node of owner DAG' },
      { ref: 'session:dsh-child', title: 'Session child run', state: 'running', kind: 'session', link: { kind: 'subagent.session', ref: 'session:dsh-child' } },
      { ref: 'attempt:1', title: 'Attempt 1 (timeout, not stopped)', state: 'timeout', kind: 'attempt' },
      { ref: 'lease:worktree-1', title: 'Lease held by worker', state: 'held', kind: 'lease' },
      { ref: 'approval:1', title: 'Approval pending', state: 'approval_required', kind: 'approval' },
      { ref: 'verification:1', title: 'Verification evidence', state: 'passed', kind: 'verification' },
      { ref: 'evidence:1', title: 'Run evidence bundle', state: 'sealed', kind: 'evidence' },
    ],
    actions: [{ actionType: 'ordo.reconcile.request' }, { actionType: 'run.launch' }],
  }
}

function ordoEvent(sequence: number, entityRef: string, eventType: string, summary: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    eventRef: `event:${sequence}`,
    streamRef: 'stream:ordo-team-1',
    sequence,
    cursor: `c${sequence}`,
    occurredAt: '2026-08-22T00:00:00Z',
    observedAt: '2026-08-22T00:00:00Z',
    entityRef,
    entityVersion: sequence + 1,
    eventType,
    safeDeltaOrSummary: summary,
    evidenceRefs: [],
    context: { tenantRef: 'tenant-1', workspaceRef: 'workspace:ordo-demo', principalRef: 'principal-1', contextRevision: 1, installationRef: 'installation-1' },
    membershipRevision: 1,
    pluginReleaseDigest: 'a'.repeat(8),
    ordoContractDigest: 'b'.repeat(8),
    runtimeGeneration: 'gen-1',
    ...overrides,
  }
}

describe('ordoSnapshotToDomain owner facets', () => {
  it('passes owner DAG/task/session/attempt/lease/approval/verification/evidence items through without recomputing runnable', () => {
    const domain = ordoSnapshotToDomain(teamSnapshot())
    const kinds = domain.items.map(item => item.kind)
    expect(kinds).toEqual(['task', 'session', 'attempt', 'lease', 'approval', 'verification', 'evidence'])
    expect(domain.items.find(item => item.kind === 'attempt')?.status).toBe('timeout')
    expect(domain.allowedActions.map(action => action.id)).toEqual(['ordo.reconcile.request'])
  })
})

describe('createOrdoOwnerTransport', () => {
  function mount(events: { subscribe(listener: (event: unknown) => void): () => void }) {
    const transport = createOrdoOwnerTransport({ context, readSnapshot: teamSnapshot, events })
    const bridge = new DomainOwnerSourceBridge('ordo', transport)
    bridge.open()
    return { bridge, transport }
  }

  it('derives the live snapshot from the Ordo owner snapshot exactly once', () => {
    const { bridge } = mount({ subscribe: () => () => {} })
    const snapshot = bridge.getSnapshot()
    expect(snapshot.owner).toBe('ordo')
    expect(snapshot.status).toBe('ready')
    expect(snapshot.freshness).toBe('fresh')
    expect(snapshot.items.map(item => item.ref)).toContain('task:dag-1')
    expect(snapshot.allowedActions).toEqual([{ id: 'ordo.reconcile.request', gated: true }])
    bridge.dispose()
  })

  it('maps owner push events to protocol envelopes and keeps the pane live', () => {
    const listeners = new Set<(event: unknown) => void>()
    const { bridge } = mount({ subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } } })
    for (const listener of [...listeners]) {
      listener(ordoEvent(0, 'task:dag-2', 'task.completed', 'Task dag-2 completed by owner'))
    }
    const snapshot = bridge.getSnapshot()
    expect(snapshot.status).toBe('ready')
    expect(snapshot.timeline?.at(-1)).toMatchObject({ summary: 'Task dag-2 completed by owner' })
    bridge.dispose()
  })

  it('degrades authority drift (membership/contract generation change) to reconcile_required', () => {
    const listeners = new Set<(event: unknown) => void>()
    const { bridge } = mount({ subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } } })
    for (const listener of [...listeners]) {
      listener(ordoEvent(0, 'task:dag-2', 'task.completed', 'drifted', {
        context: { tenantRef: 'tenant-1', workspaceRef: 'workspace:ordo-demo', principalRef: 'principal-1', contextRevision: 2, installationRef: 'installation-1' },
      }))
    }
    expect(bridge.getSnapshot().status).toBe('reconcile_required')
    expect(bridge.getSnapshot().reconcileReason).toBe('context_changed')
    bridge.dispose()
  })

  it('goes offline when the owner event channel drops', () => {
    let offline: (() => void) | undefined
    const { bridge } = mount({ subscribe: () => () => {}, onUnavailable: listener => { offline = listener; return () => { offline = undefined } } })
    offline?.()
    expect(bridge.getSnapshot().status).toBe('offline')
    bridge.dispose()
  })

  it('shows honest freshness, never fake realtime, when only the snapshot exists', () => {
    const stale = ordoSnapshotToDomain({ ...teamSnapshot(), state: 'stale', freshness: 'stale' })
    expect(stale.status).toBe('stale')
    expect(stale.freshness).toBe('stale')
  })
})

describe('ordo Subagent typed deep-link', () => {
  it('builds a typed open request for an owner-linked session child', () => {
    const domain = ordoSnapshotToDomain(teamSnapshot())
    const sessionItem = domain.items.find(item => item.kind === 'session')
    expect(ordoSubagentDeepLink(sessionItem!)).toEqual({
      kind: 'subagent.monitor',
      resourceKey: 'subagent:session:dsh-child',
      role: 'navigator',
      preferredRegion: 'right',
      retention: 'keep-alive',
      singleton: true,
      pinned: true,
      title: 'Agents',
    })
  })

  it('returns undefined for items the owner did not link (no dead buttons)', () => {
    const domain = ordoSnapshotToDomain(teamSnapshot())
    const taskItem = domain.items.find(item => item.kind === 'task')
    expect(ordoSubagentDeepLink(taskItem!)).toBeUndefined()
  })

  it('does not mutate the Ordo run projection when the link is used', () => {
    const domain = ordoSnapshotToDomain(teamSnapshot())
    const before: DomainSnapshotV1 = domain
    const sessionItem = domain.items.find(item => item.kind === 'session')
    ordoSubagentDeepLink(sessionItem!)
    expect(domain).toBe(before)
    expect(domain.items.find(item => item.kind === 'run')?.status ?? domain.status).toBe('ready')
  })
})

describe('Ordo Team view virtualization and live chrome', () => {
  it('bounds the DOM for 1,000 owner tasks while reporting the true count', () => {
    const items = Array.from({ length: 1_000 }, (_, index) => ({
      ref: `task:${index + 1}`,
      title: `Task ${index + 1}`,
      version: '1',
      kind: 'task',
      status: 'ready',
    }))
    const html = renderToStaticMarkup(createElement(DomainPaneView, {
      snapshot: { owner: 'ordo', status: 'ready', freshness: 'fresh', items, allowedActions: [] },
    }))
    expect(html).toContain('aria-rowcount="1000"')
    expect(html).toContain('data-virtualized')
    expect(html).not.toContain('Task 81</li>')
    expect(html).not.toContain('Task 1000')
  })

  it('renders live timeline and freshness without pretending realtime when there is none', () => {
    const live: DomainSnapshotV1 = {
      owner: 'ordo',
      status: 'ready',
      freshness: 'fresh',
      items: [],
      allowedActions: [],
      timeline: [{ summary: 'Task dag-2 completed by owner' }],
    }
    const html = renderToStaticMarkup(createElement(DomainPaneView, { snapshot: live }))
    expect(html).toContain('data-freshness="fresh"')
    expect(html).toContain('Task dag-2 completed by owner')

    const cold: DomainSnapshotV1 = { owner: 'ordo', status: 'stale', freshness: 'stale', items: [], allowedActions: [] }
    const coldHtml = renderToStaticMarkup(createElement(DomainPaneView, { snapshot: cold }))
    expect(coldHtml).toContain('data-freshness="stale"')
    expect(coldHtml).not.toContain('data-live-timeline')
  })

  it('exposes an owner-linked session deep-link button that never mutates run state', () => {
    const domain = ordoSnapshotToDomain(teamSnapshot())
    let opened: unknown
    const html = renderToStaticMarkup(createElement(DomainPaneView, {
      snapshot: domain,
      onDeepLink: item => { opened = ordoSubagentDeepLink(item) },
    }))
    expect(html).toContain('data-deep-link="subagent.session"')
    expect(html.match(/data-deep-link/g)?.length).toBe(1)
    // handler 合同：只产生 typed open request，不改 snapshot
    const sessionItem = domain.items.find(item => item.kind === 'session')
    const event = { item: sessionItem }
    ;(html, event)
    expect(opened).toBeUndefined()
    expect(ordoSubagentDeepLink(sessionItem!)).toMatchObject({ kind: 'subagent.monitor' })
  })
})
