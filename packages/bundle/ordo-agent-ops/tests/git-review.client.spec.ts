import { describe, expect, it } from 'vitest'
import {
  deriveGitFileReviewed,
  evaluateGitCommitReadiness,
  gitReviewEventNeedsSnapshot,
  gitReviewPaneReleasesLease,
  sortGitReviewQueue,
  type GitReviewQueueRowV1,
} from '../src/client/git-review.ts'

function row(overrides: Partial<GitReviewQueueRowV1> = {}): GitReviewQueueRowV1 {
  return {
    queueRef: 'queue:one',
    repositoryRef: 'repo:one',
    worktreeRef: 'wt:one',
    revision: 'rev:one',
    branch: 'feature/review',
    leaseActive: true,
    paused: false,
    conflictCount: 0,
    reviewableHunkCount: 1,
    reviewedHunkCount: 1,
    verification: 'passed',
    feedback: [],
    hunks: [{ fileRef: 'file:one', hunkRef: 'hunk:one', revision: 'rev:one', reviewed: true }],
    approvalPending: false,
    lastActivityAt: '2026-08-28T10:00:00.000Z',
    overrideEvidenceRefs: [],
    risk: 'none',
    ...overrides,
  }
}

describe('GitReviewEvidenceCapabilityV1 client model', () => {
  it('sorts conflicts before drift, verification, feedback and approval', () => {
    const sorted = sortGitReviewQueue([
      row({ queueRef: 'approval', risk: 'approval' }),
      row({ queueRef: 'feedback', risk: 'feedback' }),
      row({ queueRef: 'conflict', risk: 'conflict' }),
      row({ queueRef: 'drift', risk: 'revision_drift' }),
      row({ queueRef: 'verification', risk: 'verification_failed' }),
    ])
    expect(sorted.map(item => item.queueRef)).toEqual(['conflict', 'drift', 'verification', 'feedback', 'approval'])
  })

  it('invalidates hunk review on revision drift and aggregates current hunks only', () => {
    const evidence = row()
    expect(deriveGitFileReviewed(evidence, 'file:one', 'rev:one')).toBe(true)
    expect(deriveGitFileReviewed(evidence, 'file:one', 'rev:two')).toBe(false)
  })

  it('requires the complete Agent readiness gate but not for ordinary worktrees', () => {
    expect(evaluateGitCommitReadiness(row(), 'rev:one', { agentWorktree: true, ordoOnline: true }).ready).toBe(true)
    const blocked = evaluateGitCommitReadiness(row({ verification: 'failed', feedback: [{
      feedbackRef: 'feedback:one', fileRef: 'file:one', revision: 'rev:one', summary: 'add a test', state: 'open', evidenceRef: 'evidence:one',
    }] }), 'rev:one', { agentWorktree: true, ordoOnline: true })
    expect(blocked.ready).toBe(false)
    expect(blocked.overrideAllowed).toBe(true)
    expect(evaluateGitCommitReadiness(undefined, 'rev:any', { agentWorktree: false, ordoOnline: false }).ready).toBe(true)
  })

  it('requires a snapshot on cursor gaps and never releases a lease', () => {
    expect(gitReviewEventNeedsSnapshot(4, { cursor: 'cursor:6', sequence: 6, kind: 'changed' })).toBe(true)
    expect(gitReviewEventNeedsSnapshot(4, { cursor: 'cursor:5', sequence: 5, kind: 'changed' })).toBe(false)
    expect(gitReviewPaneReleasesLease()).toBe(false)
  })

  it('sorts a 2,000-item queue window without changing the input', () => {
    const input = Array.from({ length: 2_000 }, (_, index) => row({ queueRef: `queue:${index}`, risk: index === 1_999 ? 'conflict' : 'none', lastActivityAt: new Date(1_700_000_000_000 + index).toISOString() }))
    const sorted = sortGitReviewQueue(input)
    expect(sorted[0]?.queueRef).toBe('queue:1999')
    expect(input[0]?.queueRef).toBe('queue:0')
  })
})
