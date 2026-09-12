import { z } from 'zod'
const status = z.object({ schema_version: z.literal('eikona.generation_preparation_approval_status.v1'),
  approval_ref: z.string().regex(/^ega_[a-f0-9]{64}$/u), preparation_ref: z.string().regex(/^egp_[a-f0-9]{64}$/u),
  preparation_digest: z.string().regex(/^[a-f0-9]{64}$/u), project_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u),
  revoked: z.boolean(), expired: z.boolean(), consumed_operation: z.string().regex(/^own_[a-f0-9]{24}$/u).optional(),
  expires_at: z.string().datetime({ offset: true }), observed_at: z.string().datetime({ offset: true }),
})
export function inspectEikonaApprovalStatus(input: unknown, scope: { approvalRef: string; projectId: string }) {
  const parsed = status.safeParse(input)
  if (!parsed.success) return { status: 'needs_contract' as const }
  const value = parsed.data
  if (value.approval_ref !== scope.approvalRef || value.project_id !== scope.projectId) return { status: 'permission_denied' as const }
  if (value.expired !== (Date.parse(value.expires_at) <= Date.parse(value.observed_at))) return { status: 'needs_contract' as const }
  return { status: 'observed' as const, approvalRef: value.approval_ref, preparationRef: value.preparation_ref, digest: value.preparation_digest,
    projectId: value.project_id, revoked: value.revoked, expired: value.expired,
    ...(value.consumed_operation ? { consumedOperation: value.consumed_operation } : {}), expiresAt: value.expires_at, observedAt: value.observed_at }
}

export const eikonaStatusInputSchema = z.object({ approvalRef: z.string().regex(/^ega_[a-f0-9]{64}$/u) }).strict()
export const eikonaStatusResultSchema = z.union([
 z.object({ status: z.enum(['invalid_input','unavailable','unconfirmed','permission_denied','needs_contract']) }).strict(),
 z.object({ status: z.literal('observed'), approvalRef: status.shape.approval_ref, preparationRef: status.shape.preparation_ref, digest: status.shape.preparation_digest,
 projectId: status.shape.project_id, revoked: z.boolean(), expired: z.boolean(), consumedOperation: status.shape.consumed_operation,
 expiresAt: status.shape.expires_at, observedAt: status.shape.observed_at }).strict().refine(value => value.expired === (Date.parse(value.expiresAt) <= Date.parse(value.observedAt))),
])
export type EikonaStatusInput = z.infer<typeof eikonaStatusInputSchema>
export type EikonaStatusResult = z.infer<typeof eikonaStatusResultSchema>
export function matchesEikonaStatus(input: EikonaStatusInput, result: EikonaStatusResult) { return result.status !== 'observed' || input.approvalRef === result.approvalRef }
