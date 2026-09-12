import { expect, it } from 'vitest'
import { normalizeAuctraCandidatePage } from '../src/auctra-working-copy.ts'
const item = { schema_version: 'auctra.text_working_copy.v1alpha1', candidate_ref: 'cand-one', working_copy_ref: 'twc-one', form: 'document',
  base_revision: 0, base_digest: 'a'.repeat(64), result_digest: 'b'.repeat(64), result_length: 12, patch_edit_count: 0, producer_kind: 'agent_candidate', status: 'pending' }
const expected = { ownerProjectRef: '/fixture/project', workingCopyRef: 'twc-one', limit: 1 }
const envelope = (data: unknown) => ({ schema_version: 'auctra.api.envelope.v1', status: 'success', data })
it('preserves the opaque continuation and bounded metadata', () => {
  expect(normalizeAuctraCandidatePage(envelope({ candidates: [item], next_cursor: 'cursor-one' }), expected)).toMatchObject({ candidates: [{ ref: 'cand-one' }], nextCursor: 'cursor-one' })
  expect(normalizeAuctraCandidatePage(envelope({ candidates: [] }), expected)).toEqual({ candidates: [] })
})
it.each(['duplicate', 'scope', 'body', 'cursor', 'limit'])('rejects %s page', mode => {
  const items = mode === 'duplicate' || mode === 'limit' ? [item, { ...item, candidate_ref: mode === 'limit' ? 'cand-two' : item.candidate_ref }] : [{ ...item, ...(mode === 'scope' ? { working_copy_ref: 'twc-other' } : {}), ...(mode === 'body' ? { body: 'private' } : {}) }]
  expect(normalizeAuctraCandidatePage(envelope({ candidates: items, ...(mode === 'cursor' ? { next_cursor: 'file:///private' } : {}) }), { ...expected, limit: mode === 'duplicate' ? 2 : 1 })).toBeUndefined()
})
