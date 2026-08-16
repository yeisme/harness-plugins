/** @deprecated 0.1.0-rc.7 compatibility shim; use @yeisme/dsh-ordo-agent-ops. */

import type { Context } from '@deepseek-ai/cordis'
import { applyLegacyCommand } from '@yeisme/dsh-ordo-agent-ops/compat'

export {
  hasOrdoCommandRegistration,
  parseOrdoCommand,
  parseSafeOrdoRef,
} from '@yeisme/dsh-ordo-agent-ops/commands'
export type { OrdoCommand, SafeOrdoRef } from '@yeisme/dsh-ordo-agent-ops/commands'

export const name = 'host-ordo-commands'
export const inject = ['commands', 'ordoAgentOps']
export const apply = (ctx: Context): Promise<() => Promise<void>> => applyLegacyCommand(ctx)

const LegacyOrdoCommandsPlugin = { name, inject, apply }

export default LegacyOrdoCommandsPlugin
