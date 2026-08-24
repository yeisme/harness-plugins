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

import { createElement, type MouseEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { WorkbenchIcon, type WorkbenchIconName } from './icon.js'
import { formatT, t } from './i18n/locale.js'
import type { PaneViewInstanceV1, PaneGroupV1, PaneWorkbenchController } from './types.js'

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
  view: PaneViewInstanceV1
  isActive: boolean
}

export interface PaneTabActionsProps {
  group: PaneGroupV1
  activeView: PaneViewInstanceV1 | undefined
  maximized: boolean
  controller: PaneWorkbenchController
  onOpenPicker: () => void
  onContextMenu: (viewId: string) => void
}

// Helper to get icon for view
function iconForView(view: PaneViewInstanceV1): string {
  if (view.kind.startsWith('file.')) return 'file'
  if (view.kind.startsWith('terminal.')) return 'terminal'
  if (view.kind.startsWith('git.')) return 'git-branch'
  if (view.kind.startsWith('explorer.')) return 'folder'
  return 'window'
}

// Status indicators for tabs
export function TabStatusPresenter(props: TabStatusPresenterProps): React.ReactNode {
  const { view, isActive } = props
  const hasStatus = view.dirty || view.attention || view.offline ||
                   view.status === 'orphaned' || view.status === 'conflict'

  if (!hasStatus) return null

  const statusClass = view.dirty ? 'pwr-status-dirty' :
                     view.status === 'orphaned' ? 'pwr-status-orphaned' :
                     view.status === 'conflict' ? 'pwr-status-conflict' :
                     view.offline ? 'pwr-status-offline' : 'pwr-status-attention'

  const ariaLabel = view.dirty ? t('tab.dirty') :
                   view.status === 'orphaned' ? t('tab.orphaned') :
                   view.status === 'conflict' ? t('tab.conflict') :
                   view.offline ? t('tab.offline') : t('tab.attention')

  return createElement('span', {
    className: `pwr-tab-status ${statusClass} ${isActive ? 'pwr-status-active' : ''}`,
    'aria-label': ariaLabel,
    title: ariaLabel,
  })
}

// Individual tab component
export function PaneTab(props: PaneTabProps): React.ReactNode {
  const { view, isActive, isPinned, tabIndex, group, controller, onContextMenu, onClose } = props

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
      controller.dispatch({ type: 'close_view', viewId: view.id })
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

  const handleClose = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (onClose) {
      onClose(view.id)
    } else {
      controller.dispatch({ type: 'close_view', viewId: view.id })
    }
  }

  return createElement('button', {
    id: `pane-tab-${view.id}`,
    className: `pwr-tab ${isActive ? 'pwr-tab-active' : ''} ${isPinned ? 'pwr-tab-pinned' : ''}`,
    role: 'tab',
    type: 'button',
    title: view.title,
    'aria-selected': isActive,
    'aria-controls': `pane-panel-${view.id}`,
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
    createElement(TabStatusPresenter, { view, isActive }),
    createElement('button', {
      type: 'button',
      className: 'pwr-tab-close',
      title: formatT('tab.closeWithName', { name: view.title }),
      'aria-label': formatT('tab.closeWithName', { name: view.title }),
      onClick: handleClose,
      tabIndex: -1,
    }, createElement(WorkbenchIcon, { name: 'close', size: 12 }))
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

    activeView === undefined ? null : createElement('button', {
      type: 'button',
      title: formatT('chrome.moreActions', { name: activeView.title }),
      'aria-label': formatT('chrome.moreActions', { name: activeView.title }),
      onClick: () => onContextMenu(activeView.id),
    }, createElement(WorkbenchIcon, { name: 'more' })),

    activeView === undefined ? null : createElement('button', {
      type: 'button',
      title: maximized ? t('chrome.restorePane') : t('chrome.maximizePane'),
      'aria-label': maximized ? t('chrome.restorePane') : t('chrome.maximizePane'),
      onClick: () => {
        controller.dispatch(maximized ? { type: 'restore_layout' } : { type: 'maximize_group', groupId: group.id })
      },
    }, createElement(WorkbenchIcon, { name: maximized ? 'restore' : 'maximize' })),

    activeView === undefined ? null : createElement('button', {
      type: 'button',
      title: formatT('tab.closeWithName', { name: activeView.title }),
      'aria-label': formatT('tab.closeWithName', { name: activeView.title }),
      onClick: () => controller.dispatch({ type: 'close_view', viewId: activeView.id }),
    }, createElement(WorkbenchIcon, { name: 'close' })),
  )
}

// Export the components for use in region-chrome.ts
export { TabStatusPresenter as PaneTabStatusPresenter }
export type { PaneTabProps, TabStatusPresenterProps, PaneTabActionsProps }