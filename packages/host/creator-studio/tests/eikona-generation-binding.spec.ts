import { parseEikonaGenerationRequest } from '../src/eikona-generation-request.ts'
import { createEikonaGenerationDescriptor } from '../src/eikona-generation-descriptor.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'
import { expect, it } from 'vitest'
import { bindEikonaGeneration } from '../src/eikona-generation-binding.ts'
const now = Date.parse('2026-09-09T00:00:00Z')
const digest = 'a'.repeat(64), preparationRef = `egp_${digest}`, approvalRef = `ega_${'b'.repeat(64)}`
const expiresAt = '2026-09-09T01:00:00Z'
const preparation = { status: 'ready', preparationRef, projectId: 'one', promptRef: 'eikona://prompts/prompt/versions/1', promptDigest: digest, digest, summaryDigest: digest, modelRef: 'openai/gpt-5.4-image-2', candidateCount: 1, costState: 'unknown', executionAuthorized: false, createdAt: '2026-09-09T00:00:00Z', controls: { model_ref: 'openai/gpt-5.4-image-2', candidate_count: 1 } }
const approval = { status: 'approved', approvalRef, preparationRef, digest, projectId: 'one', maxCostUSD: 0.75, maxImages: 1, allowUnknownCost: true, expiresAt }
const observation = { status: 'observed', approvalRef, preparationRef, digest, projectId: 'one', revoked: false, expired: false, expiresAt, observedAt: '2026-09-09T00:00:00Z' }
it('binds only fixed owner refs and retains the budget separately for confirmation', () => {
  const bound = bindEikonaGeneration(preparation, approval, observation, 'one', now)
  expect(bound).toMatchObject({ maxCostUSD: 0.75, request: { approval_ref: approvalRef, prompt_version: preparation.promptRef, model: preparation.modelRef, project_ref: 'project:one', cost_limit: { max_images: 1 }, dry_run: false } })
  expect(bound?.request).not.toHaveProperty('prompt')
})
it.each([
  { revoked: true }, { expired: true }, { consumedOperation: `own_${'c'.repeat(24)}` },
  { projectId: 'other' }, { digest: 'c'.repeat(64) }, { approvalRef: `ega_${'c'.repeat(64)}` },
  { observedAt: '2026-09-08T23:58:00Z' }, { observedAt: '2026-09-09T00:10:00Z' },
  { expiresAt: '2026-09-09T02:00:00Z' },
])('rejects stale or mismatched approval observation %j', change => {
  expect(bindEikonaGeneration(preparation, approval, { ...observation, ...change }, 'one', now)).toBeUndefined()
})
it('rejects missing budget approval and locally expired permission', () => {
  expect(bindEikonaGeneration(preparation, { status: 'unconfirmed' }, observation, 'one', now)).toBeUndefined()
  expect(bindEikonaGeneration(preparation, approval, observation, 'one', Date.parse(expiresAt))).toBeUndefined()
})

const context: CreatorStudioContextV1 = { tenantRef: 'tenant', workspaceRef: 'workspace', projectRef: 'project:one', sessionRef: 'session', principalRef: 'principal', revision: '1', membershipRevision: '1', installationRef: 'installation', pluginDigest: 'digest', policyRevision: '1', runtimeGeneration: '1' }
it('projects a fixed single-image confirmation with an expiry bounded by approval', () => {
  const built = createEikonaGenerationDescriptor(preparation, approval, observation, context, now)
  expect(built?.descriptor).toMatchObject({ actionId: 'eikona.generation.submit', confirmation: 'confirm', risk: 'high', targetRef: preparationRef, targetVersion: digest })
  expect(built?.descriptor.preview?.summary).toContain('费用未知')
  expect(built?.descriptor.preview?.summary).toContain('USD 0.75')
  expect(Date.parse(built!.descriptor.expiresAt)).toBeLessThanOrEqual(Date.parse(expiresAt))
  expect(built?.descriptor.fields?.every(field => field.kind === 'select' && field.options?.length === 1)).toBe(true)
  expect(createEikonaGenerationDescriptor(preparation, approval, observation, { ...context, projectRef: 'project:other' }, now)).toBeUndefined()
})
it('changes descriptor identity when budget approval changes and rejects consumed approval', () => {
  const otherRef = `ega_${'f'.repeat(64)}`
  const first = createEikonaGenerationDescriptor(preparation, approval, observation, context, now)
  const second = createEikonaGenerationDescriptor(preparation, { ...approval, approvalRef: otherRef }, { ...observation, approvalRef: otherRef }, context, now)
  expect(first?.descriptor.descriptorRef).not.toBe(second?.descriptor.descriptorRef)
  expect(createEikonaGenerationDescriptor(preparation, approval, { ...observation, consumedOperation: `own_${'c'.repeat(24)}` }, context, now)).toBeUndefined()
})

it('accepts only the exact bounded confirmation input and original context', () => {
  const built = createEikonaGenerationDescriptor(preparation, approval, observation, context, now)!
  const request = { schema: 'pane.action-request.v1alpha1', owner: 'eikona', actionId: built.descriptor.actionId, descriptorRef: built.descriptor.descriptorRef, expectedTargetRef: built.descriptor.targetRef, expectedTargetVersion: built.descriptor.targetVersion, context, idempotencyKey: 'original-generation-key', values: built.values }
  expect(parseEikonaGenerationRequest(request, context)?.request.idempotencyKey).toBe(request.idempotencyKey)
  for (const changed of [
    { ...request, values: { ...request.values, approval_ref: `ega_${'f'.repeat(64)}` } },
    { ...request, values: { ...request.values, model: 'other' } },
    { ...request, values: { ...request.values, raw_prompt: 'unbound' } },
    { ...request, expectedTargetVersion: 'f'.repeat(64) },
    { ...request, idempotencyKey: 'unsafe/key' },
    { ...request, context: { ...context, sessionRef: 'other' } },
    { ...request, context: { ...context, policyRevision: '2' } },
  ]) expect(parseEikonaGenerationRequest(changed, context)).toBeUndefined()
})

it('dispatches the fixed selection once and preserves its original key through the generation adapter', async () => {
  const { vi } = await import('vitest')
  const { EikonaDiscoveryClient } = await import('../src/eikona-discovery-client.ts')
  const { withEikonaGeneration } = await import('../src/eikona-generation-adapter.ts')
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
  try {
    const client = new EikonaDiscoveryClient(async () => undefined)
    vi.spyOn(client, 'pin').mockResolvedValue(client)
    vi.spyOn(client, 'inspect').mockResolvedValue({ status: 'inspected', generationAvailable: true } as never)
    vi.spyOn(client, 'readPreparation').mockResolvedValue(preparation as never)
    vi.spyOn(client, 'readApprovalStatus').mockResolvedValue(observation as never)
    const submit = vi.spyOn(client, 'submitGeneration').mockResolvedValue({ status: 'unconfirmed' })
    const base = { owner: 'eikona', transport: 'service', configured: true, snapshot: async () => ({ actions: [] }), dispatch: vi.fn() } as never
    const adapter = withEikonaGeneration(base, client, async () => approval)
    const snapshot = await adapter.snapshot(context)
    expect(snapshot.actions).toHaveLength(1)
    const descriptor = snapshot.actions[0]!
    const built = createEikonaGenerationDescriptor(preparation, approval, observation, context, now)!
    const request = { schema: 'pane.action-request.v1alpha1', owner: 'eikona', actionId: descriptor.actionId, descriptorRef: descriptor.descriptorRef, expectedTargetRef: descriptor.targetRef, expectedTargetVersion: descriptor.targetVersion, context, idempotencyKey: 'original-generation-key', values: built.values }
    expect((await adapter.dispatch(request as never, context)).status).toBe('unknown')
    expect(submit).toHaveBeenCalledExactlyOnceWith(context, expect.objectContaining({ idempotencyKey: request.idempotencyKey, confirmed: true, request: expect.objectContaining({ approval_ref: approvalRef }) }))
    const changed = withEikonaGeneration(base, client, async () => ({ ...approval, approvalRef: `ega_${'f'.repeat(64)}` }))
    expect((await changed.dispatch(request as never, context)).status).toBe('rejected')
    expect(submit).toHaveBeenCalledOnce()
  } finally { clock.mockRestore() }
})

it('reconciles the original request without current selection, discovery or another submit', async () => {
  const { vi } = await import('vitest')
  const { EikonaDiscoveryClient } = await import('../src/eikona-discovery-client.ts')
  const { withEikonaGeneration } = await import('../src/eikona-generation-adapter.ts')
  const client = new EikonaDiscoveryClient(async () => undefined)
  vi.spyOn(client, 'pin').mockResolvedValue(client)
  const inspect = vi.spyOn(client, 'inspect')
  const selected = vi.fn(async () => { throw new Error('selection is unavailable') })
  vi.spyOn(client, 'readPreparation').mockResolvedValue(preparation as never)
  const submit = vi.spyOn(client, 'submitGeneration')
  const reconcile = vi.spyOn(client, 'reconcileGeneration').mockResolvedValue({ status: 'unconfirmed' })
  const base = { owner: 'eikona', transport: 'service', configured: true, snapshot: async () => ({ actions: [] }), dispatch: vi.fn() } as never
  const adapter = withEikonaGeneration(base, client, selected)
  const query = { schema: 'pane.action-reconcile-request.v1alpha1', owner: 'eikona', actionId: 'eikona.generation.submit', expectedTargetRef: preparationRef, context, idempotencyKey: 'original-generation-key' }
  expect((await adapter.reconcile!(query as never, context)).status).toBe('reconcile_required')
  expect(reconcile).toHaveBeenCalledExactlyOnceWith(context, { projectId: 'one', idempotencyKey: query.idempotencyKey })
  expect(selected).not.toHaveBeenCalled()
  expect(inspect).not.toHaveBeenCalled()
  expect(submit).not.toHaveBeenCalled()
  expect((await adapter.reconcile!({ ...query, context: { ...context, projectRef: 'foreign' } } as never, context)).status).toBe('reconcile_required')
  expect(reconcile).toHaveBeenCalledOnce()
})

it('selects only owner-returned approval and invalidates late approvals on a new preparation', async () => {
  const { vi } = await import('vitest')
  const { EikonaDiscoveryClient } = await import('../src/eikona-discovery-client.ts')
  const { createEikonaStudioAdapter } = await import('../src/eikona-studio-adapter.ts')
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
  try {
    const client = new EikonaDiscoveryClient(async () => undefined)
    vi.spyOn(client, 'pin').mockResolvedValue(client)
    vi.spyOn(client, 'inspect').mockResolvedValue({ status: 'inspected', generationAvailable: true, operations: [], observedAt: observation.observedAt } as never)
    vi.spyOn(client, 'readPreparation').mockResolvedValue(preparation as never)
    vi.spyOn(client, 'readApprovalStatus').mockResolvedValue(observation as never)
    vi.spyOn(client, 'prepareGeneration').mockResolvedValue(preparation as never)
    const approve = vi.spyOn(client, 'approvePreparation').mockResolvedValue(approval as never)
    const adapter = createEikonaStudioAdapter(client, true)
    expect((await adapter.snapshot(context)).actions).toHaveLength(0)
    await adapter.approveEikonaPreparation!({} as never, context)
    expect((await adapter.snapshot(context)).actions.some(action => action.actionId === 'eikona.generation.submit')).toBe(true)
    expect((await adapter.snapshot({ ...context, sessionRef: 'other' })).actions).toHaveLength(0)
    let finish!: (value: never) => void
    approve.mockImplementationOnce(async () => new Promise(resolve => { finish = resolve }))
    const pending = adapter.approveEikonaPreparation!({} as never, context)
    await adapter.prepareEikonaGeneration!({} as never, context)
    finish(approval as never)
    expect(await pending).toEqual({ status: 'unconfirmed' })
    expect((await adapter.snapshot(context)).actions).toHaveLength(0)
  } finally { clock.mockRestore() }
})
