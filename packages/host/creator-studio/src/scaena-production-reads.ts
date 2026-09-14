/**
 * Scaena Production 只读四合同消费（dsh-scaena-production-studio-v1 §2.1）。
 *
 * 本地 CLI transport（`scaena production <view> --json`）与
 * `/api/v1/production/**` 是同一 application 投影；DSH 本地链路沿用
 * withLocalScaena* 家族的 invoke 约定（固定动词数组，绝不执行 owner
 * 提供的命令文本）。project scope 由 `--project` 显式传递；分页：
 * portfolio/reviews 的 owner 投影是无游标有界列表，本层做显式 offset 分页
 * （游标只指向 owner 列表的稳定偏移，不发明 server cursor），cockpit/
 * evidence-export 是单项目投影、拒绝 cursor 输入。
 *
 * 诚实态：CLI 不可用→unavailable；owner 稳定错误码→owner_rejected；
 * wire 解析失败（含未知 critical contract 版本）→contract_mismatch；
 * 空项目（owner status=empty）→empty 页面带解释，不渲染假成功。
 * freshness：owner_availability 出现 unavailable/disconnected → stale。
 *
 * @module @yeisme/dsh-creator-studio-host
 */

import { z } from 'zod'
import type { CreatorStudioContextV1 } from './types.ts'
import {
  SCAENA_PRODUCTION_STAGES,
  scaenaCliEnvelopeSchema,
  scaenaCockpitProjectionSchema,
  scaenaEvidenceExportProjectionSchema,
  scaenaPortfolioProjectionSchema,
  scaenaReviewQueueProjectionSchema,
  type ScaenaProductionPageResult,
  type ScaenaProductionView,
} from './scaena-production-contract.ts'

export type { ScaenaProductionPageResult } from './scaena-production-contract.ts'

type Invoke = (args: readonly string[], timeout?: number) => Promise<unknown>

export const scaenaProductionPageQuerySchema = z.object({
  view: z.enum(['portfolio', 'cockpit', 'reviews', 'evidence-export']),
  cursor: z.string().max(128).optional(),
}).strict()
export type ScaenaProductionPageQuery = z.infer<typeof scaenaProductionPageQuerySchema>

const PAGE_SIZE = 20
const cursorPattern = /^scaena\.production\.(portfolio|reviews):(\d+)$/u

function pageCursor(view: 'portfolio' | 'reviews', offset: number): string {
  return `scaena.production.${view}:${offset}`
}

function parseCursor(view: 'portfolio' | 'reviews', cursor: string | undefined): number | undefined {
  if (cursor === undefined) return 0
  const match = cursorPattern.exec(cursor)
  if (match === null || match[1] !== view) return undefined
  const value = Number(match[2])
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

/** Owner 投影读取失败被分类为诚实原因；不把异常抛进会话。 */
type EnvelopeOutcome =
  | { kind: 'envelope'; envelope: z.infer<typeof scaenaCliEnvelopeSchema> }
  | { kind: 'unavailable' }
  | { kind: 'contract_mismatch' }

async function readEnvelope(invoke: Invoke, cwd: string, view: ScaenaProductionView): Promise<EnvelopeOutcome> {
  let raw: unknown
  try {
    // portfolio 在 owner 侧无 --project 也可读（无 store 时返回空投影）；
    // 统一带 --project 保持 project scope 显式。
    raw = await invoke(['production', view, '--project', cwd])
  } catch {
    return { kind: 'unavailable' }
  }
  const parsed = scaenaCliEnvelopeSchema.safeParse(raw)
  if (!parsed.success) return { kind: 'contract_mismatch' }
  if (parsed.data.error !== undefined && parsed.data.error.code.length > 0) {
    // owner 稳定错误码：INVALID_ARGUMENT 属请求侧拒绝；其余（存储/初始化缺失等）
    // 归 owner 拒绝读，不伪装成空列表。
    return { kind: 'envelope', envelope: parsed.data }
  }
  return { kind: 'envelope', envelope: parsed.data }
}

function envelopeRejected(envelope: z.infer<typeof scaenaCliEnvelopeSchema>): ScaenaProductionPageResult {
  const code = envelope.error?.code ?? 'UNKNOWN'
  return code === 'INVALID_ARGUMENT' ? { status: 'rejected', reason: 'owner_rejected' } : { status: 'rejected', reason: 'unavailable' }
}

/** 四合同只读客户端：invoke 进、诚实分页结果出；不缓存、不写、不推断 owner 状态。 */
export class ScaenaProductionReads {
  constructor(
    private readonly invoke: Invoke,
    private readonly cwd: string,
  ) {}

  async read(_context: CreatorStudioContextV1, query: ScaenaProductionPageQuery): Promise<ScaenaProductionPageResult> {
    // cursor 校验先于任何 owner 调用：坏输入零网络。
    if (query.view !== 'portfolio' && query.view !== 'reviews' && query.cursor !== undefined) return { status: 'rejected', reason: 'invalid_input' }
    if ((query.view === 'portfolio' || query.view === 'reviews') && parseCursor(query.view, query.cursor) === undefined) return { status: 'rejected', reason: 'invalid_input' }
    const outcome = await readEnvelope(this.invoke, this.cwd, query.view)
    if (outcome.kind === 'unavailable') return { status: 'rejected', reason: 'unavailable' }
    if (outcome.kind === 'contract_mismatch') return { status: 'unknown', reason: 'contract_mismatch' }
    const envelope = outcome.envelope
    if (envelope.error !== undefined) return envelopeRejected(envelope)

    if (query.view === 'portfolio') {
      const offset = parseCursor('portfolio', query.cursor)
      if (offset === undefined) return { status: 'rejected', reason: 'invalid_input' }
      const projection = scaenaPortfolioProjectionSchema.safeParse(envelope.data)
      if (!projection.success) return { status: 'unknown', reason: 'contract_mismatch' }
      const value = projection.data
      if (value.status === 'empty') return { status: 'empty', view: 'portfolio', reason: 'owner_reported_no_projects' }
      const projects = value.projects ?? []
      if (projects.length === 0) return { status: 'empty', view: 'portfolio', reason: 'owner_reported_no_projects' }
      const page = projects.slice(offset, offset + PAGE_SIZE)
      const nextOffset = offset + page.length
      return {
        status: 'ready', view: 'portfolio',
        // owner_availability 声明任一 owner 不可用/断连 → 整页标 stale（partial）。
        freshness: projects.some(project => Object.values(project.owner_availability ?? {}).some(state => state === 'unavailable' || state === 'disconnected')) ? 'stale' : 'fresh',
        ...(value.generated_at === undefined ? {} : { generatedAt: value.generated_at }),
        projects: page.map(project => ({
          projectRef: project.project_ref, title: project.title, phase: project.phase, readiness: project.readiness,
          blockerCount: project.blocker_count, pendingReviewCount: project.pending_review_count,
          ownerAvailability: Object.entries(project.owner_availability ?? {}).map(([owner, state]) => ({ owner, state })),
          ...(project.package_readiness === undefined ? {} : { packageReadiness: project.package_readiness }),
          ...(project.next_action?.id === undefined ? {} : { nextActionId: project.next_action.id }),
          evidenceRefs: project.evidence_refs ?? [],
        })),
        ...(nextOffset < projects.length ? { nextCursor: pageCursor('portfolio', nextOffset) } : {}),
      }
    }

    if (query.view === 'cockpit') {
      const projection = scaenaCockpitProjectionSchema.safeParse(envelope.data)
      if (!projection.success) return { status: 'unknown', reason: 'contract_mismatch' }
      const value = projection.data
      if (value.project_ref.length === 0) return { status: 'unknown', reason: 'contract_mismatch' }
      return {
        status: 'ready', view: 'cockpit',
        freshness: value.status === 'disconnected' || value.status === 'partial' ? 'stale' : 'fresh',
        ...(value.generated_at === undefined ? {} : { generatedAt: value.generated_at }),
        // 固定六阶段按 owner 顺序呈现；缺席键按 not_started（owner 词表内）。
        stages: SCAENA_PRODUCTION_STAGES.map(id => {
          const stage = value.stages[id]
          return { id, status: stage?.status ?? 'not_started', blockerCount: stage?.blocker_count ?? 0,
            pendingReviewCount: stage?.pending_review_count ?? 0, primaryRefs: stage?.primary_refs ?? [] }
        }),
      }
    }

    if (query.view === 'reviews') {
      const offset = parseCursor('reviews', query.cursor)
      if (offset === undefined) return { status: 'rejected', reason: 'invalid_input' }
      const projection = scaenaReviewQueueProjectionSchema.safeParse(envelope.data)
      if (!projection.success) return { status: 'unknown', reason: 'contract_mismatch' }
      const items = projection.data.items ?? []
      if (items.length === 0) return { status: 'empty', view: 'reviews', reason: 'owner_reported_no_reviews' }
      const page = items.slice(offset, offset + PAGE_SIZE)
      const nextOffset = offset + page.length
      return {
        status: 'ready', view: 'reviews', freshness: 'fresh',
        ...(projection.data.generated_at === undefined ? {} : { generatedAt: projection.data.generated_at }),
        reviews: page.map(item => ({
          reviewRef: item.review_ref, owner: item.owner, kind: item.kind, status: item.status,
          ...(item.risk === undefined ? {} : { risk: item.risk }),
          ...(item.expected_version === undefined ? {} : { expectedVersion: item.expected_version }),
          allowedActionIds: (item.allowed_actions ?? []).map(action => action.id),
        })),
        ...(nextOffset < items.length ? { nextCursor: pageCursor('reviews', nextOffset) } : {}),
      }
    }

    const projection = scaenaEvidenceExportProjectionSchema.safeParse(envelope.data)
    if (!projection.success) return { status: 'unknown', reason: 'contract_mismatch' }
    const value = projection.data
    return {
      status: 'ready', view: 'evidence-export',
      // readiness_status 非 ready 即视为有缺口（stale），blockers 原样透出。
      freshness: value.readiness_status === 'ready' ? 'fresh' : 'stale',
      ...(value.generated_at === undefined ? {} : { generatedAt: value.generated_at }),
      delivery: {
        readinessStatus: value.readiness_status, blockingReasons: value.blocking_reasons ?? [],
        runRefs: value.run_refs ?? [], receiptRefs: value.receipt_refs ?? [],
        packageRefs: value.package_refs ?? [], artifactRefs: value.artifact_refs ?? [],
      },
    }
  }
}
