/** Domain Pane views. Status is never color-only; mutations stay owner-gated. */

import { createElement, type ReactNode } from 'react'
import { DOMAIN_BADGES, SUBAGENT_BADGE, type DomainOwner } from './owners.js'
import { admitDomainAction, admitOrdoClientAction } from './actions.js'
import type { DomainSnapshotV1 } from './snapshot.js'

export interface DomainPaneViewProps {
  readonly snapshot: DomainSnapshotV1
  readonly onAction?: (actionId: string) => void
}

function actionDisabled(snapshot: DomainSnapshotV1, actionId: string): { disabled: boolean; reason: string } {
  const admission = snapshot.owner === 'ordo' ? admitOrdoClientAction(snapshot, actionId) : admitDomainAction(snapshot, actionId)
  if (admission.kind === 'allowed') return { disabled: false, reason: '' }
  if (admission.kind === 'approval_required') return { disabled: false, reason: 'approval required' }
  return { disabled: true, reason: admission.reason }
}

export function DomainPaneView({ snapshot, onAction }: DomainPaneViewProps): ReactNode {
  const visible = snapshot.items.slice(0, 80)
  const truncated = snapshot.items.length > visible.length
  return createElement('section', {
    'data-pane-domain': snapshot.owner,
    'data-status': snapshot.status,
    'data-badge': DOMAIN_BADGES[snapshot.owner],
  },
    createElement('header', { 'data-owner-badge': true }, DOMAIN_BADGES[snapshot.owner]),
    snapshot.owner === 'ordo' ? createElement('p', { 'data-subagent-boundary': true }, `Not ${SUBAGENT_BADGE}`) : null,
    snapshot.owner === 'eikona' && snapshot.modelRef !== undefined
      ? createElement('p', { 'data-model-ref': true }, snapshot.modelRef)
      : null,
    createElement('p', { role: 'status' }, snapshot.status),
    visible.length === 0
      ? createElement('p', null, 'No owner projection.')
      : createElement('ul', { 'data-virtualized': truncated || undefined, 'aria-rowcount': snapshot.items.length },
        visible.map(item => createElement('li', {
          key: item.ref,
          'data-item-ref': item.ref,
          'data-partial': item.partial || undefined,
        }, `${item.title}${item.partial === true ? ' · partial' : ''}`))),
    createElement('div', { role: 'group', 'aria-label': 'Owner actions' }, snapshot.allowedActions.map(action => {
      const gate = actionDisabled(snapshot, action.id)
      return createElement('button', {
        key: action.id,
        type: 'button',
        disabled: gate.disabled,
        'aria-label': action.id,
        title: gate.reason || undefined,
        onClick: () => { if (!gate.disabled) onAction?.(action.id) },
      }, action.id)
    })),
  )
}

export function createDomainPaneView(owner: DomainOwner, getSnapshot: () => DomainSnapshotV1) {
  return function BoundDomainPaneView(): ReactNode {
    return createElement(DomainPaneView, { snapshot: getSnapshot() })
  }
}
