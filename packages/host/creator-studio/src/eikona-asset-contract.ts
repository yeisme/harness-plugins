import { z } from 'zod'
const ref = z.string().regex(/^eikona:\/\/[A-Za-z0-9._:/-]{1,480}$/u)
export const eikonaAssetQuerySchema = z.object({ cursor: z.string().min(1).max(4096).optional(), limit: z.number().int().min(1).max(100).default(50) }).strict()
const item = z.object({ ref, title: z.string().max(512), versionStatus: z.enum(['observed_digest', 'unverified']),
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/u).optional(), mediaType: z.string().max(512).optional(), sourceRunRef: ref.optional(),
}).strict().refine(value => (value.versionStatus === 'observed_digest') === (value.contentDigest !== undefined))
export const eikonaAssetPageSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ready'), items: z.array(item).max(100), nextCursor: z.string().min(1).max(4096).optional() }).strict(),
  z.object({ status: z.enum(['needs_contract', 'permission_denied', 'unavailable', 'unconfirmed', 'invalid_input']) }).strict(),
])
export type EikonaAssetPage = z.infer<typeof eikonaAssetPageSchema>

export const eikonaImageQuerySchema = z.object({ artifactRef: ref,
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/u), idempotencyKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u), confirmed: z.literal(true),
}).strict()
export const eikonaImageResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ready'), value: z.object({ artifactRef: ref,
    contentDigest: z.string().regex(/^[a-f0-9]{64}$/u), mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
    byteLength: z.number().int().positive().max(16 * 1024 * 1024), base64: z.string().min(4).max(22369624).regex(/^[A-Za-z0-9+/]*={0,2}$/u),
  }).strict() }).strict(),
  z.object({ status: z.enum(['needs_contract', 'permission_denied', 'unavailable', 'unconfirmed', 'invalid_input']) }).strict(),
])
export type EikonaImageQuery = z.infer<typeof eikonaImageQuerySchema>
export type EikonaImageResult = z.infer<typeof eikonaImageResultSchema>
