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
}

const TYPED = new Set<string>(GIT_TYPED_ACTIONS)
const GATED = new Set<string>(GIT_GATED_ACTIONS)

export function isGitTypedAction(actionId: string): actionId is GitTypedActionId {
  return TYPED.has(actionId)
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
