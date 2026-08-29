/** Safe DSH projection for Ordo-owned Git review facts. It owns no canonical state. */

export const GIT_REVIEW_EVIDENCE_CAPABILITY_V1 = 'GitReviewEvidenceCapabilityV1'

export type GitReviewFreshnessV1 = 'fresh' | 'partial' | 'stale' | 'offline'
export type GitVerificationStateV1 = 'passed' | 'failed' | 'pending' | 'not_required' | 'unknown'
export type GitReviewRiskV1 = 'conflict' | 'revision_drift' | 'verification_failed' | 'feedback' | 'approval' | 'none'

export interface GitReviewHunkEvidenceV1 {
  readonly fileRef: string
  readonly hunkRef: string
  readonly revision: string
  readonly reviewed: boolean
  readonly evidenceRef?: string
}

export interface GitReviewFeedbackV1 {
  readonly feedbackRef: string
  readonly fileRef: string
  readonly hunkRef?: string
  readonly revision: string
  readonly summary: string
  readonly state: 'open' | 'resolved'
  readonly evidenceRef: string
}

export interface GitReviewWorktreeEvidenceV1 {
  readonly repositoryRef: string
  readonly worktreeRef: string
  readonly revision: string
  readonly taskRef?: string
  readonly taskLabel?: string
  readonly agentRef?: string
  readonly agentLabel?: string
  readonly branch: string
  readonly leaseRef?: string
  readonly leaseActive: boolean
  readonly paused: boolean
  readonly conflictCount: number
  readonly reviewableHunkCount: number
  readonly reviewedHunkCount: number
  readonly verification: GitVerificationStateV1
  readonly feedback: readonly GitReviewFeedbackV1[]
  readonly hunks: readonly GitReviewHunkEvidenceV1[]
  readonly approvalPending: boolean
  readonly lastActivityAt: string
  readonly overrideEvidenceRefs: readonly string[]
}

export interface GitReviewQueueRowV1 extends GitReviewWorktreeEvidenceV1 {
  readonly queueRef: string
  readonly risk: GitReviewRiskV1
}

export interface GitReviewEvidenceSnapshotV1 {
  readonly workspaceRef: string
  readonly cursor: string
  readonly sequence: number
  readonly freshness: GitReviewFreshnessV1
  readonly rows: readonly GitReviewQueueRowV1[]
  readonly loaded: number
  readonly total: number
  readonly nextCursor?: string
}

export interface GitReviewEvidenceEventV1 {
  readonly cursor: string
  readonly sequence: number
  readonly kind: 'changed' | 'stale' | 'reconcile_required'
}

export interface GitReviewActionReceiptV1 {
  readonly status: 'ok' | 'rejected' | 'unknown' | 'approval_required' | 'revision_drift' | 'reconcile_required'
  readonly action: 'review.hunk' | 'feedback.create' | 'feedback.resolve' | 'agent.pause' | 'agent.resume' | 'commit.override'
  readonly idempotencyKey: string
  readonly evidenceRef?: string
  readonly reason?: string
}

export interface GitReviewEvidenceCapabilityV1 {
  readonly capability: typeof GIT_REVIEW_EVIDENCE_CAPABILITY_V1
  snapshot(input: { readonly workspaceRef: string; readonly cursor?: string; readonly limit: number }): Promise<GitReviewEvidenceSnapshotV1>
  subscribe?(input: { readonly workspaceRef: string }, listener: (event: GitReviewEvidenceEventV1) => void): () => void
  dispatch?(intent: {
    readonly action: GitReviewActionReceiptV1['action']
    readonly repositoryRef: string
    readonly worktreeRef: string
    readonly expectedRevision: string
    readonly idempotencyKey: string
    readonly fileRef?: string
    readonly hunkRef?: string
    readonly feedbackRef?: string
    readonly summary?: string
    readonly reason?: string
  }): Promise<GitReviewActionReceiptV1>
}

export interface GitCommitReadinessV1 {
  readonly ready: boolean
  readonly reasons: readonly string[]
  readonly overrideAllowed: boolean
}

const RISK_WEIGHT: Readonly<Record<GitReviewRiskV1, number>> = {
  conflict: 5,
  revision_drift: 4,
  verification_failed: 3,
  feedback: 2,
  approval: 1,
  none: 0,
}

export function sortGitReviewQueue(rows: readonly GitReviewQueueRowV1[]): readonly GitReviewQueueRowV1[] {
  return [...rows].sort((left, right) => {
    const risk = RISK_WEIGHT[right.risk] - RISK_WEIGHT[left.risk]
    if (risk !== 0) return risk
    return Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt)
  })
}

export function gitReviewRevisionDrift(evidence: GitReviewWorktreeEvidenceV1, currentRevision: string): boolean {
  return evidence.revision !== currentRevision
}

export function deriveGitFileReviewed(
  evidence: GitReviewWorktreeEvidenceV1,
  fileRef: string,
  currentRevision: string,
): boolean {
  const hunks = evidence.hunks.filter(hunk => hunk.fileRef === fileRef && hunk.revision === currentRevision)
  return hunks.length > 0 && hunks.every(hunk => hunk.reviewed)
}

export function evaluateGitCommitReadiness(
  evidence: GitReviewWorktreeEvidenceV1 | undefined,
  currentRevision: string,
  options: { readonly agentWorktree: boolean; readonly ordoOnline: boolean },
): GitCommitReadinessV1 {
  if (!options.agentWorktree) return { ready: true, reasons: [], overrideAllowed: false }
  const reasons: string[] = []
  if (!options.ordoOnline || evidence === undefined) reasons.push('Ordo review evidence is offline')
  if (evidence !== undefined) {
    if (evidence.conflictCount > 0) reasons.push('conflicts must be resolved')
    if (gitReviewRevisionDrift(evidence, currentRevision)) reasons.push('revision drift requires reconcile')
    if (evidence.reviewableHunkCount === 0 || evidence.reviewedHunkCount < evidence.reviewableHunkCount) reasons.push('all current hunks must be reviewed')
    if (evidence.verification !== 'passed') reasons.push('verification must pass')
    if (evidence.feedback.some(item => item.state === 'open')) reasons.push('review feedback must be resolved')
  }
  return { ready: reasons.length === 0, reasons, overrideAllowed: reasons.length > 0 && options.ordoOnline && evidence !== undefined }
}

export function gitReviewEventNeedsSnapshot(currentSequence: number, event: GitReviewEvidenceEventV1): boolean {
  return event.kind !== 'changed' || (currentSequence > 0 && event.sequence !== currentSequence + 1)
}

export function gitReviewPaneReleasesLease(): false {
  return false
}
