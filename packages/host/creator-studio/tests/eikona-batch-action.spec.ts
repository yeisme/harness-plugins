import { expect, it } from 'vitest'
import { PaneActionReceiptSchema } from '@yeisme/dsh-pane-protocol'
import { createEikonaBatchDescriptor, parseEikonaBatchRequest, eikonaBatchPaneReceipt } from '../src/eikona-batch-action.ts'
import { inspectEikonaBatchOperation } from '../src/eikona-batch-operation.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = { tenantRef: 'tenant', workspaceRef: 'workspace', projectRef: 'project:dsh', sessionRef: 'session', principalRef: 'principal', revision: '1', membershipRevision: '1', installationRef: 'installation', pluginDigest: 'digest', policyRevision: '1', runtimeGeneration: '1' }
const plan = { status: 'ready', projectRef: 'project:owner', batchRef: 'request-batch:fixture', digest: `sha256:${'a'.repeat(64)}`, planDigest: `sha256:${'b'.repeat(64)}`, planStatus: 'ready', requestCount: 2, estimatedCalls: 2, maxParallelRequests: 1, maxProviderCalls: 2, costEstimateKnown: false, executionAuthorized: false, blockers: [] }
it('shows unknown cost explicitly, fixes the plan and requires distinct consent in the shared confirmation', () => {
  const built = createEikonaBatchDescriptor(plan, context, plan.projectRef, 0)!
  expect(built.descriptor).toMatchObject({ confirmation: 'confirm', risk: 'high', targetRef: plan.batchRef, targetVersion: plan.planDigest })
  expect(built.descriptor.preview.summary).toContain('费用未知')
  expect(built.descriptor.preview.cost).toBeUndefined()
  expect(built.values.allow_unknown_cost).toBe('true')
  expect(Date.parse(built.descriptor.expiresAt)).toBe(60_000)
  const request = { schema: 'pane.action-request.v1alpha1', owner: 'eikona', actionId: built.descriptor.actionId, descriptorRef: built.descriptor.descriptorRef, expectedTargetRef: plan.batchRef, expectedTargetVersion: plan.planDigest, context, idempotencyKey: 'batch-original-key', values: built.values }
  expect(parseEikonaBatchRequest(request, context)?.input).toMatchObject({ batchRef: plan.batchRef, digest: plan.digest, planDigest: plan.planDigest, allowUnknownCost: true, confirmed: true })
  for (const patch of [
    { expectedTargetRef: 'request-batch:other' }, { expectedTargetVersion: `sha256:${'c'.repeat(64)}` },
    { values: { ...built.values, allow_unknown_cost: 'false' } }, { values: { ...built.values, prompt: 'unexpected' } },
    { context: { ...context, sessionRef: 'other' } }, { idempotencyKey: 'short' },
    { textBody: { field: 'prompt', content: 'unexpected' } },
  ]) expect(parseEikonaBatchRequest({ ...request, ...patch }, context)).toBeUndefined()
})
it('does not expose blocked or foreign plans and separates zero known cost from unknown', () => {
  expect(createEikonaBatchDescriptor({ ...plan, planStatus: 'blocked', blockers: [{ requestId: 'one', code: 'missing' }] }, context, plan.projectRef)).toBeUndefined()
  expect(createEikonaBatchDescriptor(plan, context, 'project:foreign')).toBeUndefined()
  const known = createEikonaBatchDescriptor({ ...plan, costEstimateKnown: true, estimatedUSDUpper: 0 }, context, plan.projectRef)!
  expect(known.descriptor.preview.cost).toEqual({ currency: 'USD', amount: 0, estimate: true })
  expect(known.values.allow_unknown_cost).toBe('false')
  expect(known.descriptor.descriptorRef).not.toBe(createEikonaBatchDescriptor(plan, context, plan.projectRef)!.descriptor.descriptorRef)
})
it.each([
  ['succeeded', true, 'completed'], ['partial', true, 'partial'], ['failed', true, 'failed'],
  ['cancelled', true, 'failed'], ['running', false, 'unknown'], ['queued', false, 'unknown'],
] as const)('projects owner %s without adopting candidates', (status, terminal, expectedStatus) => {
  const result = inspectEikonaBatchOperation({ schema_version: 'eikona.batch_operation_preview.v1', project_ref: plan.projectRef, request_batch_ref: plan.batchRef, request_batch_digest: plan.digest, plan_digest: plan.planDigest, operation_ref: 'eikona-batch:operation', status, terminal, attempt_count: 1, successful_count: status === 'succeeded' ? 2 : 0, failed_count: 0, cancelled_count: 0 }, plan)
  const receipt = eikonaBatchPaneReceipt(result)
  expect(PaneActionReceiptSchema.safeParse(receipt).success).toBe(true)
  expect(receipt.status).toBe(expectedStatus)
  expect(receipt.evidenceRefs).toEqual(['eikona-batch:operation'])
})
it('keeps an unknown operation recoverable when its later read is denied', () => {
  expect(eikonaBatchPaneReceipt({ status: 'permission_denied' })).toMatchObject({ status: 'rejected' })
  expect(eikonaBatchPaneReceipt({ status: 'permission_denied' }, 'reconcile')).toMatchObject({ status: 'reconcile_required' })
  expect(eikonaBatchPaneReceipt({ status: 'unconfirmed' })).toMatchObject({ status: 'unknown' })
})
