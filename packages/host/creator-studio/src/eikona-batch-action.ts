import { createHash } from 'node:crypto'
import { z } from 'zod'
import { PaneActionDescriptorSchema, PaneActionRequestSchema, PANE_ACTION_DESCRIPTOR_SCHEMA, type PaneActionReceiptV1 } from '@yeisme/dsh-pane-protocol'
import { eikonaBatchPlanResultSchema } from './eikona-batch-plan.ts'
import type { CreatorStudioContextV1 } from './types.ts'
import type { EikonaDiscoveryClient } from './eikona-discovery-client.ts'

export const EIKONA_BATCH_ACTION = 'eikona.batch.submit'
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const valuesSchema = z.object({ batch_digest: digest, plan_digest: digest, allow_unknown_cost: z.enum(['true', 'false']) }).strict()
const fields = ['tenantRef', 'workspaceRef', 'projectRef', 'sessionRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision'] as const
function descriptorRef(batchRef: string, values: z.infer<typeof valuesSchema>) {
  return `eikona:batch:${createHash('sha256').update(JSON.stringify([batchRef, valuesSchema.parse(values)])).digest('hex')}`
}

/** Project identity is supplied by the verified Host binding, not the Pane. */
export function createEikonaBatchDescriptor(input: unknown, context: CreatorStudioContextV1, ownerProjectRef: string, now = Date.now()) {
  const parsed = eikonaBatchPlanResultSchema.safeParse(input)
  if (!parsed.success || parsed.data.status !== 'ready' || parsed.data.planStatus !== 'ready' || parsed.data.projectRef !== ownerProjectRef || !context.projectRef || !Number.isFinite(now)) return undefined
  const plan = parsed.data
  const values = { batch_digest: plan.digest, plan_digest: plan.planDigest, allow_unknown_cost: plan.costEstimateKnown ? 'false' as const : 'true' as const }
  const labels = { batch_digest: '固定批次摘要', plan_digest: '固定计划摘要', allow_unknown_cost: '同意费用未知时执行' }
  const result = PaneActionDescriptorSchema.safeParse({
    schema: PANE_ACTION_DESCRIPTOR_SCHEMA, owner: 'eikona', actionId: EIKONA_BATCH_ACTION,
    descriptorRef: descriptorRef(plan.batchRef, values), targetRef: plan.batchRef, targetVersion: plan.planDigest,
    context: { ...context }, label: '执行图像批量计划', presentation: { task: 'image' }, risk: 'high', confirmation: 'confirm',
    expiresAt: new Date(now + 60_000).toISOString(),
    preview: { summary: `执行 ${plan.requestCount} 个成员，预计调用 ${plan.estimatedCalls} 次。${plan.costEstimateKnown ? `预计费用上限 USD ${plan.estimatedUSDUpper}。` : '费用未知；确认即同意在未知费用下执行。'}成功结果进入候选，采用与交付另行审阅。`,
      ...(plan.costEstimateKnown ? { cost: { currency: 'USD', amount: plan.estimatedUSDUpper, estimate: true } } : {}) },
    fields: Object.entries(values).map(([key, value]) => ({ key, label: labels[key as keyof typeof labels], kind: 'select', required: true, options: [{ value, label: key === 'allow_unknown_cost' ? value === 'true' ? '同意费用未知时执行' : '仅按已知费用计划执行' : value }] })),
  })
  return result.success ? { descriptor: result.data, values } : undefined
}

/** Current plan and admission must still be rechecked immediately before dispatch. */
export function parseEikonaBatchRequest(input: unknown, context: CreatorStudioContextV1) {
  const parsed = PaneActionRequestSchema.safeParse(input)
  if (!parsed.success) return undefined
  const request = parsed.data, values = valuesSchema.safeParse(request.values)
  if (!values.success || request.owner !== 'eikona' || request.actionId !== EIKONA_BATCH_ACTION || request.textBody !== undefined || fields.some(field => context[field] !== request.context[field]) || !/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/u.test(request.idempotencyKey)) return undefined
  if (request.expectedTargetVersion !== values.data.plan_digest || request.descriptorRef !== descriptorRef(request.expectedTargetRef, values.data)) return undefined
  return { request, input: { batchRef: request.expectedTargetRef, digest: values.data.batch_digest, planDigest: values.data.plan_digest, idempotencyKey: request.idempotencyKey, confirmed: true as const, allowUnknownCost: values.data.allow_unknown_cost === 'true' } }
}

export function eikonaBatchPaneReceipt(result: Awaited<ReturnType<EikonaDiscoveryClient['submitBatch']>>, phase: 'submit' | 'reconcile' = 'submit'): PaneActionReceiptV1 {
  const base = { owner: 'eikona', actionId: EIKONA_BATCH_ACTION }
  if (result.status !== 'observed') {
    const rejected = phase === 'submit' && ['invalid_input', 'permission_denied', 'needs_contract'].includes(result.status)
    return { ...base, receiptRef: 'eikona:batch:unconfirmed', status: rejected ? 'rejected' : phase === 'reconcile' ? 'reconcile_required' : 'unknown', summary: rejected ? 'Eikona batch was not admitted.' : 'Reconcile the original batch request before any further execution.', ...(!rejected ? { reconcileReason: 'original_batch_unconfirmed' } : {}) }
  }
  const observed = { ...base, receiptRef: result.operationRef, evidenceRefs: [result.operationRef] }
  if (result.operationStatus === 'succeeded') return { ...observed, status: 'completed', summary: 'Eikona confirmed batch execution. Review candidates before adoption or delivery.' }
  if (result.operationStatus === 'partial') return { ...observed, status: 'partial', summary: 'Eikona reported a partial batch. Retain completed candidates and inspect failed members.', reconcileReason: 'batch_partial' }
  if (result.operationStatus === 'failed' || result.operationStatus === 'cancelled') return { ...observed, status: 'failed', summary: `Eikona confirmed batch ${result.operationStatus}. Existing evidence is retained.` }
  return { ...observed, status: 'unknown', summary: `Eikona batch state: ${result.operationStatus}. Reconcile the original request.`, reconcileReason: 'batch_unsettled' }
}
