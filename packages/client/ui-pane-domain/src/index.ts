/** Domain Pane client plugin: serial adapters over owner snapshots. */

import type { Context } from '@deepseek-ai/cordis'
import { ordoSnapshotToDomain } from './ordo.js'
import { DOMAIN_OWNERS, type DomainOwner } from './owners.js'
import { registerDomainPaneViews } from './registry.js'
import type { DomainSnapshotV1 } from './snapshot.js'

interface PaneWorkbenchFace {
  registerView(input: unknown): () => void
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

function readOwnerSnapshot(ctx: Context, owner: DomainOwner): DomainSnapshotV1 {
  if (owner === 'ordo') {
    const ordo = ctx.get('ordoAgentOps') as { snapshot?: () => Parameters<typeof ordoSnapshotToDomain>[0] } | undefined
    if (ordo?.snapshot !== undefined) return ordoSnapshotToDomain(ordo.snapshot())
  }
  const host = ctx.get(`domain.${owner}`) as { getSnapshot?: () => DomainSnapshotV1 } | undefined
  return host?.getSnapshot?.() ?? emptySnapshot(owner)
}

export function apply(ctx: Context): () => void {
  const pane = ctx.get('paneWorkbench') as PaneWorkbenchFace | undefined
  if (pane === undefined) return () => {}
  return registerDomainPaneViews(pane, {
    getSnapshot: owner => readOwnerSnapshot(ctx, owner),
  })
}

export { DOMAIN_BADGES, DOMAIN_OWNERS, DOMAIN_PANE_KINDS, EIKONA_DEFAULT_MODEL, SUBAGENT_BADGE } from './owners.js'
export { admitDomainAction, admitOrdoClientAction, interpretTimeout, ORDO_CLOSED_ACTIONS } from './actions.js'
export { domainArtifact, domainIntent, domainSnapshotEvent, normalizeDomainSnapshot } from './snapshot.js'
export { DomainPaneView, createDomainPaneView } from './view.js'
export { registerDomainPaneViews } from './registry.js'
export { ordoSnapshotToDomain } from './ordo.js'
export type { OrdoAgentOpsSnapshotLike } from './ordo.js'

const DomainPanePlugin = { inject, apply }
export default DomainPanePlugin
