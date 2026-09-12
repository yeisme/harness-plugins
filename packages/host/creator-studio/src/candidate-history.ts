import { z } from 'zod'
import { ArtifactRefSchema } from '@yeisme/dsh-pane-protocol'
import { artifactCandidateSchema } from './validation.ts'

const cursor = z.string().regex(/^[A-Za-z0-9_-]{1,1024}$/u)
export const creatorCandidateQuerySchema = z.object({
  schemaVersion: z.literal('creator.candidate-query.v1alpha1'),
  artifact: ArtifactRefSchema,
  cursor: cursor.optional(),
  limit: z.number().int().min(1).max(100),
}).strict()
export const creatorCandidatePageSchema = z.discriminatedUnion('status', [
  z.object({ schemaVersion: z.literal('creator.candidate-page.v1alpha1'), status: z.literal('ready'), artifact: ArtifactRefSchema,
    candidates: z.array(artifactCandidateSchema).max(100), nextCursor: cursor.optional(),
  }).strict().superRefine((page, ctx) => {
    if (new Set(page.candidates.map(item => item.ref)).size !== page.candidates.length) ctx.addIssue({ code: 'custom', message: 'Duplicate candidate reference' })
    for (const item of page.candidates) {
      if (item.artifact && (item.artifact.owner !== page.artifact.owner || item.artifact.version !== item.version)) ctx.addIssue({ code: 'custom', message: 'Candidate artifact mismatch' })
      if (item.textPreview !== undefined) ctx.addIssue({ code: 'custom', message: 'Candidate history is metadata only' })
    }
  }),
  z.object({ schemaVersion: z.literal('creator.candidate-page.v1alpha1'), status: z.enum(['unavailable', 'needs_contract', 'permission_denied', 'invalid_input', 'unconfirmed', 'conflict']) }).strict(),
])
export type CreatorCandidateQueryV1 = z.infer<typeof creatorCandidateQuerySchema>
export type CreatorCandidatePageV1 = z.infer<typeof creatorCandidatePageSchema>
