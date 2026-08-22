/**
 * @yeisme/dsh-conversation-rewrite root entry.
 *
 * 可安装的 DSH Web bundle。Host 面保持 no-op：会话日志、fork 边界校验与
 * prompt 发送始终由 DSH Host 拥有；浏览器交互在 `./client` 入口注册。
 *
 * @module @yeisme/dsh-conversation-rewrite
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-conversation-rewrite'
export const inject: readonly string[] = []

/** No-op Host lifecycle：本 change 不新增 DSH core fork，也不复制 Host 私有实现。 */
export function apply(_ctx: Context): void {
  // host side intentionally empty
}

const DshConversationRewritePlugin = { name, inject, apply }

export default DshConversationRewritePlugin
