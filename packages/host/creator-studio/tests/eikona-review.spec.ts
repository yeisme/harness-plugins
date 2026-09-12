import { expect, it } from 'vitest'
import { inspectEikonaReview } from '../src/eikona-review.ts'
import { eikonaReviewResultSchema } from '../src/eikona-review-contract.ts'

const scope = { runId: 'run', ownerProjectRef: 'project' }
function fixture() {
  return { schema_version: 'eikona.review_projection.v1', run_id: 'run', project_id: 'project', observed_at: '2026-09-08T00:00:00Z',
    owner_decision: { state: 'pending' }, admission_state: { state: 'unknown' }, permission: { can_decide: true, can_supersede: false, role: 'operator' },
    candidates: [{ candidate_id: 'one', label: 'Candidate', artifact_ref: 'eikona://artifacts/run/one', content_digest: 'a'.repeat(64), decision_version: 0 }],
  }
}
it('keeps fixed image and decision version without converting permission into adoption', () => {
  const value = inspectEikonaReview(fixture(), scope)
  expect(value.status).toBe('ready')
  if (value.status !== 'ready') throw new Error('missing projection')
  expect(value.candidates[0]).toMatchObject({ candidateId: 'one', decisionVersion: 0, contentDigest: 'a'.repeat(64) })
  expect(value.ownerDecision).toBe('pending'); expect(value.admissionState).toBe('unknown')
})
it('rejects foreign projects, duplicate candidates and mismatched artifact bindings', () => {
  expect(inspectEikonaReview(fixture(), { ...scope, ownerProjectRef: 'other' }).status).toBe('permission_denied')
  const duplicate = fixture(); duplicate.candidates.push(duplicate.candidates[0]!)
  expect(inspectEikonaReview(duplicate, scope).status).toBe('needs_contract')
  const wrong = fixture(); wrong.candidates[0]!.artifact_ref = 'eikona://artifacts/run/other'
  expect(inspectEikonaReview(wrong, scope).status).toBe('needs_contract')
})
it('preserves unknown legacy fields and strips unrelated owner metadata', () => {
  const input = { ...fixture(), candidates: [{ candidate_id: 'one', label: 'Old candidate', machine_suggestion: { summary: 'PRIVATE_SENTINEL' } }] }
  const value = inspectEikonaReview(input, scope)
  expect(value.status).toBe('ready')
  if (value.status !== 'ready') throw new Error('missing legacy projection')
  expect(value.candidates[0]).not.toHaveProperty('decisionVersion')
  expect(value.candidates[0]).not.toHaveProperty('artifactRef')
  expect(JSON.stringify(value)).not.toContain('PRIVATE_SENTINEL')
})

it('preserves an explicit candidate decision instead of copying the aggregate', () => {
  const input = fixture()
  const value = inspectEikonaReview({ ...input, candidates: [{ ...input.candidates[0], decision_version: 1, decision_state: 'accepted' }] }, scope)
  expect(value.status).toBe('ready')
  if (value.status === 'ready') {
    expect(value.candidates[0]?.decisionState).toBe('accepted')
    expect(value.ownerDecision).toBe('pending')
  }
})

it('rejects contradictory candidate decision states at owner and Remote boundaries', () => {
  for (const [version, state] of [[0, 'accepted'], [1, 'pending'], [undefined, 'accepted']] as const) {
    const input = fixture()
    const candidate = { ...input.candidates[0], decision_version: version, decision_state: state }
    expect(inspectEikonaReview({ ...input, candidates: [candidate] }, scope).status).toBe('needs_contract')
    const valid = inspectEikonaReview(fixture(), scope)
    if (valid.status !== 'ready') throw new Error('invalid fixture')
    expect(eikonaReviewResultSchema.safeParse({ ...valid, candidates: [{ ...valid.candidates[0], decisionVersion: version, decisionState: state }] }).success).toBe(false)
  }
})
