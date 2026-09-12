import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { normalizeAuctraCandidateContent } from '../src/auctra-working-copy.ts'
const body = '候选😀\r\n', digest = createHash('sha256').update(body).digest('hex')
const expected = { ownerProjectRef: '/fixture/project', workingCopyRef: 'twc-one', candidateRef: 'cand-one', version: `0:${digest}` }
const candidate = { schema_version: 'auctra.text_working_copy.v1alpha1', candidate_ref: 'cand-one', working_copy_ref: 'twc-one', form: 'document',
  base_revision: 0, base_digest: 'b'.repeat(64), result_digest: digest, result_length: Buffer.byteLength(body), patch_edit_count: 0, producer_kind: 'agent_candidate', status: 'pending' }
const envelope = () => ({ schema_version: 'auctra.api.envelope.v1', status: 'success', data: { candidate: { ...candidate }, body } })
it('returns exact candidate text without leaking the private project binding', () => {
  const result = normalizeAuctraCandidateContent(envelope(), expected)
  expect(result?.content).toBe(body)
  expect(result?.contentRevision).toBe(expected.version)
  expect(JSON.stringify(result?.artifact)).not.toMatch(/fixture|project_ref|候选/)
  expect(normalizeAuctraCandidateContent(envelope(), { ...expected, ownerProjectRef: '/fixture/other' })?.artifact.ref).not.toBe(result?.artifact.ref)
})
it.each(['candidate', 'working-copy', 'length', 'digest', 'body', 'version'])('rejects mismatched %s', kind => {
  const value = envelope()
  if (kind === 'candidate') value.data.candidate.candidate_ref = 'cand-other'
  if (kind === 'working-copy') value.data.candidate.working_copy_ref = 'twc-other'
  if (kind === 'length') value.data.candidate.result_length = body.length
  if (kind === 'digest') value.data.candidate.result_digest = 'a'.repeat(64)
  if (kind === 'body') value.data.body += 'changed'
  if (kind === 'version') value.data.candidate.base_revision = 1
  expect(normalizeAuctraCandidateContent(value, expected)).toBeUndefined()
})
