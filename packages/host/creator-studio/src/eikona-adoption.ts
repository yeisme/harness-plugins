import { z } from 'zod'
import { eikonaReviewResultSchema } from './eikona-review-contract.ts'
import type { inspectEikonaDiscovery } from './eikona-discovery.ts'

const selectedImage = z.object({
  artifactRef: z.string().regex(/^eikona:\/\/artifacts\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u).max(480),
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/u),
}).strict()

/** Map current owner observations to a request body; this never grants or submits an action. */
export function prepareEikonaAdoption(discovery: ReturnType<typeof inspectEikonaDiscovery>, reviewInput: unknown, selectedInput: unknown) {
  const review = eikonaReviewResultSchema.safeParse(reviewInput), selected = selectedImage.safeParse(selectedInput)
  if (!review.success || review.data.status !== 'ready' || !selected.success) return { status: 'needs_contract' as const }
  if (discovery.status !== 'inspected') return { status: 'needs_contract' as const }
  const operation = discovery.operations.find(item => item.action === 'eikona.review.decide' && item.contractId === 'eikona.review.decide.v1')
  if (operation?.readiness !== 'requires_authorization' || !operation.supportsExpectedContentDigest) return { status: 'needs_contract' as const }
  const value = review.data
  if (!value.canDecide) return { status: 'permission_denied' as const }
  const candidate = value.candidates.find(item => item.artifactRef === selected.data.artifactRef && item.contentDigest === selected.data.contentDigest)
  if (!candidate || candidate.decisionVersion === undefined) return { status: 'unconfirmed' as const }
  if (candidate.decisionState === undefined) return { status: 'unconfirmed' as const }
  if (candidate.decisionState === 'accepted' || candidate.decisionState === 'rejected' || candidate.decisionState === 'stale') return { status: 'already_decided' as const }
  if (candidate.decisionVersion === 0 && !operation.supportsRequireNoDecision) return { status: 'needs_contract' as const }
  return { status: 'prepared' as const, executionAuthorized: false as const,
    artifactRef: selected.data.artifactRef, observedAt: value.observedAt,
    request: { project_ref: value.projectId, asset_ref: value.runId, review_version: candidate.candidateId,
      decision: 'accept' as const, expected_content_digest: selected.data.contentDigest,
      ...(candidate.decisionVersion === 0 ? { require_no_decision: true as const } : { expected_version: String(candidate.decisionVersion) }),
    },
  }
}
