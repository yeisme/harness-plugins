import { expect, it } from 'vitest'
import { createEikonaAdoptionDescriptor } from '../src/eikona-adoption-descriptor.ts'
import { parseEikonaAdoptionRequest } from '../src/eikona-adoption-request.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'
const context: CreatorStudioContextV1 = { tenantRef: 'tenant:test', workspaceRef: 'workspace:test', projectRef: 'project:test', sessionRef: 'session:test', principalRef: 'principal:test', membershipRevision: '1', installationRef: 'installation:test', pluginDigest: 'digest:test', policyRevision: '1', runtimeGeneration: '1', revision: '1' }
it('builds a confirmed fixed-target descriptor whose values satisfy the same dispatch contract', () => {
  const digest = 'a'.repeat(64), now = Date.parse('2026-09-08T00:00:00Z')
  const built = createEikonaAdoptionDescriptor({ status: 'prepared', executionAuthorized: false, artifactRef: 'eikona://artifacts/run/candidate', observedAt: new Date(now).toISOString(), request: { project_ref: 'project', asset_ref: 'run', review_version: 'candidate', decision: 'accept', expected_content_digest: digest, require_no_decision: true } }, context, now)
  expect(built).toBeDefined()
  if (!built) throw new Error('missing descriptor')
  expect(built.descriptor.confirmation).toBe('confirm')
  expect(built.descriptor.preview.cost).toBeUndefined()
  expect(Date.parse(built.descriptor.expiresAt)).toBe(now + 60_000)
  expect(parseEikonaAdoptionRequest({ schema: 'pane.action-request.v1alpha1', owner: 'eikona', actionId: built.descriptor.actionId, descriptorRef: built.descriptor.descriptorRef, expectedTargetRef: built.descriptor.targetRef, expectedTargetVersion: built.descriptor.targetVersion, context, idempotencyKey: 'original-key', values: built.values }, context)).toBeDefined()
})
it('does not expose adoption for an unprepared result', () => {
  expect(createEikonaAdoptionDescriptor({ status: 'unconfirmed' }, context)).toBeUndefined()
})
