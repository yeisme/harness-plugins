/** Agent Context + Terminal probe client plugin. */
import type { Context } from '@deepseek-ai/cordis'
import { AgentContextController, type AgentContextEnvironment } from './controller.js'
import { createAgentContextView, createTerminalProbeView } from './view.js'
import type { AgentContextSource } from './projection.js'
import type { TerminalCapabilitySource } from './terminal-probe.js'

interface PaneWorkbenchFace {
  registerView(input: unknown): () => void
  openView(request: unknown): void
}

export const inject = ['slots']

function readPlanSkillsSource(ctx: Context): AgentContextSource {
  const plan = ctx.get('plan') as { getSnapshot?: () => { mode?: string; steps?: AgentContextSource['steps'] } } | undefined
  const skills = ctx.get('skills') as { getSnapshot?: () => { items?: AgentContextSource['skills'] } } | undefined
  const sessions = ctx.get('sessions') as { readonly list?: { getSnapshot?: () => { current?: string } } } | undefined
  return {
    sessionRef: sessions?.list?.getSnapshot?.()?.current ?? 'session:unknown',
    planMode: plan?.getSnapshot?.()?.mode,
    steps: plan?.getSnapshot?.()?.steps,
    skills: skills?.getSnapshot?.()?.items,
    invocations: [],
    freshness: plan === undefined && skills === undefined ? 'unknown' : 'fresh',
    generation: 1,
  }
}

export function apply(ctx: Context): () => void {
  const pane = ctx.get('paneWorkbench') as PaneWorkbenchFace | undefined
  const disposers: Array<() => void> = []
  const env: AgentContextEnvironment = {
    getSnapshot: () => readPlanSkillsSource(ctx),
    subscribe: listener => {
      const plan = ctx.get('plan') as { subscribe?: (listener: () => void) => () => void } | undefined
      const skills = ctx.get('skills') as { subscribe?: (listener: () => void) => () => void } | undefined
      const unsubPlan = plan?.subscribe?.(listener)
      const unsubSkills = skills?.subscribe?.(listener)
      return () => {
        unsubPlan?.()
        unsubSkills?.()
      }
    },
  }
  const controller = new AgentContextController(env)
  disposers.push(() => controller.dispose())

  if (pane !== undefined) {
    disposers.push(pane.registerView({
      descriptor: {
        kind: 'workspace.agent-context',
        label: 'Agent Context',
        componentKey: 'agent-context',
        role: 'inspector',
        preferredRegion: 'right',
        retention: 'keep-alive',
        singleton: true,
      },
      component: createAgentContextView(controller),
    }))
    disposers.push(pane.registerView({
      descriptor: {
        kind: 'workspace.terminal',
        label: 'Terminal',
        componentKey: 'terminal-probe',
        role: 'utility',
        preferredRegion: 'bottom',
        retention: 'keep-alive',
        singleton: false,
      },
      component: createTerminalProbeView(() => ctx.get('terminals') as TerminalCapabilitySource | undefined),
    }))
  }

  return () => {
    for (const dispose of disposers.reverse()) dispose()
  }
}

const AgentContextPlugin = { inject, apply }
export default AgentContextPlugin
