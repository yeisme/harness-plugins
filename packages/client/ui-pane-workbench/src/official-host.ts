/**
 * Tier 0 official overlay host (pane-overlay-workbench-experience).
 *
 * Pre-Core DSH collapses every Pane group into ONE tabbed surface. The
 * collapse is a render-time projection only: the canonical PaneWorkspaceV1
 * keeps its full region/group structure, so persistence round-trips and
 * Tier 0→1 hot upgrades lose nothing. The overlay reuses the shared tab
 * system (PaneTabStrip pinned/preview/overflow), the anchored Quick Pick, the
 * activity rail, the view More menu, and the shared PaneDragCoordinator.
 * Host-geometry intents (split/move-region/maximize/dock/resize) are gated at
 * the controller with the standard `reason.geometryTier0`; their controls stay
 * visible but disabled. Drop intents converge to `reorder_within_group`; no
 * edge zones or fake region boundaries are ever rendered.
 */

import { createElement, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { Surface } from '@yeisme/dsh-client-ui-surface'
import type { PaneWorkbenchController } from './controller.js'
import { geometryDisabledReasonKey } from './experience-tier.js'
import { formatT, getLocaleRevision, subscribeLocale, t } from './i18n/locale.js'
import { WorkbenchIcon, type WorkbenchIconName } from './icon.js'
import type { PaneDragTargetV1 } from './interactions.js'
import {
  PaneActivityRail,
  paneArtifactDropHandlers,
  PaneViewContent,
  PaneViewHandoffSection,
  REGION_STYLES,
  usePaneTabFocusRestore,
  type PaneArtifactHandoffContextV1,
} from './region-chrome.js'
import { PaneTabStrip } from './tabs.js'
import { PaneCloseUndoToast, PaneManagementCenter } from './management-center.js'
import type { PaneViewRegistry } from './view-registry.js'
import {
  resolvePaneManagementShortcut,
  type PaneConversationSearchHostV1,
  type PaneManagementKeymapV1,
  type PaneManagementMode,
  type PaneWorkspaceContextProviderV1,
} from './management.js'
import {
  preflightBulkClose,
  type PaneBulkCloseMode,
  type PaneBulkCloseProtectedViewV1,
  type PaneGroupV1,
  type PaneSplitNodeV1,
  type PaneWorkspaceV1,
} from './workspace.js'

export interface OfficialOverlayPaneHostProps {
  readonly registry: PaneViewRegistry
  readonly controller: PaneWorkbenchController
  readonly handoff?: PaneArtifactHandoffContextV1
  readonly conversationSearch?: PaneConversationSearchHostV1
  readonly keymap?: Partial<PaneManagementKeymapV1>
  readonly workspaceContext?: PaneWorkspaceContextProviderV1
}

/** Synthetic group id used only to feed the shared tab strip; never written to canonical state. */
export const OVERLAY_COLLAPSED_GROUP_ID = 'group:overlay:collapsed' as const

function splitIcon(edge: 'left' | 'right' | 'top' | 'bottom'): WorkbenchIconName {
  return edge === 'left' ? 'split-left'
    : edge === 'right' ? 'split-right'
      : edge === 'top' ? 'split-up'
        : 'split-down'
}

function menuItem(icon: WorkbenchIconName, label: string): readonly [ReactNode, ReactNode] {
  return [createElement(WorkbenchIcon, { name: icon, size: 16 }), createElement('span', null, label)]
}

export interface OverlayTabProjectionV1 {
  /** Real group ids in collapsed order (right tree order, then bottom tree order); only groups with tabs. */
  readonly groupOrder: readonly string[]
  readonly tabs: readonly string[]
  readonly activeTabId?: string
  /** Synthetic single-group view of the collapsed tab list for the shared tab strip. */
  readonly group: PaneGroupV1
}

function treeGroupIds(node: PaneSplitNodeV1, output: string[] = []): string[] {
  if (node.type === 'group') output.push(node.groupId)
  else { treeGroupIds(node.first, output); treeGroupIds(node.second, output) }
  return output
}

/** Render-time collapse projection. It never mutates or rewrites the canonical workspace. */
export function projectOverlayTabList(state: PaneWorkspaceV1): OverlayTabProjectionV1 {
  const groupOrder = [...treeGroupIds(state.regions.right.root), ...treeGroupIds(state.regions.bottom.root)]
    .filter(id => (state.groups[id]?.tabs.length ?? 0) > 0)
  const tabs = groupOrder.flatMap(id => state.groups[id]?.tabs ?? [])
  const activeGroup = state.activeGroupId === undefined ? undefined : state.groups[state.activeGroupId]
  const preferred = activeGroup !== undefined && activeGroup.tabs.length > 0 ? activeGroup.activeTabId : undefined
  const activeTabId = preferred !== undefined && tabs.includes(preferred)
    ? preferred
    : groupOrder.map(id => state.groups[id]?.activeTabId).find((id): id is string => id !== undefined && tabs.includes(id)) ?? tabs[0]
  const group: PaneGroupV1 = {
    id: OVERLAY_COLLAPSED_GROUP_ID,
    region: state.activeRegion,
    role: 'general',
    locked: false,
    tabs,
    activeTabId,
  }
  return { groupOrder, tabs, activeTabId, group }
}

export interface OverlayBulkCloseResultV1 {
  readonly accepted: boolean
  readonly reason?: string
  readonly blockerViewId?: string
  readonly blockerTitle?: string
}

/**
 * Bulk close over the collapsed tab set. The preflight aggregates every real
 * group first: one denying view rejects the whole gesture and no dispatch
 * happens; only an all-clear preflight commits per group in collapsed order.
 */
export function dispatchOverlayBulkClose(
  controller: PaneWorkbenchController,
  mode: Extract<PaneBulkCloseMode, 'others' | 'unpinned'>,
  sourceViewId?: string,
): OverlayBulkCloseResultV1 {
  const state = controller.getSnapshot()
  const projection = projectOverlayTabList(state)
  const sourceGroupId = sourceViewId === undefined ? undefined : state.views[sourceViewId]?.groupId
  const plans = projection.groupOrder
    .map(groupId => ({
      groupId,
      preflight: preflightBulkClose(
        state,
        groupId,
        groupId === sourceGroupId ? mode : mode === 'others' ? 'group' : mode,
        groupId === sourceGroupId ? sourceViewId : undefined,
      ),
    }))
    .filter(plan => plan.preflight.targetIds.length > 0)
  for (const plan of plans) {
    if (plan.preflight.accepted) continue
    const blocker = plan.preflight.blockerViewId === undefined ? undefined : state.views[plan.preflight.blockerViewId]
    return {
      accepted: false,
      reason: plan.preflight.reason,
      blockerViewId: plan.preflight.blockerViewId,
      blockerTitle: blocker?.title,
    }
  }
  for (const plan of plans) {
    controller.dispatch({
      type: 'bulk_close',
      groupId: plan.groupId,
      mode: plan.groupId === sourceGroupId ? mode : mode === 'others' ? 'group' : mode,
      ...(plan.groupId === sourceGroupId && sourceViewId !== undefined ? { sourceViewId } : {}),
    })
  }
  return { accepted: plans.length > 0 }
}

const HOST_CSS = `.pwo-host{position:fixed;z-index:80;top:var(--dsh-conversation-header-height,88px);right:0;bottom:0;width:min(720px,calc(100vw - 356px));min-width:360px;overflow:visible;border-left:1px solid var(--vk-border-l2);background:var(--vk-bg-base);color:var(--vk-text-primary);isolation:isolate;display:flex;flex-direction:row}
.pwo-workspace{position:relative;flex:1;min-width:0;min-height:0;margin-left:44px;overflow:hidden;display:flex;flex-direction:column}
.pwo-dismiss{position:absolute;z-index:40;top:10px;left:-17px;width:34px;height:34px;padding:0;display:grid;place-items:center;border:1px solid var(--vk-border-l2);border-radius:9px;background:var(--vk-bg-layer-1);color:var(--vk-text-secondary);box-shadow:0 6px 18px rgba(0,0,0,.24);cursor:pointer}
.pwo-dismiss:hover,.pwo-dismiss:focus-visible{background:var(--vk-fill-hover);color:var(--vk-text-primary);outline:2px solid var(--vk-focus-ring);outline-offset:-2px}
.pwo-host .pwr-tabs{position:relative}
.pwo-insertion{position:absolute;top:4px;bottom:4px;width:2px;border-radius:1px;background:var(--vk-accent,#6b9cff);pointer-events:none;z-index:6}
.pwo-menu-note{margin:4px 6px;padding:6px 8px;border-radius:8px;background:var(--vk-fill-hover,rgba(255,255,255,.06));color:var(--vk-text-secondary,#b8b8c0);font-size:12px}
@media(max-width:720px){.pwo-host{top:0;width:100vw;min-width:0;border-left:0}.pwo-dismiss{top:8px;left:8px}}
@media(max-width:600px),(pointer:coarse){.pwo-host button{min-width:44px;min-height:44px}.pwo-host .pwr-tab{min-height:44px}}
@media(prefers-reduced-motion:reduce){.pwo-host *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`

function subscribeViewport(listener: () => void): () => void {
  window.addEventListener('resize', listener)
  return () => { window.removeEventListener('resize', listener) }
}

function viewportSnapshot(): string {
  return typeof window === 'undefined' ? '1280:800' : `${window.innerWidth}:${window.innerHeight}`
}

function overlayActiveTabId(state: PaneWorkspaceV1): string | undefined {
  return projectOverlayTabList(state).activeTabId
}

export function OfficialOverlayPaneHost({ registry, controller, handoff, conversationSearch, keymap, workspaceContext }: OfficialOverlayPaneHostProps): ReactNode {
  useSyncExternalStore(subscribeLocale, getLocaleRevision, getLocaleRevision)
  const state = useSyncExternalStore(controller.subscribeWorkspace, controller.getSnapshot, controller.getSnapshot)
  const drag = useSyncExternalStore(controller.drag.subscribe, controller.drag.getSnapshot, controller.drag.getSnapshot)
  const viewport = useSyncExternalStore(subscribeViewport, viewportSnapshot, () => '1280:800')
  const tierTracker = controller.experienceTier
  const [tierRevision, setTierRevision] = useState(0)
  void tierRevision
  const [managementMode, setManagementMode] = useState<PaneManagementMode>()
  const [reviewProtected, setReviewProtected] = useState<readonly PaneBulkCloseProtectedViewV1[]>([])
  const [menuViewId, setMenuViewId] = useState<string>()
  const [menuNotice, setMenuNotice] = useState<string>()
  const rootRef = useRef<HTMLElement>(null)
  useEffect(() => tierTracker?.subscribe(() => setTierRevision(value => value + 1)), [tierTracker])
  usePaneTabFocusRestore(controller, rootRef, overlayActiveTabId, '[data-pane-open-view-trigger]')

  const [viewportWidth = 1280, viewportHeight = 800] = viewport.split(':').map(Number)
  const sheet = viewportWidth <= 720
  const width = sheet ? viewportWidth : Math.min(720, Math.max(360, viewportWidth - 356))
  const height = sheet ? viewportHeight : Math.max(0, viewportHeight - 88)
  const visible = state.regions.right.visible || state.regions.bottom.visible

  const tier = tierTracker === undefined ? 0 : tierTracker.getSnapshot().tier
  const geometryReason = geometryDisabledReasonKey(tier)
  const projection = projectOverlayTabList(state)
  const active = projection.activeTabId === undefined ? undefined : state.views[projection.activeTabId]
  const registration = active === undefined ? undefined : registry.get(active.kind)
  const menuView = menuViewId === undefined ? undefined : state.views[menuViewId]

  const close = (viewId: string): void => {
    const view = state.views[viewId]
    if (view === undefined) return
    const result = controller.dispatch({ type: 'bulk_close_safe', groupId: view.groupId, mode: 'group', viewIds: [viewId] })
    const protectedViews = result.details?.bulkCloseSafe?.protectedViews ?? []
    if (protectedViews.length > 0) { setReviewProtected(protectedViews); setManagementMode('manage') }
  }

  const dropTarget = (event: PointerEvent<HTMLElement>): PaneDragTargetV1 | undefined => {
    const sourceId = drag.drag.status === 'dragging' || drag.drag.status === 'pending' ? drag.drag.viewId : undefined
    const source = sourceId === undefined ? undefined : state.views[sourceId]
    if (source === undefined) return undefined
    const sourceGroup = state.groups[source.groupId]
    if (sourceGroup === undefined) return undefined
    const locked = sourceGroup.locked && sourceGroup.role !== source.role
    const tab = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-pane-tab-index]') : null
    if (tab === null) {
      // Outside the strip: an explicit disabled no-op target, so release restores
      // in place and no edge zone or indicator ever appears.
      return { groupId: sourceGroup.id, edge: 'center', enabled: false, reason: 'already_in_group' }
    }
    const collapsedIndex = Number(tab.dataset.paneTabIndex)
    if (!Number.isSafeInteger(collapsedIndex)) return undefined
    const segments = new Map<string, { start: number; length: number }>()
    let offset = 0
    for (const groupId of projection.groupOrder) {
      const length = state.groups[groupId]?.tabs.length ?? 0
      segments.set(groupId, { start: offset, length })
      offset += length
    }
    const segment = segments.get(sourceGroup.id) ?? { start: 0, length: sourceGroup.tabs.length }
    const targetViewId = projection.tabs[collapsedIndex]
    const targetGroupId = targetViewId === undefined ? undefined : state.views[targetViewId]?.groupId
    let index: number
    if (targetGroupId === sourceGroup.id) {
      const rect = tab.getBoundingClientRect()
      index = collapsedIndex - segment.start + Number(event.clientX >= rect.left + rect.width / 2)
    } else {
      // The pointer rests on another group's tab: clamp to the nearest boundary
      // of the source group so the committed intent stays reorder_within_group.
      index = collapsedIndex < segment.start ? 0 : segment.length
    }
    return {
      groupId: sourceGroup.id,
      edge: 'center',
      index,
      enabled: !locked,
      reason: locked ? 'locked' : undefined,
    }
  }

  const insertion = drag.target !== undefined && drag.target.enabled && drag.target.edge === 'center' && drag.target.index !== undefined
    ? drag.target
    : undefined
  const insertionLeft = (() => {
    if (insertion === undefined || rootRef.current === null) return 0
    const tabs = [...rootRef.current.querySelectorAll<HTMLElement>('[data-pane-tab-index]')]
    if (tabs.length === 0) return 0
    const anchor = tabs[Math.min(insertion.index ?? 0, tabs.length - 1)]
    return anchor === undefined ? 0 : anchor.offsetLeft + (insertion.index !== undefined && insertion.index >= projection.tabs.length ? anchor.offsetWidth : 0)
  })()

  const bulkClose = (mode: Extract<PaneBulkCloseMode, 'others' | 'unpinned'>, sourceViewId?: string): void => {
    const result = dispatchOverlayBulkClose(controller, mode, sourceViewId)
    setMenuNotice(result.accepted ? undefined : formatT('overlay.bulkCloseBlocked', { name: result.blockerTitle ?? '—' }))
  }

  if (!visible) return null

  const geometryReasonText = geometryReason === undefined ? undefined : t(geometryReason)

  return createElement('aside', {
    ref: rootRef,
    className: 'pwo-host pwr-root',
    'data-region': 'right',
    'data-pane-official-host': 'overlay',
    'data-pane-overlay-chrome': 'unified',
    'data-pane-overlay-sheet': sheet || undefined,
    'data-pane-experience-tier': tier,
    'aria-label': t('overlay.hostLabel'),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const shortcut = resolvePaneManagementShortcut(event, keymap)
      if (shortcut === 'open_center') {
        event.preventDefault()
        setManagementMode('open')
        return
      }
      if (shortcut === 'close_active' || shortcut === 'close_unpinned') {
        event.preventDefault()
        if (shortcut === 'close_unpinned') {
          const viewIds = Object.values(state.views).filter(view => !view.pinned).map(view => view.id)
          const groupId = active?.groupId ?? projection.groupOrder[0]
          if (groupId !== undefined) {
            const result = controller.dispatch({ type: 'bulk_close_safe', groupId, mode: 'unpinned', viewIds })
            const protectedViews = result.details?.bulkCloseSafe?.protectedViews ?? []
            if (protectedViews.length > 0) { setReviewProtected(protectedViews); setManagementMode('manage') }
          }
        } else if (active !== undefined) close(active.id)
        return
      }
      if (shortcut === 'restore_closed') {
        event.preventDefault()
        controller.restoreClosedBatch()
        return
      }
      if (event.key !== 'Escape') return
      if (drag.drag.status !== 'idle') { event.preventDefault(); controller.drag.cancel() }
      else if (managementMode !== undefined) {
        event.preventDefault()
        setManagementMode(undefined)
        const trigger = rootRef.current?.querySelector('[data-pane-open-view-trigger]')
        if (trigger instanceof HTMLElement) trigger.focus()
      }
    },
  },
  createElement('style', null, `${REGION_STYLES}${HOST_CSS}`),
  createElement('div', { className: 'pwr-status', role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, drag.announcement || controller.announcement),
  createElement(PaneActivityRail, { registry, controller, state, bodyVisible: true, onOpenPicker: () => setManagementMode('open') }),
  createElement(Surface, {
    kind: 'workspace',
    className: 'pwo-workspace',
    ...(handoff === undefined ? {} : paneArtifactDropHandlers(handoff)),
  },
  projection.tabs.length === 0
    ? createElement('section', { className: 'pwr-empty' },
      createElement('p', null, t('state.empty')),
      createElement('button', { type: 'button', 'data-pane-open-view-trigger': 'empty', onClick: () => setManagementMode('open') }, t('chrome.openAView')),
      createElement('button', { type: 'button', onClick: () => controller.hide() }, t('overlay.dismiss')))
    : null,
  projection.tabs.length === 0 ? null : createElement('div', {
    className: 'pwr-tabs',
    role: 'tablist',
    'aria-label': t('overlay.tabList'),
    onPointerMove: (event: PointerEvent<HTMLElement>) => { controller.drag.move(event.clientX, event.clientY, dropTarget(event)) },
    onPointerUp: () => { controller.drag.drop() },
    onPointerCancel: () => controller.drag.cancel(),
  },
  createElement(PaneTabStrip, {
    group: projection.group,
    state,
    controller,
    availableWidth: Math.max(136, width - 44 - 176),
    onContextMenu: viewId => { setMenuViewId(viewId); setMenuNotice(undefined) },
    onClose: close,
    showOverflow: false,
  }),
  createElement('div', { className: 'pwr-tab-actions', role: 'group', 'aria-label': t('chrome.paneActions') },
    createElement('button', {
      type: 'button', title: t('chrome.openView'), 'aria-label': t('chrome.openView'),
      id: 'pwo-open-view',
      'data-pane-open-view-trigger': 'overlay',
      onClick: () => setManagementMode('open'),
    }, createElement(WorkbenchIcon, { name: 'add' })),
    createElement('button', {
      type: 'button',
      className: 'pwr-tab-manager-trigger',
      title: t('management.manageTabs'),
      'aria-label': t('management.manageTabs'),
      onClick: () => setManagementMode('manage'),
    }, createElement(WorkbenchIcon, { name: 'list' }), createElement('span', null, projection.tabs.length)),
    active === undefined ? null : createElement('button', {
      type: 'button', title: formatT('chrome.moreActions', { name: active.title }), 'aria-label': formatT('chrome.moreActions', { name: active.title }),
      'aria-haspopup': 'menu',
      onClick: () => { setMenuViewId(active.id); setMenuNotice(undefined) },
    }, createElement(WorkbenchIcon, { name: 'more' })),
    active === undefined ? null : createElement('button', {
      type: 'button',
      title: geometryReasonText ?? t('chrome.maximizePane'),
      'aria-label': t('chrome.maximizePane'),
      disabled: geometryReason !== undefined,
      'aria-disabled': geometryReason !== undefined,
      'data-pane-gated-intent': 'maximize_group',
      onClick: geometryReason === undefined ? () => { controller.dispatch({ type: 'maximize_group', groupId: projection.group.id }) } : undefined,
    }, createElement(WorkbenchIcon, { name: 'maximize' })),
    createElement('button', {
      type: 'button', title: t('overlay.dismiss'), 'aria-label': t('overlay.dismiss'), onClick: () => controller.hide(),
    }, createElement(WorkbenchIcon, { name: 'collapse' })),
  ),
  insertion === undefined ? null : createElement('div', {
    className: 'pwo-insertion',
    'data-pane-insertion-marker': 'center',
    'data-pane-insertion-group': insertion.groupId,
    'data-pane-insertion-index': insertion.index,
    role: 'status',
    'aria-label': t('overlay.reorderHint'),
    style: { left: `${insertionLeft}px` },
  }),
  ),
  menuView === undefined ? null : createElement('div', { className: 'pwr-menu', role: 'menu', 'aria-label': formatT('chrome.viewActions', { name: menuView.title }) },
    menuNotice === undefined ? null : createElement('p', { className: 'pwo-menu-note', role: 'status' }, menuNotice),
    createElement('button', { className: 'pwr-menu-item', role: 'menuitem', type: 'button', onClick: () => { controller.dispatch({ type: 'pin_view', viewId: menuView.id }); setMenuViewId(undefined) } }, ...menuItem(menuView.pinned ? 'unpin' : 'pin', menuView.pinned ? t('tab.unpin') : t('tab.pin'))),
    createElement('button', { className: 'pwr-menu-item', role: 'menuitem', type: 'button', onClick: () => { close(menuView.id); setMenuViewId(undefined) } }, ...menuItem('close', formatT('tab.closeWithName', { name: menuView.title }))),
    createElement('button', { className: 'pwr-menu-item', role: 'menuitem', type: 'button', 'data-pane-bulk-close': 'others', onClick: () => bulkClose('others', menuView.id) }, ...menuItem('list', t('tab.closeOthers'))),
    createElement('button', { className: 'pwr-menu-item', role: 'menuitem', type: 'button', 'data-pane-bulk-close': 'unpinned', onClick: () => bulkClose('unpinned', menuView.id) }, ...menuItem('list', t('tab.closeUnpinned'))),
    createElement('div', { className: 'pwr-menu-separator', role: 'separator' }),
    createElement('button', { className: 'pwr-menu-item', role: 'menuitem', type: 'button', onClick: () => { controller.hide(); setMenuViewId(undefined) } }, ...menuItem('collapse', t('overlay.dismiss'))),
    ...(['right', 'bottom'] as const).map(region => createElement('button', {
      className: 'pwr-menu-item',
      key: `move-${region}`,
      role: 'menuitem',
      type: 'button',
      disabled: geometryReason !== undefined,
      'aria-disabled': geometryReason !== undefined,
      title: geometryReasonText,
      'data-pane-gated-intent': `move_view:${region}`,
      onClick: geometryReason === undefined
        ? () => {
          const target = Object.values(state.groups)
            .filter(group => group.region === region && (!group.locked || group.role === menuView.role))
            .sort((left, right) => Number(left.role !== menuView.role && left.role !== 'general') - Number(right.role !== menuView.role && right.role !== 'general') || Number(left.locked) - Number(right.locked) || left.id.localeCompare(right.id))[0]
          if (target !== undefined) controller.dispatch({ type: 'move_view', viewId: menuView.id, targetGroupId: target.id })
          setMenuViewId(undefined)
        }
        : undefined,
    }, ...menuItem(region === 'right' ? 'move-right' : 'move-down', region === 'right' ? t('tab.moveToRight') : t('tab.moveToBottom')))),
    createElement('div', { className: 'pwr-menu-separator', role: 'separator' }),
    ...(['left', 'right', 'top', 'bottom'] as const).map(edge => createElement('button', {
      className: 'pwr-menu-item',
      key: `split-${edge}`,
      role: 'menuitem',
      type: 'button',
      disabled: geometryReason !== undefined,
      'aria-disabled': geometryReason !== undefined,
      title: geometryReasonText,
      'data-pane-gated-intent': `split_with_view:${edge}`,
      onClick: geometryReason === undefined
        ? () => {
          controller.dispatch({ type: 'split_with_view', viewId: menuView.id, targetGroupId: menuView.groupId, edge })
          setMenuViewId(undefined)
        }
        : undefined,
    }, ...menuItem(splitIcon(edge), formatT('tab.splitEdge', { edge: t(`drag.edge.${edge}`) })))),
    handoff === undefined ? null : createElement(PaneViewHandoffSection, { view: menuView, handoff, onHandled: () => setMenuViewId(undefined) }),
  ),
  active === undefined ? null : createElement('div', {
    id: `pane-panel-${active.id}`,
    className: 'pwr-panel',
    role: 'tabpanel',
    'aria-labelledby': `pane-tab-${active.id}`,
  }, createElement(PaneViewContent, {
    view: active,
    registration,
    registry,
    controller,
    onClose: close,
  })),
  ),
  managementMode === undefined ? null : createElement(PaneManagementCenter, {
    mode: managementMode,
    registry,
    controller,
    conversationSearch,
    workspaceContext,
    initialProtectedViews: reviewProtected,
    onClose: () => { setManagementMode(undefined); setReviewProtected([]) },
    restoreFocus: () => {
      const trigger = rootRef.current?.querySelector('[data-pane-open-view-trigger]')
      if (trigger instanceof HTMLElement) trigger.focus()
    },
  }),
  createElement(PaneCloseUndoToast, { controller }),
  )
}

export const OVERLAY_SHEET_BREAKPOINT_PX = 720 as const
