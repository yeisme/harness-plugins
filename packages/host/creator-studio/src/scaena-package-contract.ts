import { z } from 'zod'

export const scaenaPackageQuerySchema = z.object({ packageRef: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u) }).strict()
export const scaenaPackageResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ready'), packageRef: scaenaPackageQuerySchema.shape.packageRef }).strict(),
  z.object({ status: z.enum(['invalid_input', 'unavailable', 'unconfirmed', 'permission_denied']) }).strict(),
])
export type ScaenaPackageQuery = z.infer<typeof scaenaPackageQuerySchema>
export type ScaenaPackageResult = z.infer<typeof scaenaPackageResultSchema>
