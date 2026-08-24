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
