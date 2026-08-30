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
import { iconForView, menuItem, RIGHT_RAIL_WIDTH } from './shared.js'

export interface PaneViewQuickPickProps {
  readonly registry: PaneViewRegistry
  readonly controller: PaneWorkbenchController
  readonly onClose: () => void
  /** Deterministic focus restore target (the anchoring trigger) for Esc/close. */
  readonly restoreFocus?: () => void
}

/**
 * Anchored Quick Pick shared by the Core host and the Tier 0 overlay: search,
 * Open/Available grouping, Arrow/Home/End selection, Enter to open, Esc closes
 * with focus restore. Opening a view moves focus to its tab.
 */

export function PaneViewQuickPick(props: PaneViewQuickPickProps): ReactNode {
  const [, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => props.registry.subscribe(() => setRevision(value => value + 1)), [props.registry])
  useEffect(() => { searchRef.current?.focus() }, [])
  const state = props.controller.getSnapshot()
  const openKinds = new Set(Object.values(state.views).map(view => view.kind))
  const needle = query.trim().toLowerCase()
  const matches = props.registry.snapshot()
    .filter(registration => registration.showInPicker !== false)
    .filter(({ descriptor }) => needle.length === 0
      || descriptor.label.toLowerCase().includes(needle)
      || descriptor.kind.toLowerCase().includes(needle)
      || (descriptor.presentation?.keywords ?? []).some(keyword => keyword.toLowerCase().includes(needle)))
  const groups: ReadonlyArray<{ readonly id: 'open' | 'available'; readonly label: string; readonly items: typeof matches }> = [
    { id: 'open', label: t('picker.group.open'), items: matches.filter(registration => openKinds.has(registration.descriptor.kind)) },
    { id: 'available', label: t('picker.group.available'), items: matches.filter(registration => !openKinds.has(registration.descriptor.kind)) },
  ]

  const closeWithRestore = (): void => {
    props.onClose()
    props.restoreFocus?.()
  }

  const openDescriptor = (descriptor: PaneViewRegistrationV1['descriptor']): void => {
    props.controller.openView({
      kind: descriptor.kind,
      resourceKey: `view:${descriptor.kind}`,
      role: descriptor.role,
      preferredRegion: descriptor.preferredRegion,
      retention: descriptor.retention,
      singleton: descriptor.singleton,
      pinned: true,
      title: descriptor.label,
    })
    props.onClose()
    const opened = Object.values(props.controller.getSnapshot().views)
      .find(view => view.kind === descriptor.kind && view.resourceKey === `view:${descriptor.kind}`)
    if (opened !== undefined) queueMicrotask(() => document.getElementById(`pane-tab-${opened.id}`)?.focus())
  }

  const itemElements = (): HTMLElement[] => [...(rootRef.current?.querySelectorAll<HTMLElement>('[data-pane-picker-item]') ?? [])]

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeWithRestore()
      return
    }
    const items = itemElements()
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      if (items.length === 0) return
      event.preventDefault()
      const current = items.indexOf(document.activeElement as HTMLElement)
      const next = event.key === 'Home' ? 0
        : event.key === 'End' ? items.length - 1
          : current === -1 ? (event.key === 'ArrowDown' ? 0 : items.length - 1)
            : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[next]?.focus()
      return
    }
    if (event.key === 'Enter' && (document.activeElement === searchRef.current || document.activeElement === rootRef.current)) {
      const first = groups.flatMap(group => group.items)[0]
      if (first !== undefined) {
        event.preventDefault()
        openDescriptor(first.descriptor)
      }
    }
  }

  return createElement('section', { ref: rootRef, className: 'pwr-picker', role: 'dialog', 'aria-modal': false, 'aria-label': t('chrome.openView'), onKeyDown },
    createElement('header', null,
      createElement('strong', null, t('chrome.openViewTitle')),
      createElement('button', { type: 'button', className: 'pwr-icon', onClick: closeWithRestore, 'aria-label': t('chrome.closeViewSelector') }, createElement(WorkbenchIcon, { name: 'close' })),
    ),
    createElement('input', {
      ref: searchRef,
      type: 'search',
      role: 'searchbox',
      value: query,
      'aria-label': t('picker.title'),
      placeholder: t('picker.search.placeholder'),
      'data-pane-picker-search': true,
      onChange: (event: { currentTarget: { value: string } }) => setQuery(event.currentTarget.value),
    }),
    createElement('div', { className: 'pwr-picker-list' },
      matches.length === 0 ? createElement('p', { className: 'pwr-empty' }, t('error.noViewOpen')) : null,
      ...groups.flatMap(group => group.items.length === 0 ? [] : [
        createElement('div', { key: group.id, className: 'pwr-picker-group', role: 'group', 'aria-label': group.label },
          createElement('p', { className: 'pwr-picker-group-title' }, group.label),
          ...group.items.map(({ descriptor }) => createElement('button', {
            key: descriptor.kind,
            type: 'button',
            'data-pane-picker-item': descriptor.kind,
            onClick: () => openDescriptor(descriptor),
          }, createElement(WorkbenchIcon, { name: descriptor.kind.includes('git') ? 'git' : descriptor.kind.includes('subagent') || descriptor.kind.includes('agent') ? 'agents' : descriptor.role === 'utility' ? 'terminal' : descriptor.role === 'navigator' ? 'file' : descriptor.kind.includes('media') ? 'media' : 'document' }), createElement('span', null, descriptor.label))),
        ),
      ]),
    ),
  )
}

/**
 * Deterministic focus restore after a tab close: when the strip element that
 * last held focus disappears, focus moves to the group's new active tab, or to
 * the Open View trigger when no tab remains. Focus owned outside the chrome is
 * never stolen.
 */

export function usePaneTabFocusRestore(
  controller: PaneWorkbenchController,
  rootRef: RefObject<HTMLElement | null>,
  selectActiveTabId: (state: PaneWorkspaceV1) => string | undefined,
  fallbackSelector: string,
): void {
  const lastStripFocus = useRef<string | undefined>(undefined)
  useEffect(() => {
    const root = rootRef.current
    if (root === null || root === undefined) return
    const onFocusIn = (event: Event): void => {
      const item = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-pane-renderer-id]') : null
      lastStripFocus.current = item?.dataset.paneRendererId
    }
    const onDocumentFocus = (event: Event): void => {
      if (event.target instanceof HTMLElement && !root.contains(event.target)) lastStripFocus.current = undefined
    }
    root.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusin', onDocumentFocus)
    return () => {
      root.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusin', onDocumentFocus)
    }
  }, [controller, rootRef])
  useEffect(() => controller.subscribeWorkspace(() => {
    const focusedViewId = lastStripFocus.current
    if (focusedViewId === undefined) return
    const state = controller.getSnapshot()
    if (state.views[focusedViewId] !== undefined) return
    lastStripFocus.current = undefined
    queueMicrotask(() => {
      const root = rootRef.current
      if (root === null || root === undefined) return
      const activeElement = document.activeElement
      if (activeElement !== null && activeElement !== document.body && root.contains(activeElement)) return
      const nextActive = selectActiveTabId(state)
      const target = (nextActive === undefined ? null : root.querySelector(`#pane-tab-${CSS.escape(nextActive)}`))
        ?? root.querySelector(fallbackSelector)
      if (target instanceof HTMLElement) target.focus()
    })
  }), [controller, rootRef, selectActiveTabId, fallbackSelector])
}

/** Localized labels for the shared artifact handoff menu. */
