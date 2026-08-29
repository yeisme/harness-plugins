/**
 * @yeisme/dsh-side-chat root entry (Host face).
 *
 * 可安装的 DSH Web bundle。Host 面保持 no-op：侧边对话的一切读写都走
 * 官方 client services，无 host 职责；浏览器 UI 在 `./client` 入口注册。
 *
 * @module @yeisme/dsh-side-chat
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-side-chat'
export const inject: readonly string[] = []

/** No-op Host lifecycle：本 bundle 不新增 DSH core fork，也不复制 Host 私有实现。 */
export function apply(_ctx: Context): void {
  // host side intentionally empty
}

const DshSideChatPlugin = { name, inject, apply }
export default DshSideChatPlugin
