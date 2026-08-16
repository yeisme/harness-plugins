/** 旧 package 兼容入口；不包含第二套 Ordo 业务实现。 */

import type { Context } from '@deepseek-ai/cordis'
import { applyLegacyCommands, applyLegacyHostBridge } from './index.ts'
import { warnLegacyPackage } from './legacy-warning.ts'

export { warnLegacyPackage } from './legacy-warning.ts'

/** 启动旧 host leaf 时委派给统一逻辑 bridge。 */
export async function applyLegacyHost(ctx: Context): Promise<() => Promise<void>> {
  warnLegacyPackage(ctx, '@yeisme/dsh-host-ordo-agent-ops')
  return applyLegacyHostBridge(ctx)
}

/** 启动旧 command leaf 时委派给统一逻辑 `/ordo`。 */
export async function applyLegacyCommand(ctx: Context): Promise<() => Promise<void>> {
  warnLegacyPackage(ctx, '@yeisme/dsh-host-ordo-commands')
  return applyLegacyCommands(ctx)
}
