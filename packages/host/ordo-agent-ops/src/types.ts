import type { Branded } from '@deepseek-ai/dsh-brand'

/** Opaque identifier used by the safe Agent Ops projection. */
export type OrdoAgentOpsRef = Branded<'OrdoAgentOpsRef'>

/** Freshness of the owner-authored projection. */
export type OrdoAgentOpsFreshness = 'fresh' | 'stale' | 'offline'

/** Client-visible projection state. */
export type OrdoAgentOpsState =
  | 'ready'
  | 'stale'
  | 'offline'
  | 'permission_denied'
  | 'contract_mismatch'
  | 'needs_contract'

/** Reason codes that do not expose provider or host details. */
export type OrdoAgentOpsReasonCode =
  | 'owner_snapshot'
  | 'owner_read_contract_unavailable'
  | 'owner_projection_unavailable'
  | 'context_stale'
  | 'permission_denied'
  | 'contract_mismatch'

/** Tenant/workspace context carried by an owner-authored projection. */
export interface OrdoAgentOpsContext {
  readonly tenantRef: OrdoAgentOpsRef
  readonly workspaceRef: OrdoAgentOpsRef
  readonly principalRef: OrdoAgentOpsRef
  readonly contextRevision: number
  readonly installationRef: OrdoAgentOpsRef
}

/** Server-injected context fixed for one Host gateway lifecycle. */
export interface OrdoAgentOpsExpectedContext extends OrdoAgentOpsContext {}

/** Safe summary of the currently selected Ordo run. */
export interface OrdoAgentOpsRunSummary {
  readonly runRef: OrdoAgentOpsRef
  readonly state: string
  readonly safeTitle: string
  readonly taskCount: number
  readonly completedTaskCount: number
  readonly attentionCount: number
}

/** Capacity source state; it never implies launch authorization. */
export type OrdoAgentOpsReservationState =
  | 'not_supported'
  | 'not_reserved'
  | 'reserved'
  | 'stale'
  | 'revoked'
  | 'unknown'

/** Honest policy/observation/qualification capacity view. */
export interface OrdoAgentOpsCapacity {
  readonly policyCap: number
  readonly observedOrRetained: number
  readonly qualifiedRoutes: number
  readonly reservationState: OrdoAgentOpsReservationState
}

/** Versioned read-only Agent Ops projection consumed by DSH and Workbench. */
export interface OrdoAgentOpsSnapshot {
  readonly schemaVersion: 'ordo.agent_ops.snapshot.v1alpha1'
  readonly snapshotRef: OrdoAgentOpsRef
  readonly snapshotVersion: number
  readonly generatedAt: string
  readonly state: OrdoAgentOpsState
  readonly freshness: OrdoAgentOpsFreshness
  readonly reasonCode: OrdoAgentOpsReasonCode
  readonly source: 'owner' | 'owner-gated'
  readonly safeMessage: string
  readonly context?: OrdoAgentOpsContext
  readonly run?: OrdoAgentOpsRunSummary
  readonly capacity?: OrdoAgentOpsCapacity
}
