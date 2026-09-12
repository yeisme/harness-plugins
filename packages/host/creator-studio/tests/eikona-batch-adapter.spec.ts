import { expect, it, vi } from 'vitest'
import { EikonaDiscoveryClient } from '../src/eikona-discovery-client.ts'
import { createEikonaStudioAdapter } from '../src/eikona-studio-adapter.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = { tenantRef: 'tenant', workspaceRef: 'workspace', projectRef: 'project:dsh', sessionRef: 'session', principalRef: 'principal', revision: '1', membershipRevision: '1', installationRef: 'installation', pluginDigest: 'digest', policyRevision: '1', runtimeGeneration: '1' }
const input = { batchRef: 'request-batch:fixture', digest: `sha256:${'a'.repeat(64)}` }
const planDigest = `sha256:${'b'.repeat(64)}`
function setup() {
  let enabled = true, changed = false
  const fetcher = vi.fn<typeof fetch>(async url => {
    const path = new URL(String(url)).pathname
    let data: unknown = {}
    if (path.endsWith('/plan')) data = { schema_version: 'eikona.batch_plan_preview.v1', project_ref: 'project:owner', request_batch_ref: input.batchRef, request_batch_digest: input.digest, plan_digest: changed ? `sha256:${'c'.repeat(64)}` : planDigest, status: 'ready', request_count: 2, estimated_calls: 2, max_parallel_requests: 1, max_provider_calls: 2, cost_estimate_known: false, execution_authorized: false, blockers: [] }
    if (path.endsWith(':submit')) throw new Error('fixture response loss')
    if (path.endsWith(':reconcile')) data = { schema_version: 'eikona.batch_operation_preview.v1', project_ref: 'project:owner', request_batch_ref: input.batchRef, request_batch_digest: input.digest, plan_digest: planDigest, operation_ref: 'eikona-batch:original', status: 'succeeded', terminal: true, attempt_count: 1, successful_count: 2, failed_count: 0, cancelled_count: 0 }
    return Response.json({ ok: true, status: 'success', data })
  })
  const client = new EikonaDiscoveryClient(async scope => ({ context: scope, baseURL: 'http://127.0.0.1:12345', headers: {}, assetScope: { ownerProjectRef: 'owner', credentialProjects: ['owner'] }, admission: { approved: true, schemaDigest: 'schema', sdkDigest: 'sdk', batchExecutionApproved: enabled } }), fetcher)
  return { client, fetcher, disable: () => { enabled = false }, change: () => { changed = true } }
}
it('offers only an explicitly inspected plan in its context and recovers after adapter recreation without selection or execution permission', async () => {
  const { client, fetcher, disable } = setup()
  const adapter = createEikonaStudioAdapter(client, true)
  expect((await adapter.snapshot(context)).actions).toHaveLength(0)
  expect(await adapter.readEikonaBatchPlan!(input, context)).toMatchObject({ status: 'ready', planStatus: 'ready' })
  const action = (await adapter.snapshot(context)).actions[0]!
  expect(action.actionId).toBe('eikona.batch.submit')
  expect((await adapter.snapshot({ ...context, sessionRef: 'other' })).actions).toHaveLength(0)
  const request = { schema: 'pane.action-request.v1alpha1', owner: 'eikona', actionId: action.actionId, descriptorRef: action.descriptorRef, expectedTargetRef: action.targetRef, expectedTargetVersion: action.targetVersion, context, idempotencyKey: 'batch-original-key', values: { batch_digest: input.digest, plan_digest: planDigest, allow_unknown_cost: 'true' } }
  expect(await adapter.dispatch(request, context)).toMatchObject({ status: 'unknown' })
  disable()
  const restored = createEikonaStudioAdapter(client, true)
  expect((await restored.snapshot(context)).actions).toHaveLength(0)
  const query = { schema: 'pane.action-reconcile-request.v1alpha1', owner: 'eikona', actionId: action.actionId, expectedTargetRef: action.targetRef, idempotencyKey: request.idempotencyKey, context }
  expect(await restored.reconcile!(query, context)).toMatchObject({ status: 'completed', receiptRef: 'eikona-batch:original' })
  expect(await restored.reconcile!({ ...query, expectedTargetRef: 'request-batch:foreign' }, context)).toMatchObject({ status: 'reconcile_required' })
  expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith(':submit'))).toHaveLength(1)
  const lookups = fetcher.mock.calls.filter(([url]) => String(url).endsWith(':reconcile'))
  expect(JSON.parse(String(lookups[0]![1]!.body))).toEqual({ project_ref: 'project:owner' })
})
it('rejects a previously offered action when the current owner plan changes', async () => {
  const { client, fetcher, change } = setup(), adapter = createEikonaStudioAdapter(client, true)
  await adapter.readEikonaBatchPlan!(input, context)
  const action = (await adapter.snapshot(context)).actions[0]!
  change()
  expect(await adapter.dispatch({ schema: 'pane.action-request.v1alpha1', owner: 'eikona', actionId: action.actionId, descriptorRef: action.descriptorRef, expectedTargetRef: action.targetRef, expectedTargetVersion: action.targetVersion, context, idempotencyKey: 'batch-original-key', values: { batch_digest: input.digest, plan_digest: planDigest, allow_unknown_cost: 'true' } }, context)).toMatchObject({ status: 'rejected' })
  expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith(':submit'))).toHaveLength(0)
})
