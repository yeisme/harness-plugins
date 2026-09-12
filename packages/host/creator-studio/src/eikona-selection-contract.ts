import { z } from 'zod'

export const eikonaSelectionSchema = z.object({
  artifactRef: z.string().regex(/^eikona:\/\/artifacts\/[A-Za-z0-9][A-Za-z0-9._-]{0,159}\/[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u),
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/u),
}).strict()
export const eikonaSelectionQuerySchema = z.object({ selection: eikonaSelectionSchema.nullable() }).strict()
export const eikonaSelectionResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('selected'), selection: eikonaSelectionSchema }).strict(),
  z.object({ status: z.enum(['cleared', 'invalid_input', 'permission_denied', 'unavailable', 'unconfirmed', 'needs_contract', 'superseded']) }).strict(),
])
export type EikonaSelectionQuery = z.infer<typeof eikonaSelectionQuerySchema>
export type EikonaSelectionResult = z.infer<typeof eikonaSelectionResultSchema>
