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
import { iconForView } from './shared.js'

interface ViewBoundaryProps {
  readonly view: PaneViewInstanceV1
  readonly onClose: () => void
  readonly children?: ReactNode
}

interface ViewBoundaryState { readonly error?: Error; readonly generation: number }

class ViewBoundary extends Component<ViewBoundaryProps, ViewBoundaryState> {
  state: ViewBoundaryState = { generation: 0 }
  static getDerivedStateFromError(error: Error): Partial<ViewBoundaryState> { return { error } }
  render(): ReactNode {
    if (this.state.error === undefined) return createElement('div', { key: this.state.generation, 'data-pane-view-generation': this.state.generation }, this.props.children)
    return createElement('section', { role: 'alert', className: 'pwr-empty' },
      createElement('p', null, formatT('error.viewFailed', { title: this.props.view.title })),
      createElement('button', { type: 'button', onClick: () => this.setState({ error: undefined }) }, t('error.retry')),
      createElement('button', { type: 'button', onClick: () => this.setState(state => ({ error: undefined, generation: state.generation + 1 })) }, t('error.reloadView')),
      createElement('button', { type: 'button', onClick: this.props.onClose }, t('tab.close')),
    )
  }
}

/** Render-error boundary shared by the Core host groups and the Tier 0 overlay panel. */
export { ViewBoundary as PaneViewBoundary }

export interface PaneViewContentProps {
  readonly view: PaneViewInstanceV1
  readonly registration: PaneViewRegistrationV1 | undefined
  readonly registry: PaneViewRegistry
  readonly controller: PaneWorkbenchController
  readonly renderCoreView?: (id: PaneCoreViewId) => ReactNode
  readonly onClose: (viewId: string) => void
}

/** Active-view content: orphaned fallback, or the registered component inside the shared boundary. */

export function PaneViewContent(props: PaneViewContentProps): ReactNode {
  const { view, registration } = props
  const restore = props.controller.getRestoreState(view.id)
  if (view.status === 'orphaned' || registration === undefined) {
    let cachedRendition: ReactNode
    if (restore?.renditionRef !== undefined && props.controller.renditionRenderer !== undefined) {
      try {
        cachedRendition = props.controller.renditionRenderer.render({
          renditionRef: restore.renditionRef,
          kind: view.kind,
          resourceKey: view.resourceKey,
          ...(view.resourceVersion === undefined ? {} : { resourceVersion: view.resourceVersion }),
        })
      } catch {
        cachedRendition = undefined
      }
    }
    return createElement('section', { className: 'pwr-empty', role: 'status' },
      createElement('p', null, formatT('error.unavailable', { title: view.title })),
      restore?.renditionRef === undefined ? null : createElement('p', { className: 'pwr-recovery-note' }, t('recovery.cachedRenditionAvailable')),
      cachedRendition === undefined ? null : createElement('div', { className: 'pwr-recovery-rendition', 'data-pane-safe-rendition': true }, cachedRendition),
      createElement('button', { type: 'button', onClick: () => props.onClose(view.id) }, formatT('tab.closeWithName', { name: view.title })),
    )
  }
  return createElement(ViewBoundary, { view, onClose: () => props.onClose(view.id) },
    createElement(registration.component as never, {
      view,
      projection: view.metadata,
      registry: props.registry,
      ...(registration.restore?.state === true && restore?.state !== undefined ? { restoreState: restore.state } : {}),
      ...(registration.restore?.rendition === true && restore?.renditionRef !== undefined ? { renditionRef: restore.renditionRef } : {}),
      ...(registration.restore === undefined ? {} : {
        onRestoreStateChange: (state?: unknown, renditionRef?: unknown) => props.controller.updateRestoreState(view.id, state, renditionRef),
      }),
      hostContent: isPaneCoreViewId(view.kind) ? props.renderCoreView?.(view.kind) : undefined,
      retry: () => props.controller.dispatch({ type: 'activate_view', viewId: view.id }),
    }))
}
