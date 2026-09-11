/**
 * DSH `sessions` seam 适配（dsh-url-session-v1 §3.1）。capability probe：
 * 缺 `sessions.list` / `sessions.open` 任一面时不注册入口、不抛错、不伪造
 * open。会话清单来自 list 快照（byId 优先，回退 ids）；`open` 由 runtime
 * 自带 cwd→workspace 切换（与 Codex `--all` 同源），本层不读路径也不写状态。
 *
 * @module @yeisme/dsh-client-ui-url-session/client
 */

import type { SessionUrlSyncAdapter } from './index.ts'

/** 官方 sessions 服务在本层消费的最小结构面（结构性探测，不复制状态）。 */
export interface SessionsServiceLike {
  readonly list?: {
    getSnapshot(): {
      readonly current?: string | undefined
      readonly ids?: readonly string[] | undefined
      readonly byId?: Readonly<Record<string, unknown>> | undefined
    }
    subscribe?(listener: () => void): () => void
  } | undefined
  open?(sessionId: string): void
}

export interface UrlSessionSeamProbe {
  readonly available: boolean
  readonly reason: string
  readonly service: SessionsServiceLike | undefined
}

/** 读取 `sessions` 服务并做能力探测；任何缺面都返回 unavailable + 原因。 */
export function probeUrlSessionSeams(ctx: { get(service: string): unknown }): UrlSessionSeamProbe {
  let service: SessionsServiceLike | undefined
  try {
    service = ctx.get('sessions') as SessionsServiceLike | undefined
  } catch {
    service = undefined
  }
  if (service === undefined || service === null) {
    return { available: false, reason: 'sessions service is unavailable', service: undefined }
  }
  if (service.list === undefined || typeof service.list.getSnapshot !== 'function') {
    return { available: false, reason: 'sessions list snapshot is unavailable', service: undefined }
  }
  if (typeof service.open !== 'function') {
    return { available: false, reason: 'sessions open is unavailable', service: undefined }
  }
  return { available: true, reason: 'sessions seams available', service }
}

/** 把官方 sessions 服务适配成 sync controller 的 adapter（无状态包装）。 */
export function createSessionsAdapter(service: SessionsServiceLike): SessionUrlSyncAdapter {
  return {
    listSessions(): Promise<readonly { readonly sessionId: string }[]> {
      const snapshot = service.list!.getSnapshot()
      const byId = snapshot.byId
      if (byId !== undefined) {
        return Promise.resolve(Object.keys(byId).map(sessionId => ({ sessionId })))
      }
      const ids = snapshot.ids ?? []
      return Promise.resolve(ids.map(sessionId => ({ sessionId })))
    },
    async openSession(sessionId: string): Promise<void> {
      service.open!(sessionId)
    },
  }
}
