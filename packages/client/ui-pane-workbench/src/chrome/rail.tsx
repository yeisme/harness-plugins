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
import { DSH_SUBAGENT_MONITOR_VIEW_KIND, iconForView, RIGHT_RAIL_WIDTH } from './shared.js'
import { FontScaleControls, openAgentsMonitor } from './group-chrome.js'

export interface PaneActivityRailProps {
  readonly registry: PaneViewRegistry
  readonly controller: PaneWorkbenchController
  readonly state: PaneWorkspaceV1
  /** When the body is hidden the rail shows its own Open View trigger. */
  readonly bodyVisible: boolean
  readonly onOpenPicker: () => void
}

/** Activity rail shared by the Core host right region and the Tier 0 overlay host. */

export function PaneActivityRail(props: PaneActivityRailProps): ReactNode {
  const { registry, controller, state } = props
  const openedViews = Object.values(state.views)
  const agentsRegistered = registry.has(DSH_SUBAGENT_MONITOR_VIEW_KIND)
  const agentsActive = openedViews.some(view => view.kind === DSH_SUBAGENT_MONITOR_VIEW_KIND && state.groups[view.groupId]?.activeTabId === view.id)
  return createElement('nav', { className: 'pwr-rail', 'aria-label': t('chrome.workspaceActivity') },
    props.bodyVisible ? null : createElement('button', { type: 'button', title: t('chrome.openView'), 'aria-label': t('chrome.openView'), 'data-pane-open-view-trigger': 'rail', onClick: props.onOpenPicker }, createElement(WorkbenchIcon, { name: 'add' })),
    createElement('button', {
      type: 'button', title: t('rail.explorer'), 'aria-label': t('rail.explorer'),
      className: openedViews.some(view => view.kind === DSH_EXPLORER_VIEW_KIND && state.groups[view.groupId]?.activeTabId === view.id) ? 'pwr-active' : undefined,
      onClick: () => openExplorerNavigator(controller),
    }, createElement(WorkbenchIcon, { name: 'folder' })),
    createElement('button', {
      type: 'button', title: t('rail.sourceControl'), 'aria-label': t('rail.sourceControl'),
      className: openedViews.some(view => view.kind === DSH_SOURCE_CONTROL_VIEW_KIND && state.groups[view.groupId]?.activeTabId === view.id) ? 'pwr-active' : undefined,
      onClick: () => openSourceControlNavigator(controller),
    }, createElement(WorkbenchIcon, { name: 'git' })),
    agentsRegistered ? createElement('button', {
      type: 'button', title: t('rail.agents'), 'aria-label': t('rail.agents'),
      className: agentsActive ? 'pwr-active' : undefined,
      'data-pane-rail-agents': true,
      onClick: () => openAgentsMonitor(controller),
    }, createElement(WorkbenchIcon, { name: 'agents' })) : null,
    ...openedViews.filter(view => view.kind !== DSH_EXPLORER_VIEW_KIND && view.kind !== DSH_SOURCE_CONTROL_VIEW_KIND && view.kind !== DSH_SUBAGENT_MONITOR_VIEW_KIND).map(view => createElement('button', {
      key: view.id, type: 'button', title: view.title, 'aria-label': formatT('chrome.openNamedView', { name: view.title }),
      className: state.activeGroupId === view.groupId && state.groups[view.groupId]?.activeTabId === view.id ? 'pwr-active' : undefined,
      onClick: () => controller.dispatch({ type: 'activate_view', viewId: view.id }),
    }, createElement(WorkbenchIcon, { name: iconForView(view) }))),
    createElement('button', {
      type: 'button', title: t('rail.customize'), 'aria-label': t('rail.customize'),
      onClick: () => openPaneWorkbenchCoreView(controller, DSH_WORKSPACE_DESIGNER_VIEW_KIND),
    }, createElement(WorkbenchIcon, { name: 'workspace' })),
    createElement(FontScaleControls),
  )
}
