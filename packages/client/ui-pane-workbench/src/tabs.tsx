/**
 * V4 Task 3.1: Tab Architecture
 *
 * Extracts tab rendering into testable, composable components:
 * - PaneTabStrip: Container for tabs with proper ARIA roles
 * - PaneTab: Individual tab with proper keyboard/focus handling
 * - PaneTabClose: Close button for tabs
 * - PaneTabOverflow: Overflow menu for many tabs
 * - TabStatusPresenter: Visual indicators for tab states
 *
 * Maintains single controller, no nested buttons, APG roles, and existing intents.
 */

import { createElement, useMemo, useState, useSyncExternalStore, type MouseEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { WorkbenchIcon, type WorkbenchIconName } from './icon.js'
import { WorkbenchIconButton } from './chrome/control.js'
import { formatT, t } from './i18n/locale.js'
import {
  filterOverflowTabs,
  planPaneTabOverflow,
  presentPaneTab,
  segmentPaneTabs,
  type PaneBulkCloseMode,
  type PaneGroupV1,
  type PaneViewInstanceV1,
  type PaneWorkspaceV1,
} from './workspace.js'
import type { PaneWorkbenchController } from './controller.js'

// Types for tab components
export interface PaneTabProps {
  view: PaneViewInstanceV1
  isActive: boolean
  isPinned: boolean
  tabIndex: number
  group: PaneGroupV1
  controller: PaneWorkbenchController
  onContextMenu: (viewId: string) => void
  onClose?: (viewId: string) => void
}

export interface TabStatusPresenterProps {
  view: Pick<PaneViewInstanceV1, 'dirty' | 'status'> & {
    readonly attention?: boolean
    readonly offline?: boolean
    readonly stale?: boolean
    readonly preview?: boolean
    readonly pinned?: boolean
  }
  isActive: boolean
}

export interface PaneTabCloseProps {
  view: Pick<PaneViewInstanceV1, 'id' | 'title'>
  onClose: (viewId: string) => void
}

export interface PaneTabOverflowProps {
  group: PaneGroupV1
  views: Readonly<Record<string, PaneViewInstanceV1>>
  overflowIds: readonly string[]
  controller: PaneWorkbenchController
  onRestoreFocus?: (viewId: string) => void
}

export interface PaneTabStripProps {
  group: PaneGroupV1
  state: PaneWorkspaceV1
  controller: PaneWorkbenchController
  availableWidth: number
  onContextMenu: (viewId: string) => void
  onClose?: (viewId: string) => void
  /** Shared management center replaces the legacy inline overflow popup when false. */
  showOverflow?: boolean
}

export interface PaneTabActionsProps {
  group: PaneGroupV1
  activeView: PaneViewInstanceV1 | undefined
  maximized: boolean
  controller: PaneWorkbenchController
  onOpenPicker: () => void
  onOpenManager?: () => void
  tabCount?: number
  onHidePane?: () => void
  onContextMenu: (viewId: string) => void
}

// Helper to get icon for view
function iconForView(view: PaneViewInstanceV1): WorkbenchIconName {
  if (view.kind.startsWith('file.')) return 'file'
  if (view.kind.startsWith('terminal.')) return 'terminal'
  if (view.kind.startsWith('git.')) return 'git-branch'
  if (view.kind.startsWith('explorer.')) return 'folder'
  return 'window'
}

// Status indicators for tabs
export function TabStatusPresenter(props: TabStatusPresenterProps): React.ReactNode {
  const { view, isActive } = props
  const tokens: Array<{ id: string; className: string; label: string }> = []
  if (view.preview) tokens.push({ id: 'preview', className: 'pwr-status-preview', label: t('tab.preview') })
  if (view.dirty) tokens.push({ id: 'dirty', className: 'pwr-status-dirty', label: t('tab.dirty') })
  if (view.status === 'orphaned') tokens.push({ id: 'orphaned', className: 'pwr-status-orphaned', label: t('tab.orphaned') })
  if (view.status === 'conflict') tokens.push({ id: 'conflict', className: 'pwr-status-conflict', label: t('tab.conflict') })
  if (view.offline) tokens.push({ id: 'offline', className: 'pwr-status-offline', label: t('tab.offline') })
  if (view.stale || view.status === 'stale') tokens.push({ id: 'stale', className: 'pwr-status-stale', label: t('state.stale') })
  if (view.attention) tokens.push({ id: 'attention', className: 'pwr-status-attention', label: t('tab.attention') })
  if (tokens.length === 0) return null

  return createElement('span', {
    className: `pwr-tab-status ${tokens.map(token => token.className).join(' ')} ${isActive ? 'pwr-status-active' : ''}`,
    'aria-hidden': true,
    'aria-label': tokens.map(token => token.label).join(', '),
    title: tokens.map(token => token.label).join(', '),
    'data-pane-status-tokens': tokens.map(token => token.id).join(' '),
  }, ...tokens.map(token => createElement('span', {
    key: token.id,
    className: `${token.className} pwr-status-token`,
    'data-pane-status': token.id,
  }, token.label)))
}

export function PaneTabClose(props: PaneTabCloseProps): React.ReactNode {
  return createElement('button', {
    type: 'button',
    className: 'pwr-tab-close',
    title: formatT('tab.closeWithName', { name: props.view.title }),
    'aria-label': formatT('tab.closeWithName', { name: props.view.title }),
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      props.onClose(props.view.id)
    },
    tabIndex: -1,
  }, createElement(WorkbenchIcon, { name: 'close', size: 12 }))
}

// Individual tab component
export function PaneTab(props: PaneTabProps): React.ReactNode {
  const { view, isActive, isPinned, tabIndex, group, controller, onContextMenu, onClose } = props
  const drag = useSyncExternalStore(controller.drag.subscribe, controller.drag.getSnapshot, controller.drag.getSnapshot)
  const isDragSource = drag.visuals.placeholderViewId === view.id

  const handleClick = () => {
    controller.dispatch({ type: 'activate_view', viewId: view.id })
  }

  const handleDoubleClick = () => {
    controller.dispatch({ type: 'pin_view', viewId: view.id, pinned: !isPinned })
  }

  const handleContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    onContextMenu(view.id)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const nextId = event.key === 'ArrowRight' ? nextTab(group, view.id, 1)
      : event.key === 'ArrowLeft' ? nextTab(group, view.id, -1)
      : event.key === 'Home' ? group.tabs[0]
      : event.key === 'End' ? group.tabs.at(-1)
      : undefined

    if (nextId !== undefined) {
      event.preventDefault()
      controller.dispatch({ type: 'activate_view', viewId: nextId })
      document.getElementById(`pane-tab-${nextId}`)?.focus()
      return
    }

    if (event.key === 'Delete') {
      event.preventDefault()
      if (onClose) onClose(view.id)
      else controller.dispatch({ type: 'close_view', viewId: view.id })
      return
    }

    if (event.key === 'F10' && event.shiftKey) {
      event.preventDefault()
      onContextMenu(view.id)
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    controller.drag.begin(view.id, event.clientX, event.clientY)
  }

  const presentation = presentPaneTab({
    ...view,
    attention: Boolean(view.attention),
    offline: Boolean(view.offline),
    stale: Boolean(view.stale),
  })

  return createElement('div', {
    className: `pwr-tab-item ${isPinned ? 'pwr-tab-item-pinned' : ''} ${view.preview ? 'pwr-tab-item-preview' : ''}`,
    'data-pane-tab-segment': isPinned ? 'pinned' : 'working',
    'data-pane-renderer-id': view.id,
    'data-pane-drag-source': isDragSource || undefined,
  },
    createElement('button', {
      id: `pane-tab-${view.id}`,
      className: `pwr-tab ${isActive ? 'pwr-tab-active' : ''} ${isPinned ? 'pwr-tab-pinned' : ''} ${view.preview ? 'pwr-tab-preview' : ''}`,
      role: 'tab',
      type: 'button',
      title: presentation.accessibleName,
      'aria-selected': isActive,
      'aria-controls': `pane-panel-${view.id}`,
      'aria-description': presentation.statusTokens.join(', ') || undefined,
      'data-pane-tab-index': tabIndex,
      tabIndex: isActive ? 0 : -1,
      onClick: handleClick,
      onDoubleClick: handleDoubleClick,
      onContextMenu: handleContextMenu,
      onKeyDown: handleKeyDown,
      onPointerDown: handlePointerDown,
    },
      createElement(WorkbenchIcon, { name: iconForView(view), size: 14 }),
      createElement('span', { className: 'pwr-tab-title' }, view.title),
      view.instanceLabel === undefined ? null : createElement('span', { className: 'pwr-tab-instance' }, view.instanceLabel),
      createElement(TabStatusPresenter, { view, isActive }),
    ),
    createElement(PaneTabClose, { view, onClose: viewId => {
      if (onClose) onClose(viewId)
      else controller.dispatch({ type: 'close_view', viewId })
    } }),
  )
}

// Helper to find next tab for keyboard navigation
function nextTab(group: PaneGroupV1, currentId: string, direction: 1 | -1): string | undefined {
  const currentIndex = group.tabs.indexOf(currentId)
  if (currentIndex === -1) return undefined

  const nextIndex = currentIndex + direction
  if (nextIndex < 0 || nextIndex >= group.tabs.length) return undefined

  return group.tabs[nextIndex]
}

// Tab actions toolbar
export function PaneTabActions(props: PaneTabActionsProps): React.ReactNode {
  const { group, activeView, maximized, controller, onOpenPicker, onContextMenu } = props

  return createElement('div', {
    className: 'pwr-tab-actions',
    role: 'group',
    'aria-label': t('chrome.paneActions')
  },
    createElement('button', {
      type: 'button',
      title: t('chrome.openView'),
      'aria-label': t('chrome.openView'),
      onClick: onOpenPicker,
    }, createElement(WorkbenchIcon, { name: 'add' })),

    props.onOpenManager === undefined ? null : createElement('button', {
      type: 'button',
      className: 'pwr-tab-manager-trigger',
      title: t('management.manageTabs'),
      'aria-label': t('management.manageTabs'),
      onClick: props.onOpenManager,
    }, createElement(WorkbenchIcon, { name: 'list' }), createElement('span', null, props.tabCount ?? group.tabs.length)),

    activeView === undefined ? null : createElement(WorkbenchIconButton, {
      icon: 'more',
      label: formatT('chrome.moreActions', { name: activeView.title }),
      'aria-haspopup': 'menu',
      onClick: () => onContextMenu(activeView.id),
    }),

    activeView === undefined ? null : createElement(WorkbenchIconButton, {
      icon: maximized ? 'restore' : 'maximize',
      label: maximized ? t('chrome.restorePane') : t('chrome.maximizePane'),
      onClick: () => {
        controller.dispatch(maximized ? { type: 'restore_layout' } : { type: 'maximize_group', groupId: group.id })
      },
    }),

    activeView === undefined || props.onHidePane !== undefined ? null : createElement(WorkbenchIconButton, {
      icon: 'close',
      label: formatT('tab.closeWithName', { name: activeView.title }),
      onClick: () => controller.dispatch({ type: 'close_view', viewId: activeView.id }),
    }),

    props.onHidePane === undefined ? null : createElement(WorkbenchIconButton, {
      icon: 'collapse',
      label: t('chrome.hideWorkbench'),
      onClick: props.onHidePane,
    }),
  )
}

export function PaneTabOverflow(props: PaneTabOverflowProps): React.ReactNode {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const matches = useMemo(() => filterOverflowTabs(props.overflowIds, props.views, query), [props.overflowIds, props.views, query])
  if (props.overflowIds.length === 0) return null
  return createElement('div', { className: 'pwr-tab-overflow' },
    createElement('button', {
      type: 'button',
      className: 'pwr-tab-overflow-trigger',
      'aria-haspopup': 'listbox',
      'aria-expanded': open,
      onClick: () => setOpen(value => !value),
    }, t('tab.moreTabs')),
    open ? createElement('div', { className: 'pwr-tab-overflow-panel', role: 'listbox', 'aria-label': t('tab.moreTabs') },
      createElement('input', {
        type: 'search',
        value: query,
        'aria-label': t('tab.moreTabs'),
        onChange: (event: { currentTarget: { value: string } }) => setQuery(event.currentTarget.value),
      }),
      ...matches.map(viewId => {
        const view = props.views[viewId]
        if (view === undefined) return null
        const presentation = presentPaneTab(view)
        return createElement('button', {
          key: viewId,
          type: 'button',
          role: 'option',
          'aria-selected': false,
          'data-pane-overflow-id': viewId,
          onClick: () => {
            props.controller.dispatch({ type: 'activate_view', viewId })
            setOpen(false)
            setQuery('')
            props.onRestoreFocus?.(viewId)
            document.getElementById(`pane-tab-${viewId}`)?.focus()
          },
        }, `${view.title}${presentation.statusTokens.length === 0 ? '' : ` (${presentation.statusTokens.join(', ')})`}`)
      }),
    ) : null,
  )
}

export function PaneTabStrip(props: PaneTabStripProps): React.ReactNode {
  const plan = planPaneTabOverflow(props.group, props.state.views, props.availableWidth)
  const segments = segmentPaneTabs(props.group, props.state.views)
  const children = [
    ...segments.map(segment => {
      const visible = segment.viewIds.flatMap(viewId => {
        if (!plan.visibleIds.includes(viewId)) return []
        const view = props.state.views[viewId]
        if (view === undefined) return []
        return [createElement(PaneTab, {
          key: viewId,
          view,
          isActive: props.group.activeTabId === viewId,
          isPinned: view.pinned,
          tabIndex: props.group.tabs.indexOf(viewId),
          group: props.group,
          controller: props.controller,
          onContextMenu: props.onContextMenu,
          onClose: props.onClose,
        })]
      })
      return createElement('div', {
        key: segment.id,
        className: `pwr-tab-segment pwr-tab-segment-${segment.id}`,
        'data-pane-tab-segment': segment.id,
      }, visible)
    }),
    props.showOverflow === false ? null : createElement(PaneTabOverflow, {
      key: 'overflow',
      group: props.group,
      views: props.state.views,
      overflowIds: plan.overflowIds,
      controller: props.controller,
      onRestoreFocus: viewId => document.getElementById(`pane-tab-${viewId}`)?.focus(),
    }),
  ]
  return createElement('div', {
    className: 'pwr-tab-strip',
    'aria-label': t('a11y.tabList'),
    'data-pane-tab-measured': plan.measuredCount,
    'data-pane-tab-observers': plan.observerCount,
  }, children)
}

export function dispatchBulkClose(
  controller: PaneWorkbenchController,
  groupId: string,
  mode: PaneBulkCloseMode,
  sourceViewId?: string,
): ReturnType<PaneWorkbenchController['dispatch']> {
  return controller.dispatch({ type: 'bulk_close', groupId, mode, sourceViewId })
}

export { TabStatusPresenter as PaneTabStatusPresenter }
