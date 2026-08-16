/** @deprecated 0.1.0-rc.7 compatibility shim; use @yeisme/dsh-ordo-agent-ops. */

import type { Context } from '@deepseek-ai/cordis'
import { applyLegacyHost } from '@yeisme/dsh-ordo-agent-ops/compat'

export * from '@yeisme/dsh-ordo-agent-ops/host'

/** 保留旧 Loader row 的 name 与依赖形状。 */
export const name = 'host-ordo-agent-ops'
export const inject: string[] = []
export const apply = (ctx: Context): Promise<() => Promise<void>> => applyLegacyHost(ctx)

const LegacyOrdoAgentOpsPlugin = { name, inject, apply }

export default LegacyOrdoAgentOpsPlugin
