/** Ordo 安全只读投影的 Host Remote。 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {
  OrdoAgentOpsDecisionOutcome,
  OrdoAgentOpsActionSource,
  OrdoAgentOpsContext,
  OrdoAgentOpsExpectedContext,
  OrdoAgentOpsSnapshot,
} from './types.ts'
import {
  validateOrdoAgentOpsActionResult,
  validateOrdoAgentOpsExpectedContext,
  validateOrdoAgentOpsSnapshot,
} from './validation.ts'

export type * from './types.ts'
export {
  ordoAgentOpsEventSchema,
  ordoAgentOpsExpectedContextSchema,
  ordoAgentOpsSnapshotSchema,
  validateOrdoAgentOpsActionReceipt,
  validateOrdoAgentOpsActionResult,
  validateOrdoAgentOpsEvent,
  validateOrdoAgentOpsExpectedContext,
  validateOrdoAgentOpsSnapshot,
} from './validation.ts'
export { OrdoAgentOpsEventCursor } from './event-cursor.ts'
export type { OrdoAgentOpsEventCursorDecision, OrdoAgentOpsEventCursorState } from './event-cursor.ts'

/** Ordo owner 提供的唯一读取入口；此 package 不拥有 canonical facts。 */
export interface OrdoAgentOpsOwnerSource {
  snapshot(): OrdoAgentOpsSnapshot
}

/** 未来 Ordo owner adapter 注入其只读来源所使用的稳定 key。 */
export const ORDO_AGENT_OPS_OWNER_SOURCE = 'ordoAgentOpsOwner'

/** Local Ordo CLI Team V1 owner; missing keeps Hub maturity unavailable. */
export const ORDO_TEAM_OWNER_SOURCE = 'ordoTeamOwner'

/** Ordo/BFF 写入 adapter 的稳定 Host key；缺失时所有 mutation 保持关闭。 */
export const ORDO_AGENT_OPS_ACTION_SOURCE = 'ordoAgentOpsActionOwner'

/** 将一个 gateway 固定绑定到单一授权主体的 Host Context key。 */
export const ORDO_AGENT_OPS_EXPECTED_CONTEXT = 'ordoAgentOpsExpectedContext'

/** Owner 读取合同尚未挂载时的安全退化投影。 */
export function needsContractSnapshot(now = new Date().toISOString()): OrdoAgentOpsSnapshot {
  return {
    schemaVersion: 'ordo.agent_ops.snapshot.v1alpha1',
    snapshotRef: 'ordo-agent-ops:not-mounted' as OrdoAgentOpsSnapshot['snapshotRef'],
    snapshotVersion: 0,
    generatedAt: now,
    state: 'needs_contract',
    freshness: 'offline',
    reasonCode: 'owner_read_contract_unavailable',
    source: 'owner-gated',
    safeMessage: 'Ordo owner read projection is not mounted in this DSH runtime.',
  }
}

function ownerProjectionUnavailableSnapshot(now = new Date().toISOString()): OrdoAgentOpsSnapshot {
  return {
    ...needsContractSnapshot(now),
    state: 'offline',
    freshness: 'offline',
    reasonCode: 'owner_projection_unavailable',
    safeMessage: 'Ordo owner read projection is unavailable in this DSH runtime.',
  }
}

function contractMismatchSnapshot(now = new Date().toISOString()): OrdoAgentOpsSnapshot {
  return {
    ...needsContractSnapshot(now),
    state: 'contract_mismatch',
    freshness: 'stale',
    reasonCode: 'contract_mismatch',
    safeMessage: 'Ordo owner read projection did not match the DSH contract.',
  }
}

function matchesExpectedContext(expected: OrdoAgentOpsExpectedContext, actual: OrdoAgentOpsContext): boolean {
  return expected.tenantRef === actual.tenantRef
    && expected.workspaceRef === actual.workspaceRef
    && expected.principalRef === actual.principalRef
    && expected.contextRevision === actual.contextRevision
    && expected.installationRef === actual.installationRef
}

/**
 * Remote-only Host 服务。它不创建 scheduler、缓存、文件系统或任何 Ordo 写入模型。
 */
export class OrdoAgentOpsGateway extends TypertRemoteService {
  private readonly expectedContext: OrdoAgentOpsExpectedContext | undefined

  constructor(ctx: Context) {
    super(ctx, 'ordoAgentOps')
    this.expectedContext = validateOrdoAgentOpsExpectedContext(ctx.get(ORDO_AGENT_OPS_EXPECTED_CONTEXT))
  }

  /**
   * 读取 owner 的当前投影；授权上下文或合同不成立时返回无事实的退化状态。
   * @returns 经 Host 校验且脱敏的 Agent Ops 投影。
   */
  @Remote('snapshot')
  snapshot(): OrdoAgentOpsSnapshot {
    if (this.expectedContext === undefined) return needsContractSnapshot()
    const source = this.ctx.get(ORDO_AGENT_OPS_OWNER_SOURCE) as OrdoAgentOpsOwnerSource | undefined
    if (source === undefined) return needsContractSnapshot()
    try {
      const snapshot = validateOrdoAgentOpsSnapshot(source.snapshot())
      if (snapshot === undefined || snapshot.context === undefined) return contractMismatchSnapshot()
      return matchesExpectedContext(this.expectedContext, snapshot.context) ? snapshot : contractMismatchSnapshot()
    } catch {
      return ownerProjectionUnavailableSnapshot()
    }
  }

  /**
   * 仅把已经由当前 snapshot 描述的 CAS 决策转给 owner。这里不构造 preview、receipt
   * 或动作参数；任何漂移、过期和未知结果都由 owner 的安全 receipt 表示。
   */
  async decide(decisionRef: string): Promise<OrdoAgentOpsDecisionOutcome> {
    if (this.expectedContext === undefined) return unknownDecision('reconcile_required', 'The owner action context is unavailable; reconcile is required.')
    const snapshot = this.snapshot()
    if (snapshot.state !== 'ready' || snapshot.freshness !== 'fresh' || snapshot.context === undefined) {
      return unknownDecision('reconcile_required', 'The owner action snapshot is not fresh; reconcile is required.')
    }
    const descriptor = snapshot.actions?.find(action => action.decisionRef === decisionRef)
    if (descriptor === undefined) return unknownDecision('reconcile_required', 'The owner action preview is no longer available; request a new preview.')
    if (Date.parse(descriptor.expiresAt) <= Date.now()) return unknownDecision('reconcile_required', 'The owner action preview expired; request a new preview.')
    const source = this.ctx.get(ORDO_AGENT_OPS_ACTION_SOURCE) as OrdoAgentOpsActionSource | undefined
    if (source === undefined) return unknownDecision('still_unknown', 'The owner action settlement is unavailable; reconcile is required.')
    try {
      const result = validateOrdoAgentOpsActionResult(await source.decide({
        decisionRef: descriptor.decisionRef,
        previewDigest: descriptor.previewDigest,
        expectedContext: this.expectedContext,
      }))
      if (result === undefined) return unknownDecision('still_unknown', 'The owner returned no verifiable settlement; reconcile is required.')
      if ('kind' in result) return { kind: 'rejected', rejection: result }
      const receipt = result
      if (receipt.state === 'accepted') return { kind: 'receipt', receipt }
      return { kind: 'unknown', state: receipt.state, safeSummary: receipt.safeSummary }
    } catch {
      return unknownDecision('still_unknown', 'The owner action transport or settlement is uncertain; reconcile is required.')
    }
  }
}

function unknownDecision(
  state: 'still_unknown' | 'reconcile_required',
  safeSummary: string,
): OrdoAgentOpsDecisionOutcome {
  return { kind: 'unknown', state, safeSummary }
}

export {
  createLocalOrdoCliOwner,
  spawnOrdoCli,
} from './cli-owner.ts'
export type {
  LocalOrdoCliOwner,
  LocalOrdoCliOwnerOptions,
  OrdoCliExec,
  OrdoCliExecResult,
  OrdoTeamOwnerSource,
} from './cli-owner.ts'
export {
  ORDO_TEAM_SNAPSHOT_SCHEMA,
  ORDO_TEAM_EVENT_SCHEMA,
  validateOrdoTeamSnapshot,
  validateOrdoTeamEvent,
  gateOrdoTeamEvent,
  resolveOrdoTeamCapabilityMatrix,
  proxyOrdoTeamAction,
  decideOrdoTeamDispatch,
} from './team-projection.ts'
export type {
  OrdoTeamCapabilityV1,
  OrdoTeamMaturity,
  OrdoTeamTaskV1,
  OrdoTeamAssignmentV1,
  OrdoTeamActionDescriptorV1,
  OrdoTeamSnapshotV1,
  OrdoTeamEventV1,
  OrdoTeamEventOutcome,
  OrdoTeamCapabilityMatrixV1,
  OrdoTeamActionRequestInputV1,
  OrdoTeamActionProxyOutcome,
  OrdoTeamDispatchOutcome,
} from './team-projection.ts'

export default OrdoAgentOpsGateway
