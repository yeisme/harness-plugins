import {
  Component,
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { panelVar, type PanelTokenName } from '@yeisme/dsh-client-ui-visual-kit'
import type { ArtifactIntentV1, PaneContextV1 } from '@yeisme/dsh-pane-protocol'
import {
  ARTIFACT_INTENT_DRAG_MIME,
  beginArtifactGesture,
  buildArtifactGestureIntent,
  createArtifactDragPayload,
  isArtifactIntentKind,
  parseArtifactDragPayload,
  type ArtifactHandoffChannelV1,
  type ArtifactHandoffEvidenceV1,
} from '../artifacts.js'
import { ArtifactRefSchema } from '@yeisme/dsh-pane-protocol'
import { PaneArtifactHandoffMenu, type ArtifactHandoffTargetV1 } from '../handoff-menu.js'
import {
  resolvePaneManagementShortcut,
  type PaneConversationSearchHostV1,
  type PaneManagementKeymapV1,
  type PaneWorkspaceContextProviderV1,
} from '../management.js'
import type { PaneDragTargetV1 } from '../interactions.js'
import { PaneResizeSession } from '../interactions.js'
import type { PaneWorkbenchController } from '../controller.js'
import { isPaneCoreViewId, openPaneWorkbenchCoreView, DSH_WORKSPACE_DESIGNER_VIEW_KIND, type PaneCoreViewId } from '../core-pane.js'
import { DSH_EXPLORER_VIEW_KIND, openExplorerNavigator } from '../explorer/provider.js'
import { openSourceControlNavigator } from '../git/provider.js'
import { DSH_SOURCE_CONTROL_VIEW_KIND } from '../git/source-control.js'
import { PaneTabActions, PaneTabStrip } from '../tabs.js'
import { PaneCloseUndoToast, PaneManagementCenter } from '../management-center.js'
import type { PaneManagementMode } from '../management.js'
import type { PaneViewRegistry, PaneViewRegistrationV1 } from '../view-registry.js'
import { WorkbenchIcon } from '../icon.js'
import type { WorkbenchIconName } from '../icon.js'
import { formatT, getLocaleRevision, subscribeLocale, t, tWithFallback } from '../i18n/locale.js'
import {
  applyWorkbenchFontSizeTo,
  getWorkbenchFontSize,
  stepWorkbenchFontSize,
  subscribeWorkbenchFontSize,
  WORKBENCH_FONT_SIZE_MAX,
  WORKBENCH_FONT_SIZE_MIN,
} from '../font-scale.js'
import type {
  PaneGroupV1,
  PaneBulkCloseProtectedViewV1,
  PaneRegionId,
  PaneSplitNodeV1,
  PaneViewInstanceV1,
  PaneWorkspaceV1,
} from '../workspace.js'
import {
  DSH_SUBAGENT_MONITOR_VIEW_KIND, PANE_MIN_HEIGHT, PANE_MIN_WIDTH, RIGHT_RAIL_WIDTH,
  groupIds, menuItem, paneDropTargetLabel, splitFits, splitIcon, targetGroup,
} from './shared.js'
import { PaneViewContent } from './view-host.js'
import { PaneViewHandoffSection, paneArtifactDropHandlers, type PaneArtifactHandoffContextV1 } from './handoff.js'
import { usePaneTabFocusRestore } from './quick-pick.js'

export function GroupChrome(props: {
  group: PaneGroupV1
  state: PaneWorkspaceV1
  registry: PaneViewRegistry
  controller: PaneWorkbenchController
  regionWidth: number
  regionHeight: number
  onOpenPicker: () => void
  onOpenManager: () => void
  onReviewProtected: (items: readonly PaneBulkCloseProtectedViewV1[]) => void
  renderCoreView?: (id: PaneCoreViewId) => ReactNode
  handoff?: PaneArtifactHandoffContextV1
}): ReactNode {
  const [menuViewId, setMenuViewId] = useState<string>()
  const groupElement = useRef<HTMLElement>(null)
  const drag = useSyncExternalStore(props.controller.drag.subscribe, props.controller.drag.getSnapshot, props.controller.drag.getSnapshot)
  const active = props.group.activeTabId === undefined ? undefined : props.state.views[props.group.activeTabId]
  const maximized = props.state.maximizedGroupId === props.group.id
  const registration = active === undefined ? undefined : props.registry.get(active.kind)
  const target = drag.target?.groupId === props.group.id ? drag.target : undefined
  const reorder = target?.enabled === true && target.edge === 'center' && target.index !== undefined
  const selectActiveTabId = useMemo(() => (state: PaneWorkspaceV1) => state.groups[props.group.id]?.activeTabId, [props.group.id])
  usePaneTabFocusRestore(props.controller, groupElement, selectActiveTabId, '[data-pane-open-view-trigger]')
  const close = (viewId: string): void => {
    const view = props.state.views[viewId]
    if (view === undefined) return
    const result = props.controller.dispatch({ type: 'bulk_close_safe', groupId: view.groupId, mode: 'group', viewIds: [viewId] })
    const protectedViews = result.details?.bulkCloseSafe?.protectedViews ?? []
    if (protectedViews.length > 0) props.onReviewProtected(protectedViews)
  }
  const dropTarget = (event: PointerEvent<HTMLElement>): PaneDragTargetV1 | undefined => {
    const sourceId = drag.drag.status === 'dragging' ? drag.drag.viewId : drag.drag.status === 'pending' ? drag.drag.viewId : undefined
    const source = sourceId === undefined ? undefined : props.state.views[sourceId]
    if (source === undefined) return undefined
    const rect = event.currentTarget.getBoundingClientRect()
    const tab = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-pane-tab-index]') : null
    let edge: PaneDragTargetV1['edge'] = 'center'
    let index: number | undefined
    if (tab !== null) {
      const rawIndex = Number(tab.dataset.paneTabIndex)
      index = Number.isSafeInteger(rawIndex) ? rawIndex + Number(event.clientX >= tab.getBoundingClientRect().left + tab.getBoundingClientRect().width / 2) : props.group.tabs.length
    } else if (rect.width > 0 && rect.height > 0) {
      const x = (event.clientX - rect.left) / rect.width
      const y = (event.clientY - rect.top) / rect.height
      edge = x <= 0.2 ? 'left' : x >= 0.8 ? 'right' : y <= 0.2 ? 'top' : y >= 0.8 ? 'bottom' : 'center'
    }
    const locked = props.group.locked && props.group.role !== source.role
    const tooSmall = !splitFits(edge, rect.width, rect.height)
    const noOp = source.groupId === props.group.id && edge === 'center' && index === undefined
    return { groupId: props.group.id, edge, index, enabled: !locked && !tooSmall && !noOp, reason: locked ? 'locked' : tooSmall ? 'minimum_size' : noOp ? 'already_in_group' : undefined }
  }
  const menuView = menuViewId === undefined ? undefined : props.state.views[menuViewId]
  const measured = groupElement.current?.getBoundingClientRect()
  const menuWidth = measured !== undefined && measured.width > 0
    ? measured.width
    : Math.max(0, props.regionWidth - (props.group.region === 'right' ? RIGHT_RAIL_WIDTH : 0))
  const menuHeight = measured !== undefined && measured.height > 0
    ? measured.height
    : Math.max(0, props.regionHeight)
  const content = active === undefined
    ? null
    : createElement(PaneViewContent, {
      view: active,
      registration,
      registry: props.registry,
      controller: props.controller,
      renderCoreView: props.renderCoreView,
      onClose: close,
    })

  return createElement('section', {
    ref: groupElement,
    className: 'pwr-group',
    'data-pane-group': props.group.id,
    'data-pane-region': props.group.region,
    'data-pane-drop-edge': target?.edge,
    'data-pane-drop-enabled': target?.enabled,
    onPointerMove: (event: PointerEvent<HTMLElement>) => { props.controller.drag.move(event.clientX, event.clientY, dropTarget(event)) },
    onPointerUp: () => { props.controller.drag.drop() },
    onPointerCancel: () => props.controller.drag.cancel(),
    ...(props.handoff === undefined ? {} : paneArtifactDropHandlers(props.handoff)),
  },
  target === undefined || reorder ? null : (() => {
    const label = paneDropTargetLabel(target)
    return createElement('div', { className: 'pwr-drop', role: 'status', 'aria-label': label },
      createElement('span', { className: 'pwr-drop-label' }, label),
    )
  })(),
  !reorder ? null : createElement('div', {
    className: 'pwr-reorder-marker',
    role: 'status',
    'aria-label': paneDropTargetLabel(target),
    style: { left: `${Math.max(8, Math.min(menuWidth - 8, (drag.visuals.ghost?.x ?? 0) - (measured?.left ?? 0)))}px` },
  }, createElement('span', { className: 'pwr-drop-label pwr-reorder-label' }, paneDropTargetLabel(target))),
  createElement('div', { className: 'pwr-tabs', role: 'tablist', 'aria-label': formatT('chrome.tabListForRole', { role: tWithFallback(`role.${props.group.role}`, props.group.role) }) },
    createElement(PaneTabStrip, {
      group: props.group,
      state: props.state,
      controller: props.controller,
      availableWidth: Math.max(136, menuWidth - 176),
      onContextMenu: viewId => setMenuViewId(viewId),
      onClose: close,
      showOverflow: false,
    }),
    createElement(PaneTabActions, {
      group: props.group,
      activeView: active,
      maximized,
      controller: props.controller,
      onOpenPicker: props.onOpenPicker,
      onOpenManager: props.onOpenManager,
      tabCount: Object.keys(props.state.views).length,
      onContextMenu: viewId => setMenuViewId(viewId),
      onHidePane: () => props.controller.dispatch({ type: 'set_region_visibility', region: props.group.region, visible: false }),
    }),
  ),
  menuView === undefined ? null : createElement('div', { className: 'pwr-menu', role: 'menu', 'aria-label': formatT('chrome.viewActions', { name: menuView.title }) },
    createElement('button', { className: 'pwr-menu-item', role: 'menuitem', type: 'button', onClick: () => { openPaneWorkbenchCoreView(props.controller, DSH_WORKSPACE_DESIGNER_VIEW_KIND); setMenuViewId(undefined) } }, ...menuItem('workspace', t('rail.customize'))),
    createElement('button', { className: 'pwr-menu-item', role: 'menuitem', type: 'button', onClick: () => { props.controller.dispatch({ type: 'pin_view', viewId: menuView.id }); setMenuViewId(undefined) } }, ...menuItem(menuView.pinned ? 'unpin' : 'pin', menuView.pinned ? t('tab.unpin') : t('tab.pin'))),
    createElement('button', { className: 'pwr-menu-item', role: 'menuitem', type: 'button', onClick: () => { close(menuView.id); setMenuViewId(undefined) } }, ...menuItem('close', formatT('tab.closeWithName', { name: menuView.title }))),
    createElement('div', { className: 'pwr-menu-separator', role: 'separator' }),
    createElement('button', { className: 'pwr-menu-item', role: 'menuitem', type: 'button', onClick: () => {
      props.controller.dispatch({ type: 'set_region_visibility', region: props.group.region, visible: false })
      setMenuViewId(undefined)
    } }, ...menuItem('collapse', props.group.region === 'right' ? t('chrome.hideRight') : t('chrome.hideBottom'))),
    ...(['right', 'bottom'] as const).map(region => createElement('button', { className: 'pwr-menu-item', key: `move-${region}`, role: 'menuitem', type: 'button', onClick: () => {
      const group = targetGroup(props.state, menuView, region)
      if (group !== undefined) props.controller.dispatch({ type: 'move_view', viewId: menuView.id, targetGroupId: group.id })
      setMenuViewId(undefined)
    } }, ...menuItem(region === 'right' ? 'move-right' : 'move-down', region === 'right' ? t('tab.moveToRight') : t('tab.moveToBottom')))),
    createElement('div', { className: 'pwr-menu-separator', role: 'separator' }),
    ...(['left', 'right', 'top', 'bottom'] as const).map((edge) => {
      const enabled = splitFits(edge, menuWidth, menuHeight)
      return createElement('button', {
        className: 'pwr-menu-item',
        key: `split-${edge}`,
        role: 'menuitem',
        type: 'button',
        disabled: !enabled,
        'aria-disabled': !enabled,
        title: enabled ? undefined : formatT('tab.minimumSize', { width: PANE_MIN_WIDTH, height: PANE_MIN_HEIGHT }),
        onClick: () => {
          if (!enabled) return
          props.controller.dispatch({ type: 'split_with_view', viewId: menuView.id, targetGroupId: props.group.id, edge })
          setMenuViewId(undefined)
        },
      }, ...menuItem(splitIcon(edge), formatT('tab.splitEdge', { edge: t(`drag.edge.${edge}`) })))
    }),
    props.handoff === undefined ? null : createElement(PaneViewHandoffSection, {
      view: menuView,
      handoff: props.handoff,
      onHandled: () => setMenuViewId(undefined),
    }),
  ),
  active === undefined ? null : createElement('div', { id: `pane-panel-${active.id}`, className: 'pwr-panel', role: 'tabpanel', 'aria-labelledby': `pane-tab-${active.id}` }, content),
  )
}

export function FontScaleControls(): ReactNode {
  const [size, setSize] = useState(getWorkbenchFontSize)
  useEffect(() => subscribeWorkbenchFontSize(setSize), [])
  return createElement('div', { className: 'pwr-rail-fonts', role: 'group', 'aria-label': t('chrome.fontSize') },
    createElement('button', {
      type: 'button', title: t('chrome.decreaseFontSize'), 'aria-label': t('chrome.decreaseFontSize'),
      disabled: size <= WORKBENCH_FONT_SIZE_MIN,
      onClick: () => setSize(stepWorkbenchFontSize(-1)),
    }, createElement(WorkbenchIcon, { name: 'font-decrease' })),
    createElement('button', {
      type: 'button', title: t('chrome.increaseFontSize'), 'aria-label': t('chrome.increaseFontSize'),
      disabled: size >= WORKBENCH_FONT_SIZE_MAX,
      onClick: () => setSize(stepWorkbenchFontSize(1)),
    }, createElement(WorkbenchIcon, { name: 'font-increase' })),
  )
}

export function openAgentsMonitor(controller: PaneWorkbenchController): void {
  controller.openView({
    kind: DSH_SUBAGENT_MONITOR_VIEW_KIND,
    resourceKey: 'subagent:monitor',
    role: 'navigator',
    preferredRegion: 'right',
    retention: 'keep-alive',
    singleton: true,
    preview: false,
    pinned: true,
    title: t('rail.agents'),
  })
}
