import { createHash } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { EikonaDiscoveryClient, type EikonaDiscoveryConnection } from '../src/eikona-discovery-client.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'
const context: CreatorStudioContextV1 = { tenantRef: 'tenant:test', workspaceRef: 'workspace:test', projectRef: 'project:test', sessionRef: 'session:test', principalRef: 'principal:test', membershipRevision: '1', installationRef: 'installation:test', pluginDigest: 'digest:test', policyRevision: '1', runtimeGeneration: '1', revision: '1' }
const connection = (): EikonaDiscoveryConnection => ({ context: { ...context }, baseURL: 'http://127.0.0.1:12345', headers: {}, admission: { approved: true, schemaDigest: `sha256:${'a'.repeat(64)}`, sdkDigest: `sha256:${'b'.repeat(64)}` } })
it('pins approval recovery before discovery and refuses a replaced credential', async () => {
  const first = connection()
  let reads = 0
  const fetcher = vi.fn<typeof fetch>()
  const client = new EikonaDiscoveryClient(async () => ++reads === 1 ? first : { ...first, headers: { Authorization: 'Bearer fixture-other' } }, fetcher)
  expect((await client.readApprovalStatus(context, `ega_${'a'.repeat(64)}`)).status).toBe('unavailable')
  expect(fetcher).not.toHaveBeenCalled()
})
it('revokes only a confirmed fixed approval and rejects a mismatched receipt', async () => {
  const base = connection(), ref = `ega_${'a'.repeat(64)}`
  let returned = ref
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ ok: true, status: 'success', data: { approval_ref: returned, state: 'revoked' } }))
  const client = new EikonaDiscoveryClient(async () => ({ ...base, assetScope: { ownerProjectRef: 'project', credentialProjects: ['project'] }, admission: { ...base.admission, generationApprovalApproved: true } }), fetcher)
  expect((await client.revokePreparationApproval(context, { approvalRef: ref, confirmed: false })).status).toBe('invalid_input')
  expect(fetcher).not.toHaveBeenCalled()
  expect(await client.revokePreparationApproval(context, { approvalRef: ref, confirmed: true })).toEqual({ status: 'revoked', approvalRef: ref })
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual({ project_ref: 'project' })
  returned = `ega_${'b'.repeat(64)}`
  expect((await client.revokePreparationApproval(context, { approvalRef: ref, confirmed: true })).status).toBe('unconfirmed')
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('separates cost approval permission and consent from preparation permission', async () => {
  const base = connection()
  let allowed = false
  const fetcher = vi.fn<typeof fetch>(async () => { throw new Error('fixture disconnect') })
  const client = new EikonaDiscoveryClient(async () => ({ ...base, assetScope: { ownerProjectRef: 'project', credentialProjects: ['project'] }, admission: { ...base.admission, preparationApproved: true, generationApprovalApproved: allowed } }), fetcher)
  const input = { preparation_ref: `egp_${'a'.repeat(64)}`, expected_digest: 'b'.repeat(64), max_cost_usd: 0.5, max_images: 1, allow_unknown_cost: true, confirmed: true, expires_in_seconds: 60 }
  expect((await client.approvePreparation(context, input)).status).toBe('permission_denied')
  allowed = true
  expect((await client.approvePreparation(context, { ...input, confirmed: false })).status).toBe('invalid_input')
  expect((await client.approvePreparation(context, { ...input, allow_unknown_cost: false })).status).toBe('invalid_input')
  expect(fetcher).not.toHaveBeenCalled()
  expect((await client.approvePreparation(context, input)).status).toBe('unconfirmed')
  expect(fetcher).toHaveBeenCalledOnce()
  const { confirmed: _confirmed, ...body } = input
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual({ ...body, project_ref: 'project' })
})
it('requires preparation permission, bounds inputs and never retries an unknown preparation write', async () => {
  const base = connection()
  let allowed = false
  const fetcher = vi.fn<typeof fetch>(async () => { throw new Error('fixture disconnect') })
  const client = new EikonaDiscoveryClient(async () => ({ ...base, assetScope: { ownerProjectRef: 'project', credentialProjects: ['project'] },
    admission: { ...base.admission, preparationApproved: allowed } }), fetcher)
  const input = { prompt_id: 'prompt', prompt_version: 1 }
  expect((await client.prepareGeneration(context, input)).status).toBe('permission_denied')
  expect(fetcher).not.toHaveBeenCalled()
  allowed = true
  expect((await client.prepareGeneration(context, { ...input, project_ref: 'foreign' })).status).toBe('invalid_input')
  expect((await client.prepareGeneration(context, { ...input, values: Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`key${i}`, 'x'.repeat(4096)])) })).status).toBe('invalid_input')
  expect(fetcher).not.toHaveBeenCalled()
  expect((await client.prepareGeneration(context, input)).status).toBe('unconfirmed')
  expect(fetcher).toHaveBeenCalledOnce()
  expect(fetcher.mock.calls[0]![1]?.method).toBe('POST')
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual({ ...input, project_ref: 'project' })
})
it('reads fixed preparations in credential scope without exposing content or executing', async () => {
  const ref = `egp_${'a'.repeat(64)}`
  const base = connection()
  let binding = { ...base, assetScope: { ownerProjectRef: 'project', credentialProjects: ['project'] } }
  const data = { schema_version: 'eikona.generation_preparation.v1', ref, project_id: 'project',
    prompt_ref: 'eikona://prompts/prompt/versions/1', prompt_digest: 'b'.repeat(64), digest: 'c'.repeat(64),
    controls: { model_ref: 'openai/gpt-5.4-image-2', candidate_count: 1 },
    summary: { digest: 'd'.repeat(64), model_ref: 'openai/gpt-5.4-image-2', kind: 'image.generate' },
    cost_state: 'unknown', execution_authorized: false, created_at: '2026-09-09T00:00:00Z', prompt: 'PRIVATE_SENTINEL' }
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ ok: true, status: 'success', data }))
  const client = new EikonaDiscoveryClient(async () => binding, fetcher)
  const result = await client.readPreparation(context, ref)
  expect(result).toMatchObject({ status: 'ready', preparationRef: ref, costState: 'unknown', executionAuthorized: false })
  expect(JSON.stringify(result)).not.toContain('PRIVATE_SENTINEL')
  expect(new URL(String(fetcher.mock.calls[0]![0])).searchParams.get('project_ref')).toBe('project')
  expect(fetcher.mock.calls[0]![1]?.method).toBe('GET')
  data.project_id = 'foreign'
  expect((await client.readPreparation(context, ref)).status).toBe('permission_denied')
  data.project_id = 'project'; data.execution_authorized = true
  expect((await client.readPreparation(context, ref)).status).toBe('needs_contract')
  binding = { ...binding, assetScope: { ownerProjectRef: 'project', credentialProjects: ['foreign'] } }
  const before = fetcher.mock.calls.length
  expect((await client.readPreparation(context, ref)).status).toBe('needs_contract')
  expect((await client.readPreparation(context, '../other')).status).toBe('invalid_input')
  expect(fetcher.mock.calls.length).toBe(before)
})
it('submits fixed adoption with explicit Host permission and preserves the caller key without retries', async () => {
  const request = { project_ref: 'project', asset_ref: 'run', review_version: 'candidate', decision: 'accept', expected_content_digest: 'a'.repeat(64), require_no_decision: true }
  const base = connection()
  let binding = { ...base, assetScope: { ownerProjectRef: 'project', credentialProjects: ['project'] }, admission: { ...base.admission, reviewAdoptionApproved: false } }
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ ok: true, status: 'success', data: { schema: 'eikona.owner.receipt.v1', operation_ref: `own_${'a'.repeat(24)}`, receipt_ref: `own_${'a'.repeat(24)}`, contract_id: 'eikona.review.decide.v1', action: 'eikona.review.decide', state: 'succeeded', outcome_refs: ['decision:run:candidate:v1'], created_at: '2026-09-08T00:00:00Z', updated_at: '2026-09-08T00:00:00Z' } }))
  const client = new EikonaDiscoveryClient(async () => binding, fetcher)
  const input = { request, idempotencyKey: 'original-key', confirmed: true }
  expect((await client.submitAdoption(context, input)).status).toBe('permission_denied')
  expect(fetcher).not.toHaveBeenCalled()
  binding = { ...binding, admission: { ...binding.admission, reviewAdoptionApproved: true } }
  expect((await client.submitAdoption(context, { ...input, confirmed: false })).status).toBe('invalid_input')
  expect(await client.submitAdoption(context, input)).toMatchObject({ status: 'observed', adoptionConfirmed: true })
  expect(String(fetcher.mock.calls[0]![0])).toBe('http://127.0.0.1:12345/api/v1/owner/review:decide')
  expect(new Headers(fetcher.mock.calls[0]![1]?.headers).get('Idempotency-Key')).toBe('original-key')
  expect(JSON.parse(fetcher.mock.calls[0]![1]?.body as string)).toEqual(request)
  fetcher.mockRejectedValueOnce(new Error('connection interrupted'))
  expect((await client.submitAdoption(context, input)).status).toBe('unconfirmed')
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('reads only the fixed owner route and returns no unchecked response', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ private_payload: 'PRIVATE_SENTINEL' }))
  const result = await new EikonaDiscoveryClient(async () => connection(), fetcher).inspect(context)
  expect(String(fetcher.mock.calls[0]![0])).toBe('http://127.0.0.1:12345/api/v1/owner')
  expect(fetcher.mock.calls[0]![1]).toMatchObject({ method: 'GET', redirect: 'error' })
  expect(result.status).toBe('needs_contract'); expect(JSON.stringify(result)).not.toContain('PRIVATE_SENTINEL')
})

it('keeps malformed successful adoption responses unknown without automatic resubmission', async () => {
  const base = connection()
  const binding = { ...base, assetScope: { ownerProjectRef: 'project', credentialProjects: ['project'] }, admission: { ...base.admission, reviewAdoptionApproved: true } }
  for (const response of [Response.json({ ok: true, data: {} }), new Response('not-json', { status: 202 }), Response.json({ ok: true, status: 'success', data: { state: 'succeeded' } })]) {
    const fetcher = vi.fn<typeof fetch>(async () => response)
    const client = new EikonaDiscoveryClient(async () => binding, fetcher)
    const result = await client.submitAdoption(context, { request: { project_ref: 'project', asset_ref: 'run', review_version: 'candidate', decision: 'accept', expected_content_digest: 'a'.repeat(64), require_no_decision: true }, idempotencyKey: 'fixed-original', confirmed: true })
    expect(result).toEqual({ status: 'unconfirmed' })
    expect(fetcher).toHaveBeenCalledOnce()
  }
})

it('does not return adoption success after scope or permission changes during submission', async () => {
  for (const change of ['scope', 'permission']) {
    const base = connection()
    let binding = { ...base, assetScope: { ownerProjectRef: 'project', credentialProjects: ['project'] }, admission: { ...base.admission, reviewAdoptionApproved: true } }
    const fetcher = vi.fn<typeof fetch>(async () => {
      binding = change === 'scope' ? { ...binding, context: { ...context, projectRef: 'project:other' } } : { ...binding, admission: { ...binding.admission, reviewAdoptionApproved: false } }
      return Response.json({ ok: true, status: 'success', data: { schema: 'eikona.owner.receipt.v1', operation_ref: `own_${'a'.repeat(24)}`, receipt_ref: `own_${'a'.repeat(24)}`, state: 'succeeded', outcome_refs: ['decision:run:candidate:v1'] } })
    })
    const client = new EikonaDiscoveryClient(async () => binding, fetcher)
    const input = { request: { project_ref: 'project', asset_ref: 'run', review_version: 'candidate', decision: 'accept', expected_content_digest: 'a'.repeat(64), require_no_decision: true }, idempotencyKey: 'original-key', confirmed: true }
    expect(await client.submitAdoption(context, input)).toEqual({ status: 'unconfirmed' })
    expect(fetcher).toHaveBeenCalledOnce()
    expect(input.idempotencyKey).toBe('original-key')
    expect(new Headers(fetcher.mock.calls[0]![1]?.headers).get('Idempotency-Key')).toBe('original-key')
  }
})

it('reconciles the original key with no mutation body even when adoption is disabled', async () => {
  const base = connection()
  const binding = { ...base, assetScope: { ownerProjectRef: 'project', credentialProjects: ['project'] }, admission: { ...base.admission, reviewAdoptionApproved: false } }
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ ok: true, status: 'success', data: {} }))
  const client = new EikonaDiscoveryClient(async () => binding, fetcher)
  const query = { projectId: 'project', runId: 'run', candidateId: 'candidate', decisionVersion: 0, idempotencyKey: 'original-key' }
  await client.reconcileAdoption(context, query)
  expect(String(fetcher.mock.calls[0]![0])).toBe('http://127.0.0.1:12345/api/v1/owner/operations/original-key:reconcile')
  expect(fetcher.mock.calls[0]![1]?.method).toBe('POST')
  expect(fetcher.mock.calls[0]![1]?.body).toBeUndefined()
  expect(new Headers(fetcher.mock.calls[0]![1]?.headers).get('Idempotency-Key')).toBeNull()
  expect((await client.reconcileAdoption(context, { ...query, projectId: 'other' })).status).toBe('permission_denied')
  expect(fetcher).toHaveBeenCalledOnce()
})
it('blocks unapproved or remote connections before I/O', async () => {
  for (const mode of ['remote', 'approval', 'scope']) {
    const binding = connection()
    const changed = mode === 'remote' ? { ...binding, baseURL: 'https://example.com' } : mode === 'approval' ? { ...binding, admission: { ...binding.admission, approved: false } } : { ...binding, context: { ...context, projectRef: 'project:other' } }
    const fetcher = vi.fn<typeof fetch>()
    await new EikonaDiscoveryClient(async () => changed, fetcher).inspect(context)
    expect(fetcher).not.toHaveBeenCalled()
  }
})
it('discards late responses after project or admission changes without retry', async () => {
  let binding = connection()
  const fetcher = vi.fn<typeof fetch>(async () => { binding = { ...binding, context: { ...context, revision: '2' } }; return Response.json({}) })
  expect(await new EikonaDiscoveryClient(async () => binding, fetcher).inspect(context)).toEqual({ status: 'permission_denied' })
  expect(fetcher).toHaveBeenCalledOnce()
})

it('lists a bounded owner page only through a verified single-project credential binding', async () => {
  const binding = { ...connection(), assetScope: { ownerProjectRef: 'owner-project:a', credentialProjects: ['owner-project:a'] } }
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ ok: true, status: 'success', data: { schema_version: 'eikona.asset_graph.v1', assets: [], count: 0, pagination: { limit: 20 } } }))
  const client = new EikonaDiscoveryClient(async () => binding, fetcher)
  expect(await client.listAssets(context, { limit: 20, cursor: 'opaque&cursor' })).toEqual({ status: 'ready', items: [] })
  const url = new URL(String(fetcher.mock.calls[0]![0]))
  expect(url.pathname).toBe('/api/v1/assets'); expect(url.searchParams.get('cursor')).toBe('opaque&cursor')
  expect(url.searchParams.get('limit')).toBe('20')
  binding.assetScope.credentialProjects.push('owner-project:b')
  expect(await client.listAssets(context)).toEqual({ status: 'needs_contract' })
  expect(fetcher).toHaveBeenCalledOnce()
})
it('rejects invalid list input and discards results after credential scope changes', async () => {
  let binding = { ...connection(), assetScope: { ownerProjectRef: 'owner-project:a', credentialProjects: ['owner-project:a'] } }
  const fetcher = vi.fn<typeof fetch>(async () => { binding = { ...binding, assetScope: { ownerProjectRef: 'owner-project:b', credentialProjects: ['owner-project:b'] } }; return Response.json({ ok: true, status: 'success', data: {} }) })
  const client = new EikonaDiscoveryClient(async () => binding, fetcher)
  expect(await client.listAssets(context, { limit: 101 })).toEqual({ status: 'invalid_input' })
  expect(fetcher).not.toHaveBeenCalled()
  expect(await client.listAssets(context)).toEqual({ status: 'permission_denied' })
  expect(fetcher).toHaveBeenCalledOnce()
})

it('requires confirmation and Host access admission before a single candidate grant request', async () => {
  const claim = { artifactRef: 'eikona://artifacts/run/one', contentDigest: 'a'.repeat(64), idempotencyKey: 'fixed-preview-key', confirmed: true }
  const binding = { ...connection(), mediaBaseURL: 'http://127.0.0.1:12345', assetScope: { ownerProjectRef: 'project:a', credentialProjects: ['project:a'] }, admission: { ...connection().admission, mediaAccessApproved: true } }
  const fetcher = vi.fn<typeof fetch>(async () => { throw new Error('connection lost') })
  const client = new EikonaDiscoveryClient(async () => binding, fetcher)
  expect(await client.requestMediaAccess(context, { ...claim, confirmed: false })).toEqual({ status: 'invalid_input' })
  expect(fetcher).not.toHaveBeenCalled()
  expect(await client.requestMediaAccess(context, claim)).toEqual({ status: 'unconfirmed' })
  expect(fetcher).toHaveBeenCalledOnce()
  expect(new Headers(fetcher.mock.calls[0]![1]?.headers).get('Idempotency-Key')).toBe('fixed-preview-key')
  expect(fetcher.mock.calls[0]![1]).toMatchObject({ method: 'POST', body: '{"confirm":true}', redirect: 'error' })
  binding.admission.mediaAccessApproved = false
  expect(await client.requestMediaAccess(context, claim)).toEqual({ status: 'needs_contract' })
  expect(fetcher).toHaveBeenCalledOnce()
})

it('keeps candidate image bytes and grant URLs out of results after identity changes', async () => {
  const bytes = new Uint8Array([137,80,78,71])
  const digest = createHash('sha256').update(bytes).digest('hex')
  for (const changed of [false, true]) {
    let binding = { ...connection(), mediaBaseURL: 'http://127.0.0.1:12345', assetScope: { ownerProjectRef: 'project:a', credentialProjects: ['project:a'] }, admission: { ...connection().admission, mediaAccessApproved: true } }
    const fetcher = vi.fn<typeof fetch>(async (_url, options) => {
      if (options?.method === 'POST') return Response.json({ ok: true, status: 'success', data: { schema_version: 'eikona.artifact_access_grant.v1', artifact_uri: 'eikona://artifacts/run/one', sha256: digest, size_bytes: 4, grant_id: `grant_${'a'.repeat(32)}`, expires_at: new Date(Date.now()+60000).toISOString(), url: `http://127.0.0.1:12345/api/v1/artifact-access/acc_${'b'.repeat(48)}` } })
      if (changed) binding = { ...binding, context: { ...context, principalRef: 'principal:other' } }
      return new Response(bytes, { headers: { 'content-type': 'image/png' } })
    })
    const result = await new EikonaDiscoveryClient(async () => binding, fetcher).readCandidateImage(context, { artifactRef: 'eikona://artifacts/run/one', contentDigest: digest, idempotencyKey: 'original-access', confirmed: true })
    expect(result.status).toBe(changed ? 'permission_denied' : 'ready')
    expect(JSON.stringify(result)).not.toContain('acc_')
    if (result.status === 'ready') expect(result.value.bytes).toEqual(bytes)
    expect(fetcher).toHaveBeenCalledTimes(2)
  }
})

it('requires separate generation execution admission and sends one fixed owner request', async () => {
  const base = connection()
  let enabled = false
  const operation = `own_${'a'.repeat(24)}`
  const runId = `run_owner_${createHash('sha256').update(operation).digest('hex').slice(0, 32)}`
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ ok: true, status: 'success', data: { schema: 'eikona.owner.receipt.v1', receipt_ref: operation, operation_ref: operation, state: 'succeeded', outcome_refs: [runId] } }))
  const client = new EikonaDiscoveryClient(async () => ({ ...base, assetScope: { ownerProjectRef: 'project', credentialProjects: ['project'] }, admission: { ...base.admission, preparationApproved: true, generationApprovalApproved: true, generationExecutionApproved: enabled } }), fetcher)
  const input = { request: { project_ref: 'project:project', approval_ref: `ega_${'a'.repeat(64)}`, prompt_version: 'eikona://prompts/prompt/versions/1', model: 'openai/gpt-5.4-image-2', cost_limit: { max_images: 1 }, dry_run: false }, idempotencyKey: 'generation-original', confirmed: true }
  expect((await client.submitGeneration(context, input)).status).toBe('permission_denied')
  expect(fetcher).not.toHaveBeenCalled()
  enabled = true
  expect((await client.submitGeneration(context, { ...input, request: { ...input.request, project_ref: 'project:foreign' } })).status).toBe('permission_denied')
  expect((await client.submitGeneration(context, input))).toMatchObject({ status: 'observed', generationConfirmed: true, runId })
  expect(fetcher).toHaveBeenCalledOnce()
  expect(String(fetcher.mock.calls[0]![0])).toBe('http://127.0.0.1:12345/api/v1/owner/generation:submit')
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual(input.request)
  expect(new Headers(fetcher.mock.calls[0]![1]?.headers).get('Idempotency-Key')).toBe(input.idempotencyKey)
})
it('does not retry a lost generation response or confirm after execution permission changes', async () => {
  const base = connection()
  let enabled = true
  const input = { request: { project_ref: 'project:project', approval_ref: `ega_${'a'.repeat(64)}`, prompt_version: 'eikona://prompts/prompt/versions/1', model: 'openai/gpt-5.4-image-2', cost_limit: { max_images: 1 }, dry_run: false }, idempotencyKey: 'generation-original', confirmed: true }
  for (const mode of ['lost', 'late_permission']) {
    enabled = true
    const fetcher = vi.fn<typeof fetch>(async () => {
      if (mode === 'lost') throw new Error('synthetic response loss')
      enabled = false
      return Response.json({ ok: true, status: 'success', data: {} })
    })
    const client = new EikonaDiscoveryClient(async () => ({ ...base, assetScope: { ownerProjectRef: 'project', credentialProjects: ['project'] }, admission: { ...base.admission, generationExecutionApproved: enabled } }), fetcher)
    expect(await client.submitGeneration(context, input)).toEqual({ status: 'unconfirmed' })
    expect(fetcher).toHaveBeenCalledOnce()
  }
})

it('reconciles the original generation key with writes disabled and rejects another contract', async () => {
  const base = connection(), operation = `own_${'a'.repeat(24)}`
  const runId = `run_owner_${createHash('sha256').update(operation).digest('hex').slice(0, 32)}`
  let action = 'eikona.generation.submit'
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ ok: true, status: 'success', data: { schema: 'eikona.owner.receipt.v1', receipt_ref: operation, operation_ref: operation, contract_id: `${action}.v1`, action, state: 'succeeded', outcome_refs: [runId], created_at: '2026-09-09T00:00:00Z', updated_at: '2026-09-09T00:01:00Z' } }))
  const client = new EikonaDiscoveryClient(async () => ({ ...base, assetScope: { ownerProjectRef: 'project', credentialProjects: ['project'] }, admission: { ...base.admission, generationExecutionApproved: false } }), fetcher)
  const query = { projectId: 'project', idempotencyKey: 'original-key', operationRef: operation }
  expect(await client.reconcileGeneration(context, query)).toMatchObject({ status: 'observed', operationRef: operation, runId, generationConfirmed: true })
  expect(String(fetcher.mock.calls[0]![0])).toBe('http://127.0.0.1:12345/api/v1/owner/operations/original-key:reconcile')
  expect(fetcher.mock.calls[0]![1]?.body).toBeUndefined()
  expect(await client.reconcileGeneration(context, { ...query, projectId: 'foreign' })).toEqual({ status: 'permission_denied' })
  expect(fetcher).toHaveBeenCalledOnce()
  action = 'eikona.review.decide'
  expect(await client.reconcileGeneration(context, query)).toEqual({ status: 'unconfirmed' })
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('reads fixed batch metadata with host project scope and rejects substituted identity', async () => {
  const base = connection(), digest = `sha256:${'c'.repeat(64)}`
  let project = 'project:one'
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ ok: true, status: 'success', data: { schema_version: 'eikona.batch_input_preview.v1', project_ref: project, request_batch_ref: 'batch:one&two', request_batch_digest: digest, request_count: 1, candidate_count: 2, execution_authorized: false } }))
  const client = new EikonaDiscoveryClient(async () => ({ ...base, assetScope: { ownerProjectRef: 'one', credentialProjects: ['one'] } }), fetcher)
  expect(await client.readBatchInput(context, { batchRef: 'batch:one&two', digest })).toMatchObject({ status: 'ready', candidateCount: 2, executionAuthorized: false })
  const url = new URL(String(fetcher.mock.calls[0]![0]))
  expect(url.searchParams.get('request_batch_ref')).toBe('batch:one&two')
  expect(url.searchParams.get('project_ref')).toBe('project:one')
  expect(fetcher.mock.calls[0]![1]?.method).toBe('GET')
  project = 'project:other'
  expect((await client.readBatchInput(context, { batchRef: 'batch:one&two', digest })).status).toBe('unconfirmed')
})
it('does not read a batch when the pinned connection disappears or throws', async () => {
  for (const mode of ['changed', 'throws']) {
    const base = { ...connection(), assetScope: { ownerProjectRef: 'one', credentialProjects: ['one'] } }
    let calls = 0
    const fetcher = vi.fn<typeof fetch>()
    const client = new EikonaDiscoveryClient(async () => {
      if (++calls === 1) return base
      if (mode === 'throws') throw new Error('fixture resolver failure')
      return { ...base, assetScope: { ownerProjectRef: 'other', credentialProjects: ['other'] } }
    }, fetcher)
    expect((await client.readBatchInput(context, { batchRef: 'batch:one', digest: `sha256:${'c'.repeat(64)}` })).status).not.toBe('ready')
    expect(fetcher).not.toHaveBeenCalled()
  }
})
it('lists fixed batch versions and rejects foreign or duplicate page members', async () => {
  const base = connection(), digest = `sha256:${'c'.repeat(64)}`
  const item = { project_ref: 'project:one', request_batch_ref: 'batch:one', request_batch_digest: digest, request_count: 1, candidate_count: 2 }
  let items = [item]
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ ok: true, status: 'success', data: { schema_version: 'eikona.batch_input_page.v1', project_ref: 'project:one', items } }))
  const client = new EikonaDiscoveryClient(async () => ({ ...base, assetScope: { ownerProjectRef: 'one', credentialProjects: ['one'] } }), fetcher)
  expect(await client.listBatchInputs(context, { limit: 2 })).toMatchObject({ status: 'ready', items: [{ batchRef: 'batch:one', digest }] })
  items = [item, item]
  expect((await client.listBatchInputs(context, { limit: 2 })).status).toBe('unconfirmed')
  items = [{ ...item, project_ref: 'project:other' }]
  expect((await client.listBatchInputs(context)).status).toBe('unconfirmed')
  const count = fetcher.mock.calls.length
  expect((await client.listBatchInputs(context, { cursor: '../escape' })).status).toBe('invalid_input')
  expect(fetcher).toHaveBeenCalledTimes(count)
})
it('preserves unknown batch cost and blocked planning without granting execution', async () => {
  const base = connection(), digest = `sha256:${'c'.repeat(64)}`
  const value = { schema_version: 'eikona.batch_plan_preview.v1', project_ref: 'project:one', request_batch_ref: 'batch:one', request_batch_digest: digest, plan_digest: `sha256:${'d'.repeat(64)}`, status: 'blocked', request_count: 1, estimated_calls: 1, max_parallel_requests: 1, max_provider_calls: 1, cost_estimate_known: false, blockers: [{ request_id: 'request:one', code: 'COST_ESTIMATE_UNKNOWN' }], execution_authorized: false }
  let data: unknown = value
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ ok: true, status: 'success', data }))
  const client = new EikonaDiscoveryClient(async () => ({ ...base, assetScope: { ownerProjectRef: 'one', credentialProjects: ['one'] } }), fetcher)
  const input = { batchRef: 'batch:one', digest }
  expect(await client.readBatchPlan(context, input)).toMatchObject({ status: 'ready', planStatus: 'blocked', costEstimateKnown: false, executionAuthorized: false })
  for (const invalid of [{ ...value, estimated_usd_upper: 0 }, { ...value, execution_authorized: true }, { ...value, status: 'ready' }, { ...value, request_batch_digest: `sha256:${'a'.repeat(64)}` }]) {
    data = invalid
    expect((await client.readBatchPlan(context, input)).status).toBe('unconfirmed')
  }
})
