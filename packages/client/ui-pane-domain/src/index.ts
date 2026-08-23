/** Domain Pane client plugin: serial adapters over owner snapshots. */

import type { Context } from '@deepseek-ai/cordis'
import { ordoSnapshotToDomain, ordoSubagentDeepLink } from './ordo.js'
import { DOMAIN_OWNERS, type DomainOwner } from './owners.js'
import { registerDomainPaneViews } from './registry.js'
import { normalizeDomainSnapshot, type DomainItemV1, type DomainSnapshotV1 } from './snapshot.js'
import type { DomainOwnerSourceService } from './owner-source.js'

interface PaneWorkbenchFace {
  registerView(input: unknown): () => void
  openView?(request: unknown): void
}

export const inject = ['slots']

function emptySnapshot(owner: DomainOwner): DomainSnapshotV1 {
  return {
    owner,
    status: 'offline',
    freshness: 'unknown',
    items: [],
    allowedActions: [],
    ...(owner === 'eikona' ? { modelRef: 'openai/gpt-5.4-image-2' } : {}),
  }
}

/** 每个 (ctx, owner) 的 live adapter 缓存；owner service 实例替换时自动重建。 */
const LIVE_ADAPTERS = new WeakMap<object, Map<DomainOwner, { raw: unknown; adapter: DomainOwnerSourceService }>>()

/** 已挂载的正式 owner source（Host bridge 经 ctx.provide('domain.<owner>') 提供）。 */
function liveOwnerSource(ctx: Context, owner: DomainOwner): DomainOwnerSourceService | undefined {
  const service = ctx.get(`domain.${owner}`) as Partial<DomainOwnerSourceService> | undefined
  if (service === undefined || typeof service.getSnapshot !== 'function') return undefined
  let perContext = LIVE_ADAPTERS.get(ctx)
  if (perContext === undefined) {
    perContext = new Map()
    LIVE_ADAPTERS.set(ctx, perContext)
  }
  const cached = perContext.get(owner)
  if (cached !== undefined && cached.raw === service) return cached.adapter

  const rawSubscribe = service.subscribe
  const subscribe: DomainOwnerSourceService['subscribe'] | undefined = typeof rawSubscribe === 'function'
    ? listener => rawSubscribe.call(service, listener) ?? (() => {})
    : undefined
  // useSyncExternalStore 要求 getSnapshot 引用稳定：按 owner 原始 snapshot 引用
  // 缓存 normalize 结果，只有 owner 投影真的变化时才产生新引用。
  let lastRaw: DomainSnapshotV1 | undefined
  let lastNormalized: DomainSnapshotV1 | undefined
  const adapter: DomainOwnerSourceService = {
    owner,
    getSnapshot: () => {
      const raw = service.getSnapshot!()
      if (raw === lastRaw && lastNormalized !== undefined) return lastNormalized
      lastRaw = raw
      lastNormalized = normalizeDomainSnapshot(raw)
      return lastNormalized
    },
    // 未提供订阅时退化为 noop：view 读取当前 snapshot，不假装 realtime。
    subscribe: subscribe ?? (() => () => {}),
    dispose: () => { service.dispose?.() },
  }
  perContext.set(owner, { raw: service, adapter })
  return adapter
}

function readOwnerSnapshot(ctx: Context, owner: DomainOwner): DomainSnapshotV1 {
  const live = liveOwnerSource(ctx, owner)
  if (live !== undefined) return live.getSnapshot()
  if (owner === 'ordo') {
    const ordo = ctx.get('ordoAgentOps') as { snapshot?: () => Parameters<typeof ordoSnapshotToDomain>[0] } | undefined
    if (ordo?.snapshot !== undefined) return ordoSnapshotToDomain(ordo.snapshot())
  }
  return emptySnapshot(owner)
}

export function apply(ctx: Context): () => void {
  const pane = ctx.get('paneWorkbench') as PaneWorkbenchFace | undefined
  if (pane === undefined) return () => {}
  return registerDomainPaneViews(pane, {
    getSnapshot: owner => readOwnerSnapshot(ctx, owner),
    subscribe: (owner, listener) => liveOwnerSource(ctx, owner)?.subscribe?.(listener) ?? (() => {}),
    // Deep-link 只产生 typed openView 请求（如 Ordo task → Subagent session view），
    // 绝不改写 canonical Ordo run 状态。
    openDeepLink: (owner: DomainOwner, item: DomainItemV1) => {
      if (owner !== 'ordo') return
      const request = ordoSubagentDeepLink(item)
      if (request !== undefined) pane.openView?.(request)
    },
  })
}

export { DOMAIN_BADGES, DOMAIN_OWNERS, DOMAIN_PANE_KINDS, EIKONA_DEFAULT_MODEL, SUBAGENT_BADGE } from './owners.js'
export { admitDomainAction, admitOrdoClientAction, interpretTimeout, ORDO_CLOSED_ACTIONS } from './actions.js'
export { domainArtifact, domainIntent, domainSnapshotEvent, normalizeDomainSnapshot } from './snapshot.js'
export { DomainPaneView, createDomainPaneView } from './view.js'
export { registerDomainPaneViews } from './registry.js'
export { createOrdoOwnerTransport, ordoSnapshotToDomain, ordoSubagentDeepLink } from './ordo.js'
export type {
  OrdoAgentOpsEventLike,
  OrdoAgentOpsEventSourceLike,
  OrdoAgentOpsSnapshotLike,
  OrdoAgentOpsTaskLike,
  OrdoOwnerTransportInput,
  OrdoSubagentDeepLinkRequest,
} from './ordo.js'
export {
  DomainOwnerSourceBridge,
  createDomainOwnerFoldState,
  foldDomainOwnerEvent,
  mountDomainOwnerSource,
} from './owner-source.js'
export type {
  DomainOwnerEventTransport,
  DomainOwnerFoldState,
  DomainOwnerSnapshotRead,
  DomainOwnerSourceService,
} from './owner-source.js'
export { DomainActionGateway } from './action-gateway.js'
export type {
  DomainActionGatewayOptions,
  DomainActionNegative,
  DomainActionOwnerChannel,
  DomainActionPreviewOutcome,
  DomainActionSubmitOutcome,
} from './action-gateway.js'
export {
  SONORA_NEGATIVE_KINDS,
  SONORA_STREAM,
  createSonoraActionChannel,
  sonoraNegativeRead,
  sonoraSnapshotRead,
} from './sonora.js'
export type {
  SonoraActionOwner,
  SonoraBoardLike,
  SonoraNegativeKind,
  SonoraTakeCardLike,
  SonoraTakePreviewLike,
} from './sonora.js'
export {
  PINAX_NEGATIVE_KINDS,
  PINAX_STREAM,
  createPinaxActionChannel,
  pinaxHandwrittenMetadataRead,
  pinaxNegativeRead,
  pinaxPaneUnsafe,
  pinaxSnapshotRead,
} from './pinax.js'
export type {
  PinaxActionOwner,
  PinaxNegativeKind,
  PinaxNoteLike,
  PinaxNotesProjectionLike,
} from './pinax.js'
export {
  ANATOMIA_ACTION_IDS,
  ANATOMIA_ENTITY_KINDS,
  ANATOMIA_NEGATIVE_KINDS,
  ANATOMIA_STREAM,
  anatomiaEvidenceArtifact,
  anatomiaJobStatus,
  anatomiaNegativeRead,
  anatomiaPaneUnsafe,
  anatomiaSnapshotRead,
  createAnatomiaActionChannel,
} from './anatomia.js'
export type {
  AnatomiaActionId,
  AnatomiaActionOwner,
  AnatomiaAnalysisLike,
  AnatomiaEntityKind,
  AnatomiaFacetLike,
  AnatomiaNegativeKind,
} from './anatomia.js'
export {
  AUCTRA_NEGATIVE_KINDS,
  AUCTRA_STREAM,
  AUCTRA_TIMEOUT_INTERPRETATION,
  auctraNegativeRead,
  auctraPaneUnsafe,
  auctraSnapshotRead,
  auctraUnitArtifact,
  createAuctraActionChannel,
} from './auctra.js'
export type {
  AuctraActionOwner,
  AuctraActionPreviewLike,
  AuctraNegativeKind,
  AuctraPulseLike,
  AuctraReviewItemLike,
  AuctraUnitLike,
  AuctraWorkspaceLike,
} from './auctra.js'
export {
  EIKONA_NEGATIVE_KINDS,
  EIKONA_PANE_DEFAULT_MODEL,
  EIKONA_STREAM,
  createEikonaActionChannel,
  eikonaCardArtifact,
  eikonaNegativeRead,
  eikonaSnapshotRead,
  normalizeEikonaModelRef,
} from './eikona.js'
export type {
  EikonaActionOwner,
  EikonaActionPreviewLike,
  EikonaBoardLike,
  EikonaCardLike,
  EikonaNegativeKind,
} from './eikona.js'

const DomainPanePlugin = { inject, apply }
export default DomainPanePlugin
