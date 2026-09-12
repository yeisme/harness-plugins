import { createHash } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { AuctraWorkingCopyClient, AUCTRA_CANDIDATE_CONTENT_SCHEMA_DIGEST, AUCTRA_CANDIDATE_LIST_SCHEMA_DIGEST, AUCTRA_WORKING_COPY_SCHEMA_DIGEST } from '../src/auctra-working-copy-client.ts'
import { createAuctraWorkingCopyAdapter } from '../src/auctra-working-copy-adapter.ts'
import { normalizeAuctraWorkingCopyOpen } from '../src/auctra-working-copy.ts'
import { validateCreatorOwnerSnapshot } from '../src/validation.ts'

const context = { tenantRef: 'tenant:test', workspaceRef: 'workspace:test', projectRef: 'project:test', sessionRef: 'session:test', principalRef: 'principal:test',
  membershipRevision: '1', installationRef: 'installation:test', pluginDigest: 'digest:test', policyRevision: '1', runtimeGeneration: '1', revision: '1' }
const body = '第一章正文。', digest = (value: string) => createHash('sha256').update(value).digest('hex')
const copy = { schema_version: 'auctra.text_working_copy.v1alpha1', working_copy_ref: 'twc-test', project_ref: '/fixture/project', unit_ref: 'text:one',
  format: 'plain_text', working_revision: 0, content_digest: digest(body), content_length: Buffer.byteLength(body), status: 'editing', allowed_actions: ['apply'] }
const envelope = (data: unknown) => ({ schema_version: 'auctra.api.envelope.v1', status: 'success', data })
const opened = normalizeAuctraWorkingCopyOpen(envelope({ working_copy: copy, body, compatibility_projection: false }), { ownerProjectRef: copy.project_ref, openRef: copy.unit_ref })!
const units = [{ id: 'ch_001', kind: 'chapter', title: '第一章', status: 'draft' }, { id: 'note_001', kind: 'wechat_article', title: '随笔', status: 'draft' }]
const connection = () => ({ context: { ...context }, baseURL: 'http://127.0.0.1:8743', ownerProjectRef: copy.project_ref, headers: {},
  admission: { consumer: 'dsh' as const, schemaDigest: AUCTRA_WORKING_COPY_SCHEMA_DIGEST, approved: true, writeApproved: true, candidateRequestRecovery: 'v1alpha1' as const } })
const lifecycleReads = (url: Parameters<typeof fetch>[0]) => {
  const href = String(url)
  if (href.includes('/checkpoints')) return Response.json(envelope({ checkpoints: [] }))
  if (href.includes('/review/queue')) return Response.json(envelope({ Items: [] }))
  if (href.includes('/text-units/') && href.includes('/draft')) return Response.json(envelope({ unit_id: 'one', revision: 'rev-fixed' }))
  return undefined
}

it('lists three-type structure without a body and keeps unauthorized reads honest', async () => {
  const fetcher = vi.fn<typeof fetch>(async url => lifecycleReads(url) ?? (String(url).includes('/text-units') ? Response.json(envelope(units)) : Response.json(envelope({ ...copy, unit_ref: 'text:one' }))))
  const adapter = createAuctraWorkingCopyAdapter(new AuctraWorkingCopyClient(async () => connection(), fetcher), async () => ({ unitRef: opened.artifact ? copy.unit_ref : copy.unit_ref, artifact: opened.artifact, canSave: true }))
  const snapshot = await adapter.snapshot(context)
  expect(validateCreatorOwnerSnapshot(snapshot)?.resources.map(item => item.kind)).toEqual(expect.arrayContaining(['chapter', 'text']))
  expect(JSON.stringify(snapshot)).not.toMatch(/第一章正文|secret-body/)
  const denied = createAuctraWorkingCopyAdapter(new AuctraWorkingCopyClient(async () => ({ ...connection(), admission: undefined }), fetcher), async () => undefined)
  const blocked = await denied.snapshot(context)
  expect(blocked.status).toBe('contract_mismatch')
  expect(blocked.summary).toMatch(/unavailable or mismatched/)
  expect(blocked.artifactWorkspace?.artifacts).toEqual([])
  expect(JSON.stringify(blocked)).not.toMatch(/第一章正文/)
})

it('marks save unknown without a confirming receipt and keeps the pending edit on conflict', async () => {
  const fetcher = vi.fn<typeof fetch>(async (url, options) => {
    if (lifecycleReads(url)) return lifecycleReads(url)!
    if (String(url).includes('/text-units')) return Response.json(envelope(units))
    if (options?.method === 'GET') return Response.json(envelope(copy))
    if (options?.method === 'POST' && String(url).includes('/open')) return Response.json(envelope({ working_copy: copy, body, compatibility_projection: false }))
    if (options?.method === 'PUT') return Response.json({ schema_version: 'auctra.api.envelope.v1', status: 'failed', error: { code: 'working_copy_conflict' } }, { status: 409 })
    throw Error('unexpected')
  })
  const adapter = createAuctraWorkingCopyAdapter(new AuctraWorkingCopyClient(async () => connection(), fetcher), async () => ({ unitRef: copy.unit_ref, artifact: opened.artifact, canSave: true }))
  const snapshot = await adapter.snapshot(context)
  const save = snapshot.actions.find(item => item.actionId === 'working-copy.save')!
  const lost = vi.fn<typeof fetch>(async (url, options) => {
    if (lifecycleReads(url)) return lifecycleReads(url)!
    if (String(url).includes('/text-units')) return Response.json(envelope(units))
    if (options?.method === 'GET') return Response.json(envelope(copy))
    if (options?.method === 'POST' && String(url).includes('/open')) return Response.json(envelope({ working_copy: copy, body, compatibility_projection: false }))
    throw Error('lost')
  })
  const unknownAdapter = createAuctraWorkingCopyAdapter(new AuctraWorkingCopyClient(async () => connection(), lost), async () => ({ unitRef: copy.unit_ref, artifact: opened.artifact, canSave: true }))
  const unknown = await unknownAdapter.dispatch({ schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: save.actionId, descriptorRef: save.descriptorRef,
    expectedTargetRef: save.targetRef, expectedTargetVersion: save.targetVersion, context, idempotencyKey: 'save-unknown', values: { body: 'pending edit', content_revision: opened.artifact.version } }, context)
  expect(unknown.status).toBe('unknown')
  expect(unknown.summary).toMatch(/not confirmed/)
  const conflict = await adapter.dispatch({ schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: save.actionId, descriptorRef: save.descriptorRef,
    expectedTargetRef: save.targetRef, expectedTargetVersion: save.targetVersion, context, idempotencyKey: 'save-conflict', values: { body: 'pending edit', content_revision: opened.artifact.version } }, context)
  expect(conflict.status).toBe('rejected')
  expect(conflict.summary).toMatch(/keep the pending edit/)
})

it('adopts a candidate into Working Copy only and rejects a stale base without mutating the accepted version', async () => {
  const next = '改写后的第一章。'
  const candidate = { schema_version: 'auctra.text_working_copy.v1alpha1', candidate_ref: 'cand-abc123def456', working_copy_ref: 'twc-test',
    form: 'document', base_revision: 0, base_digest: digest(body), result_digest: digest(next), result_length: Buffer.byteLength(next),
    patch_edit_count: 1, producer_kind: 'agent_candidate', status: 'pending' }
  const receipt = { working_copy: { ...copy, working_revision: 1, content_digest: digest(next), content_length: Buffer.byteLength(next) },
    applied: true, replayed: false, no_op: false, journal_ref: 'twcj-twc-test-1', journal_sequence: 1, result_digest: digest(next), result_length: Buffer.byteLength(next) }
  const fetcher = vi.fn<typeof fetch>(async (url, options) => {
    const lifecycle = lifecycleReads(url)
    if (lifecycle) return lifecycle
    if (String(url).includes('/text-units')) return Response.json(envelope(units))
    if (options?.method === 'GET' && !String(url).includes('/candidates/')) return Response.json(envelope(copy))
    if (options?.method === 'POST' && String(url).includes('/open')) return Response.json(envelope({ working_copy: copy, body, compatibility_projection: false }))
    if (options?.method === 'POST' && String(url).endsWith('/candidates?major=1')) return Response.json(envelope(candidate))
    if (String(url).includes('/candidates/cand-abc123def456/apply')) return Response.json({ schema_version: 'auctra.api.envelope.v1', status: 'failed', error: { code: 'candidate_stale' } }, { status: 409 })
    throw Error(`unexpected ${url}`)
  })
  const adapter = createAuctraWorkingCopyAdapter(new AuctraWorkingCopyClient(async () => connection(), fetcher), async () => ({ unitRef: copy.unit_ref, artifact: opened.artifact, canSave: true }))
  const created = await adapter.dispatch({ schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: 'working-copy.candidate.create',
    descriptorRef: (await adapter.snapshot(context)).actions.find(item => item.actionId === 'working-copy.candidate.create')!.descriptorRef,
    expectedTargetRef: opened.artifact.ref, expectedTargetVersion: opened.artifact.version, context, idempotencyKey: 'candidate-one',
    values: { body: next, content_revision: opened.artifact.version } }, context)
  expect(created.status).toBe('completed')
  expect(created.summary).toMatch(/accepted version is unchanged/)
  const afterCreate = await adapter.snapshot(context)
  expect(afterCreate.artifactWorkspace?.artifacts[0]?.acceptedVersion).toBe(opened.artifact.version)
  expect(fetcher.mock.calls.filter(([, options]) => options?.method === 'POST' || options?.method === 'PUT').map(([url]) => String(url)))
    .not.toEqual(expect.arrayContaining([expect.stringMatching(/\/(checkpoint|review|canon)/i)]))
  const adopt = afterCreate.actions.find(item => item.actionId === 'working-copy.candidate.adopt')!
  const stale = await adapter.dispatch({ schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: adopt.actionId, descriptorRef: adopt.descriptorRef,
    expectedTargetRef: opened.artifact.ref, expectedTargetVersion: opened.artifact.version, context, idempotencyKey: 'adopt-stale',
    values: { candidate_ref: 'cand-abc123def456', candidate_version: afterCreate.artifactWorkspace!.artifacts[0]!.candidates[0]!.version, source_version: opened.artifact.version } }, context)
  expect(stale.status).toBe('rejected')
  expect((await adapter.snapshot(context)).artifactWorkspace?.artifacts[0]?.acceptedVersion).toBe(opened.artifact.version)
  fetcher.mockImplementation(async (url, options) => {
    const lifecycle = lifecycleReads(url)
    if (lifecycle) return lifecycle
    if (String(url).includes('/text-units')) return Response.json(envelope(units))
    if (options?.method === 'GET' && !String(url).includes('/candidates/')) return Response.json(envelope(copy))
    if (options?.method === 'POST' && String(url).includes('/open')) return Response.json(envelope({ working_copy: copy, body, compatibility_projection: false }))
    if (String(url).includes('/candidates/cand-abc123def456/apply')) return Response.json(envelope({ receipt, candidate: { ...candidate, status: 'applied_to_working_copy' } }))
    throw Error(`unexpected ${url}`)
  })
  const adopted = await adapter.dispatch({ schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: adopt.actionId, descriptorRef: adopt.descriptorRef,
    expectedTargetRef: opened.artifact.ref, expectedTargetVersion: opened.artifact.version, context, idempotencyKey: 'adopt-ok',
    values: { candidate_ref: 'cand-abc123def456', candidate_version: afterCreate.artifactWorkspace!.artifacts[0]!.candidates[0]!.version, source_version: opened.artifact.version } }, context)
  expect(adopted.status).toBe('completed')
  expect(adopted.summary).toMatch(/Checkpoint, Review, and Canon stay separate/)
  expect(adopted.outputArtifacts?.[0]?.version).not.toBe(opened.artifact.version)
})

it('undoes a pending owner candidate without changing the accepted Working Copy', async () => {
  const next = '改写后的第一章。'
  const candidate = { schema_version: 'auctra.text_working_copy.v1alpha1', candidate_ref: 'cand-abc123def456', working_copy_ref: 'twc-test',
    form: 'document', base_revision: 0, base_digest: digest(body), result_digest: digest(next), result_length: Buffer.byteLength(next),
    patch_edit_count: 1, producer_kind: 'agent_candidate', status: 'pending' }
  const fetcher = vi.fn<typeof fetch>(async (url, options) => {
    const lifecycle = lifecycleReads(url)
    if (lifecycle) return lifecycle
    if (String(url).includes('/text-units')) return Response.json(envelope(units))
    if (options?.method === 'GET' && !String(url).includes('/candidates/')) return Response.json(envelope(copy))
    if (options?.method === 'POST' && String(url).includes('/open')) return Response.json(envelope({ working_copy: copy, body, compatibility_projection: false }))
    if (options?.method === 'POST' && String(url).endsWith('/candidates?major=1')) return Response.json(envelope(candidate))
    if (options?.method === 'POST' && String(url).includes('/candidates/cand-abc123def456/reject')) return Response.json(envelope({ ...candidate, status: 'rejected' }))
    if (String(url).includes('/apply')) throw Error('undo must not adopt')
    throw Error(`unexpected ${url}`)
  })
  const adapter = createAuctraWorkingCopyAdapter(new AuctraWorkingCopyClient(async () => connection(), fetcher), async () => ({ unitRef: copy.unit_ref, artifact: opened.artifact, canSave: true }))
  await adapter.dispatch({ schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: 'working-copy.candidate.create',
    descriptorRef: (await adapter.snapshot(context)).actions.find(item => item.actionId === 'working-copy.candidate.create')!.descriptorRef,
    expectedTargetRef: opened.artifact.ref, expectedTargetVersion: opened.artifact.version, context, idempotencyKey: 'candidate-undo',
    values: { body: next, content_revision: opened.artifact.version } }, context)
  const afterCreate = await adapter.snapshot(context)
  expect(afterCreate.artifactWorkspace?.artifacts[0]?.acceptedVersion).toBe(opened.artifact.version)
  const undo = afterCreate.actions.find(item => item.actionId === 'working-copy.candidate.undo')!
  const undone = await adapter.dispatch({ schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: undo.actionId, descriptorRef: undo.descriptorRef,
    expectedTargetRef: opened.artifact.ref, expectedTargetVersion: opened.artifact.version, context, idempotencyKey: 'undo-one',
    values: { candidate_ref: 'cand-abc123def456', candidate_version: afterCreate.artifactWorkspace!.artifacts[0]!.candidates[0]!.version, source_version: opened.artifact.version } }, context)
  expect(undone.status).toBe('completed')
  expect(undone.summary).toMatch(/accepted Working Copy is unchanged/)
  const afterUndo = await adapter.snapshot(context)
  expect(afterUndo.artifactWorkspace?.artifacts[0]?.acceptedVersion).toBe(opened.artifact.version)
  expect(afterUndo.artifactWorkspace?.artifacts[0]?.candidates).toEqual([])
  expect(afterUndo.actions.some(item => item.actionId === 'working-copy.candidate.undo' || item.actionId === 'working-copy.candidate.adopt')).toBe(false)
})

it('compares and adopts a non-first historical candidate on a fresh adapter without Checkpoint, Review, or Canon', async () => {
  const firstBody = '历史候选一。', secondBody = '历史候选二，采用这一条。'
  const first = { schema_version: 'auctra.text_working_copy.v1alpha1', candidate_ref: 'cand-hist001', working_copy_ref: 'twc-test',
    form: 'document', base_revision: 0, base_digest: digest(body), result_digest: digest(firstBody), result_length: Buffer.byteLength(firstBody),
    patch_edit_count: 1, producer_kind: 'agent_candidate', status: 'pending' }
  const second = { ...first, candidate_ref: 'cand-hist002', result_digest: digest(secondBody), result_length: Buffer.byteLength(secondBody) }
  const staleSecond = { ...second, base_digest: digest('older') }
  const receipt = { working_copy: { ...copy, working_revision: 1, content_digest: digest(secondBody), content_length: Buffer.byteLength(secondBody) },
    applied: true, replayed: false, no_op: false, journal_ref: 'twcj-twc-test-1', journal_sequence: 1, result_digest: digest(secondBody), result_length: Buffer.byteLength(secondBody) }
  const listing = () => ({ ...connection(), admission: { ...connection().admission,
    candidateListDigest: AUCTRA_CANDIDATE_LIST_SCHEMA_DIGEST, candidateContentDigest: AUCTRA_CANDIDATE_CONTENT_SCHEMA_DIGEST } })
  const respond = (showSecond: unknown, apply = false) => async (url: Parameters<typeof fetch>[0], options?: Parameters<typeof fetch>[1]) => {
    const href = String(url)
    const lifecycle = lifecycleReads(url)
    if (lifecycle) return lifecycle
    if (href.includes('/text-units')) return Response.json(envelope(units))
    if (href.includes('/candidates/cand-hist001/content')) return Response.json(envelope({ candidate: first, body: firstBody }))
    if (href.includes('/candidates/cand-hist002/content')) return Response.json(envelope({ candidate: second, body: secondBody }))
    if (href.includes('/candidates/cand-hist001') && !href.includes('/apply')) return Response.json(envelope(first))
    if (href.includes('/candidates/cand-hist002') && !href.includes('/apply')) return Response.json(envelope(showSecond))
    if (href.includes('/candidates?')) return Response.json(envelope({ candidates: [first, second] }))
    if (!href.includes('/candidates') && options?.method === 'GET') return Response.json(envelope(copy))
    if (options?.method === 'POST' && href.includes('/open')) return Response.json(envelope({ working_copy: copy, body, compatibility_projection: false }))
    if (apply && href.includes('/candidates/cand-hist002/apply')) return Response.json(envelope({ receipt, candidate: { ...second, status: 'applied_to_working_copy' } }))
    throw Error(`unexpected ${href}`)
  }
  const fetcher = vi.fn<typeof fetch>(respond(staleSecond))
  const adapter = createAuctraWorkingCopyAdapter(new AuctraWorkingCopyClient(async () => listing(), fetcher), async () => ({ unitRef: copy.unit_ref, artifact: opened.artifact, canSave: true }))
  const snapshot = await adapter.snapshot(context)
  const workspace = validateCreatorOwnerSnapshot(snapshot)?.artifactWorkspace?.artifacts[0]
  expect(workspace?.acceptedVersion).toBe(opened.artifact.version)
  expect(workspace?.candidates.map(item => item.ref)).toEqual(['cand-hist001', 'cand-hist002'])
  expect(workspace?.actions?.saveDraft).toBeDefined()
  expect(workspace?.actions?.adopt).toBeDefined()
  expect(fetcher.mock.calls.filter(([, options]) => options?.method === 'POST' || options?.method === 'PUT').map(([url]) => String(url)))
    .not.toEqual(expect.arrayContaining([expect.stringMatching(/\/(checkpoint|review|canon)/i)]))
  expect(JSON.stringify(snapshot)).not.toMatch(/历史候选/)
  const source = await adapter.readArtifactContent(opened.artifact, context)
  const compared = await adapter.readArtifactContent(workspace!.candidates[1]!.artifact!, context)
  expect(source?.content).toBe(body)
  expect(compared?.content).toBe(secondBody)
  expect(fetcher.mock.calls.some(([href]) => String(href).includes('/apply'))).toBe(false)
  const adopt = snapshot.actions.find(item => item.actionId === 'working-copy.candidate.adopt')!
  const stale = await adapter.dispatch({ schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: adopt.actionId, descriptorRef: adopt.descriptorRef,
    expectedTargetRef: opened.artifact.ref, expectedTargetVersion: opened.artifact.version, context, idempotencyKey: 'hist-stale',
    values: { candidate_ref: 'cand-hist002', candidate_version: `${0}:${digest(secondBody)}`, source_version: opened.artifact.version } }, context)
  expect(stale.status).toBe('rejected')
  expect(stale.summary).toMatch(/keep the pending edit, reread, compare/)
  expect((await adapter.snapshot(context)).artifactWorkspace?.artifacts[0]?.acceptedVersion).toBe(opened.artifact.version)
  expect(fetcher.mock.calls.some(([href]) => String(href).includes('/apply'))).toBe(false)
  fetcher.mockImplementation(respond(second, true))
  const adopted = await adapter.dispatch({ schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: adopt.actionId, descriptorRef: adopt.descriptorRef,
    expectedTargetRef: opened.artifact.ref, expectedTargetVersion: opened.artifact.version, context, idempotencyKey: 'hist-adopt',
    values: { candidate_ref: 'cand-hist002', candidate_version: `${0}:${digest(secondBody)}`, source_version: opened.artifact.version } }, context)
  expect(adopted.status).toBe('completed')
  expect(adopted.summary).toMatch(/Checkpoint, Review, and Canon stay separate/)
  expect(adopted.outputArtifacts?.[0]?.version).toBe(`1:${digest(secondBody)}`)
  expect(fetcher.mock.calls.some(([href]) => String(href).includes('cand-hist001/apply'))).toBe(false)
  expect(fetcher.mock.calls.filter(([, options]) => options?.method !== 'GET').map(([href]) => String(href)))
    .not.toEqual(expect.arrayContaining([expect.stringMatching(/\/(checkpoint|review|canon)/i)]))
})

it('reconciles an unknown adopt from the original identity without applying a still-pending candidate', async () => {
  const next = '改写后的第一章。'
  const listed = { schema_version: 'auctra.text_working_copy.v1alpha1', candidate_ref: 'cand-hist001', working_copy_ref: 'twc-test',
    form: 'document', base_revision: 0, base_digest: digest(body), result_digest: digest(next), result_length: Buffer.byteLength(next),
    patch_edit_count: 1, producer_kind: 'agent_candidate', status: 'pending' }
  const appliedCopy = { ...copy, working_revision: 1, content_digest: digest(next), content_length: Buffer.byteLength(next) }
  const listing = () => ({ ...connection(), admission: { ...connection().admission, candidateListDigest: AUCTRA_CANDIDATE_LIST_SCHEMA_DIGEST } })
  const fetcher = vi.fn<typeof fetch>(async (url, options) => {
    const href = String(url)
    const lifecycle = lifecycleReads(url)
    if (lifecycle) return lifecycle
    if (href.includes('/text-units')) return Response.json(envelope(units))
    if (href.includes('/candidates/cand-hist001') && !href.includes('/apply')) return Response.json(envelope(listed))
    if (href.includes('/candidates?')) return Response.json(envelope({ candidates: [listed] }))
    if (!href.includes('/candidates') && options?.method === 'GET') return Response.json(envelope(copy))
    if (options?.method === 'POST' && href.includes('/open')) return Response.json(envelope({ working_copy: copy, body, compatibility_projection: false }))
    if (href.includes('/candidates/cand-hist001/apply')) throw Error('lost apply')
    throw Error(`unexpected ${href}`)
  })
  const adapter = createAuctraWorkingCopyAdapter(new AuctraWorkingCopyClient(async () => listing(), fetcher), async () => ({ unitRef: copy.unit_ref, artifact: opened.artifact, canSave: true }))
  const snapshot = await adapter.snapshot(context)
  const adopt = snapshot.actions.find(item => item.actionId === 'working-copy.candidate.adopt')!
  const request = { schema: 'pane.action-request.v1alpha1' as const, owner: 'auctra' as const, actionId: adopt.actionId, descriptorRef: adopt.descriptorRef,
    expectedTargetRef: opened.artifact.ref, expectedTargetVersion: opened.artifact.version, context, idempotencyKey: 'adopt-unknown',
    values: { candidate_ref: 'cand-hist001', candidate_version: `${0}:${digest(next)}`, source_version: opened.artifact.version } }
  const unknown = await adapter.dispatch(request, context)
  expect(unknown.status).toBe('unknown')
  expect((await adapter.snapshot(context)).artifactWorkspace?.artifacts[0]?.acceptedVersion).toBe(opened.artifact.version)
  const lookup = { schema: 'pane.action-reconcile-request.v1alpha1' as const, owner: 'auctra' as const, actionId: adopt.actionId,
    expectedTargetRef: opened.artifact.ref, context, idempotencyKey: 'adopt-unknown' }
  const stillUnknown = await adapter.reconcile!(lookup, context)
  expect(stillUnknown.status).toBe('unknown')
  expect(fetcher.mock.calls.filter(([href]) => String(href).includes('/apply'))).toHaveLength(1)
  fetcher.mockImplementation(async (url, options) => {
    const href = String(url)
    if (href.includes('/reconcile')) return Response.json(envelope({ integrity_verified: true,
      working_copy: { ...appliedCopy, working_revision: 2, content_digest: digest('newer'), content_length: 5 },
      last_receipt: { working_copy: appliedCopy, applied: false, replayed: true, no_op: false, journal_ref: 'twcj-twc-test-1', journal_sequence: 1, result_digest: digest(next), result_length: Buffer.byteLength(next) } }))
    const lifecycle = lifecycleReads(url)
    if (lifecycle) return lifecycle
    if (href.includes('/text-units')) return Response.json(envelope(units))
    if (href.includes('/candidates/cand-hist001') && !href.includes('/apply')) return Response.json(envelope({ ...listed, status: 'applied_to_working_copy' }))
    if (href.includes('/candidates?')) return Response.json(envelope({ candidates: [{ ...listed, status: 'applied_to_working_copy' }] }))
    if (!href.includes('/candidates') && options?.method === 'GET') return Response.json(envelope(appliedCopy))
    if (options?.method === 'POST' && href.includes('/open')) return Response.json(envelope({ working_copy: appliedCopy, body: next, compatibility_projection: false }))
    if (href.includes('/apply')) throw Error('reconcile must not apply again')
    throw Error(`unexpected ${href}`)
  })
  const fresh = createAuctraWorkingCopyAdapter(new AuctraWorkingCopyClient(async () => listing(), fetcher), async () => ({ unitRef: copy.unit_ref, artifact: opened.artifact, canSave: true }))
  const confirmed = await fresh.reconcile!(lookup, context)
  expect(confirmed.status).toBe('completed')
  expect(confirmed.summary).toMatch(/Checkpoint, Review, and Canon stay separate/)
  expect(confirmed.outputArtifacts?.[0]?.version).toBe(`1:${digest(next)}`)
  expect(fetcher.mock.calls.filter(([href]) => String(href).includes('/apply'))).toHaveLength(1)
})

it('publishes Checkpoint, Review, Canon, and export as separate owner actions and does not run them from adopt', async () => {
  const checkpoint = { schema_version: 'auctra.text_working_copy.v1alpha1', snapshot_ref: 'chk-one', kind: 'checkpoint',
    working_copy_ref: 'twc-test', source_working_revision: 0, body_digest: digest(body), body_length: Buffer.byteLength(body),
    producer_kind: 'human_edit', created_at: '2026-09-08T00:00:00.000Z' }
  const review = { id: 'rev-chk-one', type: 'text_working_copy_checkpoint', status: 'pending', version: '2026-09-08T00:00:00.000Z', title: 'Checkpoint review' }
  const mutations: string[] = []
  const fetcher = vi.fn<typeof fetch>(async (url, options) => {
    const href = String(url)
    if (options?.method === 'POST' || options?.method === 'PUT') mutations.push(`${options.method} ${href}`)
    if (href.includes('/checkpoints') && options?.method === 'POST') return Response.json(envelope(checkpoint))
    if (href.includes('/checkpoints')) return Response.json(envelope({ checkpoints: [checkpoint] }))
    if (href.includes('/review/queue')) return Response.json(envelope({ Items: [review] }))
    if (href.includes('/review') && options?.method === 'POST' && href.includes('/text-working-copies/')) {
      return Response.json(envelope({ working_copy: copy, checkpoint_ref: 'chk-one', review_item_ref: 'rev-chk-one',
        source_working_revision: 0, body_digest: digest(body), submitted: true }))
    }
    if (href.includes('/review/items/rev-chk-one/accept')) return Response.json(envelope({
      schema_version: 'auctra.review_decision_receipt.v1', review_item_ref: 'review:rev-chk-one', decision_ref: 'review_decision:one',
      status: 'accepted', accepted_revision: 'rev-canon', evidence_refs: ['review:rev-chk-one'], replayed: false }))
    if (href.includes('/export')) return Response.json(envelope({
      schema_version: 'auctra.export_receipt.v1', artifact_ref: 'artifact:export-one', unit_ref: 'text:one',
      source_version_ref: 'rev-fixed', evidence_refs: ['artifact:export-one'], replayed: false }))
    if (href.includes('/text-units/') && href.includes('/draft')) return Response.json(envelope({ unit_id: 'one', revision: 'rev-fixed' }))
    if (href.includes('/text-units')) return Response.json(envelope(units))
    if (options?.method === 'GET') return Response.json(envelope(copy))
    throw Error(`unexpected ${href}`)
  })
  const adapter = createAuctraWorkingCopyAdapter(new AuctraWorkingCopyClient(async () => connection(), fetcher), async () => ({ unitRef: copy.unit_ref, artifact: opened.artifact, canSave: true }))
  const snapshot = await adapter.snapshot(context)
  expect(snapshot.actions.map(item => item.actionId)).toEqual(expect.arrayContaining([
    'working-copy.save', 'working-copy.checkpoint.create', 'working-copy.review.submit', 'review.accept', 'review.reject', 'text.export']))
  expect(snapshot.actions.find(item => item.actionId === 'working-copy.save')?.presentation?.task).toBe('assets')
  expect(snapshot.actions.find(item => item.actionId === 'working-copy.checkpoint.create')?.presentation?.group).toBe('versions')
  expect(snapshot.actions.find(item => item.actionId === 'text.export')?.presentation?.group).toBe('export')
  const created = await adapter.dispatch({ schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: 'working-copy.checkpoint.create',
    descriptorRef: snapshot.actions.find(item => item.actionId === 'working-copy.checkpoint.create')!.descriptorRef,
    expectedTargetRef: opened.artifact.ref, expectedTargetVersion: opened.artifact.version, context, idempotencyKey: 'checkpoint-one', values: {} }, context)
  expect(created.status).toBe('completed')
  expect(created.summary).toMatch(/Review and Canon stay separate/)
  const submitted = await adapter.dispatch({ schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: 'working-copy.review.submit',
    descriptorRef: snapshot.actions.find(item => item.actionId === 'working-copy.review.submit')!.descriptorRef,
    expectedTargetRef: opened.artifact.ref, expectedTargetVersion: opened.artifact.version, context, idempotencyKey: 'review-one',
    values: { checkpoint_ref: 'chk-one' } }, context)
  expect(submitted.status).toBe('completed')
  expect(submitted.summary).toMatch(/Canon is not accepted automatically/)
  const accepted = await adapter.dispatch({ schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: 'review.accept',
    descriptorRef: snapshot.actions.find(item => item.actionId === 'review.accept')!.descriptorRef,
    expectedTargetRef: opened.artifact.ref, expectedTargetVersion: opened.artifact.version, context, idempotencyKey: 'accept-one',
    values: { review_item_ref: 'rev-chk-one', expected_version: review.version } }, context)
  expect(accepted.status).toBe('completed')
  expect(accepted.summary).toMatch(/Canon decision/)
  const exported = await adapter.dispatch({ schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: 'text.export',
    descriptorRef: snapshot.actions.find(item => item.actionId === 'text.export')!.descriptorRef,
    expectedTargetRef: opened.artifact.ref, expectedTargetVersion: opened.artifact.version, context, idempotencyKey: 'export-one',
    values: { expected_revision: 'rev-fixed', format: 'markdown' } }, context)
  expect(exported.status).toBe('completed')
  expect(exported.summary).toMatch(/Source writeback was not performed/)
  expect(mutations.some(item => item.includes('/candidates/') && item.includes('/apply'))).toBe(false)
})

it('rejects Checkpoint, Review, Canon, and export from another session and does not retry unknown writes', async () => {
  const other = { ...context, sessionRef: 'session:other' }
  const checkpoint = { schema_version: 'auctra.text_working_copy.v1alpha1', snapshot_ref: 'chk-one', kind: 'checkpoint',
    working_copy_ref: 'twc-test', source_working_revision: 0, body_digest: digest(body), body_length: Buffer.byteLength(body),
    producer_kind: 'human_edit', created_at: '2026-09-08T00:00:00.000Z' }
  let writes = 0
  const fetcher = vi.fn<typeof fetch>(async (url, options) => {
    const href = String(url)
    if (href.includes('/checkpoints') && options?.method === 'POST') { writes += 1; throw Error('lost checkpoint') }
    if (href.includes('/checkpoints')) return Response.json(envelope({ checkpoints: [checkpoint] }))
    if (href.includes('/review/queue')) return Response.json(envelope({ Items: [] }))
    if (href.includes('/text-units/') && href.includes('/draft')) return Response.json(envelope({ unit_id: 'one', revision: 'rev-fixed' }))
    if (href.includes('/text-units')) return Response.json(envelope(units))
    if (options?.method === 'GET') return Response.json(envelope(copy))
    throw Error(`unexpected ${href}`)
  })
  const adapter = createAuctraWorkingCopyAdapter(new AuctraWorkingCopyClient(async () => connection(), fetcher), async () => ({ unitRef: copy.unit_ref, artifact: opened.artifact, canSave: true }))
  const snapshot = await adapter.snapshot(context)
  const checkpointDescriptor = snapshot.actions.find(item => item.actionId === 'working-copy.checkpoint.create')!
  const crossed = await adapter.dispatch({ schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: checkpointDescriptor.actionId,
    descriptorRef: checkpointDescriptor.descriptorRef, expectedTargetRef: opened.artifact.ref, expectedTargetVersion: opened.artifact.version,
    context: other, idempotencyKey: 'checkpoint-cross', values: {} }, context)
  expect(crossed.status).toBe('rejected')
  expect(writes).toBe(0)
  const unknown = await adapter.dispatch({ schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: checkpointDescriptor.actionId,
    descriptorRef: checkpointDescriptor.descriptorRef, expectedTargetRef: opened.artifact.ref, expectedTargetVersion: opened.artifact.version,
    context, idempotencyKey: 'checkpoint-unknown', values: {} }, context)
  expect(unknown.status).toBe('unknown')
  expect(writes).toBe(1)
  expect(fetcher.mock.calls.filter(([href, options]) => options?.method === 'POST' && String(href).includes('/checkpoints'))).toHaveLength(1)
  expect(fetcher.mock.calls.filter(([href]) => String(href).includes('/change-sets/'))).toEqual([])
})
