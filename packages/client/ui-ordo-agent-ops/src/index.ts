/** @deprecated 0.1.0-rc.7 compatibility node half; use @yeisme/dsh-ordo-agent-ops. */

import type { Context } from '@deepseek-ai/cordis'
import { warnLegacyPackage } from '@yeisme/dsh-ordo-agent-ops/compat'

export const name = 'client-ui-ordo-agent-ops'
export const inject: string[] = []

/** 保留旧 Loader row，使 dsh.client 发现旧 bundle 后给出一次迁移提示。 */
export function apply(ctx: Context): void {
  warnLegacyPackage(ctx, '@yeisme/dsh-client-ui-ordo-agent-ops')
}

const LegacyClientPlugin = { name, inject, apply }

export default LegacyClientPlugin
