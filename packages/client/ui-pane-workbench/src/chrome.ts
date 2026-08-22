import {
  Component,
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { PaneDragSession, PaneResizeSession, type PaneDragTargetV1 } from './interactions.js'
import { PaneWorkbenchController } from './controller.js'
import { projectPaneWorkspace, type PaneWorkspaceProjectionV1 } from './projection.js'
import { markOrphanedPaneViews, type PaneViewRegistry } from './view-registry.js'
import {
  createPaneWorkspace,
  reducePaneWorkspace,
  type PaneGroupV1,
  type PaneSplitEdge,
  type PaneViewInstanceV1,
  type PaneWorkspaceIntentV1,
  type PaneWorkspaceV1,
} from './workspace.js'

export interface PaneWorkbenchChromeProps {
  readonly initialState?: PaneWorkspaceV1
  readonly registry: PaneViewRegistry
  readonly width?: number
  readonly onStateChange?: (state: PaneWorkspaceV1) => void
  readonly controller?: PaneWorkbenchController
  /** Start collapsed instead of expanded. Defaults to false. */
  readonly defaultVisible?: boolean
}

interface ViewBoundaryProps {
  readonly view: PaneViewInstanceV1
  readonly onClose: () => void
  readonly children?: ReactNode
}

interface ViewBoundaryState { readonly error?: Error; readonly generation: number }

interface PaneMoveModeState {
  readonly viewId: string
  readonly targetIndex: number
}

interface PaneMoveTarget {
  readonly groupId: string
  readonly edge: 'center' | PaneSplitEdge
  readonly label: string
}

class ViewBoundary extends Component<ViewBoundaryProps, ViewBoundaryState> {
  state: ViewBoundaryState = { generation: 0 }
  static getDerivedStateFromError(error: Error): Partial<ViewBoundaryState> { return { error } }
  render(): ReactNode {
    if (this.state.error === undefined) {
      return createElement('div', { key: this.state.generation, 'data-pane-view-generation': this.state.generation }, this.props.children)
    }
    return createElement('section', { role: 'alert', 'data-pane-view-error': this.props.view.id, 'data-pane-view-generation': this.state.generation },
      createElement('p', null, `This view failed to render: ${this.props.view.title}.`),
      createElement('button', { type: 'button', onClick: () => this.setState({ error: undefined }) }, 'Retry'),
      createElement('button', { type: 'button', onClick: () => this.setState(state => ({ error: undefined, generation: state.generation + 1 })) }, 'Reload View'),
      createElement('button', { type: 'button', onClick: this.props.onClose }, 'Close Tab'),
    )
  }
}

function visibleGroups(state: PaneWorkspaceV1, projection: PaneWorkspaceProjectionV1): readonly PaneGroupV1[] {
  return projection.visibleGroupIds.map(id => state.groups[id]).filter((group): group is PaneGroupV1 => group !== undefined)
}

function nextTab(group: PaneGroupV1, viewId: string, direction: -1 | 1): string | undefined {
  const current = group.tabs.indexOf(viewId)
  if (current < 0 || group.tabs.length === 0) return undefined
  return group.tabs[(current + direction + group.tabs.length) % group.tabs.length]
}

function dropEdgeForPointer(event: PointerEvent<HTMLElement>): PaneDragTargetV1['edge'] {
  const rect = event.currentTarget.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return 'center'
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height
  if (x <= 0.2) return 'left'
  if (x >= 0.8) return 'right'
  if (y <= 0.2) return 'top'
  if (y >= 0.8) return 'bottom'
  return 'center'
}

function dragTargetForGroup(
  state: PaneWorkspaceV1,
  group: PaneGroupV1,
  drag: PaneDragSession,
  event: PointerEvent<HTMLElement>,
): PaneDragTargetV1 | undefined {
  if (drag.state.status !== 'dragging') return undefined
  const source = state.views[drag.state.viewId]
  if (source === undefined) return undefined
  const tab = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-pane-tab-index]') : null
  const edge = tab === null ? dropEdgeForPointer(event) : 'center'
  const index = tab === null ? undefined : insertionIndexForTab(event, group, drag.state.viewId, tab)
  const sameGroup = source.groupId === group.id
  const locked = group.locked && group.role !== source.role
  const enabled = !locked && !(sameGroup && edge === 'center' && index === undefined)
  return {
    groupId: group.id,
    edge,
    enabled,
    index,
    reason: locked ? 'locked' : sameGroup && edge === 'center' ? 'already_in_group' : undefined,
  }
}

function insertionIndexForTab(
  event: PointerEvent<HTMLElement>,
  group: PaneGroupV1,
  sourceViewId: string,
  tab: HTMLElement,
): number {
  const rawIndex = Number(tab.dataset.paneTabIndex)
  if (!Number.isSafeInteger(rawIndex)) return group.tabs.length
  const rect = tab.getBoundingClientRect()
  const after = event.clientX >= rect.left + rect.width / 2
  let index = after ? rawIndex + 1 : rawIndex
  const sourceIndex = group.tabs.indexOf(sourceViewId)
  if (sourceIndex >= 0 && sourceIndex < index) index -= 1
  return Math.max(0, Math.min(group.tabs.length - 1, index))
}

function PaneTabBar(props: {
  readonly group: PaneGroupV1
  readonly state: PaneWorkspaceV1
  readonly dispatch: (intent: PaneWorkspaceIntentV1) => void
  readonly drag: PaneDragSession
  readonly onCloseView: (viewId: string, focusViewId?: string) => void
  readonly onFocusTab: (viewId: string) => void
  readonly onKeyboardMove: (viewId: string) => void
  readonly onDragTarget: (target?: PaneDragTargetV1) => void
}): ReactNode {
  const [menuViewId, setMenuViewId] = useState<string>()
  const menuTrigger = useRef<HTMLElement>()
  const closeMenu = (): void => { setMenuViewId(undefined); menuTrigger.current?.focus() }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>, view: PaneViewInstanceV1): void => {
    const target = event.key === 'ArrowRight' ? nextTab(props.group, view.id, 1)
      : event.key === 'ArrowLeft' ? nextTab(props.group, view.id, -1)
      : event.key === 'Home' ? props.group.tabs[0]
      : event.key === 'End' ? props.group.tabs.at(-1)
      : undefined
    if (target !== undefined) {
      event.preventDefault()
      props.dispatch({ type: 'activate_view', viewId: target })
      props.onFocusTab(target)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      props.dispatch({ type: 'activate_view', viewId: view.id })
      return
    }
    if (event.key === 'Delete') {
      event.preventDefault()
      const index = props.group.tabs.indexOf(view.id)
      const focusViewId = index < 0 ? undefined : props.group.tabs[index + 1] ?? props.group.tabs[index - 1]
      props.onCloseView(view.id, focusViewId)
      return
    }
    if (event.key === 'F10' && event.shiftKey) {
      event.preventDefault()
      menuTrigger.current = event.currentTarget
      setMenuViewId(view.id)
    }
  }
  const menuView = menuViewId === undefined ? undefined : props.state.views[menuViewId]
  return createElement('div', { role: 'tablist', 'aria-label': `${props.group.role} pane tabs`, 'data-pane-group': props.group.id },
    ...props.group.tabs.map(viewId => {
      const view = props.state.views[viewId]
      if (view === undefined) return null
      return createElement('button', {
        key: view.id,
        id: `pane-tab-${view.id}`,
        role: 'tab',
        type: 'button',
        'aria-selected': props.group.activeTabId === view.id,
        'aria-controls': `pane-panel-${view.id}`,
        tabIndex: props.group.activeTabId === view.id ? 0 : -1,
        'data-pane-tab-index': props.group.tabs.indexOf(view.id),
        'data-preview': view.preview || undefined,
        onClick: () => props.dispatch({ type: 'activate_view', viewId: view.id }),
        onKeyDown: event => onKeyDown(event, view),
        onPointerDown: (event: PointerEvent<HTMLButtonElement>) => { props.onDragTarget(); props.drag.begin(view.id, event.clientX, event.clientY) },
      }, `${view.title}${view.dirty ? ' •' : ''}${view.pinned ? ' 📌' : ''}`)
    }),
    menuView === undefined ? null : createElement('div', { role: 'menu', 'aria-label': `${menuView.title} actions` },
      createElement('button', { role: 'menuitem', type: 'button', onClick: () => { props.dispatch({ type: 'pin_view', viewId: menuView.id }); closeMenu() } }, menuView.pinned ? 'Unpin' : 'Pin'),
      createElement('button', { role: 'menuitem', type: 'button', onClick: () => {
        const index = props.group.tabs.indexOf(menuView.id)
        const focusViewId = index < 0 ? undefined : props.group.tabs[index + 1] ?? props.group.tabs[index - 1]
        props.onCloseView(menuView.id, focusViewId)
        closeMenu()
      } }, 'Close'),
      createElement('button', { role: 'menuitem', type: 'button', onClick: () => { props.dispatch({ type: 'move_view', viewId: menuView.id, targetGroupId: 'group:right:content' }); closeMenu() } }, 'Move to Right'),
      createElement('button', { role: 'menuitem', type: 'button', onClick: () => { props.dispatch({ type: 'move_view', viewId: menuView.id, targetGroupId: 'group:bottom:utility' }); closeMenu() } }, 'Move to Bottom'),
      createElement('button', { role: 'menuitem', type: 'button', onClick: () => { props.onKeyboardMove(menuView.id); closeMenu() } }, 'Move by Keyboard'),
      ...(['left', 'right', 'top', 'bottom'] as const).map(edge => createElement('button', {
        key: `split-${edge}`,
        role: 'menuitem',
        type: 'button',
        onClick: () => { props.dispatch({ type: 'split_with_view', viewId: menuView.id, targetGroupId: props.group.id, edge }); closeMenu() },
      }, `Split ${edge[0]!.toUpperCase()}${edge.slice(1)}`)),
    ),
  )
}

function PaneGroupChrome(props: {
  readonly group: PaneGroupV1
  readonly state: PaneWorkspaceV1
  readonly registry: PaneViewRegistry
  readonly dispatch: (intent: PaneWorkspaceIntentV1) => void
  readonly drag: PaneDragSession
  readonly onCloseView: (viewId: string, focusViewId?: string) => void
  readonly onFocusTab: (viewId: string) => void
  readonly onKeyboardMove: (viewId: string) => void
  readonly onDragTarget: (target?: PaneDragTargetV1) => void
  readonly dragTarget?: PaneDragTargetV1
}): ReactNode {
  const active = props.group.activeTabId === undefined ? undefined : props.state.views[props.group.activeTabId]
  const registration = active === undefined ? undefined : props.registry.get(active.kind)
  const content = active === undefined
    ? createElement('p', { 'data-pane-empty': props.group.id }, 'No view is open in this pane.')
    : active.status === 'orphaned' || registration === undefined
      ? createElement('section', { role: 'status', 'data-pane-orphaned': active.id },
        createElement('p', null, `${active.title} is unavailable because its provider is not enabled.`),
        createElement('button', { type: 'button', onClick: () => props.onCloseView(active.id) }, 'Close Tab'),
      )
      : createElement(ViewBoundary, {
        view: active,
        onClose: () => props.onCloseView(active.id),
      }, createElement(registration.component as never, {
        view: active,
        projection: active.metadata,
        retry: () => props.dispatch({ type: 'activate_view', viewId: active.id }),
      }))
  return createElement('section', {
    'data-pane-group': props.group.id,
    'data-pane-region': props.group.region,
    'aria-label': `${props.group.role} pane`,
    'data-pane-drop-edge': props.dragTarget?.groupId === props.group.id ? props.dragTarget.edge : undefined,
    'data-pane-drop-enabled': props.dragTarget?.groupId === props.group.id ? props.dragTarget.enabled : undefined,
    'data-pane-drop-index': props.dragTarget?.groupId === props.group.id ? props.dragTarget.index : undefined,
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const moved = props.drag.move(event.clientX, event.clientY)
      if (moved.status !== 'dragging') {
        props.onDragTarget()
        return
      }
      const next = props.drag.move(event.clientX, event.clientY, dragTargetForGroup(props.state, props.group, props.drag, event))
      props.onDragTarget(next.status === 'dragging' ? next.target : undefined)
    },
    onPointerUp: () => {
      const sourceViewId = props.drag.state.status === 'dragging' ? props.drag.state.viewId : undefined
      const target = props.drag.drop()
      props.onDragTarget()
      if (sourceViewId === undefined || target === undefined) return
      const source = props.state.views[sourceViewId]
      if (source === undefined) return
      if (target.edge === 'center') {
        if (source.groupId !== target.groupId) props.dispatch({ type: 'move_view', viewId: sourceViewId, targetGroupId: target.groupId, index: target.index })
        else if (target.index !== undefined) props.dispatch({ type: 'reorder_view', viewId: sourceViewId, targetGroupId: target.groupId, index: target.index })
      } else {
        props.dispatch({ type: 'split_with_view', viewId: sourceViewId, targetGroupId: target.groupId, edge: target.edge })
      }
    },
    onPointerCancel: () => { props.drag.cancel(); props.onDragTarget(); },
    onContextMenu: () => { props.drag.cancel(); props.onDragTarget(); },
  },
    props.dragTarget?.groupId === props.group.id
      ? createElement('div', {
        role: 'status',
        'aria-live': 'polite',
        'aria-label': props.dragTarget.enabled ? `Drop ${props.dragTarget.edge}` : `Drop unavailable: ${props.dragTarget.reason ?? 'not allowed'}`,
        'data-pane-insertion-marker': props.dragTarget.edge,
        'data-pane-insertion-marker-enabled': props.dragTarget.enabled,
        'data-pane-insertion-index': props.dragTarget.index,
      }, props.dragTarget.enabled ? `Drop ${props.dragTarget.edge}` : `Drop unavailable`)
      : null,
    createElement(PaneTabBar, {
      group: props.group,
      state: props.state,
      dispatch: props.dispatch,
      drag: props.drag,
      onCloseView: props.onCloseView,
      onFocusTab: props.onFocusTab,
      onKeyboardMove: props.onKeyboardMove,
      onDragTarget: props.onDragTarget,
    }),
    active === undefined ? null : createElement('div', { id: `pane-panel-${active.id}`, role: 'tabpanel', 'aria-labelledby': `pane-tab-${active.id}` }, content),
  )
}

/** Accessible chrome over the pure reducer; it does not read DSH DOM or client stores. */
export function PaneWorkbenchChrome({ initialState = createPaneWorkspace(), registry, width = 1400, onStateChange, controller, defaultVisible = false }: PaneWorkbenchChromeProps): ReactNode {
  const [state, setState] = useState(() => markOrphanedPaneViews(initialState, registry))
  const [announcement, setAnnouncement] = useState('')
  const [resizing, setResizing] = useState(false)
  const [resizePreview, setResizePreview] = useState<number>()
  const [moveMode, setMoveMode] = useState<PaneMoveModeState>()
  const [focusTabId, setFocusTabId] = useState<string>()
  const [dragTarget, setDragTarget] = useState<PaneDragTargetV1>()
  const [workbenchVisible, setWorkbenchVisible] = useState(() => controller?.isVisible ?? defaultVisible)
  const lastDragAnnouncement = useRef('')
  const moveDialog = useRef<HTMLElement>()
  const workbenchToggleRef = useRef<HTMLButtonElement>()
  const drag = useMemo(() => new PaneDragSession(), [])
  const projection = projectPaneWorkspace(state, width)
  const dispatch = (intent: PaneWorkspaceIntentV1): void => {
    const reduced = reducePaneWorkspace(state, intent)
    const next = markOrphanedPaneViews(reduced.state, registry)
    setState(next)
    onStateChange?.(next)
    setAnnouncement(reduced.effects[0]?.message ?? (reduced.accepted ? 'Layout updated.' : reduced.reason ?? 'Layout action was not available.'))
  }
  useEffect(() => registry.subscribe(() => setState(current => markOrphanedPaneViews(current, registry))), [registry])
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch
  useEffect(() => controller?.attach(intent => dispatchRef.current(intent)), [controller])
  useEffect(() => () => drag.cancel(), [drag])
  useEffect(() => {
    const cancelDrag = (): void => {
      if (drag.state.status === 'idle') return
      drag.cancel()
      setDragTarget(undefined)
      setAnnouncement('Drag cancelled.')
    }
    window.addEventListener('blur', cancelDrag)
    return () => window.removeEventListener('blur', cancelDrag)
  }, [drag])
  useEffect(() => {
    if (focusTabId === undefined) return
    document.getElementById(`pane-tab-${focusTabId}`)?.focus()
    setFocusTabId(undefined)
  }, [focusTabId, state])
  useEffect(() => {
    if (!workbenchVisible) workbenchToggleRef.current?.focus()
  }, [workbenchVisible])
  useEffect(() => {
    if (controller === undefined) return
    const unsubscribe = controller.subscribe(() => setWorkbenchVisible(controller.isVisible))
    return unsubscribe
  }, [controller])

  const resize = useMemo(() => new PaneResizeSession(
    ratio => { setResizing(true); setResizePreview(ratio) },
    ratio => { setResizing(false); setResizePreview(undefined); dispatch({ type: 'resize_region', region: projection.activeRegion, size: ratio }) },
  ), [projection.activeRegion, state])
  const groups = visibleGroups(state, projection)
  const groupsByRegion = (region: 'right' | 'bottom'): readonly PaneGroupV1[] => groups.filter(group => group.region === region)
  const sourceView = moveMode === undefined ? undefined : state.views[moveMode.viewId]
  const moveTargets: readonly PaneMoveTarget[] = sourceView === undefined ? [] : groups.flatMap(group => {
    const groupLabel = `${group.role} pane`
    const targets: PaneMoveTarget[] = []
    if (group.id !== sourceView.groupId) targets.push({ groupId: group.id, edge: 'center', label: `Move to ${groupLabel}` })
    for (const edge of ['left', 'right', 'top', 'bottom'] as const) targets.push({ groupId: group.id, edge, label: `Split ${groupLabel} ${edge}` })
    return targets
  })
  const beginKeyboardMove = (viewId: string): void => {
    const view = state.views[viewId]
    if (view === undefined) return
    setMoveMode({ viewId, targetIndex: 0 })
    setAnnouncement(`Keyboard move mode for ${view.title}. Use Arrow keys to choose a target, Enter to apply, Escape to cancel.`)
  }
  const handleMoveModeInput = (event: KeyboardEvent<HTMLElement>): void => {
    if (moveMode === undefined || moveTargets.length === 0) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMoveMode(undefined)
        setAnnouncement('Keyboard move cancelled.')
      }
      return
    }
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1
        : undefined
    if (direction !== undefined) {
      event.preventDefault()
      const targetIndex = (moveMode.targetIndex + direction + moveTargets.length) % moveTargets.length
      setMoveMode({ ...moveMode, targetIndex })
      setAnnouncement(`${moveTargets[targetIndex]!.label}. Press Enter to apply or Escape to cancel.`)
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const targetIndex = event.key === 'Home' ? 0 : moveTargets.length - 1
      setMoveMode({ ...moveMode, targetIndex })
      setAnnouncement(`${moveTargets[targetIndex]!.label}. Press Enter to apply or Escape to cancel.`)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setMoveMode(undefined)
      setAnnouncement('Keyboard move cancelled.')
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const target = moveTargets[moveMode.targetIndex]
      if (target === undefined) return
      if (target.edge === 'center') dispatch({ type: 'move_view', viewId: moveMode.viewId, targetGroupId: target.groupId })
      else dispatch({ type: 'split_with_view', viewId: moveMode.viewId, targetGroupId: target.groupId, edge: target.edge })
      setFocusTabId(moveMode.viewId)
      setMoveMode(undefined)
    }
  }
  useEffect(() => {
    if (moveMode !== undefined) moveDialog.current?.focus()
  }, [moveMode])
  const closeView = (viewId: string, focusViewId?: string): void => {
    if (focusViewId !== undefined) setFocusTabId(focusViewId)
    dispatch({ type: 'close_view', viewId })
  }
  const updateDragTarget = (target?: PaneDragTargetV1): void => {
    setDragTarget(previous => previous?.groupId === target?.groupId
      && previous?.edge === target?.edge
      && previous?.index === target?.index
      && previous?.enabled === target?.enabled
      && previous?.reason === target?.reason ? previous : target)
    const message = target === undefined
      ? ''
      : target.enabled
        ? `${target.edge === 'center' ? 'Move to' : 'Split at'} ${target.groupId}; release to apply.`
        : `Drop unavailable: ${target.reason ?? 'not allowed'}.`
    if (message !== lastDragAnnouncement.current) {
      lastDragAnnouncement.current = message
      if (message.length > 0) setAnnouncement(message)
    }
  }
  const snapGuide = resizePreview === undefined ? undefined : [0.25, 0.5, 0.75].find(snap => Math.abs(snap - resizePreview) <= 0.08)
  if (!workbenchVisible) {
    return createElement('aside', {
      'aria-label': 'Pane Workbench',
      'data-pane-workbench-visible': 'false',
      style: { pointerEvents: 'none' },
    },
    createElement('button', {
      ref: workbenchToggleRef,
      type: 'button',
      'aria-expanded': false,
      style: { pointerEvents: 'auto' },
      onClick: () => {
        if (controller !== undefined) controller.show()
        else setWorkbenchVisible(true)
      },
    }, 'Show Pane Workbench'),
    )
  }
  return createElement('aside', {
    'aria-label': 'Pane Workbench',
    'data-pane-workbench-mode': projection.mode,
    'data-pane-workbench-visible': 'true',
    'data-pane-resizing': resizing || undefined,
    'data-pane-resize-preview': resizePreview,
    style: { pointerEvents: 'auto', ...(resizing ? { transition: 'none' } : {}) },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'Escape' || drag.state.status === 'idle') return
      event.preventDefault()
      drag.cancel()
      setDragTarget(undefined)
      setAnnouncement('Drag cancelled.')
    },
  },
  createElement('div', { role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, announcement),
  createElement('header', null,
    createElement('button', { ref: workbenchToggleRef, type: 'button', 'aria-expanded': true, onClick: () => {
      if (controller !== undefined) controller.hide()
      else setWorkbenchVisible(false)
    } }, 'Hide Pane Workbench'),
    createElement('button', { type: 'button', onClick: () => dispatch({ type: 'set_region_visibility', region: 'right', visible: !state.regions.right.visible }) }, state.regions.right.visible ? 'Hide Right' : 'Show Right'),
    createElement('button', { type: 'button', onClick: () => dispatch({ type: 'set_region_visibility', region: 'bottom', visible: !state.regions.bottom.visible }) }, state.regions.bottom.visible ? 'Hide Bottom' : 'Show Bottom'),
    createElement('button', { type: 'button', onClick: () => dispatch({ type: 'reset_layout' }) }, 'Reset Layout'),
  ),
  (['right', 'bottom'] as const).filter(region => projection.regions[region].visible).map(region => createElement('section', {
    key: region,
    'data-pane-region': region,
    'aria-label': `${region} pane region`,
    'data-pane-region-size': projection.regions[region].size,
    style: { display: 'flex', flexDirection: region === 'right' ? 'row' : 'column' },
  }, groupsByRegion(region).map(group => createElement(PaneGroupChrome, {
    key: group.id,
    group,
    state,
    registry,
    dispatch,
    drag,
    onCloseView: closeView,
    onFocusTab: setFocusTabId,
    onKeyboardMove: beginKeyboardMove,
    onDragTarget: updateDragTarget,
    dragTarget,
  })))),
  moveMode === undefined ? null : createElement('section', {
    ref: moveDialog,
    role: 'dialog',
    tabIndex: 0,
    'aria-modal': true,
    'aria-label': 'Keyboard move mode',
    'data-pane-keyboard-move': moveMode.viewId,
    onKeyDown: handleMoveModeInput,
  },
  createElement('h2', null, `Move ${sourceView?.title ?? 'view'}`),
  createElement('p', null, 'Arrow/Home/End choose a target. Enter or Space applies. Escape cancels.'),
  ...moveTargets.map((target, index) => createElement('div', {
    key: `${target.groupId}:${target.edge}`,
    'aria-current': index === moveMode.targetIndex ? 'true' : undefined,
    'data-pane-move-target': `${target.groupId}:${target.edge}`,
  }, `${index === moveMode.targetIndex ? '› ' : '  '}${target.label}`)),
  ),
  createElement('div', {
    role: 'separator', tabIndex: 0, 'aria-label': 'Resize active pane region', 'aria-orientation': projection.activeRegion === 'right' ? 'vertical' : 'horizontal',
    'aria-valuemin': 0.16,
    'aria-valuemax': 0.8,
    'aria-valuenow': resizePreview ?? projection.regions[projection.activeRegion].size,
    'data-pane-snap-guide': snapGuide,
    onPointerDown: () => resize.begin(), onPointerMove: (event: PointerEvent<HTMLDivElement>) => resize.move(Math.max(0.16, Math.min(0.8, event.clientX / Math.max(1, event.currentTarget.parentElement?.clientWidth ?? 1)))), onPointerUp: () => resize.end(), onPointerCancel: () => { resize.cancel(); setResizing(false); setResizePreview(undefined) },
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      const current = state.regions[projection.activeRegion].size
      if (event.key === 'Home') { event.preventDefault(); dispatch({ type: 'resize_region', region: projection.activeRegion, size: 0.16 }) }
      else if (event.key === 'End') { event.preventDefault(); dispatch({ type: 'resize_region', region: projection.activeRegion, size: 0.8 }) }
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); dispatch({ type: 'resize_region', region: projection.activeRegion, size: current - (event.shiftKey ? 0.01 : 0.05) }) }
      else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); dispatch({ type: 'resize_region', region: projection.activeRegion, size: current + (event.shiftKey ? 0.01 : 0.05) }) }
    },
  }),
  )
}
