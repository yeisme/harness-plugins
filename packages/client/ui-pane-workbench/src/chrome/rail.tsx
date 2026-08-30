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
import { WorkbenchIconButton } from './control.js'

export interface PaneActivityRailProps {
  readonly registry: PaneViewRegistry
  readonly controller: PaneWorkbenchController
  readonly state: PaneWorkspaceV1
  /** When the body is hidden the rail shows its own Open View trigger. */
  readonly bodyVisible: boolean
  readonly onOpenPicker: () => void
}


const CORE_RAIL_KINDS = new Set<string>([DSH_EXPLORER_VIEW_KIND, DSH_SOURCE_CONTROL_VIEW_KIND, DSH_SUBAGENT_MONITOR_VIEW_KIND])

interface RailCategory {
  readonly kind: string
  readonly label: string
  readonly icon: WorkbenchIconName
  readonly views: readonly PaneViewInstanceV1[]
  readonly targetViewId: string
}

/** Aggregate open views into one category per kind; disposed providers drop out. */
export function deriveRailCategories(
  views: readonly PaneViewInstanceV1[],
  state: PaneWorkspaceV1,
  registry: PaneViewRegistry,
): readonly RailCategory[] {
  const byKind = new Map<string, PaneViewInstanceV1[]>()
  for (const view of views) {
    if (CORE_RAIL_KINDS.has(view.kind)) continue
    if (!registry.has(view.kind)) continue
    const bucket = byKind.get(view.kind)
    if (bucket === undefined) byKind.set(view.kind, [view])
    else bucket.push(view)
  }
  return [...byKind.entries()].map(([kind, members]) => {
    const active = members.find(view => state.groups[view.groupId]?.activeTabId === view.id)
    return {
      kind,
      label: kind.split('.').pop() ?? kind,
      icon: iconForView(members[0]!),
      views: members,
      targetViewId: (active ?? members[0]!).id,
    }
  })
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
    // V3 2.3: one rail entry per provider category (view kind) — multiple
    // Terminal/Document/Media resources never duplicate rail buttons. The
    // count rides the decorative badge; activation targets the category's
    // active view or its first member. Kinds whose provider disposed (not
    // registered and not core) drop out of the rail.
    ...deriveRailCategories(openedViews, state, registry).map(category => {
      const isActive = category.views.some(view => state.groups[view.groupId]?.activeTabId === view.id)
      return createElement(WorkbenchIconButton, {
        key: category.kind,
        icon: category.icon,
        label: category.views.length === 1
          ? formatT('chrome.openNamedView', { name: category.views[0]!.title })
          : formatT('chrome.categoryViews', { name: category.label, count: category.views.length }),
        status: isActive ? 'active' : 'default',
        className: isActive ? 'pwr-active' : undefined,
        badge: category.views.length > 1 ? String(category.views.length) : undefined,
        onClick: () => controller.dispatch({ type: 'activate_view', viewId: category.targetViewId }),
      })
    }),
    createElement('button', {
      type: 'button', title: t('rail.customize'), 'aria-label': t('rail.customize'),
      onClick: () => openPaneWorkbenchCoreView(controller, DSH_WORKSPACE_DESIGNER_VIEW_KIND),
    }, createElement(WorkbenchIcon, { name: 'workspace' })),
    createElement(FontScaleControls),
  )
}
