import { z } from 'zod'
const ref = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u)
export const scaenaTableQuerySchema = z.object({ breakdownRef: ref, shotRef: ref.optional(), continuation: z.string().max(4096).optional() }).strict()
export const scaenaTableViewSchema = z.object({ schema_version: z.literal('scaena.storyboard_table_view.v1alpha1'), project_ref: ref,
  breakdown_ref: ref, candidate_ref: ref, candidate_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/u), expected_version: z.number().int().nonnegative().default(0), historical: z.boolean().optional(),
  columns: z.array(z.object({ field: z.string().regex(/^[A-Za-z0-9._-]{1,100}$/u), label: z.string().max(256).optional() })).max(100),
  shots: z.array(z.object({ scene_ref: ref, shot_ref: ref, order: z.number().int(), planned_duration_micros: z.number().int().positive().optional(),
    cells: z.record(z.string(), z.string().max(16384)), restricted_fields: z.array(z.string()).optional() })).max(100).nullable().transform(rows => rows ?? []),
  truncated: z.boolean().optional(), continuation: z.string().max(4096).optional(),
})
export const scaenaTableResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ready'), view: scaenaTableViewSchema }).strict(),
  z.object({ status: z.enum(['invalid_input', 'unavailable', 'unconfirmed', 'permission_denied']) }).strict(),
])
export type ScaenaTableQuery = z.infer<typeof scaenaTableQuerySchema>
export type ScaenaTableResult = z.infer<typeof scaenaTableResultSchema>
