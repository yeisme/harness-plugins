import { expect, it } from 'vitest'
import { eikonaAdoptionDescriptorRef, parseEikonaAdoptionRequest } from '../src/eikona-adoption-request.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'
const context: CreatorStudioContextV1 = { tenantRef: 'tenant:test', workspaceRef: 'workspace:test', projectRef: 'project:test', sessionRef: 'session:test', principalRef: 'principal:test', membershipRevision: '1', installationRef: 'installation:test', pluginDigest: 'digest:test', policyRevision: '1', runtimeGeneration: '1', revision: '1' }
const digest = 'a'.repeat(64), ref = 'eikona://artifacts/run/candidate'
function request() { return { schema: 'pane.action-request.v1alpha1', owner: 'eikona', actionId: 'candidate.adopt', descriptorRef: eikonaAdoptionDescriptorRef(ref, digest, 0), expectedTargetRef: ref, expectedTargetVersion: digest, context, idempotencyKey: 'original-key', values: { run_id: 'run', candidate_id: 'candidate', content_digest: digest, decision_version: 0 } } }
it('retains the fixed original target and key', () => {
  const parsed = parseEikonaAdoptionRequest(request(), context)
  expect(parsed?.artifactRef).toBe(ref)
  expect(parsed?.request.idempotencyKey).toBe('original-key')
  expect(parsed?.values.decision_version).toBe(0)
})
it('rejects changed context, target, version, descriptor and extra values', () => {
  const original = request()
  for (const value of [
    { ...original, expectedTargetRef: 'eikona://artifacts/run/other' },
    { ...original, expectedTargetVersion: 'b'.repeat(64) },
    { ...original, values: { ...original.values, decision_version: 1 } },
    { ...original, values: { ...original.values, confirm: true } },
    { ...original, context: { ...context, sessionRef: 'session:other' } },
    { ...original, idempotencyKey: 'unsafe/key' },
  ]) expect(parseEikonaAdoptionRequest(value, context)).toBeUndefined()
})
