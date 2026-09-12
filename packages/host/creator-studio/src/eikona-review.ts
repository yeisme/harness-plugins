import { z } from 'zod'

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u)
const candidate = z.object({
  decision_state: z.enum(['pending', 'accepted', 'rejected', 'request_revision', 'stale']).optional(),
  candidate_id: identifier, label: z.string().max(4096),
  artifact_ref: z.string().regex(/^eikona:\/\/artifacts\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u).max(480).optional(),
  content_digest: z.string().regex(/^[a-f0-9]{64}$/u).optional(),
  decision_version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
})
const review = z.object({
  schema_version: z.literal('eikona.review_projection.v1'), run_id: identifier, project_id: identifier.optional(),
  candidates: z.array(candidate).max(200), observed_at: z.string().datetime({ offset: true }),
  owner_decision: z.object({ state: z.enum(['pending', 'accepted', 'rejected', 'request_revision', 'stale']) }),
  admission_state: z.object({ state: z.enum(['unknown', 'pending', 'admitted', 'refused']) }),
  permission: z.object({ can_decide: z.boolean(), can_supersede: z.boolean(), role: identifier }),
})

/** Normalize only bounded control-plane fields; machine hints never become decisions. */
export function inspectEikonaReview(input: unknown, scope: { runId: string; ownerProjectRef: string }) {
  const parsed = review.safeParse(input)
  if (!parsed.success) return { status: 'needs_contract' as const }
  const value = parsed.data
  if (value.run_id !== scope.runId || value.project_id !== scope.ownerProjectRef) return { status: 'permission_denied' as const }
  if (new Set(value.candidates.map(item => item.candidate_id)).size !== value.candidates.length) return { status: 'needs_contract' as const }
  for (const item of value.candidates) {
    if (item.decision_state !== undefined && (item.decision_version === undefined
      || (item.decision_version === 0 ? item.decision_state !== 'pending' : item.decision_state === 'pending'))) return { status: 'needs_contract' as const }
    if ((item.artifact_ref === undefined) !== (item.content_digest === undefined)
      || (item.artifact_ref !== undefined && item.artifact_ref !== `eikona://artifacts/${value.run_id}/${item.candidate_id}`)) return { status: 'needs_contract' as const }
  }
  return { status: 'ready' as const, runId: value.run_id, projectId: value.project_id, observedAt: value.observed_at,
    ownerDecision: value.owner_decision.state, admissionState: value.admission_state.state,
    canDecide: value.permission.can_decide, canSupersede: value.permission.can_supersede,
    candidates: value.candidates.map(item => ({ candidateId: item.candidate_id, label: item.label,
      ...(item.artifact_ref === undefined ? {} : { artifactRef: item.artifact_ref, contentDigest: item.content_digest! }),
      ...(item.decision_state === undefined ? {} : { decisionState: item.decision_state }),
      ...(item.decision_version === undefined ? {} : { decisionVersion: item.decision_version }),
    })),
  }
}
