import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { normalizeAuctraWorkingCopyOpen } from '../src/auctra-working-copy.ts'

const body = '正文😀\r\n保留原格式。'
const digest = createHash('sha256').update(body).digest('hex')
function source() { return { schema_version: 'auctra.api.envelope.v1', status: 'success', data: { body, compatibility_projection: false,
  working_copy: { schema_version: 'auctra.text_working_copy.v1alpha1', working_copy_ref: 'twc-fixture', project_ref: '/fixture/private-project',
    unit_ref: 'text:note', format: 'markdown', working_revision: 3, content_digest: digest, content_length: new TextEncoder().encode(body).byteLength, status: 'editing' } } } }
const binding = { ownerProjectRef: '/fixture/private-project', openRef: 'text:note' }

it.each(['', '\ufeff正文😀\r\n'])('preserves valid empty or BOM-prefixed plain text', text => {
  const input = source()
  input.data.body = text
  Object.assign(input.data.working_copy, { format: 'plain_text', content_length: new TextEncoder().encode(text).byteLength,
    content_digest: createHash('sha256').update(text).digest('hex') })
  const result = normalizeAuctraWorkingCopyOpen(input, binding)
  expect(result?.content).toBe(text)
  expect(result?.artifact.mediaType).toBe('text/plain')
})

it.each(['text:note', 'chapter:chapter_001'])('normalizes %s with exact UTF-8 digest and no filesystem metadata', ref => {
  const input = source(); input.data.working_copy.unit_ref = ref
  const result = normalizeAuctraWorkingCopyOpen(input, { ...binding, openRef: ref })
  expect(result?.content).toBe(body)
  expect(result?.contentRevision).toBe(`3:${digest}`)
  expect(result?.artifact.mediaType).toBe('text/markdown')
  expect(JSON.stringify(result?.artifact)).not.toContain('/fixture/private-project')
  expect(JSON.stringify(result?.artifact)).not.toContain('正文')
})

it('fails the generic normalizer closed for screenplay refs; the dedicated draft normalizer owns them', () => {
  const input = source()
  Object.assign(input.data.working_copy, { working_copy_ref: 'screenplay-draft:draft_001', unit_ref: 'unit_001', format: 'fountain' })
  input.data.compatibility_projection = true
  expect(normalizeAuctraWorkingCopyOpen(input, { ...binding, openRef: 'screenplay-draft:draft_001' })).toBeUndefined()
})

it.each(['project', 'unit', 'digest', 'utf16-length', 'recovery', 'version', 'surrogate'])('rejects %s mismatch without returning a body', kind => {
  const input = source()
  if (kind === 'project') input.data.working_copy.project_ref = '/fixture/other-project'
  if (kind === 'unit') input.data.working_copy.unit_ref = 'text:other'
  if (kind === 'digest') input.data.working_copy.content_digest = 'f'.repeat(64)
  if (kind === 'utf16-length') input.data.working_copy.content_length = body.length
  if (kind === 'recovery') input.data.working_copy.status = 'recovery_required'
  if (kind === 'surrogate') {
    input.data.body = '\ud800'
    input.data.working_copy.content_length = 3
    input.data.working_copy.content_digest = createHash('sha256').update(input.data.body).digest('hex')
  }
  expect(normalizeAuctraWorkingCopyOpen(input, { ...binding, ...(kind === 'version' ? { version: 'older' } : {}) })).toBeUndefined()
})
