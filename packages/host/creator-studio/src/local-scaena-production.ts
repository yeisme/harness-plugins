/**
 * Scaena 制作台本地 adapter 组合层（dsh-scaena-production-studio-v1 §2.1）。
 *
 * 在既有 scaena 本地链之上追加：快照的 production 阶段投影（owner cockpit
 * 六阶段固定词表 → CreatorProductionV1 展示词表，纯展示映射、不建第二状
 * 态机），以及三个只读 face——制作项目/镜头/资产列表页（§2.1 四合同分页
 * 读取）、导出交付页（§2.5）、包事件 refs-only 观察面（§2.6）。读取失败/
 * 未初始化项目 → 快照保持 base 状态（诚实降级），绝不伪造 production 数据。
 *
 * @module @yeisme/dsh-creator-studio-host
 */

import { z } from 'zod'
import type { CreatorOwnerAdapterV1, CreatorOwnerSnapshotV1, CreatorProductionStageId, CreatorProductionStageV1, CreatorProductionV1 } from './types.ts'
import { scaenaCliEnvelopeSchema, scaenaCockpitProjectionSchema, SCAENA_PRODUCTION_STAGES } from './scaena-production-contract.ts'
import { ScaenaProductionReads, scaenaProductionPageQuerySchema } from './scaena-production-reads.ts'
import { readScaenaDeliveryPage, scaenaDeliveryQuerySchema } from './scaena-export-delivery.ts'
import { ScaenaPackageEventsClient, scaenaPackageEventsQuerySchema } from './scaena-review-package-transport.ts'
import type { ScaenaInvoke } from './scaena-package-contract.ts'

/** owner 阶段状态 → pane 展示状态（总映射；completed 以 progress=1 呈现）。 */
function stageDisplay(status: string): { status: CreatorProductionStageV1['status']; progress: number } {
  switch (status) {
    case 'completed': return { status: 'ready', progress: 1 }
    case 'running': return { status: 'running', progress: 0 }
    case 'needs_review': return { status: 'attention', progress: 0 }
    case 'blocked': return { status: 'blocked', progress: 0 }
    case 'ready': return { status: 'ready', progress: 0 }
    default: return { status: 'pending', progress: 0 }
  }
}

function currentStage(stages: readonly { id: CreatorProductionStageId; status: string }[]): CreatorProductionStageId {
  const blocked = stages.find(stage => stage.status === 'blocked')
  if (blocked !== undefined) return blocked.id
  const open = stages.find(stage => stage.status !== 'completed')
  return (open ?? stages[stages.length - 1])!.id
}

/** cockpit 投影 → CreatorProductionV1（blockers/stages 全部来自 owner）。 */
export function scaenaCockpitToProduction(cockpit: z.infer<typeof scaenaCockpitProjectionSchema>): CreatorProductionV1 {
  const stages = SCAENA_PRODUCTION_STAGES.map(id => {
    const stage = cockpit.stages[id]
    const display = stageDisplay(stage?.status ?? 'not_started')
    return {
      id, label: id, status: display.status, progress: display.progress,
      itemCount: (stage?.blocker_count ?? 0) + (stage?.pending_review_count ?? 0),
    }
  })
  return {
    ref: cockpit.project_ref,
    version: cockpit.generated_at && cockpit.generated_at.length > 0 ? cockpit.generated_at : '0',
    title: cockpit.project_ref,
    currentStage: currentStage(stages.map(stage => ({ id: stage.id, status: cockpit.stages[stage.id]?.status ?? 'not_started' }))),
    stages,
    blockers: [
      ...(cockpit.blockers ?? []).map(code => ({ ref: `${cockpit.project_ref}:blocker:${code}`, title: code, severity: 'critical' as const, summary: 'Owner-derived production blocker.' })),
      ...SCAENA_PRODUCTION_STAGES.flatMap(id => {
        const stage = cockpit.stages[id]
        return stage === undefined ? [] : stage.blocker_count > 0 ? [{ ref: `${cockpit.project_ref}:stage:${id}`, title: `blocked:${id}`, severity: 'warning' as const, summary: `Stage ${id} reports ${stage.blocker_count} blocker(s).` }] : []
      }),
    ],
  }
}

async function readCockpit(invoke: ScaenaInvoke, cwd: string): Promise<z.infer<typeof scaenaCockpitProjectionSchema> | undefined> {
  let raw: unknown
  try { raw = await invoke(['production', 'cockpit', '--project', cwd]) } catch { return undefined }
  const envelope = scaenaCliEnvelopeSchema.safeParse(raw)
  if (!envelope.success || envelope.data.error !== undefined) return undefined
  const projection = scaenaCockpitProjectionSchema.safeParse(envelope.data.data)
  return projection.success ? projection.data : undefined
}

export function withLocalScaenaProduction(base: CreatorOwnerAdapterV1, invoke: ScaenaInvoke, cwd: string): CreatorOwnerAdapterV1 {
  const reads = new ScaenaProductionReads(invoke, cwd)
  const events = new ScaenaPackageEventsClient(invoke, cwd)
  return {
    ...base,
    async snapshot(context): Promise<CreatorOwnerSnapshotV1> {
      const snapshot = await base.snapshot(context)
      // 未初始化/读取失败：保持 base 快照（offline/ready 均不伪造 production）。
      const cockpit = await readCockpit(invoke, cwd)
      if (cockpit === undefined) return snapshot
      return { ...snapshot, production: scaenaCockpitToProduction(cockpit) }
    },
    async readScaenaProduction(query, context) {
      const parsed = scaenaProductionPageQuerySchema.safeParse(query)
      if (!parsed.success) return { status: 'rejected' as const, reason: 'invalid_input' as const }
      return reads.read(context, parsed.data)
    },
    async readScaenaDelivery(query) {
      const parsed = scaenaDeliveryQuerySchema.safeParse(query)
      if (!parsed.success) return { status: 'rejected' as const, reason: 'invalid_input' as const }
      return readScaenaDeliveryPage(invoke, cwd, parsed.data)
    },
    async readScaenaPackageEvents(query) {
      const parsed = scaenaPackageEventsQuerySchema.safeParse(query)
      if (!parsed.success) return { status: 'rejected' as const, reason: 'invalid_input' as const }
      return events.read(parsed.data)
    },
  }
}
