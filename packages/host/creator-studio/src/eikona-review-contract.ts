import { z } from 'zod'
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u)
export const eikonaReviewQuerySchema = z.object({ runId: id }).strict()
const candidate = z.object({ decisionState: z.enum(['pending', 'accepted', 'rejected', 'request_revision', 'stale']).optional(), candidateId: id, label: z.string().max(4096),
  artifactRef: z.string().regex(/^eikona:\/\/artifacts\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u).max(480).optional(),
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/u).optional(), decisionVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
}).strict().refine(item => (item.artifactRef === undefined) === (item.contentDigest === undefined))
  .refine(item => item.decisionState === undefined || (item.decisionVersion !== undefined
    && (item.decisionVersion === 0 ? item.decisionState === 'pending' : item.decisionState !== 'pending')))
export const eikonaReviewResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ready'), runId: id, projectId: id, observedAt: z.string().datetime({ offset: true }),
    ownerDecision: z.enum(['pending', 'accepted', 'rejected', 'request_revision', 'stale']),
    admissionState: z.enum(['unknown', 'pending', 'admitted', 'refused']), canDecide: z.boolean(), canSupersede: z.boolean(),
    candidates: z.array(candidate).max(200),
  }).strict(),
  z.object({ status: z.enum(['needs_contract', 'permission_denied', 'unavailable', 'unconfirmed', 'invalid_input']) }).strict(),
]).refine(value => value.status !== 'ready' || (new Set(value.candidates.map(item => item.candidateId)).size === value.candidates.length
  && value.candidates.every(item => item.artifactRef === undefined || item.artifactRef === `eikona://artifacts/${value.runId}/${item.candidateId}`)))
export type EikonaReviewResult = z.infer<typeof eikonaReviewResultSchema>
