import { eikonaPreparationResultSchema } from './eikona-preparation-contract.ts'
import { eikonaApprovalResultSchema } from './eikona-preparation-approval.ts'
import { eikonaStatusResultSchema } from './eikona-approval-status.ts'

/** Build fixed owner input from verified projections, without granting dispatch. */
export function bindEikonaGeneration(preparation: unknown, approval: unknown, observation: unknown, projectId: string, now = Date.now()) {
  const prepared = eikonaPreparationResultSchema.safeParse(preparation)
  const approved = eikonaApprovalResultSchema.safeParse(approval)
  const status = eikonaStatusResultSchema.safeParse(observation)
  if (!Number.isFinite(now) || !prepared.success || prepared.data.status !== 'ready'
    || !approved.success || approved.data.status !== 'approved' || !status.success || status.data.status !== 'observed') return undefined
  const p = prepared.data, a = approved.data, o = status.data
  if (p.projectId !== projectId || a.projectId !== projectId || o.projectId !== projectId
    || a.preparationRef !== p.preparationRef || o.preparationRef !== p.preparationRef
    || a.digest !== p.digest || o.digest !== p.digest || o.approvalRef !== a.approvalRef
    || o.revoked || o.expired || o.consumedOperation !== undefined
    || a.expiresAt !== o.expiresAt || Date.parse(o.expiresAt) <= now
    || Date.parse(o.observedAt) > now + 5000 || now - Date.parse(o.observedAt) > 60_000
    || p.modelRef !== 'openai/gpt-5.4-image-2') return undefined
  return {
    request: { project_ref: `project:${projectId}`, approval_ref: a.approvalRef, prompt_version: p.promptRef,
      model: p.modelRef, cost_limit: { max_images: 1 }, dry_run: false },
    preparationRef: p.preparationRef, digest: p.digest, maxCostUSD: a.maxCostUSD, expiresAt: a.expiresAt,
  }
}
