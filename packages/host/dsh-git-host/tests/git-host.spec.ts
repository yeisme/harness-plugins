import { describe, expect, it } from 'vitest'
import {
  admitGitAction,
  createGitHostPlaceholder,
  GIT_BRANCH_ACTIONS_CAPABILITY,
  GIT_COMPARE_SESSION_CAPABILITY_V1,
  GIT_DIFF_WINDOW_CAPABILITY,
  GIT_DIFF_WINDOW_CAPABILITY_V2,
  GIT_HISTORY_WINDOW_CAPABILITY_V1,
  GIT_MUTATION_ACTIONS_CAPABILITY_V2,
  GIT_REMOTE_ACTIONS_CAPABILITY,
  GIT_STATUS_WINDOW_CAPABILITY_V1,
  GIT_STATUS_PROJECTION_CAPABILITY_V2,
  GIT_TYPED_ACTIONS_CAPABILITY,
  GIT_WORKTREE_ACTIONS_CAPABILITY_V2,
  gitDiffRevisionDriftV2,
  gitDiscardUndoRetentionHours,
  gitMutationV2AutoRetriesTimeout,
  gitMutationV2AutoStagesCommit,
  gitWorktreeRemoveReleasesOrdoLease,
  probeGitOptionalCapability,
  probeGitReviewWorkbenchCapability,
  validateGitMutationIntentV2,
  validateGitTypedActionId,
  validateGitWindowRequest,
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

  it('adds review-workbench capabilities without changing V1 fallback', () => {
    const host: GitHostV1 = {
      version: '0.1.0-rc.1',
      capability: 'git-host',
      capabilities: [GIT_STATUS_WINDOW_CAPABILITY_V1, GIT_DIFF_WINDOW_CAPABILITY_V2],
      statusWindow: {
        capability: GIT_STATUS_WINDOW_CAPABILITY_V1,
        async snapshot(request) {
          return {
            repositoryRef: request.repositoryRef,
            worktreeRef: request.worktreeRef,
            branch: 'main',
            revision: 'rev:one',
            cursor: 'cursor:one',
            sequence: 1,
            freshness: 'fresh',
            counts: { merge: 0, staged: 0, changes: 0, untracked: 0, lowSignal: 0 },
            files: [], loaded: 0, total: 0,
          }
        },
      },
      diffWindowV2: {
        capability: GIT_DIFF_WINDOW_CAPABILITY_V2,
        async window(request) {
          return {
            ...request,
            baseRevision: 'rev:base', targetRevision: 'rev:one', currentRevision: 'rev:one', cursor: 'cursor:diff',
            freshness: 'fresh', hunks: [], loaded: 0, total: 0, generated: false, binary: false, secretRisk: 'none', allowedActions: [],
          }
        },
      },
    }
    expect(probeGitReviewWorkbenchCapability(host, GIT_STATUS_WINDOW_CAPABILITY_V1).available).toBe(true)
    expect(probeGitReviewWorkbenchCapability(host, GIT_DIFF_WINDOW_CAPABILITY_V2).available).toBe(true)
    expect(probeGitReviewWorkbenchCapability(host, GIT_MUTATION_ACTIONS_CAPABILITY_V2).available).toBe(false)
    expect(probeGitReviewWorkbenchCapability(host, GIT_HISTORY_WINDOW_CAPABILITY_V1).available).toBe(false)
    expect(probeGitReviewWorkbenchCapability(host, GIT_COMPARE_SESSION_CAPABILITY_V1).available).toBe(false)
    expect(admitGitAction(host, 'status').kind).toBe('contract_mismatch')
  })

  it('validates bounded opaque windows and V2 mutation intents', () => {
    expect(validateGitWindowRequest({ repositoryRef: 'repo:one', worktreeRef: 'wt:one', limit: 200 })).toBe(true)
    expect(validateGitWindowRequest({ repositoryRef: '/tmp/repo', worktreeRef: 'wt:one', limit: 200 })).toBe(false)
    expect(validateGitWindowRequest({ repositoryRef: 'repo:one', worktreeRef: 'wt:one', limit: 10_000 })).toBe(false)
    expect(validateGitMutationIntentV2({
      action: 'stage.all', repositoryRef: 'repo:one', worktreeRef: 'wt:one', expectedRevision: 'rev:one', idempotencyKey: 'idempotency:one',
    })).toBe(true)
    expect(validateGitMutationIntentV2({
      action: 'commit.execute', repositoryRef: 'repo:one', worktreeRef: 'wt:one', expectedRevision: 'rev:one', idempotencyKey: 'idempotency:one', message: 'git commit --amend',
    })).toBe(false)
  })

  it('pins revision drift, no auto-stage/retry and 24 hour discard undo', () => {
    expect(gitDiffRevisionDriftV2({ targetRevision: 'rev:one', currentRevision: 'rev:two' })).toBe(true)
    expect(gitMutationV2AutoStagesCommit()).toBe(false)
    expect(gitMutationV2AutoRetriesTimeout()).toBe(false)
    expect(gitDiscardUndoRetentionHours()).toBe(24)
  })
})
