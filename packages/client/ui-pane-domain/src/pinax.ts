/**
 * Pinax owner 合同的 TypeScript 侧移植（与 cli/pinax/internal/app/pane.go 对齐）。
 *
 * 不变量：vault/note/backlink/graph/history 的事实只来自 owner note.list 投影；
 * ref 走 owner 的封闭 allowlist（无 "/" 无 ":"，非凭据形状）；手写 metadata
 * fail closed——所有结构化 mutation 必须经 Pinax CLI/service。
 */

import {
  PANE_ACTION_DESCRIPTOR_SCHEMA,
  PANE_EVENT_SCHEMA,
  type PaneContextV1,
  type PaneStatus,
} from '@yeisme/dsh-pane-protocol'
import type { DomainActionV1 } from './snapshot.js'
import type { DomainOwnerSnapshotRead } from './owner-source.js'

export const PINAX_STREAM = 'domain.pinax'
export const PINAX_NEGATIVE_KINDS = ['offline', 'permission_denied'] as const
export type PinaxNegativeKind = (typeof PINAX_NEGATIVE_KINDS)[number]

/** owner note.list 投影中的一条脱敏 note。 */
export interface PinaxNoteLike {
  readonly id: string
  readonly title: string
  readonly kind?: string
  readonly status?: string
  readonly tags?: readonly string[]
}

/** owner note.list 投影（脱敏后）。 */
export interface PinaxNotesProjectionLike {
  readonly notes: readonly PinaxNoteLike[]
  readonly status?: string
}

/** 与 pane.go paneRefPattern 同源的封闭 allowlist。 */
const PINAX_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const PINAX_REF_DENY = ['token', 'authorization', 'cookie', 'secret', 'password', 'api_key', 'bearer']

export function pinaxPaneUnsafe(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '') return true
  if (!PINAX_REF_PATTERN.test(trimmed)) return true
  const lower = trimmed.toLowerCase()
  return PINAX_REF_DENY.some(banned => lower.includes(banned))
}

function envelope(payload: unknown, status: PaneStatus, freshness: string, context: PaneContextV1): unknown {
  return {
    schema: PANE_EVENT_SCHEMA,
    stream: PINAX_STREAM,
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

/** 对应 pane.go AssemblePaneSnapshot：失败投影永远不是空 ready pane。 */
export function pinaxSnapshotRead(projection: PinaxNotesProjectionLike, context: PaneContextV1): DomainOwnerSnapshotRead {
  const entities = projection.notes
    .filter(note => !pinaxPaneUnsafe(note.id))
    .map(note => ({
      ref: note.id,
      version: 1,
      value: {
        title: note.title,
        kind: note.kind ?? 'note',
        status: note.status ?? 'active',
        tags: note.tags ?? [],
      },
    }))
  let status: PaneStatus = 'ready'
  if (projection.status === 'failed' || projection.status === 'error' || projection.status === 'offline') status = 'offline'
  if (projection.status === 'permission_denied') status = 'permission_denied'
  const actions: readonly DomainActionV1[] = [
    { id: 'inbox.capture', gated: true },
    { id: 'sync.run', gated: true },
  ]
  return {
    snapshot: envelope({ entities, timeline: [], receipts: [] }, status, 'fresh', context),
    actions,
  }
}

/** 对应 pane.go AssemblePaneNegative。 */
export function pinaxNegativeRead(kind: PinaxNegativeKind, context: PaneContextV1): DomainOwnerSnapshotRead {
  const status: PaneStatus = kind === 'offline' ? 'offline' : 'permission_denied'
  return {
    snapshot: envelope({ entities: [], timeline: [], receipts: [] }, status, 'unknown', context),
    actions: [],
  }
}

/** 对应 pane.go RejectHandwrittenMetadata：fail closed，绝不吞下 blob。 */
export function pinaxHandwrittenMetadataRead(context: PaneContextV1): DomainOwnerSnapshotRead {
  return {
    snapshot: envelope({ entities: [], timeline: [], receipts: [] }, 'contract_mismatch', 'stale', context),
    actions: [],
  }
}

/** Pinax mutation 的唯一入口；preview/submit 全部由 owner 侧合同给出。 */
export interface PinaxActionOwner {
  submit(request: unknown): Promise<unknown>
}

const HANDWRITTEN_METADATA_KEYS = new Set(['metadata', 'frontmatter', 'schema_version', 'yaml', 'rawmetadata'])

/** 手写 metadata 检测：这些键永远不进入 Pinax service。 */
function carriesHandwrittenMetadata(values: Readonly<Record<string, unknown>> | undefined): boolean {
  if (values === undefined) return false
  return Object.keys(values).some(key => HANDWRITTEN_METADATA_KEYS.has(key.toLowerCase()))
}

/** Pinax 的 DomainActionOwnerChannel：capture/sync 走 owner command 摘要。 */
export function createPinaxActionChannel(owner: PinaxActionOwner) {
  return {
    async preview(input: { readonly actionId: string; readonly targetRef?: string }): Promise<unknown> {
      if (input.actionId !== 'inbox.capture' && input.actionId !== 'sync.run') {
        return { negative: 'not_available', reason: 'owner did not publish this action' }
      }
      const ownerCommand = input.actionId === 'inbox.capture' ? 'pinax inbox capture' : 'pinax sync run'
      return {
        schema: PANE_ACTION_DESCRIPTOR_SCHEMA,
        descriptorRef: `descriptor:${input.actionId}:${input.targetRef ?? 'vault'}`,
        owner: 'pinax',
        actionId: input.actionId,
        label: input.actionId === 'inbox.capture' ? 'Capture inbox' : 'Run sync',
        targetRef: input.targetRef ?? 'vault:current',
        targetVersion: '1',
        context: { workspaceRef: 'workspace:pinax', revision: '1' },
        risk: 'medium',
        confirmation: 'approval',
        expiresAt: '2999-01-01T00:00:00.000Z',
        preview: { summary: `Structured mutation must run through ${ownerCommand}.` },
        fields: [],
      }
    },
    async submit(request: unknown): Promise<unknown> {
      // 手写 metadata fail closed：在触达 owner 之前拒绝。
      const values = (request as { values?: Readonly<Record<string, unknown>> } | undefined)?.values
      if (carriesHandwrittenMetadata(values)) {
        return { negative: 'not_available', reason: 'handwritten_metadata_rejected' }
      }
      return owner.submit(request)
    },
  }
}
