import { expect, it } from 'vitest'
import { creatorStudioRemoteContribution } from '../src/remote.ts'
it('registers approval status as a read query without confirmation or mutation fields', () => {
  const invocation = creatorStudioRemoteContribution.descriptors.find(item => item.method === 'readEikonaApprovalStatus')!
  const input = { approvalRef: `ega_${'a'.repeat(64)}` }
  expect(invocation.parameters[0]!.codec.schema.parse(input)).toEqual(input)
  expect(() => invocation.parameters[0]!.codec.schema.parse({ ...input, confirmed: true })).toThrow()
  expect(() => invocation.result.schema.parse({ status: 'observed', revoked: true })).toThrow()
})
it('registers explicit fixed-reference revocation', () => {
  const invocation = creatorStudioRemoteContribution.descriptors.find(item => item.method === 'revokeEikonaPreparationApproval')!
  const input = { approvalRef: `ega_${'a'.repeat(64)}`, confirmed: true }
  expect(invocation.parameters[0]!.codec.schema.parse(input)).toEqual(input)
  expect(() => invocation.parameters[0]!.codec.schema.parse({ ...input, confirmed: false })).toThrow()
  expect(() => invocation.result.schema.parse({ status: 'revoked' })).toThrow()
})
it('requires explicit approval and unknown-cost consent on the versioned approval Remote', () => {
  const invocation = creatorStudioRemoteContribution.descriptors.find(item => item.method === 'approveEikonaPreparation')!
  expect(invocation.id).toBe('@yeisme/dsh-creator-studio-host/creatorStudio.approveEikonaPreparation@1')
  const input = { preparation_ref: `egp_${'a'.repeat(64)}`, expected_digest: 'b'.repeat(64), max_cost_usd: 0.5, max_images: 1, allow_unknown_cost: true, confirmed: true, expires_in_seconds: 60 }
  expect(invocation.parameters[0]!.codec.schema.parse(input)).toEqual(input)
  expect(() => invocation.parameters[0]!.codec.schema.parse({ ...input, confirmed: false })).toThrow()
  expect(() => invocation.parameters[0]!.codec.schema.parse({ ...input, allow_unknown_cost: false })).toThrow()
})

it('registers preparation creation with fixed inputs and no execution permission', () => {
  const invocation = creatorStudioRemoteContribution.descriptors.find(item => item.method === 'prepareEikonaGeneration')!
  expect(invocation.id).toBe('@yeisme/dsh-creator-studio-host/creatorStudio.prepareEikonaGeneration@1')
  const query = invocation.parameters[0]!.codec.schema
  expect(query.parse({ prompt_id: 'prompt', prompt_version: 1 })).toEqual({ prompt_id: 'prompt', prompt_version: 1 })
  expect(() => query.parse({ prompt_id: 'prompt', prompt_version: 1, project_ref: 'foreign' })).toThrow()
  expect(() => query.parse({ prompt_id: 'prompt', prompt_version: 0 })).toThrow()
  expect(() => invocation.result.schema.parse({ status: 'ready', executionAuthorized: true })).toThrow()
})

it('registers selection as a separate versioned method with safe reference codecs', () => {
  const invocation = creatorStudioRemoteContribution.descriptors.find(item => item.method === 'selectEikonaCandidate')!
  expect(invocation.id).toBe('@yeisme/dsh-creator-studio-host/creatorStudio.selectEikonaCandidate@1')
  const query = invocation.parameters[0]!.codec.schema, result = invocation.result.schema
  expect(query.parse({ selection: null })).toEqual({ selection: null })
  const selection = { artifactRef: 'eikona://artifacts/run/candidate', contentDigest: 'a'.repeat(64) }
  expect(query.parse({ selection })).toEqual({ selection })
  expect(() => query.parse({ selection, projectRef: 'forged' })).toThrow()
  expect(() => query.parse({ selection: { ...selection, artifactRef: 'https://invalid.example/image' } })).toThrow()
  expect(() => result.parse({ status: 'selected' })).toThrow()
  expect(result.parse({ status: 'selected', selection })).toEqual({ status: 'selected', selection })
})

it('registers the versioned Eikona asset read with strict query and result codecs', () => {
  const invocation = creatorStudioRemoteContribution.descriptors.find(item => item.method === 'readEikonaAssetPage')
  expect(invocation).toBeDefined()
  expect(invocation?.id).toBe('@yeisme/dsh-creator-studio-host/creatorStudio.readEikonaAssetPage@1')
  expect(invocation?.invocation).toEqual({ kind: 'direct' })
  const query = invocation!.parameters[0]!.codec.schema
  const result = invocation!.result.schema
  expect(query.parse({})).toEqual({ limit: 50 })
  expect(() => query.parse({ limit: 101 })).toThrow()
  expect(() => query.parse({ projectRef: 'project:forged' })).toThrow()
  expect(result.parse({ status: 'ready', items: [{ ref: 'eikona://artifacts/run/one', title: 'Image', versionStatus: 'unverified' }] })).toBeTruthy()
  expect(() => result.parse({ status: 'ready', items: [{ ref: 'eikona://artifacts/run/one', title: 'Image', versionStatus: 'observed_digest' }] })).toThrow()
  expect(() => result.parse({ status: 'ready', items: [{ ref: 'https://example.com/image', title: 'Image', versionStatus: 'unverified' }] })).toThrow()
})
it('registers fixed batch preview with no browser connection or execution fields', () => {
  const descriptor = creatorStudioRemoteContribution.descriptors.find(item => item.method === 'readEikonaBatchInput')!
  const input = { batchRef: 'batch:one', digest: `sha256:${'a'.repeat(64)}` }
  expect(descriptor.id).toContain('readEikonaBatchInput@1')
  expect(descriptor.parameters[0]!.codec.schema.parse(input)).toEqual(input)
  expect(() => descriptor.parameters[0]!.codec.schema.parse({ ...input, projectRef: 'project:other' })).toThrow()
  expect(() => descriptor.result.schema.parse({ status: 'ready', projectRef: 'project:one', ...input, requestCount: 1, candidateCount: 2, executionAuthorized: true })).toThrow()
})
it('bounds batch pagination and rejects duplicate fixed versions', () => {
  const descriptor = creatorStudioRemoteContribution.descriptors.find(item => item.method === 'listEikonaBatchInputs')!
  expect(descriptor.parameters[0]!.codec.schema.parse({})).toEqual({ limit: 50 })
  expect(() => descriptor.parameters[0]!.codec.schema.parse({ limit: 101 })).toThrow()
  expect(() => descriptor.parameters[0]!.codec.schema.parse({ cursor: '../file' })).toThrow()
  const item = { batchRef: 'batch:one', digest: `sha256:${'a'.repeat(64)}`, requestCount: 1, candidateCount: 1 }
  expect(() => descriptor.result.schema.parse({ status: 'ready', projectRef: 'project:owner', items: [item, item] })).toThrow()
})
it('registers readonly batch replanning and rejects consent fields', () => {
 const descriptor = creatorStudioRemoteContribution.descriptors.find(item => item.method === 'readEikonaBatchPlan')!
 const input = { batchRef: 'batch:one', digest: `sha256:${'a'.repeat(64)}` }
 expect(descriptor.id).toContain('readEikonaBatchPlan@1')
 expect(descriptor.parameters[0]!.codec.schema.parse(input)).toEqual(input)
 expect(() => descriptor.parameters[0]!.codec.schema.parse({ ...input, confirmed: true })).toThrow()
 expect(() => descriptor.result.schema.parse({ status: 'ready', executionAuthorized: true })).toThrow()
})
it('registers bounded member reads without caller-supplied project or execution authority', () => {
  const invocation = creatorStudioRemoteContribution.descriptors.find(item => item.method === 'readEikonaBatchMembers')!
  expect(invocation.id).toBe('@yeisme/dsh-creator-studio-host/creatorStudio.readEikonaBatchMembers@1')
  expect(invocation.parameters[0]!.codec.schema.parse({ operationRef: 'eikona-batch:one' })).toEqual({ operationRef: 'eikona-batch:one', offset: 0, limit: 50 })
  for (const extra of [{ projectRef: 'foreign' }, { confirmed: true }, { limit: 101 }, { offset: -1 }]) expect(() => invocation.parameters[0]!.codec.schema.parse({ operationRef: 'eikona-batch:one', ...extra })).toThrow()
})
