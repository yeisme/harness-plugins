/**
 * Agents Hub view state (team-hub §2.1/2.2).
 *
 * The Hub is the single Agents-entry pane: Session Agents and Ordo Teams
 * sub-views behind one icon-only accessible control, with the legacy
 * Subagent Monitor and Ordo Ops pane kept as deep-link fallbacks. All owner
 * facts come from the Team V1 snapshot projection; this module holds ONLY
 * ephemeral view state (active tab, selected task, delivery filter) and
 * never a domain store.
 *
 * @module @yeisme/dsh-client-ui-ordo-agent-ops/client
 */
import type { OrdoTeamCapabilityMatrixV1, OrdoTeamSnapshotV1 } from '@yeisme/dsh-ordo-agent-ops/host'

export type AgentsHubTab = 'session-agents' | 'ordo-teams'

export interface AgentsHubSessionAgentRow {
  readonly agentRef: string
  readonly safeTitle: string
  readonly running: boolean
}

export interface AgentsHubStateV1 {
  readonly activeTab: AgentsHubTab
  readonly selectedTaskRef: string | undefined
  readonly deliveryFilter: string | undefined
}

export const AGENTS_HUB_VIEW_KIND: 'agents.hub' = 'agents.hub'
export interface AgentsHubLegacyFallbacks {
  readonly subagentMonitor: 'subagent.monitor'
  readonly ordoOpsPane: 'dsh.ordo-agent-ops.sidebar'
}
export const AGENTS_HUB_LEGACY_FALLBACKS: AgentsHubLegacyFallbacks = {
  subagentMonitor: 'subagent.monitor',
  ordoOpsPane: 'dsh.ordo-agent-ops.sidebar',
}

/** Tab visibility is capability-honest: Ordo Teams hides while unavailable… */
export function agentsHubTabs(matrix: OrdoTeamCapabilityMatrixV1): readonly { readonly id: AgentsHubTab; readonly label: string; readonly disabled: boolean; readonly disabledReason: string | undefined }[] {
  return [
    { id: 'session-agents', label: 'Session Agents', disabled: false, disabledReason: undefined },
    {
      id: 'ordo-teams',
      label: 'Ordo Teams',
      disabled: false,
      disabledReason: matrix.team === 'unavailable' ? 'team_v1_unavailable' : matrix.team === 'fixtures' ? 'fixtures_only' : undefined,
    },
  ]
}

/** …and the tab auto-falls back to Session Agents when Teams is hidden. */
export function resolveAgentsHubTab(state: AgentsHubStateV1, matrix: OrdoTeamCapabilityMatrixV1): AgentsHubTab {
  if (state.activeTab === 'session-agents') return 'session-agents'
  return matrix.team === 'unavailable' && matrix.sessionAgents === 'available' ? 'session-agents' : 'ordo-teams'
}

export interface AgentsHubHeaderV1 {
  readonly owner: string
  readonly freshness: string
  readonly maturity: string
  readonly control: 'holder' | 'observer'
  readonly mutationEnabled: boolean
}

export function agentsHubHeader(snapshot: OrdoTeamSnapshotV1 | undefined, matrix: OrdoTeamCapabilityMatrixV1): AgentsHubHeaderV1 {
  return {
    owner: snapshot?.teamRef ?? 'owner:unavailable',
    freshness: snapshot?.freshness ?? (matrix.team === 'unavailable' ? 'offline' : 'unknown'),
    maturity: matrix.team,
    control: (snapshot?.assignments.some(assignment => assignment.holder && assignment.role === 'writer') ?? false) ? 'holder' : 'observer',
    mutationEnabled: matrix.mutationEnabled,
  }
}

/** Task rows for the Teams sub-view, honoring the delivery filter. */
export function agentsHubTaskRows(
  snapshot: OrdoTeamSnapshotV1 | undefined,
  state: AgentsHubStateV1,
): readonly { taskRef: string; title: string; state: string; criticality: string; blocked: boolean }[] {
  if (snapshot === undefined) return []
  return snapshot.tasks
    .filter(task => state.deliveryFilter === undefined || task.deliveryRef === state.deliveryFilter)
    .map(task => ({
      taskRef: task.taskRef,
      title: task.title,
      state: task.state,
      criticality: task.criticality,
      blocked: task.state === 'blocked' || task.blockerCount > 0,
    }))
}

/** Delivery picker options: distinct delivery refs with task counts. */
export function agentsHubDeliveryOptions(snapshot: OrdoTeamSnapshotV1 | undefined): readonly { deliveryRef: string; taskCount: number }[] {
  if (snapshot === undefined) return []
  const counts = new Map<string, number>()
  for (const task of snapshot.tasks) {
    counts.set(task.deliveryRef, (counts.get(task.deliveryRef) ?? 0) + 1)
  }
  return [...counts.entries()].map(([deliveryRef, taskCount]) => ({ deliveryRef, taskCount })).sort((left, right) => left.deliveryRef.localeCompare(right.deliveryRef))
}
