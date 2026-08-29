/** Domain Pane views. Status is never color-only; mutations stay owner-gated. */

import { createElement, useSyncExternalStore, type ComponentProps, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  Surface,
  SurfaceActionBar,
  SurfaceContextBar,
  SurfaceSection,
  SurfaceState,
} from '@yeisme/dsh-client-ui-surface'
import { buildPanelStyles, statusTone } from '@yeisme/dsh-client-ui-visual-kit'
import { DOMAIN_BADGES, SUBAGENT_BADGE, type DomainOwner } from './owners.js'
import { admitDomainAction, admitOrdoClientAction } from './actions.js'
import type { DomainItemV1, DomainSnapshotV1 } from './snapshot.js'

export interface DomainPaneViewProps {
  readonly snapshot: DomainSnapshotV1
  readonly onAction?: (actionId: string) => void
  /** owner 已关联条目的 typed deep-link（如 Ordo task → Subagent session）。 */
  readonly onDeepLink?: (item: DomainItemV1) => void
}

/** 可见窗口：DOM 有界；真实数量经 aria-rowcount 报告。 */
const VISIBLE_WINDOW = 80
const VISIBLE_TIMELINE = 5

/** 统一面板样式：token fallback 单点声明，规则限定在 [data-pane-domain]。 */
const domainPaneStyles = buildPanelStyles({ scope: 'pane-domain' })

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
  const tone = statusTone(snapshot.status)
  return createElement(Surface, {
    kind: 'inspector',
    'data-pane-domain': snapshot.owner,
    'data-status': snapshot.status,
    'data-freshness': snapshot.freshness,
    'data-badge': DOMAIN_BADGES[snapshot.owner],
  },
    createElement('style', { 'data-pane-domain-styles': true }, domainPaneStyles),
    createElement(SurfaceContextBar, {
      title: createElement('span', { 'data-owner-badge': true }, DOMAIN_BADGES[snapshot.owner]),
      status: createElement('span', { className: 'vk-sub', role: 'status' },
        createElement('i', { className: 'vk-dot', 'data-tone': tone, 'aria-hidden': true }),
        `${snapshot.status} · ${snapshot.freshness}`),
    }),
    createElement('div', { className: 'ys-body' },
      snapshot.owner === 'ordo' ? createElement('p', { className: 'vk-alert', 'data-tone': 'info', 'data-subagent-boundary': true }, `Not ${SUBAGENT_BADGE}`) : null,
      snapshot.owner === 'eikona' && snapshot.modelRef !== undefined
        ? createElement('p', { className: 'vk-muted', 'data-model-ref': true }, snapshot.modelRef)
        : null,
      snapshot.reconcileReason === undefined ? null
        : createElement('p', { className: 'vk-alert', 'data-reconcile-reason': true }, snapshot.reconcileReason),
      visible.length === 0
        ? createElement(SurfaceState, {
          className: 'vk-empty',
          phase: snapshot.freshness === 'fresh' ? 'empty' : 'stale',
          title: 'No owner projection.',
          description: 'Owner source 未挂载或暂无投影；通道恢复时自动权威重读，无需手动重试。',
        })
        : createElement(SurfaceSection, { title: 'Owner projection', meta: `${snapshot.items.length} items` },
          createElement('ul', { className: 'vk-section ys-list', 'data-virtualized': truncated || undefined, 'aria-rowcount': snapshot.items.length },
        visible.map(item => createElement('li', {
          key: item.ref,
          className: 'vk-row',
          'data-item-ref': item.ref,
          'data-item-kind': item.kind,
          'data-item-status': item.status,
          'data-partial': item.partial || undefined,
        },
          createElement('span', { className: 'vk-badge' }, item.kind),
          createElement('span', null,
            createElement('strong', null, item.title),
            item.partial === true ? createElement('small', null, ' · partial') : null,
            item.summary === undefined ? null : createElement('small', null, item.summary)),
          item.link === undefined ? createElement('span', null) : createElement(Button, {
            type: 'button',
            className: 'vk-btn',
            'aria-label': `open ${item.link.kind} ${item.link.ref}`,
            'data-deep-link': item.link.kind,
            onClick: () => { onDeepLink?.(item) },
          } as ComponentProps<typeof Button> & { readonly 'data-deep-link': string }, 'Open session')))),
          truncated ? createElement('p', { className: 'vk-muted' }, `${visible.length} of ${snapshot.items.length} rows rendered`) : null,
        ),
      timeline.length === 0 ? null
        : createElement(SurfaceSection, { title: 'Owner live events' },
          createElement('ul', { className: 'vk-section ys-list', 'data-live-timeline': true, 'aria-label': 'Owner live events' },
            timeline.map((entry, index) => createElement('li', { key: `${index}:${entry.summary.slice(0, 48)}`, className: 'vk-muted' }, entry.summary))),
        ),
    ),
    createElement(SurfaceActionBar, { role: 'group', 'aria-label': 'Owner actions' }, snapshot.allowedActions.map(action => {
      const gate = actionDisabled(snapshot, action.id)
      return createElement(Button, {
        key: action.id,
        type: 'button',
        className: 'vk-btn',
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
