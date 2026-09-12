import { z } from 'zod'
const reviewId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u)
export const eikonaPreparationInputSchema = z.object({ prompt_id: reviewId, prompt_version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      references: z.array(z.object({ ref: z.string().regex(/^eikona:\/\/artifacts\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u), role: z.enum(['reference_image', 'mask']).optional() }).strict()).max(16).optional(),
      values: z.record(z.string().min(1).max(160), z.string().max(4096)).refine(value => Object.keys(value).length <= 64).optional(),
      controls: z.object({ model_ref: z.string().min(1).max(160).optional(), size: z.string().max(80).optional(),
        reference_mode: z.enum(['auto', 'edit', 'generate']).optional(), quality: z.string().max(80).optional(), aspect: z.string().max(80).optional(), seed: z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER).optional(),
        candidate_count: z.literal(1).optional() }).strict().optional(),
    }).strict()
const digest = z.string().regex(/^[a-f0-9]{64}$/u)
export const eikonaPreparationResultSchema = z.union([
 z.object({ status: z.enum(['invalid_input', 'unavailable', 'unconfirmed', 'permission_denied', 'needs_contract']) }).strict(),
 z.object({ status: z.literal('ready'), preparationRef: z.string().regex(/^egp_[a-f0-9]{64}$/u), projectId: reviewId,
 promptRef: z.string().regex(/^eikona:\/\/prompts\/[A-Za-z0-9._-]+\/versions\/[1-9][0-9]*$/u).max(300), promptDigest: digest, digest, summaryDigest: digest,
 modelRef: z.string().min(1).max(160), candidateCount: z.literal(1), costState: z.literal('unknown'), executionAuthorized: z.literal(false), createdAt: z.string().datetime({offset:true}),
 controls: eikonaPreparationInputSchema.shape.controls.unwrap().extend({ model_ref: z.string().min(1).max(160), candidate_count: z.literal(1), web_search:z.boolean().optional(), watermark:z.boolean().optional() }),
 }).strict().refine(value => value.controls.model_ref === value.modelRef),
])

export type EikonaPreparationInput = z.infer<typeof eikonaPreparationInputSchema>
export type EikonaPreparationResult = z.infer<typeof eikonaPreparationResultSchema>

/** Explicit model selection must survive preparation; omitted models remain owner defaults. */
export function matchesEikonaPreparationInput(input: EikonaPreparationInput, result: EikonaPreparationResult): boolean {
  if (result.status !== 'ready') return true
  return result.promptRef === `eikona://prompts/${input.prompt_id}/versions/${input.prompt_version}`
    && (input.controls?.model_ref === undefined || result.modelRef === input.controls.model_ref.trim())
}
