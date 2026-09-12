import { z } from 'zod'

const digest = z.string().regex(/^[a-f0-9]{64}$/u)
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u)
const preparation = z.object({
  schema_version: z.literal('eikona.generation_preparation.v1'),
  ref: z.string().regex(/^egp_[a-f0-9]{64}$/u), project_id: identifier,
  prompt_ref: z.string().regex(/^eikona:\/\/prompts\/[A-Za-z0-9._-]+\/versions\/[1-9][0-9]*$/u).max(300),
  prompt_digest: digest, digest,
  controls: z.object({ model_ref: z.string().min(1).max(160), candidate_count: z.literal(1),
    reference_mode: z.enum(['auto', 'edit', 'generate']).optional(), size: z.string().max(80).optional(), quality: z.string().max(80).optional(), aspect: z.string().max(80).optional(),
    seed: z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER).optional(),
    web_search: z.boolean().optional(), watermark: z.boolean().optional(), }),
  summary: z.object({ digest, model_ref: z.string().min(1).max(160), kind: z.enum(['image.generate', 'image.edit']) }),
  cost_state: z.literal('unknown'), execution_authorized: z.literal(false),
  created_at: z.string().datetime({ offset: true }),
})

/** Only fixed, body-free owner facts may leave the Host preparation reader. */
export function inspectEikonaPreparation(input: unknown, scope: { preparationRef: string; ownerProjectRef: string }) {
  const parsed = preparation.safeParse(input)
  if (!parsed.success) return { status: 'needs_contract' as const }
  const value = parsed.data
  if (value.project_id !== scope.ownerProjectRef || value.ref !== scope.preparationRef) return { status: 'permission_denied' as const }
  if (value.controls.model_ref !== value.summary.model_ref) return { status: 'needs_contract' as const }
  return { status: 'ready' as const, preparationRef: value.ref, projectId: value.project_id,
    promptRef: value.prompt_ref, promptDigest: value.prompt_digest, digest: value.digest,
    summaryDigest: value.summary.digest, modelRef: value.controls.model_ref,
    controls: value.controls,
    candidateCount: 1 as const, costState: 'unknown' as const, executionAuthorized: false as const, createdAt: value.created_at }
}
