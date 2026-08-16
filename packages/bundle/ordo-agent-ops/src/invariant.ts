/** unified package 的 Ordo bridge 与 `/ordo` 关系检查。 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantFailure, InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import { hasOrdoCommandRegistration } from './host/commands.ts'

const PACKAGE_NAME = '@yeisme/dsh-ordo-agent-ops'

export const name = 'ordo-agent-ops-invariant'
export const inject = ['invariants']

const install: InvariantInstaller = Object.assign((ctx: Context, fail: InvariantFailure) => {
  const source = ctx.get('ordoAgentOps') as { snapshot?: unknown } | undefined
  const commands = ctx.get('commands')
  if (typeof source?.snapshot !== 'function') fail('/ordo requires the mounted Ordo Agent Ops snapshot source')
  if (commands === undefined || !hasOrdoCommandRegistration(ctx)) fail('/ordo must remain registered while its snapshot source is mounted')
  ctx.on('commands/change', () => {
    const current = ctx.get('ordoAgentOps') as { snapshot?: unknown } | undefined
    if (typeof current?.snapshot !== 'function') fail('/ordo command registration outlived its snapshot source')
  })
}, { inject: ['commands', 'ordoAgentOps'] })

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
