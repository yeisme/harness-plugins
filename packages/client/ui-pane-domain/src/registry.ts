/** Serial domain Pane registration. One writer, one registerView surface. */

import { DOMAIN_PANE_KINDS, DOMAIN_OWNERS, type DomainOwner } from './owners.js'
import { createDomainPaneView } from './view.js'
import type { DomainSnapshotV1 } from './snapshot.js'

export interface DomainPaneSurface {
  registerView(input: unknown): () => void
}

export interface DomainPaneSources {
  readonly getSnapshot: (owner: DomainOwner) => DomainSnapshotV1
}

export function registerDomainPaneViews(pane: DomainPaneSurface, sources: DomainPaneSources): () => void {
  const disposers = DOMAIN_OWNERS.map(owner => pane.registerView({
    descriptor: {
      kind: DOMAIN_PANE_KINDS[owner],
      label: owner === 'ordo' ? 'Ordo Team' : owner[0]!.toUpperCase() + owner.slice(1),
      componentKey: `${owner}-pane`,
      role: owner === 'ordo' ? 'inspector' : 'content',
      preferredRegion: 'right',
      retention: owner === 'eikona' || owner === 'sonora' || owner === 'anatomia' ? 'snapshot' : 'keep-alive',
      singleton: true,
    },
    component: createDomainPaneView(owner, () => sources.getSnapshot(owner)),
  }))
  return () => {
    for (const dispose of [...disposers].reverse()) dispose()
  }
}
