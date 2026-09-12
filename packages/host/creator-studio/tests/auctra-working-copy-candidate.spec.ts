import { createHash } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { AuctraWorkingCopyClient, AUCTRA_WORKING_COPY_SCHEMA_DIGEST } from '../src/auctra-working-copy-client.ts'
import { normalizeAuctraCandidateAdopt, normalizeAuctraWorkingCopyCandidate, normalizeAuctraWorkingCopyOpen } from '../src/auctra-working-copy.ts'

const context = { tenantRef: 'tenant:test', workspaceRef: 'workspace:test', projectRef: 'project:test', sessionRef: 'session:test', principalRef: 'principal:test',
  membershipRevision: '1', installationRef: 'installation:test', pluginDigest: 'digest:test', policyRevision: '1', runtimeGeneration: '1', revision: '1' }
const body = '第一章正文。', digest = (value: string) => createHash('sha256').update(value).digest('hex')
const copy = { schema_version: 'auctra.text_working_copy.v1alpha1', working_copy_ref: 'twc-test', project_ref: '/fixture/project', unit_ref: 'text:one',
  format: 'plain_text', working_revision: 0, content_digest: digest(body), content_length: Buffer.byteLength(body), status: 'editing' }
const envelope = (data: unknown) => ({ schema_version: 'auctra.api.envelope.v1', status: 'success', data })
const base = normalizeAuctraWorkingCopyOpen(envelope({ working_copy: copy, body, compatibility_projection: false }), { ownerProjectRef: copy.project_ref, openRef: copy.unit_ref })!
const next = '改写后的第一章。'
const candidate = { schema_version: 'auctra.text_working_copy.v1alpha1', candidate_ref: 'cand-abc123def456', working_copy_ref: 'twc-test',
  form: 'document', base_revision: 0, base_digest: digest(body), result_digest: digest(next), result_length: Buffer.byteLength(next),
  patch_edit_count: 1, producer_kind: 'agent_candidate', status: 'pending' }
const connection = () => ({ context: { ...context }, baseURL: 'http://127.0.0.1:8742', ownerProjectRef: copy.project_ref, headers: {},
  admission: { consumer: 'dsh' as const, schemaDigest: AUCTRA_WORKING_COPY_SCHEMA_DIGEST, approved: true, writeApproved: true } })

it('does not send recoverable adoption without separate request-key admission', async () => {
  const fetcher = vi.fn<typeof fetch>()
  const client = new AuctraWorkingCopyClient(async () => connection(), fetcher)
  expect(await client.adoptCandidate(context, { unitRef: copy.unit_ref, base, candidateRef: candidate.candidate_ref, sourceVersion: base.contentRevision, requestKey: 'original-request' })).toEqual({ status: 'needs_contract' })
  expect(fetcher).not.toHaveBeenCalled()
})

it('passes the original request key and keeps post-submit admission loss unconfirmed', async () => {
  const mutable = { ...connection(), admission: { ...connection().admission, candidateRequestRecovery: 'v1alpha1' as const } }
  const revokedFetch = vi.fn<typeof fetch>(async () => { delete (mutable.admission as { candidateRequestRecovery?: string }).candidateRequestRecovery; return Response.json(envelope({})) })
  expect(await new AuctraWorkingCopyClient(async () => mutable, revokedFetch).adoptCandidate(context, {
    unitRef: copy.unit_ref, base, candidateRef: candidate.candidate_ref, sourceVersion: base.contentRevision, requestKey: 'original-request',
  })).toEqual({ status: 'unconfirmed' })
  expect(revokedFetch).toHaveBeenCalledOnce()
  expect(JSON.parse(String(revokedFetch.mock.calls[0]?.[1]?.body))).toEqual({ request_key: 'original-request' })
})

it('normalizes a body-free candidate and rejects insert leakage', () => {
  const ready = normalizeAuctraWorkingCopyCandidate(envelope(candidate), { ownerProjectRef: copy.project_ref, workingCopyRef: 'twc-test' })
  expect(ready).toMatchObject({ ref: 'cand-abc123def456', status: 'ready', sourceVersion: `0:${digest(body)}` })
  expect(JSON.stringify(ready)).not.toMatch(/改写|"edits"\s*:|body_path/)
  expect(normalizeAuctraWorkingCopyCandidate(envelope({ ...candidate, body: next }), { ownerProjectRef: copy.project_ref, workingCopyRef: 'twc-test' })).toBeUndefined()
})

it('creates a candidate without mutating the accepted version', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(envelope(candidate)))
  const result = await new AuctraWorkingCopyClient(async () => connection(), fetcher).createCandidate(context, { unitRef: copy.unit_ref, base, content: next })
  expect(result.status).toBe('ready')
  if (result.status === 'ready') expect(result.value.status).toBe('ready')
  expect(String(fetcher.mock.calls[0]?.[0])).toBe('http://127.0.0.1:8742/api/v1/projects/current/text-working-copies/twc-test/candidates?major=1')
  expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toMatchObject({ form: 'document', body: next, expected_base_revision: 0, expected_base_digest: digest(body) })
})

it('does not accept a candidate rebound to a newer base', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(envelope({ ...candidate, base_revision: 1 })))
  const result = await new AuctraWorkingCopyClient(async () => connection(), fetcher).createCandidate(context, { unitRef: copy.unit_ref, base, content: next })
  expect(result.status).toBe('unconfirmed')
  expect(fetcher).toHaveBeenCalledOnce()
})

it('adopts only the Working Copy and rejects a stale base without a second mutation', async () => {
  const receipt = { working_copy: { ...copy, working_revision: 1, content_digest: digest(next), content_length: Buffer.byteLength(next) },
    applied: true, replayed: false, no_op: false, journal_ref: 'twcj-twc-test-1', journal_sequence: 1, result_digest: digest(next), result_length: Buffer.byteLength(next) }
  const adopted = { receipt, candidate: { ...candidate, status: 'applied_to_working_copy' } }
  expect(normalizeAuctraCandidateAdopt(envelope(adopted), { ownerProjectRef: copy.project_ref, openRef: copy.unit_ref, workingCopyRef: 'twc-test', candidateRef: candidate.candidate_ref })?.receipt.outcome).toBe('applied')
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ schema_version: 'auctra.api.envelope.v1', status: 'failed', error: { code: 'candidate_stale' } }, { status: 409 }))
  const result = await new AuctraWorkingCopyClient(async () => connection(), fetcher).adoptCandidate(context, {
    unitRef: copy.unit_ref, base, candidateRef: candidate.candidate_ref, sourceVersion: base.contentRevision })
  expect(result).toEqual({ status: 'conflict' })
  expect(fetcher).toHaveBeenCalledOnce()
})

it('rejects screenplay candidate create before owner IO', async () => {
  const fetcher = vi.fn<typeof fetch>()
  expect((await new AuctraWorkingCopyClient(async () => connection(), fetcher).createCandidate(context, {
    unitRef: 'screenplay-draft:ep1', base, content: next })).status).toBe('invalid_input')
  expect(fetcher).not.toHaveBeenCalled()
})
