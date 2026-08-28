/**
 * 官方 `ctx.terminals` / `ctx.agents` 的结构化探测与适配。
 *
 * 上游 `@deepseek-ai/dsh-terminal`（0.1.1-rc.2 起）与 `@deepseek-ai/dsh-agent`
 * 均为未随 0.1.0-rc.x 发布的官方面：本文件不建 npm 依赖，只以本地结构化
 * 类型逐方法探测（与 `ui-session-tags` 消费 `ctx.sessionGroupings` 的
 * capability-probe 手法一致）。形状漂移 → `contract_mismatch`，绝不猜测。
 *
 * PTY 进程永远由官方 backend（`dsh-terminal-bash` 经
 * `ctx.subprocess.spawnTerminal`）创建；本适配器只做 owner 解析与有界投影。
 *
 * @module @yeisme/dsh-terminal-host/adapter
 */

import {
  TERMINAL_PANE_MAX_READ_LINES,
  TERMINAL_PANE_MAX_SEND_WAIT_MS,
  TERMINAL_PANE_MAX_SESSIONS_PER_OWNER,
  terminalPaneFailure,
  type TerminalPaneCloseInputV1,
  type TerminalPaneCloseResult,
  type TerminalPaneFailureCode,
  type TerminalPaneFailureV1,
  type TerminalPaneListResult,
  type TerminalPaneProbeResult,
  type TerminalPaneReadInputV1,
  type TerminalPaneReadResult,
  type TerminalPaneSendInputV1,
  type TerminalPaneSendResult,
  type TerminalPaneSignal,
  type TerminalPaneSignalInputV1,
  type TerminalPaneSignalResult,
  type TerminalPaneSpawnInputV1,
  type TerminalPaneSpawnResult,
  type TerminalPaneStatus,
  type TerminalPaneWaitReason,
} from './wire.ts'

/** 官方 owner（Agent）的不透明引用面：只用于同引用传回官方服务。 */
export type TerminalPaneOwner = object

/** 官方 `TerminalSessionStatus` 的结构化面。 */
type OfficialStatus =
  | { kind: 'running' }
  | { kind: 'exited'; exitCode: number | null; signal: string | null }

interface OfficialSendRead { delta: string; truncated: boolean }

interface OfficialSendResult {
  viewport: string
  waitReason: TerminalPaneWaitReason
  sessionStatus: OfficialStatus
  truncated: boolean
}

interface OfficialSendOperation {
  done: Promise<OfficialSendResult>
  readOutput(): OfficialSendRead
  cancel(): boolean
}

interface OfficialReadResult {
  text: string
  totalLines: number
  lineBegin: number
  lineEnd: number
  truncated: boolean
}

interface OfficialSignalResult { delivered: boolean; targetPgid: number }

interface OfficialSessionSnapshot {
  sessionId: string & { __brand?: never }
  name?: string | undefined
  type: string
  pid?: number | undefined
  status: OfficialStatus
}

interface OfficialSpawnResult extends OfficialSessionSnapshot { motd: string }

/** 官方 `ctx.terminals`（`TerminalSessionService`）的最小结构化面。 */
export interface TerminalsServiceFace {
  listBackends(): readonly string[]
  spawn(owner: TerminalPaneOwner, request: { type: string; name?: string }, signal?: AbortSignal): Promise<OfficialSpawnResult>
  startSend(owner: TerminalPaneOwner, id: string, request: { text: string; submit: boolean; signal?: AbortSignal }): OfficialSendOperation
  read(owner: TerminalPaneOwner, id: string, request: { offset?: number; count?: number }): OfficialReadResult
  signal(owner: TerminalPaneOwner, id: string, signal: TerminalPaneSignal): Promise<OfficialSignalResult>
  kill(owner: TerminalPaneOwner, id: string, reason?: string): Promise<boolean>
  list(owner: TerminalPaneOwner): readonly OfficialSessionSnapshot[]
}

/** 官方 `ctx.agents`（`AgentRegistry`）的最小结构化面。 */
export interface AgentsServiceFace {
  get(sessionId: string): TerminalPaneOwner | undefined
}

const TERMINALS_REQUIRED_METHODS = ['listBackends', 'spawn', 'startSend', 'read', 'signal', 'kill', 'list'] as const

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** 逐方法探测官方 terminals 服务；返回缺失方法名列表（空 = 合同成立）。 */
export function terminalsContractGaps(candidate: unknown): readonly string[] {
  if (!isObject(candidate)) return ['terminals']
  return TERMINALS_REQUIRED_METHODS.filter(method => typeof candidate[method] !== 'function')
}

/** 探测官方 agents 服务。 */
export function isAgentsService(candidate: unknown): candidate is AgentsServiceFace {
  return isObject(candidate) && typeof candidate.get === 'function'
}

function asTerminals(candidate: unknown): TerminalsServiceFace | undefined {
  return terminalsContractGaps(candidate).length === 0 ? (candidate as TerminalsServiceFace) : undefined
}

function isAbortError(error: unknown): boolean {
  return isObject(error) && typeof error.name === 'string' && error.name === 'AbortError'
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/** 官方错误 code → wire 失败码；未知 code 归入操作自身的 typed 失败。 */
function mapOfficialCode(code: string, operation: 'spawn' | 'read' | 'send' | 'signal' | 'close', message: string): TerminalPaneFailureV1 {
  switch (code) {
    case 'NO_SESSION': return terminalPaneFailure('terminal_not_found', message)
    case 'FOREIGN_SESSION': return terminalPaneFailure('not_owner', message)
    case 'OWNER_NOT_LIVE': return terminalPaneFailure('session_not_live', message)
    case 'NO_BACKEND': return terminalPaneFailure('backend_missing', message)
    case 'DUPLICATE_NAME': return terminalPaneFailure('name_conflict', message)
    case 'SEND_ACTIVE': return terminalPaneFailure('send_active', message)
    case 'SERVICE_DISPOSING': return terminalPaneFailure('service_unavailable', message)
    default: {
      const fallback: Record<typeof operation, TerminalPaneFailureCode> = {
        spawn: 'spawn_rejected',
        read: 'terminal_not_found',
        send: 'send_active',
        signal: 'signal_rejected',
        close: 'close_failed',
      }
      return terminalPaneFailure(fallback[operation], `${message} (${code})`)
    }
  }
}

function projectStatus(status: OfficialStatus): TerminalPaneStatus {
  if (status.kind === 'running') return { kind: 'running' }
  return { kind: 'exited', exitCode: status.exitCode, signal: status.signal }
}

function terminalErrorOf(error: unknown, operation: 'spawn' | 'read' | 'send' | 'signal' | 'close'): TerminalPaneFailureV1 {
  const code = isObject(error) ? (error as Record<string, unknown>).code : undefined
  if (typeof code === 'string') {
    return mapOfficialCode(code, operation, errorText(error))
  }
  if (isAbortError(error)) return terminalPaneFailure('send_wait_timeout', 'send wait aborted')
  return terminalPaneFailure(operation === 'close' ? 'close_failed' : 'signal_rejected', errorText(error))
}

/**
 * `terminalPane` 适配核心：持有可能缺席的官方服务引用，所有方法可独立
 * 调用（缺席 → typed service_unavailable / contract_mismatch），无隐藏状态。
 */
export class TerminalPaneAdapter {
  private readonly terminals: TerminalsServiceFace | undefined
  private readonly terminalsGaps: readonly string[]
  private readonly agents: AgentsServiceFace | undefined
  private readonly sendWaitCapMs: number

  constructor(input: { terminals?: unknown; agents?: unknown; sendWaitCapMs?: number }) {
    this.terminalsGaps = terminalsContractGaps(input.terminals)
    this.terminals = this.terminalsGaps.length === 0 ? asTerminals(input.terminals) : undefined
    this.agents = isAgentsService(input.agents) ? input.agents : undefined
    this.sendWaitCapMs = input.sendWaitCapMs ?? TERMINAL_PANE_MAX_SEND_WAIT_MS
  }

  /** 能力探测（Client 侧据此呈现禁用原因）。 */
  probe(): TerminalPaneProbeResult {
    if (this.terminals === undefined) {
      const reason = this.terminalsGaps.length === 1 && this.terminalsGaps[0] === 'terminals'
        ? 'terminals_missing'
        : `missing:${this.terminalsGaps.join(',')}`
      return { ok: true, specVersion: '1.0', serviceAvailable: false, backendTypes: [], reason }
    }
    if (this.agents === undefined) {
      return { ok: true, specVersion: '1.0', serviceAvailable: false, backendTypes: [], reason: 'agents_missing' }
    }
    return { ok: true, specVersion: '1.0', serviceAvailable: true, backendTypes: [...this.terminals.listBackends()] }
  }

  private resolveOwner(sessionId: string): { owner: TerminalPaneOwner } | { failure: TerminalPaneFailureV1 } {
    if (this.terminals === undefined || this.agents === undefined) {
      const probe = this.probe()
      return { failure: terminalPaneFailure('service_unavailable', probe.ok && probe.reason !== undefined ? probe.reason : 'terminals service unavailable') }
    }
    const owner = this.agents.get(sessionId)
    if (owner === undefined) return { failure: terminalPaneFailure('session_not_live', `no live agent for session ${sessionId}`) }
    return { owner }
  }

  /** owner 名下终端列表（脱敏：不带 pid）。 */
  list(sessionId: string): TerminalPaneListResult {
    const resolved = this.resolveOwner(sessionId)
    if ('failure' in resolved) return resolved.failure
    try {
      return {
        ok: true,
        sessions: this.terminals!.list(resolved.owner).map(snapshot => ({
          terminalId: String(snapshot.sessionId),
          ...(snapshot.name !== undefined ? { name: snapshot.name } : {}),
          type: snapshot.type,
          status: projectStatus(snapshot.status),
        })),
      }
    } catch (error) {
      return terminalErrorOf(error, 'read')
    }
  }

  /** 新建终端（owner = 目标 session 的 live agent）。 */
  async spawn(input: TerminalPaneSpawnInputV1): Promise<TerminalPaneSpawnResult> {
    const resolved = this.resolveOwner(input.sessionId)
    if ('failure' in resolved) return resolved.failure
    try {
      if (this.terminals!.list(resolved.owner).length >= TERMINAL_PANE_MAX_SESSIONS_PER_OWNER) {
        return terminalPaneFailure('too_many', `owner already holds ${TERMINAL_PANE_MAX_SESSIONS_PER_OWNER} terminals`)
      }
      const spawned = await this.terminals!.spawn(resolved.owner, { type: input.type, ...(input.name !== undefined ? { name: input.name } : {}) })
      return {
        ok: true,
        terminalId: String(spawned.sessionId),
        ...(spawned.name !== undefined ? { name: spawned.name } : {}),
        type: spawned.type,
        motd: spawned.motd,
      }
    } catch (error) {
      return terminalErrorOf(error, 'spawn')
    }
  }

  /** 有界滚回分页读。 */
  read(input: TerminalPaneReadInputV1): TerminalPaneReadResult {
    const resolved = this.resolveOwner(input.sessionId)
    if ('failure' in resolved) return resolved.failure
    try {
      const page = this.terminals!.read(resolved.owner, input.terminalId, {
        ...(input.offset !== undefined ? { offset: input.offset } : {}),
        ...(input.count !== undefined ? { count: Math.min(input.count, TERMINAL_PANE_MAX_READ_LINES) } : { count: TERMINAL_PANE_MAX_READ_LINES }),
      })
      return { ok: true, text: page.text, totalLines: page.totalLines, lineBegin: page.lineBegin, lineEnd: page.lineEnd, truncated: page.truncated }
    } catch (error) {
      return terminalErrorOf(error, 'read')
    }
  }

  /**
   * 行式发送：启动官方单 send 保留的 operation 并等待 settle。等待触顶
   * （`TERMINAL_PANE_MAX_SEND_WAIT_MS`）时按官方取消语义中断前台进程组
   * （SIGINT），结果如实标注 `cancelledByWaitTimeout`，不遗留 active send。
   */
  async send(input: TerminalPaneSendInputV1): Promise<TerminalPaneSendResult> {
    const resolved = this.resolveOwner(input.sessionId)
    if ('failure' in resolved) return resolved.failure
    let operation: OfficialSendOperation
    try {
      operation = this.terminals!.startSend(resolved.owner, input.terminalId, { text: input.text, submit: input.submit })
    } catch (error) {
      return terminalErrorOf(error, 'send')
    }
    let settled: OfficialSendResult
    let cancelledByWaitTimeout = false
    try {
      settled = await this.raceWithWaitCap(operation.done)
    } catch (error) {
      if (isAbortError(error)) {
        cancelledByWaitTimeout = true
        operation.cancel()
        try {
          settled = await operation.done
        } catch (settledError) {
          return terminalErrorOf(settledError, 'send')
        }
      } else {
        return terminalErrorOf(error, 'send')
      }
    }
    return {
      ok: true,
      viewport: settled.viewport,
      waitReason: settled.waitReason,
      sessionStatus: projectStatus(settled.sessionStatus),
      truncated: settled.truncated,
      ...(cancelledByWaitTimeout ? { cancelledByWaitTimeout: true } : {}),
    }
  }

  /** 等待触顶：以 AbortError 名义 reject，让 send 按取消语义收敛。 */
  private async raceWithWaitCap(done: Promise<OfficialSendResult>): Promise<OfficialSendResult> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const cap = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const timeout = new Error('terminal send wait timeout')
        timeout.name = 'AbortError'
        reject(timeout)
      }, this.sendWaitCapMs)
    })
    try {
      return await Promise.race([done, cap])
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
  }

  /** 前台进程组信号（SIGKILL 对顶层 shell 的官方拒绝如实透传）。 */
  async signal(input: TerminalPaneSignalInputV1): Promise<TerminalPaneSignalResult> {
    const resolved = this.resolveOwner(input.sessionId)
    if ('failure' in resolved) return resolved.failure
    try {
      const result = await this.terminals!.signal(resolved.owner, input.terminalId, input.signal)
      return { ok: true, delivered: result.delivered }
    } catch (error) {
      return terminalErrorOf(error, 'signal')
    }
  }

  /** 关闭终端并等待进程树静默。 */
  async close(input: TerminalPaneCloseInputV1): Promise<TerminalPaneCloseResult> {
    const resolved = this.resolveOwner(input.sessionId)
    if ('failure' in resolved) return resolved.failure
    try {
      const killed = await this.terminals!.kill(resolved.owner, input.terminalId, 'terminalPane request')
      return { ok: true, killed }
    } catch (error) {
      return terminalErrorOf(error, 'close')
    }
  }
}

/** 测试/装配辅助：可注入 send 等待上限（默认官方合同上限）。 */
export function createTerminalPaneAdapter(input: { terminals?: unknown; agents?: unknown; sendWaitCapMs?: number }): TerminalPaneAdapter {
  return new TerminalPaneAdapter(input)
}
