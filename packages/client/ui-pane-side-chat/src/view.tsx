/**
 * Side chat 视图：侧边对话的 React 渲染。
 *
 * 结构：ContextBar（session picker + 新建/fork/detach）→ 消息流（有界投影：
 * 用户/助手文本、折叠工具卡、错误节点）→ composer（steer/queue、cancel）。
 * 未附着渲染空态说明；session removed 渲染已移除态并禁用输入。
 *
 * @module @yeisme/dsh-client-ui-pane-side-chat/view
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import {
  SideChatController,
  type SideChatNodeLike,
  type SideChatSessionBinding,
} from './controller.ts'
import { interpolate, type SideChatTranslator } from './locales.ts'

/** 有界文本摘要（渲染层只展示有界内容，不整段倾倒）。 */
function boundText(text: string | undefined, limit: number): string {
  if (text === undefined) return ''
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function textOfContent(content: ReadonlyArray<{ type?: string; text?: string }> | undefined): string {
  if (content === undefined) return ''
  return content.filter(part => part.type === 'text').map(part => part.text ?? '').join('\n').trim()
}

/** 单条消息行（折叠工具卡；assistant 文本块；错误节点）。 */
function MessageRow({ node, t }: { readonly node: SideChatNodeLike; readonly t: SideChatTranslator }): ReactNode {
  if (node.kind === 'user') {
    return <div className="sc-row sc-user" data-side-chat-node="user">{boundText(textOfContent(node.content), 4_000)}</div>
  }
  if (node.kind === 'assistant') {
    const blocks = node.blocks ?? []
    const text = blocks.filter(block => block.kind === 'text').map(block => block.text ?? '').join('\n').trim()
    const tools = blocks.filter(block => block.kind === 'tool-call')
    return <div className="sc-row sc-assistant" data-side-chat-node="assistant">
      {text.length > 0 ? boundText(text, 8_000) : null}
      {tools.length > 0
        ? <details className="sc-tools" data-side-chat-tools={tools.length}>
            <summary>{interpolate(t('queue.count'), { count: tools.length })} · {interpolate(t('node.tool'), { name: tools[0]?.name ?? '' })}</summary>
            {tools.map((block, index) => <div key={index} className="sc-tool-line">{interpolate(t('node.tool'), { name: block.name ?? '?' })}</div>)}
          </details>
        : null}
    </div>
  }
  if (node.kind === 'turn-error' || node.kind === 'turn-max-tokens') {
    return <div className="sc-row sc-error" role="alert" data-side-chat-node={node.kind}>{t('node.error')}</div>
  }
  if (node.kind === 'tool-result' || node.kind === 'command') {
    return <div className="sc-row sc-tool" data-side-chat-node={node.kind}>{interpolate(t('node.tool'), { name: node.kind })}</div>
  }
  return <div className="sc-row sc-unknown" data-side-chat-node={node.kind}>{interpolate(t('node.unknown'), { kind: node.kind })}</div>
}

/** stable 空快照（未附着时 useSyncExternalStore 的退化订阅源）。 */
const ABSENT_SESSION = { subscribe: (_listener: () => void) => () => {}, getSnapshot: () => null } as const

export function SideChatView({ controller, sessions, currentSessionId, t }: {
  readonly controller: SideChatController
  /** picker 数据源（client face 从 ctx.sessions.list 注入）。 */
  readonly sessions: readonly { sessionId: string; displayTitle: string; running: boolean }[]
  readonly currentSessionId: string | undefined
  readonly t: SideChatTranslator
}): ReactNode {
  // G21 dispose 收口：useSyncExternalStore 在卸载时调用 subscribe 返回的退订函数；
  // 订阅句柄经 useMemo 稳定（.bind 显式携带 this），释放由 React 完成。
  const subscribeController = useMemo(() => controller.subscribe.bind(controller), [controller])
  const state = useSyncExternalStore(
    subscribeController,
    useCallback(() => controller.getSnapshot(), [controller]),
  )
  const sessionBinding = useMemo<SideChatSessionBinding['session'] | undefined>(
    () => controller.getSession(),
    [controller, state.sessionId],
  )
  const sessionSource = sessionBinding ?? ABSENT_SESSION
  const subscribeSession = useMemo(() => sessionSource.subscribe.bind(sessionSource), [sessionSource])
  const session = useSyncExternalStore(
    subscribeSession,
    useCallback(() => sessionBinding?.getSnapshot() ?? null, [sessionBinding]),
  )
  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState<'auto' | 'queue'>('auto')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = listRef.current
    if (node !== null) node.scrollTop = node.scrollHeight
  }, [session?.nodes.length])

  const removed = session?.removed === true
  const running = session?.running === true

  const onSend = (): void => {
    const text = draft
    if (text.length === 0 || removed) return
    setDraft('')
    void controller.send(text, mode)
  }

  return <Surface kind="workspace" aria-label={t('title')} data-dsh-side-chat data-side-chat-phase={state.phase}>
    <style data-dsh-side-chat-styles>{SIDE_CHAT_STYLES}</style>
    <SurfaceContextBar
      title={t('title')}
      status={session !== null && session.queue.length > 0
        ? <span className="sc-badge" data-side-chat-queue={session.queue.length}>{interpolate(t('queue.count'), { count: session.queue.length })}</span>
        : undefined}
    />
    <div className="sc-bar">
      <label className="sc-badge" htmlFor="sc-session-select">{t('picker.label')}</label>
      <select
        id="sc-session-select"
        className="sc-session"
        value={state.sessionId ?? ''}
        onChange={event => { controller.attach(event.target.value) }}
        data-side-chat-picker
      >
        <option value="">{t('picker.placeholder')}</option>
        {sessions.map(option => <option key={option.sessionId} value={option.sessionId}>{option.displayTitle}</option>)}
      </select>
      <Button
        type="button"
        size="sm"
        variant="toolbar"
        disabled={!state.createAvailable || state.starting}
        title={state.createAvailable ? t('action.new') : t('action.new.unavailable')}
        onClick={() => { void controller.startNew() }}
        data-side-chat-new
      >{t('action.new')}</Button>
      <Button
        type="button"
        size="sm"
        variant="toolbar"
        disabled={currentSessionId === undefined || state.starting}
        title={t('action.fork')}
        onClick={() => { if (currentSessionId !== undefined) void controller.forkFrom(currentSessionId) }}
        data-side-chat-fork
      >{t('action.fork')}</Button>
      {state.sessionId !== undefined
        ? <Button type="button" size="sm" variant="toolbar" onClick={() => { controller.detach() }} data-side-chat-detach>{t('action.detach')}</Button>
        : null}
      {state.error !== undefined ? <span role="alert" className="sc-error-inline" data-side-chat-error>{state.error}</span> : null}
    </div>
    {state.phase === 'unresolvable'
      ? <div className="ys-body"><SurfaceState phase="error" title={t('state.unresolvable')} data-side-chat-unresolvable /></div>
      : session === null
        ? <div className="ys-body"><SurfaceState phase="empty" title={t('title')} description={t('empty.body')} data-side-chat-empty /></div>
        : removed
          ? <div className="ys-body"><SurfaceState phase="empty" title={t('state.removed')} data-side-chat-removed /></div>
          : <>
              <div ref={listRef} className="sc-list" data-side-chat-nodes={session.nodes.length}>
                {session.hasMore
                  ? <Button type="button" size="sm" variant="toolbar" className="sc-older" disabled={session.loadingOlder} onClick={() => { void controller.loadOlder() }} data-side-chat-older>
                      {session.loadingOlder ? t('action.older.loading') : t('action.older')}
                    </Button>
                  : null}
                {session.nodes.map(node => <MessageRow key={`${node.seq}-${node.kind}`} node={node} t={t} />)}
                {state.promptError !== undefined
                  ? <div className="sc-row sc-error" role="alert" data-side-chat-prompt-error>{state.promptError}</div>
                  : null}
              </div>
              <div className="sc-composer">
                {running
                  ? <span className="sc-badge" data-side-chat-mode-hint>{mode === 'auto' ? t('composer.steer') : t('composer.queue')}</span>
                  : null}
                {running
                  ? <Button type="button" size="sm" variant="toolbar" onClick={() => { void controller.cancel() }} data-side-chat-cancel>{t('action.cancel')}</Button>
                  : null}
                {running
                  ? <label className="sc-badge"><input type="checkbox" checked={mode === 'queue'} onChange={event => { setMode(event.target.checked ? 'queue' : 'auto') }} data-side-chat-queue-toggle />{t('composer.queue')}</label>
                  : null}
                <input
                  value={draft}
                  placeholder={t('composer.placeholder')}
                  onChange={event => { setDraft(event.target.value) }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      onSend()
                    }
                  }}
                  data-side-chat-input
                  aria-label={t('composer.placeholder')}
                />
                <Button type="button" size="sm" variant="toolbar" disabled={draft.length === 0 || state.sending || removed} onClick={onSend} data-side-chat-send>
                  {state.sending ? t('composer.sending') : t('composer.send')}
                </Button>
              </div>
            </>}
  </Surface>
}

const SIDE_CHAT_STYLES = `
[data-dsh-side-chat]{display:flex;flex-direction:column;width:100%;min-height:0;height:100%}
[data-dsh-side-chat] .sc-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 10px;min-height:34px}
[data-dsh-side-chat] .sc-bar select,[data-dsh-side-chat] .sc-composer input{font:inherit;background:var(--vk-bg-base);color:inherit;border:1px solid var(--vk-border-l2);border-radius:8px;padding:4px 8px;min-width:0}
[data-dsh-side-chat] .sc-session{max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-dsh-side-chat] .sc-badge{font-size:12px;color:var(--vk-text-tertiary)}
[data-dsh-side-chat] .sc-error-inline{margin-left:auto;color:var(--vk-state-error);font-size:12px;max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-dsh-side-chat] .sc-list{flex:1;min-height:120px;margin:0 10px;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px;border:1px solid var(--vk-border-l2);border-radius:12px;background:var(--vk-bg-layer-1)}
[data-dsh-side-chat] .sc-row{padding:8px 10px;border-radius:10px;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
[data-dsh-side-chat] .sc-user{background:var(--vk-fill-selected);align-self:flex-end;max-width:88%}
[data-dsh-side-chat] .sc-assistant{background:var(--vk-bg-layer-2);align-self:flex-start;max-width:95%}
[data-dsh-side-chat] .sc-tool,[data-dsh-side-chat] .sc-unknown{background:transparent;color:var(--vk-text-tertiary);font-size:12px;padding:2px 10px;align-self:flex-start}
[data-dsh-side-chat] .sc-error{background:color-mix(in srgb,var(--vk-state-error) 12%,transparent);color:var(--vk-state-error);align-self:stretch}
[data-dsh-side-chat] .sc-tools{margin-top:6px;font-size:12px;color:var(--vk-text-tertiary)}
[data-dsh-side-chat] .sc-tools summary{cursor:pointer}
[data-dsh-side-chat] .sc-tool-line{padding-left:12px}
[data-dsh-side-chat] .sc-composer{display:flex;gap:6px;align-items:center;padding:8px 10px 10px}
[data-dsh-side-chat] .sc-composer input{flex:1}
[data-dsh-side-chat] button:focus-visible,[data-dsh-side-chat] select:focus-visible,[data-dsh-side-chat] input:focus-visible{outline:2px solid var(--vk-focus-ring);outline-offset:1px}
`
