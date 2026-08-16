import type { Branded } from '@deepseek-ai/dsh-brand'

/** 安全 Ordo 投影中的不透明标识符。 */
export type OrdoAgentOpsRef = Branded<'OrdoAgentOpsRef'>

/** Owner 投影的可读新鲜度。 */
export type OrdoAgentOpsFreshness = 'fresh' | 'stale' | 'offline'

/** 浏览器可见的安全投影状态。 */
export type OrdoAgentOpsState =
  | 'ready'
  | 'stale'
  | 'offline'
  | 'permission_denied'
  | 'contract_mismatch'
  | 'needs_contract'

/** 不泄露 Host、提供商或凭据细节的退化原因码。 */
export type OrdoAgentOpsReasonCode =
  | 'owner_snapshot'
  | 'owner_read_contract_unavailable'
  | 'owner_projection_unavailable'
  | 'context_stale'
  | 'permission_denied'
  | 'contract_mismatch'

/** Owner 投影携带的租户与安装上下文。 */
export interface OrdoAgentOpsContext {
  readonly tenantRef: OrdoAgentOpsRef
  readonly workspaceRef: OrdoAgentOpsRef
  readonly principalRef: OrdoAgentOpsRef
  readonly contextRevision: number
  readonly installationRef: OrdoAgentOpsRef
}

/** Host gateway 生命周期开始时冻结的授权上下文。 */
export interface OrdoAgentOpsExpectedContext extends OrdoAgentOpsContext {}

/** 当前选中 run 的安全摘要。 */
export interface OrdoAgentOpsRunSummary {
  readonly runRef: OrdoAgentOpsRef
  readonly state: string
  readonly safeTitle: string
  readonly taskCount: number
  readonly completedTaskCount: number
  readonly attentionCount: number
}

/** 容量观察状态；它不表示启动授权。 */
export type OrdoAgentOpsReservationState =
  | 'not_supported'
  | 'not_reserved'
  | 'reserved'
  | 'stale'
  | 'revoked'
  | 'unknown'

/** Owner 直接提供的容量事实。 */
export interface OrdoAgentOpsCapacity {
  readonly policyCap: number
  readonly observedOrRetained: number
  readonly qualifiedRoutes: number
  readonly reservationState: OrdoAgentOpsReservationState
}

/** DSH 与 Workbench 共同消费的只读、版本化 Ordo 投影。 */
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
