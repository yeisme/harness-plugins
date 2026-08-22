/**
 * Proposed DSH GitTypedActionsCapabilityV1.
 *
 * Upstream Host should expose only these action ids. Arbitrary argv is out of
 * contract. worktree.remove must not call Ordo lease.release.
 */

export const GIT_TYPED_ACTIONS_CAPABILITY = 'GitTypedActionsCapabilityV1' as const

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
