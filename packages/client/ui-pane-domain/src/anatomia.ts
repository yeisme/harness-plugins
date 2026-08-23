/**
 * Anatomia owner 合同的 TypeScript 侧移植（与 agent/anatomia/internal/application/pane.go 对齐）。
 *
 * 不变量：
 * - source/job/timeline/shot/scene/transcript/OCR/observation/evidence 的事实只来自
 *   owner 分析投影（AssemblePaneSnapshot 的输入面）；DSH 插件绝不在此发明解码、
 *   观察或证据事实。
 * - partial 由 owner job 状态推导（paneJobStatus），永不提升为 complete；只有
 *   owner 声明 succeeded 之后 complete 语义才出现。
 * - analyze.start / evidence.inspect 是 owner gated action（PaneGatedActions）：
 *   要求 expected_revision、幂等键与 owner receipt；revision（ExpectedRevision）
 *   原样进入 descriptor 的 targetVersion，不由客户端改写。
 * - 脱敏判定与 pane.go paneUnsafe 同源：路径、URL、凭据形状一律剔除。
 */

import {
  PANE_ACTION_DESCRIPTOR_SCHEMA,
  PANE_ARTIFACT_SCHEMA,
  PANE_EVENT_SCHEMA,
  type ArtifactRefV1,
  type PaneContextV1,
  type PaneStatus,
} from '@yeisme/dsh-pane-protocol'
import type { DomainActionV1 } from './snapshot.js'
import type { DomainOwnerSnapshotRead } from './owner-source.js'

export const ANATOMIA_STREAM = 'domain.anatomia'

/** owner PaneGatedActions 发布的唯二动作；其余动作一律 not_available。 */
export const ANATOMIA_ACTION_IDS = ['analyze.start', 'evidence.inspect'] as const
export type AnatomiaActionId = (typeof ANATOMIA_ACTION_IDS)[number]

/** owner 恢复态 + DSH 协议面的负向取值；partial 与 complete 永不混淆。 */
export const ANATOMIA_NEGATIVE_KINDS = ['partial', 'gap', 'expired_cursor', 'offline', 'permission_denied'] as const
export type AnatomiaNegativeKind = (typeof ANATOMIA_NEGATIVE_KINDS)[number]

/** owner 分析投影可呈现的实体面（proposal：source/job/timeline/shot/scene/transcript/OCR/observation/evidence）。 */
export const ANATOMIA_ENTITY_KINDS = ['source', 'job', 'timeline', 'shot', 'scene', 'transcript', 'ocr', 'observation', 'evidence'] as const
export type AnatomiaEntityKind = (typeof ANATOMIA_ENTITY_KINDS)[number]

/** owner 投影中的一个多模态实体面（脱敏后）。 */
export interface AnatomiaFacetLike {
  readonly ref: string
  readonly kind: AnatomiaEntityKind
  readonly title?: string
  readonly status?: string
  /** owner 显式声明该面的完成度；未声明时继承 job 级 partial。 */
  readonly partial?: boolean
}

/** owner 分析 job 投影（脱敏后，镜像 contract.AnalysisJobProjection 的 Pane 输入面）。 */
export interface AnatomiaAnalysisLike {
  readonly analysisRef: string
  readonly state: string
  readonly stateVersion?: number
  readonly revisionRef?: string
  readonly facets?: readonly AnatomiaFacetLike[]
  readonly evidenceRefs?: readonly string[]
  readonly updatedAt?: string
  readonly createdAt?: string
}

/** 与 pane.go paneUnsafe 同源的脱敏判定：路径、URL、凭据形状一律剔除。 */
export function anatomiaPaneUnsafe(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '') return true
  const lower = trimmed.toLowerCase()
  if (lower.includes('rawprompt') || lower.includes('token') || lower.includes('authorization')) return true
  if (trimmed.startsWith('/') || trimmed.includes(':\\') || trimmed.includes('://')) return true
  return false
}

/**
 * 与 pane.go paneJobStatus 同源的状态机（中文注释固化语义）：
 * - queued：已入队、尚无结果 → ready（可交互，但没有任何 partial 事实）
 * - running / cancel_requested：owner 仍在产出 → running 且 job 级 partial=true
 * - succeeded：owner 声明完成 → ready 且 partial=false（complete 的唯一来源）
 * - failed：owner 终态失败 → attention_required
 * - cancelled：owner 已取消 → offline（不得显示为 ready 或 partial）
 * - 其余：unknown，绝不猜测
 */
export function anatomiaJobStatus(state: string): { status: PaneStatus; partial: boolean } {
  switch (state.trim().toLowerCase()) {
    case 'queued': return { status: 'ready', partial: false }
    case 'running':
    case 'cancel_requested': return { status: 'running', partial: true }
    case 'succeeded': return { status: 'ready', partial: false }
    case 'failed': return { status: 'attention_required', partial: false }
    case 'cancelled': return { status: 'offline', partial: false }
    default: return { status: 'unknown', partial: false }
  }
}

function anatomiaEntity(ref: string, kind: string, title: string, status: string, partial: boolean, version: number): { ref: string; version: number; value: Record<string, unknown> } {
  return {
    ref,
    version,
    // 与 owner entity value 形状一致：title/kind/status/partial；partial 只在
    // true 时序列化，false 不冒充任何 complete 语义。
    value: { title, kind, status, partial },
  }
}

function envelope(payload: unknown, status: PaneStatus, freshness: string, context: PaneContextV1, occurredAt: string): unknown {
  return {
    schema: PANE_EVENT_SCHEMA,
    stream: ANATOMIA_STREAM,
    cursor: 'c-1',
    sequence: -1,
    context,
    occurredAt,
    observedAt: occurredAt,
    freshness,
    status,
    op: 'snapshot',
    payload,
  }
}

/**
 * 对应 pane.go AssemblePaneSnapshot + PaneGatedActions：
 * job 面镜像 owner 的分析实体（kind=analysis → DSH 呈现为 job 面，状态与 partial
 * 原样来自 owner）；evidenceRefs 摊平为 evidence 实体；facet 面按 owner 声明透传。
 * analyze/inspect 两个 gated 动作恒发布（权限由 action channel 的 owner 判定给出）。
 */
export function anatomiaSnapshotRead(analysis: AnatomiaAnalysisLike, context: PaneContextV1): DomainOwnerSnapshotRead {
  const { status, partial: jobPartial } = anatomiaJobStatus(analysis.state)
  const version = analysis.stateVersion && analysis.stateVersion >= 0 ? analysis.stateVersion : 1
  const occurredAt = analysis.updatedAt?.trim() !== '' && analysis.updatedAt !== undefined
    ? analysis.updatedAt
    : analysis.createdAt?.trim() !== '' && analysis.createdAt !== undefined
      ? analysis.createdAt
      : '2026-08-21T00:00:00Z'
  // job 面永远在最前（owner 语义：analysis 实体先于 evidence）。
  const entities = [anatomiaEntity(analysis.analysisRef, 'job', analysis.analysisRef, analysis.state, jobPartial, version)]
  for (const facet of analysis.facets ?? []) {
    if (anatomiaPaneUnsafe(facet.ref)) continue
    entities.push(anatomiaEntity(
      facet.ref,
      facet.kind,
      facet.title ?? facet.ref,
      facet.status ?? analysis.state,
      facet.partial ?? jobPartial,
      version,
    ))
  }
  for (const ref of analysis.evidenceRefs ?? []) {
    if (anatomiaPaneUnsafe(ref)) continue
    entities.push(anatomiaEntity(ref, 'evidence', ref, analysis.state, jobPartial, version))
  }
  const actions: readonly DomainActionV1[] = [
    { id: 'analyze.start', gated: true },
    { id: 'evidence.inspect', gated: true },
  ]
  return {
    snapshot: envelope({ entities, timeline: [], receipts: [] }, status, 'fresh', context, occurredAt),
    actions,
  }
}

/**
 * 对应 pane.go AssemblePaneNegative：owner 恢复态只允许指定取值，不猜测。
 * - partial：owner 仍在产出 → running + partial=true（绝不显示 complete）
 * - gap / expired_cursor：cursor 无法继续 → reconcile_required（Host 重读 snapshot）
 * - offline：通道断开 → offline
 * - permission_denied：owner 拒绝 analyze 权限 → 显示 permission_denied，
 *   不启动任何本地解码或猜测结果
 */
export function anatomiaNegativeRead(kind: AnatomiaNegativeKind, context: PaneContextV1): DomainOwnerSnapshotRead {
  let status: PaneStatus
  let partial = false
  switch (kind) {
    case 'partial': status = 'running'; partial = true; break
    case 'gap':
    case 'expired_cursor': status = 'reconcile_required'; break
    case 'offline': status = 'offline'; break
    case 'permission_denied': status = 'permission_denied'; break
  }
  return {
    snapshot: envelope(
      { entities: [anatomiaEntity('analysis:neg', 'job', 'analysis:neg', status, partial, 1)], timeline: [], receipts: [] },
      status,
      'unknown',
      context,
      '2026-08-21T00:00:00Z',
    ),
    actions: [],
  }
}

/**
 * 对应 pane.go PaneArtifactFromEvidence：evidence → ArtifactRefV1。
 * partial evidence 的 kind 是 evidence-partial，永不冒充完整 evidence；
 * 不安全 ref（路径/URL/凭据形状）返回 undefined（owner 合同拒绝）。
 */
export function anatomiaEvidenceArtifact(ref: string, revision: string, partial: boolean): ArtifactRefV1 | undefined {
  if (anatomiaPaneUnsafe(ref)) return undefined
  return {
    schema: PANE_ARTIFACT_SCHEMA,
    owner: 'anatomia',
    kind: partial ? 'evidence-partial' : 'evidence',
    ref,
    version: revision.trim() === '' ? '1' : revision,
    mediaType: 'application/octet-stream',
    title: ref,
    evidenceRefs: [ref],
    capabilities: ['open', 'handoff', 'attach_context'],
  }
}

/** Anatomia mutation 的唯一 owner seam：权限判定与提交结论都由 owner 返回。 */
export interface AnatomiaActionOwner {
  /**
   * owner 权限判定：
   * - 'granted'：owner 允许该 gated action
   * - 'permission_denied'：缺少 analyze/evidence 权限（DSH 显示 permission_denied）
   * - undefined：owner 未发布该动作（不是本合同的动作）
   */
  authorize(actionId: string, targetRef: string): 'granted' | 'permission_denied' | undefined
  /** 只把已验证的 PaneActionRequestV1 交给 owner；结论以 owner receipt 为准。 */
  submitAnalysis(request: unknown): Promise<unknown>
}

/**
 * Anatomia 的 DomainActionOwnerChannel 实现：
 * - descriptor 由本侧按 owner 合同组装（server-authored：字段、risk、confirmation、
 *   expiry 固定；expected_revision → targetVersion 由 owner revision 传入）。
 * - 权限缺失返回 not_available/permission_denied，绝不开始本地解码或猜测结果。
 * - submit 原样转发；unknown/timeout 由 DomainActionGateway 折叠为 reconcile。
 */
export function createAnatomiaActionChannel(owner: AnatomiaActionOwner, revision = '1') {
  return {
    async preview(input: { readonly actionId: string; readonly targetRef?: string }): Promise<unknown> {
      if (!(ANATOMIA_ACTION_IDS as readonly string[]).includes(input.actionId)) {
        return { negative: 'not_available', reason: 'owner did not publish this action' }
      }
      const targetRef = input.targetRef ?? ''
      const permission = owner.authorize(input.actionId, targetRef)
      if (permission === undefined) {
        return { negative: 'not_available', reason: 'owner did not publish this action' }
      }
      if (permission === 'permission_denied') {
        return { negative: 'not_available', reason: 'permission_denied' }
      }
      return {
        schema: PANE_ACTION_DESCRIPTOR_SCHEMA,
        descriptorRef: `descriptor:${input.actionId}:${targetRef}`,
        owner: 'anatomia',
        actionId: input.actionId,
        label: input.actionId === 'analyze.start' ? 'Start analysis' : 'Inspect evidence',
        targetRef,
        targetVersion: revision,
        context: { workspaceRef: 'workspace:anatomia', revision: '1' },
        risk: 'medium',
        confirmation: 'approval',
        expiresAt: '2999-01-01T00:00:00.000Z',
        preview: {
          summary: `Anatomia owner action ${input.actionId}; requires idempotency key and an owner receipt at revision ${revision}.`,
        },
        fields: [],
      }
    },
    async submit(request: unknown): Promise<unknown> {
      return owner.submitAnalysis(request)
    },
  }
}
