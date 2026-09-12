import { expect, it } from 'vitest'
import { prepareEikonaAdoption } from '../src/eikona-adoption.ts'
const digest = 'a'.repeat(64), artifactRef = 'eikona://artifacts/run/candidate'
const operation = { action: 'eikona.review.decide', contractId: 'eikona.review.decide.v1', readiness: 'requires_authorization' as const,
  supportsExpectedContentDigest: true, supportsRequireNoDecision: true, supportsCancel: false, supportsEvents: false, reasonCode: undefined }
const discovery = { status: 'inspected' as const, observedAt: '2026-09-08T00:00:00Z', schemaDigest: `sha256:${digest}`, readsEnabled: true, operations: [operation] }
function review(version: number | undefined = 0) {
  return { status: 'ready', runId: 'run', projectId: 'project', observedAt: discovery.observedAt, ownerDecision: 'pending', admissionState: 'unknown', canDecide: true, canSupersede: false,
    candidates: [{ candidateId: 'candidate', label: 'Candidate', artifactRef, contentDigest: digest, decisionState: version === 0 ? 'pending' : 'request_revision', ...(version === undefined ? {} : { decisionVersion: version }) }] }
}
it('maps candidate identity and digest separately from decision version without granting execution', () => {
  for (const version of [0, 3]) {
    const prepared = prepareEikonaAdoption(discovery, review(version), { artifactRef, contentDigest: digest })
    expect(prepared.status).toBe('prepared')
    if (prepared.status !== 'prepared') throw new Error('not prepared')
    expect(prepared.executionAuthorized).toBe(false)
    expect(prepared.request).toMatchObject({ project_ref: 'project', asset_ref: 'run', review_version: 'candidate', expected_content_digest: digest })
    expect(prepared.request).toMatchObject(version === 0 ? { require_no_decision: true } : { expected_version: '3' })
  }
})
it('rejects unverified selection, permission and unavailable preconditions', () => {
  expect(prepareEikonaAdoption(discovery, review(), { artifactRef, contentDigest: 'b'.repeat(64) }).status).toBe('unconfirmed')
  expect(prepareEikonaAdoption(discovery, { ...review(), canDecide: false }, { artifactRef, contentDigest: digest }).status).toBe('permission_denied')
  for (const capability of ['supportsExpectedContentDigest', 'supportsRequireNoDecision']) {
    expect(prepareEikonaAdoption({ ...discovery, operations: [{ ...operation, [capability]: false }] }, review(), { artifactRef, contentDigest: digest }).status).toBe('needs_contract')
  }
  const unknown = review(); delete (unknown.candidates[0] as { decisionVersion?: number }).decisionVersion
  delete (unknown.candidates[0] as { decisionState?: string }).decisionState
  expect(prepareEikonaAdoption(discovery, unknown, { artifactRef, contentDigest: digest }).status).toBe('unconfirmed')
})

it('does not prepare ordinary adoption for decided or unknown candidate states', () => {
  for (const state of ['accepted', 'rejected', 'stale']) {
    const value = review(1); value.candidates[0]!.decisionState = state
    expect(prepareEikonaAdoption(discovery, value, { artifactRef, contentDigest: digest }).status).toBe('already_decided')
  }
  const legacy = review(1)
  delete (legacy.candidates[0] as { decisionState?: string }).decisionState
  expect(prepareEikonaAdoption(discovery, legacy, { artifactRef, contentDigest: digest }).status).toBe('unconfirmed')
})
