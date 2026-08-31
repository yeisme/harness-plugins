/** Subagent Monitor client plugin: Pane view + header entry over official DSH seams. */
import type { Context } from '@deepseek-ai/cordis'
import type { SubagentAddress } from '@deepseek-ai/dsh-client-connection/client'
import { createElement, type ReactNode } from 'react'
import { Button, IconAgentPresetOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { SubagentMonitorController } from './controller.js'
import { createSubagentMonitorView } from './view.js'

interface PaneWorkbenchFace {
  registerView(input: unknown): () => void
  openView(input: unknown): void
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
  const accessibleLabel = disabled ? `Agents unavailable: ${disabledReason}` : 'Agents'
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
      title: disabled ? accessibleLabel : 'Open Agents',
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
    // No live root session: opening a fake `subagent:current` key would never
    // match a real session again, so the launcher stays a no-op instead.
    if (rootSessionId === undefined) return
    pane?.openView({
      kind: 'subagent.monitor', resourceKey: `subagent:${rootSessionId}`,
      role: 'navigator', preferredRegion: 'right', retention: 'keep-alive',
      singleton: true, pinned: true, title: 'Agents',
    })
  }

  const disposePane = (): void => {
    for (const dispose of paneDisposers.reverse()) dispose()
    paneDisposers = []
    pane = undefined
  }

  const mountPane = (nextPane: PaneWorkbenchFace): void => {
    const controller = new SubagentMonitorController({
      getSnapshot: () => sessions.list.getSnapshot() as never,
      subscribe: listener => sessions.list.subscribe(listener),
      refresh: parentSessionId => void sessions.refreshSubagents(parentSessionId),
      openSubagent: address => sessions.openSubagent(address as never),
      detail: {
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
      },
    })
    const nextDisposers: Array<() => void> = [() => controller.dispose()]
    try {
      nextDisposers.push(nextPane.registerView({
        descriptor: {
          kind: 'subagent.monitor',
          label: 'Agents',
          componentKey: 'subagent-monitor',
          role: 'navigator',
          preferredRegion: 'right',
          retention: 'keep-alive',
          singleton: true,
        },
        i18n: { namespace: 'paneWorkbench', labelKey: 'rail.agents' },
        component: createSubagentMonitorView(controller),
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
      ...(pane === undefined ? { disabledReason: PANE_WORKBENCH_UNAVAILABLE } : {}),
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
    const disposeServiceListener = ctx.on('internal/service', (name, value) => {
      if (name !== 'paneWorkbench') return
      refreshPane(asPaneWorkbench(value))
    }, { global: true })
    return () => {
      disposeServiceListener()
      disposeLauncher()
      disposePane()
    }
  } catch (error) {
    disposeLauncher()
    disposePane()
    throw error
  }
}

const SubagentMonitorPlugin = { inject, apply }
export default SubagentMonitorPlugin
