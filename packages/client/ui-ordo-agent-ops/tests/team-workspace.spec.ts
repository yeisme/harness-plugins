import { describe, expect, it } from 'vitest'
import {
  appendRoomEntry,
  ordoTeamGraph,
  ordoTeamInspector,
  ordoTeamRelationList,
  ordoTeamTaskQueue,
  resolveOrdoTeamLayout,
  sanitizeRoomBody,
  type OrdoTeamRoomEntryV1,
} from '../src/client/team-workspace.ts'
import type { OrdoTeamSnapshotV1 } from '@yeisme/dsh-ordo-agent-ops/host'

function snapshot(): OrdoTeamSnapshotV1 {
  return {
    schemaVersion: 'ordo.team.snapshot.v1alpha1',
    teamRef: 'team:1',
    contextRevision: 3,
    generation: 2,
    cursor: 41,
    freshness: 'fresh',
    safeMessage: 'ok',
    tasks: [
      { taskRef: 'task:2', title: 'Cut scene', state: 'blocked', criticality: 'normal', deliveryRef: 'd:1', blockerCount: 2, assigneeRef: undefined },
      { taskRef: 'task:1', title: 'Outline', state: 'running', criticality: 'critical', deliveryRef: 'd:1', blockerCount: 0, assigneeRef: 'agent:old' },
      { taskRef: 'task:3', title: 'Ship', state: 'completed', criticality: 'normal', deliveryRef: 'd:1', blockerCount: 0, assigneeRef: 'agent:1' },
    ],
    assignments: [
      { assignmentRef: 'asg:1', agentRef: 'agent:1', taskRef: 'task:1', role: 'writer', holder: true },
      { assignmentRef: 'asg:2', agentRef: 'agent:2', taskRef: 'task:2', role: 'reviewer', holder: false },
      { assignmentRef: 'asg:3', agentRef: 'agent:3', taskRef: 'task:3', role: 'observer', holder: false },
    ],
    actions: [],
  } as unknown as OrdoTeamSnapshotV1
}

describe('responsive layout (§3.2)', () => {
  it('three breakpoints map to the designed modes', () => {
    expect(resolveOrdoTeamLayout(1280)).toBe('three-column')
    expect(resolveOrdoTeamLayout(1024)).toBe('three-column')
    expect(resolveOrdoTeamLayout(1023)).toBe('drawer')
    expect(resolveOrdoTeamLayout(768)).toBe('drawer')
    expect(resolveOrdoTeamLayout(767)).toBe('readable-list')
    expect(resolveOrdoTeamLayout(390)).toBe('readable-list')
  })
})

describe('Task Queue (§3.1)', () => {
  it('ranks critical first, then blocked, with stable ref order', () => {
    const rows = ordoTeamTaskQueue(snapshot())
    expect(rows.map(row => row.taskRef)).toEqual(['task:1', 'task:2', 'task:3'])
    expect(rows[0]).toMatchObject({ order: 1, criticality: 'critical' })
    expect(rows[1]).toMatchObject({ state: 'blocked', blockerCount: 2 })
  })
  it('empty projection yields no rows', () => {
    expect(ordoTeamTaskQueue(undefined)).toEqual([])
  })
})

describe('graph partitions and edges (§3.3)', () => {
  it('tasks partition by state lane; agents by role; clusterable only completed/observer', () => {
    const { nodes } = ordoTeamGraph(snapshot())
    const task = nodes.find(node => node.id === 'task:1')!
    expect(task.partition).toBe('task:running')
    expect(nodes.find(node => node.id === 'task:3')?.clusterable).toBe(true)
    expect(nodes.find(node => node.id === 'task:1')?.clusterable).toBe(false)
    expect(nodes.find(node => node.id.startsWith('agent:1'))?.partition).toBe('agent:writer')
    expect(nodes.find(node => node.id.startsWith('agent:3'))?.clusterable).toBe(true)
  })
  it('assignment edges cross partitions; handoff edges appear on assignee mismatch', () => {
    const { edges } = ordoTeamGraph(snapshot())
    expect(edges.some(edge => edge.kind === 'assignment' && edge.to === 'task:1')).toBe(true)
    expect(edges.some(edge => edge.kind === 'handoff')).toBe(true)
  })
  it('every edge has an equivalent semantic text line', () => {
    const lines = ordoTeamRelationList(snapshot())
    expect(lines.length).toBeGreaterThanOrEqual(ordoTeamGraph(snapshot()).edges.length)
    expect(lines.some(line => line.includes('assignment'))).toBe(true)
  })
})

describe('Inspector (§3.1)', () => {
  it('projects selected task with holders and bounded blockers', () => {
    expect(ordoTeamInspector(snapshot(), 'task:1')).toMatchObject({ title: 'Outline', holders: ['agent:1'] })
    expect(ordoTeamInspector(snapshot(), 'task:2')?.blockers).toHaveLength(2)
    expect(ordoTeamInspector(snapshot(), 'task:none')).toBeUndefined()
    expect(ordoTeamInspector(undefined, 'task:1')).toBeUndefined()
  })
})

describe('Room surface (§3.4)', () => {
  it('sanitizes bodies: empty, oversized, and unsafe text are refused', () => {
    expect(sanitizeRoomBody('  ')).toBeUndefined()
    expect(sanitizeRoomBody('x'.repeat(3_000))?.length).toBe(2_000)
    expect(sanitizeRoomBody('see https://evil.example')).toBeUndefined()
    expect(sanitizeRoomBody('Bearer token:x')).toBeUndefined()
    expect(sanitizeRoomBody('正常消息')).toBe('正常消息')
  })
  it('entries are bounded and ordered', () => {
    let entries: readonly OrdoTeamRoomEntryV1[] = []
    for (let i = 0; i < 220; i += 1) {
      entries = appendRoomEntry(entries, { kind: 'post', author: 'agent:1', body: 'hi' }, i)
    }
    expect(entries).toHaveLength(200)
    expect(entries.at(-1)?.id).toBe('room:219')
  })
})

import { reduceOrdoTeamPalette, shouldRefetchOnReceipt, type OrdoTeamPaletteStateV1 } from '../src/client/team-workspace.ts'

describe('Owner Action Palette flow (§3.4)', () => {
  const initial: OrdoTeamPaletteStateV1 = { pending: undefined, lastReceiptRef: undefined }
  const request = { actionId: 'handoff-1', targetRef: 'task:1', idempotencyKey: 'key-12345678', contextRevision: 3 }

  it('request arms a pending preview; confirm converts to a receipt', () => {
    const armed = reduceOrdoTeamPalette(initial, { type: 'request', request })
    expect(armed.pending).toEqual(request)
    const confirmed = reduceOrdoTeamPalette(armed, { type: 'confirmed', receiptRef: 'receipt:1' })
    expect(confirmed).toEqual({ pending: undefined, lastReceiptRef: 'receipt:1' })
  })

  it('control loss and dismissal close a pending confirmation; stale revisions invalidate it', () => {
    const armed = reduceOrdoTeamPalette(initial, { type: 'request', request })
    expect(reduceOrdoTeamPalette(armed, { type: 'control_lost' }).pending).toBeUndefined()
    const reArmed = reduceOrdoTeamPalette(initial, { type: 'request', request })
    expect(reduceOrdoTeamPalette(reArmed, { type: 'revision_changed', revision: 4 }).pending).toBeUndefined()
    expect(reduceOrdoTeamPalette(reArmed, { type: 'revision_changed', revision: 3 }).pending).toEqual(request)
    expect(reduceOrdoTeamPalette(initial, { type: 'dismiss' })).toBe(initial)
  })

  it('receipt-driven refresh fires only for new receipts', () => {
    const state = reduceOrdoTeamPalette(initial, { type: 'receipt', receiptRef: 'receipt:1' })
    expect(shouldRefetchOnReceipt(state, 'receipt:1')).toBe(false)
    expect(shouldRefetchOnReceipt(state, 'receipt:2')).toBe(true)
  })
})

describe('a11y golden journeys (§4.1)', () => {
  it('keyboard path: tab → queue → relation list → inspector covers every fact without the graph', () => {
    const snapshotOf = snapshot
    const queue = ordoTeamTaskQueue(snapshotOf())
    const relations = ordoTeamRelationList(snapshotOf())
    let inspected = 0
    for (const row of queue) {
      if (ordoTeamInspector(snapshotOf(), row.taskRef) !== undefined) inspected += 1
    }
    expect(inspected).toBe(queue.length)
    expect(relations.length).toBeGreaterThanOrEqual(1)
  })
  it('status is never color-only: rows carry textual state and criticality', () => {
    const rows = ordoTeamTaskQueue(snapshot())
    for (const row of rows) {
      expect(row.state).toMatch(/pending|assigned|running|blocked|completed/)
      expect(['normal', 'critical']).toContain(row.criticality)
      expect(typeof row.blockerCount).toBe('number')
    }
  })
  it('degraded states stay readable: empty projection yields empty surfaces, not errors', () => {
    expect(() => ordoTeamTaskQueue(undefined)).not.toThrow()
    expect(() => ordoTeamGraph(undefined)).not.toThrow()
    expect(() => ordoTeamRelationList(undefined)).not.toThrow()
    expect(() => ordoTeamInspector(undefined, 'x')).not.toThrow()
  })
})
