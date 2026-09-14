/**
 * Scaena 导出交付消费（dsh-scaena-production-studio-v1 §2.5）。
 *
 * 成功只认 owner 回执与产物 ref：交付页把 owner evidence-export 投影
 * （run/receipt/review/finding/artifact/package refs + readiness +
 * blocking reasons）与 canonical 包投影的 export 门（formal/draft +
 * blockers）原样投影，UI toast 不算交付。部分成功保留已完成成果：readiness
 * 非 ready 时已完成 run/receipt/package refs 仍全部列出，仅缺口进入
 * blocking reasons；「只修复明确允许的部分」= 各修复动作仍是独立 owner
 * 动作（visual accept/wave reconcile/creative confirm），本页不合成重试。
 *
 * 关闭 Pane 不取消：本模块无任何运行态/生命周期绑定——所有事实每次从
 * owner 投影重读，导出执行在 owner 侧（withLocalScaenaPackage 的幂等
 * export/export-status 面），Pane 关闭只停止观察。
 *
 * @module @yeisme/dsh-creator-studio-host
 */

import { z } from 'zod'
import { scaenaCliEnvelopeSchema, scaenaEvidenceExportProjectionSchema } from './scaena-production-contract.ts'
import type { ScaenaInvoke, ScaenaPackageProjection } from './scaena-package-contract.ts'
import { readScaenaPackageProjection } from './scaena-storyboard-actions.ts'

const packageRefText = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u)

export const scaenaDeliveryQuerySchema = z.object({ packageRef: packageRefText }).strict()
export type ScaenaDeliveryQuery = z.infer<typeof scaenaDeliveryQuerySchema>

export type ScaenaDeliveryPageResult =
  | {
      readonly status: 'ready'
      readonly schemaVersion: 'scaena.export_delivery.v1'
      readonly packageRef: string
      /** 交付就绪与运行成功/制作验收互相独立（owner 三态分离）。 */
      readonly deliveryReadiness: string
      readonly blockingReasons: readonly string[]
      readonly completedRunRefs: readonly string[]
      readonly completedReceiptRefs: readonly string[]
      readonly completedPackageRefs: readonly string[]
      readonly artifactRefs: readonly string[]
      readonly exportFormalAllowed: boolean
      readonly exportDraftAllowed: boolean
      readonly exportBlockers: readonly string[]
      readonly freshness: 'fresh' | 'stale'
      readonly summary: string
    }
  | { readonly status: 'empty'; readonly reason: string }
  | { readonly status: 'rejected' | 'unknown'; readonly reason: 'invalid_input' | 'unavailable' | 'owner_rejected' | 'contract_mismatch' | 'unconfirmed' }

async function readEvidenceExport(invoke: ScaenaInvoke, cwd: string): Promise<{ kind: 'ready'; projection: z.infer<typeof scaenaEvidenceExportProjectionSchema> } | { kind: 'failed'; reason: 'unavailable' | 'owner_rejected' | 'contract_mismatch' }> {
  let raw: unknown
  try { raw = await invoke(['production', 'evidence-export', '--project', cwd]) } catch { return { kind: 'failed', reason: 'unavailable' } }
  const envelope = scaenaCliEnvelopeSchema.safeParse(raw)
  if (!envelope.success) return { kind: 'failed', reason: 'contract_mismatch' }
  if (envelope.data.error !== undefined) return { kind: 'failed', reason: envelope.data.error.code === 'INVALID_ARGUMENT' ? 'owner_rejected' : 'unavailable' }
  const projection = scaenaEvidenceExportProjectionSchema.safeParse(envelope.data.data)
  return projection.success ? { kind: 'ready', projection: projection.data } : { kind: 'failed', reason: 'contract_mismatch' }
}

/**
 * 交付页读取：owner 回执/产物 ref 为准。包投影与 evidence-export 均可读才
 * 出 ready 页（半新半旧不如一次一致降级）；缺包选择 → empty。
 */
export async function readScaenaDeliveryPage(invoke: ScaenaInvoke, cwd: string, query: ScaenaDeliveryQuery): Promise<ScaenaDeliveryPageResult> {
  const parsedQuery = scaenaDeliveryQuerySchema.safeParse(query)
  if (!parsedQuery.success) return { status: 'rejected', reason: 'invalid_input' }
  // CLI 不可用/身份不符都归 unavailable：交付事实缺源时不出半页。
  let projection: ScaenaPackageProjection | undefined
  try { projection = await readScaenaPackageProjection(invoke, cwd, parsedQuery.data.packageRef) } catch { projection = undefined }
  if (projection === undefined) return { status: 'unknown', reason: 'unavailable' }
  const evidence = await readEvidenceExport(invoke, cwd)
  if (evidence.kind === 'failed') return { status: evidence.reason === 'owner_rejected' ? 'rejected' : 'unknown', reason: evidence.reason }

  const value = evidence.projection
  const readinessReady = value.readiness_status === 'ready'
  return {
    status: 'ready', schemaVersion: 'scaena.export_delivery.v1', packageRef: parsedQuery.data.packageRef,
    deliveryReadiness: value.readiness_status,
    blockingReasons: value.blocking_reasons ?? [],
    // 部分成功保留：readiness 非 ready 不清空已完成 refs。
    completedRunRefs: value.run_refs ?? [], completedReceiptRefs: value.receipt_refs ?? [], completedPackageRefs: value.package_refs ?? [],
    artifactRefs: value.artifact_refs ?? [],
    exportFormalAllowed: projection.export.formal_allowed, exportDraftAllowed: projection.export.draft_allowed,
    exportBlockers: projection.export.blockers ?? projection.blockers,
    freshness: readinessReady && projection.export.formal_allowed ? 'fresh' : 'stale',
    summary: readinessReady
      ? 'Owner reports delivery readiness with receipts and artifact refs; formal export gating is satisfied for the current visual acceptances.'
      : `Delivery is not ready (${value.readiness_status}); ${(value.blocking_reasons ?? []).length} blocking reason(s) remain. Completed runs, receipts and packages stay listed for inspection; only explicitly permitted owner actions repair the gaps.`,
  }
}

/** 包投影的导出门（供快照/交付页联合断言；导出动作仍归 withLocalScaenaPackage）。 */
export function scaenaExportGate(projection: ScaenaPackageProjection): { formalAllowed: boolean; draftAllowed: boolean; blockers: readonly string[] } {
  return { formalAllowed: projection.export.formal_allowed, draftAllowed: projection.export.draft_allowed, blockers: projection.export.blockers ?? projection.blockers }
}
