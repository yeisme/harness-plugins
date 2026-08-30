/**
 * Terminal Pane backed by an owner-authorized xterm attachment.
 *
 * DSH owns the PTY and control lease. This component owns only the browser
 * renderer, input event forwarding, resize observation, and symmetric detach.
 * When the V2 attachment is unavailable it renders an honest connection state.
 *
 * @module @yeisme/dsh-terminal/client
 */

import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import { openTerminalLink } from './link-policy.ts'
import type { TerminalAttachmentV2, TerminalHostV2 } from '@yeisme/dsh-terminal-host'

export type TerminalPanelState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'exited'

export interface TerminalPanelProps {
  /** Safe terminal state projection from the owning DSH terminal seam. */
  state?: TerminalPanelState | undefined
  /** Optional short status text, for example exit code or session id. */
  status?: string | undefined
  /** Optional V2 host attachment. PTY state remains owned by DSH. */
  host?: TerminalHostV2 | undefined
  /** Opaque terminal id to attach when `host` exposes the interactive seam. */
  terminalId?: string | undefined
  /** V3 6.6: open a NEW PTY session as its own pane view. */
  readonly onNewSession?: (() => void) | undefined
  /** V3 6.6: rename this view's title (same resource key, new title). */
  readonly onRename?: ((title: string) => void) | undefined
}

const terminalStyles = `
[data-dsh-terminal-panel]{width:100%;min-height:100%}
[data-dsh-terminal-panel] .dt-interactive{min-width:0}
[data-dsh-terminal-panel] .dt-surface-toolbar{display:flex;justify-content:flex-end;gap:6px;min-height:30px;margin-bottom:6px}
[data-dsh-terminal-panel] .dt-error{margin-right:auto;color:var(--vk-state-error)}
[data-dsh-terminal-panel] .dt-lease{margin-right:auto;font-size:12px;color:var(--vk-state-warn)}
[data-dsh-terminal-panel] .dt-find{display:inline-flex;gap:4px;align-items:center}
[data-dsh-terminal-panel] .dt-find input{min-height:24px;padding:0 6px;border:1px solid var(--vk-border-l2);border-radius:6px;background:var(--vk-bg-layer-1);color:inherit;font:inherit}
[data-dsh-terminal-panel] [data-terminal-surface]{min-height:320px;overflow:hidden;padding:12px;background:var(--vk-bg-base);border:1px solid var(--vk-border-l2);border-radius:12px}
[data-dsh-terminal-panel] [data-terminal-surface] { position: relative; }
[data-dsh-terminal-panel] [data-terminal-surface] .xterm { position: relative; height: 100%; min-height: 292px; padding: 2px; user-select: none; }
[data-dsh-terminal-panel] [data-terminal-surface] .xterm-helpers { position: absolute; top: 0; z-index: 5; }
[data-dsh-terminal-panel] [data-terminal-surface] .xterm-helper-textarea { position: absolute; top: 0; left: -9999em; width: 0; height: 0; opacity: 0; z-index: -5; overflow: hidden; resize: none; white-space: nowrap; }
[data-dsh-terminal-panel] [data-terminal-surface] .xterm-viewport { position: absolute; inset: 0; overflow-y: auto; background: transparent; cursor: default; }
[data-dsh-terminal-panel] [data-terminal-surface] .xterm-screen { position: relative; min-height: 292px; }
[data-dsh-terminal-panel] [data-terminal-surface] .xterm-rows { position: absolute; left: 0; top: 0; }
[data-dsh-terminal-panel] button:focus-visible { outline: 2px solid var(--vk-focus-ring); outline-offset: 1px; }
`

const STATE_TEXT: Record<TerminalPanelState, string> = {
  disconnected: '未连接',
  connecting: '连接中…',
  connected: '已连接',
  reconnecting: '重连中…',
  exited: '已退出',
}

function disposeXtermDisposable(value: { dispose(): void } | undefined): void {
  value?.dispose()
}

function InteractiveTerminal({ host, terminalId, onNewSession, onRename }: { readonly host: TerminalHostV2; readonly terminalId: string; readonly onNewSession?: (() => void) | undefined; readonly onRename?: ((title: string) => void) | undefined }) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const fitRef = useRef<{ fit(): void }>()
  const searchRef = useRef<{ findNext(term: string): boolean; findPrevious(term: string): boolean }>()
  const serializeRef = useRef<{ serialize(): string }>()
  const terminalRef = useRef<{ clear(): void }>()
  const attachmentControlRequestRef = useRef<(() => Promise<{ readonly status: 'ok' | 'denied' | 'busy' } | undefined>) | undefined>()
  const onDetachRef = useRef<(() => Promise<void>) | undefined>()
  const onKillRef = useRef<(() => Promise<unknown>) | undefined>()
  const onPasteRef = useRef<((data: string) => Promise<unknown>) | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [ready, setReady] = useState(false)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const [lease, setLease] = useState<'granted' | 'pending' | 'denied' | undefined>()
  const [findOpen, setFindOpen] = useState(false)
  const [findTerm, setFindTerm] = useState('')

  useEffect(() => {
    const surface = surfaceRef.current
    if (surface === null) return
    setReady(false)
    setError(undefined)
    const abort = new AbortController()
    let disposed = false
    let terminal: import('@xterm/xterm').Terminal | undefined
    let attachment: TerminalAttachmentV2 | undefined
    let outputDispose: (() => void) | undefined
    let inputDispose: { dispose(): void } | undefined
    let resizeDispose: { dispose(): void } | undefined
    let observer: ResizeObserver | undefined
    let leaseDispose: (() => void) | undefined
    let pendingFrame = 0
    let lastSequence = -1

    void (async () => {
      try {
        const [{ Terminal }, { FitAddon }, { SearchAddon }, { WebLinksAddon }, { Unicode11Addon }, nextAttachment] = await Promise.all([
          import('@xterm/xterm'),
          import('@xterm/addon-fit'),
          import('@xterm/addon-search'),
          import('@xterm/addon-web-links'),
          import('@xterm/addon-unicode11'),
          host.attachTerminal(terminalId, { cols: 80, rows: 24, signal: abort.signal }),
        ])
        if (disposed) {
          await nextAttachment.detach()
          return
        }
        attachment = nextAttachment
        terminal = new Terminal({
          convertEol: true,
          cursorBlink: true,
          fontSize: 13,
          fontFamily: 'var(--ds-font-family-code, "SF Mono", "JetBrains Mono", monospace)',
          scrollback: 5_000,
          theme: {
            background: '#101012',
            foreground: '#d6d6dc',
            cursor: '#79b8ff',
            selectionBackground: 'rgba(121,168,255,.3)',
          },
        })
        terminal.open(surface)
        const fit = new FitAddon()
        fitRef.current = fit
        terminal.loadAddon(fit)
        // V3 6.2 addon set: search/web-links/unicode11 are core; serialize is
        // loaded on demand by later close/clipboard slices. WebGL stays an
        // OPTIONAL lazy import — context loss or an unsupported GPU falls back
        // to the DOM renderer without restarting the PTY.
        const search = new SearchAddon()
        terminal.loadAddon(search)
        searchRef.current = search
        // V3 6.2/6.6: serialize feeds Copy; loaded once with the core set.
        try {
          const { SerializeAddon } = await import('@xterm/addon-serialize')
          const serialize = new SerializeAddon()
          terminal.loadAddon(serialize)
          serializeRef.current = serialize
        } catch { /* optional: Copy falls back to selection */ }
        terminalRef.current = terminal
        // V3 6.7: links go through the deny-by-default policy; nothing is
        // auto-typed or auto-entered into the PTY.
        terminal.loadAddon(new WebLinksAddon((_event, uri) => { void openTerminalLink(uri) }))
        terminal.loadAddon(new Unicode11Addon())
        terminal.unicode.activeVersion = '11'
        try {
          const { WebglAddon } = await import('@xterm/addon-webgl')
          const webgl = new WebglAddon()
          webgl.onContextLoss(() => { webgl.dispose() })
          terminal.loadAddon(webgl)
        } catch { /* optional capability: DOM renderer fallback */ }
        fit.fit()
        outputDispose = attachment.subscribe(chunk => {
          if (chunk.terminalId !== terminalId || chunk.epoch !== attachment?.epoch || chunk.sequence <= lastSequence) return
          // The first observed chunk after (re)attach is the stream baseline —
          // a mid-session sequence offset is not a gap.
          if (lastSequence >= 0 && chunk.sequence > lastSequence + 1) terminal?.write('\r\n[output gap; reconnect to resync]\r\n')
          lastSequence = chunk.sequence
          if (chunk.truncated === true) terminal?.write('\r\n[output truncated; reconnect to resync]\r\n')
          terminal?.write(chunk.data)
        })
        // V3 6.4 input gate: an explicit lease drops ungranted keypresses
        // (never buffers); legacy attachments without `control` stay ungated.
        const leaseOf = () => attachment?.control
        if (leaseOf() !== undefined) setLease(leaseOf()!.state)
        const requestTakeover = leaseOf()?.requestTakeover
        attachmentControlRequestRef.current = requestTakeover === undefined ? undefined : () => Promise.resolve(requestTakeover())
        // Close/Detach never kills the PTY (owner lifecycle); Kill is explicit.
        onDetachRef.current = () => nextAttachment.detach()
        onKillRef.current = () => host.closeTerminal(terminalId)
        onPasteRef.current = data => nextAttachment.writeInput(data)
        leaseDispose = leaseOf()?.subscribe(state => setLease(state))
        inputDispose = terminal.onData(data => {
          const control = leaseOf()
          if (control !== undefined && control.state !== 'granted') return
          void attachment?.writeInput(data)
        })
        resizeDispose = terminal.onResize(({ cols, rows }) => { void attachment?.resize(cols, rows) })
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(entries => {
            const rect = entries[0]?.contentRect
            if (rect === undefined || rect.width < 80 || rect.height < 40) return
            // rAF coalescing: bursts of resize entries produce one fit.
            if (pendingFrame !== 0) return
            pendingFrame = requestAnimationFrame(() => { pendingFrame = 0; fit?.fit() })
          })
          observer.observe(surface)
        }
        // Font/theme refit: a late webfont swap changes cell metrics without a
        // container resize, so refit once the document fonts settle.
        if (typeof document !== 'undefined' && (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts !== undefined) {
          void (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready.then(() => {
            if (!disposed) fit?.fit()
          })
        }
        if (!disposed) setReady(true)
      } catch (caught) {
        if (!disposed && !abort.signal.aborted) setError(caught instanceof Error ? caught.message : '终端连接失败')
      }
    })()

    return () => {
      disposed = true
      abort.abort()
      observer?.disconnect()
      leaseDispose?.()
      if (pendingFrame !== 0) cancelAnimationFrame(pendingFrame)
      outputDispose?.()
      disposeXtermDisposable(inputDispose)
      disposeXtermDisposable(resizeDispose)
      terminal?.dispose()
      fitRef.current = undefined
      searchRef.current = undefined
      serializeRef.current = undefined
      terminalRef.current = undefined
      void attachment?.detach()
    }
  }, [host, terminalId, connectionAttempt])

  return <div className="dt-interactive">
    {(error !== undefined || ready) && <div className="dt-surface-toolbar">
      {error !== undefined && <span role="alert" className="dt-error">{error}</span>}
      {ready && lease !== undefined && lease !== 'granted' && <span role="status" data-terminal-lease={lease} className="dt-lease">{lease === 'pending' ? '等待控制授权…（输入未发送）' : '观察中（输入未发送）'}</span>}
      {ready && lease !== undefined && lease !== 'granted' && host.attachTerminal !== undefined && <Button type="button" size="sm" variant="toolbar" data-terminal-takeover onClick={async () => {
        const result = await attachmentControlRequestRef.current?.()
        if (result === undefined || result.status === 'busy') { setLease('pending') }
      }}>接管</Button>}
      {ready && <>
        {findOpen && <span className="dt-find" role="search">
          <input aria-label="查找" value={findTerm} onChange={event => setFindTerm(event.currentTarget.value)} data-terminal-find-input />
          <Button type="button" size="sm" variant="toolbar" data-terminal-find-next onClick={() => { if (findTerm !== '') searchRef.current?.findNext(findTerm) }}>下一处</Button>
          <Button type="button" size="sm" variant="toolbar" data-terminal-find-prev onClick={() => { if (findTerm !== '') searchRef.current?.findPrevious(findTerm) }}>上一处</Button>
          <Button type="button" size="sm" variant="toolbar" data-terminal-find-close onClick={() => setFindOpen(false)}>关闭</Button>
        </span>}
        {onNewSession !== undefined && <Button type="button" size="sm" variant="toolbar" data-terminal-new onClick={onNewSession}>新建</Button>}
        {onNewSession !== undefined && <Button type="button" size="sm" variant="toolbar" data-terminal-split onClick={onNewSession}>分屏</Button>}
        {onRename !== undefined && <Button type="button" size="sm" variant="toolbar" data-terminal-rename onClick={() => {
          const title = window.prompt('会话标题', '') ?? ''
          if (title.trim() !== '') onRename(title.trim().slice(0, 80))
        }}>重命名</Button>}
        <Button type="button" size="sm" variant="toolbar" data-terminal-find onClick={() => setFindOpen(open => !open)}>查找</Button>
        <Button type="button" size="sm" variant="toolbar" data-terminal-copy onClick={() => {
          const text = serializeRef.current?.serialize() ?? ''
          if (text !== '') void navigator.clipboard?.writeText(text).catch(() => {})
        }}>复制</Button>
        <Button type="button" size="sm" variant="toolbar" data-terminal-paste onClick={async () => {
          const gated = lease !== undefined && lease !== 'granted'
          if (gated) return
          try {
            const text = await navigator.clipboard?.readText()
            if (text === undefined || text === '') return
            if (/[\r\n\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text) && !window.confirm('粘贴内容包含多行或控制字符，确认粘贴？')) return
            await onPasteRef.current?.(text)
          } catch { /* clipboard is an optional capability */ }
        }}>粘贴</Button>
        <Button type="button" size="sm" variant="toolbar" data-terminal-clear onClick={() => terminalRef.current?.clear()}>清屏</Button>
        <Button type="button" size="sm" variant="toolbar" data-terminal-detach onClick={() => { void onDetachRef.current?.() }}>分离</Button>
        <Button type="button" size="sm" variant="toolbar" data-terminal-kill onClick={() => {
          // Close NEVER kills; Kill asks once and requires the owner receipt.
          if (!window.confirm('终止该 PTY 会话？此操作不可撤销。')) return
          void onKillRef.current?.()
        }}>终止</Button>
        <Button type="button" size="sm" variant="toolbar" onClick={() => fitRef.current?.fit()} data-terminal-fit>适配窗口</Button>
      </>}
      {error !== undefined && <Button type="button" size="sm" variant="toolbar" onClick={() => { setReady(false); setError(undefined); setConnectionAttempt(value => value + 1) }} data-terminal-reconnect>重新连接</Button>}
    </div>}
    <div ref={surfaceRef} aria-label={error === undefined ? 'Interactive terminal' : `Interactive terminal unavailable: ${error}`} data-terminal-surface />
  </div>
}

/** Terminal renderer with a lazy xterm boundary and honest fallback states. */
export function TerminalPanel({ state = 'disconnected', status, host, terminalId, onNewSession, onRename }: TerminalPanelProps) {
  const interactive = host?.attachTerminal !== undefined && terminalId !== undefined && state !== 'exited'
  return (
    <Surface kind="workspace" aria-label="Terminal" data-dsh-terminal-panel data-terminal-state={state}>
      <style data-dsh-terminal-styles>{terminalStyles}</style>
      <SurfaceContextBar title="Terminal" status={<span data-terminal-status>
        {STATE_TEXT[state]}
        {status !== undefined ? ` · ${status}` : ''}
      </span>} />
      {interactive
        ? <div className="ys-body"><InteractiveTerminal host={host} terminalId={terminalId} onNewSession={onNewSession} onRename={onRename} /></div>
        : <div className="ys-body"><SurfaceState phase={state === 'exited' ? 'empty' : 'disabled'} title={state === 'exited' ? '该终端已经退出。重新打开会创建新的 DSH PTY 会话。' : '当前没有可附着的 interactive terminal V2 会话；不会显示占位输出或伪输入框。'} aria-label="Terminal compatibility status" data-terminal-compatibility /></div>}
    </Surface>
  )
}

export default TerminalPanel
