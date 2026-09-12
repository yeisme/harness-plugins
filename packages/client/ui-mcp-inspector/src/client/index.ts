/**
 * DSH Web Tools inspector client plugin.
 *
 * Registers one "Tools" pane in Pane Workbench. Session MCP
 * activity is derived from ConversationSnapshot; the skills/MCP catalog and
 * enablement overlay come from the host `toolHub` Remote when mounted.
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector/client
 */

import type { ClientContext, ISessions } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { createElement } from 'react'
import type { ToolsTranslator } from './McpInspectorView.tsx'
import { en, NS, zh } from './locales.ts'
import { SessionToolsWorkspace } from './workspace-state.ts'
import { ToolsPane } from './pane.tsx'
import { createInstalledToolsSearchSource } from './installed-search-source.ts'
import { createSessionToolsSearchSource } from './session-search-source.ts'
import { sessionCatalogRemote } from './session-catalog.ts'
import { reconnectingToolHubRemote } from './remote.ts'

export { McpInspectorView, renderToolsInspectorTree } from './McpInspectorView.tsx'
export type { ToolsInspectorTreeProps, ToolsInspectorViewProps, ToolsNotice, ToolsSection, ToolsTranslator } from './McpInspectorView.tsx'
export { filterCatalog, itemMatchesFilter, countByAvailability, countByFamily } from './filter.ts'
export { ToolsHubBinding } from './binding.ts'
export { addCapabilityReference } from './draft-reference.ts'
export type { DraftReferenceResult } from './draft-reference.ts'
export { ToolsHubController, createToolsHubController } from './controller.ts'
export { toolHubRemoteContribution } from './remote-contribution.ts'
export { resolveToolHubRemote } from './remote.ts'
export { normalizeToolHubClientError, ToolHubClientError } from './remote.ts'
export type { ToolHubClientErrorCode } from './remote.ts'
export type {
  ToolHubAvailability,
  ToolHubCatalogAnswerV1,
  ToolHubCatalogV1,
  ToolHubFamily,
  ToolHubHealthStateV1,
  ToolHubHealthV1,
  ToolHubItemId,
  ToolHubItemV1,
  ToolHubOrigin,
  ToolHubReasonCodeV1,
  ToolHubSetEnabledAnswerV1,
  ToolHubSetEnabledInputV1,
} from './wire.ts'
export { en, NS, zh } from './locales.ts'
export type { McpInspectorKey } from './locales.ts'

export const name = 'client-ui-mcp-inspector'
export const inject = ['locale', 'sessions', 'slots'] as const

interface PaneFace {
  registerSearchSource?(source: ReturnType<typeof createInstalledToolsSearchSource>['source'] | ReturnType<typeof createSessionToolsSearchSource>['source']): () => void
  registerView(input: { descriptor: Record<string, unknown>; i18n: { namespace: string; labelKey: string }; component: (props: { view: { id: string; metadata?: Record<string, unknown>; resourceKey: string } }) => unknown }): () => void
  openView(input: unknown): unknown
  controller?: {
    getSnapshot(): { views: Record<string, { id: string; kind: string; resourceKey: string; groupId: string; metadata?: Record<string, unknown> }>; activeGroupId?: string; groups?: Record<string, { activeTabId?: string }> }
    dispatch(intent: Record<string, unknown>): unknown
  }
}
interface Navigation { open(sessionId: string, view: string, focus?: string): boolean }
export interface SessionToolsFace {
  openSessionTools(input: { sessionId?: string; presentation: 'tab' | 'pane' }): boolean
  openGlobalTools(): void
  rebindPane(paneId: string, sessionId: string): boolean
}
function asPane(value: unknown): PaneFace | undefined {
  const pane = value as Partial<PaneFace> | undefined
  return typeof pane?.registerView === 'function' && typeof pane.openView === 'function' ? pane as PaneFace : undefined
}

/** Session tabs and explicitly bound companion panes share one presentation controller. */
export function apply(ctx: ClientContext): () => void {
  const disposeLocale = ctx.locale.register(NS, { zh, en })
  const t = ctx.locale.bind(NS) as unknown as ToolsTranslator
  const sessions = ctx.get('sessions') as ISessions
  const workspace = new SessionToolsWorkspace(ctx)
  const get = (key: string): unknown => { try { return ctx.get(key as never) } catch { return undefined } }
  const navigation = () => get('conversationNavigation') as Navigation | undefined
  let pane: PaneFace | undefined
  let disposePane = () => {}
  const catalogRemote = reconnectingToolHubRemote(ctx)
  const installedSearch = createInstalledToolsSearchSource({ read: () => catalogRemote.list(), open: async item => {
    const currentPane = pane
    if (!currentPane?.controller) return false
    const resource = workspace.get()
    await resource.controller.refresh()
    if (pane !== currentPane) return false
    const current = resource.controller.getSnapshot()
    if (current.status !== 'ready' || current.catalog.items.filter(candidate => candidate.id === item.id).length !== 1
      || !current.catalog.items.some(candidate => candidate.id === item.id && candidate.source === item.source)) return false
    resource.state.set('activeSection', 'catalog')
    resource.state.set('query', '')
    resource.state.set('family', 'all')
    resource.state.set('enabled', 'all')
    resource.state.set('selectedId', item.id)
    resource.state.set('activeSection', 'details')
    openGlobalTools()
    const snapshot = currentPane.controller.getSnapshot()
    const view = Object.values(snapshot.views).find(view => view.kind === 'tools-manager' && view.resourceKey === 'tools-manager')
    return view !== undefined && snapshot.activeGroupId === view.groupId && snapshot.groups?.[view.groupId]?.activeTabId === view.id
  } })
  const knownSessionIds = () => sessions.list?.getSnapshot().ids ?? []
  const sessionSearch = createSessionToolsSearchSource({
    listSessionIds: knownSessionIds,
    read: sessionId => sessionCatalogRemote(ctx, sessionId, { requireResolvedScope: true }).list(),
    open: async (sessionId, item) => {
      const currentPane = pane
      if (!currentPane?.controller || !knownSessionIds().includes(sessionId as never)) return false
      const resource = workspace.get(sessionId)
      await resource.controller.refresh()
      if (pane !== currentPane || !knownSessionIds().includes(sessionId as never)) return false
      const current = resource.controller.getSnapshot()
      if (current.status !== 'ready' || current.catalog.items.filter(candidate => candidate.id === item.id).length !== 1
        || !current.catalog.items.some(candidate => candidate.id === item.id && candidate.source === item.source)) return false
      resource.state.set('scope', 'session')
      resource.state.set('query', '')
      resource.state.set('family', 'all')
      resource.state.set('enabled', 'all')
      resource.state.set('purpose', 'all')
      resource.state.set('source', 'all')
      resource.state.set('selectedId', item.id)
      resource.state.set('activeSection', 'details')
      if (!openSessionTools({ sessionId, presentation: 'pane' })) return false
      const snapshot = currentPane.controller.getSnapshot()
      const view = Object.values(snapshot.views).find(view => view.kind === 'mcp-inspector' && view.resourceKey === `session:${sessionId}`)
      return view !== undefined && snapshot.activeGroupId === view.groupId && snapshot.groups?.[view.groupId]?.activeTabId === view.id
    },
  })
  const descriptor = (global: boolean) => ({ kind: global ? 'tools-manager' : 'mcp-inspector', label: t(global ? 'view.globalTools' : 'view.tools'), componentKey: global ? 'tools-manager' : 'mcp-inspector', role: 'inspector', preferredRegion: 'right', retention: 'keep-alive', singleton: global })
  const openGlobalTools = () => { pane?.openView({ ...descriptor(true), resourceKey: 'tools-manager', title: t('view.globalTools'), pinned: true }) }
  const title = (id: string) => `${sessions.list.getSnapshot().byId?.[id as never]?.displayTitle ?? id.slice(0,8)} · ${t('view.tools')}`
  const openSessionTools = ({ sessionId, presentation }: { sessionId?: string; presentation: 'tab' | 'pane' }): boolean => {
    if (!sessionId) { openGlobalTools(); return pane !== undefined }
    if (presentation === 'tab') return navigation()?.open(sessionId, 'mcp-inspector') ?? false
    if (!pane) return false
    const before = Object.values(pane.controller?.getSnapshot().views ?? {})
    const existing = before.find(view => view.kind === 'mcp-inspector' && view.resourceKey === `session:${sessionId}`)
    const source = before.find(view => view.kind === 'conversation' && view.metadata?.sessionId === sessionId)
    pane.openView({ ...descriptor(false), resourceKey: `session:${sessionId}`, metadata: { sessionId }, title: title(sessionId), pinned: true })
    if (!existing && source) {
      const opened = Object.values(pane.controller?.getSnapshot().views ?? {}).find(view => view.kind === 'mcp-inspector' && view.resourceKey === `session:${sessionId}`)
      if (opened) pane.controller?.dispatch({ type: 'split_with_view', viewId: opened.id, targetGroupId: source.groupId, edge: 'right' })
    }
    return true
  }
  const mount = (next: PaneFace | undefined): void => {
    if (next === pane) return
    disposePane(); pane = next; disposePane = () => {}; installedSearch.notify(); sessionSearch.notify()
    if (!next) return
    const disposers = [false, true].map(manager => next.registerView({
      descriptor: descriptor(manager), i18n: { namespace: NS, labelKey: manager ? 'view.globalTools' : 'view.tools' },
      component: ({ view }) => {
        const sessionId = manager ? undefined : typeof view.metadata?.sessionId === 'string' ? view.metadata.sessionId : undefined
        return createElement(ToolsPane, { ctx, sessions, workspace, t, sessionId, manager,
          ...(manager && typeof (get('settingsNavigation') as { open?: unknown } | undefined)?.open === 'function' ? { onSettings: () => { (get('settingsNavigation') as { open(section: string): void }).open('plugins') } } : {}),
          onSessionSelected: id => { rebindPane(view.id, id) },
          ...(!sessionId || !navigation() ? {} : { onOpenSession: () => { navigation()?.open(sessionId, 'chat') } }),
          ...(!manager ? { onManage: openGlobalTools } : {}),
        })
      },
    }))
    if (next.registerSearchSource) {
      disposers.push(next.registerSearchSource(installedSearch.source))
      disposers.push(next.registerSearchSource(sessionSearch.source))
      if (sessions.list?.subscribe) disposers.push(sessions.list.subscribe(() => sessionSearch.notify()))
      disposers.push(workspace.subscribeCatalog((sessionId, state) => {
        if (state.status === 'ready') {
          if (sessionId === undefined) installedSearch.observe(state.catalog)
          else sessionSearch.observe(sessionId, state.catalog)
        } else if (state.status === 'error' || state.status === 'unavailable') {
          if (sessionId === undefined) installedSearch.notify()
          else sessionSearch.notify(sessionId)
        }
      }))
    }
    disposePane = () => { for (const off of disposers) off() }
  }
  const slots = ctx.get('slots') as unknown as { inject(name: string, factory: () => () => void): () => void; register(options: unknown, component: (props: { boundSessionId: string }) => unknown): () => void }
  const offTab = slots.inject('conversation.view', () => slots.register({ name: 'conversation.view', id: 'mcp-inspector', order: 30, locale: NS, label: () => t('view.tools'), inject: (sessionId: string) => ({ boundSessionId: sessionId }) }, ({ boundSessionId }) => createElement('div', { 'data-conversation-readonly-view': true, 'data-tools-session-tab': true }, createElement(ToolsPane, {
    ctx, sessions, workspace, t, sessionId: boundSessionId,
    ...(pane ? { onPin: () => { openSessionTools({ sessionId: boundSessionId, presentation: 'pane' }) } } : {}),
    ...(navigation() ? { onOpenSession: () => { navigation()?.open(boundSessionId, 'chat') } } : {}),
    onManage: openGlobalTools,
  }))))
  function rebindPane(paneId: string, sessionId: string): boolean {
    if (!openSessionTools({ sessionId, presentation: 'pane' })) return false
    const target = Object.values(pane?.controller?.getSnapshot().views ?? {}).find(view => view.kind === 'mcp-inspector' && view.resourceKey === `session:${sessionId}`)
    if (target && paneId !== target.id) pane?.controller?.dispatch({ type: 'close_view', viewId: paneId })
    return true
  }
  const offFace = ctx.provide('sessionTools' as never, { openSessionTools, openGlobalTools, rebindPane } as never)
  mount(asPane(get('paneWorkbench')))
  const offService = ctx.on('internal/service', (service, value) => {
    if (service === 'paneWorkbench') mount(asPane(value))
    if (['remote', 'paneWorkbench', 'conversationNavigation', 'settingsNavigation'].includes(String(service)) || String(service).startsWith('remote.')) {
      workspace.refreshActive(); installedSearch.notify(); sessionSearch.notify()
    }
  }, { global: true })
  const offReset = ctx.on('connection/reset' as never, (() => { workspace.refreshActive(); installedSearch.notify(); sessionSearch.notify() }) as never)
  return () => { offReset(); offService(); offFace(); offTab(); disposePane(); installedSearch.dispose(); sessionSearch.dispose(); workspace.dispose(); disposeLocale() }
}
