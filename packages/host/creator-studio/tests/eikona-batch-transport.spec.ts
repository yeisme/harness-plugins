import { expect, it, vi } from 'vitest'
import { EikonaDiscoveryClient, type EikonaDiscoveryConnection } from '../src/eikona-discovery-client.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = { tenantRef: 'tenant:test', workspaceRef: 'workspace:test', projectRef: 'project:test', sessionRef: 'session:test', principalRef: 'principal:test', membershipRevision: '1', installationRef: 'installation:test', pluginDigest: 'digest:test', policyRevision: '1', runtimeGeneration: '1', revision: '1' }
const input = { batchRef: 'batch:test', digest: `sha256:${'a'.repeat(64)}`, planDigest: `sha256:${'b'.repeat(64)}`, idempotencyKey: 'original-key' }
const data = { schema_version: 'eikona.batch_operation_preview.v1', project_ref: 'project:test', request_batch_ref: input.batchRef, request_batch_digest: input.digest, plan_digest: input.planDigest, operation_ref: 'eikona-batch:test', status: 'succeeded', terminal: true, attempt_count: 1, successful_count: 2, failed_count: 0, cancelled_count: 0 }
function binding(): EikonaDiscoveryConnection {
  return { context, baseURL: 'http://127.0.0.1:12345', headers: {}, assetScope: { ownerProjectRef: 'test', credentialProjects: ['test'] }, admission: { approved: true, schemaDigest: 'schema', sdkDigest: 'sdk', generationExecutionApproved: true } }
}
it('requires independent batch permission and confirmation, keeps unknown submissions single-shot, and reconciles without execution permission', async () => {
  let connection = binding()
  const fetcher = vi.fn<typeof fetch>(async url => {
    if (String(url).endsWith(':submit')) throw new Error('fixture response loss')
    return Response.json({ ok: true, status: 'success', data })
  })
  const client = new EikonaDiscoveryClient(async () => connection, fetcher)
  const submit = { ...input, confirmed: true, allowUnknownCost: false }
  expect(await client.submitBatch(context, submit)).toEqual({ status: 'permission_denied' })
  connection = { ...connection, admission: { ...connection.admission, batchExecutionApproved: true } }
  expect(await client.submitBatch(context, { ...submit, confirmed: false })).toEqual({ status: 'invalid_input' })
  expect(await client.submitBatch(context, { ...submit, projectRef: 'foreign' })).toEqual({ status: 'invalid_input' })
  expect(fetcher).not.toHaveBeenCalled()
  expect(await client.submitBatch(context, submit)).toEqual({ status: 'unconfirmed' })
  expect(fetcher).toHaveBeenCalledTimes(1)
  const request = fetcher.mock.calls[0]![1]!
  expect(new Headers(request.headers).get('Idempotency-Key')).toBe(input.idempotencyKey)
  expect(JSON.parse(String(request.body))).toEqual({ project_ref: 'project:test', request_batch_ref: input.batchRef, request_batch_digest: input.digest, plan_digest: input.planDigest, confirm: true, allow_unknown_cost: false })
  connection = { ...connection, admission: { ...connection.admission, batchExecutionApproved: false } }
  expect(await client.reconcileBatch(context, input)).toMatchObject({ status: 'observed', successfulCount: 2, operationRef: data.operation_ref })
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(JSON.parse(String(fetcher.mock.calls[1]![1]!.body))).toEqual({ project_ref: 'project:test' })
  expect(new Headers(fetcher.mock.calls[1]![1]!.headers).get('Idempotency-Key')).toBe(input.idempotencyKey)
})
it.each([
  { project_ref: 'project:foreign' }, { request_batch_digest: `sha256:${'c'.repeat(64)}` },
  { plan_digest: `sha256:${'c'.repeat(64)}` }, { terminal: false }, { attempt_count: -1 },
  { operation_ref: 'eikona-batch:../other' }, { provider_payload: 'unexpected' },
])('rejects substituted or malformed owner results: %o', async patch => {
  const client = new EikonaDiscoveryClient(async () => binding(), async () => Response.json({ ok: true, status: 'success', data: { ...data, ...patch } }))
  expect(await client.reconcileBatch(context, input)).toEqual({ status: 'unconfirmed' })
})
it('rejects a late result when the pinned connection changes', async () => {
  let connection = binding()
  const client = new EikonaDiscoveryClient(async () => connection, async () => {
    connection = { ...connection, headers: { Authorization: 'fixture-replacement' } }
    return Response.json({ ok: true, status: 'success', data })
  })
  expect(await client.reconcileBatch(context, input)).toEqual({ status: 'unconfirmed' })
})
