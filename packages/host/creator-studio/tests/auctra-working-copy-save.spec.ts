import { createHash } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { AuctraWorkingCopyClient, AUCTRA_WORKING_COPY_SCHEMA_DIGEST } from '../src/auctra-working-copy-client.ts'
import { normalizeAuctraWorkingCopyOpen } from '../src/auctra-working-copy.ts'
const context = { tenantRef: 'tenant:test', workspaceRef: 'workspace:test', projectRef: 'project:test', sessionRef: 'session:test', principalRef: 'principal:test',
  membershipRevision: '1', installationRef: 'installation:test', pluginDigest: 'digest:test', policyRevision: '1', runtimeGeneration: '1', revision: '1' }
const body = '正文😀\r\n', digest = (value: string) => createHash('sha256').update(value).digest('hex')
const copy = { schema_version: 'auctra.text_working_copy.v1alpha1', working_copy_ref: 'twc-test', project_ref: '/fixture/project', unit_ref: 'text:one',
  format: 'plain_text', working_revision: 0, content_digest: digest(body), content_length: Buffer.byteLength(body), status: 'editing' }
const envelope = (data: unknown) => ({ schema_version: 'auctra.api.envelope.v1', status: 'success', data })
const base = normalizeAuctraWorkingCopyOpen(envelope({ working_copy: copy, body, compatibility_projection: false }), { ownerProjectRef: copy.project_ref, openRef: copy.unit_ref })!
const input = { unitRef: copy.unit_ref, base, content: '修改😀\r\n', idempotencyKey: 'save-key' }
const connection = () => ({ context: { ...context }, baseURL: 'http://127.0.0.1:8740', ownerProjectRef: copy.project_ref, headers: {},
  admission: { consumer: 'dsh' as const, schemaDigest: AUCTRA_WORKING_COPY_SCHEMA_DIGEST, approved: true, writeApproved: true } })
const receipt = () => envelope({ working_copy: { ...copy, working_revision: 1, content_digest: digest(input.content), content_length: Buffer.byteLength(input.content) },
  applied: true, replayed: false, no_op: false, journal_ref: 'twcj-twc-test-1', journal_sequence: 1, result_digest: digest(input.content), result_length: Buffer.byteLength(input.content) })

it.each([409, 422])('recognizes only a typed owner conflict for HTTP %s', async status => {
  const code = status === 409 ? 'working_copy_conflict' : 'idempotency_conflict'
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ schema_version: 'auctra.api.envelope.v1', status: 'failed', error: { code } }, { status }))
  const client = new AuctraWorkingCopyClient(async () => connection(), fetcher)
  expect(await client.save(context, input)).toEqual({ status: 'conflict' })
  fetcher.mockImplementation(async () => Response.json({ error: { code } }, { status }))
  expect(await client.save(context, input)).toEqual({ status: 'unconfirmed' })
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('sends UTF-16 whole-body replacement with a fixed base and original key', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(receipt()))
  expect((await new AuctraWorkingCopyClient(async () => connection(), fetcher).save(context, input)).status).toBe('ready')
  const options = fetcher.mock.calls[0]![1]!
  expect(options.method).toBe('PUT')
  expect(JSON.parse(options.body as string)).toMatchObject({ base_revision: 0, base_digest: digest(body), idempotency_key: input.idempotencyKey,
    edits: [{ from_utf16: 0, to_utf16: body.length, insert: input.content }] })
  expect(fetcher).toHaveBeenCalledOnce()
})

it.each(['write-admission', 'project', 'base-digest', 'surrogate', 'screenplay', 'key', 'media-type'])('rejects %s before sending a write', async mode => {
  const binding = connection(), request = structuredClone(input)
  if (mode === 'write-admission') binding.admission.writeApproved = false
  if (mode === 'project') binding.ownerProjectRef = '/fixture/other'
  if (mode === 'base-digest') request.base.content += 'changed'
  if (mode === 'surrogate') request.content = '\uD800'
  if (mode === 'screenplay') request.unitRef = 'screenplay-draft:one'
  if (mode === 'key') request.idempotencyKey = 'invalid key'
  if (mode === 'media-type') request.base.artifact = { ...request.base.artifact, mediaType: 'text/html' }
  const fetcher = vi.fn<typeof fetch>()
  expect((await new AuctraWorkingCopyClient(async () => binding, fetcher).save(context, request)).status).not.toBe('ready')
  expect(fetcher).not.toHaveBeenCalled()
})

it.each(['lost-response', 'membership', 'write-admission'])('keeps %s after submission unconfirmed without retry', async mode => {
  const binding = connection()
  const fetcher = vi.fn<typeof fetch>(async () => {
    if (mode === 'lost-response') throw Error('lost response')
    if (mode === 'membership') binding.context.membershipRevision = '2'
    if (mode === 'write-admission') binding.admission.writeApproved = false
    return Response.json(receipt())
  })
  expect(await new AuctraWorkingCopyClient(async () => binding, fetcher).save(context, input)).toEqual({ status: 'unconfirmed' })
  expect(fetcher).toHaveBeenCalledOnce()
})
