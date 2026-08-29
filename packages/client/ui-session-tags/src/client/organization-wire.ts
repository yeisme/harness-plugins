/** Browser-safe mirror of the additive `sessionOrganization` v1 Remote. */

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

export interface SessionOrganizationAssignmentV1 {
  readonly sessionId: string
  readonly workspaceRef: string
  readonly functionTypeId: string | null
  readonly functionSource: 'automatic' | 'manual' | 'rule' | null
  readonly functionLocked: boolean
  readonly tagsLocked: boolean
  readonly classificationStatus: 'unclassified' | 'classified' | 'needs_review' | 'failed'
  readonly confidence: number | null
  readonly suggestedFunctionTypeId?: string | undefined
  readonly suggestedTags?: readonly string[] | undefined
  readonly modelRef?: string | undefined
  readonly version: string
  readonly updatedAt: number
}

export interface OrganizationRuleV1 {
  readonly id: string
  readonly name: string
  readonly order: number
  readonly enabled: boolean
  readonly condition: {
    readonly workspaceRefs?: readonly string[] | undefined
    readonly functionTypeIds?: readonly string[] | undefined
    readonly tagsAll?: readonly string[] | undefined
    readonly tagsNone?: readonly string[] | undefined
    readonly query?: string | undefined
  }
  readonly action: {
    readonly setFunctionTypeId?: string | undefined
    readonly addTags?: readonly string[] | undefined
    readonly removeTags?: readonly string[] | undefined
    readonly proposeArchive?: boolean | undefined
  }
  readonly version: string
  readonly updatedAt: number
}

export type BatchActionV1 =
  | { readonly type: 'set-function'; readonly functionTypeId: string }
  | { readonly type: 'add-tags'; readonly tags: readonly string[] }
  | { readonly type: 'remove-tags'; readonly tags: readonly string[] }
  | { readonly type: 'archive' }
  | { readonly type: 'restore' }
  | { readonly type: 'purge' }

export interface BatchPlanV1 {
  readonly id: string
  readonly decisionRef: string
  readonly action: BatchActionV1
  readonly targets: readonly { readonly sessionId: string; readonly workspaceRef: string; readonly assignmentVersion: string | null; readonly tagsVersion: string | null }[]
  readonly createdAt: number
  readonly expiresAt: number
  readonly confirmationText?: string | undefined
}

export interface BatchReceiptV1 {
  readonly id: string
  readonly planId: string
  readonly action: BatchActionV1
  readonly status: 'ok' | 'partial' | 'rejected'
  readonly items: readonly {
    readonly sessionId: string
    readonly status: 'ok' | 'stale' | 'conflict' | 'rejected' | 'not_available'
    readonly reason?: string | undefined
  }[]
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

export interface SessionOrganizationRemoteFace {
  snapshot(): Promise<SessionOrganizationSnapshotV1 | OrganizationFailureV1>
  setAssignment(input: {
    readonly sessionId: string
    readonly workspaceRef: string
    readonly functionTypeId: string | null
    readonly functionLocked: boolean
    readonly tagsLocked: boolean
    readonly ifVersion: string | null
  }): Promise<{ readonly ok: true; readonly assignment: SessionOrganizationAssignmentV1 } | OrganizationFailureV1>
  putFunctionType(input: {
    readonly value: Omit<FunctionTypeV1, 'version' | 'updatedAt'>
    readonly ifVersion: string | null
  }): Promise<{ readonly ok: true; readonly value: FunctionTypeV1 } | OrganizationFailureV1>
  putTagCatalog(input: {
    readonly value: Omit<TagCatalogEntryV1, 'version' | 'updatedAt'>
    readonly ifVersion: string | null
  }): Promise<{ readonly ok: true; readonly value: TagCatalogEntryV1 } | OrganizationFailureV1>
  putRule(input: {
    readonly value: Omit<OrganizationRuleV1, 'version' | 'updatedAt'>
    readonly ifVersion: string | null
  }): Promise<{ readonly ok: true; readonly value: OrganizationRuleV1 } | OrganizationFailureV1>
  classify(input: {
    readonly sessionId: string
    readonly workspaceRef: string
    readonly title: string
    readonly userMessages: readonly string[]
    readonly force?: boolean | undefined
  }): Promise<{ readonly ok: true; readonly assignment: SessionOrganizationAssignmentV1; readonly tags: readonly string[] } | OrganizationFailureV1>
  planBatch(input: {
    readonly targets: readonly { readonly sessionId: string; readonly workspaceRef: string }[]
    readonly action: BatchActionV1
  }): Promise<{ readonly ok: true; readonly plan: BatchPlanV1 } | OrganizationFailureV1>
  executeBatch(input: {
    readonly planId: string
    readonly decisionRef: string
    readonly confirmationText?: string | undefined
    readonly adminToken?: string | undefined
  }): Promise<{ readonly ok: true; readonly receipt: BatchReceiptV1 } | OrganizationFailureV1>
  undoBatch(input: { readonly receiptId: string }): Promise<{ readonly ok: true; readonly receipt: BatchReceiptV1 } | OrganizationFailureV1>
  unlockAdmin(): Promise<{ readonly ok: true; readonly token: string; readonly expiresAt: number } | OrganizationFailureV1>
}
