/**
 * Terminal console 视图：行式终端投影的 React 渲染。
 *
 * 结构：ContextBar（owner 选择器 + 状态徽标）→ 终端选择器/新建 →
 * 滚回（等宽、事件驱动重读）→ composer（单飞锁）+ 信号按钮。
 * 能力缺席渲染诚实禁用态；不伪造输出、不渲染伪输入回显。
 *
 * @module @yeisme/dsh-terminal/client/console-view
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import {
  activeTerminalStatus,
  createConsoleBinding,
  IDLE_CONSOLE_BINDING,
  TerminalConsoleController,
  type TerminalConsoleState,
} from './console-controller.ts'
import { interpolate, type ConsoleTranslator } from './console-locales.ts'

/** owner session 选择器的数据源（由 client face 从 ctx.sessions 注入）。 */
export interface ConsoleSessionOption {
  readonly sessionId: string
  readonly displayTitle: string
  readonly running: boolean
}

const CONSOLE_STYLES = `
[data-dsh-terminal-console]{display:flex;flex-direction:column;width:100%;min-height:0;height:100%}
[data-dsh-terminal-console] .tc-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 10px;min-height:34px}
[data-dsh-terminal-console] .tc-bar select,[data-dsh-terminal-console] .tc-bar input{font:inherit;background:var(--vk-bg-base);color:inherit;border:1px solid var(--vk-border-l2);border-radius:8px;padding:4px 8px;min-width:0}
[data-dsh-terminal-console] .tc-bar .tc-owner{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-dsh-terminal-console] .tc-badge{font-size:12px;color:var(--vk-text-muted)}
[data-dsh-terminal-console] .tc-error{margin-left:auto;color:var(--vk-state-error);font-size:12px;max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-dsh-terminal-console] .tc-scroll{flex:1;min-height:120px;margin:0 10px;overflow:auto;padding:12px;background:#101012;color:#d6d6dc;border:1px solid var(--vk-border-l2);border-radius:12px;font-family:var(--ds-font-family-code,"SF Mono","JetBrains Mono",monospace);font-size:13px;line-height:1.45;white-space:pre;user-select:text}
[data-dsh-terminal-console] .tc-meta{display:flex;gap:10px;padding:2px 10px;font-size:12px;color:var(--vk-text-muted)}
[data-dsh-terminal-console] .tc-composer{display:flex;gap:6px;padding:8px 10px 10px}
[data-dsh-terminal-console] .tc-composer input{flex:1;font-family:var(--ds-font-family-code,"SF Mono","JetBrains Mono",monospace)}
[data-dsh-terminal-console] button:focus-visible,[data-dsh-terminal-console] select:focus-visible,[data-dsh-terminal-console] input:focus-visible{outline:2px solid var(--vk-focus-ring);outline-offset:1px}
`

function WaitBadge({ wait, t }: { readonly wait: { readonly waitReason: string; readonly cancelledByWaitTimeout?: boolean } | undefined; readonly t: ConsoleTranslator }): ReactNode {
  if (wait === undefined) return null
  const key = wait.waitReason === 'stdin_read' || wait.waitReason === 'inferred_idle' || wait.waitReason === 'timeout' || wait.waitReason === 'session_exit'
    ? (`wait.${wait.waitReason}` as const)
    : null
  const text = key === null ? wait.waitReason : t(key)
  return <span className="tc-badge" data-terminal-wait={wait.waitReason}>
    {text}
    {wait.cancelledByWaitTimeout === true ? ` · ${t('wait.cancelledByTimeout')}` : ''}
  </span>
}

/** 已退出终端的紧凑退出标注（exit code / signal）。 */
function exitLabel(status: { readonly kind: 'exited'; readonly exitCode: number | null; readonly signal: string | null }, t: ConsoleTranslator): string {
  return status.signal !== null
    ? interpolate(t('terminal.exited.signal'), { signal: status.signal })
    : interpolate(t('terminal.exited.code'), { code: status.exitCode ?? 'unknown' })
}

function ExitBadge({ status, t }: { readonly status: { readonly kind: 'exited'; readonly exitCode: number | null; readonly signal: string | null }; readonly t: ConsoleTranslator }): ReactNode {
  return <span className="tc-badge" data-terminal-exited>{exitLabel(status, t)}</span>
}

/** Console 主视图（controller + 数据源由 client face 注入）。 */
export function TerminalConsoleView({ controller, sessions, currentSessionId, t, onRefreshSignal, onOwnerSessionChange }: {
  readonly controller: TerminalConsoleController | undefined
  readonly sessions: readonly ConsoleSessionOption[]
  readonly currentSessionId: string | undefined
  readonly t: ConsoleTranslator
  /** ConversationSnapshot 变化信号（事件驱动重读滚回与列表）。 */
  readonly onRefreshSignal: (listener: (sessionId: string) => void) => () => void
  /** owner session 切换通知（client face 重建 ConversationSnapshot 订阅）。 */
  readonly onOwnerSessionChange?: (sessionId: string) => void
}): ReactNode {
  const binding = controller === undefined ? IDLE_CONSOLE_BINDING : createConsoleBinding(controller)
  const state = useSyncExternalStore(
    useCallback((listener: () => void) => binding.subscribe(listener), [binding]),
    useCallback(() => binding.getSnapshot(), [binding]),
  )
  const [draft, setDraft] = useState('')
  const [submit, setSubmit] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  // owner 缺省跟随 current session（一次同步；之后由用户显式切换）。
  useEffect(() => {
    if (state.ownerSessionId === undefined && currentSessionId !== undefined && controller !== undefined && state.phase === 'ready') {
      void controller.selectOwnerSession(currentSessionId)
    }
  }, [controller, state.ownerSessionId, currentSessionId, state.phase])

  // owner 切换通知（client face 重建事件驱动订阅）。
  useEffect(() => {
    if (state.ownerSessionId !== undefined) onOwnerSessionChange?.(state.ownerSessionId)
  }, [onOwnerSessionChange, state.ownerSessionId])

  // 事件驱动重读：绑定 session 的对话快照变化（工具调用完成等）触发。
  useEffect(() => onRefreshSignal(sessionId => {
    if (state.ownerSessionId === sessionId && controller !== undefined) {
      void controller.refreshScrollback()
      void controller.refreshSessions()
    }
  }), [onRefreshSignal, state.ownerSessionId, controller])

  // 滚回贴底。
  useEffect(() => {
    const node = scrollRef.current
    if (node !== null) node.scrollTop = node.scrollHeight
  }, [state.scrollback?.text])

  if (state.phase === 'probing') {
    return <Surface kind="workspace" aria-label="Terminal" data-dsh-terminal-console data-terminal-state="probing">
      <style data-dsh-terminal-console-styles>{CONSOLE_STYLES}</style>
      <SurfaceContextBar title={t('title')} />
      <div className="ys-body"><SurfaceState phase="loading" title={t('title')} /></div>
    </Surface>
  }

  if (state.phase === 'disabled') {
    const reason = state.disabledReason ?? t('disabled.unreachable')
    return <Surface kind="workspace" aria-label="Terminal" data-dsh-terminal-console data-terminal-state="disabled">
      <style data-dsh-terminal-console-styles>{CONSOLE_STYLES}</style>
      <SurfaceContextBar title={t('title')} />
      <div className="ys-body"><SurfaceState phase="disabled" title={interpolate(t('disabled.reason'), { reason })} data-terminal-console-unavailable /></div>
    </Surface>
  }

  const options = sessions.length > 0 ? sessions : (currentSessionId !== undefined ? [{ sessionId: currentSessionId, displayTitle: currentSessionId, running: true }] : [])
  if (controller === undefined) {
    // 解析期（probing 渲染已由上方分支覆盖，此处兜底不可能到达）。
    return null
  }
  const activeStatus = activeTerminalStatus(state)
  const exited = activeStatus?.kind === 'exited' ? activeStatus : undefined
  const composerLocked = state.activeTerminalId === undefined || state.sending || exited !== undefined
  const onSend = (): void => {
    const text = draft
    if (text.length === 0) return
    setDraft('')
    void controller.send(text, submit)
  }

  return <Surface kind="workspace" aria-label="Terminal" data-dsh-terminal-console data-terminal-state="ready">
    <style data-dsh-terminal-console-styles>{CONSOLE_STYLES}</style>
    <SurfaceContextBar title={t('title')} status={<>
      {exited !== undefined ? <ExitBadge status={exited} t={t} /> : null}
      <WaitBadge wait={state.lastWait} t={t} />
    </>} />
    <div className="tc-bar">
      <label className="tc-badge" htmlFor="tc-owner-select">{t('owner.label')}</label>
      <select
        id="tc-owner-select"
        className="tc-owner"
        value={state.ownerSessionId ?? ''}
        onChange={event => { void controller.selectOwnerSession(event.target.value) }}
        data-terminal-owner-select
      >
        {options.map(option => <option key={option.sessionId} value={option.sessionId}>{option.displayTitle}</option>)}
      </select>
      <select
        aria-label={t('title')}
        value={state.activeTerminalId ?? ''}
        onChange={event => { void controller.selectTerminal(event.target.value) }}
        data-terminal-select
      >
        {state.sessions.length === 0 ? <option value="">{t('terminal.none')}</option> : null}
        {state.sessions.map(session => {
          const label = session.name !== undefined ? `${session.name} · ${session.type}` : session.type
          const status = session.status.kind === 'running' ? '' : ` (${exitLabel(session.status, t)})`
          return <option key={session.terminalId} value={session.terminalId}>{`${label}${status}`}</option>
        })}
      </select>
      <Button type="button" size="sm" variant="toolbar" onClick={() => { void controller.spawnTerminal() }} data-terminal-new>{t('terminal.new')}</Button>
      <Button type="button" size="sm" variant="toolbar" onClick={() => { void controller.reconnect() }} data-terminal-reconnect>{t('reconnect')}</Button>
      {state.activeTerminalId !== undefined
        ? <>
            <Button type="button" size="sm" variant="toolbar" disabled={exited !== undefined} onClick={() => { void controller.signal('SIGINT') }} data-terminal-sigint>{t('signal.sigint')}</Button>
            <Button type="button" size="sm" variant="toolbar" onClick={() => { void controller.closeTerminal() }} data-terminal-close>{t('terminal.close')}</Button>
          </>
        : null}
      {state.error !== undefined ? <span role="alert" className="tc-error" data-terminal-error>{state.error}</span> : null}
    </div>
    <div ref={scrollRef} className="tc-scroll" aria-live="polite" data-terminal-scrollback>
      {state.scrollback === undefined || state.scrollback.text.length === 0 ? t('scrollback.empty') : state.scrollback.text}
    </div>
    {state.scrollback !== undefined
      ? <div className="tc-meta">
          <span>{interpolate(t('scrollback.lines'), { begin: state.scrollback.lineBegin, end: state.scrollback.lineEnd, total: state.scrollback.totalLines })}</span>
          {state.scrollback.truncated ? <span>{t('scrollback.truncated')}</span> : null}
        </div>
      : null}
    {exited !== undefined ? <div className="tc-meta" data-terminal-exited-hint>{t('terminal.exited.hint')}</div> : null}
    <div className="tc-composer">
      <input
        value={draft}
        placeholder={t('composer.placeholder')}
        disabled={composerLocked}
        onChange={event => { setDraft(event.target.value) }}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            onSend()
          }
        }}
        data-terminal-input
        aria-label={t('composer.placeholder')}
      />
      <label className="tc-badge">
        <input type="checkbox" checked={submit} onChange={event => { setSubmit(event.target.checked) }} data-terminal-submit />
        {t('composer.submit')}
      </label>
      <Button type="button" size="sm" variant="toolbar" disabled={composerLocked || draft.length === 0} onClick={onSend} data-terminal-send>
        {state.sending ? t('composer.sending') : t('composer.send')}
      </Button>
    </div>
  </Surface>
}

export type { TerminalConsoleState }
