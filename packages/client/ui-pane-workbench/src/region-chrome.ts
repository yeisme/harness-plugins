import {
  Component,
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import type { PaneDragTargetV1 } from './interactions.js'
import { PaneResizeSession } from './interactions.js'
import type { PaneWorkbenchController } from './controller.js'
import { isPaneCoreViewId, type PaneCoreViewId } from './core-pane.js'
import type { PaneViewRegistry } from './view-registry.js'
import { WorkbenchIcon } from './icon.js'
import type { WorkbenchIconName } from './icon.js'
import { formatT, t } from './i18n/locale.js'
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
  PaneRegionId,
  PaneSplitNodeV1,
  PaneViewInstanceV1,
  PaneWorkspaceV1,
} from './workspace.js'

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
}

interface ViewBoundaryProps {
  readonly view: PaneViewInstanceV1
  readonly onClose: () => void
  readonly children?: ReactNode
}

interface ViewBoundaryState { readonly error?: Error; readonly generation: number }

const PANE_MIN_WIDTH = 280
const PANE_MIN_HEIGHT = 180
const SPLITTER_SIZE = 5
const RIGHT_RAIL_WIDTH = 44

function splitFits(edge: PaneDragTargetV1['edge'], width: number, height: number): boolean {
  return edge === 'left' || edge === 'right'
    ? width >= PANE_MIN_WIDTH * 2 + SPLITTER_SIZE
    : edge === 'top' || edge === 'bottom'
      ? height >= PANE_MIN_HEIGHT * 2 + SPLITTER_SIZE
      : true
}

const REGION_STYLES = `
.pwr-root{position:relative;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;color:var(--dsw-alias-text-primary,#ececf1);background:var(--dsw-alias-bg-base,#171719);font:var(--dsh-wb-font-size,14px)/1.4 var(--dsw-font-family,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif)}
.pwr-rail{position:absolute;inset:0 auto 0 0;width:43px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 5px;box-sizing:border-box;background:var(--dsw-specific-sidebar-fill,#1c1c1f);z-index:3}
.pwr-rail-fonts{margin-top:auto;display:flex;flex-direction:column;gap:4px}
.pwr-rail button,.pwr-icon{width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-text-secondary,#aaaab2);display:grid;place-items:center;cursor:pointer}
.pwr-rail button:hover,.pwr-rail button:focus-visible,.pwr-icon:hover,.pwr-icon:focus-visible{background:var(--dsw-alias-fill-hover,rgba(255,255,255,.08));color:var(--dsw-alias-text-primary,#fff);outline:2px solid var(--dsw-alias-border-focus,#79b8ff);outline-offset:-2px}
.pwr-rail .pwr-active{background:var(--dsw-alias-fill-selected,rgba(101,166,255,.18));color:var(--dsw-alias-text-link,#8fc5ff)}
.pwr-body{position:absolute;inset:0;display:flex;flex-direction:column;min-width:0;min-height:0;background:inherit}
.pwr-root[data-region='right'] .pwr-body{left:44px;width:calc(100% - 44px)}
.pwr-body[data-body-visible='false']{visibility:hidden;pointer-events:none;opacity:0}
.pwr-tab-actions svg,.pwr-rail svg,.pwr-picker svg,.pwr-menu svg{flex:none}
.pwr-tree{flex:1;min-width:0;min-height:0;display:flex;overflow:hidden}
.pwr-split{display:flex;flex:1;min-width:0;min-height:0;overflow:hidden}
.pwr-split[data-orientation='horizontal']{flex-direction:row}.pwr-split[data-orientation='vertical']{flex-direction:column}
.pwr-branch{display:flex;min-width:0;min-height:0;overflow:hidden}
.pwr-splitter{flex:0 0 5px;position:relative;background:transparent;z-index:2;outline:none}
.pwr-split[data-orientation='horizontal']>.pwr-splitter{cursor:col-resize;border-left:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1))}
.pwr-split[data-orientation='vertical']>.pwr-splitter{cursor:row-resize;border-top:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1))}
.pwr-splitter:hover,.pwr-splitter:focus-visible{background:var(--dsw-alias-border-focus,#79b8ff)}
.pwr-group{position:relative;display:flex;flex:1;flex-direction:column;min-width:0;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base,#171719)}
.pwr-tabs{height:38px;min-height:38px;display:flex;align-items:stretch;overflow-x:auto;overflow-y:hidden;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));scrollbar-width:thin}
.pwr-tab{position:relative;max-width:220px;min-width:72px;padding:0 12px;border:0;border-right:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));background:transparent;color:var(--dsw-alias-text-secondary,#b8b8c0);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default}
.pwr-tab[aria-selected='true']{background:var(--dsw-alias-bg-elevated,#202024);color:var(--dsw-alias-text-primary,#fff)}
.pwr-tab[aria-selected='true']::after{content:'';position:absolute;left:8px;right:8px;bottom:0;height:2px;border-radius:2px;background:var(--dsw-alias-accent,#79b8ff)}
.pwr-tab:focus-visible{outline:2px solid var(--dsw-alias-border-focus,#79b8ff);outline-offset:-2px}
.pwr-tab-actions{display:flex;align-items:center;gap:2px;margin-left:auto;padding:0 5px;background:var(--dsw-alias-bg-elevated,#1c1c1f);position:sticky;right:0;z-index:1}
.pwr-tab-actions button{display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-text-secondary,#aaaab2);cursor:pointer}
.pwr-tab-actions button:hover,.pwr-tab-actions button:focus-visible{background:var(--dsw-alias-fill-hover,rgba(255,255,255,.08));color:var(--dsw-alias-text-primary,#fff);outline:2px solid var(--dsw-alias-border-focus,#79b8ff);outline-offset:-2px}
.pwr-panel{flex:1;min-width:0;min-height:0;overflow:auto}
.pwr-panel>*{min-width:0;min-height:100%;box-sizing:border-box}
.pwr-empty{margin:auto;max-width:280px;padding:24px;text-align:center;color:var(--dsw-alias-text-tertiary,#8b8b94)}
.pwr-empty button{margin-top:10px;height:32px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:8px;background:var(--dsw-alias-bg-elevated,#242429);color:inherit}
.pwr-drop{position:absolute;inset:6px;z-index:5;display:grid;place-items:center;border:1px dashed var(--dsw-alias-border-focus,#79b8ff);border-radius:10px;background:rgba(55,119,190,.14);pointer-events:none}
.pwr-menu{position:absolute;top:38px;right:8px;z-index:7;min-width:170px;padding:6px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:10px;background:var(--dsw-alias-bg-elevated,#242429);box-shadow:0 12px 36px rgba(0,0,0,.35)}
.pwr-menu button{display:block;width:100%;height:30px;padding:0 9px;border:0;border-radius:6px;text-align:left;background:transparent;color:inherit}.pwr-menu button:hover,.pwr-menu button:focus-visible{background:var(--dsw-alias-fill-hover,rgba(255,255,255,.08));outline:none}
.pwr-root[data-region='right'][data-picker-open='true']{overflow:visible;z-index:30}
.pwr-picker{position:absolute;top:48px;right:8px;z-index:8;box-sizing:border-box;width:min(340px,calc(100vw - 24px));max-height:min(520px,calc(100vh - 56px));display:flex;flex-direction:column;padding:10px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:12px;background:var(--dsw-alias-bg-elevated,#222226);color:var(--dsw-alias-text-primary,#fff);box-shadow:0 18px 42px rgba(0,0,0,.42)}
.pwr-picker header{display:flex;align-items:center;padding:4px 6px 10px}.pwr-picker header strong{font-size:14px}.pwr-picker header button{margin-left:auto}
.pwr-picker-list{display:grid;gap:4px;overflow:auto}.pwr-picker-list button{display:flex;align-items:center;gap:10px;min-height:42px;padding:8px 10px;border:0;border-radius:9px;background:transparent;color:inherit;text-align:left}.pwr-picker-list button:hover,.pwr-picker-list button:focus-visible{background:var(--dsw-alias-fill-hover,rgba(255,255,255,.08));outline:2px solid var(--dsw-alias-border-focus,#79b8ff);outline-offset:-2px}
.pwr-status{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.pwr-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:600px){.pwr-root[data-region='right'] .pwr-picker{position:fixed;top:56px;right:12px;width:min(340px,calc(100vw - 80px));max-height:min(520px,calc(100vh - 72px))}}
`

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

function groupIds(node: PaneSplitNodeV1, output: string[] = []): string[] {
  if (node.type === 'group') output.push(node.groupId)
  else { groupIds(node.first, output); groupIds(node.second, output) }
  return output
}

function nextTab(group: PaneGroupV1, viewId: string, direction: -1 | 1): string | undefined {
  const current = group.tabs.indexOf(viewId)
  return current < 0 || group.tabs.length === 0 ? undefined : group.tabs[(current + direction + group.tabs.length) % group.tabs.length]
}

function targetGroup(state: PaneWorkspaceV1, view: PaneViewInstanceV1, region: PaneRegionId): PaneGroupV1 | undefined {
  return Object.values(state.groups)
    .filter(group => group.region === region && (!group.locked || group.role === view.role))
    .sort((left, right) => Number(left.role !== view.role && left.role !== 'general') - Number(right.role !== view.role && right.role !== 'general') || Number(left.locked) - Number(right.locked) || left.id.localeCompare(right.id))[0]
}

function iconForView(view: PaneViewInstanceV1): WorkbenchIconName {
  if (view.kind.includes('git')) return 'git'
  if (view.kind.includes('subagent') || view.kind.includes('agent')) return 'agents'
  if (view.role === 'utility' || view.kind.includes('terminal')) return 'terminal'
  if (view.role === 'navigator' || view.kind.includes('file')) return 'file'
  if (view.kind.includes('media')) return 'media'
  return 'document'
}

function Picker(props: { registry: PaneViewRegistry; controller: PaneWorkbenchController; onClose: () => void }): ReactNode {
  const [, setRevision] = useState(0)
  useEffect(() => props.registry.subscribe(() => setRevision(value => value + 1)), [props.registry])
  const registrations = props.registry.snapshot().filter(registration => registration.showInPicker !== false)
  return createElement('section', { className: 'pwr-picker', role: 'dialog', 'aria-modal': false, 'aria-label': t('chrome.openView') },
    createElement('header', null,
      createElement('strong', null, t('chrome.openViewTitle')),
      createElement('button', { type: 'button', className: 'pwr-icon', onClick: props.onClose, 'aria-label': t('chrome.closeViewSelector') }, createElement(WorkbenchIcon, { name: 'close' })),
    ),
    createElement('div', { className: 'pwr-picker-list' },
      registrations.length === 0 ? createElement('p', { className: 'pwr-empty' }, t('error.noViewOpen')) : null,
      ...registrations.map(({ descriptor }) => createElement('button', {
        key: descriptor.kind,
        type: 'button',
        onClick: () => {
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
        },
      }, createElement(WorkbenchIcon, { name: descriptor.kind.includes('git') ? 'git' : descriptor.kind.includes('subagent') || descriptor.kind.includes('agent') ? 'agents' : descriptor.role === 'utility' ? 'terminal' : descriptor.role === 'navigator' ? 'file' : descriptor.kind.includes('media') ? 'media' : 'document' }), createElement('span', null, descriptor.label))),
    ),
  )
}

function SplitTree(props: {
  node: PaneSplitNodeV1
  state: PaneWorkspaceV1
  registry: PaneViewRegistry
  controller: PaneWorkbenchController
  regionWidth: number
  regionHeight: number
  onOpenPicker: () => void
  renderCoreView?: (id: PaneCoreViewId) => ReactNode
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
  renderCoreView?: (id: PaneCoreViewId) => ReactNode
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

function GroupChrome(props: {
  group: PaneGroupV1
  state: PaneWorkspaceV1
  registry: PaneViewRegistry
  controller: PaneWorkbenchController
  regionWidth: number
  regionHeight: number
  onOpenPicker: () => void
  renderCoreView?: (id: PaneCoreViewId) => ReactNode
}): ReactNode {
  const [menuViewId, setMenuViewId] = useState<string>()
  const groupElement = useRef<HTMLElement>(null)
  const drag = useSyncExternalStore(props.controller.drag.subscribe, props.controller.drag.getSnapshot, props.controller.drag.getSnapshot)
  const active = props.group.activeTabId === undefined ? undefined : props.state.views[props.group.activeTabId]
  const maximized = props.state.maximizedGroupId === props.group.id
  const registration = active === undefined ? undefined : props.registry.get(active.kind)
  const target = drag.target?.groupId === props.group.id ? drag.target : undefined
  const close = (viewId: string): void => { props.controller.dispatch({ type: 'close_view', viewId }) }
  const onTabKeyDown = (event: KeyboardEvent<HTMLElement>, view: PaneViewInstanceV1): void => {
    const next = event.key === 'ArrowRight' ? nextTab(props.group, view.id, 1)
      : event.key === 'ArrowLeft' ? nextTab(props.group, view.id, -1)
      : event.key === 'Home' ? props.group.tabs[0]
      : event.key === 'End' ? props.group.tabs.at(-1)
      : undefined
    if (next !== undefined) { event.preventDefault(); props.controller.dispatch({ type: 'activate_view', viewId: next }); document.getElementById(`pane-tab-${next}`)?.focus(); return }
    if (event.key === 'Delete') { event.preventDefault(); close(view.id); return }
    if (event.key === 'F10' && event.shiftKey) { event.preventDefault(); setMenuViewId(view.id) }
  }
  const dropTarget = (event: PointerEvent<HTMLElement>): PaneDragTargetV1 | undefined => {
    const sourceId = drag.drag.status === 'dragging' ? drag.drag.viewId : drag.drag.status === 'pending' ? drag.drag.viewId : undefined
    const source = sourceId === undefined ? undefined : props.state.views[sourceId]
    if (source === undefined) return undefined
    const rect = event.currentTarget.getBoundingClientRect()
    const tab = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-pane-tab-index]') : null
    let edge: PaneDragTargetV1['edge'] = 'center'
    let index: number | undefined
    if (tab !== null) {
      const rawIndex = Number(tab.dataset.paneTabIndex)
      index = Number.isSafeInteger(rawIndex) ? rawIndex + Number(event.clientX >= tab.getBoundingClientRect().left + tab.getBoundingClientRect().width / 2) : props.group.tabs.length
    } else if (rect.width > 0 && rect.height > 0) {
      const x = (event.clientX - rect.left) / rect.width
      const y = (event.clientY - rect.top) / rect.height
      edge = x <= 0.2 ? 'left' : x >= 0.8 ? 'right' : y <= 0.2 ? 'top' : y >= 0.8 ? 'bottom' : 'center'
    }
    const locked = props.group.locked && props.group.role !== source.role
    const tooSmall = !splitFits(edge, rect.width, rect.height)
    const noOp = source.groupId === props.group.id && edge === 'center' && index === undefined
    return { groupId: props.group.id, edge, index, enabled: !locked && !tooSmall && !noOp, reason: locked ? 'locked' : tooSmall ? 'minimum_size' : noOp ? 'already_in_group' : undefined }
  }
  const menuView = menuViewId === undefined ? undefined : props.state.views[menuViewId]
  const measured = groupElement.current?.getBoundingClientRect()
  const menuWidth = measured !== undefined && measured.width > 0
    ? measured.width
    : Math.max(0, props.regionWidth - (props.group.region === 'right' ? RIGHT_RAIL_WIDTH : 0))
  const menuHeight = measured !== undefined && measured.height > 0
    ? measured.height
    : Math.max(0, props.regionHeight)
  const content = active === undefined
    ? null
    : active.status === 'orphaned' || registration === undefined
      ? createElement('section', { className: 'pwr-empty', role: 'status' },
        createElement('p', null, formatT('error.unavailable', { title: active.title })),
        createElement('button', { type: 'button', onClick: () => close(active.id) }, formatT('tab.closeWithName', { name: active.title }))
      )
      : createElement(ViewBoundary, { view: active, onClose: () => close(active.id) },
        createElement(registration.component as never, {
          view: active,
          projection: active.metadata,
          hostContent: isPaneCoreViewId(active.kind) ? props.renderCoreView?.(active.kind) : undefined,
          retry: () => props.controller.dispatch({ type: 'activate_view', viewId: active.id }),
        }))

  return createElement('section', {
    ref: groupElement,
    className: 'pwr-group',
    'data-pane-group': props.group.id,
    'data-pane-region': props.group.region,
    'data-pane-drop-edge': target?.edge,
    'data-pane-drop-enabled': target?.enabled,
    onPointerMove: (event: PointerEvent<HTMLElement>) => { props.controller.drag.move(event.clientX, event.clientY, dropTarget(event)) },
    onPointerUp: () => { props.controller.drag.drop() },
    onPointerCancel: () => props.controller.drag.cancel(),
  },
  target === undefined ? null : createElement('div', { className: 'pwr-drop', role: 'status', 'aria-label': target.enabled ? `${t('drag.splitUpper')} ${target.edge}` : `${formatT('drag.unavailable', {})}: ${target.reason ?? formatT('drag.notAllowed', {})}` }, target.enabled ? `${t('drag.splitUpper')} ${target.edge}` : formatT('drag.unavailable', {})),
  createElement('div', { className: 'pwr-tabs', role: 'tablist', 'aria-label': `${props.group.role} pane tabs` },
    ...props.group.tabs.map((viewId, tabIndex) => {
      const view = props.state.views[viewId]
      if (view === undefined) return null
      return createElement('button', {
        key: view.id, id: `pane-tab-${view.id}`, className: 'pwr-tab', role: 'tab', type: 'button',
        title: view.title, 'aria-selected': props.group.activeTabId === view.id, 'aria-controls': `pane-panel-${view.id}`,
        tabIndex: props.group.activeTabId === view.id ? 0 : -1, 'data-pane-tab-index': tabIndex,
        onClick: () => props.controller.dispatch({ type: 'activate_view', viewId: view.id }),
        onDoubleClick: () => props.controller.dispatch({ type: 'pin_view', viewId: view.id, pinned: true }),
        onContextMenu: event => { event.preventDefault(); setMenuViewId(view.id) },
        onKeyDown: event => onTabKeyDown(event, view),
        onPointerDown: (event: PointerEvent<HTMLButtonElement>) => props.controller.drag.begin(view.id, event.clientX, event.clientY),
      }, createElement(WorkbenchIcon, { name: iconForView(view), size: 14 }), createElement('span', { className: 'pwr-tab-title' }, `${view.title}${view.dirty ? ' •' : ''}`))
    }),
    createElement('div', { className: 'pwr-tab-actions', role: 'group', 'aria-label': t('chrome.paneActions') },
      createElement('button', {
        type: 'button', title: t('chrome.openView'), 'aria-label': t('chrome.openView'),
        onClick: props.onOpenPicker,
      }, createElement(WorkbenchIcon, { name: 'add' })),
      active === undefined ? null : createElement('button', {
        type: 'button', title: formatT('chrome.moreActions', { name: active.title }), 'aria-label': formatT('chrome.moreActions', { name: active.title }),
        onClick: () => setMenuViewId(active.id),
      }, createElement(WorkbenchIcon, { name: 'more' })),
      active === undefined ? null : createElement('button', {
        type: 'button', title: maximized ? t('chrome.restorePane') : t('chrome.maximizePane'),
        'aria-label': maximized ? t('chrome.restorePane') : t('chrome.maximizePane'),
        onClick: () => { props.controller.dispatch(maximized ? { type: 'restore_layout' } : { type: 'maximize_group', groupId: props.group.id }) },
      }, createElement(WorkbenchIcon, { name: maximized ? 'restore' : 'maximize' })),
      active === undefined ? null : createElement('button', {
        type: 'button', title: formatT('tab.closeWithName', { name: active.title }), 'aria-label': formatT('tab.closeWithName', { name: active.title }),
        onClick: () => close(active.id),
      }, createElement(WorkbenchIcon, { name: 'close' })),
    ),
  ),
  menuView === undefined ? null : createElement('div', { className: 'pwr-menu', role: 'menu', 'aria-label': `${menuView.title} actions` },
    createElement('button', { role: 'menuitem', type: 'button', onClick: () => { props.controller.dispatch({ type: 'pin_view', viewId: menuView.id }); setMenuViewId(undefined) } }, menuView.pinned ? t('tab.unpin') : t('tab.pin')),
    createElement('button', { role: 'menuitem', type: 'button', onClick: () => { close(menuView.id); setMenuViewId(undefined) } }, formatT('tab.closeWithName', { name: menuView.title })),
    createElement('button', { role: 'menuitem', type: 'button', onClick: () => {
      props.controller.dispatch({ type: 'set_region_visibility', region: props.group.region, visible: false })
      setMenuViewId(undefined)
    } }, props.group.region === 'right' ? t('chrome.hideRight') : t('chrome.hideBottom')),
    ...(['right', 'bottom'] as const).map(region => createElement('button', { key: `move-${region}`, role: 'menuitem', type: 'button', onClick: () => {
      const group = targetGroup(props.state, menuView, region)
      if (group !== undefined) props.controller.dispatch({ type: 'move_view', viewId: menuView.id, targetGroupId: group.id })
      setMenuViewId(undefined)
    } }, region === 'right' ? t('tab.moveToRight') : t('tab.moveToBottom'))),
    ...(['left', 'right', 'top', 'bottom'] as const).map((edge) => {
      const enabled = splitFits(edge, menuWidth, menuHeight)
      return createElement('button', {
        key: `split-${edge}`,
        role: 'menuitem',
        type: 'button',
        disabled: !enabled,
        'aria-disabled': !enabled,
        title: enabled ? undefined : `Pane must remain at least ${PANE_MIN_WIDTH}×${PANE_MIN_HEIGHT}px`,
        onClick: () => {
          if (!enabled) return
          props.controller.dispatch({ type: 'split_with_view', viewId: menuView.id, targetGroupId: props.group.id, edge })
          setMenuViewId(undefined)
        },
      }, formatT('tab.splitEdge', { edge }))
    }),
  ),
  active === undefined ? null : createElement('div', { id: `pane-panel-${active.id}`, className: 'pwr-panel', role: 'tabpanel', 'aria-labelledby': `pane-tab-${active.id}` }, content),
  )
}

function FontScaleControls(): ReactNode {
  const [size, setSize] = useState(getWorkbenchFontSize)
  useEffect(() => subscribeWorkbenchFontSize(setSize), [])
  return createElement('div', { className: 'pwr-rail-fonts', role: 'group', 'aria-label': 'Workbench font size' },
    createElement('button', {
      type: 'button', title: 'Decrease font size', 'aria-label': 'Decrease font size',
      disabled: size <= WORKBENCH_FONT_SIZE_MIN,
      onClick: () => setSize(stepWorkbenchFontSize(-1)),
    }, createElement(WorkbenchIcon, { name: 'font-decrease' })),
    createElement('button', {
      type: 'button', title: 'Increase font size', 'aria-label': 'Increase font size',
      disabled: size >= WORKBENCH_FONT_SIZE_MAX,
      onClick: () => setSize(stepWorkbenchFontSize(1)),
    }, createElement(WorkbenchIcon, { name: 'font-increase' })),
  )
}

export function PaneRegionChrome(props: PaneRegionChromeProps): ReactNode {
  const state = useSyncExternalStore(props.controller.subscribeWorkspace, props.controller.getSnapshot, props.controller.getSnapshot)
  const drag = useSyncExternalStore(props.controller.drag.subscribe, props.controller.drag.getSnapshot, props.controller.drag.getSnapshot)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [fontSize, setFontSize] = useState(getWorkbenchFontSize)
  const rootRef = useRef<HTMLElement>(null)
  const region = state.regions[props.region]
  const regionGroupIds = groupIds(region.root)
  const openedViews = Object.values(state.views)
  const bodyVisible = props.mode === 'dock' || props.mode === 'sheet' || props.mode === 'maximized'
  const hasViews = regionGroupIds.some(id => (state.groups[id]?.tabs.length ?? 0) > 0)

  useEffect(() => subscribeWorkbenchFontSize(setFontSize), [])
  useEffect(() => { applyWorkbenchFontSizeTo(rootRef.current, fontSize) }, [fontSize])
  useEffect(() => {
    const cancel = (): void => props.controller.drag.cancel('Drag cancelled because the window lost focus.')
    window.addEventListener('blur', cancel)
    return () => window.removeEventListener('blur', cancel)
  }, [props.controller])

  return createElement('aside', {
    ref: rootRef,
    className: 'pwr-root',
    'aria-label': `${props.region === 'right' ? 'Right' : 'Bottom'} workspace`,
    'data-region': props.region,
    'data-mode': props.mode,
    'data-font-size': fontSize,
    'data-picker-open': pickerOpen || undefined,
    'data-pane-workbench-visible': bodyVisible,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'Escape') return
      if (state.maximizedGroupId !== undefined) { event.preventDefault(); props.controller.dispatch({ type: 'restore_layout' }) }
      else if (drag.drag.status !== 'idle') { event.preventDefault(); props.controller.drag.cancel() }
      else if (pickerOpen) { event.preventDefault(); setPickerOpen(false) }
    },
  },
  createElement('style', { 'data-pane-workbench-region-styles': true }, REGION_STYLES),
  createElement('div', { className: 'pwr-status', role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, drag.announcement || props.controller.announcement),
  props.region === 'right' ? createElement('nav', { className: 'pwr-rail', 'aria-label': t('chrome.workspaceActivity') },
    bodyVisible ? null : createElement('button', { type: 'button', title: t('chrome.openView'), 'aria-label': t('chrome.openView'), onClick: () => setPickerOpen(true) }, createElement(WorkbenchIcon, { name: 'add' })),
    ...openedViews.map(view => createElement('button', {
      key: view.id, type: 'button', title: view.title, 'aria-label': `Open ${view.title}`,
      className: state.activeGroupId === view.groupId && state.groups[view.groupId]?.activeTabId === view.id ? 'pwr-active' : undefined,
      onClick: () => props.controller.dispatch({ type: 'activate_view', viewId: view.id }),
    }, createElement(WorkbenchIcon, { name: iconForView(view) }))),
    createElement(FontScaleControls),
  ) : null,
  createElement('div', { className: 'pwr-body', 'data-body-visible': bodyVisible },
    createElement('div', { className: 'pwr-tree' },
      hasViews
        ? createElement(SplitTree, { node: region.root, state, registry: props.registry, controller: props.controller, regionWidth: props.width, regionHeight: props.height, onOpenPicker: () => setPickerOpen(true), renderCoreView: props.renderCoreView })
        : createElement('section', { className: 'pwr-empty' },
          createElement('p', null, t('state.empty')),
          createElement('button', { type: 'button', onClick: () => setPickerOpen(true) }, t('chrome.openAView')),
          createElement('button', { type: 'button', onClick: () => props.controller.dispatch({ type: 'set_region_visibility', region: props.region, visible: false }) }, `Hide ${props.region === 'right' ? 'Right' : 'Bottom'} workspace`)),
    ),
  ),
  pickerOpen ? createElement(Picker, { registry: props.registry, controller: props.controller, onClose: () => setPickerOpen(false) }) : null,
  )
}
