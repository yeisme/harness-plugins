import type {
  ArtifactRefV1,
  PaneActionDescriptorV1,
  PaneActionReceiptV1,
  PaneActionRequestV1,
  PaneContextV1,
  PaneStatus,
} from '@yeisme/dsh-pane-protocol'

export const CREATOR_STUDIO_OWNERS = ['eikona', 'scaena', 'sonora', 'auctra', 'pinax', 'anatomia'] as const
export type CreatorStudioOwner = (typeof CREATOR_STUDIO_OWNERS)[number]

export const CREATOR_STUDIO_TASKS = ['text', 'image', 'audio', 'video', 'review', 'analysis', 'context', 'operations', 'assets', 'generation', 'approval'] as const
export type CreatorStudioTask = (typeof CREATOR_STUDIO_TASKS)[number]

export type CreatorStudioTransport = 'local' | 'service' | 'unavailable'
export type CreatorStudioTransportPreference = 'auto' | 'local' | 'service'

export interface CreatorStudioContextV1 extends PaneContextV1 {
  readonly tenantRef: string
  readonly projectRef?: string
  readonly principalRef: string
  readonly membershipRevision: string
  readonly installationRef: string
  readonly pluginDigest: string
  readonly policyRevision: string
  readonly runtimeGeneration: string
}

export interface CreatorMetricV1 {
  readonly label: string
  readonly value: string
  readonly tone?: 'neutral' | 'positive' | 'warning' | 'critical'
}

export interface CreatorTextPreviewV1 {
  readonly before?: string
  readonly after?: string
}

export interface CreatorResourceV1 {
  readonly ref: string
  readonly version: string
  readonly kind: string
  readonly title: string
  readonly status: string
  readonly summary?: string
  readonly partial?: boolean
  readonly progress?: number
  readonly artifact?: ArtifactRefV1
  readonly badges?: readonly string[]
  readonly metrics?: readonly CreatorMetricV1[]
  readonly waveform?: readonly number[]
  readonly textPreview?: CreatorTextPreviewV1
  readonly evidenceRefs: readonly string[]
}

export type CreatorProductionStageId = 'prepare' | 'text' | 'visual' | 'shots' | 'review' | 'export'

export interface CreatorProductionStageV1 {
  readonly id: CreatorProductionStageId
  readonly label: string
  readonly status: 'pending' | 'running' | 'ready' | 'attention' | 'blocked'
  readonly progress: number
  readonly itemCount?: number
}

export interface CreatorProductionBlockerV1 {
  readonly ref: string
  readonly title: string
  readonly severity: 'warning' | 'critical'
  readonly summary: string
}

export interface CreatorProductionV1 {
  readonly ref: string
  readonly version: string
  readonly title: string
  readonly currentStage: CreatorProductionStageId
  readonly stages: readonly CreatorProductionStageV1[]
  readonly blockers: readonly CreatorProductionBlockerV1[]
}

export interface CreatorReviewV1 {
  readonly ref: string
  readonly owner: CreatorStudioOwner
  readonly title: string
  readonly status: 'pending' | 'approved' | 'rejected' | 'partial' | 'blocked'
  readonly risk: 'low' | 'medium' | 'high'
  readonly summary?: string
  readonly artifact?: ArtifactRefV1
  readonly evidenceRefs: readonly string[]
}

export interface CreatorJobV1 {
  readonly ref: string
  readonly owner: CreatorStudioOwner
  readonly title: string
  readonly status: 'queued' | 'running' | 'approval_required' | 'completed' | 'failed' | 'unknown' | 'reconcile_required'
  readonly progress?: number
  readonly summary?: string
  readonly receiptRef?: string
  readonly evidenceRefs: readonly string[]
}

export type CreatorAssetScopeV1 = 'current_project' | 'all_projects'

export interface CreatorAssetQueryV1 {
  readonly scope: CreatorAssetScopeV1
  readonly cursor?: string
  readonly limit?: number
  readonly owner?: CreatorStudioOwner
  readonly kind?: string
  readonly status?: string
  readonly text?: string
}

export interface CreatorOwnerAssetQueryV1 {
  readonly scope: CreatorAssetScopeV1
  readonly projectRef?: string
}

export interface CreatorOwnerAssetListV1 {
  readonly status: 'ready' | 'permission_denied' | 'needs_contract'
  readonly safeMessage: string
  readonly items: readonly CreatorAssetV1[]
}

export interface CreatorAssetV1 extends CreatorResourceV1 {
  readonly owner: CreatorStudioOwner
  readonly projectRef: string
  readonly rightsSummary?: string
  readonly lineageRefs?: readonly string[]
}

export interface CreatorAssetPageV1 {
  readonly schemaVersion: 'creator.asset.page.v1alpha1'
  readonly scope: CreatorAssetScopeV1
  readonly status: 'ready' | 'partial' | 'needs_contract' | 'permission_denied' | 'contract_mismatch'
  readonly freshness: 'fresh' | 'stale' | 'unknown'
  readonly reasonCode: 'asset_page' | 'project_context_unavailable' | 'asset_contract_unavailable' | 'partial_owner_projection' | 'permission_denied' | 'contract_mismatch'
  readonly safeMessage: string
  readonly items: readonly CreatorAssetV1[]
  readonly nextCursor?: string
  readonly unavailableOwners: readonly CreatorStudioOwner[]
  readonly permissionDeniedOwners?: readonly CreatorStudioOwner[]
}

export interface CreatorGenerationRunV1 {
  readonly ref: string
  readonly source: 'ordo'
  readonly title: string
  readonly state: string
  readonly taskCount: number
  readonly completedTaskCount: number
  readonly attentionCount: number
  readonly freshness: 'fresh' | 'stale'
}

export interface CreatorApprovalV1 {
  readonly ref: string
  readonly source: 'ordo'
  readonly targetRef: string
  readonly targetVersion: string
  readonly ownerRef: string
  readonly title: string
  readonly status: 'pending' | 'stale'
  readonly expiresAt: string
  readonly previewDigest: string
}

export interface CreatorOperationsProjectionV1 {
  readonly status: 'ready' | 'stale' | 'offline' | 'permission_denied' | 'contract_mismatch' | 'needs_contract'
  readonly freshness: 'fresh' | 'stale' | 'offline'
  readonly reasonCode: string
  readonly safeMessage: string
}

export interface CreatorApprovalDecisionV1 {
  readonly decisionRef: string
}

export interface CreatorOwnerSnapshotV1 {
  readonly schemaVersion: 'creator.owner.snapshot.v1alpha1'
  readonly owner: CreatorStudioOwner
  readonly transport: Exclude<CreatorStudioTransport, 'unavailable'>
  readonly snapshotRef: string
  readonly snapshotVersion: number
  readonly cursor: string
  readonly sequence: number
  readonly generatedAt: string
  readonly context: CreatorStudioContextV1
  readonly status: PaneStatus
  readonly freshness: 'fresh' | 'stale' | 'unknown'
  readonly summary: string
  readonly resources: readonly CreatorResourceV1[]
  readonly actions: readonly PaneActionDescriptorV1[]
  readonly production?: CreatorProductionV1
  readonly reviews?: readonly CreatorReviewV1[]
  readonly jobs?: readonly CreatorJobV1[]
}

export interface CreatorOwnerProjectionV1 extends Omit<CreatorOwnerSnapshotV1, 'transport' | 'context'> {
  readonly transport: CreatorStudioTransport
  readonly context?: CreatorStudioContextV1
}

export interface CreatorStudioSnapshotV1 {
  readonly schemaVersion: 'creator.studio.snapshot.v1alpha1'
  readonly snapshotRef: string
  readonly snapshotVersion: number
  readonly generatedAt: string
  readonly status: PaneStatus
  readonly freshness: 'fresh' | 'stale' | 'unknown'
  readonly reasonCode: 'owner_snapshot' | 'context_unavailable' | 'owner_directory_unavailable' | 'partial_owner_projection'
  readonly safeMessage: string
  readonly context?: CreatorStudioContextV1
  readonly owners: readonly CreatorOwnerProjectionV1[]
  readonly production?: CreatorProductionV1
  readonly reviews: readonly CreatorReviewV1[]
  readonly jobs: readonly CreatorJobV1[]
  readonly operations?: CreatorOperationsProjectionV1
  readonly generationRuns?: readonly CreatorGenerationRunV1[]
  readonly approvals?: readonly CreatorApprovalV1[]
}

export interface CreatorMediaAccessV1 {
  readonly url: string
  readonly expiresAt: string
}

export interface CreatorOwnerAdapterV1 {
  readonly owner: CreatorStudioOwner
  readonly transport: Exclude<CreatorStudioTransport, 'unavailable'>
  /** Service adapters set this only after explicit endpoint/auth configuration. */
  readonly configured?: boolean
  snapshot(context: CreatorStudioContextV1): CreatorOwnerSnapshotV1 | Promise<CreatorOwnerSnapshotV1>
  listAssets?(query: CreatorOwnerAssetQueryV1, context: CreatorStudioContextV1): CreatorOwnerAssetListV1 | Promise<CreatorOwnerAssetListV1>
  dispatch(request: PaneActionRequestV1, context: CreatorStudioContextV1): PaneActionReceiptV1 | Promise<PaneActionReceiptV1>
  resolveArtifact?(artifact: ArtifactRefV1, context: CreatorStudioContextV1): CreatorMediaAccessV1 | undefined | Promise<CreatorMediaAccessV1 | undefined>
}

export interface CreatorStudioTransportPolicyV1 {
  readonly default: CreatorStudioTransportPreference
  readonly owners?: Partial<Record<CreatorStudioOwner, CreatorStudioTransportPreference>>
}
