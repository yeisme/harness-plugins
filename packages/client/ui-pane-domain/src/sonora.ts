/**
 * Sonora owner 合同的 TypeScript 侧移植（与 cli/sonora/internal/workspace/pane.go 对齐）。
 *
 * 本模块只做合同形状映射：snapshot envelope、gated actions 与负向状态全部镜像
 * owner 语义；DSH 插件绝不在此发明音频、rights 或 cost 事实。
 */

import {
  PANE_ACTION_DESCRIPTOR_SCHEMA,
  PANE_EVENT_SCHEMA,
  type PaneContextV1,
  type PaneStatus,
} from '@yeisme/dsh-pane-protocol'
import type { DomainActionV1 } from './snapshot.js'
import type { DomainOwnerSnapshotRead } from './owner-source.js'

export const SONORA_STREAM = 'domain.sonora'
export const SONORA_NEGATIVE_KINDS = ['duplicate', 'gap', 'expired_cursor', 'offline', 'approval_required'] as const
export type SonoraNegativeKind = (typeof SONORA_NEGATIVE_KINDS)[number]

/** owner board 投影里的一张 take 卡（脱敏后）。 */
export interface SonoraTakeCardLike {
  readonly resourceRef: string
  readonly title: string
  readonly lane: string
  readonly revision?: string
}

/** owner board 投影（脱敏后）：lanes/cards 已摊平为 takes。 */
export interface SonoraBoardLike {
  readonly takes: readonly SonoraTakeCardLike[]
  readonly freshness: 'fresh' | 'stale' | 'unknown'
  readonly status?: PaneStatus
  readonly rightsPreview: boolean
  readonly costPreview: boolean
}

/** 与 pane.go paneUnsafe 同源的脱敏判定：路径、凭据形状、SSE 残片一律剔除。 */
function sonoraPaneUnsafe(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '') return true
  const lower = trimmed.toLowerCase()
  if (lower.includes('rawprompt') || lower.includes('token') || lower.includes('authorization') || lower.includes('sse')) return true
  if (trimmed.startsWith('/') || trimmed.includes(':\\')) return true
  return false
}

function envelope(payload: unknown, status: PaneStatus, freshness: string, context: PaneContextV1): unknown {
  return {
    schema: PANE_EVENT_SCHEMA,
    stream: SONORA_STREAM,
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
 * render.take / review.accept 只有在 rights 与 cost preview 同时存在时才发布。
 */
export function sonoraSnapshotRead(board: SonoraBoardLike, context: PaneContextV1): DomainOwnerSnapshotRead {
  const entities = board.takes
    .filter(take => !sonoraPaneUnsafe(take.resourceRef))
    .map(take => ({
      ref: take.resourceRef,
      version: 1,
      value: { title: take.title, kind: 'take', status: take.lane },
    }))
  const status: PaneStatus = board.status ?? (board.freshness === 'fresh' ? 'ready' : board.freshness === 'stale' ? 'stale' : 'unknown')
  const actions: readonly DomainActionV1[] = board.rightsPreview && board.costPreview
    ? [{ id: 'render.take', gated: true }, { id: 'review.accept', gated: true }]
    : []
  return {
    snapshot: envelope({ entities, timeline: [], receipts: [] }, status, board.freshness, context),
    actions,
  }
}

/** 对应 pane.go AssemblePaneNegative：owner 恢复态只允许指定取值，不猜测。 */
export function sonoraNegativeRead(kind: SonoraNegativeKind, context: PaneContextV1): DomainOwnerSnapshotRead {
  let status: PaneStatus
  let freshness: string
  switch (kind) {
    case 'duplicate': status = 'ready'; freshness = 'fresh'; break
    case 'gap':
    case 'expired_cursor': status = 'reconcile_required'; freshness = 'stale'; break
    case 'offline': status = 'offline'; freshness = 'unknown'; break
    case 'approval_required': status = 'approval_required'; freshness = 'fresh'; break
  }
  return {
    snapshot: envelope({ entities: [], timeline: [], receipts: [] }, status, freshness, context),
    actions: [],
  }
}

/** owner 已给出的 cost/rights 预览（脱敏摘要形态）。 */
export interface SonoraTakePreviewLike {
  readonly cost: { readonly currency: string; readonly amount: number; readonly estimate: boolean }
  readonly rights: { readonly status: 'clear' | 'review_required' | 'blocked' | 'unknown'; readonly summary: string }
}

/** Sonora action owner 的最小 seam：预览与决策都由 owner 返回。 */
export interface SonoraActionOwner {
  /** 返回 undefined 表示 owner 尚无 rights/cost 预览。 */
  previewTake(takeRef: string): SonoraTakePreviewLike | undefined
  /** 只把已验证的 PaneActionRequestV1 交给 owner；结论以 owner receipt 为准。 */
  submitTake(request: unknown): Promise<unknown>
}

/**
 * Sonora 的 DomainActionOwnerChannel 实现：descriptor 由本侧按 owner 合同组装
 * （server-authored：字段、risk、confirmation、expiry 全部固定），submit 原样转发。
 * 任何预览缺失都显式返回 approval_required，绝不让客户端推断可渲染。
 */
export function createSonoraActionChannel(owner: SonoraActionOwner) {
  return {
    async preview(input: { readonly actionId: string; readonly targetRef?: string }): Promise<unknown> {
      if (input.actionId !== 'render.take' && input.actionId !== 'review.accept') {
        return { negative: 'not_available', reason: 'owner did not publish this action' }
      }
      const targetRef = input.targetRef ?? ''
      const preview = owner.previewTake(targetRef)
      if (preview === undefined) {
        return { negative: 'approval_required', reason: 'rights_or_cost_preview_missing' }
      }
      return {
        schema: PANE_ACTION_DESCRIPTOR_SCHEMA,
        descriptorRef: `descriptor:${input.actionId}:${targetRef}`,
        owner: 'sonora',
        actionId: input.actionId,
        label: input.actionId === 'render.take' ? 'Render take' : 'Accept reviewed take',
        targetRef,
        targetVersion: '1',
        context: { workspaceRef: 'workspace:sonora', revision: '1' },
        risk: 'medium',
        confirmation: 'approval',
        expiresAt: '2999-01-01T00:00:00.000Z',
        preview: {
          summary: `Sonora owner preview for ${input.actionId}`,
          cost: preview.cost,
          rights: preview.rights,
        },
        fields: [],
      }
    },
    async submit(request: unknown): Promise<unknown> {
      return owner.submitTake(request)
    },
  }
}
