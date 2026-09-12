import { expect, it } from 'vitest'
import { OperationIdentityStore, operationIdentityDomainSpec } from '../src/operation-identity-store.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

const context = (): CreatorStudioContextV1 => ({
  tenantRef: 'tenant:test', workspaceRef: 'workspace:test', projectRef: 'project:test', sessionRef: 'session:test',
  principalRef: 'principal:test', membershipRevision: '1', installationRef: 'installation:test', pluginDigest: 'digest:test',
  policyRevision: '1', runtimeGeneration: '1', revision: '1',
})
const identity = {
  schema: 'pane.action-reconcile-request.v1alpha1' as const, owner: 'auctra', actionId: 'working-copy.candidate.adopt',
  expectedTargetRef: 'auctra:working-copy:fixture', context: context(), idempotencyKey: 'creator-original-key',
}

it('recalls the original key after a new store instance and never stores action values', async () => {
  const rows = new Map<string, unknown>()
  const storage = { open: async () => ({ table: () => ({ get: (key: string) => rows.get(key), put: async (key: string, value: unknown) => { rows.set(key, value) }, delete: async (key: string) => rows.delete(key) }), close: async () => undefined }) }
  const first = new OperationIdentityStore(storage, context)
  expect(await first.remember(identity)).toBe('stored')
  expect(JSON.stringify([...rows.values()])).not.toMatch(/body|values|第一章/)
  await first.close()
  const restored = new OperationIdentityStore(storage, context)
  expect(await restored.recall({ owner: identity.owner, actionId: identity.actionId, expectedTargetRef: identity.expectedTargetRef }))
    .toEqual(identity)
  expect(await restored.recall({ owner: identity.owner, actionId: identity.actionId, expectedTargetRef: 'auctra:working-copy:other' })).toBeUndefined()
  expect(operationIdentityDomainSpec.name).toBe('yeisme_creator_operation_v1')
})
