/**
 * @yeisme/dsh-terminal root entry (Host face)。
 *
 * 组合 `@yeisme/dsh-terminal-host`：动态探测官方 `ctx.terminals` /
 * `ctx.agents` 并注册 `terminalPane` Typert Remote（行式终端投影）。
 * PTY 生命周期与 owner 校验全部留在官方服务；浏览器 UI 在 `./client`。
 * 本包同时保留 Workbench Core module 声明与 xterm 面板导出（Tier 2
 * duplex seam 探针路径不变）。
 *
 * @module @yeisme/dsh-terminal
 */

import {
  terminalPaneHostApply as hostApply,
  terminalPaneHostInject as hostInject,
  terminalPaneHostName as hostName,
} from '@yeisme/dsh-terminal-host'

export { terminalModule } from './module.ts'
export { TerminalPanel } from './client/terminal-panel.tsx'
export type { TerminalPanelProps, TerminalPanelState } from './client/terminal-panel.tsx'
export { TerminalConsoleController, IDLE_CONSOLE_BINDING } from './client/console-controller.ts'
export type { TerminalConsoleControllerBinding, TerminalConsolePhase, TerminalConsoleState } from './client/console-controller.ts'
export { TerminalConsoleView } from './client/console-view.tsx'
export type { ConsoleSessionOption } from './client/console-view.tsx'
export { resolveTerminalPaneRemote, terminalPaneRemoteContribution } from './client/console-remote.ts'
export type { TerminalPaneRemoteContribution, TerminalPaneRemoteFace } from './client/console-remote.ts'
export { CONSOLE_NS, consoleEn, consoleZh } from './client/console-locales.ts'

export const name = hostName
export const inject = hostInject
export const apply = hostApply

const DshTerminalPlugin = { name, inject, apply }
export default DshTerminalPlugin
