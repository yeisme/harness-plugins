/** Map owner-authored domain snapshots into PaneEventEnvelopeV1. */

import {
  PANE_ARTIFACT_SCHEMA,
  PANE_EVENT_SCHEMA,
  PANE_INTENT_SCHEMA,
  type ArtifactRefV1,
  type PaneContextV1,
  type PaneStatus,
} from '@yeisme/dsh-pane-protocol'
import { DOMAIN_OWNERS, EIKONA_DEFAULT_MODEL, type DomainOwner } from './owners.js'

const UNSAFE = /rawPrompt|privateArguments|providerPayload|authorization|cookie|token|\/(?:etc|home|usr|var)\//i
const SAFE_REF = /^[a-z0-9][a-z0-9._:/-]*$/i
const TIMELINE_LIMIT = 20

export interface DomainItemV1 {
  readonly ref: string
  readonly title: string
  readonly version: string
  readonly kind: string
  readonly status: string
  readonly summary?: string
  readonly partial?: boolean
  /** owner 提供的跨 Pane typed deep-link（如 Ordo task → DSH session）。 */
  readonly link?: DomainItemLinkV1
}

/** owner 授权的 typed deep-link；客户端只转发，不构造 canonical 状态。 */
export interface DomainItemLinkV1 {
  readonly kind: 'subagent.session'
  readonly ref: string
}

export interface DomainActionV1 {
  readonly id: string
  readonly gated: boolean
}

export interface DomainSnapshotV1 {
  readonly owner: DomainOwner
  readonly status: PaneStatus
  readonly freshness: 'fresh' | 'stale' | 'unknown'
  readonly items: readonly DomainItemV1[]
  readonly allowedActions: readonly DomainActionV1[]
  readonly modelRef?: string
  /** 诚实降级原因（gap/context/offline 等）；只在负向状态出现。 */
  readonly reconcileReason?: string
  /** owner push event 的有界 live 摘要（只来自 owner envelope，非本地推演）。 */
  readonly timeline?: readonly { readonly summary: string }[]
}

export function isDomainOwner(value: string): value is DomainOwner {
  return (DOMAIN_OWNERS as readonly string[]).includes(value)
}

function safeRef(value: string): boolean {
  return value.length > 0 && value.length <= 160 && SAFE_REF.test(value) && !UNSAFE.test(value)
}

function redactItem(item: DomainItemV1): DomainItemV1 | undefined {
  if (!safeRef(item.ref) || UNSAFE.test(JSON.stringify(item))) return undefined
  const link = item.link !== undefined && safeRef(item.link.ref)
    ? { kind: item.link.kind, ref: item.link.ref } satisfies DomainItemLinkV1
    : undefined
  return {
    ref: item.ref,
    title: item.title.slice(0, 160),
    version: item.version.slice(0, 64),
    kind: item.kind.slice(0, 64),
    status: item.status.slice(0, 64),
    ...(item.summary === undefined ? {} : { summary: item.summary.slice(0, 200) }),
    ...(item.partial === true ? { partial: true } : {}),
    ...(link === undefined ? {} : { link }),
  }
}

export function normalizeDomainSnapshot(input: DomainSnapshotV1): DomainSnapshotV1 {
  const items = input.items.map(redactItem).filter((item): item is DomainItemV1 => item !== undefined).slice(0, 1_000)
  return {
    owner: input.owner,
    status: input.status,
    freshness: input.freshness,
    items,
    allowedActions: input.allowedActions.slice(0, 32),
    ...(input.owner === 'eikona' ? { modelRef: input.modelRef ?? EIKONA_DEFAULT_MODEL } : input.modelRef === undefined ? {} : { modelRef: input.modelRef }),
    ...(input.reconcileReason === undefined ? {} : { reconcileReason: input.reconcileReason.slice(0, 200) }),
    ...(input.timeline === undefined || input.timeline.length === 0 ? {} : {
      timeline: input.timeline.slice(-TIMELINE_LIMIT).map(entry => ({ summary: entry.summary.slice(0, 200) })),
    }),
  }
}

export function domainSnapshotEvent(
  snapshot: DomainSnapshotV1,
  context: PaneContextV1,
  sequence = -1,
): unknown {
  const normalized = normalizeDomainSnapshot(snapshot)
  return {
    schema: PANE_EVENT_SCHEMA,
    stream: `domain.${normalized.owner}`,
    cursor: `c${sequence}`,
    sequence,
    context,
    occurredAt: '2026-08-21T00:00:00Z',
    observedAt: '2026-08-21T00:00:00Z',
    freshness: normalized.freshness,
    status: normalized.status,
    op: 'snapshot',
    payload: {
      entities: normalized.items.map(item => ({
        ref: item.ref,
        version: Number.parseInt(item.version.replace(/\D/g, ''), 10) || 1,
        value: item,
      })),
      timeline: [],
      receipts: [],
    },
  }
}

export function domainIntent(
  snapshot: DomainSnapshotV1,
  item: DomainItemV1,
  intent: 'open' | 'compare' | 'attach_context' | 'transform' | 'handoff' | 'link',
  context: PaneContextV1,
  targetOwner?: string,
): unknown {
  return {
    schema: PANE_INTENT_SCHEMA,
    intent,
    source: domainArtifact(snapshot, item),
    ...(targetOwner === undefined ? {} : { targetOwner }),
    context,
    idempotencyKey: `${snapshot.owner}:${item.ref}:${intent}`,
  }
}

export function domainArtifact(snapshot: DomainSnapshotV1, item: DomainItemV1): ArtifactRefV1 {
  return {
    schema: PANE_ARTIFACT_SCHEMA,
    owner: snapshot.owner,
    kind: item.kind,
    ref: item.ref,
    version: item.version,
    mediaType: snapshot.owner === 'eikona' ? 'image/png' : snapshot.owner === 'sonora' ? 'audio/mpeg' : 'application/octet-stream',
    title: item.title,
    ...(item.summary === undefined ? {} : { summary: item.summary }),
    evidenceRefs: [],
    capabilities: ['open', 'handoff'],
  }
}
