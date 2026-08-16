/** Package-owned invariant companion for the read-only `/ordo` registration. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-commands'
import type { InvariantFailure, InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import { hasOrdoCommandRegistration } from './index.ts'

const PACKAGE_NAME = '@yeisme/dsh-host-ordo-commands'

/** Cordis companion plugin name. */
export const name = 'host-ordo-commands-invariant'
/** Service required before this package can reserve its invariant ownership. */
export const inject = ['invariants']

/** Verify that the live command effect remains paired with the sole snapshot source. */
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

/** Register this package's command/source relationship check. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
