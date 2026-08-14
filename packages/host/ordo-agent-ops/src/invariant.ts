/** Package-owned invariant companion. @module @yeisme/dsh-host-ordo-agent-ops/invariant */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@yeisme/dsh-host-ordo-agent-ops'

/** Cordis companion plugin name. */
export const name = 'host-ordo-agent-ops-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** No runtime invariant: this package reads an owner projection and owns no mutable Agent Ops state. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
