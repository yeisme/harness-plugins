import { createHash } from 'node:crypto'
import { z } from 'zod'

/** Local CLI invoke 约定（withLocalScaena* 家族共享）：固定动词数组进、JSON 出。 */
export type ScaenaInvoke = (args: readonly string[], timeout?: number) => Promise<unknown>

/** 稳定 descriptor ref：由动作身份 + 目标 + 版本 + 绑定事实哈希派生。 */
export const scaenaDigestRef = (parts: readonly unknown[]): string =>
  `scaena:action:${createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 40)}`

export const scaenaPackageQuerySchema = z.object({ packageRef: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u) }).strict()
export const scaenaPackageResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ready'), packageRef: scaenaPackageQuerySchema.shape.packageRef }).strict(),
  z.object({ status: z.enum(['invalid_input', 'unavailable', 'unconfirmed', 'permission_denied']) }).strict(),
])
export type ScaenaPackageQuery = z.infer<typeof scaenaPackageQuerySchema>
export type ScaenaPackageResult = z.infer<typeof scaenaPackageResultSchema>

const ref = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u)
const sha256 = z.string().regex(/^sha256:[a-f0-9]{64}$/u)

/**
 * Owner canonical review-package projection wire（CLI `storyboard package show
 * --view detail` 的 data；`scaena.storyboard.review_package_projection.v1`）。
 * 由 local-scaena-package 与制作台动作族共享——唯一 schema 副本，防第二镜头表/
 * 第二包投影漂移。scene/wave 分页游标由 owner 投影携带（scene_cursor/
 * scene_has_more/wave_cursor/wave_has_more），CLI show 当前只投影首页（≤50），
 * truncated 事实原样透出，不在插件端补页。
 */
export const scaenaPackageProjectionSchema = z.object({
  schema_version: z.literal('scaena.storyboard.review_package_projection.v1'), package_ref: ref, project_ref: ref,
  episode_ref: ref, scenario: z.string().max(64), state: z.string().max(100),
  episode_graph_ref: ref, graph_version: z.number().int().nonnegative(), package_version: z.number().int().positive(),
  episode_completed: z.boolean(), input_source_kind: z.string().max(64), input_digest: z.string().min(1).max(160),
  recommendation_ref: ref.optional(), confirmation_ref: ref.optional(), chosen_depth: z.string().max(64).optional(),
  readiness: z.object({ state: z.string().max(64), export_ready: z.boolean().optional(),
    structural_coverage: z.number().min(0).max(1).optional(), visual_coverage: z.number().min(0).max(1).optional(),
    formal_blockers: z.array(z.string().max(200)).max(32).optional(), stale_blockers: z.array(z.string().max(200)).max(32).optional() }).strict().optional(),
  scene_cards: z.array(z.object({ scene_ref: ref, order: z.number().int(), shot_refs: z.array(ref).max(200), shot_count: z.number().int().nonnegative().optional(),
    structural_accepted: z.boolean(), visual_accepted: z.boolean(), stale: z.boolean(),
    blockers: z.array(z.string().max(200)).max(16).optional(), acceptance_receipt_ref: ref.optional(), visual_receipt_ref: ref.optional() })).max(200).optional(),
  scene_cursor: z.number().int().nonnegative().optional(), scene_has_more: z.boolean().optional(),
  wave_cards: z.array(z.object({ wave_ref: ref, wave_kind: z.string().max(64), execution_state: z.string().max(64),
    approved: z.boolean(), paid: z.boolean(), job_count: z.number().int().nonnegative(),
    estimate_status: z.string().max(64), has_hard_budget: z.boolean(), plan_digest: z.string().min(1).max(160),
    expected_package_version: z.number().int().positive() })).max(200).optional(),
  wave_cursor: z.number().int().nonnegative().optional(), wave_has_more: z.boolean().optional(),
  asset_graph_digest: z.string().min(1).max(160).optional(), asset_graph_revision: z.number().int().nonnegative().optional(),
  technical_partition: z.boolean().optional(),
  // Go nil slice 序列化为 null：blockers/allowed_actions 允许 null/缺席，归一为 []。
  blockers: z.array(z.string().max(200)).max(64).nullish().transform(rows => rows ?? []),
  allowed_actions: z.array(z.string().max(64)).max(64).nullish().transform(rows => rows ?? []),
  export: z.object({ formal_allowed: z.boolean(), draft_allowed: z.boolean(), blockers: z.array(z.string().max(200)).max(32).optional() }),
  evidence_refs: z.array(z.string().max(256)).max(64).optional(),
  generated_at: z.string().min(1).max(64).optional(),
}).strict()
export type ScaenaPackageProjection = z.infer<typeof scaenaPackageProjectionSchema>

/** Owner export manifest wire（`scaena.storyboard.package_export_manifest.v1`）。 */
export const scaenaPackageExportManifestSchema = z.object({
  schema_version: z.literal('scaena.storyboard.package_export_manifest.v1'), package_ref: ref,
  idempotency_key_digest: sha256, request_digest: sha256,
  package_version: z.number().int().positive(), export_mode: z.enum(['formal', 'draft']), production_ready: z.boolean(),
  files: z.array(z.object({ path: z.string().regex(/^[A-Za-z0-9._-]+$/u), digest: z.string().min(1).max(160), size_bytes: z.number().int().nonnegative() })).max(64),
}).strict()
export type ScaenaPackageExportManifest = z.infer<typeof scaenaPackageExportManifestSchema>

/** Owner generation wave wire（wave-plan/execute 的 data；`scaena.storyboard.generation_wave.v1`）。 */
export const scaenaGenerationWaveSchema = z.object({
  schema_version: z.literal('scaena.storyboard.generation_wave.v1'), wave_ref: ref, package_ref: ref,
  wave_kind: z.enum(['storyboard_model', 'foundation', 'key_shots', 'remaining_shots', 'repair']),
  asset_node_keys: z.array(z.string().max(200)).max(500), job_plan: z.array(z.object({
    job_key: z.string().min(1).max(200), asset_node_keys: z.array(z.string().max(200)).max(64),
    shot_ref: z.string().min(1).max(200), model_ref: z.string().min(1).max(160),
    candidate_count: z.number().int().min(1).max(8), prompt_digest: z.string().min(1).max(160) })).max(200),
  candidates_per_shot: z.number().int().min(1), estimate_status: z.enum(['unknown', 'bounded']),
  estimate_min_micro_usd: z.number().int().nonnegative().optional(), estimate_max_micro_usd: z.number().int().nonnegative().optional(),
  hard_budget: z.object({ cap_micro_usd: z.number().int().positive(), spent_micro_usd: z.number().int().nonnegative(), remaining_micro_usd: z.number().int() }).optional(),
  plan_digest: z.string().min(1).max(160), expected_package_version: z.number().int().positive(),
  approval: z.object({ approved_plan_digest: z.string().min(1).max(160), estimate_status: z.enum(['unknown', 'bounded']), confirm_unknown_estimate: z.boolean() }).optional(),
  execution_state: z.string().max(64), paid: z.boolean(),
}).strict()
export type ScaenaGenerationWave = z.infer<typeof scaenaGenerationWaveSchema>
