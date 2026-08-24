import { describe, expect, it } from 'vitest'
import {
  GIT_BRANCH_ACTIONS_CAPABILITY,
  GIT_REMOTE_ACTIONS_CAPABILITY,
  GIT_TYPED_ACTIONS_CAPABILITY,
  GIT_WORKTREE_ACTIONS_CAPABILITY_V2,
  type GitHostV1,
} from '../src/index.ts'
import {
  admitGitBranchMutation,
  admitGitMutationIntent,
  admitGitRemoteAction,
  admitGitWorktreeMutation,
  createGitRemotePreflight,
  gitMutationTimeoutIsSuccess,
  gitMutationTimeoutShouldRetry,
  gitPaneReleasesOrdoLease,
  gitRemoteForcePushDefault,
  reconcileGitMutationReceipt,
  validateGitMutationIntent,
} from '../src/mutation.ts'

function host(extra: Partial<GitHostV1> = {}): GitHostV1 {
  return {
    version: '0.1.0-rc.1',
    capability: 'git-host',
    capabilities: [GIT_TYPED_ACTIONS_CAPABILITY],
    allowedActions: ['stage', 'unstage', 'commit'],
    ...extra,
  }
}

describe('V4 Git mutation gateway', () => {
  it('admits typed stage intents and fail-closes revision drift', () => {
    const intent = {
      kind: 'stage' as const,
      repositoryRef: 'repo:one',
      worktreeRef: 'wt:one',
      expectedRevision: 'rev1',
      previewDigest: 'digest1',
      idempotencyKey: 'idemp-1',
      fileRef: 'file:a',
    }
    expect(validateGitMutationIntent(intent)).toBe(true)
    expect(admitGitMutationIntent(host(), intent, 'rev1').kind).toBe('allowed')
    expect(admitGitMutationIntent(host(), intent, 'rev2').kind).toBe('revision_drift')
    expect(admitGitMutationIntent(host(), { ...intent, kind: 'discard' }).kind).toBe('approval_required')
  })

  it('does not mark timeout as success or retry it', () => {
    const intent = {
      kind: 'commit' as const,
      repositoryRef: 'repo:one',
      worktreeRef: 'wt:one',
      expectedRevision: 'rev1',
      previewDigest: 'digest1',
      idempotencyKey: 'idemp-9',
    }
    const receipt = reconcileGitMutationReceipt(intent, undefined, { timedOut: true })
    expect(receipt.status).toBe('timeout')
    expect(gitMutationTimeoutIsSuccess()).toBe(false)
    expect(gitMutationTimeoutShouldRetry()).toBe(false)
  })

  it('gates branch, worktree and remote actions without force push or lease release', () => {
    const full = host({
      capabilities: [
        GIT_TYPED_ACTIONS_CAPABILITY,
        GIT_BRANCH_ACTIONS_CAPABILITY,
        GIT_REMOTE_ACTIONS_CAPABILITY,
        GIT_WORKTREE_ACTIONS_CAPABILITY_V2,
      ],
      branchActions: { capability: GIT_BRANCH_ACTIONS_CAPABILITY, actions: ['list', 'create', 'switch', 'delete'] },
      remoteActions: { capability: GIT_REMOTE_ACTIONS_CAPABILITY, actions: ['fetch', 'pull', 'push'] },
      worktreeActions: { capability: GIT_WORKTREE_ACTIONS_CAPABILITY_V2, actions: ['list', 'create', 'remove'], releasesOrdoLease: false },
    })
    expect(admitGitBranchMutation(full, 'delete').kind).toBe('approval_required')
    expect(admitGitRemoteAction(full, 'push').kind).toBe('approval_required')
    expect(admitGitWorktreeMutation(full, 'remove', { active: true, deepLink: 'ordo://lease/1' }).kind).toBe('lease_blocked')
    expect(gitPaneReleasesOrdoLease()).toBe(false)
    expect(createGitRemotePreflight('push', 'origin', 'main')?.force).toBe(false)
    expect(gitRemoteForcePushDefault()).toBe(false)
    expect(admitGitRemoteAction(host(), 'push').kind).toBe('not_available')
  })
})
