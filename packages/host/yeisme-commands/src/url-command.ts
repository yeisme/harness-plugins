/**
 * `/yeisme-url`（dsh-url-session-v1 §6.2）：在会话内打印当前会话的分享
 * 链接。链接只含 origin + SessionId（P1 用零服务器改动的 `?s=` 别名），
 * 不携带 token、cookie 或草稿正文；`recordInput: false`，URL 不经
 * rawInput 重复进会话日志（command/done 的结果文本即用户可见的打印）。
 *
 * @module @yeisme/dsh-host-yeisme-commands
 */

import type { CommandResult } from '@deepseek-ai/dsh-commands'
import type { YeismeCommandDefinition } from './index.ts'

/** Web 服务面在本 host 插件消费的最小结构。 */
export interface WebServerLike {
  readonly port: number
  readonly host: string
}

/** 兼容 loopback 与显式 0.0.0.0 绑定的 origin 解析（0.0.0.0 显示为字面量）。 */
export function webOrigin(server: WebServerLike): string {
  const host = server.host === '0.0.0.0' ? '127.0.0.1' : server.host
  return `http://${host}:${String(server.port)}`
}

/** 组合当前会话的分享链接（别名形式；canonical 需 profile historyFallback）。 */
export function sessionShareUrl(server: WebServerLike, sessionId: string): string | undefined {
  if (typeof sessionId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(sessionId)) return undefined
  return `${webOrigin(server)}/?s=${encodeURIComponent(sessionId)}`
}

export interface UrlCommandDeps {
  readonly server: WebServerLike
}

export function yeismeUrlCommandHandler(deps: UrlCommandDeps): (invocation: { readonly agent: { readonly id: string } }) => CommandResult {
  return invocation => {
    const url = sessionShareUrl(deps.server, invocation.agent.id)
    if (url === undefined) return { kind: 'error', text: 'current session id is not a shareable literal' }
    return { kind: 'success', text: url }
  }
}

export const YEISME_URL_COMMAND_NAME = 'yeisme-url'

export function yeismeUrlCommand(deps: UrlCommandDeps): YeismeCommandDefinition {
  return {
    name: YEISME_URL_COMMAND_NAME,
    description: 'Print a shareable link for the current session (?s= alias; no token).',
    recordInput: false,
    handler: yeismeUrlCommandHandler(deps),
  }
}
