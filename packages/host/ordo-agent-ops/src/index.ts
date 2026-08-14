/** Read-only Ordo Agent Ops Remote and the owner-source handoff point. */

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

/** Owner-provided read source; Ordo remains the only source of canonical facts. */
export interface OrdoAgentOpsOwnerSource {
  /** Read one already-authorized, redacted Agent Ops snapshot. */
  snapshot(): OrdoAgentOpsSnapshot
}

/** Stable key used by a future Ordo owner adapter to provide its read source. */
export const ORDO_AGENT_OPS_OWNER_SOURCE = 'ordoAgentOpsOwner'

/** Server-owned Context key that binds one gateway to one authorization subject. */
export const ORDO_AGENT_OPS_EXPECTED_CONTEXT = 'ordoAgentOpsExpectedContext'

/**
 * Fallback projection returned while the Ordo read contract is not mounted.
 * @param now - ISO timestamp stamped onto the fallback projection.
 * @returns one redacted `needs_contract` snapshot without run or capacity facts.
 */
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

/** Remote-only Host service. It does not create a scheduler or cache Agent Ops facts. */
export class OrdoAgentOpsGateway extends TypertRemoteService {
  private readonly expectedContext: OrdoAgentOpsExpectedContext | undefined

  constructor(ctx: Context) {
    super(ctx, 'ordoAgentOps')
    this.expectedContext = validateOrdoAgentOpsExpectedContext(ctx.get(ORDO_AGENT_OPS_EXPECTED_CONTEXT))
  }

  /**
   * Read the current owner projection, or return a truthful contract-gated state.
   * @returns one redacted Agent Ops snapshot.
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
