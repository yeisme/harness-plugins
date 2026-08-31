/**
 * Team collaboration workspace view model (team-hub §3).
 *
 * Pure layout and graph semantics over the Team V1 projection: the Task
 * Queue is the canonical fact surface; the graph partitions tasks by state
 * and agents by role-slot, with assignment/handoff edges crossing partitions
 * and dependencies staying in the task layer. Coordinates/clusters are
 * client view state only; every graph fact keeps an equivalent list/Inspector
 * representation (§3.3 accessibility contract).
 *
 * @module @yeisme/dsh-client-ui-ordo-agent-ops/client
 */
import type { OrdoTeamAssignmentV1, OrdoTeamSnapshotV1, OrdoTeamTaskV1 } from '@yeisme/dsh-ordo-agent-ops/host'

export type OrdoTeamLayoutMode = 'three-column' | 'drawer' | 'readable-list'

/** §3.2 responsive breakpoints: three-column ≥1024, drawer 768–1023, list <768. */
export function resolveOrdoTeamLayout(viewportWidth: number): OrdoTeamLayoutMode {
  if (viewportWidth >= 1024) return 'three-column'
  if (viewportWidth >= 768) return 'drawer'
  return 'readable-list'
}

export interface OrdoTeamTaskQueueRowV1 {
  readonly taskRef: string
  readonly title: string
  readonly state: OrdoTeamTaskV1['state']
  readonly criticality: OrdoTeamTaskV1['criticality']
  readonly blockerCount: number
  readonly assigneeRef: string | undefined
  readonly order: number
}

/** Task Queue rows: criticality first, then blocked, then stable ref order. */
export function ordoTeamTaskQueue(snapshot: OrdoTeamSnapshotV1 | undefined): readonly OrdoTeamTaskQueueRowV1[] {
  if (snapshot === undefined) return []
  return [...snapshot.tasks]
    .sort((left, right) => {
      if (left.criticality !== right.criticality) return left.criticality === 'critical' ? -1 : 1
      const leftBlocked = left.state === 'blocked' ? 1 : 0
      const rightBlocked = right.state === 'blocked' ? 1 : 0
      if (leftBlocked !== rightBlocked) return rightBlocked - leftBlocked
      return left.taskRef.localeCompare(right.taskRef)
    })
    .map((task, index) => ({
      taskRef: task.taskRef,
      title: task.title,
      state: task.state,
      criticality: task.criticality,
      blockerCount: task.blockerCount,
      assigneeRef: task.assigneeRef,
      order: index + 1,
    }))
}

export interface OrdoTeamGraphNodeV1 {
  readonly id: string
  readonly kind: 'task' | 'agent'
  readonly partition: string
  readonly label: string
  readonly clusterable: boolean
}

export interface OrdoTeamGraphEdgeV1 {
  readonly id: string
  readonly from: string
  readonly to: string
  readonly kind: 'assignment' | 'handoff'
}

/**
 * §3.3 graph partitions: tasks by state lane, agents by role slot; active/
 * blocked/critical nodes are never clusterable, completed/idle are.
 */
export function ordoTeamGraph(snapshot: OrdoTeamSnapshotV1 | undefined): { readonly nodes: readonly OrdoTeamGraphNodeV1[]; readonly edges: readonly OrdoTeamGraphEdgeV1[] } {
  if (snapshot === undefined) return { nodes: [], edges: [] }
  const nodes: OrdoTeamGraphNodeV1[] = []
  const edges: OrdoTeamGraphEdgeV1[] = []
  for (const task of snapshot.tasks) {
    nodes.push({
      id: task.taskRef,
      kind: 'task',
      partition: `task:${task.state}`,
      label: task.title,
      clusterable: task.state === 'completed',
    })
  }
  const agents = new Map<string, OrdoTeamAssignmentV1>()
  for (const assignment of snapshot.assignments) {
    if (!agents.has(assignment.agentRef)) agents.set(assignment.agentRef, assignment)
    nodes.push({
      id: `${assignment.agentRef}:${assignment.assignmentRef}`,
      kind: 'agent',
      partition: `agent:${assignment.role}`,
      label: assignment.agentRef,
      clusterable: assignment.role === 'observer',
    })
    const task = snapshot.tasks.find(candidate => candidate.taskRef === assignment.taskRef)
    if (task !== undefined) {
      edges.push({
        id: `${assignment.assignmentRef}:assign`,
        from: `${assignment.agentRef}:${assignment.assignmentRef}`,
        to: assignment.taskRef,
        kind: 'assignment',
      })
      if (task.assigneeRef !== undefined && task.assigneeRef !== assignment.agentRef) {
        nodes.push({
          id: `${task.assigneeRef}:*`,
          kind: 'agent',
          partition: 'agent:writer',
          label: task.assigneeRef,
          clusterable: false,
        })
        edges.push({
          id: `${assignment.assignmentRef}:handoff`,
          from: `${task.assigneeRef}:*`,
          to: `${assignment.agentRef}:${assignment.assignmentRef}`,
          kind: 'handoff',
        })
      }
    }
  }
  return { nodes, edges }
}

/** Semantic relation list: every graph edge rendered as text (§3.3 parity). */
export function ordoTeamRelationList(snapshot: OrdoTeamSnapshotV1 | undefined): readonly string[] {
  const graph = ordoTeamGraph(snapshot)
  return graph.edges.map(edge => {
    const from = graph.nodes.find(node => node.id === edge.from)
    const to = graph.nodes.find(node => node.id === edge.to)
    if (from === undefined || to === undefined) return ''
    return `${from.label} —${edge.kind}→ ${to.label}`
  }).filter(line => line !== '')
}

export interface OrdoTeamInspectorViewV1 {
  readonly taskRef: string
  readonly title: string
  readonly state: string
  readonly blockers: readonly string[]
  readonly holders: readonly string[]
}

/** Inspector projection for the selected task; undefined when not found. */
export function ordoTeamInspector(snapshot: OrdoTeamSnapshotV1 | undefined, taskRef: string | undefined): OrdoTeamInspectorViewV1 | undefined {
  if (snapshot === undefined || taskRef === undefined) return undefined
  const task = snapshot.tasks.find(candidate => candidate.taskRef === taskRef)
  if (task === undefined) return undefined
  return {
    taskRef: task.taskRef,
    title: task.title,
    state: task.state,
    blockers: Array.from({ length: task.blockerCount }, (_, index) => `${task.taskRef}:blocker:${index + 1}`),
    holders: snapshot.assignments.filter(assignment => assignment.taskRef === task.taskRef && assignment.holder).map(assignment => assignment.agentRef),
  }
}

export type OrdoTeamRoomEventV1 =
  | { readonly kind: 'post'; readonly author: string; readonly body: string }
  | { readonly kind: 'reply'; readonly author: string; readonly body: string; readonly to: string }
  | { readonly kind: 'promote'; readonly actor: string; readonly messageRef: string }

/** §3.4 Room surface: posts/replies/promotions with bounded, redaction-safe text. */
const ROOM_BODY_MAX = 2_000
export function sanitizeRoomBody(body: string): string | undefined {
  const trimmed = body.trim().slice(0, ROOM_BODY_MAX)
  if (trimmed === '') return undefined
  if (/(?:^|[:/\\])(?:etc|home|usr|var)|https?:\/\/|Bearer\s|token:|secret|password/i.test(trimmed)) return undefined
  return trimmed
}

export interface OrdoTeamRoomEntryV1 {
  readonly id: string
  readonly event: OrdoTeamRoomEventV1
  readonly at: number
}

export function appendRoomEntry(entries: readonly OrdoTeamRoomEntryV1[], event: OrdoTeamRoomEventV1, idSeed: number, maxEntries = 200): readonly OrdoTeamRoomEntryV1[] {
  const next = [...entries, { id: `room:${idSeed}`, event, at: idSeed }]
  return next.length > maxEntries ? next.slice(next.length - maxEntries) : next
}

/**
 * Owner Action Palette dispatch flow (§3.4): Room interactions and palette
 * actions route through the §1.3 proxy — preview-gated, receipt-driven, with
 * control loss or revision drift invalidating any pending confirmation.
 */
export interface OrdoTeamPendingActionV1 {
  readonly actionId: string
  readonly targetRef: string
  readonly idempotencyKey: string
  readonly contextRevision: number
}

export interface OrdoTeamPaletteStateV1 {
  readonly pending: OrdoTeamPendingActionV1 | undefined
  readonly lastReceiptRef: string | undefined
}

export type OrdoTeamPaletteEvent =
  | { readonly type: 'request'; readonly request: OrdoTeamPendingActionV1 }
  | { readonly type: 'confirmed'; readonly receiptRef: string }
  | { readonly type: 'receipt'; readonly receiptRef: string }
  | { readonly type: 'control_lost' }
  | { readonly type: 'revision_changed'; readonly revision: number }
  | { readonly type: 'dismiss' }

export function reduceOrdoTeamPalette(state: OrdoTeamPaletteStateV1, event: OrdoTeamPaletteEvent): OrdoTeamPaletteStateV1 {
  switch (event.type) {
    case 'request':
      return { ...state, pending: event.request }
    case 'confirmed':
    case 'receipt':
      return { pending: undefined, lastReceiptRef: event.receiptRef }
    case 'control_lost':
    case 'dismiss':
      return state.pending === undefined ? state : { ...state, pending: undefined }
    case 'revision_changed':
      // a revision change invalidates only a stale pending preview
      if (state.pending === undefined || state.pending.contextRevision === event.revision) return state
      return { ...state, pending: undefined }
  }
}

/** Receipt-driven refresh: a new receipt for the current team triggers refetch. */
export function shouldRefetchOnReceipt(state: OrdoTeamPaletteStateV1, receiptRef: string): boolean {
  return state.lastReceiptRef !== receiptRef
}
