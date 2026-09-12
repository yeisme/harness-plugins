import { z } from 'zod'

export const eikonaApprovalInputSchema = z.object({
  preparation_ref: z.string().regex(/^egp_[a-f0-9]{64}$/u), expected_digest: z.string().regex(/^[a-f0-9]{64}$/u),
  max_cost_usd: z.number().finite().min(0), max_images: z.literal(1),
  allow_unknown_cost: z.literal(true), expires_in_seconds: z.number().int().min(1).max(86400), confirmed: z.literal(true),
}).strict()
export const eikonaApprovalResultSchema = z.union([
  z.object({ status: z.enum(['invalid_input', 'unavailable', 'unconfirmed', 'permission_denied', 'needs_contract']) }).strict(),
  z.object({ status: z.literal('approved'), approvalRef: z.string().regex(/^ega_[a-f0-9]{64}$/u),
    preparationRef: z.string().regex(/^egp_[a-f0-9]{64}$/u), digest: z.string().regex(/^[a-f0-9]{64}$/u),
    projectId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u), maxCostUSD: z.number().finite().min(0),
    maxImages: z.literal(1), allowUnknownCost: z.literal(true), expiresAt: z.string().datetime({ offset: true }),
  }).strict(),
])
export function matchesEikonaApproval(input: z.infer<typeof eikonaApprovalInputSchema>, result: z.infer<typeof eikonaApprovalResultSchema>) {
  return result.status !== 'approved' || (result.preparationRef === input.preparation_ref && result.digest === input.expected_digest
    && result.maxCostUSD === input.max_cost_usd && Date.parse(result.expiresAt) > Date.now()
    && Date.parse(result.expiresAt) <= Date.now() + input.expires_in_seconds * 1000 + 5000)
}
const approval = z.object({ schema_version: z.literal('eikona.generation_preparation_approval.v1'),
  ref: z.string().regex(/^ega_[a-f0-9]{64}$/u), project_id: z.string().min(1).max(160),
  preparation_ref: z.string(), preparation_digest: z.string(), max_cost_usd: z.number().finite().min(0), max_images: z.literal(1),
  allow_unknown_cost: z.literal(true), expires_at: z.string().datetime({ offset: true }),
})
export function inspectEikonaPreparationApproval(value: unknown, input: z.infer<typeof eikonaApprovalInputSchema>, projectId: string) {
  const parsed = approval.safeParse(value)
  if (!parsed.success) return { status: 'unconfirmed' as const }
  const row = parsed.data
  if (row.project_id !== projectId || row.preparation_ref !== input.preparation_ref || row.preparation_digest !== input.expected_digest
    || row.max_cost_usd !== input.max_cost_usd || Date.parse(row.expires_at) <= Date.now()
    || Date.parse(row.expires_at) > Date.now() + input.expires_in_seconds * 1000 + 5000) return { status: 'unconfirmed' as const }
  return { status: 'approved' as const, approvalRef: row.ref, preparationRef: row.preparation_ref, digest: row.preparation_digest,
    projectId: row.project_id, maxCostUSD: row.max_cost_usd, maxImages: 1 as const, allowUnknownCost: true as const, expiresAt: row.expires_at }
}

export type EikonaApprovalInput = z.infer<typeof eikonaApprovalInputSchema>
export type EikonaApprovalResult = z.infer<typeof eikonaApprovalResultSchema>

export const eikonaRevokeInputSchema = z.object({ approvalRef: z.string().regex(/^ega_[a-f0-9]{64}$/u), confirmed: z.literal(true) }).strict()
export const eikonaRevokeResultSchema = z.union([
 z.object({ status: z.enum(['invalid_input','unavailable','unconfirmed','permission_denied','needs_contract']) }).strict(),
 z.object({ status: z.literal('revoked'), approvalRef: z.string().regex(/^ega_[a-f0-9]{64}$/u) }).strict(),
])
export type EikonaRevokeInput = z.infer<typeof eikonaRevokeInputSchema>
export type EikonaRevokeResult = z.infer<typeof eikonaRevokeResultSchema>
export function matchesEikonaRevoke(input: EikonaRevokeInput, result: EikonaRevokeResult) { return result.status !== 'revoked' || result.approvalRef === input.approvalRef }
