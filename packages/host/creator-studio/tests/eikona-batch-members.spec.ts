import { expect, it } from 'vitest'
import { inspectEikonaBatchMembers } from '../src/eikona-batch-members.ts'
const expected = { projectRef: 'project:one', operationRef: 'eikona-batch:one', offset: 0, limit: 1 }
const page = { schema_version: 'eikona.batch_member_page.v1', project_ref: expected.projectRef, operation_ref: expected.operationRef, request_batch_ref: 'batch:one', request_batch_digest: `sha256:${'a'.repeat(64)}`, plan_digest: `sha256:${'b'.repeat(64)}`, offset: 0, total: 2, next_offset: 1, items: [{ request_id: 'one', status: 'succeeded', run_ref: 'run_one' }] }
it('projects an authorized member reference without implying adoption', () => {
  expect(inspectEikonaBatchMembers(page, expected)).toMatchObject({ status: 'ready', nextOffset: 1, items: [{ requestId: 'one', status: 'succeeded', runRef: 'run_one' }] })
  expect(inspectEikonaBatchMembers({ ...page, items: [{ request_id: 'one', status: 'unknown' }] }, expected)).toMatchObject({ status: 'ready', items: [{ requestId: 'one', status: 'unknown' }] })
})
it.each([
  { project_ref: 'project:other' }, { operation_ref: 'eikona-batch:other' }, { offset: 1 }, { next_offset: 0 },
  { next_offset: undefined }, { total: -1 }, { items: [] }, { private_payload: {} },
  { items: [{ request_id: 'one', status: 'adopted' }] }, { items: [{ request_id: 'one', status: 'succeeded', run_ref: '../other' }] },
  { items: [page.items[0], page.items[0]], next_offset: undefined },
])('rejects substituted or malformed member page %o', patch => {
  expect(inspectEikonaBatchMembers({ ...page, ...patch }, expected)).toEqual({ status: 'unconfirmed' })
})
