import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type JSX } from 'react'
import type { ClientContext, ISessions, SessionFace } from '@deepseek-ai/dsh-client-runtime/client'
import { deriveToolActivity, type ActivityRunningCall, type ActivityToolResultNode } from './activity.ts'
import { ToolsInspectorContent, type ToolsTranslator } from './McpInspectorView.tsx'
import { SessionToolsWorkspace } from './workspace-state.ts'
import { Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface } from '@yeisme/dsh-client-ui-surface'
import type { ToolActivityRecord } from './activity.ts'

const EMPTY_ACTIVITY = deriveToolActivity([], [])
const idleSubscribe = () => () => {}
const emptySnapshot = () => undefined
interface ActivityFields {
  readonly nodes?: readonly { readonly kind: string }[]
  readonly runningCalls?: readonly ActivityRunningCall[]
}
interface ActivitySource {
  subscribe(listener: () => void): () => void
  getSnapshot(): ActivityFields | { readonly legacy: ActivityFields } | undefined
}

/** New hosts keep chat projections separate from session lifecycle; older hosts expose them on session. */
function activitySource(ctx: ClientContext, current: string | undefined, session: SessionFace | undefined): ActivitySource | undefined {
  if (current !== undefined && session !== undefined) {
    let ui: { binding(id: string): { target(name: string): ActivitySource } } | undefined
    try { ui = typeof ctx.get === 'function' ? ctx.get('uiConversation' as never) as unknown as typeof ui : undefined } catch { /* Optional on older hosts. */ }
    if (typeof ui?.binding === 'function') {
      const binding = ui.binding(current)
      if (typeof binding.target === 'function') return binding.target('chat')
    }
  }
  return session as unknown as ActivitySource | undefined
}

export interface ToolsPaneProps {
  readonly ctx: ClientContext
  readonly sessions: ISessions
  readonly t: ToolsTranslator
  readonly sessionId?: string | undefined
  readonly workspace: SessionToolsWorkspace
  readonly manager?: boolean
  readonly onSettings?: (() => void) | undefined
  readonly onPin?: (() => void) | undefined
  readonly onOpenSession?: (() => void) | undefined
  readonly onManage?: (() => void) | undefined
  readonly onSessionSelected?: ((id: string) => void) | undefined
  readonly onRevealCall?: ((record: ToolActivityRecord) => void) | undefined
}

/** Explicit affinity: global current is never used to bind this view. */
export function ToolsPane(props: ToolsPaneProps): JSX.Element {
  const { sessions, sessionId, t } = props
  const summary = useSyncExternalStore(sessions.list.subscribe.bind(sessions.list), sessions.list.getSnapshot.bind(sessions.list), sessions.list.getSnapshot.bind(sessions.list))
  const known = sessionId === undefined ? undefined : summary.byId?.[sessionId as never]
  if (!props.manager && (sessionId === undefined || summary.byId !== undefined && known === undefined)) {
    return <Surface kind="inspector" data-tools-session-selection="" aria-label={t('session.select')}>
      <p>{sessionId ? t('session.missing') : t('session.select')}</p>
      <label className="ys-field"><span>{t('session.select')}</span><select value="" disabled={!props.onSessionSelected} onChange={event => props.onSessionSelected?.(event.target.value)}>
        <option value="">{t('session.select')}</option>
        {summary.ids?.map(id => <option key={id} value={id}>{summary.byId[id]?.displayTitle ?? id}</option>)}
      </select></label>
    </Surface>
  }
  return <BoundToolsPane key={sessionId ?? 'global'} {...props} />
}

function BoundToolsPane(props: ToolsPaneProps): JSX.Element {
  const { ctx, sessions, sessionId, workspace, t } = props
  const [moreOpen, setMoreOpen] = useState(false)
  const moreTrigger = useRef<HTMLButtonElement>(null)
  const moreLabels = useRef(new Map<string, HTMLSpanElement>())
  const actions = [
    ...(props.manager ? [{ id: 'settings', label: t('action.settings'), run: props.onSettings, reason: t('action.settingsUnavailable') }] : []),
    ...(props.onPin ? [{ id: 'pin', label: t('action.pinSession'), run: props.onPin }] : []),
    ...(props.onOpenSession ? [{ id: 'open', label: t('action.openSession'), run: props.onOpenSession }] : []),
    ...(props.onManage ? [{ id: 'manage', label: t('action.manageGlobal'), run: props.onManage }] : []),
  ]
  const closeMore = () => { setMoreOpen(false); moreTrigger.current?.focus() }
  const menuButtons = () => actions.filter(action => action.run).flatMap(action => {
    const button = moreLabels.current.get(action.id)?.closest<HTMLButtonElement>('button[role="menuitem"]')
    return button ? [button] : []
  })
  useEffect(() => {
    if (!moreOpen) return
    const first = menuButtons()[0]
    const menu = first?.closest<HTMLElement>('[role="menu"]')
    if (!first || !menu) return
    // Portal Menu first mounts hidden to measure, then commits its placement.
    // Follow that DOM lifecycle instead of trying to focus its measurement pass.
    const focusWhenPlaced = () => {
      if (getComputedStyle(menu).visibility === 'hidden' || getComputedStyle(menu).display === 'none') return false
      first.focus()
      return document.activeElement === first
    }
    if (focusWhenPlaced()) return
    const observer = new MutationObserver(() => { if (focusWhenPlaced()) observer.disconnect() })
    observer.observe(menu, { attributes: true, attributeFilter: ['style', 'class'] })
    return () => observer.disconnect()
  }, [moreOpen])
  const onMoreKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!moreOpen) return
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.stopPropagation()
      // Tab continues from the trigger in the natural document order.
      if (event.key === 'Escape') event.preventDefault()
      closeMore()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    const buttons = menuButtons()
    if (!buttons.length) return
    const index = buttons.findIndex(button => button === document.activeElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : event.key === 'ArrowDown' ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length
    buttons[next]?.focus()
  }
  const resource = useMemo(() => workspace.get(sessionId), [workspace, sessionId])
  useEffect(() => workspace.retain(sessionId), [workspace, sessionId])
  useEffect(() => sessionId ? (sessions as unknown as { present?(id: string): () => void }).present?.(sessionId) : undefined, [sessions, sessionId])
  const session = sessionId === undefined ? undefined : sessions.binding(sessionId as never)?.session
  const source = useMemo(() => activitySource(ctx, sessionId, session), [ctx, sessionId, session])
  const snapshot = useSyncExternalStore(source?.subscribe.bind(source) ?? idleSubscribe, source?.getSnapshot.bind(source) ?? emptySnapshot, source?.getSnapshot.bind(source) ?? emptySnapshot)
  const activity = useMemo(() => {
    if (!snapshot) return EMPTY_ACTIVITY
    const fields = 'legacy' in snapshot ? snapshot.legacy : snapshot
    return deriveToolActivity((fields.nodes ?? []).filter(node => node.kind === 'tool-result') as unknown as ActivityToolResultNode[], fields.runningCalls ?? [])
  }, [snapshot])
  return <ToolsInspectorContent activity={activity} controller={resource.controller} viewState={resource.state} t={t} readOnlyCatalog={!props.manager} globalManagement={!!props.manager}
    contextLabel={props.manager ? t('view.globalTools') : t('view.tools')} onRevealCall={props.onRevealCall}
    toolbarActions={actions.length > 0 ? <div className="tools-context-actions" onKeyDown={onMoreKeyDown}>
      <Menu open={moreOpen} portal align="end" compact
        anchor={<button ref={moreTrigger} type="button" className="vk-btn" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>{t('action.more')}</button>}
        items={actions.map(action => ({ id: action.id, label: <span ref={node => { if (node) moreLabels.current.set(action.id, node); else moreLabels.current.delete(action.id) }} title={'reason' in action && !action.run ? action.reason : undefined}>{action.label}</span>, disabled: !action.run }))}
        onClose={closeMore} onSelect={id => { closeMore(); actions.find(action => action.id === id)?.run?.() }} />
    </div> : undefined} />
}
