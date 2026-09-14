/**
 * Scaena Production 只读四合同 wire（dsh-scaena-production-studio-v1 §2.1/§2.5）。
 *
 * 消费面按 1.2 冻结的 minimal consumer 合同：owner
 * `docs/design/production-public-api-contract.md` 的四个 first-support 读合同
 * （本地 CLI `scaena production <view> --json`，与 `/api/v1/production/**`
 * 同一 application 投影、同一 shared envelope 语义）。contract id 与
 * schema_version 用 literal 钉死：owner 未来发布 critical 版本漂移时解析失败
 * → 显式 contract_mismatch，绝不猜 wire（未知 critical 版本拒绝）。
 *
 * owner 六阶段固定词汇（prepare/text/visual/shots/review/export ×
 * not_started/ready/running/needs_review/blocked/completed）只展示不推断；
 * 排序、blocker priority、recommended action 全部由 owner 派生。
 *
 * @module @yeisme/dsh-creator-studio-host
 */

import { z } from 'zod'

const identifier = z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u)
const safeText = z.string().max(200)

/** owner 服务端签发的 ProjectionActionDescriptor（facade 投影内嵌）。 */
export const scaenaProjectionActionDescriptorSchema = z.object({
  id: identifier,
  label_key: z.string().min(1).max(200),
  http_method_or_command: safeText.optional(),
  target_ref: identifier.optional(),
  risk_class: z.enum(['standard', 'elevated', 'destructive']).optional(),
  confirmation_required: z.boolean().optional(),
  idempotency_required: z.boolean().optional(),
  expected_version_required: z.boolean().optional(),
  disabled_reason: safeText.optional(),
}).strict()
export type ScaenaProjectionActionDescriptor = z.infer<typeof scaenaProjectionActionDescriptorSchema>

export const SCAENA_PRODUCTION_STAGES = ['prepare', 'text', 'visual', 'shots', 'review', 'export'] as const
export type ScaenaProductionStage = (typeof SCAENA_PRODUCTION_STAGES)[number]
export const SCAENA_PRODUCTION_STAGE_STATUSES = ['not_started', 'ready', 'running', 'needs_review', 'blocked', 'completed'] as const
export type ScaenaProductionStageStatus = (typeof SCAENA_PRODUCTION_STAGE_STATUSES)[number]

const stageStatus = z.enum(SCAENA_PRODUCTION_STAGE_STATUSES)
// owner cockpit 总是填满六阶段，但 additive 演进下允许缺席键（partialRecord），
// 缺席阶段按 not_started 诚实呈现，不伪造 running/blocked。
const stageRecord = z.partialRecord(z.enum(SCAENA_PRODUCTION_STAGES), z.object({
  status: stageStatus, blocker_count: z.number().int().nonnegative(), pending_review_count: z.number().int().nonnegative(),
  primary_refs: z.array(identifier).max(64).optional(), evidence_refs: z.array(identifier).max(64).optional(),
}).strict())

/** `scaena.production.portfolio.v1`（CLI `production portfolio`）。 */
export const scaenaPortfolioProjectionSchema = z.object({
  contract_id: z.literal('scaena.production.portfolio.v1'),
  schema_version: z.literal('1.0.0'),
  status: z.enum(['ok', 'empty', 'error']),
  projects: z.array(z.object({
    project_ref: identifier, title: safeText, phase: safeText, readiness: safeText,
    active_run_status: safeText.optional(), blocker_count: z.number().int().nonnegative(), pending_review_count: z.number().int().nonnegative(),
    package_readiness: safeText.optional(), owner_availability: z.record(z.string().max(64), safeText).optional(),
    last_activity: z.string().max(64).optional(), evidence_refs: z.array(identifier).max(64).optional(),
    next_action: scaenaProjectionActionDescriptorSchema.optional(),
  }).strict()).max(200).optional(),
  next_action: scaenaProjectionActionDescriptorSchema.optional(),
  blockers: z.array(safeText).max(64).optional(),
  evidence_refs: z.array(identifier).max(64).optional(),
  generated_at: z.string().max(64).optional(),
}).strict()
export type ScaenaPortfolioProjection = z.infer<typeof scaenaPortfolioProjectionSchema>

/** `scaena.production.cockpit.v1`（CLI `production cockpit --project`）。 */
export const scaenaCockpitProjectionSchema = z.object({
  contract_id: z.literal('scaena.production.cockpit.v1'),
  schema_version: z.literal('1.0.0'),
  project_ref: identifier,
  status: safeText,
  stages: stageRecord,
  recommended_action: scaenaProjectionActionDescriptorSchema.optional(),
  secondary_actions: z.array(scaenaProjectionActionDescriptorSchema).max(32).optional(),
  readiness: safeText.optional(),
  blockers: z.array(safeText).max(64).optional(),
  evidence_refs: z.array(identifier).max(64).optional(),
  next_action: scaenaProjectionActionDescriptorSchema.optional(),
  generated_at: z.string().max(64).optional(),
}).strict()
export type ScaenaCockpitProjection = z.infer<typeof scaenaCockpitProjectionSchema>

/** `scaena.production.review_queue.v1`（CLI `production reviews --project`）。 */
export const scaenaReviewQueueProjectionSchema = z.object({
  contract_id: z.literal('scaena.production.review_queue.v1'),
  schema_version: z.literal('1.0.0'),
  project_ref: identifier,
  status: safeText,
  items: z.array(z.object({
    review_ref: identifier, owner: safeText, kind: safeText, status: safeText,
    risk: safeText.optional(), expected_version: safeText.optional(), reason_summary: safeText.optional(),
    resource_refs: z.array(identifier).max(64).optional(), finding_refs: z.array(identifier).max(64).optional(),
    evidence_refs: z.array(identifier).max(64).optional(), allowed_actions: z.array(scaenaProjectionActionDescriptorSchema).max(32).optional(),
    created_at: z.string().max(64).optional(),
  }).strict()).max(500).optional(),
  next_action: scaenaProjectionActionDescriptorSchema.optional(),
  blockers: z.array(safeText).max(64).optional(),
  evidence_refs: z.array(identifier).max(64).optional(),
  generated_at: z.string().max(64).optional(),
}).strict()
export type ScaenaReviewQueueProjection = z.infer<typeof scaenaReviewQueueProjectionSchema>

/** `scaena.production.evidence_export.v1`（CLI `production evidence-export --project`）。 */
export const scaenaEvidenceExportProjectionSchema = z.object({
  contract_id: z.literal('scaena.production.evidence_export.v1'),
  schema_version: z.literal('1.0.0'),
  project_ref: identifier,
  status: safeText,
  run_refs: z.array(identifier).max(200).optional(),
  receipt_refs: z.array(identifier).max(200).optional(),
  review_decision_refs: z.array(identifier).max(200).optional(),
  finding_refs: z.array(identifier).max(200).optional(),
  artifact_refs: z.array(identifier).max(200).optional(),
  package_refs: z.array(identifier).max(200).optional(),
  readiness_status: safeText,
  blocking_reasons: z.array(safeText).max(64).optional(),
  exportable_item_counts: z.record(z.string().max(64), z.number().int().nonnegative()).optional(),
  redaction_summary: safeText.optional(),
  next_action: scaenaProjectionActionDescriptorSchema.optional(),
  blockers: z.array(safeText).max(64).optional(),
  evidence_refs: z.array(identifier).max(64).optional(),
  generated_at: z.string().max(64).optional(),
}).strict()
export type ScaenaEvidenceExportProjection = z.infer<typeof scaenaEvidenceExportProjectionSchema>

export type ScaenaProductionView = 'portfolio' | 'cockpit' | 'reviews' | 'evidence-export'

export const SCAENA_PRODUCTION_VIEWS: readonly ScaenaProductionView[] = ['portfolio', 'cockpit', 'reviews', 'evidence-export']

/** 读失败/未确认原因；contract_mismatch 是冻结合同的未知 critical 版本拒绝路径。 */
export type ScaenaProductionReadReason = 'invalid_input' | 'unavailable' | 'owner_rejected' | 'contract_mismatch' | 'unconfirmed'

export type ScaenaProductionPageResult =
  | { readonly status: 'ready'; readonly view: ScaenaProductionView; readonly freshness: 'fresh' | 'stale'; readonly generatedAt?: string
      readonly projects?: readonly { readonly projectRef: string; readonly title: string; readonly phase: string; readonly readiness: string
        readonly blockerCount: number; readonly pendingReviewCount: number; readonly ownerAvailability: readonly { readonly owner: string; readonly state: string }[]
        readonly packageReadiness?: string; readonly nextActionId?: string; readonly evidenceRefs: readonly string[] }[]
      readonly stages?: readonly { readonly id: ScaenaProductionStage; readonly status: ScaenaProductionStageStatus
        readonly blockerCount: number; readonly pendingReviewCount: number; readonly primaryRefs: readonly string[] }[]
      readonly reviews?: readonly { readonly reviewRef: string; readonly owner: string; readonly kind: string; readonly status: string
        readonly risk?: string; readonly expectedVersion?: string; readonly allowedActionIds: readonly string[] }[]
      readonly delivery?: { readonly readinessStatus: string; readonly blockingReasons: readonly string[]
        readonly runRefs: readonly string[]; readonly receiptRefs: readonly string[]; readonly packageRefs: readonly string[]; readonly artifactRefs: readonly string[] }
      readonly nextCursor?: string }
  | { readonly status: 'empty'; readonly view: ScaenaProductionView; readonly reason: string }
  | { readonly status: 'rejected' | 'unknown'; readonly reason: ScaenaProductionReadReason }

/** owner 稳定错误码中代表 stale/CAS 冲突的子集（刷新不覆盖，绝不重试）。 */
export const SCAENA_STALE_ERROR_CODES = new Set([
  'SCN_GRAPH_VERSION_CONFLICT', 'SCN_SCENE_BOUNDARY_STALE', 'SCN_WAVE_APPROVAL_REQUIRED', 'SCN_HARD_BUDGET_QUOTE_REQUIRED',
  'SCN_VISUAL_JOB_RECONCILE_REQUIRED', 'SCN_VISUAL_ACCEPTANCE_REQUIRED', 'SCN_RECOMMENDATION_CONFIRMATION_REQUIRED',
  'SCN_PAID_CREATIVE_CONTRACT_REQUIRED', 'SCN_SCREENPLAY_ACCEPTANCE_REQUIRED',
])

/** CLI JSON envelope 的最小读取面（shared envelope；mutation 结果共用 facts/evidence）。 */
export const scaenaCliEnvelopeSchema = z.object({
  spec_version: z.string().max(32).optional(),
  mode: z.string().max(32).optional(),
  command: z.string().max(200).optional(),
  status: z.string().max(64).optional(),
  summary: z.string().max(2000).optional(),
  facts: z.record(z.string(), z.unknown()).optional(),
  evidence: z.array(z.string().max(256)).max(128).optional(),
  data: z.unknown().optional(),
  error: z.object({ code: z.string().max(120), message: z.string().max(2000).optional(), suggestion: z.string().max(2000).optional() }).optional(),
}).strict()
export type ScaenaCliEnvelope = z.infer<typeof scaenaCliEnvelopeSchema>

export function validateScaenaPortfolioProjection(value: unknown): ScaenaPortfolioProjection | undefined {
  const parsed = scaenaPortfolioProjectionSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

export function validateScaenaCockpitProjection(value: unknown): ScaenaCockpitProjection | undefined {
  const parsed = scaenaCockpitProjectionSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

export function validateScaenaReviewQueueProjection(value: unknown): ScaenaReviewQueueProjection | undefined {
  const parsed = scaenaReviewQueueProjectionSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

export function validateScaenaEvidenceExportProjection(value: unknown): ScaenaEvidenceExportProjection | undefined {
  const parsed = scaenaEvidenceExportProjectionSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}
