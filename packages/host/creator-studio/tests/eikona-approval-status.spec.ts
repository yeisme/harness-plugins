import { expect, it } from 'vitest'
import { inspectEikonaApprovalStatus } from '../src/eikona-approval-status.ts'
it('retains independent revocation, expiry and consumption facts without authority', () => {
  const input = { schema_version: 'eikona.generation_preparation_approval_status.v1', approval_ref: `ega_${'a'.repeat(64)}`, preparation_ref: `egp_${'b'.repeat(64)}`, preparation_digest: 'c'.repeat(64), project_id: 'project', revoked: true, expired: true, consumed_operation: `own_${'d'.repeat(24)}`, expires_at: '2026-09-09T00:00:00Z', observed_at: '2026-09-09T01:00:00Z', payload: 'PRIVATE_SENTINEL' }
  const scope = { approvalRef: input.approval_ref, projectId: 'project' }
  const result = inspectEikonaApprovalStatus(input, scope)
  expect(result).toMatchObject({ status: 'observed', revoked: true, expired: true, consumedOperation: input.consumed_operation })
  expect(JSON.stringify(result)).not.toContain('PRIVATE_SENTINEL')
  expect(inspectEikonaApprovalStatus(input, { ...scope, projectId: 'foreign' }).status).toBe('permission_denied')
  expect(inspectEikonaApprovalStatus({ ...input, expired: false }, scope).status).toBe('needs_contract')
  expect(inspectEikonaApprovalStatus({ ...input, consumed_operation: 'bad' }, scope).status).toBe('needs_contract')
})
