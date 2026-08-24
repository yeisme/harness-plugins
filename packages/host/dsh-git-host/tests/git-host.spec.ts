import { describe, expect, it } from 'vitest'
import {
  admitGitAction,
  createGitHostPlaceholder,
  GIT_BRANCH_ACTIONS_CAPABILITY,
  GIT_DIFF_WINDOW_CAPABILITY,
  GIT_REMOTE_ACTIONS_CAPABILITY,
  GIT_STATUS_PROJECTION_CAPABILITY_V2,
  GIT_TYPED_ACTIONS_CAPABILITY,
  GIT_WORKTREE_ACTIONS_CAPABILITY_V2,
  gitWorktreeRemoveReleasesOrdoLease,
  probeGitOptionalCapability,
  validateGitTypedActionId,
  type GitHostV1,
} from '../src/index.ts'

describe('@yeisme/dsh-git-host', () => {
  it('fails closed without GitTypedActionsCapabilityV1', () => {
    expect(admitGitAction(createGitHostPlaceholder(), 'status')).toMatchObject({ kind: 'contract_mismatch' })
    expect(admitGitAction(undefined, 'status').kind).toBe('not_available')
  })

  it('rejects arbitrary argv and unknown actions', () => {
    const host: GitHostV1 = {
      version: '0.1.0-rc.1',
      capability: 'git-host',
      capabilities: [GIT_TYPED_ACTIONS_CAPABILITY],
      allowedActions: ['status', 'commit'],
    }
    expect(admitGitAction(host, 'git status --porcelain')).toMatchObject({ kind: 'not_available' })
    expect(admitGitAction(host, 'rebase')).toMatchObject({ kind: 'not_available' })
    expect(admitGitAction(host, 'status')).toEqual({ kind: 'allowed', actionId: 'status' })
    expect(admitGitAction(host, 'commit')).toEqual({ kind: 'approval_required', actionId: 'commit' })
  })

  it('never maps worktree.remove to an Ordo lease mutation', () => {
    expect(gitWorktreeRemoveReleasesOrdoLease()).toBe(false)
  })

  it('probes optional V2 capabilities independently and still rejects argv', () => {
    const host: GitHostV1 = {
      version: '0.1.0-rc.1',
      capability: 'git-host',
      capabilities: [
        GIT_TYPED_ACTIONS_CAPABILITY,
        GIT_STATUS_PROJECTION_CAPABILITY_V2,
        GIT_DIFF_WINDOW_CAPABILITY,
      ],
      allowedActions: ['status'],
      statusProjection: {
        capability: GIT_STATUS_PROJECTION_CAPABILITY_V2,
        async snapshot() {
          return {
            repositoryRef: 'repo:one',
            worktreeRef: 'wt:one',
            branch: 'main',
            ahead: 0,
            behind: 0,
            revision: 'rev1',
            cursor: 'c1',
            conflictCount: 0,
            stagedCount: 0,
            unstagedCount: 0,
            untrackedCount: 0,
          }
        },
      },
      diffWindow: {
        capability: GIT_DIFF_WINDOW_CAPABILITY,
        async window(fileRef) {
          return {
            fileRef,
            loaded: 1,
            total: 1,
            baseRevision: 'a',
            targetRevision: 'b',
          }
        },
      },
    }
    expect(probeGitOptionalCapability(host, GIT_STATUS_PROJECTION_CAPABILITY_V2).available).toBe(true)
    expect(probeGitOptionalCapability(host, GIT_DIFF_WINDOW_CAPABILITY).available).toBe(true)
    expect(probeGitOptionalCapability(host, GIT_BRANCH_ACTIONS_CAPABILITY).available).toBe(false)
    expect(probeGitOptionalCapability(host, GIT_REMOTE_ACTIONS_CAPABILITY).available).toBe(false)
    expect(probeGitOptionalCapability(host, GIT_WORKTREE_ACTIONS_CAPABILITY_V2).available).toBe(false)
    expect(validateGitTypedActionId('status')).toBe(true)
    expect(validateGitTypedActionId('git status --porcelain')).toBe(false)
    expect(admitGitAction(host, 'push --force')).toMatchObject({ kind: 'not_available' })
  })
})
