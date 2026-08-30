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
}

const terminalStyles = `
[data-dsh-terminal-panel]{width:100%;min-height:100%}
[data-dsh-terminal-panel] .dt-interactive{min-width:0}
[data-dsh-terminal-panel] .dt-surface-toolbar{display:flex;justify-content:flex-end;gap:6px;min-height:30px;margin-bottom:6px}
[data-dsh-terminal-panel] .dt-error{margin-right:auto;color:var(--vk-state-error)}
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

function InteractiveTerminal({ host, terminalId }: { readonly host: TerminalHostV2; readonly terminalId: string }) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const fitRef = useRef<{ fit(): void }>()
  const searchRef = useRef<{ findNext(term: string): boolean; findPrevious(term: string): boolean }>()
  const [error, setError] = useState<string | undefined>()
  const [ready, setReady] = useState(false)
  const [connectionAttempt, setConnectionAttempt] = useState(0)

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
        terminal.loadAddon(new WebLinksAddon(() => { void 0 }))
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
        inputDispose = terminal.onData(data => { void attachment?.writeInput(data) })
        resizeDispose = terminal.onResize(({ cols, rows }) => { void attachment?.resize(cols, rows) })
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(entries => {
            const rect = entries[0]?.contentRect
            if (rect === undefined || rect.width < 80 || rect.height < 40) return
            fit?.fit()
          })
          observer.observe(surface)
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
      outputDispose?.()
      disposeXtermDisposable(inputDispose)
      disposeXtermDisposable(resizeDispose)
      terminal?.dispose()
      fitRef.current = undefined
      searchRef.current = undefined
      void attachment?.detach()
    }
  }, [host, terminalId, connectionAttempt])

  return <div className="dt-interactive">
    {(error !== undefined || ready) && <div className="dt-surface-toolbar">
      {error !== undefined && <span role="alert" className="dt-error">{error}</span>}
      {ready && <Button type="button" size="sm" variant="toolbar" onClick={() => fitRef.current?.fit()} data-terminal-fit>适配窗口</Button>}
      {error !== undefined && <Button type="button" size="sm" variant="toolbar" onClick={() => { setReady(false); setError(undefined); setConnectionAttempt(value => value + 1) }} data-terminal-reconnect>重新连接</Button>}
    </div>}
    <div ref={surfaceRef} aria-label={error === undefined ? 'Interactive terminal' : `Interactive terminal unavailable: ${error}`} data-terminal-surface />
  </div>
}

/** Terminal renderer with a lazy xterm boundary and honest fallback states. */
export function TerminalPanel({ state = 'disconnected', status, host, terminalId }: TerminalPanelProps) {
  const interactive = host?.attachTerminal !== undefined && terminalId !== undefined && state !== 'exited'
  return (
    <Surface kind="workspace" aria-label="Terminal" data-dsh-terminal-panel data-terminal-state={state}>
      <style data-dsh-terminal-styles>{terminalStyles}</style>
      <SurfaceContextBar title="Terminal" status={<span data-terminal-status>
        {STATE_TEXT[state]}
        {status !== undefined ? ` · ${status}` : ''}
      </span>} />
      {interactive
        ? <div className="ys-body"><InteractiveTerminal host={host} terminalId={terminalId} /></div>
        : <div className="ys-body"><SurfaceState phase={state === 'exited' ? 'empty' : 'disabled'} title={state === 'exited' ? '该终端已经退出。重新打开会创建新的 DSH PTY 会话。' : '当前没有可附着的 interactive terminal V2 会话；不会显示占位输出或伪输入框。'} aria-label="Terminal compatibility status" data-terminal-compatibility /></div>}
    </Surface>
  )
}

export default TerminalPanel
