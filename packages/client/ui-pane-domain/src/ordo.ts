/** Map the existing Ordo Agent Ops snapshot onto the domain Pane contract. */

import { ORDO_CLOSED_ACTIONS } from './actions.js'
import type { DomainSnapshotV1 } from './snapshot.js'

export interface OrdoAgentOpsSnapshotLike {
  readonly state: string
  readonly freshness: string
  readonly run?: {
    readonly runRef: string
    readonly safeTitle: string
    readonly state: string
    readonly taskCount: number
    readonly completedTaskCount: number
    readonly attentionCount: number
  }
  readonly tasks?: readonly {
    readonly ref: string
    readonly title: string
    readonly state: string
  }[]
  readonly actions?: readonly { readonly actionType: string }[]
}

const STATUS: Record<string, DomainSnapshotV1['status']> = {
  ready: 'ready',
  stale: 'stale',
  offline: 'offline',
  permission_denied: 'permission_denied',
  contract_mismatch: 'contract_mismatch',
  needs_contract: 'contract_mismatch',
}

export function ordoSnapshotToDomain(input: OrdoAgentOpsSnapshotLike): DomainSnapshotV1 {
  const run = input.run
  const tasks = input.tasks ?? []
  const items = tasks.length > 0
    ? tasks.slice(0, 1_000).map(task => ({
      ref: task.ref,
      title: task.title,
      version: '1',
      kind: 'task',
      status: task.state,
    }))
    : run === undefined ? [] : [{
      ref: String(run.runRef),
      title: run.safeTitle,
      version: '1',
      kind: 'run',
      status: run.state,
      summary: `${run.completedTaskCount}/${run.taskCount} tasks · ${run.attentionCount} attention`,
    }]
  return {
    owner: 'ordo',
    status: STATUS[input.state] ?? 'unknown',
    freshness: input.freshness === 'fresh' || input.freshness === 'stale' ? input.freshness : 'unknown',
    items,
    allowedActions: (input.actions ?? [])
      .filter(action => !(ORDO_CLOSED_ACTIONS as readonly string[]).includes(action.actionType))
      .map(action => ({ id: action.actionType, gated: true })),
  }
}
