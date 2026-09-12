import { z } from 'zod'
const ref = z.string().min(1).max(512)
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const operationRef = z.string().max(128).regex(/^eikona-batch:[A-Za-z0-9][A-Za-z0-9._:-]{0,114}$/u).refine(value => !value.includes('..'))
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const status = z.enum(['pending', 'running', 'unknown', 'succeeded', 'failed', 'cancelled'])
const runRef = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u).refine(value => !value.includes('..'))
export const eikonaBatchMembersQuerySchema = z.object({ operationRef, offset: count.default(0), limit: z.number().int().min(1).max(100).default(50) }).strict()
const page = z.object({ status: z.literal('ready'), projectRef: ref, operationRef, batchRef: ref, digest, planDigest: digest, offset: count, total: count, nextOffset: count.optional(), items: z.array(z.object({ requestId: ref, status, runRef: runRef.optional() }).strict()).max(100) }).strict().refine(value => value.offset <= value.total && value.items.length <= value.total - value.offset && (value.offset + value.items.length < value.total) === (value.nextOffset !== undefined) && (value.nextOffset === undefined || (value.items.length > 0 && value.nextOffset === value.offset + value.items.length)) && new Set(value.items.map(item => item.requestId)).size === value.items.length)
export const eikonaBatchMembersResultSchema = z.union([z.object({ status: z.enum(['invalid_input', 'unavailable', 'needs_contract', 'permission_denied', 'unconfirmed']) }).strict(), page])
export type EikonaBatchMembersQuery = z.infer<typeof eikonaBatchMembersQuerySchema>
export type EikonaBatchMembersResult = z.infer<typeof eikonaBatchMembersResultSchema>
const wire = z.object({ schema_version: z.literal('eikona.batch_member_page.v1'), project_ref: ref, operation_ref: operationRef, request_batch_ref: ref, request_batch_digest: digest, plan_digest: digest, offset: count, total: count, next_offset: count.optional(), items: z.array(z.object({ request_id: ref, status, run_ref: runRef.optional() }).strict()).max(100) }).strict()
export function matchesEikonaBatchMembers(value: EikonaBatchMembersResult, query: EikonaBatchMembersQuery) {
  return value.status !== 'ready' || (value.operationRef === query.operationRef && value.offset === query.offset && value.items.length === Math.min(query.limit, value.total - query.offset))
}
export function inspectEikonaBatchMembers(input: unknown, expected: EikonaBatchMembersQuery & { projectRef: string }): EikonaBatchMembersResult {
  const parsed = wire.safeParse(input)
  if (!parsed.success || parsed.data.project_ref !== expected.projectRef) return { status: 'unconfirmed' }
  const v = parsed.data
  const result = page.safeParse({ status: 'ready', projectRef: v.project_ref, operationRef: v.operation_ref, batchRef: v.request_batch_ref, digest: v.request_batch_digest, planDigest: v.plan_digest, offset: v.offset, total: v.total, ...(v.next_offset === undefined ? {} : { nextOffset: v.next_offset }), items: v.items.map(item => ({ requestId: item.request_id, status: item.status, ...(item.run_ref ? { runRef: item.run_ref } : {}) })) })
  return result.success && matchesEikonaBatchMembers(result.data, expected) ? result.data : { status: 'unconfirmed' }
}
