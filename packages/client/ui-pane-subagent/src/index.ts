import { subagentZh, subagentEn, type SubagentTranslate } from './labels.js'
import { SessionProjectLinks } from './project-links.js'
/** Subagent Monitor client plugin: Pane view + header entry over official DSH seams. */
import type { Context } from '@deepseek-ai/cordis'
import type { SubagentAddress } from '@deepseek-ai/dsh-client-connection/client'
import { createElement, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Button, IconAgentPresetOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { subscriptionHandle } from '@yeisme/dsh-plugin-contracts'
import { SubagentMonitorController } from './controller.js'
import { createSubagentMonitorView } from './view.js'

interface PaneWorkbenchFace {
  registerView(input: unknown): () => void
  openView(input: unknown): void
  views?: { has(kind: string): boolean }
}

interface SlotsFace {
  inject(name: string, setup: () => () => void): () => void
  register(input: unknown, component: (props: { wide?: boolean }) => ReactNode): () => void
}

const PANE_WORKBENCH_UNAVAILABLE = 'Pane Workbench is unavailable in this host.'
const AGENTS_LAUNCHER_STYLES = `
[data-subagent-monitor-sidebar]{display:inline-flex;min-height:0;overflow:visible}
[data-subagent-monitor-sidebar] .psa-launcher{display:inline-flex;width:32px;min-width:32px;height:32px;min-height:32px;align-items:center;justify-content:center;padding:0;border-radius:8px}
`

function AgentsLauncher({ wide = true, onOpen, disabledReason }: { wide?: boolean; onOpen: () => void; disabledReason?: string }): ReactNode {
  const disabled = disabledReason !== undefined
  const accessibleLabel = disabled ? `Subagents unavailable: ${disabledReason}` : 'Subagents'
  return createElement('span', {
    'data-subagent-monitor-sidebar': true,
    'data-wide': String(wide),
  },
    createElement('style', { 'data-subagent-monitor-launcher-styles': true }, AGENTS_LAUNCHER_STYLES),
    createElement(Button, {
      type: 'button',
      size: 'sm',
      variant: 'toolbar',
      className: 'psa-launcher',
      onClick: disabled ? undefined : onOpen,
      disabled,
      title: disabled ? accessibleLabel : 'Open session subagents',
      'aria-label': accessibleLabel,
      'aria-disabled': disabled,
    }, createElement('span', { 'aria-hidden': true }, createElement(IconAgentPresetOutline16, { size: 18 }))),
  )
}

// paneWorkbench is an optional capability probe. Declaring it here would keep
// the entire Web entry pending when a pre-Core/partial layout host correctly
// refuses to provide the service.
export const inject = ['sessions', 'connection', 'slots']

function asPaneWorkbench(candidate: unknown): PaneWorkbenchFace | undefined {
  const partial = candidate as Partial<PaneWorkbenchFace> | undefined
  if (typeof partial?.registerView === 'function' && typeof partial.openView === 'function') {
    return partial as PaneWorkbenchFace
  }
  return undefined
}

function resolvePaneWorkbench(ctx: Context): PaneWorkbenchFace | undefined {
  try {
    return asPaneWorkbench(ctx.get('paneWorkbench' as never))
  } catch { /* optional capability probe */ }
  return undefined
}

export function apply(ctx: Context): () => void {
  let locale: { register?(ns: string, dictionaries: unknown): () => void; bind?(ns: string): (key: string) => string; subscribe?(fn: () => void): () => void; getSnapshot?(): unknown } | undefined
  try { locale = ctx.get('locale' as never) as typeof locale } catch { /* optional locale */ }
  const offLocale = locale?.register?.('sessionSubagents', { zh: subagentZh, en: subagentEn })
  const translate = locale?.bind?.('sessionSubagents')
  const t: SubagentTranslate = key => translate?.(key) ?? subagentZh[key]

  const sessions = ctx.get('sessions') as {
    readonly list: {
      getSnapshot(): {
        readonly current?: string
        readonly byId: Readonly<Record<string, unknown>>
        readonly subagentsByParent: Readonly<Record<string, unknown>>
      }
      subscribe(listener: () => void): () => void
    }
    openSubagent(address: SubagentAddress): void
    refreshSubagents(parentSessionId: string): Promise<void>
  }
  const connection = ctx.get('connection') as {
    readonly api: {
      readonly subagents: {
        history(request: unknown): Promise<{ result: { ok: boolean; error?: { message?: string }; value?: { events?: readonly unknown[]; hasMore?: boolean } } }>
        prompt(request: unknown): Promise<{ result: { ok: boolean; error?: { message?: string } } }>
        interrupt(request: unknown): Promise<{ result: { ok: boolean; error?: { message?: string } } }>
      }
    }
  }
  const slots = ctx.get('slots') as unknown as SlotsFace
  let pane: PaneWorkbenchFace | undefined
  let paneDisposers: Array<() => void> = []
  let disposeLauncher: () => void = () => {}

  const openAgents = (): void => {
    const rootSessionId = sessions.list.getSnapshot().current
    // Guard session changes between rendering the disabled state and clicking.
    if (rootSessionId === undefined) return
    pane?.openView({
      kind: 'subagent.monitor', resourceKey: `subagent:${rootSessionId}`,
      role: 'navigator', preferredRegion: 'right', retention: 'keep-alive',
      singleton: true, pinned: true, title: t('title'),
    })
  }

  const disposePane = (): void => {
    for (const dispose of paneDisposers.reverse()) dispose()
    paneDisposers = []
    pane = undefined
  }

  const createController = (rootSessionId?: string): SubagentMonitorController => new SubagentMonitorController({
      getSnapshot: () => sessions.list.getSnapshot() as never,
      // 订阅经具名句柄转发；controller dispose 时统一 unsubscribe。
      subscribe: listener => {
        const events = subscriptionHandle(sessions.list.subscribe(listener))
        return () => events.unsubscribe()
      },
      refresh: parentSessionId => void sessions.refreshSubagents(parentSessionId),
      openSubagent: address => sessions.openSubagent(address as never),
      canOpenAlongside: () => pane?.views?.has('dsh-side-chat.session') === true,
      openAlongside: address => {
        if (pane?.views?.has('dsh-side-chat.session')) pane.openView({ kind: 'dsh-side-chat.session', resourceKey: `side-chat:${address.childSessionId}`, role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: false, title: 'Agent' })
      },
      ...(typeof connection?.api?.subagents?.history === 'function' && typeof connection.api.subagents.prompt === 'function' && typeof connection.api.subagents.interrupt === 'function' ? { detail: {
        history: async (address, opts) => {
          const response = await connection.api.subagents.history({ ...address, maxMessages: opts?.maxMessages })
          return response.result.ok
            ? { ok: true, summary: `${response.result.value?.events?.length ?? 0} events` }
            : { ok: false, error: response.result.error?.message ?? 'history failed' }
        },
        prompt: async (address, text) => {
          const response = await connection.api.subagents.prompt({ ...address, content: [{ type: 'text', text }] })
          return response.result.ok ? { ok: true } : { ok: false, error: response.result.error?.message ?? 'send failed' }
        },
        interrupt: async address => {
          const response = await connection.api.subagents.interrupt({ ...address })
          return response.result.ok ? { ok: true } : { ok: false, error: response.result.error?.message ?? 'interrupt failed' }
        },
      } } : {}),
    }, rootSessionId)

  function BoundMonitor(props: { rootSessionId?: string | undefined; view?: { resourceKey?: string } }) {
    useSyncExternalStore(listener => locale?.subscribe?.(listener) ?? (() => {}), () => locale?.getSnapshot?.() ?? null)
    const [fallbackRoot] = useState(() => sessions.list.getSnapshot().current ?? '')
    const rootSessionId = props.rootSessionId ?? /^subagent:(.+)$/.exec(props.view?.resourceKey ?? '')?.[1] ?? fallbackRoot
    const controller = useMemo(() => createController(rootSessionId), [rootSessionId])
    useEffect(() => () => controller.dispose(), [controller])
    const View = useMemo(() => createSubagentMonitorView(controller), [controller])
    let remote: unknown
    try { remote = ctx.get('remote.ordoAgentOps' as never) } catch { remote = undefined }
    return createElement(View, { retry: () => controller.refresh(), t, footer: createElement(SessionProjectLinks, { sessionRef: rootSessionId, remote: remote as never, available: pane?.views?.has('agents.hub') === true, open: (projectRef: string, taskRef?: string) => {
      if (!pane?.views?.has('agents.hub')) return
      pane.openView({ kind: 'agents.hub', resourceKey: `ordo-project:${projectRef}`, role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: false, title: 'Ordo', ...(taskRef ? { metadata: { selectedTaskRef: taskRef } } : {}) })
    } }) })
  }

  const disposeTab = slots.inject('conversation.view', () => slots.register({ name: 'conversation.view', id: 'session-agents', order: 35, label: () => t('title'), inject: (sessionId: string) => ({ rootSessionId: sessionId }) }, BoundMonitor as never))

  const mountPane = (nextPane: PaneWorkbenchFace): void => {
    const nextDisposers: Array<() => void> = []
    try {
      nextDisposers.push(nextPane.registerView({
        descriptor: {
          kind: 'subagent.monitor',
          label: t('title'),
          componentKey: 'subagent-monitor',
          role: 'navigator',
          preferredRegion: 'right',
          retention: 'keep-alive',
          singleton: true,
        },
        i18n: { namespace: 'sessionSubagents', labelKey: 'title' },
        component: BoundMonitor,
      }))
    } catch (error) {
      for (const dispose of nextDisposers.reverse()) dispose()
      throw error
    }
    pane = nextPane
    paneDisposers = nextDisposers
  }

  const registerLauncher = (): (() => void) => slots.inject('sidebar.footer.action', () => slots.register({
      name: 'sidebar.footer.action', id: 'subagent-monitor-sidebar', order: 38,
    }, props => createElement(AgentsLauncher, {
      wide: false,
      onOpen: openAgents,
      ...(pane === undefined ? { disabledReason: PANE_WORKBENCH_UNAVAILABLE }
        : sessions.list.getSnapshot().current === undefined ? { disabledReason: 'Start or select a session to inspect its agents.' } : {}),
    })))

  const refreshPane = (nextPane: PaneWorkbenchFace | undefined): void => {
    if (nextPane === pane) return
    disposePane()
    if (nextPane !== undefined) mountPane(nextPane)
    disposeLauncher()
    disposeLauncher = registerLauncher()
  }

  // Avoid a loader dependency while still handling the normal sibling-plugin
  // race: paneWorkbench may be provided just after this entry activates.
  try {
    const initialPane = resolvePaneWorkbench(ctx)
    if (initialPane !== undefined) mountPane(initialPane)
    disposeLauncher = registerLauncher()
    const serviceEvents = subscriptionHandle(ctx.on('internal/service', (name, value) => {
      if (name !== 'paneWorkbench') return
      refreshPane(asPaneWorkbench(value))
    }, { global: true }))
    const sessionEvents = subscriptionHandle(sessions.list.subscribe(() => {
      disposeLauncher()
      disposeLauncher = registerLauncher()
    }))
    return () => {
      serviceEvents.unsubscribe()
      sessionEvents.unsubscribe()
      disposeLauncher()
      disposeTab()
      disposePane()
      offLocale?.()
    }
  } catch (error) {
    disposeLauncher()
    disposeTab()
    disposePane()
    offLocale?.()
    throw error
  }
}

const SubagentMonitorPlugin = { inject, apply }
export default SubagentMonitorPlugin

export { projectSubagentPane } from './projection.js'
export type { SubagentProjectionSource } from './projection.js'

export { SubagentMonitorView } from './view.js'
export { SubagentMonitorController } from './controller.js'
export { subagentZh, subagentEn } from './labels.js'
