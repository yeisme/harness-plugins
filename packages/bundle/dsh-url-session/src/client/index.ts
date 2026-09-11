/**
 * @yeisme/dsh-url-session browser entry.
 *
 * ModuleLoader 要求 client 入口是 cordis 插件形态（apply/inject/name）。
 * §3 客户端接线（深链选中/History 同步/缺失空态/会话链接菜单）由
 * `@yeisme/dsh-client-ui-url-session/client` 的 applyClient 提供；缺
 * sessions/slots seam 时 capability probe 降级（不注册入口、不抛错）。
 *
 * @module @yeisme/dsh-url-session/client
 */

import { applyClient, clientEntryInject, clientEntryName } from '@yeisme/dsh-client-ui-url-session/client'

export const name = `dsh-url-session(${clientEntryName})`
export const inject = [...clientEntryInject]
export function apply(ctx: unknown): () => void {
  return applyClient(ctx as never)
}
export { SessionUrlSyncController } from '@yeisme/dsh-client-ui-url-session'
export type { SessionUrlSyncAdapter, SessionUrlSyncOptions, SessionUrlSyncState } from '@yeisme/dsh-client-ui-url-session'
