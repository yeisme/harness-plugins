/** Ordo Agent Ops → Ordo Team Pane 的映射与 live owner source 适配。 */

import type { PaneContextV1 } from '@yeisme/dsh-pane-protocol'
import { ORDO_CLOSED_ACTIONS } from './actions.js'
import type { DomainOwnerEventTransport } from './owner-source.js'
import { domainSnapshotEvent, type DomainItemV1, type DomainItemLinkV1, type DomainSnapshotV1 } from './snapshot.js'

/** Ordo task/session/attempt/lease 等投影条目（全部 owner 提供）。 */
export interface OrdoAgentOpsTaskLike {
  readonly ref: string
  readonly title: string
  readonly state: string
  /** owner 声明的实体类别（task/session/attempt/lease/approval/verification/evidence/dag…）。 */
  readonly kind?: string
  readonly summary?: string
  /** owner 已关联的 DSH session child；仅此字段会生成 deep-link。 */
  readonly link?: DomainItemLinkV1
}

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
  readonly tasks?: readonly OrdoAgentOpsTaskLike[]
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
  const items: DomainItemV1[] = tasks.length > 0
    ? tasks.slice(0, 1_000).map(task => ({
      ref: task.ref,
      title: task.title,
      version: '1',
      kind: task.kind ?? 'task',
      status: task.state,
      ...(task.summary === undefined ? {} : { summary: task.summary }),
      ...(task.link === undefined ? {} : { link: task.link }),
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

/** OrdoAgentOpsEvent 的结构子集（脱敏后）；bridge 只消费这些字段。 */
export interface OrdoAgentOpsEventLike {
  readonly eventRef: string
  readonly streamRef: string
  readonly sequence: number
  readonly cursor: string
  readonly occurredAt: string
  readonly observedAt?: string
  readonly entityRef: string
  readonly entityVersion: number
  readonly eventType: string
  readonly safeDeltaOrSummary: string
  readonly context: {
    readonly tenantRef?: string
    readonly workspaceRef: string
    readonly principalRef?: string
    readonly contextRevision: number | string
    readonly installationRef?: string
    readonly membershipRevision?: number | string
    readonly pluginReleaseDigest?: string
    readonly ordoContractDigest?: string
    readonly runtimeGeneration?: string
  }
}

/** owner push 通道的最小 seam。 */
export interface OrdoAgentOpsEventSourceLike {
  subscribe(listener: (event: unknown) => void): () => void
  onUnavailable?(listener: () => void): () => void
  onAvailable?(listener: () => void): () => void
}

export interface OrdoOwnerTransportInput {
  /** 快照与事件共用的 Pane context；事件 context 与之不同代即判 drift。 */
  readonly context: PaneContextV1
  readSnapshot(): OrdoAgentOpsSnapshotLike
  readonly events: OrdoAgentOpsEventSourceLike
}

/**
 * 把 Ordo owner snapshot/event 适配成 DomainOwnerEventTransport。
 *
 * 不变量：
 * - snapshot 只在 bridge open / 通道恢复时读取；本适配器不缓存、不轮询。
 * - owner event 映射为 append envelope（bounded safe summary），不生成或改写
 *   canonical task 状态；权威状态仍由 owner 读接口给出。
 */
export function createOrdoOwnerTransport(input: OrdoOwnerTransportInput): DomainOwnerEventTransport {
  // 事件 context 以挂载时冻结的 Pane context 为基线：只有 owner 明示的世代字段
  // （contextRevision / membershipRevision）参与漂移检测；workspace/principal 等
  // 身份字段以冻结值为准，避免事件携带的等价副本被误判为 drift。
  const paneContext = (event: OrdoAgentOpsEventLike): PaneContextV1 => ({
    ...input.context,
    revision: String(event.context.contextRevision),
    ...(input.context.membershipRevision !== undefined && event.context.membershipRevision !== undefined
      ? { membershipRevision: String(event.context.membershipRevision) }
      : {}),
  })
  return {
    read() {
      const domain = ordoSnapshotToDomain(input.readSnapshot())
      return {
        snapshot: domainSnapshotEvent(domain, input.context, -1),
        actions: domain.allowedActions,
      }
    },
    subscribe(listener) {
      return input.events.subscribe(event => {
        const candidate = event as OrdoAgentOpsEventLike
        if (candidate === null || typeof candidate !== 'object' || typeof candidate.sequence !== 'number') return
        listener({
          schema: 'pane.event.v1alpha1',
          stream: 'domain.ordo',
          cursor: candidate.cursor,
          sequence: candidate.sequence,
          context: paneContext(candidate),
          occurredAt: candidate.occurredAt,
          observedAt: candidate.observedAt ?? candidate.occurredAt,
          freshness: 'fresh',
          op: 'append',
          payload: { value: { kind: 'event', ref: candidate.entityRef, summary: candidate.safeDeltaOrSummary, eventType: candidate.eventType } },
        })
      })
    },
    ...(input.events.onUnavailable === undefined ? {} : { onUnavailable: input.events.onUnavailable.bind(input.events) }),
    ...(input.events.onAvailable === undefined ? {} : { onAvailable: input.events.onAvailable.bind(input.events) }),
  }
}

/** Subagent Pane 的 typed open request（与 ui-pane-subagent openView 形状一致）。 */
export interface OrdoSubagentDeepLinkRequest {
  readonly kind: 'subagent.monitor'
  readonly resourceKey: string
  readonly role: 'navigator'
  readonly preferredRegion: 'right'
  readonly retention: 'keep-alive'
  readonly singleton: boolean
  readonly pinned: boolean
  readonly title: string
}

/**
 * 为 owner 已关联 session child 的条目构造 typed deep-link。
 * 只返回 open request；canonical Ordo run 状态永不被 deep-link 改写。
 */
export function ordoSubagentDeepLink(item: DomainItemV1): OrdoSubagentDeepLinkRequest | undefined {
  if (item.link?.kind !== 'subagent.session') return undefined
  return {
    kind: 'subagent.monitor',
    resourceKey: `subagent:${item.link.ref}`,
    role: 'navigator',
    preferredRegion: 'right',
    retention: 'keep-alive',
    singleton: true,
    pinned: true,
    title: 'Agents',
  }
}
