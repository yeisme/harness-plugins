/** Domain Pane views. Status is never color-only; mutations stay owner-gated. */

import { createElement, useSyncExternalStore, type ReactNode } from 'react'
import { DOMAIN_BADGES, SUBAGENT_BADGE, type DomainOwner } from './owners.js'
import { admitDomainAction, admitOrdoClientAction } from './actions.js'
import type { DomainItemV1, DomainSnapshotV1 } from './snapshot.js'
import { ordoSubagentDeepLink } from './ordo.js'

export interface DomainPaneViewProps {
  readonly snapshot: DomainSnapshotV1
  readonly onAction?: (actionId: string) => void
  /** owner 已关联条目的 typed deep-link（如 Ordo task → Subagent session）。 */
  readonly onDeepLink?: (item: DomainItemV1) => void
}

/** 可见窗口：DOM 有界；真实数量经 aria-rowcount 报告。 */
const VISIBLE_WINDOW = 80
const VISIBLE_TIMELINE = 5

function actionDisabled(snapshot: DomainSnapshotV1, actionId: string): { disabled: boolean; reason: string } {
  const admission = snapshot.owner === 'ordo' ? admitOrdoClientAction(snapshot, actionId) : admitDomainAction(snapshot, actionId)
  if (admission.kind === 'allowed') return { disabled: false, reason: '' }
  if (admission.kind === 'approval_required') return { disabled: false, reason: 'approval required' }
  return { disabled: true, reason: admission.reason }
}

export function DomainPaneView({ snapshot, onAction, onDeepLink }: DomainPaneViewProps): ReactNode {
  const visible = snapshot.items.slice(0, VISIBLE_WINDOW)
  const truncated = snapshot.items.length > visible.length
  const timeline = snapshot.timeline?.slice(-VISIBLE_TIMELINE) ?? []
  return createElement('section', {
    'data-pane-domain': snapshot.owner,
    'data-status': snapshot.status,
    'data-freshness': snapshot.freshness,
    'data-badge': DOMAIN_BADGES[snapshot.owner],
  },
    createElement('header', { 'data-owner-badge': true }, DOMAIN_BADGES[snapshot.owner]),
    snapshot.owner === 'ordo' ? createElement('p', { 'data-subagent-boundary': true }, `Not ${SUBAGENT_BADGE}`) : null,
    snapshot.owner === 'eikona' && snapshot.modelRef !== undefined
      ? createElement('p', { 'data-model-ref': true }, snapshot.modelRef)
      : null,
    createElement('p', { role: 'status' }, snapshot.status),
    snapshot.reconcileReason === undefined ? null
      : createElement('p', { 'data-reconcile-reason': true }, snapshot.reconcileReason),
    visible.length === 0
      ? createElement('p', null, 'No owner projection.')
      : createElement('ul', { 'data-virtualized': truncated || undefined, 'aria-rowcount': snapshot.items.length },
        visible.map(item => createElement('li', {
          key: item.ref,
          'data-item-ref': item.ref,
          'data-item-kind': item.kind,
          'data-item-status': item.status,
          'data-partial': item.partial || undefined,
        },
          `${item.title}${item.partial === true ? ' · partial' : ''}`,
          item.link === undefined ? null : createElement('button', {
            type: 'button',
            'aria-label': `open ${item.link.kind} ${item.link.ref}`,
            'data-deep-link': item.link.kind,
            onClick: () => { onDeepLink?.(item) },
          }, 'Open session')))),
    timeline.length === 0 ? null
      : createElement('ul', { 'data-live-timeline': true, 'aria-label': 'Owner live events' },
        timeline.map((entry, index) => createElement('li', { key: `${index}:${entry.summary.slice(0, 48)}` }, entry.summary))),
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

export interface DomainPaneViewBinding {
  readonly subscribe?: (listener: () => void) => () => void
  readonly onDeepLink?: (item: DomainItemV1) => void
}

/**
 * 绑定一个 owner 的 Pane view。live 更新经 useSyncExternalStore 驱动：
 * 有 push 订阅时随 owner 事件重渲染；没有订阅时只显示 snapshot 真实
 * freshness，绝不假装 realtime。
 */
export function createDomainPaneView(
  owner: DomainOwner,
  getSnapshot: () => DomainSnapshotV1,
  binding: DomainPaneViewBinding = {},
) {
  return function BoundDomainPaneView(): ReactNode {
    const snapshot = binding.subscribe === undefined
      ? getSnapshot()
      : useSyncExternalStore(binding.subscribe, getSnapshot, getSnapshot)
    return createElement(DomainPaneView, {
      snapshot,
      ...(binding.onDeepLink === undefined ? {} : { onDeepLink: binding.onDeepLink }),
    })
  }
}
