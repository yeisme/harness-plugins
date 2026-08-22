/**
 * @yeisme/dsh-next-step-suggestions root entry.
 *
 * 可安装的 DSH Web bundle。Host 面保持 no-op：session log、prompt 发送与
 * plan selection 始终由 DSH Host 拥有；浏览器交互在 `./client` 入口注册。
 *
 * @module @yeisme/dsh-next-step-suggestions
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-next-step-suggestions'
export const inject: readonly string[] = []

/** No-op Host lifecycle：本 change 不新增 DSH core fork。 */
export function apply(_ctx: Context): void {
  // host side intentionally empty
}

const DshNextStepSuggestionsPlugin = { name, inject, apply }

export default DshNextStepSuggestionsPlugin
