/**
 * Eikona owner 合同的 TypeScript 侧移植（与 cli/eikona/internal/workspaceprojection/pane.go
 * 及 internal/modelcanonical 对齐）。
 *
 * 不变量（对应 dsh-eikona-pane spec）：
 * 1. snapshot 只投影 gallery/run 的脱敏摘要（opaque ref、title、category、
 *    lifecycle state、canonical model）；不做第二个 image store，不泄漏
 *    path/token/raw prompt/provider payload。
 * 2. 负向状态只允许 owner 指定取值：gap/expired_cursor → reconcile_required（stale），
 *    permission_denied / contract_mismatch / offline 各归其位；客户端不得轮询，
 *    恢复只能靠重读权威 snapshot。
 * 3. mutation 全部 gated：generate.preview / review.accept / review.reject 只以
 *    server-authored descriptor 提交，结论只认 owner receipt；unknown/timeout
 *    进 reconcile，绝不乐观 accept。默认模型 canonical 为 openai/gpt-5.4-image-2，
 *    legacy 别名只在入射点归一化（design 决策 3）。
 * 4. export/handoff 只带 owner/ref/version（eikonaCardArtifact）。
 */

import {
  PANE_ACTION_DESCRIPTOR_SCHEMA,
  PANE_ARTIFACT_SCHEMA,
  PANE_EVENT_SCHEMA,
  type ArtifactRefV1,
  type PaneContextV1,
  type PaneStatus,
} from '@yeisme/dsh-pane-protocol'
import { EIKONA_DEFAULT_MODEL } from './owners.js'
import type { DomainActionV1 } from './snapshot.js'
import type { DomainOwnerSnapshotRead } from './owner-source.js'

export const EIKONA_STREAM = 'domain.eikona'
export const EIKONA_NEGATIVE_KINDS = ['gap', 'expired_cursor', 'permission_denied', 'contract_mismatch', 'offline'] as const
export type EikonaNegativeKind = (typeof EIKONA_NEGATIVE_KINDS)[number]

/** 与 pane.go PaneDefaultModel / modelcanonical.CanonicalModelRef 同源。 */
export const EIKONA_PANE_DEFAULT_MODEL = EIKONA_DEFAULT_MODEL

/** 只在入射点接受的 legacy 别名（modelcanonical 的兼容形态）。 */
const EIKONA_MODEL_ALIASES: Readonly<Record<string, string>> = {
  'gpt-5.4-image-2': EIKONA_PANE_DEFAULT_MODEL,
  'gpt-image-2': EIKONA_PANE_DEFAULT_MODEL,
}

/**
 * 模型 ref 入射点归一化：legacy 别名折到 canonical；其余值原样交给 owner
 * 校验——DSH 侧不做第二套模型 schema（design 决策 3：aliases normalize at
 * ingress only）。
 */
export function normalizeEikonaModelRef(value: string): string {
  return EIKONA_MODEL_ALIASES[value.trim().toLowerCase()] ?? value
}

/** owner gallery/board 投影里的一张脱敏卡片（BoardCard 的脱敏子集）。 */
export interface EikonaCardLike {
  readonly ref: string
  readonly title: string
  readonly category?: string
  readonly lifecycleState?: string
  readonly revision?: string
}

export interface EikonaBoardLike {
  readonly cards: readonly EikonaCardLike[]
  readonly freshness: 'current' | 'stale' | 'expired' | 'unknown'
  /** owner 报告的修复原因；非空即 reconcile_required。 */
  readonly repairReason?: string
  readonly observedAt?: string
}

/** 与 pane.go unsafeRef 同源：空白、绝对路径/URL 形状、凭据形状一律剔除。 */
function eikonaUnsafeRef(id: string): boolean {
  const value = id.trim()
  if (value === '') return true
  if (value.includes('/') && (value.startsWith('/') || value.includes(':\\') || value.includes('://'))) return true
  const lower = value.toLowerCase()
  return lower.includes('rawprompt') || lower.includes('token') || lower.includes('authorization')
}

/** 与 pane.go paneStatus 同源：repair 优先于 freshness 分级。 */
function eikonaPaneStatus(freshness: EikonaBoardLike['freshness'], repairReason: string | undefined): PaneStatus {
  if (repairReason !== undefined && repairReason !== '') return 'reconcile_required'
  switch (freshness) {
    case 'current': return 'ready'
    case 'stale': return 'stale'
    case 'expired':
    case 'unknown': return 'offline'
    default: return 'unknown'
  }
}

function eikonaPaneFreshness(freshness: EikonaBoardLike['freshness']): 'fresh' | 'stale' | 'unknown' {
  switch (freshness) {
    case 'current': return 'fresh'
    case 'stale': return 'stale'
    default: return 'unknown'
  }
}

function envelope(payload: unknown, status: PaneStatus, freshness: string, context: PaneContextV1, observedAt?: string): unknown {
  return {
    schema: PANE_EVENT_SCHEMA,
    stream: EIKONA_STREAM,
    cursor: 'c-1',
    sequence: -1,
    context,
    occurredAt: observedAt ?? '2026-08-21T00:00:00Z',
    observedAt: observedAt ?? '2026-08-21T00:00:00Z',
    freshness,
    status,
    op: 'snapshot',
    payload,
  }
}

/**
 * 对应 pane.go AssemblePaneSnapshot + PaneGatedActions：
 * gallery 卡片摊平为 entities（value 内嵌 canonical model_ref）；
 * gated actions 固定为 generate.preview / review.accept / review.reject。
 */
export function eikonaSnapshotRead(board: EikonaBoardLike, context: PaneContextV1): DomainOwnerSnapshotRead {
  const entities = board.cards
    .filter(card => !eikonaUnsafeRef(card.ref))
    .map(card => ({
      ref: card.ref,
      version: 1,
      value: {
        title: card.title,
        kind: card.category ?? 'image',
        status: card.lifecycleState ?? 'unknown',
        model_ref: EIKONA_PANE_DEFAULT_MODEL,
      } as Record<string, unknown>,
    }))
  const actions: readonly DomainActionV1[] = [
    { id: 'generate.preview', gated: true },
    { id: 'review.accept', gated: true },
    { id: 'review.reject', gated: true },
  ]
  return {
    snapshot: envelope(
      { entities, timeline: [], receipts: [] },
      eikonaPaneStatus(board.freshness, board.repairReason),
      eikonaPaneFreshness(board.freshness),
      context,
      board.observedAt,
    ),
    actions,
  }
}

/** 对应 pane.go AssemblePaneNegative：owner 恢复态只允许指定取值。 */
export function eikonaNegativeRead(kind: EikonaNegativeKind, context: PaneContextV1): DomainOwnerSnapshotRead {
  let status: PaneStatus
  let freshness: string
  switch (kind) {
    case 'gap':
    case 'expired_cursor': status = 'reconcile_required'; freshness = 'stale'; break
    case 'permission_denied': status = 'permission_denied'; freshness = 'unknown'; break
    case 'contract_mismatch': status = 'contract_mismatch'; freshness = 'unknown'; break
    case 'offline': status = 'offline'; freshness = 'unknown'; break
  }
  return {
    snapshot: envelope({ entities: [], timeline: [], receipts: [] }, status, freshness, context),
    actions: [],
  }
}

/** 对应 pane.go PaneArtifactFromCard：export/handoff 只带 owner/ref/version。 */
export function eikonaCardArtifact(card: EikonaCardLike): ArtifactRefV1 {
  if (eikonaUnsafeRef(card.ref)) throw new TypeError('eikona artifact ref is unsafe')
  return {
    schema: PANE_ARTIFACT_SCHEMA,
    owner: 'eikona',
    kind: 'image',
    ref: card.ref,
    version: card.revision !== undefined && card.revision !== '' ? card.revision : '1',
    mediaType: 'image/png',
    title: card.title,
    evidenceRefs: [],
    capabilities: ['open', 'compare', 'handoff', 'attach_context'],
  }
}

/** owner 已给出的 action 预览（安全摘要 + 版本门 + 可选 cost/model）。 */
export interface EikonaActionPreviewLike {
  readonly summary: string
  /** owner 侧版本门：descriptor 期望的 revision。 */
  readonly expectedRevision: string
  /** owner 归一化前的模型 ref（入射点统一折 canonical）。 */
  readonly modelRef?: string
  /** owner 提供的 cost 预览；缺省则调用方可用 requirePreviewFields 强制可见失败。 */
  readonly cost?: { readonly currency: string; readonly amount: number; readonly estimate: boolean }
}

/** Eikona mutation 的唯一入口；预览与决策都由 owner 返回。 */
export interface EikonaActionOwner {
  /** 返回 undefined 表示 owner 未对该 target 发布该 action。 */
  previewArtifact(actionId: string, targetRef: string): EikonaActionPreviewLike | undefined
  /** 只把已验证的 PaneActionRequestV1 交给 owner；结论以 owner receipt 为准。 */
  submit(request: unknown): Promise<unknown>
}

const EIKONA_ACTION_IDS: ReadonlySet<string> = new Set(['generate.preview', 'review.accept', 'review.reject'])

/**
 * Eikona 的 DomainActionOwnerChannel 实现：descriptor 由本侧按 owner 合同组装
 * （server-authored），submit 原样转发。generate 只接受 owner-held prompt 的
 * opaque ref（prompt_ref）与 canonical 模型选择——raw prompt 永不经 Pane。
 */
export function createEikonaActionChannel(owner: EikonaActionOwner) {
  return {
    async preview(input: { readonly actionId: string; readonly targetRef?: string }): Promise<unknown> {
      if (!EIKONA_ACTION_IDS.has(input.actionId)) {
        return { negative: 'not_available', reason: 'owner did not publish this action' }
      }
      const targetRef = input.targetRef ?? ''
      const preview = owner.previewArtifact(input.actionId, targetRef)
      if (preview === undefined) {
        return { negative: 'not_available', reason: 'owner did not publish this action for target' }
      }
      const canonicalModel = normalizeEikonaModelRef(preview.modelRef ?? EIKONA_PANE_DEFAULT_MODEL)
      return {
        schema: PANE_ACTION_DESCRIPTOR_SCHEMA,
        descriptorRef: `descriptor:${input.actionId}:${targetRef}`,
        owner: 'eikona',
        actionId: input.actionId,
        label: input.actionId === 'generate.preview' ? 'Generate preview' : input.actionId === 'review.accept' ? 'Accept candidate' : 'Reject candidate',
        targetRef,
        targetVersion: preview.expectedRevision,
        context: { workspaceRef: 'workspace:eikona', revision: preview.expectedRevision },
        risk: input.actionId === 'generate.preview' ? 'medium' : 'high',
        confirmation: 'approval',
        expiresAt: '2999-01-01T00:00:00.000Z',
        preview: {
          summary: input.actionId === 'generate.preview'
            ? `${preview.summary} Model ${canonicalModel}.`
            : preview.summary,
          ...(preview.cost === undefined ? {} : { cost: preview.cost }),
        },
        fields: input.actionId === 'generate.preview'
          ? [
              { key: 'prompt_ref', label: 'Owner-held prompt ref', kind: 'text', required: true, placeholder: 'prompt:owner-held-1' },
              { key: 'model_ref', label: 'Image model', kind: 'select', required: false, options: [{ value: canonicalModel, label: 'Default image model' }] },
            ]
          : [],
      }
    },
    async submit(request: unknown): Promise<unknown> {
      return owner.submit(request)
    },
  }
}
