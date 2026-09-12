import { expect, it, vi } from 'vitest'
import { withLocalEikona } from '../src/local-eikona.ts'
import type { CreatorOwnerAdapterV1, CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = { tenantRef: 'local:user', principalRef: 'local:user', workspaceRef: 'workspace:one', projectRef: 'project:one', revision: '1', membershipRevision: '1', installationRef: 'installation:one', pluginDigest: 'digest:one', policyRevision: '1', runtimeGeneration: '1' }
const digest = 'a'.repeat(64), preparationRef = `egp_${digest}`, approvalRef = `ega_${'b'.repeat(64)}`
const preparation = { schema_version: 'eikona.generation_preparation.v1', ref: preparationRef, project_id: 'one', prompt_ref: 'eikona://prompts/prompt/versions/1', prompt_digest: digest, digest,
  controls: { model_ref: 'openai/gpt-5.4-image-2', candidate_count: 1 }, summary: { digest, model_ref: 'openai/gpt-5.4-image-2', kind: 'image.generate' }, cost_state: 'unknown', execution_authorized: false, created_at: new Date().toISOString() }

it('prepares and approves locally, preserves the original execution key, and reconciles without running again', async () => {
  const expires = new Date(Date.now() + 3600_000).toISOString()
  let consumed = false
  const invoke = vi.fn(async (args: readonly string[]) => {
    switch (args[1]) {
      case 'preview': case 'show': return { status: 'success', facts: { preparation_ref: preparationRef }, data: { preparation } }
      case 'approve': return { status: 'success', data: { approval: { schema_version: 'eikona.generation_preparation_approval.v1', ref: approvalRef, project_id: 'one', preparation_ref: preparationRef, preparation_digest: digest, max_cost_usd: 1, max_images: 1, allow_unknown_cost: true, expires_at: expires } } }
      case 'approval-status': return { status: 'success', data: { approval_status: { schema_version: 'eikona.generation_preparation_approval_status.v1', approval_ref: approvalRef, preparation_ref: preparationRef, preparation_digest: digest, project_id: 'one', revoked: false, expired: false, expires_at: expires, observed_at: new Date().toISOString(), ...(consumed ? { consumed_operation: `own_${'c'.repeat(24)}` } : {}) } } }
      case 'run': consumed = true; throw new Error('fixture response loss')
      case 'reconcile': return { status: 'success', facts: { operation_ref: `own_${'c'.repeat(24)}`, status: 'succeeded', run_id: `run_owner_${'d'.repeat(32)}` } }
      default: throw new Error('unexpected command')
    }
  })
  const base: CreatorOwnerAdapterV1 = { owner: 'eikona', transport: 'local', configured: true, snapshot: async scope => ({ schemaVersion: 'creator.owner.snapshot.v1alpha1', owner: 'eikona', transport: 'local', context: scope, snapshotRef: 'snapshot:one', snapshotVersion: 1, cursor: 'cursor:one', sequence: 1, generatedAt: new Date().toISOString(), status: 'ready', freshness: 'fresh', summary: 'Local CLI ready', resources: [], actions: [] }), dispatch: vi.fn() }
  const adapter = withLocalEikona(base, invoke, async () => 'one')
  expect((await adapter.prepareEikonaGeneration!({ prompt_id: 'prompt', prompt_version: 1, values: { subject: 'a,b\nnext' } }, context)).status).toBe('ready')
  expect(invoke.mock.calls.some(call => call[0][1] === 'run')).toBe(false)
  expect((await adapter.approveEikonaPreparation!({ preparation_ref: preparationRef, expected_digest: digest, max_cost_usd: 1, max_images: 1, allow_unknown_cost: true, expires_in_seconds: 3600, confirmed: true }, context)).status).toBe('approved')
  const descriptor = (await adapter.snapshot(context)).actions[0]!
  expect(descriptor).toBeDefined()
  const values = Object.fromEntries(descriptor.fields.map(field => [field.key, field.options![0]!.value]))
  const request = { schema: 'pane.action-request.v1alpha1' as const, owner: 'eikona', actionId: descriptor.actionId, descriptorRef: descriptor.descriptorRef, expectedTargetRef: descriptor.targetRef, expectedTargetVersion: descriptor.targetVersion, context, idempotencyKey: 'original-local-operation', values }
  expect((await adapter.dispatch(request, context)).status).toBe('unknown')
  const original = { schema: 'pane.action-reconcile-request.v1alpha1' as const, owner: 'eikona', actionId: descriptor.actionId, expectedTargetRef: descriptor.targetRef, context, idempotencyKey: request.idempotencyKey }
  expect((await adapter.reconcile!(original, context)).status).toBe('completed')
  expect((await adapter.snapshot(context)).actions).toHaveLength(0)
  const executions = invoke.mock.calls.filter(call => call[0][1] === 'run')
  expect(executions).toHaveLength(1)
  expect(executions[0]![0]).toContain(request.idempotencyKey)
  expect(invoke.mock.calls.filter(call => call[0][1] === 'reconcile')).toHaveLength(1)
})
