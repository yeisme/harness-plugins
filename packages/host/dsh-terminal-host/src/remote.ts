/**
 * `terminalPane` Typert Remote 服务面。
 *
 * 服务 key（wire namespace）固定为 `terminalPane`，方法
 * `probe/list/spawn/read/send/signal/close`。Remote 层是薄封装：入参 parse、
 * 适配器转发，不持有业务状态——PTY 生命周期与 owner 校验全部在官方
 * `ctx.terminals`。typed 失败原样返回给 Client，绝不自动重试。
 *
 * @module @yeisme/dsh-terminal-host/remote
 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService, remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { TerminalPaneAdapter } from './adapter.ts'
import {
  TERMINAL_PANE_REMOTE_SERVICE_KEY,
  parseCloseInput,
  parseReadInput,
  parseScope,
  parseSendInput,
  parseSignalInput,
  parseSpawnInput,
  terminalPaneFailure,
  type TerminalPaneCloseResult,
  type TerminalPaneListResult,
  type TerminalPaneProbeResult,
  type TerminalPaneReadResult,
  type TerminalPaneSendResult,
  type TerminalPaneSignalResult,
  type TerminalPaneSpawnResult,
} from './wire.ts'

/**
 * 挂在 Cordis 服务表上的 terminalPane Remote 服务。构造即注册
 * （TypertRemoteService 基类负责），随 owner fiber 卸载自动注销。
 */
export class TerminalPaneRemoteService extends TypertRemoteService {
  private adapter: TerminalPaneAdapter

  constructor(ctx: Context, adapter: TerminalPaneAdapter) {
    super(ctx, TERMINAL_PANE_REMOTE_SERVICE_KEY)
    this.adapter = adapter
  }

  /** 官方服务出现/消失时整体替换适配器（旧实例无状态，直接丢弃）。 */
  replaceAdapter(adapter: TerminalPaneAdapter): void {
    this.adapter = adapter
  }

  /** 能力探测（始终 ok；serviceAvailable 由 Client 侧呈现）。 */
  @Remote
  async probe(): Promise<TerminalPaneProbeResult> {
    return this.adapter.probe()
  }

  /** owner 名下终端列表。 */
  @Remote
  async list(input: unknown): Promise<TerminalPaneListResult> {
    const scope = parseScope(input)
    if (scope === undefined) return terminalPaneFailure('input_invalid', 'list requires a non-empty sessionId')
    return this.adapter.list(scope.sessionId)
  }

  /** 新建终端。 */
  @Remote
  async spawn(input: unknown): Promise<TerminalPaneSpawnResult> {
    const parsed = parseSpawnInput(input)
    if (parsed === undefined) return terminalPaneFailure('input_invalid', 'spawn input invalid (sessionId, type required)')
    return this.adapter.spawn(parsed)
  }

  /** 有界滚回分页读。 */
  @Remote
  async read(input: unknown): Promise<TerminalPaneReadResult> {
    const parsed = parseReadInput(input)
    if (parsed === undefined) return terminalPaneFailure('input_invalid', 'read input invalid (sessionId, terminalId required)')
    return this.adapter.read(parsed)
  }

  /** 行式发送（单 send 保留；等待触顶按官方取消语义收敛）。 */
  @Remote
  async send(input: unknown): Promise<TerminalPaneSendResult> {
    const parsed = parseSendInput(input)
    if (parsed === undefined) return terminalPaneFailure('input_invalid', 'send input invalid (sessionId, terminalId, text, submit required)')
    return this.adapter.send(parsed)
  }

  /** 前台进程组信号。 */
  @Remote
  async signal(input: unknown): Promise<TerminalPaneSignalResult> {
    const parsed = parseSignalInput(input)
    if (parsed === undefined) return terminalPaneFailure('input_invalid', 'signal input invalid (closed signal set)')
    return this.adapter.signal(parsed)
  }

  /** 关闭终端。 */
  @Remote
  async close(input: unknown): Promise<TerminalPaneCloseResult> {
    const parsed = parseCloseInput(input)
    if (parsed === undefined) return terminalPaneFailure('input_invalid', 'close input invalid (sessionId, terminalId required)')
    return this.adapter.close(parsed)
  }
}

/** Remote 方法标记快照（诊断/测试用）。 */
export function terminalPaneRemoteMarkers(service: TerminalPaneRemoteService) {
  return remoteMethods(service)
}
