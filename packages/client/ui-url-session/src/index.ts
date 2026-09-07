/**
 * @yeisme/dsh-client-ui-url-session node/host-side entry。
 *
 * URL↔runtime 同步、空态与入口注册属于后续客户端切片（change
 * `dsh-url-session-v1` §3/§4）；本入口保持 no-op，纯函数 codec 经
 * `@yeisme/dsh-client-ui-url-session/codec` 子路径导出，不携带 DSH 私有 import。
 *
 * @module @yeisme/dsh-client-ui-url-session
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'client-ui-url-session'
export const inject: readonly string[] = []

export function apply(_ctx: Context): void {
  // no-op host face；插件行为在 client 侧交付。
}

const ClientUiUrlSessionPlugin = { name, inject, apply }
export default ClientUiUrlSessionPlugin
