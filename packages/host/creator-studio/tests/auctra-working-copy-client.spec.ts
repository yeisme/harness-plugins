import { createHash } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { AuctraWorkingCopyClient, AUCTRA_WORKING_COPY_SCHEMA_DIGEST, AUCTRA_CANDIDATE_LIST_SCHEMA_DIGEST } from '../src/auctra-working-copy-client.ts'
import type { AuctraWorkingCopyConnection } from '../src/auctra-working-copy-client.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'
import { normalizeAuctraWorkingCopyOpen } from '../src/auctra-working-copy.ts'

const context: CreatorStudioContextV1 = { tenantRef: 'tenant:test', workspaceRef: 'workspace:test', projectRef: 'project:test', sessionRef: 'session:test', principalRef: 'principal:test',
  membershipRevision: '1', installationRef: 'installation:test', pluginDigest: 'digest:test', policyRevision: '1', runtimeGeneration: '1', revision: '1' }
const body = 'Auctra 正文😀\r\n'
const digest = createHash('sha256').update(body).digest('hex')
const response = { schema_version: 'auctra.api.envelope.v1', status: 'success', data: { body, compatibility_projection: false, working_copy: {
  schema_version: 'auctra.text_working_copy.v1alpha1', working_copy_ref: 'twc-test', project_ref: '/fixture/owner-project', unit_ref: 'text:note',
  format: 'plain_text', working_revision: 2, content_digest: digest, content_length: new TextEncoder().encode(body).byteLength, status: 'editing',
} } }
const binding: AuctraWorkingCopyConnection = { context, baseURL: 'http://127.0.0.1:12345', headers: { Authorization: 'Bearer fixture-access' }, ownerProjectRef: '/fixture/owner-project',
  admission: { consumer: 'dsh', schemaDigest: AUCTRA_WORKING_COPY_SCHEMA_DIGEST, approved: true } }

it.each(['patch_invalid', 'invalid_request', 'unknown', 'wrong-envelope', 'malformed'])('classifies candidate page failure %s without retry', async code => {
  const changed = { ...binding, admission: { ...binding.admission!, candidateListDigest: AUCTRA_CANDIDATE_LIST_SCHEMA_DIGEST } }
  const fetcher = vi.fn<typeof fetch>(async () => code === 'malformed' ? new Response('{', { status: 400 }) : Response.json({
    schema_version: code === 'wrong-envelope' ? 'other' : 'auctra.api.envelope.v1', status: 'failed', error: { code },
  }, { status: 400 }))
  const artifact = normalizeAuctraWorkingCopyOpen(response, { ownerProjectRef: binding.ownerProjectRef, openRef: 'text:note' })!.artifact
  expect(await new AuctraWorkingCopyClient(async () => changed, fetcher).listCandidates(context, { artifact, cursor: 'invalid', limit: 1 }))
    .toEqual({ status: ['patch_invalid', 'invalid_request'].includes(code) ? 'invalid_input' : 'unconfirmed' })
  expect(fetcher).toHaveBeenCalledOnce()
})

it('uses the explicit major-one owner open and releases only the verified body', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(response))
  const result = await new AuctraWorkingCopyClient(async () => binding, fetcher).open(context, 'text:note', `2:${digest}`)
  expect(result.status).toBe('ready')
  if (result.status === 'ready') {
    expect(result.value.content).toBe(body)
    expect(JSON.stringify(result.value.artifact)).not.toMatch(/fixture-access|owner-project|Auctra 正文/u)
  }
  expect(String(fetcher.mock.calls[0]?.[0])).toBe('http://127.0.0.1:12345/api/v1/projects/current/text-working-copies/open?major=1')
  expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', redirect: 'error', body: JSON.stringify({ unit_ref: 'text:note' }) })
  expect(fetcher).toHaveBeenCalledOnce()
})

it.each(['absent', 'unapproved', 'digest', 'legacy-consumer'])('does not request a body with %s admission', async kind => {
  const changed = structuredClone(binding)
  if (kind === 'absent') delete (changed as any).admission
  if (kind === 'unapproved') (changed.admission as any).approved = false
  if (kind === 'digest') (changed.admission as any).schemaDigest = 'other'
  if (kind === 'legacy-consumer') (changed.admission as any).consumer = 'workbench'
  const fetcher = vi.fn<typeof fetch>()
  expect(await new AuctraWorkingCopyClient(async () => changed, fetcher).open(context, 'text:note')).toEqual({ status: 'needs_contract' })
  expect(fetcher).not.toHaveBeenCalled()
})

it.each(['scope', 'admission'])('discards an in-flight read after %s changes', async kind => {
  const changed = structuredClone(binding)
  let resolve!: (response: Response) => void
  const fetcher = vi.fn<typeof fetch>(() => new Promise(done => { resolve = done }))
  const pending = new AuctraWorkingCopyClient(async () => changed, fetcher).open(context, 'text:note')
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
  if (kind === 'scope') (changed.context as any).membershipRevision = '2'
  else (changed.admission as any).approved = false
  resolve(Response.json(response))
  expect(await pending).toEqual({ status: kind === 'scope' ? 'permission_denied' : 'needs_contract' })
})

it.each(['project', 'principal', 'remote-origin', 'file-ref'])('rejects %s before owner IO', async kind => {
  const changed = structuredClone(binding)
  if (kind === 'project') (changed.context as any).projectRef = 'project:other'
  if (kind === 'principal') (changed.context as any).principalRef = 'principal:other'
  if (kind === 'remote-origin') (changed as any).baseURL = 'https://remote.invalid'
  const fetcher = vi.fn<typeof fetch>()
  expect((await new AuctraWorkingCopyClient(async () => changed, fetcher).open(context, kind === 'file-ref' ? '/fixture/file' : 'text:note')).status).not.toBe('ready')
  expect(fetcher).not.toHaveBeenCalled()
})

it.each(['lost', 'invalid-json', 'wrong-project', 'wrong-version'])('returns no body after %s without retrying open', async kind => {
  const fetcher = vi.fn<typeof fetch>(async () => {
    if (kind === 'lost') throw new Error('private-error-sentinel')
    if (kind === 'invalid-json') return new Response('{')
    if (kind === 'wrong-project') return Response.json({ ...response, data: { ...response.data, working_copy: { ...response.data.working_copy, project_ref: '/fixture/other' } } })
    return Response.json(response)
  })
  expect(await new AuctraWorkingCopyClient(async () => binding, fetcher).open(context, 'text:note', kind === 'wrong-version' ? 'old' : undefined)).toEqual({ status: 'unconfirmed' })
  expect(fetcher).toHaveBeenCalledOnce()
})

it.each([401, 403])('preserves owner permission denial %s without copying error details', async status => {
  const fetcher = vi.fn<typeof fetch>(async () => new Response('private-owner-error-sentinel', { status }))
  expect(await new AuctraWorkingCopyClient(async () => binding, fetcher).open(context, 'text:note')).toEqual({ status: 'permission_denied' })
  expect(fetcher).toHaveBeenCalledOnce()
})
