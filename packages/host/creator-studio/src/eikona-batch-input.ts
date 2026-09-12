import { z } from 'zod'
export const eikonaBatchInputQuerySchema = z.object({
  batchRef: z.string().min(1).max(512), digest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
}).strict()
const preview = z.object({ schema_version: z.literal('eikona.batch_input_preview.v1'), project_ref: z.string().min(1).max(512), request_batch_ref: z.string().min(1).max(512), request_batch_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/u), request_count: z.number().int().positive(), candidate_count: z.number().int().positive(), execution_authorized: z.literal(false) }).strict()
/** Fixed input metadata only; no cost estimate or execution admission. */
export function inspectEikonaBatchInput(input: unknown, expected: { projectRef: string; batchRef: string; digest: string }) {
  const parsed = preview.safeParse(input)
  if (!parsed.success || parsed.data.project_ref !== expected.projectRef || parsed.data.request_batch_ref !== expected.batchRef || parsed.data.request_batch_digest !== expected.digest || parsed.data.candidate_count < parsed.data.request_count) return { status: 'unconfirmed' as const }
  return { status: 'ready' as const, projectRef: expected.projectRef, batchRef: expected.batchRef, digest: expected.digest, requestCount: parsed.data.request_count, candidateCount: parsed.data.candidate_count, executionAuthorized: false as const }
}

export const eikonaBatchInputResultSchema = z.union([
  z.object({ status: z.enum(['invalid_input', 'unavailable', 'needs_contract', 'permission_denied', 'unconfirmed']) }).strict(),
  z.object({ status: z.literal('ready'), projectRef: z.string().min(1).max(512), batchRef: eikonaBatchInputQuerySchema.shape.batchRef, digest: eikonaBatchInputQuerySchema.shape.digest, requestCount: z.number().int().positive(), candidateCount: z.number().int().positive(), executionAuthorized: z.literal(false) }).strict().refine(value => value.candidateCount >= value.requestCount),
])
export type EikonaBatchInputQuery = z.infer<typeof eikonaBatchInputQuerySchema>
export type EikonaBatchInputResult = z.infer<typeof eikonaBatchInputResultSchema>

const batchCursor = z.string().regex(/^[a-f0-9]{64}-[a-f0-9]{64}-[a-f0-9]{64}\.json$/u)
export const eikonaBatchPageQuerySchema = z.object({ cursor: batchCursor.optional(), limit: z.number().int().min(1).max(100).default(50) }).strict()
const batchSummary = preview.omit({ schema_version: true, execution_authorized: true })
const batchPage = z.object({ schema_version: z.literal('eikona.batch_input_page.v1'), project_ref: preview.shape.project_ref, items: z.array(batchSummary).max(100), next_cursor: batchCursor.optional() }).strict()
export function inspectEikonaBatchPage(input: unknown, expected: { projectRef: string; limit: number; cursor?: string }) {
  const parsed = batchPage.safeParse(input)
  if (!parsed.success || parsed.data.project_ref !== expected.projectRef || parsed.data.items.length > expected.limit || (parsed.data.next_cursor !== undefined && parsed.data.next_cursor === expected.cursor)) return { status: 'unconfirmed' as const }
  const page = parsed.data, identities = new Set<string>()
  for (const item of page.items) {
    const identity = JSON.stringify([item.request_batch_ref, item.request_batch_digest])
    if (item.project_ref !== expected.projectRef || item.candidate_count < item.request_count || identities.has(identity)) return { status: 'unconfirmed' as const }
    identities.add(identity)
  }
  return { status: 'ready' as const, projectRef: expected.projectRef, items: page.items.map(item => ({ batchRef: item.request_batch_ref, digest: item.request_batch_digest, requestCount: item.request_count, candidateCount: item.candidate_count })), ...(page.next_cursor ? { nextCursor: page.next_cursor } : {}) }
}

export const eikonaBatchPageResultSchema = z.union([
  z.object({ status: z.enum(['invalid_input', 'unavailable', 'needs_contract', 'permission_denied', 'unconfirmed']) }).strict(),
  z.object({ status: z.literal('ready'), projectRef: z.string().min(1).max(512), items: z.array(z.object({ batchRef: eikonaBatchInputQuerySchema.shape.batchRef, digest: eikonaBatchInputQuerySchema.shape.digest, requestCount: z.number().int().positive(), candidateCount: z.number().int().positive() }).strict().refine(item => item.candidateCount >= item.requestCount)).max(100), nextCursor: batchCursor.optional() }).strict().refine(page => new Set(page.items.map(item => JSON.stringify([item.batchRef, item.digest]))).size === page.items.length),
])
export type EikonaBatchPageQuery = z.infer<typeof eikonaBatchPageQuerySchema>
export type EikonaBatchPageResult = z.infer<typeof eikonaBatchPageResultSchema>
