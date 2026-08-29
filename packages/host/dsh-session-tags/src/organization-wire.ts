/** Additive `sessionOrganization` v1 wire contracts. */

export type OrganizationScopeV1 =
  | { readonly kind: 'global' }
  | { readonly kind: 'workspace'; readonly workspaceRef: string }

export interface FunctionTypeV1 {
  readonly id: string
  readonly name: string
  readonly color: string
  readonly scope: OrganizationScopeV1
  readonly order: number
  readonly active: boolean
  readonly version: string
  readonly updatedAt: number
}

export interface TagCatalogEntryV1 {
  readonly name: string
  readonly color: string
  readonly scope: OrganizationScopeV1
  readonly active: boolean
  readonly aliasTo?: string | undefined
  readonly version: string
  readonly updatedAt: number
}

export type AssignmentSourceV1 = 'automatic' | 'manual' | 'rule'
export type ClassificationStatusV1 = 'unclassified' | 'classified' | 'needs_review' | 'failed'

export interface SessionOrganizationAssignmentV1 {
  readonly sessionId: string
  readonly workspaceRef: string
  readonly functionTypeId: string | null
  readonly functionSource: AssignmentSourceV1 | null
  readonly functionLocked: boolean
  readonly tagsLocked: boolean
  readonly classificationStatus: ClassificationStatusV1
  readonly confidence: number | null
  readonly suggestedFunctionTypeId?: string | undefined
  readonly suggestedTags?: readonly string[] | undefined
  readonly modelRef?: string | undefined
  readonly version: string
  readonly updatedAt: number
}

export interface OrganizationRuleConditionV1 {
  readonly workspaceRefs?: readonly string[] | undefined
  readonly functionTypeIds?: readonly string[] | undefined
  readonly tagsAll?: readonly string[] | undefined
  readonly tagsNone?: readonly string[] | undefined
  readonly query?: string | undefined
}

export interface OrganizationRuleActionV1 {
  readonly setFunctionTypeId?: string | undefined
  readonly addTags?: readonly string[] | undefined
  readonly removeTags?: readonly string[] | undefined
  readonly proposeArchive?: boolean | undefined
}

export interface OrganizationRuleV1 {
  readonly id: string
  readonly name: string
  readonly order: number
  readonly enabled: boolean
  readonly condition: OrganizationRuleConditionV1
  readonly action: OrganizationRuleActionV1
  readonly version: string
  readonly updatedAt: number
}

export interface ClassificationCandidateV1 {
  readonly functionTypeId: string
  readonly tags: readonly string[]
  readonly confidence: number
  readonly modelRef?: string | undefined
}

export type BatchActionV1 =
  | { readonly type: 'set-function'; readonly functionTypeId: string }
  | { readonly type: 'add-tags'; readonly tags: readonly string[] }
  | { readonly type: 'remove-tags'; readonly tags: readonly string[] }
  | { readonly type: 'archive' }
  | { readonly type: 'restore' }
  | { readonly type: 'purge' }

export interface BatchTargetV1 {
  readonly sessionId: string
  readonly workspaceRef: string
  readonly assignmentVersion: string | null
  readonly tagsVersion: string | null
}

export interface BatchPlanV1 {
  readonly id: string
  readonly decisionRef: string
  readonly action: BatchActionV1
  readonly targets: readonly BatchTargetV1[]
  readonly createdAt: number
  readonly expiresAt: number
  readonly confirmationText?: string | undefined
}

export type BatchItemStatusV1 = 'ok' | 'stale' | 'conflict' | 'rejected' | 'not_available'

export interface BatchItemReceiptV1 {
  readonly sessionId: string
  readonly status: BatchItemStatusV1
  readonly reason?: string | undefined
  readonly beforeAssignment?: SessionOrganizationAssignmentV1 | null | undefined
  readonly afterAssignment?: SessionOrganizationAssignmentV1 | null | undefined
  readonly beforeTags?: readonly string[] | undefined
  readonly afterTags?: readonly string[] | undefined
}

export interface BatchReceiptV1 {
  readonly id: string
  readonly planId: string
  readonly action: BatchActionV1
  readonly status: 'ok' | 'partial' | 'rejected'
  readonly items: readonly BatchItemReceiptV1[]
  readonly createdAt: number
  readonly undoExpiresAt: number | null
}

export interface SessionOrganizationSnapshotV1 {
  readonly ok: true
  readonly specVersion: '1.0'
  readonly functionTypes: readonly FunctionTypeV1[]
  readonly assignments: readonly SessionOrganizationAssignmentV1[]
  readonly tagCatalog: readonly TagCatalogEntryV1[]
  readonly rules: readonly OrganizationRuleV1[]
  readonly recentBatches: readonly BatchReceiptV1[]
}

export interface OrganizationFailureV1 {
  readonly ok: false
  readonly code: 'invalid-input' | 'not-found' | 'version-conflict' | 'stale-decision' | 'admin-required' | 'not-available' | 'storage-unavailable'
  readonly message: string
}

export interface SetAssignmentInputV1 {
  readonly sessionId: string
  readonly workspaceRef: string
  readonly functionTypeId: string | null
  readonly functionLocked: boolean
  readonly tagsLocked: boolean
  readonly ifVersion: string | null
}

export interface PutFunctionTypeInputV1 {
  readonly value: Omit<FunctionTypeV1, 'version' | 'updatedAt'>
  readonly ifVersion: string | null
}

export interface PutTagCatalogInputV1 {
  readonly value: Omit<TagCatalogEntryV1, 'version' | 'updatedAt'>
  readonly ifVersion: string | null
}

export interface PutRuleInputV1 {
  readonly value: Omit<OrganizationRuleV1, 'version' | 'updatedAt'>
  readonly ifVersion: string | null
}
