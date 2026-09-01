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
import { subscriptionHandle } from '@yeisme/dsh-plugin-contracts'
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
} from './artifacts.js'
import { ArtifactRefSchema } from '@yeisme/dsh-pane-protocol'
import { PaneArtifactHandoffMenu, type ArtifactHandoffTargetV1 } from './handoff-menu.js'
import {
  resolvePaneManagementShortcut,
  type PaneConversationSearchHostV1,
  type PaneManagementKeymapV1,
  type PaneWorkspaceContextProviderV1,
} from './management.js'
import type { PaneDragTargetV1 } from './interactions.js'
import { PaneResizeSession } from './interactions.js'
import type { PaneWorkbenchController } from './controller.js'
import { isPaneCoreViewId, openPaneWorkbenchCoreView, DSH_WORKSPACE_DESIGNER_VIEW_KIND, type PaneCoreViewId } from './core-pane.js'
import { DSH_EXPLORER_VIEW_KIND, openExplorerNavigator } from './explorer/provider.js'
import { openSourceControlNavigator } from './git/provider.js'
import { DSH_SOURCE_CONTROL_VIEW_KIND } from './git/source-control.js'
import { PaneTabActions, PaneTabStrip } from './tabs.js'
import { PaneCloseUndoToast, PaneManagementCenter } from './management-center.js'
import type { PaneManagementMode } from './management.js'
import type { PaneViewRegistry, PaneViewRegistrationV1 } from './view-registry.js'
import { WorkbenchIcon } from './icon.js'
import type { WorkbenchIconName } from './icon.js'
import { formatT, getLocaleRevision, subscribeLocale, t, tWithFallback } from './i18n/locale.js'
import {
  applyWorkbenchFontSizeTo,
  getWorkbenchFontSize,
  stepWorkbenchFontSize,
  subscribeWorkbenchFontSize,
  WORKBENCH_FONT_SIZE_MAX,
  WORKBENCH_FONT_SIZE_MIN,
} from './font-scale.js'
import type {
  PaneGroupV1,
  PaneBulkCloseProtectedViewV1,
  PaneRegionId,
  PaneSplitNodeV1,
  PaneViewInstanceV1,
  PaneWorkspaceV1,
} from './workspace.js'
import {
  DSH_SUBAGENT_MONITOR_VIEW_KIND, PANE_MIN_HEIGHT, PANE_MIN_WIDTH, REGION_STYLES, RIGHT_RAIL_WIDTH,
  groupIds, paneDropTargetLabel, splitFits,
} from './chrome/shared.js'
import { PaneViewContent } from './chrome/view-host.js'
import { PaneViewQuickPick, usePaneTabFocusRestore } from './chrome/quick-pick.js'
import { paneViewArtifactSource, paneArtifactDropHandlers, type PaneArtifactHandoffContextV1 } from './chrome/handoff.js'
import { SplitTree } from './chrome/split-tree.js'
import { PaneActivityRail } from './chrome/rail.js'

export type PaneWorkspaceRegionMode = 'hidden' | 'rail' | 'dock' | 'sheet' | 'maximized'

export interface PaneRegionChromeProps {
  readonly region: PaneRegionId
  readonly mode: PaneWorkspaceRegionMode
  readonly width: number
  readonly height: number
  readonly visible: boolean
  readonly maximized: boolean
  readonly registry: PaneViewRegistry
  readonly controller: PaneWorkbenchController
  /** Resolves DSH-owned React content for an allowlisted built-in Core Pane view. */
  readonly renderCoreView?: (id: PaneCoreViewId) => ReactNode
  /** Session artifact handoff wiring; the view More menu gains the handoff section when present. */
  readonly handoff?: PaneArtifactHandoffContextV1
  /** Optional owner-authored conversation search. Never used by the default local search path. */
  readonly conversationSearch?: PaneConversationSearchHostV1
  /** Additive shared keymap override. */
  readonly keymap?: Partial<PaneManagementKeymapV1>
  readonly workspaceContext?: PaneWorkspaceContextProviderV1
}

/**
 * Session-scoped artifact handoff wiring shared by the Core host and the Tier 0
 * overlay chrome. `onDispatch` routes through the probed channel
 * (`dispatchArtifactHandoff` with the local intent dispatcher as fallback).
 */

export type HiddenBottomDropPhase = 'hidden' | 'preview' | 'ready'

export function resolveHiddenBottomDropPhase(clientY: number, viewportHeight: number, coarse = false): HiddenBottomDropPhase {
  const height = Math.max(0, viewportHeight)
  const distance = height - clientY
  const ready = coarse ? Math.max(88, Math.min(136, height * 0.12)) : Math.max(64, Math.min(112, height * 0.09))
  const preview = coarse ? Math.max(136, Math.min(208, height * 0.18)) : Math.max(104, Math.min(176, height * 0.14))
  return distance <= ready ? 'ready' : distance <= preview ? 'preview' : 'hidden'
}

/** Single center-drop resolver for the Right/Bottom regions (V3 2.1: no duplicated drag-coordinator reads). */
function centerDropTarget(
  state: PaneWorkspaceV1,
  drag: { readonly drag: { readonly status: string; readonly viewId?: string } },
  groupId: string | undefined,
): PaneDragTargetV1 | undefined {
  if (groupId === undefined) return undefined
  const sourceId = drag.drag.status === 'dragging' || drag.drag.status === 'pending' ? drag.drag.viewId : undefined
  const source = sourceId === undefined ? undefined : state.views[sourceId]
  const group = state.groups[groupId]
  if (source === undefined || group === undefined) return undefined
  const locked = group.locked && group.role !== source.role
  return { groupId, edge: 'center', enabled: !locked, reason: locked ? 'locked' : undefined }
}

export function PaneRegionChrome(props: PaneRegionChromeProps): ReactNode {
  useSyncExternalStore(subscribeLocale, getLocaleRevision, getLocaleRevision)
  const state = useSyncExternalStore(props.controller.subscribeWorkspace, props.controller.getSnapshot, props.controller.getSnapshot)
  const drag = useSyncExternalStore(props.controller.drag.subscribe, props.controller.drag.getSnapshot, props.controller.drag.getSnapshot)
  const [managementMode, setManagementMode] = useState<PaneManagementMode>()
  const [reviewProtected, setReviewProtected] = useState<readonly PaneBulkCloseProtectedViewV1[]>([])
  const [fontSize, setFontSize] = useState(getWorkbenchFontSize)
  const [hiddenBottomPhase, setHiddenBottomPhase] = useState<HiddenBottomDropPhase>('hidden')
  const [, setRegistryRevision] = useState(0)
  const rootRef = useRef<HTMLElement>(null)
  const region = state.regions[props.region]
  const regionGroupIds = groupIds(region.root)
  const bodyVisible = props.mode === 'dock' || props.mode === 'sheet' || props.mode === 'maximized'
  const hasViews = regionGroupIds.some(id => (state.groups[id]?.tabs.length ?? 0) > 0)
  const emptyGroupId = !hasViews ? regionGroupIds[0] : undefined
  const emptyTarget = emptyGroupId !== undefined && drag.target?.groupId === emptyGroupId ? drag.target : undefined
  const emptyDropTarget = (): PaneDragTargetV1 | undefined => centerDropTarget(state, drag, emptyGroupId)
  const hiddenBottomGroupId = props.region === 'right' && !state.regions.bottom.visible && drag.drag.status !== 'idle'
    ? groupIds(state.regions.bottom.root)[0]
    : undefined
  const hiddenBottomTarget = hiddenBottomGroupId !== undefined && drag.target?.groupId === hiddenBottomGroupId ? drag.target : undefined
  const hiddenBottomDropTarget = (): PaneDragTargetV1 | undefined => centerDropTarget(state, drag, hiddenBottomGroupId)

  useEffect(() => subscribeWorkbenchFontSize(setFontSize), [])
  useEffect(() => {
    const registryEvents = subscriptionHandle(props.registry.subscribe(() => setRegistryRevision(value => value + 1)))
    return () => registryEvents.unsubscribe()
  }, [props.registry])
  useEffect(() => { applyWorkbenchFontSizeTo(rootRef.current, fontSize) }, [fontSize])
  useEffect(() => {
    if (props.region !== 'bottom' || !region.visible || hasViews) return
    props.controller.dispatch({ type: 'set_region_visibility', region: 'bottom', visible: false })
  }, [hasViews, props.controller, props.region, region.visible])
  useEffect(() => {
    const cancel = (): void => props.controller.drag.cancel(t('drag.windowBlurred'))
    window.addEventListener('blur', cancel)
    return () => window.removeEventListener('blur', cancel)
  }, [props.controller])
  useEffect(() => {
    if (hiddenBottomGroupId === undefined) { setHiddenBottomPhase('hidden'); return }
    const target = (): PaneDragTargetV1 | undefined => {
      const workspace = props.controller.getSnapshot()
      const snapshot = props.controller.drag.getSnapshot()
      const sourceId = snapshot.drag.status === 'dragging' || snapshot.drag.status === 'pending' ? snapshot.drag.viewId : undefined
      const source = sourceId === undefined ? undefined : workspace.views[sourceId]
      const group = workspace.groups[hiddenBottomGroupId]
      if (source === undefined || group === undefined) return undefined
      const locked = group.locked && group.role !== source.role
      return { groupId: hiddenBottomGroupId, edge: 'center', enabled: !locked, reason: locked ? 'locked' : undefined }
    }
    const move = (event: globalThis.PointerEvent): void => {
      const phase = resolveHiddenBottomDropPhase(event.clientY, window.innerHeight, event.pointerType === 'touch' || event.pointerType === 'pen')
      setHiddenBottomPhase(phase)
      if (phase === 'ready') props.controller.drag.move(event.clientX, event.clientY, target())
    }
    const drop = (event: globalThis.PointerEvent): void => {
      const phase = resolveHiddenBottomDropPhase(event.clientY, window.innerHeight, event.pointerType === 'touch' || event.pointerType === 'pen')
      if (phase === 'ready') props.controller.drag.drop(target())
      else if (props.controller.drag.getSnapshot().drag.status !== 'idle') props.controller.drag.cancel()
    }
    const cancel = (): void => props.controller.drag.cancel()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', drop)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', drop)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [hiddenBottomGroupId, props.controller])

  const restorePickerFocus = (): void => {
    const trigger = rootRef.current?.querySelector('[data-pane-open-view-trigger]')
    if (trigger instanceof HTMLElement) trigger.focus()
  }

  return createElement('aside', {
    ref: rootRef,
    className: 'pwr-root',
    'aria-label': t(props.region === 'right' ? 'chrome.rightWorkspace' : 'chrome.bottomWorkspace'),
    'data-region': props.region,
    'data-mode': props.mode,
    'data-font-size': fontSize,
    'data-picker-open': managementMode !== undefined || undefined,
    'data-pane-workbench-visible': bodyVisible,
    'data-pane-has-views': hasViews,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const shortcut = resolvePaneManagementShortcut(event, props.keymap)
      if (shortcut === 'open_center') {
        event.preventDefault()
        setManagementMode('open')
        return
      }
      if (shortcut === 'close_active' || shortcut === 'close_unpinned') {
        event.preventDefault()
        const activeGroup = state.activeGroupId === undefined ? undefined : state.groups[state.activeGroupId]
        if (shortcut === 'close_unpinned') {
          const viewIds = Object.values(state.views).filter(view => !view.pinned).map(view => view.id)
          if (activeGroup !== undefined) {
            const result = props.controller.dispatch({ type: 'bulk_close_safe', groupId: activeGroup.id, mode: 'unpinned', viewIds })
            const protectedViews = result.details?.bulkCloseSafe?.protectedViews ?? []
            if (protectedViews.length > 0) { setReviewProtected(protectedViews); setManagementMode('manage') }
          }
        } else if (activeGroup?.activeTabId !== undefined) {
          const activeView = state.views[activeGroup.activeTabId]
          if (activeView !== undefined) {
            const result = props.controller.dispatch({ type: 'bulk_close_safe', groupId: activeView.groupId, mode: 'group', viewIds: [activeView.id] })
            const protectedViews = result.details?.bulkCloseSafe?.protectedViews ?? []
            if (protectedViews.length > 0) { setReviewProtected(protectedViews); setManagementMode('manage') }
          }
        }
        return
      }
      if (shortcut === 'restore_closed') {
        event.preventDefault()
        props.controller.restoreClosedBatch()
        return
      }
      if (event.key !== 'Escape') return
      if (state.maximizedGroupId !== undefined) { event.preventDefault(); props.controller.dispatch({ type: 'restore_layout' }) }
      else if (drag.drag.status !== 'idle') { event.preventDefault(); props.controller.drag.cancel() }
      else if (managementMode !== undefined) { event.preventDefault(); setManagementMode(undefined); restorePickerFocus() }
    },
  },
  createElement('style', { 'data-pane-workbench-region-styles': true }, REGION_STYLES),
  props.region !== 'right' || drag.visuals.ghost === undefined ? null : createElement('div', {
    className: 'pwr-drag-ghost',
    'data-pane-drag-ghost': true,
    style: { left: `${drag.visuals.ghost.x}px`, top: `${drag.visuals.ghost.y}px` },
  }, createElement('span', null, drag.visuals.ghost.title)),
  hiddenBottomGroupId === undefined || hiddenBottomPhase === 'hidden' ? null : createElement('div', {
    className: 'pwr-hidden-bottom-drop',
    'data-pane-hidden-bottom-drop': true,
    'data-pane-drop-phase': hiddenBottomPhase,
    role: 'status',
    'aria-label': hiddenBottomPhase === 'ready' ? t('drag.openBottom') : t('drag.approachBottom'),
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => { props.controller.drag.move(event.clientX, event.clientY, hiddenBottomDropTarget()) },
    onPointerUp: () => { props.controller.drag.drop(hiddenBottomDropTarget()) },
    onPointerCancel: () => props.controller.drag.cancel(),
  }, createElement('span', { className: 'pwr-drop-label' }, t(hiddenBottomPhase === 'ready' ? 'drag.openBottom' : 'drag.approachBottom'))),
  createElement('div', { className: 'pwr-status', role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, drag.announcement || props.controller.announcement),
  props.region === 'right' ? createElement(PaneActivityRail, {
    registry: props.registry,
    controller: props.controller,
    state,
    bodyVisible,
    onOpenPicker: () => setManagementMode('open'),
  }) : null,
  createElement('div', { className: 'pwr-body', 'data-body-visible': bodyVisible },
    createElement('div', {
      className: 'pwr-tree',
      'data-pane-empty-drop-region': !hasViews ? props.region : undefined,
      'data-pane-drop-edge': emptyTarget?.edge,
      'data-pane-drop-enabled': emptyTarget?.enabled,
      onPointerMove: !hasViews ? (event: PointerEvent<HTMLElement>) => { props.controller.drag.move(event.clientX, event.clientY, emptyDropTarget()) } : undefined,
      onPointerUp: !hasViews ? () => { props.controller.drag.drop() } : undefined,
      onPointerCancel: !hasViews ? () => props.controller.drag.cancel() : undefined,
    },
      emptyTarget === undefined ? null : createElement('div', { className: 'pwr-drop pwr-empty-drop', role: 'status', 'aria-label': paneDropTargetLabel(emptyTarget) },
        createElement('span', { className: 'pwr-drop-label' }, paneDropTargetLabel(emptyTarget))),
      hasViews
        ? createElement(SplitTree, { node: region.root, state, registry: props.registry, controller: props.controller, regionWidth: props.width, regionHeight: props.height, onOpenPicker: () => setManagementMode('open'), onOpenManager: () => setManagementMode('manage'), onReviewProtected: items => { setReviewProtected(items); setManagementMode('manage') }, renderCoreView: props.renderCoreView, handoff: props.handoff })
        : createElement('section', { className: 'pwr-empty' },
          createElement('p', null, t('state.empty')),
          createElement('button', { type: 'button', 'data-pane-open-view-trigger': 'empty', onClick: () => setManagementMode('open') }, t('chrome.openAView')),
          createElement('button', { type: 'button', onClick: () => props.controller.dispatch({ type: 'set_region_visibility', region: props.region, visible: false }) }, t(props.region === 'right' ? 'chrome.hideRight' : 'chrome.hideBottom'))),
    ),
  ),
  managementMode === undefined ? null : createElement(PaneManagementCenter, {
    mode: managementMode,
    registry: props.registry,
    controller: props.controller,
    conversationSearch: props.conversationSearch,
    workspaceContext: props.workspaceContext,
    initialProtectedViews: reviewProtected,
    onClose: () => { setManagementMode(undefined); setReviewProtected([]) },
    restoreFocus: restorePickerFocus,
  }),
  createElement(PaneCloseUndoToast, { controller: props.controller }),
  )
}

export {
  PANE_MIN_WIDTH, PANE_MIN_HEIGHT, SPLITTER_SIZE, RIGHT_RAIL_WIDTH, REGION_STYLES,
  groupIds, targetGroup, iconForView, splitIcon, menuItem, splitFits, paneDropTargetLabel,
} from './chrome/shared.js'
export { PaneViewBoundary, PaneViewContent, type PaneViewContentProps } from './chrome/view-host.js'
export { PaneViewQuickPick, usePaneTabFocusRestore, type PaneViewQuickPickProps } from './chrome/quick-pick.js'
export {
  paneViewArtifactSource, paneArtifactDropHandlers, type PaneArtifactHandoffContextV1,
} from './chrome/handoff.js'
export { PaneViewHandoffSection } from './chrome/handoff.js'
export { PaneActivityRail, type PaneActivityRailProps } from './chrome/rail.js'
