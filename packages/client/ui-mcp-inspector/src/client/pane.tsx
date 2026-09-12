import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type JSX } from 'react'
import type { ClientContext, ISessions } from '@deepseek-ai/dsh-client-runtime/client'
import { ToolsInspectorContent, type ToolsTranslator } from './McpInspectorView.tsx'
import { SessionToolsWorkspace } from './workspace-state.ts'
import { Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface } from '@yeisme/dsh-client-ui-surface'
import { addCapabilityReference } from './draft-reference.ts'
import { SkillDocumentReader } from './SkillDocumentReader.tsx'
import { readSkillDocument } from './skill-document-remote.ts'
import type { ToolHubItemV1 } from './wire.ts'

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
  const { sessions, sessionId, workspace, t } = props
  const sessionSummary = useSyncExternalStore(sessions.list.subscribe.bind(sessions.list), sessions.list.getSnapshot.bind(sessions.list), sessions.list.getSnapshot.bind(sessions.list))
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
  const sessionResource = useMemo(() => workspace.get(sessionId), [workspace, sessionId])
  const installedResource = useMemo(() => workspace.get(), [workspace])
  const selection = useSyncExternalStore(sessionResource.state.subscribe, sessionResource.state.getSnapshot, sessionResource.state.getSnapshot)
  const catalogScope = props.manager ? 'installed' : selection.scope
  const resource = catalogScope === 'session' ? sessionResource : installedResource
  const sessionCatalog = useSyncExternalStore(sessionResource.controller.subscribe.bind(sessionResource.controller), sessionResource.controller.getSnapshot.bind(sessionResource.controller), sessionResource.controller.getSnapshot.bind(sessionResource.controller))
  useEffect(() => {
    // Both owner catalogs stay retained while this bound pane swaps scope.
    // Releasing the inactive one would dispose its controller beneath the
    // memoized resource and let a later A → installed → A render go stale.
    const releaseSession = workspace.retain(sessionId)
    const releaseInstalled = workspace.retain()
    return () => { releaseInstalled(); releaseSession() }
  }, [workspace, sessionId])
  useEffect(() => sessionId ? (sessions as unknown as { present?(id: string): () => void }).present?.(sessionId) : undefined, [sessions, sessionId])
  const boundSessionLabel = sessionId === undefined ? undefined : sessionSummary.byId?.[sessionId as never]?.displayTitle ?? sessionId
  const sessionItemFor = (item: ToolHubItemV1): ToolHubItemV1 | undefined => sessionCatalog.status === 'ready'
    ? sessionCatalog.catalog.items.find(candidate => candidate.name === item.name && candidate.family === item.family)
    : undefined
  const admissionReason = (item: ToolHubItemV1): string | undefined => {
    if (sessionId === undefined || catalogScope === 'session') return item.availability === 'available' ? undefined : item.disabledReason ?? t('draft.boundUnavailable')
    if (sessionCatalog.status !== 'ready') return t('draft.boundUnknown')
    const candidate = sessionItemFor(item)
    if (candidate === undefined) return t('draft.boundUnavailable')
    return candidate.availability === 'available' ? undefined : candidate.disabledReason ?? t('draft.boundUnavailable')
  }
  const activeCatalog = resource.controller.getSnapshot()
  const activeDetail = selection.selectedId === undefined || activeCatalog.status !== 'ready'
    ? undefined : activeCatalog.catalog.items.find((item: ToolHubItemV1) => item.id === selection.selectedId)
  const draftDisabledReason = activeDetail === undefined ? undefined : admissionReason(activeDetail)
  return <ToolsInspectorContent controller={resource.controller} viewState={sessionResource.state} t={t} readOnlyCatalog={!props.manager} globalManagement={!!props.manager}
    contextLabel={props.manager ? t('view.globalTools') : t('view.tools')}
    renderReference={(item, generation) => item.family === 'skill' ? <SkillDocumentReader
      key={JSON.stringify([item.id, item.source, generation, catalogScope])} item={item} installed={catalogScope === 'installed'} t={t}
      read={(input, signal) => readSkillDocument(props.ctx, input, signal)} /> : null}
    scope={catalogScope}
    preferChinesePurpose={t('search.placeholder').startsWith('搜索')}
    {...(boundSessionLabel === undefined ? {} : { boundSessionLabel })}
    {...(sessionId === undefined ? {} : { boundSessionId: sessionId })}
    {...(sessionId === undefined ? {} : { onAddToDraft: item => addCapabilityReference(props.ctx, sessionId, sessionItemFor(item) ?? item) })}
    {...(draftDisabledReason === undefined ? {} : { draftDisabledReason })}
    {...(!props.manager ? { onScopeChange: (scope: 'session' | 'installed') => sessionResource.state.set('scope', scope) } : {})}
    {...(props.onOpenSession === undefined ? {} : { onOpenSession: props.onOpenSession })}
    toolbarActions={actions.length > 0 ? <div className="tools-context-actions" onKeyDown={onMoreKeyDown}>
      <Menu open={moreOpen} portal align="end" compact
        anchor={<button ref={moreTrigger} type="button" className="vk-btn" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>{t('action.more')}</button>}
        items={actions.map(action => ({ id: action.id, label: <span ref={node => { if (node) moreLabels.current.set(action.id, node); else moreLabels.current.delete(action.id) }} title={'reason' in action && !action.run ? action.reason : undefined}>{action.label}</span>, disabled: !action.run }))}
        onClose={closeMore} onSelect={id => { closeMore(); actions.find(action => action.id === id)?.run?.() }} />
    </div> : undefined} />
}
