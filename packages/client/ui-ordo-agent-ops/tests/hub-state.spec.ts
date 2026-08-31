import { describe, expect, it } from 'vitest'
import {
  AGENTS_HUB_LEGACY_FALLBACKS,
  AGENTS_HUB_VIEW_KIND,
  agentsHubDeliveryOptions,
  agentsHubHeader,
  agentsHubTaskRows,
  agentsHubTabs,
  resolveAgentsHubTab,
  type AgentsHubStateV1,
} from '../src/client/hub-state.ts'
import type { OrdoTeamCapabilityMatrixV1, OrdoTeamSnapshotV1 } from '@yeisme/dsh-ordo-agent-ops/host'

const unavailableMatrix: OrdoTeamCapabilityMatrixV1 = { team: 'unavailable', sessionAgents: 'available', legacyOrdoPane: 'available', mutationEnabled: false, fallback: 'hub-session-agents' }
const liveMatrix: OrdoTeamCapabilityMatrixV1 = { team: 'live', sessionAgents: 'available', legacyOrdoPane: 'available', mutationEnabled: true, fallback: 'hub-session-agents' }

function snapshot(overrides: Partial<OrdoTeamSnapshotV1> = {}): OrdoTeamSnapshotV1 {
  return {
    schemaVersion: 'ordo.team.snapshot.v1alpha1',
    teamRef: 'team:1',
    contextRevision: 3,
    generation: 2,
    cursor: 41,
    freshness: 'fresh',
    safeMessage: 'ok',
    tasks: [
      { taskRef: 'task:1', title: 'Outline', state: 'running', criticality: 'critical', deliveryRef: 'delivery:a', blockerCount: 0, assigneeRef: 'agent:1' },
      { taskRef: 'task:2', title: 'Cut scene', state: 'blocked', criticality: 'normal', deliveryRef: 'delivery:b', blockerCount: 2, assigneeRef: undefined },
    ],
    assignments: [{ assignmentRef: 'asg:1', agentRef: 'agent:1', taskRef: 'task:1', role: 'writer', holder: true }],
    actions: [],
    ...overrides,
  } as OrdoTeamSnapshotV1
}

describe('Agents Hub view kind and legacy fallbacks (§2.1)', () => {
  it('registers one hub view kind and keeps both legacy deep links', () => {
    expect(AGENTS_HUB_VIEW_KIND).toBe('agents.hub')
    expect(AGENTS_HUB_LEGACY_FALLBACKS.subagentMonitor).toBe('subagent.monitor')
    expect(AGENTS_HUB_LEGACY_FALLBACKS.ordoOpsPane).toBe('dsh.ordo-agent-ops.sidebar')
  })
})

describe('Hub tabs and capability-honest fallback (§2.1/2.2)', () => {
  it('Ordo Teams tab explains its maturity; unavailable auto-falls back to Session Agents', () => {
    const tabs = agentsHubTabs(unavailableMatrix)
    expect(tabs).toHaveLength(2)
    expect(tabs[1]).toMatchObject({ id: 'ordo-teams', disabledReason: 'team_v1_unavailable' })
    const state: AgentsHubStateV1 = { activeTab: 'ordo-teams', selectedTaskRef: undefined, deliveryFilter: undefined }
    expect(resolveAgentsHubTab(state, unavailableMatrix)).toBe('session-agents')
    expect(resolveAgentsHubTab(state, liveMatrix)).toBe('ordo-teams')
  })
})

describe('Hub header projection (§2.2)', () => {
  it('carries owner/freshness/maturity/control with mutation gated by maturity', () => {
    expect(agentsHubHeader(snapshot(), liveMatrix)).toMatchObject({ owner: 'team:1', freshness: 'fresh', maturity: 'live', control: 'holder', mutationEnabled: true })
    expect(agentsHubHeader(undefined, unavailableMatrix)).toMatchObject({ maturity: 'unavailable', control: 'observer', mutationEnabled: false })
    const noHolder = snapshot({ assignments: [] })
    expect(agentsHubHeader(noHolder, liveMatrix).control).toBe('observer')
  })
})

describe('Task rows and delivery picker (§2.2)', () => {
  it('rows honor the delivery filter and flag blocked work', () => {
    const state: AgentsHubStateV1 = { activeTab: 'ordo-teams', selectedTaskRef: 'task:1', deliveryFilter: undefined }
    const rows = agentsHubTaskRows(snapshot(), state)
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ blocked: true })
    const filtered = agentsHubTaskRows(snapshot(), { ...state, deliveryFilter: 'delivery:b' })
    expect(filtered.map(row => row.taskRef)).toEqual(['task:2'])
  })

  it('delivery options are distinct with counts; absent snapshot yields none', () => {
    expect(agentsHubDeliveryOptions(snapshot())).toEqual([
      { deliveryRef: 'delivery:a', taskCount: 1 },
      { deliveryRef: 'delivery:b', taskCount: 1 },
    ])
    expect(agentsHubDeliveryOptions(undefined)).toEqual([])
  })
})
