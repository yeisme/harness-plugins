/**
 * @yeisme/dsh-git-host.
 *
 * Typed Git actions for the Git Manager Pane. Canonical git state stays with
 * the repository owner. This host never runs arbitrary argv and never mutates
 * Ordo scheduler or writer-lease state.
 *
 * @module @yeisme/dsh-git-host
 */

export const GIT_TYPED_ACTIONS_CAPABILITY = 'GitTypedActionsCapabilityV1'
export const GIT_STATUS_PROJECTION_CAPABILITY_V2 = 'GitStatusProjectionCapabilityV2'
export const GIT_DIFF_WINDOW_CAPABILITY = 'GitDiffWindowCapabilityV1'
export const GIT_STATUS_WINDOW_CAPABILITY_V1 = 'GitStatusWindowCapabilityV1'
export const GIT_DIFF_WINDOW_CAPABILITY_V2 = 'GitDiffWindowCapabilityV2'
export const GIT_MUTATION_ACTIONS_CAPABILITY_V2 = 'GitMutationActionsCapabilityV2'
export const GIT_HISTORY_WINDOW_CAPABILITY_V1 = 'GitHistoryWindowCapabilityV1'
export const GIT_COMPARE_SESSION_CAPABILITY_V1 = 'GitCompareSessionCapabilityV1'
export const GIT_STASH_PROJECTION_CAPABILITY_V1 = 'GitStashProjectionCapabilityV1'
export const GIT_STASH_ACTIONS_CAPABILITY_V1 = 'GitStashActionsCapabilityV1'
export const GIT_TAG_PROJECTION_CAPABILITY_V1 = 'GitTagProjectionCapabilityV1'
export const GIT_TAG_ACTIONS_CAPABILITY_V1 = 'GitTagActionsCapabilityV1'
export const GIT_BRANCH_ACTIONS_CAPABILITY = 'GitBranchActionsCapabilityV1'
export const GIT_REMOTE_ACTIONS_CAPABILITY = 'GitRemoteActionsCapabilityV1'
export const GIT_WORKTREE_ACTIONS_CAPABILITY_V2 = 'GitWorktreeActionsCapabilityV2'

export const GIT_OPTIONAL_CAPABILITIES_V2 = [
  GIT_STATUS_PROJECTION_CAPABILITY_V2,
  GIT_DIFF_WINDOW_CAPABILITY,
  GIT_BRANCH_ACTIONS_CAPABILITY,
  GIT_REMOTE_ACTIONS_CAPABILITY,
  GIT_WORKTREE_ACTIONS_CAPABILITY_V2,
] as const

export type GitOptionalCapabilityV2 = (typeof GIT_OPTIONAL_CAPABILITIES_V2)[number]

export const GIT_REVIEW_WORKBENCH_CAPABILITIES_V1 = [
  GIT_STATUS_WINDOW_CAPABILITY_V1,
  GIT_DIFF_WINDOW_CAPABILITY_V2,
  GIT_MUTATION_ACTIONS_CAPABILITY_V2,
  GIT_HISTORY_WINDOW_CAPABILITY_V1,
  GIT_COMPARE_SESSION_CAPABILITY_V1,
  GIT_STASH_PROJECTION_CAPABILITY_V1,
  GIT_STASH_ACTIONS_CAPABILITY_V1,
  GIT_TAG_PROJECTION_CAPABILITY_V1,
  GIT_TAG_ACTIONS_CAPABILITY_V1,
] as const

export type GitReviewWorkbenchCapabilityV1 = (typeof GIT_REVIEW_WORKBENCH_CAPABILITIES_V1)[number]

export const GIT_TYPED_ACTIONS = [
  'status',
  'diff',
  'stage',
  'unstage',
  'commit',
  'worktree.create',
  'worktree.remove',
] as const

export type GitTypedActionId = (typeof GIT_TYPED_ACTIONS)[number]

export type GitActionAdmission =
  | { readonly kind: 'allowed'; readonly actionId: GitTypedActionId }
  | { readonly kind: 'approval_required'; readonly actionId: GitTypedActionId }
  | { readonly kind: 'not_available'; readonly actionId: string; readonly reason: string }
  | { readonly kind: 'contract_mismatch'; readonly reason: string }

export const GIT_GATED_ACTIONS: readonly GitTypedActionId[] = ['commit', 'worktree.create', 'worktree.remove']

export type GitActionStatus = 'ok' | 'rejected' | 'unknown' | 'not_available' | 'contract_mismatch'

export interface GitActionReceiptV1 {
  readonly status: GitActionStatus
  readonly actionId: string
  readonly reason?: string
  readonly idempotencyKey?: string
}

export interface GitDiffV1 {
  readonly path: string
  readonly patch: string
  readonly truncated: boolean
}

export interface GitStatusProjectionV2 {
  readonly repositoryRef: string
  readonly worktreeRef: string
  readonly branch: string
  readonly upstream?: string
  readonly ahead: number
  readonly behind: number
  readonly revision: string
  readonly cursor: string
  readonly conflictCount: number
  readonly stagedCount: number
  readonly unstagedCount: number
  readonly untrackedCount: number
}

export interface GitDiffWindowV1 {
  readonly fileRef: string
  readonly loaded: number
  readonly total: number
  readonly baseRevision: string
  readonly targetRevision: string
  readonly nextCursor?: string
}

export type GitProjectionFreshnessV1 = 'fresh' | 'partial' | 'stale' | 'offline'
export type GitStatusGroupV1 = 'merge' | 'staged' | 'changes' | 'untracked' | 'low_signal'
export type GitStatusCodeV1 = 'conflict' | 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'

export interface GitStatusGroupCountsV1 {
  readonly merge: number
  readonly staged: number
  readonly changes: number
  readonly untracked: number
  readonly lowSignal: number
}

export interface GitStatusFileWindowItemV1 {
  readonly fileRef: string
  readonly pathLabel: string
  readonly status: GitStatusCodeV1
  readonly group: GitStatusGroupV1
  readonly generated: boolean
  readonly lowSignal: boolean
  readonly hunkCount?: number
}

export interface GitStatusWindowRequestV1 {
  readonly repositoryRef: string
  readonly worktreeRef: string
  readonly cursor?: string
  readonly limit: number
}

export interface GitRepositoryContextV1 {
  readonly repositoryRef: string
  readonly worktreeRef: string
  readonly label: string
  readonly branch: string
  readonly agentWorktree: boolean
}

export interface GitStatusWindowV1 {
  readonly repositoryRef: string
  readonly worktreeRef: string
  readonly branch: string
  readonly upstream?: string
  readonly revision: string
  readonly cursor: string
  readonly sequence: number
  readonly freshness: GitProjectionFreshnessV1
  readonly counts: GitStatusGroupCountsV1
  readonly files: readonly GitStatusFileWindowItemV1[]
  readonly loaded: number
  readonly total: number
  readonly nextCursor?: string
}

export interface GitStatusWindowEventV1 {
  readonly repositoryRef: string
  readonly worktreeRef: string
  readonly revision: string
  readonly cursor: string
  readonly sequence: number
  readonly kind: 'changed' | 'stale' | 'reconcile_required'
}

export interface GitStatusWindowCapabilityV1 {
  readonly capability: typeof GIT_STATUS_WINDOW_CAPABILITY_V1
  repositories?(): Promise<readonly GitRepositoryContextV1[]>
  snapshot(request: GitStatusWindowRequestV1): Promise<GitStatusWindowV1>
  subscribe?(request: Omit<GitStatusWindowRequestV1, 'cursor' | 'limit'>, listener: (event: GitStatusWindowEventV1) => void): () => void
}

export type GitDiffLayoutV2 = 'unified' | 'side_by_side'
export type GitDiffRiskV2 = 'none' | 'secret_suspected'

export interface GitDiffHunkWindowV2 {
  readonly hunkRef: string
  readonly header: string
  readonly lines: readonly string[]
  readonly loaded: boolean
}

export interface GitDiffWindowRequestV2 {
  readonly repositoryRef: string
  readonly worktreeRef: string
  readonly fileRef: string
  readonly layout: GitDiffLayoutV2
  readonly cursor?: string
  readonly limit: number
}

export interface GitDiffWindowV2 {
  readonly repositoryRef: string
  readonly worktreeRef: string
  readonly fileRef: string
  readonly layout: GitDiffLayoutV2
  readonly baseRevision: string
  readonly targetRevision: string
  readonly currentRevision: string
  readonly cursor: string
  readonly freshness: GitProjectionFreshnessV1
  readonly hunks: readonly GitDiffHunkWindowV2[]
  readonly loaded: number
  readonly total: number
  readonly generated: boolean
  readonly binary: boolean
  readonly secretRisk: GitDiffRiskV2
  readonly allowedActions: readonly ('review' | 'feedback' | 'stage' | 'unstage' | 'share' | 'export')[]
  readonly nextCursor?: string
}

export interface GitDiffWindowCapabilityV2 {
  readonly capability: typeof GIT_DIFF_WINDOW_CAPABILITY_V2
  window(request: GitDiffWindowRequestV2): Promise<GitDiffWindowV2>
}

export type GitMutationActionV2 =
  | 'stage.file'
  | 'stage.hunk'
  | 'stage.all'
  | 'unstage.file'
  | 'unstage.hunk'
  | 'unstage.all'
  | 'discard.preflight'
  | 'discard.execute'
  | 'discard.undo'
  | 'commit.preflight'
  | 'commit.execute'

export interface GitMutationTargetV2 {
  readonly repositoryRef: string
  readonly worktreeRef: string
  readonly expectedRevision: string
  readonly fileRefs?: readonly string[]
  readonly hunkRefs?: readonly string[]
}

export interface GitMutationIntentV2 extends GitMutationTargetV2 {
  readonly action: GitMutationActionV2
  readonly previewDigest?: string
  readonly idempotencyKey: string
  readonly message?: string
  readonly overrideReason?: string
  readonly backupRef?: string
}

export interface GitMutationPreflightV2 {
  readonly action: GitMutationActionV2
  readonly repositoryRef: string
  readonly worktreeRef: string
  readonly revision: string
  readonly previewDigest: string
  readonly targetCount: number
  readonly branch: string
  readonly author?: string
  readonly signing: 'enabled' | 'disabled' | 'unknown'
  readonly hooks: 'required' | 'none' | 'unknown'
  readonly verification: 'passed' | 'failed' | 'pending' | 'not_required' | 'unknown'
  readonly risks: readonly string[]
  readonly allowed: boolean
  readonly reason?: string
  readonly expiresAt?: string
}

export interface GitMutationReceiptV3 {
  readonly status: 'ok' | 'rejected' | 'unknown' | 'timeout' | 'approval_required' | 'revision_drift' | 'reconcile_required'
  readonly action: GitMutationActionV2
  readonly idempotencyKey: string
  readonly revision?: string
  readonly receiptRef?: string
  readonly backupRef?: string
  readonly undoExpiresAt?: string
  readonly reason?: string
}

export interface GitMutationActionsCapabilityV2 {
  readonly capability: typeof GIT_MUTATION_ACTIONS_CAPABILITY_V2
  readonly actions: readonly GitMutationActionV2[]
  preflight(intent: GitMutationIntentV2): Promise<GitMutationPreflightV2>
  execute(intent: GitMutationIntentV2): Promise<GitMutationReceiptV3>
  reconcile(idempotencyKey: string): Promise<GitMutationReceiptV3 | undefined>
}

export interface GitHistoryWindowRequestV1 {
  readonly repositoryRef: string
  readonly worktreeRef: string
  readonly ref?: string
  readonly query?: string
  readonly cursor?: string
  readonly limit: number
}

export interface GitHistoryCommitV1 {
  readonly commitRef: string
  readonly parentRefs: readonly string[]
  readonly graph: string
  readonly message: string
  readonly refs: readonly string[]
  readonly author: string
  readonly authoredAt: string
  readonly additions: number
  readonly deletions: number
  readonly changedFiles: number
  readonly ordoEvidenceRefs?: readonly string[]
}

export interface GitHistoryWindowV1 {
  readonly repositoryRef: string
  readonly worktreeRef: string
  readonly revision: string
  readonly cursor: string
  readonly freshness: GitProjectionFreshnessV1
  readonly commits: readonly GitHistoryCommitV1[]
  readonly loaded: number
  readonly total: number
  readonly nextCursor?: string
}

export interface GitHistoryWindowCapabilityV1 {
  readonly capability: typeof GIT_HISTORY_WINDOW_CAPABILITY_V1
  window(request: GitHistoryWindowRequestV1): Promise<GitHistoryWindowV1>
}

export interface GitCompareSessionV1 {
  readonly sessionRef: string
  readonly repositoryRef: string
  readonly worktreeRef: string
  readonly baseRef: string
  readonly targetRef: string
  readonly revision: string
  readonly query?: string
  readonly layout: GitDiffLayoutV2
  readonly pinned: boolean
}

export interface GitCompareSessionCapabilityV1 {
  readonly capability: typeof GIT_COMPARE_SESSION_CAPABILITY_V1
  create(input: Omit<GitCompareSessionV1, 'sessionRef'>): Promise<GitCompareSessionV1>
}

export type GitStashActionV1 = 'create' | 'apply' | 'pop' | 'drop'
export type GitTagActionV1 = 'create' | 'delete' | 'push'

export interface GitStashProjectionCapabilityV1 {
  readonly capability: typeof GIT_STASH_PROJECTION_CAPABILITY_V1
  readonly freshness: GitProjectionFreshnessV1
  readonly stashRefs: readonly string[]
}

export interface GitStashActionsCapabilityV1 {
  readonly capability: typeof GIT_STASH_ACTIONS_CAPABILITY_V1
  readonly actions: readonly GitStashActionV1[]
}

export interface GitTagProjectionCapabilityV1 {
  readonly capability: typeof GIT_TAG_PROJECTION_CAPABILITY_V1
  readonly freshness: GitProjectionFreshnessV1
  readonly tagRefs: readonly string[]
}

export interface GitTagActionsCapabilityV1 {
  readonly capability: typeof GIT_TAG_ACTIONS_CAPABILITY_V1
  readonly actions: readonly GitTagActionV1[]
  readonly defaultKind: 'annotated'
  readonly signing: 'repository_config'
}

export interface GitBranchActionsCapabilityV1 {
  readonly capability: typeof GIT_BRANCH_ACTIONS_CAPABILITY
  readonly actions: readonly ('list' | 'create' | 'switch' | 'delete')[]
}

export interface GitRemoteActionsCapabilityV1 {
  readonly capability: typeof GIT_REMOTE_ACTIONS_CAPABILITY
  readonly actions: readonly ('fetch' | 'pull' | 'push')[]
}

export interface GitWorktreeActionsCapabilityV2 {
  readonly capability: typeof GIT_WORKTREE_ACTIONS_CAPABILITY_V2
  readonly actions: readonly ('list' | 'create' | 'remove')[]
  readonly releasesOrdoLease: false
}

export interface GitStatusProjectionCapabilityV2 {
  readonly capability: typeof GIT_STATUS_PROJECTION_CAPABILITY_V2
  snapshot(): Promise<GitStatusProjectionV2>
}

export interface GitDiffWindowCapabilityV1 {
  readonly capability: typeof GIT_DIFF_WINDOW_CAPABILITY
  window(fileRef: string, cursor?: string): Promise<GitDiffWindowV1>
}

export interface GitHostV1 {
  readonly version: '0.1.0-rc.1'
  readonly capability: 'git-host'
  readonly capabilities?: readonly string[]
  readonly allowedActions?: readonly GitTypedActionId[]
  status?(): Promise<{ readonly branch: string; readonly files: readonly unknown[] }>
  diff?(path: string): Promise<GitDiffV1>
  stage?(path: string): Promise<GitActionReceiptV1>
  unstage?(path: string): Promise<GitActionReceiptV1>
  commit?(message: string, idempotencyKey?: string): Promise<GitActionReceiptV1>
  statusProjection?: GitStatusProjectionCapabilityV2
  diffWindow?: GitDiffWindowCapabilityV1
  statusWindow?: GitStatusWindowCapabilityV1
  diffWindowV2?: GitDiffWindowCapabilityV2
  mutationActionsV2?: GitMutationActionsCapabilityV2
  historyWindow?: GitHistoryWindowCapabilityV1
  compareSession?: GitCompareSessionCapabilityV1
  stashProjection?: GitStashProjectionCapabilityV1
  stashActions?: GitStashActionsCapabilityV1
  tagProjection?: GitTagProjectionCapabilityV1
  tagActions?: GitTagActionsCapabilityV1
  branchActions?: GitBranchActionsCapabilityV1
  remoteActions?: GitRemoteActionsCapabilityV1
  worktreeActions?: GitWorktreeActionsCapabilityV2
}

export interface GitCapabilityProbeV1 {
  readonly available: boolean
  readonly capability: string
  readonly reason: string
}

const TYPED = new Set<string>(GIT_TYPED_ACTIONS)
const GATED = new Set<string>(GIT_GATED_ACTIONS)

export function isGitTypedAction(actionId: string): actionId is GitTypedActionId {
  return TYPED.has(actionId)
}

const OPAQUE_GIT_REF = /^[A-Za-z0-9._~:-]{1,160}$/

export function isSafeGitOpaqueRef(value: string): boolean {
  return OPAQUE_GIT_REF.test(value) && !value.startsWith('/') && !value.includes('--') && !value.includes(' ')
}

export function probeGitOptionalCapability(host: GitHostV1 | undefined, capability: GitOptionalCapabilityV2): GitCapabilityProbeV1 {
  if (host === undefined) return { available: false, capability, reason: 'git owner is offline' }
  const advertised = host.capabilities ?? []
  if (!advertised.includes(capability)) return { available: false, capability, reason: `missing ${capability}` }
  const present = capability === GIT_STATUS_PROJECTION_CAPABILITY_V2 ? host.statusProjection !== undefined
    : capability === GIT_DIFF_WINDOW_CAPABILITY ? host.diffWindow !== undefined
      : capability === GIT_BRANCH_ACTIONS_CAPABILITY ? host.branchActions !== undefined
        : capability === GIT_REMOTE_ACTIONS_CAPABILITY ? host.remoteActions !== undefined
          : host.worktreeActions !== undefined
  if (!present) return { available: false, capability, reason: `missing ${capability} handle` }
  return { available: true, capability, reason: `${capability} available` }
}

export function probeGitReviewWorkbenchCapability(host: GitHostV1 | undefined, capability: GitReviewWorkbenchCapabilityV1): GitCapabilityProbeV1 {
  if (host === undefined) return { available: false, capability, reason: 'git owner is offline' }
  if (!(host.capabilities ?? []).includes(capability)) return { available: false, capability, reason: `missing ${capability}` }
  const handle = capability === GIT_STATUS_WINDOW_CAPABILITY_V1 ? host.statusWindow
    : capability === GIT_DIFF_WINDOW_CAPABILITY_V2 ? host.diffWindowV2
      : capability === GIT_MUTATION_ACTIONS_CAPABILITY_V2 ? host.mutationActionsV2
        : capability === GIT_HISTORY_WINDOW_CAPABILITY_V1 ? host.historyWindow
          : capability === GIT_COMPARE_SESSION_CAPABILITY_V1 ? host.compareSession
            : capability === GIT_STASH_PROJECTION_CAPABILITY_V1 ? host.stashProjection
              : capability === GIT_STASH_ACTIONS_CAPABILITY_V1 ? host.stashActions
                : capability === GIT_TAG_PROJECTION_CAPABILITY_V1 ? host.tagProjection
                  : host.tagActions
  return handle === undefined
    ? { available: false, capability, reason: `missing ${capability} handle` }
    : { available: true, capability, reason: `${capability} available` }
}

export function validateGitWindowRequest(request: GitStatusWindowRequestV1 | GitHistoryWindowRequestV1 | GitDiffWindowRequestV2): boolean {
  if (!isSafeGitOpaqueRef(request.repositoryRef) || !isSafeGitOpaqueRef(request.worktreeRef)) return false
  if (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > 500) return false
  if (request.cursor !== undefined && !isSafeGitOpaqueRef(request.cursor)) return false
  if ('fileRef' in request && !isSafeGitOpaqueRef(request.fileRef)) return false
  if ('ref' in request && request.ref !== undefined && !isSafeGitOpaqueRef(request.ref)) return false
  return true
}

export function validateGitMutationIntentV2(intent: GitMutationIntentV2): boolean {
  if (!isSafeGitOpaqueRef(intent.repositoryRef) || !isSafeGitOpaqueRef(intent.worktreeRef)) return false
  if (!isSafeGitOpaqueRef(intent.expectedRevision) || !isSafeGitOpaqueRef(intent.idempotencyKey)) return false
  if (intent.previewDigest !== undefined && !isSafeGitOpaqueRef(intent.previewDigest)) return false
  if (intent.backupRef !== undefined && !isSafeGitOpaqueRef(intent.backupRef)) return false
  if (intent.fileRefs?.some(ref => !isSafeGitOpaqueRef(ref)) === true) return false
  if (intent.hunkRefs?.some(ref => !isSafeGitOpaqueRef(ref)) === true) return false
  const text = `${intent.message ?? ''}|${intent.overrideReason ?? ''}`
  return !/authorization|cookie|token|file:\/\//i.test(text) && !text.includes('--')
}

export function gitDiffRevisionDriftV2(window: Pick<GitDiffWindowV2, 'targetRevision' | 'currentRevision'>): boolean {
  return window.targetRevision !== window.currentRevision
}

export function gitDiscardUndoRetentionHours(): 24 {
  return 24
}

export function gitMutationV2AutoStagesCommit(): false {
  return false
}

export function gitMutationV2AutoRetriesTimeout(): false {
  return false
}

export function validateGitTypedActionId(actionId: string): boolean {
  return isGitTypedAction(actionId) && !actionId.includes(' ') && !actionId.includes('--')
}

export function admitGitAction(host: GitHostV1 | undefined, actionId: string): GitActionAdmission {
  if (host === undefined) {
    return { kind: 'not_available', actionId, reason: 'git owner is offline' }
  }
  const capabilities = host.capabilities ?? []
  if (!capabilities.includes(GIT_TYPED_ACTIONS_CAPABILITY)) {
    return { kind: 'contract_mismatch', reason: `missing ${GIT_TYPED_ACTIONS_CAPABILITY}` }
  }
  if (!isGitTypedAction(actionId) || actionId.includes(' ') || actionId.includes('--')) {
    return { kind: 'not_available', actionId, reason: 'arbitrary git argv is rejected' }
  }
  const allowed = host.allowedActions ?? GIT_TYPED_ACTIONS
  if (!allowed.includes(actionId)) {
    return { kind: 'not_available', actionId, reason: 'owner did not publish this action' }
  }
  if (GATED.has(actionId)) return { kind: 'approval_required', actionId }
  return { kind: 'allowed', actionId }
}

/** Git worktree delete must never be interpreted as an Ordo lease mutation. */
export function gitWorktreeRemoveReleasesOrdoLease(): false {
  return false
}

export function createGitHostPlaceholder(): GitHostV1 {
  return {
    version: '0.1.0-rc.1',
    capability: 'git-host',
    capabilities: [],
    allowedActions: [],
  }
}
