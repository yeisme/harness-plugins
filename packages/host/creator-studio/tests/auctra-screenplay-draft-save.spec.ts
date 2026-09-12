import { createHash } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { AuctraWorkingCopyClient, AUCTRA_WORKING_COPY_SCHEMA_DIGEST } from '../src/auctra-working-copy-client.ts'
import { normalizeAuctraScreenplayDraftOpen, normalizeAuctraScreenplayDraftSave } from '../src/auctra-working-copy.ts'
const context = { tenantRef: 'tenant:test', workspaceRef: 'workspace:test', projectRef: 'project:test', sessionRef: 'session:test', principalRef: 'principal:test',
  membershipRevision: '1', installationRef: 'installation:test', pluginDigest: 'digest:test', policyRevision: '1', runtimeGeneration: '1', revision: '1' }
const draftBody = 'INT. 房间 - 夜\r\n\r\n第一场对白。\r\n'
// Screenplay digests are prefixed and computed over CRLF-normalized text.
const screenplayDigest = (value: string) => `sha256:${createHash('sha256').update(value.replaceAll('\r\n', '\n')).digest('hex')}`
const openRef = 'screenplay-draft:ep1'
const copy = { schema_version: 'auctra.text_working_copy.v1alpha1', working_copy_ref: openRef, project_ref: '/fixture/project', unit_ref: 'screenplay_ep1',
  format: 'markdown', base_canonical_revision: 'initial', working_revision: 1, content_digest: screenplayDigest(draftBody),
  content_length: new TextEncoder().encode(draftBody).byteLength, status: 'editing' }
const envelope = (data: unknown) => ({ schema_version: 'auctra.api.envelope.v1', status: 'success', data })
const openEnvelope = () => envelope({ working_copy: copy, body: draftBody, compatibility_projection: true })
const opened = normalizeAuctraScreenplayDraftOpen(openEnvelope(), { ownerProjectRef: copy.project_ref, openRef })!
const nextContent = 'INT. 房间 - 日\r\n\r\n改写后的对白。\r\n'
const saveDocument = (replayed: boolean) => ({ schema_version: 'auctra.text_document.v1', unit_ref: openRef, kind: 'screenplay_scene', title: 'ep1',
  status: 'editing', body: nextContent, revision: `draft:2:initial:${screenplayDigest(nextContent)}`, version: 2,
  ...(replayed ? { replayed: true } : {}) })
const connection = () => ({ context: { ...context }, baseURL: 'http://127.0.0.1:8741', ownerProjectRef: copy.project_ref, headers: {},
  admission: { consumer: 'dsh' as const, schemaDigest: AUCTRA_WORKING_COPY_SCHEMA_DIGEST, approved: true, writeApproved: true } })
const input = { draftRef: 'ep1', base: opened.content, content: nextContent, idempotencyKey: 'draft-save-key' }

it('normalizes the compatibility draft open with prefixed CRLF-normalized digest', () => {
  expect(opened.workingRevision).toBe(1)
  expect(opened.baseCanonicalRevision).toBe('initial')
  expect(opened.content.content).toBe(draftBody)
  expect(opened.content.contentRevision).toBe(`1:${screenplayDigest(draftBody)}`)
  const projectKey = createHash('sha256').update(copy.project_ref).digest('hex').slice(0, 32)
  expect(opened.content.artifact.ref).toBe(`auctra:working-copy:${projectKey}:${openRef}`)
})

it('saves through the text-units draft route with a rebuilt expected revision', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(openEnvelope()))
  fetcher.mockImplementationOnce(async () => Response.json(openEnvelope()))
  fetcher.mockImplementationOnce(async () => Response.json(envelope(saveDocument(false))))
  const result = await new AuctraWorkingCopyClient(async () => connection(), fetcher).saveScreenplayDraft(context, input)
  expect(result.status).toBe('ready')
  if (result.status !== 'ready') return
  expect(result.value.outcome).toBe('applied')
  expect(result.value.contentRevision).toBe(`2:${screenplayDigest(nextContent)}`)
  expect(result.value.receiptRef).toBeUndefined()
  const saveCall = fetcher.mock.calls[1]!
  expect(String(saveCall[0])).toBe('http://127.0.0.1:8741/api/v1/projects/current/text-units/screenplay-draft%3Aep1/draft?major=1')
  expect(JSON.parse(saveCall[1]!.body as string)).toEqual({ body: nextContent,
    expected_revision: `draft:1:initial:${screenplayDigest(draftBody)}`, idempotency_key: 'draft-save-key' })
})

it('recognizes a same-key replay without a second mutation', async () => {
  const fetcher = vi.fn<typeof fetch>()
  fetcher.mockImplementationOnce(async () => Response.json(openEnvelope()))
  fetcher.mockImplementationOnce(async () => Response.json(envelope(saveDocument(true))))
  const result = await new AuctraWorkingCopyClient(async () => connection(), fetcher).saveScreenplayDraft(context, input)
  expect(result.status).toBe('ready')
  if (result.status === 'ready') expect(result.value.outcome).toBe('replayed')
})

it.each([409, 500])('maps only the typed draft conflict for HTTP %s', async status => {
  const body = status === 409
    ? { schema_version: 'auctra.api.envelope.v1', status: 'failed', error: { code: 'draft_version_conflict' } }
    : { schema_version: 'auctra.api.envelope.v1', status: 'failed', error: { code: 'other' } }
  const fetcher = vi.fn<typeof fetch>()
  fetcher.mockImplementationOnce(async () => Response.json(openEnvelope()))
  fetcher.mockImplementationOnce(async () => Response.json(body, { status }))
  expect((await new AuctraWorkingCopyClient(async () => connection(), fetcher).saveScreenplayDraft(context, input)).status)
    .toBe(status === 409 ? 'conflict' : 'unconfirmed')
})

it('sends the caller fixed base and maps the typed stale conflict', async () => {
  const advanced = structuredClone(openEnvelope())
  advanced.data.working_copy.working_revision = 5
  advanced.data.working_copy.content_digest = screenplayDigest(draftBody + 'later')
  advanced.data.body = draftBody + 'later'
  advanced.data.working_copy.content_length = new TextEncoder().encode(advanced.data.body).byteLength
  const fetcher = vi.fn<typeof fetch>()
  fetcher.mockImplementationOnce(async () => Response.json(advanced))
  fetcher.mockImplementationOnce(async () => Response.json({ schema_version: 'auctra.api.envelope.v1', status: 'failed',
    error: { code: 'draft_version_conflict' } }, { status: 409 }))
  // A genuinely stale base rides the owner's typed conflict; the request still
  // carries the caller's original expected revision so replays stay possible.
  expect(await new AuctraWorkingCopyClient(async () => connection(), fetcher).saveScreenplayDraft(context, input)).toEqual({ status: 'conflict' })
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(JSON.parse(fetcher.mock.calls[1]![1]!.body as string).expected_revision).toBe(`draft:1:initial:${screenplayDigest(draftBody)}`)
})

it.each(['write-admission', 'ref', 'key', 'surrogate', 'colon-ref'])('rejects %s before sending a write', async mode => {
  const binding = connection(), request = structuredClone(input)
  if (mode === 'write-admission') binding.admission.writeApproved = false
  if (mode === 'ref') request.base = { ...request.base, artifact: { ...request.base.artifact, ref: 'auctra:working-copy:forged' } }
  if (mode === 'key') request.idempotencyKey = 'invalid key'
  if (mode === 'surrogate') request.content = '\uD800'
  if (mode === 'colon-ref') request.draftRef = 'ep:1'
  const fetcher = vi.fn<typeof fetch>()
  expect((await new AuctraWorkingCopyClient(async () => binding, fetcher).saveScreenplayDraft(context, request)).status).not.toBe('ready')
  expect(fetcher).not.toHaveBeenCalled()
})

it('keeps a lost write response unconfirmed without retry', async () => {
  const fetcher = vi.fn<typeof fetch>()
  fetcher.mockImplementationOnce(async () => Response.json(openEnvelope()))
  fetcher.mockImplementationOnce(async () => { throw Error('lost response') })
  expect(await new AuctraWorkingCopyClient(async () => connection(), fetcher).saveScreenplayDraft(context, input)).toEqual({ status: 'unconfirmed' })
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('normalizer rejects mixed-version or cross-project draft save evidence', () => {
  const expected = { ownerProjectRef: copy.project_ref, openRef, baseRevision: 1, baseCanonicalRevision: 'initial', content: nextContent, mediaType: 'text/markdown' }
  expect(normalizeAuctraScreenplayDraftSave(envelope(saveDocument(false)), expected)?.outcome).toBe('applied')
  const bumped = saveDocument(false); bumped.version = 3; bumped.revision = `draft:3:initial:${screenplayDigest(nextContent)}`
  expect(normalizeAuctraScreenplayDraftSave(envelope(bumped), expected)).toBeUndefined()
  const foreign = saveDocument(false); foreign.unit_ref = 'screenplay-draft:other'
  expect(normalizeAuctraScreenplayDraftSave(envelope(foreign), expected)).toBeUndefined()
  const wrongBody = saveDocument(false); wrongBody.body = 'tampered'
  expect(normalizeAuctraScreenplayDraftSave(envelope(wrongBody), expected)).toBeUndefined()
})
