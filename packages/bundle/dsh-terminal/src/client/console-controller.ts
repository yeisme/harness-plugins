/**
 * Terminal console 控制器：行式终端投影的状态机。
 *
 * 职责：terminalPane Remote 解析结果 → 能力态（disabled+reason）；owner
 * session 选择（默认 current，可切列表内任意 session）；终端列表与 active
 * 终端；send 单飞（官方单 send 保留）；滚回读取由调用方事件驱动触发
 * （`refreshScrollback()`），控制器自身不设任何定时器。
 *
 * @module @yeisme/dsh-terminal/client/console-controller
 */

import type {
  TerminalPaneProbeResult,
  TerminalPaneSummaryV1,
} from '@yeisme/dsh-terminal-host'
import type { TerminalPaneRemoteFace } from './console-remote.ts'

export type TerminalConsolePhase = 'probing' | 'disabled' | 'ready'

export interface TerminalConsoleState {
  readonly phase: TerminalConsolePhase
  /** disabled 原因（phase=disabled 时必有）。 */
  readonly disabledReason?: string
  /** 可用 backend 类型（spawn 用）。 */
  readonly backendTypes: readonly string[]
  /** owner 名下终端列表（最近一次 list 成功结果；失败保留旧值）。 */
  readonly sessions: readonly TerminalPaneSummaryV1[]
  /** 当前 owner session（缺省 = 跟随 current，由调用方注入）。 */
  readonly ownerSessionId?: string | undefined
  /** active 终端 id。 */
  readonly activeTerminalId?: string | undefined
  /** 最近一次滚回页。 */
  readonly scrollback?: { readonly text: string; readonly totalLines: number; readonly lineBegin: number; readonly lineEnd: number; readonly truncated: boolean } | undefined
  /** send 进行中（输入锁定）。 */
  readonly sending: boolean
  /** 最近一次 send 的结果徽标。 */
  readonly lastWait?: { readonly waitReason: string; readonly cancelledByWaitTimeout?: boolean } | undefined
  /** 行内错误（typed 失败 message；不清空滚回）。 */
  readonly error?: string | undefined
}

const IDLE: TerminalConsoleState = { phase: 'probing', backendTypes: [], sessions: [], sending: false }

/** 无 controller 时的稳定 idle 绑定（useSyncExternalStore 源）。 */
export const IDLE_CONSOLE_BINDING: TerminalConsoleControllerBinding = {
  subscribe: () => () => {},
  getSnapshot: () => IDLE,
}

export interface TerminalConsoleControllerBinding {
  subscribe(listener: () => void): () => void
  getSnapshot(): TerminalConsoleState
}

/** 事件驱动重读信号源：调用方在 ConversationSnapshot 变化时触发。 */
export interface ScrollbackRefreshSignal {
  (sessionId: string): void
}

export class TerminalConsoleController {
  private state: TerminalConsoleState = IDLE
  private readonly listeners = new Set<() => void>()
  private disposed = false

  constructor(private readonly remote: TerminalPaneRemoteFace) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getSnapshot = (): TerminalConsoleState => this.state

  dispose(): void {
    this.disposed = true
    this.listeners.clear()
  }

  private patch(next: Partial<TerminalConsoleState>): void {
    this.state = { ...this.state, ...next }
    for (const listener of this.listeners) listener()
  }

  /** 启动探测：能力缺席 → disabled+reason。 */
  async start(): Promise<void> {
    let probe: TerminalPaneProbeResult
    try {
      probe = await this.remote.probe()
    } catch (error) {
      if (this.disposed) return
      this.patch({ phase: 'disabled', disabledReason: `terminalPane remote unreachable: ${error instanceof Error ? error.message : String(error)}` })
      return
    }
    if (this.disposed) return
    if (!probe.ok || !probe.serviceAvailable) {
      this.patch({
        phase: 'disabled',
        disabledReason: probe.ok && probe.reason !== undefined ? probe.reason : 'terminals service unavailable',
        backendTypes: probe.ok ? probe.backendTypes : [],
      })
      return
    }
    this.patch({ phase: 'ready', backendTypes: probe.ok ? probe.backendTypes : [] })
  }

  /** 切换 owner session（并刷新终端列表）。 */
  async selectOwnerSession(sessionId: string): Promise<void> {
    this.patch({ ownerSessionId: sessionId, activeTerminalId: undefined, scrollback: undefined, error: undefined })
    await this.refreshSessions()
  }

  /** 刷新终端列表（事件驱动；不轮询）。 */
  async refreshSessions(): Promise<void> {
    const owner = this.state.ownerSessionId
    if (this.state.phase !== 'ready' || owner === undefined) return
    const result = await this.remote.list(owner)
    if (this.disposed || this.state.ownerSessionId !== owner) return
    if (result.ok) {
      this.patch({ sessions: result.sessions, error: undefined })
      return
    }
    this.patch({ error: `${result.code}: ${result.message}` })
  }

  /** 选择 active 终端并读首页滚回。 */
  async selectTerminal(terminalId: string): Promise<void> {
    this.patch({ activeTerminalId: terminalId, scrollback: undefined, error: undefined })
    await this.refreshScrollback()
  }

  /** 重读 active 终端滚回（事件驱动：视图激活 / ConversationSnapshot 变化）。 */
  async refreshScrollback(): Promise<void> {
    const { ownerSessionId, activeTerminalId } = this.state
    if (this.state.phase !== 'ready' || ownerSessionId === undefined || activeTerminalId === undefined) return
    const result = await this.remote.read({ sessionId: ownerSessionId, terminalId: activeTerminalId })
    if (this.disposed || this.state.activeTerminalId !== activeTerminalId) return
    if (result.ok) {
      this.patch({ scrollback: { text: result.text, totalLines: result.totalLines, lineBegin: result.lineBegin, lineEnd: result.lineEnd, truncated: result.truncated }, error: undefined })
    } else {
      this.patch({ error: `${result.code}: ${result.message}` })
    }
  }

  /** 新建终端（backend type 来自 probe）。 */
  async spawnTerminal(name?: string): Promise<void> {
    const { ownerSessionId, backendTypes, phase } = this.state
    if (phase !== 'ready' || ownerSessionId === undefined) return
    const type = name !== undefined && backendTypes.includes(name) ? name : backendTypes[0]
    if (type === undefined) {
      this.patch({ error: 'backend_missing: no terminal backend registered on the host' })
      return
    }
    const result = await this.remote.spawn({ sessionId: ownerSessionId, type })
    if (this.disposed) return
    if (!result.ok) {
      this.patch({ error: `${result.code}: ${result.message}` })
      return
    }
    await this.refreshSessions()
    await this.selectTerminal(result.terminalId)
    if (result.motd.length > 0 && this.state.scrollback !== undefined) {
      this.patch({ scrollback: { ...this.state.scrollback, text: `${result.motd}${this.state.scrollback.text}` } })
    }
  }

  /** 行式发送（单飞：sending 期间视图锁定输入；已退出终端在客户端侧拒绝）。 */
  async send(text: string, submit: boolean): Promise<void> {
    const { ownerSessionId, activeTerminalId, sending, phase } = this.state
    if (phase !== 'ready' || ownerSessionId === undefined || activeTerminalId === undefined || sending || text.length === 0) return
    if (activeTerminalStatus(this.state)?.kind === 'exited') {
      this.patch({ error: 'terminal_exited: this terminal has exited; open a new terminal to continue' })
      return
    }
    this.patch({ sending: true, error: undefined, lastWait: undefined })
    const result = await this.remote.send({ sessionId: ownerSessionId, terminalId: activeTerminalId, text, submit })
    if (this.disposed) return
    if (result.ok) {
      this.patch({
        sending: false,
        lastWait: {
          waitReason: result.waitReason,
          ...(result.cancelledByWaitTimeout === true ? { cancelledByWaitTimeout: true } : {}),
        },
      })
      await this.refreshScrollback()
    } else {
      this.patch({ sending: false, error: `${result.code}: ${result.message}` })
    }
  }

  /** 前台进程组信号（SIGINT 快捷路径）。 */
  async signal(signal: 'SIGINT' | 'SIGTERM' | 'SIGKILL' | 'SIGTSTP' | 'SIGHUP'): Promise<void> {
    const { ownerSessionId, activeTerminalId, phase } = this.state
    if (phase !== 'ready' || ownerSessionId === undefined || activeTerminalId === undefined) return
    const result = await this.remote.signal({ sessionId: ownerSessionId, terminalId: activeTerminalId, signal })
    if (this.disposed) return
    if (!result.ok) this.patch({ error: `${result.code}: ${result.message}` })
    await this.refreshScrollback()
  }

  /** 关闭终端（列表刷新后 active 清空）。 */
  async closeTerminal(): Promise<void> {
    const { ownerSessionId, activeTerminalId, phase } = this.state
    if (phase !== 'ready' || ownerSessionId === undefined || activeTerminalId === undefined) return
    const result = await this.remote.close({ sessionId: ownerSessionId, terminalId: activeTerminalId })
    if (this.disposed) return
    if (!result.ok) {
      this.patch({ error: `${result.code}: ${result.message}` })
      return
    }
    this.patch({ activeTerminalId: undefined, scrollback: undefined })
    await this.refreshSessions()
  }

  /**
   * 重连：重探测能力并重放列表/滚回。PTY 状态永远在官方 backend；本调用
   * 只同步投影（重连后原终端仍在运行则恢复原选择，已消失则清空选择）。
   */
  async reconnect(): Promise<void> {
    await this.start()
    if (this.state.phase !== 'ready' || this.state.ownerSessionId === undefined) return
    await this.refreshSessions()
    const { activeTerminalId } = this.state
    if (activeTerminalId === undefined) return
    if (!this.state.sessions.some(session => session.terminalId === activeTerminalId)) {
      this.patch({ activeTerminalId: undefined, scrollback: undefined })
      return
    }
    await this.refreshScrollback()
  }
}

/** active 终端的最近已知状态（列表快照推导；缺省 = unknown → 视图不假定）。 */
export function activeTerminalStatus(state: TerminalConsoleState): TerminalPaneSummaryV1['status'] | undefined {
  if (state.activeTerminalId === undefined) return undefined
  return state.sessions.find(session => session.terminalId === state.activeTerminalId)?.status
}

/** React 订阅绑定（stable getSnapshot/subscribe）。 */
export function createConsoleBinding(controller: TerminalConsoleController): TerminalConsoleControllerBinding {
  return { subscribe: controller.subscribe, getSnapshot: controller.getSnapshot }
}
