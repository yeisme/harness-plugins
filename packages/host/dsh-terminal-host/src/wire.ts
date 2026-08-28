/**
 * `terminalPane` Remote 的 wire 合同（Host ↔ Client 共享）。
 *
 * 合同形态：行式终端投影。PTY 进程、注册表与 owner 校验全部留在官方
 * `ctx.terminals`（`@deepseek-ai/dsh-terminal`，DSH ≥ 0.1.1-rc.2）；
 * 本命名空间只做有界、脱敏的浏览器可达投影。出参不携带 cwd、环境变量、
 * 进程参数或任何宿主文件系统细节。
 *
 * @module @yeisme/dsh-terminal-host/wire
 */

/** wire 合同版本。 */
export const TERMINAL_PANE_SPEC_VERSION = '1.0'

/** Remote 命名空间（同时是 Cordis 服务 key）。 */
export const TERMINAL_PANE_REMOTE_SERVICE_KEY = 'terminalPane'

/** Host 插件名（Cordis plugin name）。 */
export const TERMINAL_PANE_HOST_PLUGIN_NAME = 'dsh-terminal-host'

/** 单 owner 名下允许的最大终端数（spawn 硬上限）。 */
export const TERMINAL_PANE_MAX_SESSIONS_PER_OWNER = 8

/** 单次 read 的行数上限。 */
export const TERMINAL_PANE_MAX_READ_LINES = 500

/** 单次 send 的等待上限（毫秒）；超时按官方取消语义中断前台进程组。 */
export const TERMINAL_PANE_MAX_SEND_WAIT_MS = 60_000

export type TerminalPaneSignal = 'SIGINT' | 'SIGTERM' | 'SIGKILL' | 'SIGTSTP' | 'SIGHUP'

/** 官方 `TerminalSessionStatus` 的脱敏投影。 */
export type TerminalPaneStatus =
  | { readonly kind: 'running' }
  | { readonly kind: 'exited'; readonly exitCode: number | null; readonly signal: string | null }

/** 官方 `TerminalWaitReason` 的透传。 */
export type TerminalPaneWaitReason = 'stdin_read' | 'inferred_idle' | 'timeout' | 'session_exit'

/** 终端摘要（`list` 行）。opaque id + 显示元数据 + 状态。 */
export interface TerminalPaneSummaryV1 {
  readonly terminalId: string
  readonly name?: string | undefined
  readonly type: string
  readonly status: TerminalPaneStatus
}

/** typed 失败码（穷举；Client 侧按码呈现，不做字符串猜测）。 */
export type TerminalPaneFailureCode =
  | 'service_unavailable'
  | 'contract_mismatch'
  | 'session_not_live'
  | 'backend_missing'
  | 'name_conflict'
  | 'spawn_rejected'
  | 'too_many'
  | 'terminal_not_found'
  | 'not_owner'
  | 'send_active'
  | 'send_wait_timeout'
  | 'signal_rejected'
  | 'close_failed'
  | 'input_invalid'

export interface TerminalPaneFailureV1 {
  readonly ok: false
  readonly code: TerminalPaneFailureCode
  readonly message: string
}

export function terminalPaneFailure(code: TerminalPaneFailureCode, message: string): TerminalPaneFailureV1 {
  return { ok: false, code, message }
}

export interface TerminalPaneProbeOkV1 {
  readonly ok: true
  readonly specVersion: typeof TERMINAL_PANE_SPEC_VERSION
  readonly serviceAvailable: boolean
  readonly backendTypes: readonly string[]
  /** serviceAvailable=false 时的原因：`terminals_missing` 或缺失方法名列表。 */
  readonly reason?: string | undefined
}

export interface TerminalPaneListOkV1 {
  readonly ok: true
  readonly sessions: readonly TerminalPaneSummaryV1[]
}

export interface TerminalPaneSpawnOkV1 {
  readonly ok: true
  readonly terminalId: string
  readonly name?: string | undefined
  readonly type: string
  /** 创建时捕获的有界初始输出。 */
  readonly motd: string
}

export interface TerminalPaneReadOkV1 {
  readonly ok: true
  readonly text: string
  readonly totalLines: number
  readonly lineBegin: number
  readonly lineEnd: number
  readonly truncated: boolean
}

export interface TerminalPaneSendOkV1 {
  readonly ok: true
  readonly viewport: string
  readonly waitReason: TerminalPaneWaitReason
  readonly sessionStatus: TerminalPaneStatus
  readonly truncated: boolean
  /** 等待触顶后按官方取消语义中断（SIGINT 已发出）。 */
  readonly cancelledByWaitTimeout?: boolean
}

export interface TerminalPaneSignalOkV1 {
  readonly ok: true
  readonly delivered: boolean
}

export interface TerminalPaneCloseOkV1 {
  readonly ok: true
  readonly killed: boolean
}

export type TerminalPaneProbeResult = TerminalPaneProbeOkV1 | TerminalPaneFailureV1
export type TerminalPaneListResult = TerminalPaneListOkV1 | TerminalPaneFailureV1
export type TerminalPaneSpawnResult = TerminalPaneSpawnOkV1 | TerminalPaneFailureV1
export type TerminalPaneReadResult = TerminalPaneReadOkV1 | TerminalPaneFailureV1
export type TerminalPaneSendResult = TerminalPaneSendOkV1 | TerminalPaneFailureV1
export type TerminalPaneSignalResult = TerminalPaneSignalOkV1 | TerminalPaneFailureV1
export type TerminalPaneCloseResult = TerminalPaneCloseOkV1 | TerminalPaneFailureV1

/** spawn 入参。 */
export interface TerminalPaneSpawnInputV1 {
  readonly sessionId: string
  readonly type: string
  readonly name?: string | undefined
}

/** read 入参（offset 自最新保留行起算，与官方语义一致）。 */
export interface TerminalPaneReadInputV1 {
  readonly sessionId: string
  readonly terminalId: string
  readonly offset?: number | undefined
  readonly count?: number | undefined
}

/** send 入参。submit=true 时在文本后补平台 Enter 序列（官方语义）。 */
export interface TerminalPaneSendInputV1 {
  readonly sessionId: string
  readonly terminalId: string
  readonly text: string
  readonly submit: boolean
}

/** signal 入参。 */
export interface TerminalPaneSignalInputV1 {
  readonly sessionId: string
  readonly terminalId: string
  readonly signal: TerminalPaneSignal
}

/** close 入参。 */
export interface TerminalPaneCloseInputV1 {
  readonly sessionId: string
  readonly terminalId: string
}

/** owner session 标识（每个方法的第一参）。 */
export interface TerminalPaneScopeInputV1 {
  readonly sessionId: string
}

const SIGNALS: readonly TerminalPaneSignal[] = ['SIGINT', 'SIGTERM', 'SIGKILL', 'SIGTSTP', 'SIGHUP']

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** scope 校验：sessionId 必须是非空字符串。 */
export function parseScope(value: unknown): TerminalPaneScopeInputV1 | undefined {
  if (!isRecord(value) || typeof value.sessionId !== 'string' || value.sessionId.length === 0) return undefined
  return { sessionId: value.sessionId }
}

/** spawn 入参校验（type 必填，来自 probe 的 backendTypes）。 */
export function parseSpawnInput(value: unknown): TerminalPaneSpawnInputV1 | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.sessionId !== 'string' || value.sessionId.length === 0) return undefined
  if (typeof value.type !== 'string' || value.type.length === 0 || value.type.length > 64) return undefined
  if (value.type.includes('\0')) return undefined
  const name = value.name
  if (name !== undefined && (typeof name !== 'string' || name.length === 0 || name.length > 64)) return undefined
  return { sessionId: value.sessionId, type: value.type, ...(name !== undefined ? { name } : {}) }
}

/** read 入参校验 + 上限裁剪。 */
export function parseReadInput(value: unknown): TerminalPaneReadInputV1 | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.sessionId !== 'string' || value.sessionId.length === 0) return undefined
  if (typeof value.terminalId !== 'string' || value.terminalId.length === 0) return undefined
  const offset = value.offset
  const count = value.count
  if (offset !== undefined && (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0)) return undefined
  if (count !== undefined && (typeof count !== 'number' || !Number.isInteger(count) || count < 1)) return undefined
  return {
    sessionId: value.sessionId,
    terminalId: value.terminalId,
    ...(offset !== undefined ? { offset } : {}),
    ...(count !== undefined ? { count: Math.min(count, TERMINAL_PANE_MAX_READ_LINES) } : {}),
  }
}

/** send 入参校验（文本 ≤ 64KiB，与行式工具入参同量级）。 */
export function parseSendInput(value: unknown): TerminalPaneSendInputV1 | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.sessionId !== 'string' || value.sessionId.length === 0) return undefined
  if (typeof value.terminalId !== 'string' || value.terminalId.length === 0) return undefined
  if (typeof value.text !== 'string' || value.text.length > 65_536) return undefined
  if (typeof value.submit !== 'boolean') return undefined
  return { sessionId: value.sessionId, terminalId: value.terminalId, text: value.text, submit: value.submit }
}

/** signal 入参校验（封闭集）。 */
export function parseSignalInput(value: unknown): TerminalPaneSignalInputV1 | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.sessionId !== 'string' || value.sessionId.length === 0) return undefined
  if (typeof value.terminalId !== 'string' || value.terminalId.length === 0) return undefined
  if (typeof value.signal !== 'string' || !SIGNALS.includes(value.signal as TerminalPaneSignal)) return undefined
  return { sessionId: value.sessionId, terminalId: value.terminalId, signal: value.signal as TerminalPaneSignal }
}

/** close 入参校验。 */
export function parseCloseInput(value: unknown): TerminalPaneCloseInputV1 | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.sessionId !== 'string' || value.sessionId.length === 0) return undefined
  if (typeof value.terminalId !== 'string' || value.terminalId.length === 0) return undefined
  return { sessionId: value.sessionId, terminalId: value.terminalId }
}
