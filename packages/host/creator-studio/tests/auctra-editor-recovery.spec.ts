import { createHash } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { AuctraWorkingCopyClient, AUCTRA_WORKING_COPY_SCHEMA_DIGEST, type AuctraWorkingCopyConnection } from '../src/auctra-working-copy-client.ts'
import { AUCTRA_EDITOR_RECOVERY_SCHEMA_DIGEST, auctraRecoveryClientRef } from '../src/auctra-editor-recovery.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'
const context: CreatorStudioContextV1 = { tenantRef: 'tenant:test', workspaceRef: 'workspace:test', projectRef: 'project:test', sessionRef: 'session:test', principalRef: 'principal:test', membershipRevision: '1', installationRef: 'installation:test', pluginDigest: 'digest:test', policyRevision: '1', runtimeGeneration: '1', revision: '1' }
const content = '未提交草稿😀\r\n'
const digest = createHash('sha256').update(content).digest('hex')
const row = { draft_ref: `erd-${'a'.repeat(32)}`, project_ref: '/fixture/owner', client_ref: auctraRecoveryClientRef(context), unit_ref: 'text:note', base_version: `0:${'b'.repeat(64)}`, revision: 2, content_digest: digest, content_length: new TextEncoder().encode(content).byteLength, created_at: '2026-09-08T00:00:00Z', updated_at: '2026-09-08T00:00:01Z' }
const envelope = (data: unknown) => ({ schema_version: 'auctra.api.envelope.v1', status: 'success', data })
const page = () => envelope({ schema_version: 'auctra.editor_recovery_draft_page.v1alpha1', drafts: [row] })
const explicit = () => envelope({ draft: { ...row, schema_version: 'auctra.editor_recovery_draft.v1alpha1', current_source_version: `1:${digest}`, source_changed: true }, body: content })
const binding = (): AuctraWorkingCopyConnection => ({ context: { ...context }, baseURL: 'http://127.0.0.1:12345', headers: {}, ownerProjectRef: row.project_ref, admission: { consumer: 'dsh', approved: true, schemaDigest: AUCTRA_WORKING_COPY_SCHEMA_DIGEST, editorRecoveryDigest: AUCTRA_EDITOR_RECOVERY_SCHEMA_DIGEST } })

it('discovers safe metadata and explicitly reads the pinned owner buffer', async () => {
 const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(page())).mockResolvedValueOnce(Response.json(explicit()))
 const client = new AuctraWorkingCopyClient(async () => binding(), fetcher)
 const result = await client.listRecoveryDrafts(context)
 expect(result.status).toBe('ready')
 if (result.status !== 'ready') return
 expect(JSON.stringify(result.value)).not.toContain(row.project_ref)
 expect(JSON.stringify(result.value)).not.toContain(content)
 const read = await client.readRecoveryDraft(context, result.value.drafts[0]!)
 expect(read.status).toBe('ready')
 if (read.status === 'ready') expect(read.value).toMatchObject({ content, sourceChanged: true })
 expect(fetcher).toHaveBeenCalledTimes(2)
 expect(fetcher.mock.calls.every(call => call[1]?.method === 'GET')).toBe(true)
})
it('requires independent admission before any owner IO', async () => {
 const owner = binding(); delete (owner.admission as { editorRecoveryDigest?: string }).editorRecoveryDigest
 const fetcher = vi.fn<typeof fetch>()
 expect(await new AuctraWorkingCopyClient(async () => owner, fetcher).listRecoveryDrafts(context)).toEqual({ status: 'needs_contract' })
 expect(fetcher).not.toHaveBeenCalled()
})
it('keeps the client partition across sessions but separates principals', () => {
 expect(auctraRecoveryClientRef({ ...context, sessionRef: 'session:next' })).toBe(auctraRecoveryClientRef(context))
 expect(auctraRecoveryClientRef({ ...context, principalRef: 'principal:other' })).not.toBe(auctraRecoveryClientRef(context))
})
it.each(['project', 'client', 'body', 'revision', 'digest', 'admission'])('rejects changed recovery %s without retry', async change => {
 const owner = binding()
 const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(page())).mockImplementationOnce(async () => {
  const data = explicit()
  if (change === 'project') data.data.draft.project_ref = '/fixture/other'
  if (change === 'client') data.data.draft.client_ref = 'other'
  if (change === 'body') data.data.body = 'corrupt'
  if (change === 'revision') data.data.draft.revision++
  if (change === 'digest') data.data.draft.content_digest = 'c'.repeat(64)
  if (change === 'admission') delete (owner.admission as { editorRecoveryDigest?: string }).editorRecoveryDigest
  return Response.json(data)
 })
 const client = new AuctraWorkingCopyClient(async () => owner, fetcher)
 const pageResult = await client.listRecoveryDrafts(context)
 if (pageResult.status !== 'ready') throw new Error('fixture page failed')
 expect((await client.readRecoveryDraft(context, pageResult.value.drafts[0]!)).status).toBe(change === 'admission' ? 'needs_contract' : 'unconfirmed')
 expect(fetcher).toHaveBeenCalledTimes(2)
})
