import { expect, it } from 'vitest'
import { normalizeAuctraWorkingCopyReceipt } from '../src/auctra-working-copy.ts'

const expected = { ownerProjectRef: '/fixture/project', openRef: 'text:note' }
const copy = { schema_version: 'auctra.text_working_copy.v1alpha1', project_ref: expected.ownerProjectRef, unit_ref: expected.openRef,
  working_copy_ref: 'twc-one', format: 'plain_text', working_revision: 1, content_digest: 'a'.repeat(64), content_length: 12, status: 'editing' }
const receipt = { working_copy: copy, applied: true, replayed: false, no_op: false, journal_ref: 'twcj-twc-one-1', journal_sequence: 1,
  result_digest: copy.content_digest, result_length: 12 }
const envelope = (data: unknown) => ({ schema_version: 'auctra.api.envelope.v1', status: 'success', data })

it('returns only immutable version evidence and strips private owner fields', () => {
  const result = normalizeAuctraWorkingCopyReceipt(envelope({ ...receipt, body: 'private-body' }), expected)
  expect(result).toMatchObject({ contentRevision: `1:${copy.content_digest}`, outcome: 'applied', byteLength: 12, receiptRef: receipt.journal_ref })
  expect(JSON.stringify(result)).not.toMatch(/fixture|private-body|project_ref/)
})

it('keeps original receipt separate from a newer reconciled head', () => {
  const result = normalizeAuctraWorkingCopyReceipt(envelope({ integrity_verified: true,
    working_copy: { ...copy, working_revision: 2, content_digest: 'b'.repeat(64), content_length: 50 },
    last_receipt: { ...receipt, applied: false, replayed: true } }), expected, true)
  expect(result?.artifact.version).toBe(`1:${copy.content_digest}`)
  expect(result?.outcome).toBe('replayed')
})

it.each(['mixed-version', 'length', 'project', 'journal', 'flags'])('rejects %s receipt evidence', mode => {
  const changed = structuredClone(receipt)
  if (mode === 'mixed-version') changed.working_copy.working_revision = 2
  if (mode === 'length') changed.result_length = 50
  if (mode === 'project') changed.working_copy.project_ref = '/fixture/other'
  if (mode === 'journal') changed.journal_ref = 'twcj-another-1'
  if (mode === 'flags') changed.replayed = true
  expect(normalizeAuctraWorkingCopyReceipt(envelope(changed), expected)).toBeUndefined()
})

it.each(['absent', 'unverified', 'cross-copy'])('keeps %s reconciliation unconfirmed', mode => {
  const value = { integrity_verified: mode !== 'unverified', working_copy: { ...copy, working_copy_ref: mode === 'cross-copy' ? 'twc-other' : copy.working_copy_ref },
    ...(mode === 'absent' ? {} : { last_receipt: { ...receipt, applied: false, replayed: true } }) }
  expect(normalizeAuctraWorkingCopyReceipt(envelope(value), expected, true)).toBeUndefined()
})
