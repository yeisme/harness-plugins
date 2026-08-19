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
  | 'reconcile_required'
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

/** Ordo owner 已经预览并授权给当前上下文的唯一可操作动作。 */
export interface OrdoAgentOpsActionDescriptor {
  readonly actionType: 'ordo.reconcile.request' | 'ordo.approval.decide'
  readonly decisionRef: OrdoAgentOpsRef
  readonly targetRef: OrdoAgentOpsRef
  readonly targetVersion: number
  readonly ownerRef: OrdoAgentOpsRef
  readonly safeEffect: string
  readonly expiresAt: string
  readonly previewDigest: string
  readonly contractDigest: string
}

/** Ordo owner 对一次 compare-and-swap action 的安全 receipt。 */
export interface OrdoAgentOpsActionReceipt {
  readonly receiptRef: OrdoAgentOpsRef
  readonly state: 'accepted' | 'reconcile_required' | 'still_unknown'
  readonly safeSummary: string
}

/** 只有 owner 明确返回此结构时，Host 才能把结果解释为 rejected。 */
export interface OrdoAgentOpsActionRejection {
  readonly kind: 'rejected'
  readonly reason: 'stale' | 'permission_denied' | 'not_available' | 'expired'
  readonly safeMessage: string
}

/** Owner action 的安全返回值；异常不通过此 union 伪装成 rejection。 */
export type OrdoAgentOpsActionResult = OrdoAgentOpsActionReceipt | OrdoAgentOpsActionRejection

/** Host 对 action settle 的 fail-closed 结果。 */
export type OrdoAgentOpsDecisionOutcome =
  | { readonly kind: 'receipt'; readonly receipt: OrdoAgentOpsActionReceipt }
  | { readonly kind: 'rejected'; readonly rejection: OrdoAgentOpsActionRejection }
  | { readonly kind: 'unknown'; readonly state: 'still_unknown' | 'reconcile_required'; readonly safeSummary: string }

/**
 * Host 内由 Ordo/BFF 注入的唯一写入边界。浏览器从不持有它；实现必须在副作用前
 * 再次核对 decision、preview digest 和完整授权上下文。
 */
export interface OrdoAgentOpsActionSource {
  decide(input: {
    readonly decisionRef: OrdoAgentOpsRef
    readonly previewDigest: string
    readonly expectedContext: OrdoAgentOpsExpectedContext
  }): Promise<OrdoAgentOpsActionResult>
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
  readonly actions?: readonly OrdoAgentOpsActionDescriptor[]
}

/**
 * Ordo owner event 的安全、版本化投影。事件只携带 bounded summary，不携带
 * raw prompt、provider payload、private tool arguments 或 host path。
 */
export interface OrdoAgentOpsEvent {
  readonly schemaVersion: 'ordo.agent_ops.event.v1alpha1'
  readonly eventRef: OrdoAgentOpsRef
  readonly streamRef: OrdoAgentOpsRef
  readonly sequence: number
  readonly cursor: OrdoAgentOpsRef
  readonly occurredAt: string
  readonly observedAt: string
  readonly entityRef: OrdoAgentOpsRef
  readonly entityVersion: number
  readonly eventType: string
  readonly safeDeltaOrSummary: string
  readonly evidenceRefs: readonly OrdoAgentOpsRef[]
  readonly context: OrdoAgentOpsContext
  readonly membershipRevision: number
  readonly pluginReleaseDigest: string
  readonly ordoContractDigest: string
  readonly runtimeGeneration: OrdoAgentOpsRef
}

/**
 * 由 authoritative snapshot 或 owner replacement generation 提供的事件游标锚点。
 * 没有锚点时，consumer 只能要求 snapshot reconcile，不能直接应用事件。
 */
export interface OrdoAgentOpsEventCursorAnchor {
  readonly streamRef: OrdoAgentOpsRef
  readonly sequence: number
  readonly cursor: OrdoAgentOpsRef
  readonly eventRef?: OrdoAgentOpsRef
  readonly context: OrdoAgentOpsExpectedContext
  readonly membershipRevision: number
  readonly pluginReleaseDigest: string
  readonly ordoContractDigest: string
  readonly runtimeGeneration: OrdoAgentOpsRef
}
