import { z } from "zod"
const requestID = z.string().regex(/^inp_[a-f0-9]{32}$/)
export const fileSchema = z.object({ name: z.string().min(1).max(255), mime: z.string(), size: z.number().int().positive(), sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional() })
export const inputViewSchema = z.object({ schema_version: z.literal('yeisme.input_intake.v1'), input_request_id: requestID, project: z.string(), purpose: z.string(), state: z.string(), expires_at: z.string(), max_bytes: z.number().int().positive(), mime_types: z.array(z.string()), file: fileSchema.optional(), resume_state: z.string().optional(), failure_code: z.string().optional(), receipt: z.object({ ref: z.string().min(1).max(512).refine(value=>!/^https?:/i.test(value)&&!/[?#\\\s]/.test(value)), sha256: z.string().regex(/^[a-f0-9]{64}$/i), size: z.number().int().positive(), domain_state: z.string() }).optional() })
export type View = z.infer<typeof inputViewSchema>
export const inputQuerySchema = z.object({ owner: z.enum(['eikona','scaena','sonora','anatomia','auctra']), operation: z.enum(['prepare','recover','choose','manual','renew','cancel']), purpose: z.string().min(1).optional(), idempotencyKey: z.string().min(1).max(256).optional(), inputRequestId: requestID.optional() }).strict()
export type InputQuery = z.infer<typeof inputQuerySchema>
