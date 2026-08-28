/**
 * Terminal console 的 locale 表（zh/en）。
 *
 * 经官方 `locale.register(ns, tables)` 注册；无 locale 服务时回退 en。
 *
 * @module @yeisme/dsh-terminal/client/console-locales
 */

export const CONSOLE_NS = 'yeisme.dsh-terminal.console'

export type ConsoleKey =
  | 'title'
  | 'disabled.unreachable'
  | 'disabled.reason'
  | 'owner.label'
  | 'terminal.none'
  | 'terminal.new'
  | 'terminal.close'
  | 'terminal.exited.code'
  | 'terminal.exited.signal'
  | 'terminal.exited.hint'
  | 'signal.sigint'
  | 'reconnect'
  | 'composer.placeholder'
  | 'composer.send'
  | 'composer.sending'
  | 'composer.submit'
  | 'wait.stdin_read'
  | 'wait.inferred_idle'
  | 'wait.timeout'
  | 'wait.session_exit'
  | 'wait.cancelledByTimeout'
  | 'scrollback.empty'
  | 'scrollback.truncated'
  | 'scrollback.lines'

export const consoleEn: Readonly<Record<ConsoleKey, string>> = {
  'title': 'Terminal',
  'disabled.unreachable': 'terminalPane remote is unreachable on this host.',
  'disabled.reason': 'Terminals are unavailable: {reason}. This needs a DSH build with the terminals capability (0.1.1-rc.2+).',
  'owner.label': 'Owner session',
  'terminal.none': 'No terminal yet. Open one to start a persistent PTY owned by this session.',
  'terminal.new': 'New terminal',
  'terminal.close': 'Close terminal',
  'terminal.exited.code': 'exited (code {code})',
  'terminal.exited.signal': 'killed by {signal}',
  'terminal.exited.hint': 'This terminal has exited; its scrollback stays readable. Open a new terminal to continue.',
  'signal.sigint': 'Interrupt (SIGINT)',
  'reconnect': 'Reconnect terminal',
  'composer.placeholder': 'Send a line to the terminal…',
  'composer.send': 'Send',
  'composer.sending': 'Running…',
  'composer.submit': 'Press Enter after the text',
  'wait.stdin_read': 'waiting for input',
  'wait.inferred_idle': 'idle',
  'wait.timeout': 'timed out',
  'wait.session_exit': 'terminal exited',
  'wait.cancelledByTimeout': 'interrupted after the wait cap',
  'scrollback.empty': 'No scrollback retained for this terminal yet.',
  'scrollback.truncated': 'Older output was dropped (retention bound).',
  'scrollback.lines': '{begin}–{end} of {total} lines',
}

export const consoleZh: Readonly<Record<ConsoleKey, string>> = {
  'title': '终端',
  'disabled.unreachable': '当前宿主无法到达 terminalPane Remote。',
  'disabled.reason': '终端不可用：{reason}。需要带 terminals 能力的 DSH（0.1.1-rc.2 及以上）。',
  'owner.label': '归属会话',
  'terminal.none': '还没有终端。新建一个即可开启由该会话持有的持久 PTY。',
  'terminal.new': '新建终端',
  'terminal.close': '关闭终端',
  'terminal.exited.code': '已退出（码 {code}）',
  'terminal.exited.signal': '被 {signal} 终止',
  'terminal.exited.hint': '该终端已退出；滚回仍可查看。新建终端以继续。',
  'signal.sigint': '中断（SIGINT）',
  'reconnect': '重连终端',
  'composer.placeholder': '向终端发送一行…',
  'composer.send': '发送',
  'composer.sending': '运行中…',
  'composer.submit': '文本后补回车',
  'wait.stdin_read': '等待输入',
  'wait.inferred_idle': '空闲',
  'wait.timeout': '等待超时',
  'wait.session_exit': '终端已退出',
  'wait.cancelledByTimeout': '等待触顶后已中断',
  'scrollback.empty': '该终端暂无保留的滚回输出。',
  'scrollback.truncated': '更早的输出已被丢弃（保留上限）。',
  'scrollback.lines': '第 {begin}–{end} 行，共 {total} 行',
}

export type ConsoleTranslator = (key: ConsoleKey, params?: Readonly<Record<string, string | number>>) => string

/** 无 locale 服务时的回退翻译器（支持 {param} 插值）。 */
export function fallbackConsoleTranslator(): ConsoleTranslator {
  return (key, params) => interpolate(consoleEn[key], params)
}

export function interpolate(template: string, params?: Readonly<Record<string, string | number>>): string {
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (
    name in params ? String(params[name]) : match
  ))
}
