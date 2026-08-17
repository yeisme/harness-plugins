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
import { PaneDragSession, PaneResizeSession } from './interactions.js'
import { projectPaneWorkspace, type PaneWorkspaceProjectionV1 } from './projection.js'
import { markOrphanedPaneViews, type PaneViewRegistry } from './view-registry.js'
import {
  createPaneWorkspace,
  reducePaneWorkspace,
  type PaneGroupV1,
  type PaneViewInstanceV1,
  type PaneWorkspaceIntentV1,
  type PaneWorkspaceV1,
} from './workspace.js'

export interface PaneWorkbenchChromeProps {
  readonly initialState?: PaneWorkspaceV1
  readonly registry: PaneViewRegistry
  readonly width?: number
  readonly onStateChange?: (state: PaneWorkspaceV1) => void
}

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

function PaneTabBar(props: {
  readonly group: PaneGroupV1
  readonly state: PaneWorkspaceV1
  readonly dispatch: (intent: PaneWorkspaceIntentV1) => void
  readonly drag: PaneDragSession
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
      return
    }
    if (event.key === 'Delete') {
      event.preventDefault()
      props.dispatch({ type: 'close_view', viewId: view.id })
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
        'data-preview': view.preview || undefined,
        onClick: () => props.dispatch({ type: 'activate_view', viewId: view.id }),
        onKeyDown: event => onKeyDown(event, view),
        onPointerDown: (event: PointerEvent<HTMLButtonElement>) => props.drag.begin(view.id, event.clientX, event.clientY),
        onPointerMove: (event: PointerEvent<HTMLButtonElement>) => props.drag.move(event.clientX, event.clientY, { groupId: props.group.id, edge: 'center', enabled: true }),
        onPointerUp: () => {
          const target = props.drag.drop()
          if (target !== undefined && target.groupId !== props.group.id) props.dispatch({ type: 'move_view', viewId: view.id, targetGroupId: target.groupId })
        },
        onPointerCancel: () => props.drag.cancel(),
        onBlur: () => props.drag.cancel(),
      }, `${view.title}${view.dirty ? ' •' : ''}${view.pinned ? ' 📌' : ''}`)
    }),
    menuView === undefined ? null : createElement('div', { role: 'menu', 'aria-label': `${menuView.title} actions` },
      createElement('button', { role: 'menuitem', type: 'button', onClick: () => { props.dispatch({ type: 'pin_view', viewId: menuView.id }); closeMenu() } }, menuView.pinned ? 'Unpin' : 'Pin'),
      createElement('button', { role: 'menuitem', type: 'button', onClick: () => { props.dispatch({ type: 'close_view', viewId: menuView.id }); closeMenu() } }, 'Close'),
      createElement('button', { role: 'menuitem', type: 'button', onClick: () => { props.dispatch({ type: 'move_view', viewId: menuView.id, targetGroupId: 'group:right:content' }); closeMenu() } }, 'Move to Right'),
      createElement('button', { role: 'menuitem', type: 'button', onClick: () => { props.dispatch({ type: 'move_view', viewId: menuView.id, targetGroupId: 'group:bottom:utility' }); closeMenu() } }, 'Move to Bottom'),
    ),
  )
}

function PaneGroupChrome(props: {
  readonly group: PaneGroupV1
  readonly state: PaneWorkspaceV1
  readonly registry: PaneViewRegistry
  readonly dispatch: (intent: PaneWorkspaceIntentV1) => void
  readonly drag: PaneDragSession
}): ReactNode {
  const active = props.group.activeTabId === undefined ? undefined : props.state.views[props.group.activeTabId]
  const registration = active === undefined ? undefined : props.registry.get(active.kind)
  const content = active === undefined
    ? createElement('p', { 'data-pane-empty': props.group.id }, 'No view is open in this pane.')
    : active.status === 'orphaned' || registration === undefined
      ? createElement('section', { role: 'status', 'data-pane-orphaned': active.id },
        createElement('p', null, `${active.title} is unavailable because its provider is not enabled.`),
        createElement('button', { type: 'button', onClick: () => props.dispatch({ type: 'close_view', viewId: active.id }) }, 'Close Tab'),
      )
      : createElement(ViewBoundary, {
        view: active,
        onClose: () => props.dispatch({ type: 'close_view', viewId: active.id }),
      }, createElement(registration.component as never, { view: active, retry: () => props.dispatch({ type: 'activate_view', viewId: active.id }) }))
  return createElement('section', { 'data-pane-group': props.group.id, 'aria-label': `${props.group.role} pane` },
    createElement(PaneTabBar, { group: props.group, state: props.state, dispatch: props.dispatch, drag: props.drag }),
    active === undefined ? null : createElement('div', { id: `pane-panel-${active.id}`, role: 'tabpanel', 'aria-labelledby': `pane-tab-${active.id}` }, content),
  )
}

/** Accessible chrome over the pure reducer; it does not read DSH DOM or client stores. */
export function PaneWorkbenchChrome({ initialState = createPaneWorkspace(), registry, width = 1400, onStateChange }: PaneWorkbenchChromeProps): ReactNode {
  const [state, setState] = useState(() => markOrphanedPaneViews(initialState, registry))
  const [announcement, setAnnouncement] = useState('')
  const [resizing, setResizing] = useState(false)
  const drag = useMemo(() => new PaneDragSession(), [])
  const projection = projectPaneWorkspace(state, width)
  const dispatch = (intent: PaneWorkspaceIntentV1): void => {
    const next = markOrphanedPaneViews(reducePaneWorkspace(state, intent).state, registry)
    setState(next)
    onStateChange?.(next)
    const reduced = reducePaneWorkspace(state, intent)
    setAnnouncement(reduced.effects[0]?.message ?? (reduced.accepted ? 'Layout updated.' : reduced.reason ?? 'Layout action was not available.'))
  }
  useEffect(() => registry.subscribe(() => setState(current => markOrphanedPaneViews(current, registry))), [registry])
  useEffect(() => () => drag.cancel(), [drag])

  const resize = useMemo(() => new PaneResizeSession(
    () => setResizing(true),
    ratio => { setResizing(false); dispatch({ type: 'resize_region', region: projection.activeRegion, size: ratio }) },
  ), [projection.activeRegion, state])
  const groups = visibleGroups(state, projection)
  return createElement('aside', {
    'aria-label': 'Pane Workbench',
    'data-pane-workbench-mode': projection.mode,
    'data-pane-resizing': resizing || undefined,
    style: resizing ? { transition: 'none' } : undefined,
  },
  createElement('div', { role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, announcement),
  createElement('header', null,
    createElement('button', { type: 'button', onClick: () => dispatch({ type: 'set_region_visibility', region: 'right', visible: !state.regions.right.visible }) }, state.regions.right.visible ? 'Hide Right' : 'Show Right'),
    createElement('button', { type: 'button', onClick: () => dispatch({ type: 'set_region_visibility', region: 'bottom', visible: !state.regions.bottom.visible }) }, state.regions.bottom.visible ? 'Hide Bottom' : 'Show Bottom'),
    createElement('button', { type: 'button', onClick: () => dispatch({ type: 'reset_layout' }) }, 'Reset Layout'),
  ),
  groups.map(group => createElement(PaneGroupChrome, { key: group.id, group, state, registry, dispatch, drag })),
  createElement('div', {
    role: 'separator', tabIndex: 0, 'aria-label': 'Resize active pane region', 'aria-orientation': projection.activeRegion === 'right' ? 'vertical' : 'horizontal',
    onPointerDown: () => resize.begin(), onPointerMove: (event: PointerEvent<HTMLDivElement>) => resize.move(Math.max(0.16, Math.min(0.8, event.clientX / Math.max(1, event.currentTarget.parentElement?.clientWidth ?? 1)))), onPointerUp: () => resize.end(), onPointerCancel: () => resize.cancel(),
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
