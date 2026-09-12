import { expect, it } from 'vitest'
import { eikonaApprovalResultSchema, matchesEikonaApproval } from '../src/eikona-preparation-approval.ts'
it('rejects mismatched budgets, preparations and expired approval projections', () => {
  const input = { preparation_ref: `egp_${'a'.repeat(64)}`, expected_digest: 'b'.repeat(64), max_cost_usd: 0.5, max_images: 1 as const, allow_unknown_cost: true as const, confirmed: true as const, expires_in_seconds: 60 }
  const result = { status: 'approved' as const, approvalRef: `ega_${'c'.repeat(64)}`, preparationRef: input.preparation_ref, digest: input.expected_digest, projectId: 'project', maxCostUSD: 0.5, maxImages: 1 as const, allowUnknownCost: true as const, expiresAt: new Date(Date.now() + 60000).toISOString() }
  expect(eikonaApprovalResultSchema.safeParse(result).success).toBe(true)
  expect(matchesEikonaApproval(input, result)).toBe(true)
  expect(matchesEikonaApproval(input, { ...result, maxCostUSD: 1 })).toBe(false)
  expect(matchesEikonaApproval(input, { ...result, digest: 'd'.repeat(64) })).toBe(false)
  expect(matchesEikonaApproval(input, { ...result, expiresAt: new Date(0).toISOString() })).toBe(false)
  expect(eikonaApprovalResultSchema.safeParse({ ...result, token: 'fixture' }).success).toBe(false)
})
