import { describe, expect, it } from 'vitest'
import {
  admitGitAction,
  createGitHostPlaceholder,
  GIT_TYPED_ACTIONS_CAPABILITY,
  gitWorktreeRemoveReleasesOrdoLease,
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
})
