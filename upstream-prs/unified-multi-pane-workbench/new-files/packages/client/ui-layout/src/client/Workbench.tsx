import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { PropsLocale, PropsRenderSlots, PropsRuntime, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceSnapshot as ProjectSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { clampBox, dockGroup, groupForPane, layoutAxis, layoutBoxes, movePane, openPane, type Box, type LayoutNode, type PaneReference, type WorkspaceSnapshot } from './workspace-model.ts'
import { hitTestLayout, resizeSplit, type WorkspaceLayoutFace, type WorkspacePresentation } from './workspace-service.ts'
import css from './Workbench.module.css'

export type WorkbenchInjected = {
  useWorkspace: SnapshotSelectorHook<WorkspacePresentation>
  useWorkbenchProjects: SnapshotSelectorHook<ProjectSnapshot>
  workspaceActions: Pick<WorkspaceLayoutFace, 'openPane' | 'movePane' | 'dropPane' | 'dockGroup' | 'closePane' | 'focusPane' | 'updatePane' | 'pinPane' | 'switchWorkspace' | 'savePreset' | 'restorePreset' | 'reset' | 'maximize' | 'commitGeometry' | 'showCatalog' | 'importLegacyLayout' | 'executeCommand'>
  presentSession: (id: string) => () => void
  selectSession: (id: string) => void
  toggleNavigation: () => void
}
type Props = PropsRuntime<'root'> & PropsRenderSlots<'conversation' | 'workspace.pane' | 'details'> & PropsLocale<'common'> & WorkbenchInjected
type Gesture = {
  pointerId: number; originX: number; originY: number; base: WorkspaceSnapshot
  type: 'pane' | 'group' | 'resize' | 'split'; id: string; edge?: string | undefined
  reference?: PaneReference; active: boolean; target?: ReturnType<typeof hitTestLayout> | undefined
  preview?: WorkspaceSnapshot | undefined
  tabs?: Array<{ id: string; x: number; y: number; width: number; height: number }>
}
const iconPaths: Record<string, string> = {
  conversation: 'M3 3h18v13H9l-6 5z', file: 'M5 2h9l5 5v15H5z M14 2v6h5',
  git: 'M6 3v12a5 5 0 0 0 10 0V8 M3 3h6 M13 5h6v6h-6z',
  terminal: 'M3 5h18v14H3z M6 9l3 3-3 3 M12 15h5',
  agent: 'M5 7h14v13H5z M12 3v4 M8 11h1 M15 11h1 M9 16h6',
  folder: 'M2 6h8l2 3h10v12H2z', media: 'M3 3h18v18H3z M4 17l5-6 4 4 3-3 5 5',
  home: 'M3 11l9-8 9 8 M5 10v11h5v-7h4v7h5V10',
  plus: 'M12 4v16 M4 12h16', close: 'M6 6l12 12 M18 6L6 18',
  maximize: 'M9 3H3v6 M15 3h6v6 M3 15v6h6 M21 15v6h-6',
  pin: 'M8 3h8l-1 6 4 4H5l4-4z M12 13v8',
  layout: 'M3 3h18v18H3z M10 3v18 M10 11h11',
}
function Glyph({ kind }: { kind: string }) {
  const semantic = kind in iconPaths ? kind : /git/i.test(kind) ? 'git' : /terminal/i.test(kind) ? 'terminal'
    : /session|chat|conversation/i.test(kind) ? 'conversation' : /agent|ordo/i.test(kind) ? 'agent'
    : /explorer|folder|files$/i.test(kind) ? 'folder' : /file|editor|text/i.test(kind) ? 'file'
    : /home/i.test(kind) ? 'home' : /media|creator/i.test(kind) ? 'media' : 'layout'
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[semantic]} /></svg>
}
function SessionLease({ id, present, children }: { id: string; present: Props['presentSession']; children: React.ReactNode }) {
  useEffect(() => present(id), [id, present])
  return children
}
function captureTabs(): NonNullable<Gesture['tabs']> {
  return [...document.querySelectorAll<HTMLElement>('[data-workspace-tab]')].map(element => {
    const b = element.getBoundingClientRect()
    return { id: element.dataset.workspaceTab!, x: b.x, y: b.y, width: b.width, height: b.height }
  })
}
function splitNodes(root: LayoutNode | null): Array<Extract<LayoutNode, { type: 'split' }>> {
  if (root === null || root.type === 'group') return []
  return [root, ...splitNodes(root.first), ...splitNodes(root.second)]
}

/** Stable sibling Pane mounts: geometry changes never reparent conversation or editor DOM. */
export function Workbench(props: Props) {
  const { useWorkspace, workspaceActions: actions, useSessions, useWorkbenchProjects, renderSlot, SessionProvider, presentSession, selectSession, t } = props
  const presentation = useWorkspace(s => s)
  const live = presentation.layout
  const sessions = useSessions(s => s)
  const projects = useWorkbenchProjects(s => s)
  const root = useRef<HTMLDivElement>(null)
  const pickerDialog = useRef<HTMLDialogElement>(null)
  const [viewport, setViewport] = useState<Box>({ x: 0, y: 0, width: 1000, height: 700 })
  const [gestureView, setGestureView] = useState<Gesture | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const picker = presentation.catalogOpen
  const setPicker = actions.showCatalog
  const [query, setQuery] = useState('')
  const [layouts, setLayouts] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [paneMenu, setPaneMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const currentRef = useRef<string | undefined>()
  const initialized = useRef(false)
  const state = gestureView?.preview ?? live
  const boxes = layoutBoxes(state, viewport)
  const ref = useRef({ live, viewport, sessions, projects, actions, picker })
  ref.current = { live, viewport, sessions, projects, actions, picker }
  useEffect(() => {
    const dialog = pickerDialog.current
    if (!picker || !dialog) return
    const previous = document.activeElement
    dialog.showModal()
    return () => {
      dialog.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [picker])

  function conversation(id: string): PaneReference {
    const context = ref.current
    const session = context.sessions.byId[id as SessionId]
    const project = context.projects.items.find(p => p.sessionIds.includes(id as SessionId))
    return { id: `conversation:${id}`, kind: 'conversation', sessionId: id,
      workspaceId: project?.workspaceId, workspaceTitle: project?.title,
      title: session?.blank ? t('wb.new') : session?.displayTitle || session?.title || t('wb.new'), icon: 'conversation', pinned: false }
  }
  useEffect(() => {
    if (sessions.phase !== 'ready' || projects.phase !== 'ready') return
    if (!initialized.current) {
      const project = projects.items.find(p => p.sessionIds.includes(sessions.current!))
      if (!project && live.workspaceId === 'unassigned') return
      initialized.current = true
      if (live.workspaceId !== 'unassigned') {
        currentRef.current = sessions.current
        return
      }
      if (project) actions.switchWorkspace(project.workspaceId)
    }
    if (sessions.current !== undefined && sessions.current !== currentRef.current) {
      currentRef.current = sessions.current
      actions.openPane(conversation(sessions.current))
    }
  }, [sessions.current, sessions.phase, projects.phase, actions])
  useEffect(() => {
    for (const pane of Object.values(live.panes)) {
      if (pane.kind !== 'conversation' || !pane.sessionId) continue
      const summary = sessions.byId[pane.sessionId as SessionId]
      if (summary) actions.updatePane(pane.id, { title: summary.blank ? t('wb.new') : summary.displayTitle })
    }
  }, [sessions.byId, live.panes, actions, t])
  useEffect(() => {
    const element = root.current
    if (!element) return
    const measure = () => setViewport({ x: 0, y: 0, width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  function begin(event: ReactPointerEvent<HTMLElement>, type: Gesture['type'], id: string, edge?: string): void {
    if (event.button !== 0 || event.target instanceof Element && event.target.closest('button,input,select') && type === 'group') return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = { pointerId: event.pointerId, originX: event.clientX, originY: event.clientY, base: live, type, id, edge, active: false, tabs: captureTabs() }
  }
  useEffect(() => {
    let cancelledPointer: number | undefined
    let frame = 0
    const schedulePreview = (g: Gesture) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => { frame = 0; setGestureView({ ...g }) })
    }
    const suppressNextClick = () => {
      const suppress = (click: MouseEvent) => { click.preventDefault(); click.stopImmediatePropagation() }
      window.addEventListener('click', suppress, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', suppress, true), 0)
    }
    const cancel = () => {
      cancelAnimationFrame(frame); frame = 0
      if (gesture.current?.active) cancelledPointer = gesture.current.pointerId
      gesture.current = null; setGestureView(null)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { cancel(); setPicker(false); setLayouts(false); setPaneMenu(null) }
    }
    const sidebarStart = (event: PointerEvent) => {
      cancelledPointer = undefined
      if (event.button !== 0 || !(event.target instanceof Element) || event.target.closest('button')) return
      if (event.pointerType === 'touch' && !event.target.closest('[data-session-drag-handle]')) return
      const row = event.target.closest<HTMLElement>('[data-workspace-session-id]')
      const id = row?.dataset.workspaceSessionId
      if (!row || !id) return
      event.preventDefault()
      const context = ref.current
      row.setPointerCapture(event.pointerId)
      gesture.current = { pointerId: event.pointerId, originX: event.clientX, originY: event.clientY,
        base: context.live, type: 'pane', tabs: captureTabs(), id: `conversation:${id}`, reference: { ...conversation(id), pinned: true }, active: false }
    }
    const move = (event: PointerEvent) => {
      const g = gesture.current
      if (!g || g.pointerId !== event.pointerId || !root.current) return
      if (ref.current.live !== g.base) { cancel(); return }
      const dx = event.clientX - g.originX, dy = event.clientY - g.originY
      if (!g.active && Math.hypot(dx, dy) < 6) return
      event.preventDefault()
      if (!g.active) root.current.setPointerCapture(event.pointerId)
      g.active = true
      const rect = root.current.getBoundingClientRect()
      const view = ref.current.viewport
      const scaleX = rect.width > 0 ? view.width / rect.width : 1
      const scaleY = rect.height > 0 ? view.height / rect.height : 1
      const x = (event.clientX - rect.left) * scaleX, y = (event.clientY - rect.top) * scaleY
      if (g.type === 'pane') {
        g.target = hitTestLayout(g.base, view, x, y, g.id, { float: event.altKey, previous: g.target?.destination })
        // Cache original tab rectangles before preview reflow. The moving preview
        // must never change the target under a stationary pointer.
        if (g.target.destination?.type === 'tab') {
          const targetGroup = g.base.groups[g.target.destination.groupId]!
          const tab = g.tabs?.find(b => targetGroup.panes.includes(b.id) && event.clientX >= b.x && event.clientX <= b.x + b.width && event.clientY >= b.y && event.clientY <= b.y + b.height)
          if (tab) {
            const index = targetGroup.panes.indexOf(tab.id) + (event.clientX > tab.x + tab.width / 2 ? 1 : 0)
            const old = targetGroup.panes.indexOf(g.id)
            g.target.destination.index = index - (old >= 0 && old < index ? 1 : 0)
          }
        }
        g.preview = undefined
        if (g.target.destination) {
          const base = g.reference && !g.base.panes[g.id] ? openPane(g.base, g.reference) : g.base
          const next = movePane(base, g.id, g.target.destination)
          g.preview = next
          const targetGroup = groupForPane(next, g.id)
          if (targetGroup) g.target.preview = layoutBoxes(next, view)[targetGroup.id]!
        }
      } else if (g.type === 'split') {
        const node = splitNodes(g.base.root).find(n => n.id === g.id)
        if (node) g.preview = resizeSplit(g.base, g.id, layoutAxis(node, g.base, layoutBoxes(g.base, view)[node.id]!) === 'horizontal' ? x : y, view)
      } else {
        const next = structuredClone(g.base)
        const f = next.floating.find(item => item.groupId === g.id)
        if (!f) return
        if (g.type === 'group') {
          f.x += dx * scaleX; f.y += dy * scaleY
          const hitState = { ...g.base, floating: g.base.floating.filter(item => item.groupId !== g.id),
            groups: Object.fromEntries(Object.entries(g.base.groups).filter(([id]) => id !== g.id)) }
          const target = hitTestLayout(hitState, view, x, y, undefined, { float: event.altKey, bodyMerge: false, previous: g.target?.destination })
          g.target = target.destination?.type !== 'float' ? target : undefined
        }
        else {
          if (g.edge?.includes('e')) f.width += dx * scaleX
          if (g.edge?.includes('s')) f.height += dy * scaleY
          if (g.edge?.includes('w')) { f.x += dx * scaleX; f.width -= dx * scaleX }
          if (g.edge?.includes('n')) { f.y += dy * scaleY; f.height -= dy * scaleY }
        }
        Object.assign(f, clampBox(f, view))
        g.preview = next
        if (g.type === 'group' && g.target?.destination) {
          g.preview = dockGroup(g.base, g.id, g.target.destination)
          const targetGroup = groupForPane(g.preview, g.base.groups[g.id]!.panes[0]!)
          if (targetGroup) g.target.preview = layoutBoxes(g.preview, view)[targetGroup.id]!
        }
      }
      schedulePreview(g)
    }
    const up = (event: PointerEvent) => {
      cancelAnimationFrame(frame); frame = 0
      const g = gesture.current
      if (!g || g.pointerId !== event.pointerId) {
        if (cancelledPointer === event.pointerId) { suppressNextClick(); cancelledPointer = undefined }
        return
      }
      if (g.active && ref.current.live === g.base) {
        if (g.type === 'pane' && g.target?.destination) {
          ref.current.actions.dropPane(g.id, g.target.destination, g.reference)
        } else if (g.type === 'pane' && g.reference?.sessionId && g.target?.reason === 'outside') {
          const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-workspace-session-id]')
          const source = document.querySelector<HTMLElement>(`[data-workspace-session-id="${CSS.escape(g.reference.sessionId)}"]`)
          if (target && source) {
            const b = target.getBoundingClientRect()
            source.dispatchEvent(new CustomEvent('dsh:sidebar-session-drop', { detail: { targetId: target.dataset.workspaceSessionId, half: event.clientY < b.y + b.height / 2 ? 'before' : 'after' } }))
          }
        } else if (g.type === 'group' && g.target?.destination) ref.current.actions.dockGroup(g.id, g.target.destination)
        else if (g.preview) ref.current.actions.commitGeometry(g.preview)
        // Suppress only the click produced by this completed drag.
        suppressNextClick()
      }
      gesture.current = null; setGestureView(null)
    }
    const lostCapture = (event: PointerEvent) => {
      if (!root.current?.hasPointerCapture(event.pointerId)) cancel()
    }
    window.addEventListener('pointerdown', sidebarStart, true)
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('lostpointercapture', lostCapture)
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', key)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointerdown', sidebarStart, true)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('lostpointercapture', lostCapture)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('keydown', key)
    }
  }, [])

  const activate = (pane: PaneReference) => {
    actions.focusPane(pane.id)
    if (pane.sessionId && sessions.byId[pane.sessionId as SessionId]) selectSession(pane.sessionId)
  }
  const styleBox = (b: Box) => ({ left: b.x, top: b.y, width: b.width, height: b.height })
  return <div className={css.root} ref={root} data-unified-workspace={live.workspaceId} data-gesture={gestureView?.active ? gestureView.type : undefined} data-drop-kind={gestureView?.target?.destination?.type}>
    <div className={css.globalActions}>
      <button title={t('wb.add')} aria-label={t('wb.add')} onClick={() => setPicker(true)}><Glyph kind="plus" /></button>
      <button title={t('wb.layout')} aria-label={t('wb.layout')} onClick={() => setLayouts(v => !v)}><Glyph kind="layout" /></button>
    </div>
    {Object.values(state.groups).map(group => {
      const b = boxes[group.id]
      if (!b) return null
      const floating = state.floating.some(f => f.groupId === group.id)
      const hidden = state.maximized !== null && state.maximized !== group.id
      return <section key={group.id} className={css.group} style={{ ...styleBox(b), display: hidden ? 'none' : undefined, zIndex: floating ? 10 + state.floating.findIndex(f => f.groupId === group.id) * 3 : 1 }} data-workspace-group={group.id} data-floating={floating || undefined} data-focused={state.focused === group.id || undefined}>
        <div className={css.header} style={{ paddingRight: b.y < 1 && b.x + b.width >= viewport.width - 1 ? 66 : 4 }} onPointerDown={e => { if (floating) begin(e, 'group', group.id) }} title={floating ? t('wb.move') : undefined}>
          <div role="tablist" aria-label={t('wb.tabs')} className={css.tabs}>
            {group.panes.map((id, index) => {
              const pane = state.panes[id]!
              return <div className={css.tab} key={id} data-selected={group.active === id || undefined} data-preview={!pane.pinned || undefined}>
                <button role="tab" aria-selected={group.active === id} aria-controls={`pane-${id}`} tabIndex={group.active === id ? 0 : -1} data-workspace-tab={id}
                  onPointerDown={e => begin(e, 'pane', id)} onClick={() => activate(pane)} onDoubleClick={() => actions.pinPane(id)}
                  onContextMenu={e => { e.preventDefault(); const bounds = root.current!.getBoundingClientRect(); setPaneMenu({ id, x: Math.min(e.clientX - bounds.left, viewport.width - 210), y: Math.min(e.clientY - bounds.top, viewport.height - 310) }) }}
                  onKeyDown={e => {
                    if (e.key === 'F10' && e.shiftKey) { e.preventDefault(); setPaneMenu({ id, x: b.x + 12, y: b.y + 36 }) }
                    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') {
                      e.preventDefault()
                      const at = e.key === 'Home' ? 0 : e.key === 'End' ? group.panes.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + group.panes.length) % group.panes.length
                      const target = group.panes[at]!
                      if (e.altKey) actions.movePane(id, { type: 'tab', groupId: group.id, index: at })
                      else { activate(state.panes[target]!); document.querySelector<HTMLElement>(`[data-workspace-tab="${CSS.escape(target)}"]`)?.focus() }
                    }
                    if (e.key === 'Delete') { e.preventDefault(); void actions.closePane(id) }
                    if (e.key === 'Enter') actions.pinPane(id)
                  }} title={[pane.title, pane.workspaceTitle].filter(Boolean).join(' · ')}>
                  <Glyph kind={pane.icon ?? pane.kind} /><span>{pane.title}</span>{pane.workspaceId && pane.workspaceId !== live.workspaceId && <small>{pane.workspaceTitle ?? pane.workspaceId}</small>}
                </button>
                {!pane.pinned && <button aria-label={t('wb.pin')} onClick={() => actions.pinPane(id)}><Glyph kind="pin" /></button>}
                <button aria-label={`${t('close')} ${pane.title}`} onClick={() => { void actions.closePane(id) }}><Glyph kind="close" /></button>
              </div>
            })}
          </div>
          <button className={css.maximize} aria-label={t('wb.maximize')} onClick={() => actions.maximize(group.id)}><Glyph kind="maximize" /></button>
        </div>

      </section>
    })}
    {/* All content roots remain siblings with stable keys across groups and floats. */}
    {Object.values(live.panes).map(pane => {
      const group = groupForPane(state, pane.id)!
      const b = boxes[group.id]
      if (!b) return null
      const floatingIndex = state.floating.findIndex(f => f.groupId === group.id)
      const visible = group.active === pane.id && (state.maximized === null || state.maximized === group.id)
      const registration = presentation.catalog.find(v => v.kind === pane.kind)
      const missing = <div className={css.empty} role="status">{t('wb.missing')}</div>
      return <div key={pane.id} id={`pane-${pane.id}`} role="tabpanel" className={css.content}
        style={{ left: b.x + 1, top: b.y + 37, width: Math.max(0, b.width - 2), height: Math.max(0, b.height - 38), display: visible ? undefined : 'none', zIndex: floatingIndex < 0 ? 2 : 11 + floatingIndex * 3 }}
        data-workspace-pane={pane.id} data-session-ref={pane.sessionId} data-project-ref={pane.workspaceId} onPointerDownCapture={event => {
          if (event.button !== 0) return
          if (live.focused !== group.id) actions.focusPane(pane.id)
          if (pane.kind === 'conversation' && pane.sessionId && pane.sessionId !== sessions.current
            && sessions.byId[pane.sessionId as SessionId]) selectSession(pane.sessionId)
        }}>
        {pane.kind === 'conversation' && pane.sessionId
          ? <SessionLease id={pane.sessionId} present={presentSession}><SessionProvider sessionId={pane.sessionId} empty={() => missing}>{renderSlot('conversation', {})}</SessionProvider></SessionLease>
          : registration ? renderSlot('workspace.pane', { pane }, { entryKey: registration.rendererKey }) : missing}
      </div>
    })}
    {state.maximized === null && state.floating.map((float, index) => <div key={`handles:${float.groupId}`} data-workspace-handles={float.groupId} className={css.handles} style={{ ...styleBox(boxes[float.groupId]!), zIndex: 12 + index * 3 }}>
        {['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(edge => <div key={edge} role="separator" tabIndex={0} aria-label={t('wb.resize')} className={css.resize} data-edge={edge} onPointerDown={e => begin(e, 'resize', float.groupId, edge)}
          onKeyDown={e => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
            e.preventDefault()
            const next = structuredClone(live), f = next.floating.find(item => item.groupId === float.groupId)!
            if (e.key === 'ArrowLeft') f.width -= 20
            if (e.key === 'ArrowRight') f.width += 20
            if (e.key === 'ArrowUp') f.height -= 20
            if (e.key === 'ArrowDown') f.height += 20
            Object.assign(f, clampBox(f, viewport)); actions.commitGeometry(next)
          }} />)}
    </div>)}
    {state.maximized === null && splitNodes(state.root).map(node => {
      const b = boxes[node.id]!, first = boxes[node.first.id]!
      const horizontal = layoutAxis(node, state, b) === 'horizontal'
      return <div key={node.id} role="separator" tabIndex={0} aria-label={t('wb.resize')} aria-orientation={horizontal ? 'vertical' : 'horizontal'} aria-valuenow={Math.round(node.ratio * 100)}
        data-workspace-split={node.id} className={css.separator}
        style={horizontal ? { left: first.x + first.width, top: b.y, width: 4, height: b.height, cursor: 'col-resize' } : { left: b.x, top: first.y + first.height, width: b.width, height: 4, cursor: 'row-resize' }}
        onDoubleClick={() => actions.commitGeometry(resizeSplit(live, node.id, horizontal ? b.x + b.width / 2 : b.y + b.height / 2, viewport))}
        onPointerDown={e => begin(e, 'split', node.id)} onKeyDown={e => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
          e.preventDefault()
          const delta = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -20 : 20
          actions.commitGeometry(resizeSplit(live, node.id, (horizontal ? first.x + first.width : first.y + first.height) + delta, viewport))
        }} />
    })}
    {Object.keys(state.panes).length === 0 && <div className={css.empty}>
      <p>{t('wb.empty')}</p><div><button onClick={props.toggleNavigation}>{t('wb.open')}</button><button onClick={() => setPicker(true)}>{t('wb.add')}</button><button onClick={() => { actions.reset(); if (sessions.current) actions.openPane(conversation(sessions.current)) }}>{t('wb.reset')}</button></div>
      {sessions.current === undefined && renderSlot('conversation', {})}
    </div>}
    {presentation.error && <div role="status" className={css.notice}>{t(presentation.error === 'storage' ? 'wb.storage' : presentation.error === 'protected' ? 'wb.protected' : presentation.error === 'command' ? 'wb.commandError' : 'wb.invalid')}</div>}
    {gestureView?.active && gestureView.target && <div className={css.drop} style={gestureView.target.preview ? styleBox(gestureView.target.preview) : { inset: 12 }} data-drop-valid={!!gestureView.target.destination} data-drop-edge={gestureView.target.destination?.type === 'split' ? gestureView.target.destination.edge : undefined}>
      <span>{gestureView.target.reason ? t(`wb.${gestureView.target.reason}`)
        : gestureView.target.destination?.type === 'split' ? t(`wb.${gestureView.target.destination.edge}`)
        : gestureView.target.destination?.type === 'float' ? t('wb.floatHint') : t('wb.dock')}</span>

    </div>}
    {picker && <dialog ref={pickerDialog} aria-label={t('wb.add')} className={css.scrim} onCancel={() => setPicker(false)} onClick={() => setPicker(false)} onKeyDown={e => {
      if (e.key !== 'Tab') return
      const focusable = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled])')]
      const first = focusable[0], last = focusable.at(-1)
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }}><div className={css.picker} onClick={e => e.stopPropagation()}>
      <input value={query} onChange={e => setQuery(e.target.value)} aria-label={t('wb.search')} placeholder={t('wb.search')} />
      <div className={css.results}>
        {presentation.commands.filter(c => `${c.title} ${c.id}`.toLowerCase().includes(query.toLowerCase())).map(c => <button key={`command:${c.id}`} data-workspace-command={c.id} onClick={() => { void actions.executeCommand(c.id); setPicker(false) }}><Glyph kind="terminal" />{c.title}</button>)}
        {presentation.catalog.filter(v => `${v.title} ${v.kind}`.toLowerCase().includes(query.toLowerCase())).map(v => <button key={v.kind} onClick={() => { actions.openPane({ id: `tool:${v.kind}`, kind: v.kind, title: v.title, icon: v.icon, pinned: true }); setPicker(false) }}><Glyph kind={v.icon ?? v.kind} />{v.title}</button>)}
        {sessions.ids.filter(id => `${sessions.byId[id]?.displayTitle ?? ''} ${id}`.toLowerCase().includes(query.toLowerCase())).slice(0, 30).map(id => <button key={id} data-workspace-catalog-session={id} onClick={() => { actions.openPane(conversation(id)); setPicker(false) }}><Glyph kind="conversation" />{sessions.byId[id]?.displayTitle}</button>)}
      </div>
      <button onClick={() => setPicker(false)}>{t('close')}</button>
    </div></dialog>}
    {layouts && <div className={css.layoutMenu}>
      <select aria-label={t('wb.project')} value={live.workspaceId} onChange={e => { actions.switchWorkspace(e.target.value); setLayouts(false) }}>
        {!projects.items.some(p => p.workspaceId === live.workspaceId) && <option value={live.workspaceId}>{t('wb.project')}</option>}
        {projects.items.map(p => <option key={p.workspaceId} value={p.workspaceId}>{p.title}</option>)}
      </select>
      <input aria-label={t('wb.preset')} placeholder={t('wb.preset')} value={presetName} onChange={e => setPresetName(e.target.value)} />
      <button disabled={!presetName.trim()} onClick={() => { actions.savePreset(presetName); setPresetName('') }}>{t('wb.save')}</button>
      {presentation.presets.map(name => <button key={name} onClick={() => { actions.restorePreset(name); setLayouts(false) }}>{name}</button>)}
      {presentation.legacyLayouts.map(item => <button key={item.id} title={t('wb.legacyDescription')} onClick={() => { actions.importLegacyLayout(item.id); setLayouts(false) }}>{t('wb.legacy')} · {item.title}</button>)}
      <button onClick={() => { actions.reset(); if (sessions.current) actions.openPane(conversation(sessions.current)); setLayouts(false) }}>{t('wb.reset')}</button>
    </div>}
    {paneMenu && live.panes[paneMenu.id] && <div role="menu" className={css.layoutMenu} style={{ left: Math.max(0, paneMenu.x), top: Math.max(0, paneMenu.y), right: 'auto', width: 190 }}>
      <button role="menuitem" onClick={() => { actions.pinPane(paneMenu.id); setPaneMenu(null) }}>{t('wb.pin')}</button>
      <button role="menuitem" onClick={() => { actions.dropPane(paneMenu.id, { type: 'float', box: clampBox({ x: 60, y: 70, width: 520, height: 440 }, viewport) }); setPaneMenu(null) }}>{t('wb.float')}</button>
      {(['left', 'right', 'top', 'bottom'] as const).map(edge => {
        const group = groupForPane(live, paneMenu.id)!, box = boxes[group.id]!
        const horizontal = edge === 'left' || edge === 'right'
        const reason = live.floating.some(f => f.groupId === group.id) ? 'wb.floating-split'
          : group.panes.length < 2 ? 'wb.same' : (horizontal ? box.width < 564 : box.height < 364) ? 'wb.space' : undefined
        return <button role="menuitem" key={edge} disabled={reason !== undefined} title={reason ? t(reason) : undefined} onClick={() => {
          actions.movePane(paneMenu.id, { type: 'split', groupId: group.id, edge }); setPaneMenu(null)
        }}>{t(`wb.${edge}`)}</button>
      })}
      {Object.values(live.groups).filter(g => !g.panes.includes(paneMenu.id)).map(g => <button role="menuitem" key={g.id} onClick={() => { actions.movePane(paneMenu.id, { type: 'tab', groupId: g.id }); setPaneMenu(null) }}>{t('wb.move')} · {live.panes[g.active!]?.title}</button>)}
      <button role="menuitem" onClick={() => { void actions.closePane(paneMenu.id); setPaneMenu(null) }}>{t('close')}</button>
    </div>}
  </div>
}
