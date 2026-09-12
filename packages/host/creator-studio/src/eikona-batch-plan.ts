import { z } from 'zod'
const ref = z.string().min(1).max(512)
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const positive = z.number().int().positive()
const wire = z.object({ schema_version: z.literal('eikona.batch_plan_preview.v1'), project_ref: ref, request_batch_ref: ref, request_batch_digest: digest, plan_digest: digest, status: z.enum(['ready', 'blocked']), request_count: positive, estimated_calls: positive, max_parallel_requests: positive, max_provider_calls: positive, cost_estimate_known: z.boolean(), estimated_usd_upper: z.number().finite().nonnegative().optional(), execution_authorized: z.literal(false), blockers: z.array(z.object({ request_id: ref, code: ref }).strict()) }).strict().refine(value => value.cost_estimate_known === (value.estimated_usd_upper !== undefined) && (value.status === 'blocked') === (value.blockers.length > 0) && value.estimated_calls >= value.request_count)
/** Current planning facts; never an execution grant or local scheduling state. */
export function inspectEikonaBatchPlan(input: unknown, expected: { projectRef: string; batchRef: string; digest: string }) {
  const parsed = wire.safeParse(input)
  if (!parsed.success || parsed.data.project_ref !== expected.projectRef || parsed.data.request_batch_ref !== expected.batchRef || parsed.data.request_batch_digest !== expected.digest) return { status: 'unconfirmed' as const }
  const value = parsed.data
  return { status: 'ready' as const, ...expected, planDigest: value.plan_digest, planStatus: value.status, requestCount: value.request_count, estimatedCalls: value.estimated_calls, maxParallelRequests: value.max_parallel_requests, maxProviderCalls: value.max_provider_calls, costEstimateKnown: value.cost_estimate_known, ...(value.estimated_usd_upper !== undefined ? { estimatedUSDUpper: value.estimated_usd_upper } : {}), blockers: value.blockers.map(blocker => ({ requestId: blocker.request_id, code: blocker.code })), executionAuthorized: false as const }
}
export const eikonaBatchPlanResultSchema = z.union([
  z.object({ status: z.enum(['invalid_input', 'unavailable', 'needs_contract', 'permission_denied', 'unconfirmed']) }).strict(),
  z.object({ status: z.literal('ready'), projectRef: ref, batchRef: ref, digest, planDigest: digest, planStatus: z.enum(['ready', 'blocked']), requestCount: positive, estimatedCalls: positive, maxParallelRequests: positive, maxProviderCalls: positive, costEstimateKnown: z.boolean(), estimatedUSDUpper: z.number().finite().nonnegative().optional(), executionAuthorized: z.literal(false), blockers: z.array(z.object({ requestId: ref, code: ref }).strict()) }).strict().refine(value => value.costEstimateKnown === (value.estimatedUSDUpper !== undefined) && (value.planStatus === 'blocked') === (value.blockers.length > 0) && value.estimatedCalls >= value.requestCount),
])
export type EikonaBatchPlanResult = z.infer<typeof eikonaBatchPlanResultSchema>
