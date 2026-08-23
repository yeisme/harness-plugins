/**
 * Auctra owner 合同的 TypeScript 侧移植（与 cli/auctra/internal/app/pane.go 对齐）。
 *
 * 不变量（对应 dsh-auctra-pane spec）：
 * 1. snapshot 只投影 review/unit 的脱敏摘要（reviews 优先，无安全 review 才回退
 *    structure units——与 AssemblePaneSnapshot 逐字对齐）；canonical 正文、
 *    raw prompt、凭据永不进入 payload（auctraPaneUnsafe 与 owner paneUnsafe 同源）。
 * 2. Agent candidate 只产生 pending review item；accept/partial 只经 owner
 *    review action + receipt；timeout 结论只有 unknown（InterpretPaneTimeout），
 *    绝不折算成 accept，也绝不提升 canonical text。
 * 3. version/export：export.unit 只在 owner pulse 声明存在 export-ready 单元时
 *    发布（发布条件完全来自 owner pulse 数据，DSH 不发明导出事实）；
 *    descriptor 携带 owner 版本门，receipt 可携带 outputArtifacts；
 *    跨 Pane handoff 只带 owner/ref/version（auctraUnitArtifact）。
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

export const AUCTRA_STREAM = 'domain.auctra'
export const AUCTRA_NEGATIVE_KINDS = ['stale_revision', 'permission_denied', 'offline', 'timeout'] as const
export type AuctraNegativeKind = (typeof AUCTRA_NEGATIVE_KINDS)[number]

/** 与 pane.go InterpretPaneTimeout 同源：超时的唯一诚实结论是 unknown。 */
export const AUCTRA_TIMEOUT_INTERPRETATION: PaneStatus = 'unknown'

/** owner 审阅队列投影里的一条 pending review（AuthoringWorkspaceReview 的脱敏子集）。 */
export interface AuctraReviewItemLike {
  readonly ref: string
  readonly unitRef?: string
  readonly title?: string
  readonly status: string
}

/** owner structure 投影里的一个 text unit（AuthoringWorkspaceUnit 的脱敏子集）。 */
export interface AuctraUnitLike {
  readonly ref: string
  readonly kind?: string
  readonly title: string
  readonly state: string
  readonly revision?: string
  readonly version?: number
}

/** owner pulse（AuthoringWorkspacePulse 的脱敏子集）。 */
export interface AuctraPulseLike {
  readonly blocked?: number
  readonly drafting?: number
  readonly reviewPending?: number
  readonly staleVariants?: number
  readonly exportReady?: number
}

export interface AuctraWorkspaceLike {
  readonly reviews?: readonly AuctraReviewItemLike[]
  readonly structure?: readonly AuctraUnitLike[]
  readonly pulse?: AuctraPulseLike
}

/** 与 pane.go paneUnsafe 同源的脱敏判定：空白、凭据形状、绝对路径一律剔除。 */
export function auctraPaneUnsafe(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '') return true
  const lower = trimmed.toLowerCase()
  if (lower.includes('rawprompt') || lower.includes('token') || lower.includes('authorization')) return true
  if (trimmed.startsWith('/') || trimmed.includes(':\\')) return true
  return false
}

/** 与 pane.go paneStatus 同源：blocked > review_pending > drafting > ready。 */
function auctraPaneStatus(pulse: AuctraPulseLike): PaneStatus {
  if ((pulse.blocked ?? 0) > 0) return 'attention_required'
  if ((pulse.reviewPending ?? 0) > 0) return 'approval_required'
  if ((pulse.drafting ?? 0) > 0) return 'running'
  return 'ready'
}

/** 与 pane.go compactTitle 同源：去控制字符、封顶 160、去首尾空白。 */
function compactTitle(value: string): string {
  let out = ''
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) continue
    out += char
    if (out.length >= 160) break
  }
  return out.trim()
}

function envelope(payload: unknown, status: PaneStatus, freshness: string, context: PaneContextV1): unknown {
  return {
    schema: PANE_EVENT_SCHEMA,
    stream: AUCTRA_STREAM,
    cursor: 'c-1',
    sequence: -1,
    context,
    occurredAt: '2026-08-21T00:00:00Z',
    observedAt: '2026-08-21T00:00:00Z',
    freshness,
    status,
    op: 'snapshot',
    payload,
  }
}

/**
 * 对应 pane.go AssemblePaneSnapshot + PaneGatedActions：
 * 审阅队列优先投影；staleVariants>0 → stale；gated actions 只发布
 * candidate.create / review.accept / review.partial（+ export-ready 时的 export.unit）。
 */
export function auctraSnapshotRead(workspace: AuctraWorkspaceLike, context: PaneContextV1): DomainOwnerSnapshotRead {
  const entities: { ref: string; version: number; value: Record<string, unknown> }[] = []
  for (const item of workspace.reviews ?? []) {
    if (auctraPaneUnsafe(item.ref)) continue
    entities.push({
      ref: item.ref,
      version: 1,
      value: { title: compactTitle(item.title ?? item.ref), kind: 'review', status: item.status },
    })
  }
  if (entities.length === 0) {
    for (const unit of workspace.structure ?? []) {
      if (auctraPaneUnsafe(unit.ref)) continue
      entities.push({
        ref: unit.ref,
        version: unit.version ?? 0,
        value: { title: compactTitle(unit.title), kind: unit.kind ?? '', status: unit.state },
      })
    }
  }
  const pulse = workspace.pulse ?? {}
  const freshness = (pulse.staleVariants ?? 0) > 0 ? 'stale' : 'fresh'
  const actions: readonly DomainActionV1[] = [
    { id: 'candidate.create', gated: true },
    { id: 'review.accept', gated: true },
    { id: 'review.partial', gated: true },
    // export 门：仅当 owner pulse 声明存在 export-ready 单元时发布（不发明事实）。
    ...((pulse.exportReady ?? 0) > 0 ? [{ id: 'export.unit', gated: true }] : []),
  ]
  return {
    snapshot: envelope({ entities, timeline: [], receipts: [] }, auctraPaneStatus(pulse), freshness, context),
    actions,
  }
}

/** 对应 pane.go AssemblePaneNegative：owner 恢复态只允许指定取值，timeout 永不 accept。 */
export function auctraNegativeRead(kind: AuctraNegativeKind, context: PaneContextV1): DomainOwnerSnapshotRead {
  let status: PaneStatus
  let freshness: string
  switch (kind) {
    case 'stale_revision': status = 'stale'; freshness = 'stale'; break
    case 'permission_denied': status = 'permission_denied'; freshness = 'unknown'; break
    case 'offline': status = 'offline'; freshness = 'unknown'; break
    case 'timeout': status = AUCTRA_TIMEOUT_INTERPRETATION; freshness = 'unknown'; break
  }
  return {
    snapshot: envelope({ entities: [], timeline: [], receipts: [] }, status, freshness, context),
    actions: [],
  }
}

/** 对应 pane.go PaneArtifactFromUnit：export/handoff 只带 owner/ref/version，不带正文。 */
export function auctraUnitArtifact(unit: AuctraUnitLike): ArtifactRefV1 {
  if (auctraPaneUnsafe(unit.ref)) throw new TypeError('auctra unit ref is unsafe')
  const version = unit.revision !== undefined && unit.revision !== '' ? unit.revision : String(unit.version ?? 1)
  return {
    schema: PANE_ARTIFACT_SCHEMA,
    owner: 'auctra',
    kind: unit.kind !== undefined && unit.kind !== '' ? unit.kind : 'unit',
    ref: unit.ref,
    version,
    mediaType: 'text/plain',
    title: compactTitle(unit.title),
    evidenceRefs: [],
    capabilities: ['open', 'handoff', 'compare'],
  }
}

/** owner 已给出的 action 预览（diff 摘要等安全摘要 + 版本门）。 */
export interface AuctraActionPreviewLike {
  /** owner 摘要：candidate/canonical diff 等（不含正文全量）。 */
  readonly summary: string
  /** owner 侧版本门：descriptor 期望的 revision。 */
  readonly expectedRevision: string
}

/** Auctra mutation 的唯一入口；预览与决策都由 owner 返回。 */
export interface AuctraActionOwner {
  /** 返回 undefined 表示 owner 未对该 target 发布该 action。 */
  previewTarget(actionId: string, targetRef: string): AuctraActionPreviewLike | undefined
  /** 只把已验证的 PaneActionRequestV1 交给 owner；结论以 owner receipt 为准。 */
  submit(request: unknown): Promise<unknown>
}

const AUCTRA_ACTION_IDS: ReadonlySet<string> = new Set(['candidate.create', 'review.accept', 'review.partial', 'export.unit'])

/**
 * Auctra 的 DomainActionOwnerChannel 实现：descriptor 由本侧按 owner 合同组装
 * （server-authored），submit 原样转发。candidate 正文永不经 Pane：
 * candidate.create 只声明 unit_ref，内容由 owner 从自己的 sources 组装；
 * review.accept / review.partial / export.unit 不携带任何文本字段。
 */
export function createAuctraActionChannel(owner: AuctraActionOwner) {
  return {
    async preview(input: { readonly actionId: string; readonly targetRef?: string }): Promise<unknown> {
      if (!AUCTRA_ACTION_IDS.has(input.actionId)) {
        return { negative: 'not_available', reason: 'owner did not publish this action' }
      }
      const targetRef = input.targetRef ?? ''
      const preview = owner.previewTarget(input.actionId, targetRef)
      if (preview === undefined) {
        return { negative: 'not_available', reason: 'owner did not publish this action for target' }
      }
      const labels: Record<string, string> = {
        'candidate.create': 'Create candidate',
        'review.accept': 'Accept review',
        'review.partial': 'Partial accept',
        'export.unit': 'Export unit',
      }
      // accept/partial 会改写 canonical text → high 风险显式审批；
      // create 只产生 pending review item → medium；export 产出 artifact → low。
      const risk: 'low' | 'medium' | 'high' = input.actionId === 'review.accept' || input.actionId === 'review.partial'
        ? 'high'
        : input.actionId === 'candidate.create' ? 'medium' : 'low'
      return {
        schema: PANE_ACTION_DESCRIPTOR_SCHEMA,
        descriptorRef: `descriptor:${input.actionId}:${targetRef}`,
        owner: 'auctra',
        actionId: input.actionId,
        label: labels[input.actionId] ?? input.actionId,
        targetRef,
        targetVersion: preview.expectedRevision,
        context: { workspaceRef: 'workspace:auctra', revision: preview.expectedRevision },
        risk,
        confirmation: 'approval',
        expiresAt: '2999-01-01T00:00:00.000Z',
        preview: { summary: preview.summary },
        fields: input.actionId === 'candidate.create'
          ? [{ key: 'unit_ref', label: 'Target unit', kind: 'text', required: true, placeholder: 'unit:scene:1' }]
          : [],
      }
    },
    async submit(request: unknown): Promise<unknown> {
      return owner.submit(request)
    },
  }
}
