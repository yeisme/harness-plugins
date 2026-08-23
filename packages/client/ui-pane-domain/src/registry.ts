/** Serial domain Pane registration. One writer, one registerView surface. */

import { DOMAIN_PANE_KINDS, DOMAIN_OWNERS, type DomainOwner } from './owners.js'
import { createDomainPaneView } from './view.js'
import type { DomainItemV1, DomainSnapshotV1 } from './snapshot.js'

export interface DomainPaneSurface {
  registerView(input: unknown): () => void
}

export interface DomainPaneSources {
  readonly getSnapshot: (owner: DomainOwner) => DomainSnapshotV1
  /** 可选 live 订阅；owner source 挂载时驱动重渲染（无 timer 轮询）。 */
  readonly subscribe?: (owner: DomainOwner, listener: () => void) => () => void
  /** 可选 typed deep-link 处理；只发 openView 请求，不改 canonical 状态。 */
  readonly openDeepLink?: (owner: DomainOwner, item: DomainItemV1) => void
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
    component: createDomainPaneView(owner, () => sources.getSnapshot(owner), {
      ...(sources.subscribe === undefined ? {} : {
        subscribe: (listener: () => void): () => void => {
          const dispose = sources.subscribe?.(owner, listener)
          return () => { dispose?.() }
        },
      }),
      ...(sources.openDeepLink === undefined ? {} : { onDeepLink: (item: DomainItemV1) => sources.openDeepLink?.(owner, item) }),
    }),
  }))
  return () => {
    for (const dispose of [...disposers].reverse()) dispose()
  }
}
