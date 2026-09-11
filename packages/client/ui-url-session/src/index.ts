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
import { isValidSessionId, parseSessionLocation, sessionUrl, type SessionLocationLike } from './codec.ts'

export type SessionUrlSyncState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'loading'; readonly sessionId: string }
  | { readonly phase: 'ready'; readonly sessionId: string }
  | { readonly phase: 'missing'; readonly sessionId: string }
  | { readonly phase: 'unavailable'; readonly reason: string }

export interface SessionUrlSyncAdapter {
  listSessions(): Promise<readonly { readonly sessionId: string }[]>
  openSession(sessionId: string): Promise<boolean | void>
}

export interface SessionUrlSyncOptions {
  readonly location?: SessionLocationLike
  readonly history?: Pick<History, 'pushState' | 'replaceState'>
  readonly origin?: string
  readonly hasHistoryFallback?: boolean
}

/** URL↔session coordinator. It owns no session state and is safe to dispose. */
export class SessionUrlSyncController {
  private generation = 0
  private current: string | undefined
  private disposed = false
  private state: SessionUrlSyncState = { phase: 'unavailable', reason: 'not_started' }
  private readonly listeners = new Set<() => void>()
  constructor(private readonly adapter: SessionUrlSyncAdapter, private readonly options: SessionUrlSyncOptions = {}) {}
  getSnapshot(): SessionUrlSyncState { return this.state }
  /** 当前已同步（或试图同步）的会话 id；未开始为 undefined。 */
  get currentSessionId(): string | undefined { return this.current }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  private emit(): void {
    for (const listener of [...this.listeners]) listener()
  }
  private setState(next: SessionUrlSyncState): void {
    this.state = next
    this.emit()
  }
  dispose(): void { this.disposed = true; this.generation += 1 }
  async boot(location = this.options.location ?? (typeof globalThis.location === 'undefined' ? {} : globalThis.location)): Promise<SessionUrlSyncState> {
    const parsed = parseSessionLocation(location)
    if (parsed.sessionId === null) { this.setState({ phase: 'unavailable', reason: 'no_session_in_url' }); return this.state }
    return this.select(parsed.sessionId, 'url')
  }
  async select(sessionId: string, source: 'url' | 'user' | 'history' = 'user'): Promise<SessionUrlSyncState> {
    const generation = ++this.generation
    this.setState({ phase: 'loading', sessionId })
    let rows: readonly { readonly sessionId: string }[]
    try { rows = await this.adapter.listSessions() } catch { this.setState({ phase: 'unavailable', reason: 'sessions_unavailable' }); return this.state }
    if (this.disposed || generation !== this.generation) return this.state
    if (!rows.some(row => row.sessionId === sessionId)) { this.setState({ phase: 'missing', sessionId }); return this.state }
    try {
      const opened = await this.adapter.openSession(sessionId)
      if (opened === false) { this.setState({ phase: 'missing', sessionId }); return this.state }
    } catch { this.setState({ phase: 'unavailable', reason: 'session_open_failed' }); return this.state }
    if (this.disposed || generation !== this.generation) return this.state
    const previous = this.current
    this.current = sessionId
    this.setState({ phase: 'ready', sessionId })
    if (source !== 'history') this.syncHistory(sessionId, previous)
    return this.state
  }

  /**
   * 侧栏/宿主已把会话选中（非本 controller 发起）时同步 URL：不重复 open、
   * 不重查清单，只更新 current 并按规则 push/replace。非法 id 忽略（不猜）。
   */
  syncFromSelection(sessionId: string | undefined): void {
    if (this.disposed || sessionId === undefined || sessionId === '' || sessionId === this.current) return
    if (!isValidSessionId(sessionId)) return
    const previous = this.current
    this.current = sessionId
    this.setState({ phase: 'ready', sessionId })
    this.syncHistory(sessionId, previous)
  }

  /**
   * 空态「返回列表」：清掉地址栏对该会话的声称（replaceState 回根路径），
   * 回到 idle。不切换会话、不写任何状态。
   */
  dismissMissing(): void {
    if (this.state.phase !== 'missing') return
    const history = this.options.history
    const origin = this.options.origin
    if (history !== undefined && origin !== undefined) {
      try { history.replaceState({}, '', `${origin.endsWith('/') ? origin.slice(0, -1) : origin}/`) } catch { /* 受限环境下静默：URL 声称由下一次导航覆盖 */ }
    }
    this.setState({ phase: 'idle' })
  }
  private syncHistory(sessionId: string, previous: string | undefined): void {
    const history = this.options.history
    const origin = this.options.origin
    if (history === undefined || origin === undefined) return
    const url = sessionUrl({ origin, sessionId, form: this.options.hasHistoryFallback === false ? 'alias' : 'canonical' })
    const method = previous === sessionId ? 'replaceState' : 'pushState'
    history[method]({}, '', url)
  }
}

export const name = 'client-ui-url-session'
export const inject: readonly string[] = []

export function apply(_ctx: Context): void {
  // no-op host face；插件行为在 client 侧交付。
}

const ClientUiUrlSessionPlugin = { name, inject, apply }
export default ClientUiUrlSessionPlugin
