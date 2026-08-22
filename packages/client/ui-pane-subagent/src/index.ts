/** Subagent Monitor client plugin: Pane view + header entry over official DSH seams. */
import type { Context } from '@deepseek-ai/cordis'
import type { SubagentAddress } from '@deepseek-ai/dsh-client-connection/client'
import { createElement } from 'react'
import { SubagentMonitorController } from './controller.js'
import { createSubagentMonitorView } from './view.js'

interface PaneWorkbenchFace {
  registerView(input: unknown): () => void
  openView(request: unknown): void
}

interface HeaderActionProps {
  readonly openPane: () => void
}

function SubagentOpenAction(props: HeaderActionProps): unknown {
  return createElement('button', { type: 'button', onClick: () => props.openPane() }, 'Agents')
}

export const inject = ['sessions', 'slots', 'locale', 'connection']

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
  const pane = ctx.get('paneWorkbench') as PaneWorkbenchFace | undefined
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
  const disposers: Array<() => void> = [() => controller.dispose()]

  if (pane !== undefined) {
    disposers.push(pane.registerView({
      descriptor: {
        kind: 'subagent.monitor',
        label: 'Agents',
        componentKey: 'subagent-monitor',
        role: 'navigator',
        preferredRegion: 'right',
        retention: 'keep-alive',
        singleton: true,
      },
      component: createSubagentMonitorView(controller),
    }))
  }

  const openPane = (): void => {
    if (pane === undefined) return
    const snapshot = sessions.list.getSnapshot()
    const rootSessionId = snapshot.current
    if (rootSessionId === undefined) return
    pane.openView({
      kind: 'subagent.monitor',
      resourceKey: `subagent:${rootSessionId}`,
      role: 'navigator',
      preferredRegion: 'right',
      retention: 'keep-alive',
      singleton: true,
      pinned: true,
      title: 'Agents',
    })
  }

  const slots = ctx.get('slots') as {
    inject(name: string, register: () => unknown): () => void
  }
  disposers.push(slots.inject('conversation.session.header.actions', () => ctx.get('slots')?.register?.({
    name: 'conversation.session.header.actions',
    id: 'subagent-monitor-open',
    order: 20,
    inject: (): HeaderActionProps => ({ openPane }),
  }, SubagentOpenAction)))

  return () => {
    for (const dispose of disposers.reverse()) dispose()
  }
}

const SubagentMonitorPlugin = { inject, apply }
export default SubagentMonitorPlugin
