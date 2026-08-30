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
import { groupIds, splitFits } from './shared.js'
import { GroupChrome } from './group-chrome.js'
import type { PaneArtifactHandoffContextV1 } from './handoff.js'

export function SplitTree(props: {
  node: PaneSplitNodeV1
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
  if (props.node.type === 'group') {
    const group = props.state.groups[props.node.groupId]
    if (group === undefined || group.tabs.length === 0) return null
    return createElement(GroupChrome, { ...props, group })
  }
  const firstHasViews = groupIds(props.node.first).some(id => (props.state.groups[id]?.tabs.length ?? 0) > 0)
  const secondHasViews = groupIds(props.node.second).some(id => (props.state.groups[id]?.tabs.length ?? 0) > 0)
  if (!firstHasViews) return secondHasViews ? createElement(SplitTree, { ...props, node: props.node.second }) : null
  if (!secondHasViews) return createElement(SplitTree, { ...props, node: props.node.first })
  return createElement(SplitBranch, { ...props, node: props.node })
}

function SplitBranch(props: {
  node: Extract<PaneSplitNodeV1, { type: 'split' }>
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
  const [preview, setPreview] = useState<number>()
  const container = useRef<HTMLDivElement>(null)
  const orientation = props.node.orientation
  const resize = useMemo(() => new PaneResizeSession(
    ratio => setPreview(ratio),
    ratio => props.controller.dispatch({ type: 'resize_split', region: props.state.groups[groupIds(props.node)[0]!]?.region ?? 'right', splitId: props.node.id, ratio }),
  ), [props.controller, props.node.id, props.state])
  useEffect(() => () => resize.cancel(), [resize])
  const ratio = preview ?? props.node.ratio
  const measure = (event: PointerEvent<HTMLDivElement>): number => {
    const rect = container.current?.getBoundingClientRect()
    if (rect === undefined) return ratio
    const raw = orientation === 'horizontal'
      ? (event.clientX - rect.left) / Math.max(1, rect.width)
      : (event.clientY - rect.top) / Math.max(1, rect.height)
    const minimum = orientation === 'horizontal' ? 280 / Math.max(1, rect.width) : 180 / Math.max(1, rect.height)
    return Math.max(minimum, Math.min(1 - minimum, raw))
  }
  return createElement('div', { ref: container, className: 'pwr-split', 'data-orientation': orientation, 'data-pane-split': props.node.id },
    createElement('div', { className: 'pwr-branch', style: { flex: `${ratio} 1 0` } }, createElement(SplitTree, { ...props, node: props.node.first })),
    createElement('div', {
      className: 'pwr-splitter', role: 'separator', tabIndex: 0,
      'aria-orientation': orientation === 'horizontal' ? 'vertical' : 'horizontal',
      'aria-valuemin': 15, 'aria-valuemax': 85, 'aria-valuenow': Math.round(ratio * 100),
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => { event.currentTarget.setPointerCapture(event.pointerId); resize.begin() },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resize.move(measure(event)) },
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); resize.end(measure(event)) },
      onPointerCancel: () => resize.cancel(),
      onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
        const delta = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -0.05 : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 0.05 : 0
        if (delta === 0) return
        event.preventDefault()
        props.controller.dispatch({ type: 'resize_split', region: props.state.groups[groupIds(props.node)[0]!]?.region ?? 'right', splitId: props.node.id, ratio: props.node.ratio + delta })
      },
    }),
    createElement('div', { className: 'pwr-branch', style: { flex: `${1 - ratio} 1 0` } }, createElement(SplitTree, { ...props, node: props.node.second })),
  )
}
