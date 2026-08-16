/** Ordo 安全只读投影的 Host Remote。 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { OrdoAgentOpsContext, OrdoAgentOpsExpectedContext, OrdoAgentOpsSnapshot } from './types.ts'
import { validateOrdoAgentOpsExpectedContext, validateOrdoAgentOpsSnapshot } from './validation.ts'

export type * from './types.ts'
export {
  ordoAgentOpsExpectedContextSchema,
  ordoAgentOpsSnapshotSchema,
  validateOrdoAgentOpsExpectedContext,
  validateOrdoAgentOpsSnapshot,
} from './validation.ts'

/** Ordo owner 提供的唯一读取入口；此 package 不拥有 canonical facts。 */
export interface OrdoAgentOpsOwnerSource {
  snapshot(): OrdoAgentOpsSnapshot
}

/** 未来 Ordo owner adapter 注入其只读来源所使用的稳定 key。 */
export const ORDO_AGENT_OPS_OWNER_SOURCE = 'ordoAgentOpsOwner'

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
}

export default OrdoAgentOpsGateway
