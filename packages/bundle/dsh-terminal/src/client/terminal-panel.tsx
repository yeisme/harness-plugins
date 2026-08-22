/**
 * Terminal Pane backed by an owner-authorized xterm attachment.
 *
 * DSH owns the PTY and control lease. This component owns only the browser
 * renderer, input event forwarding, resize observation, and symmetric detach.
 * When the V2 attachment is unavailable it renders an honest connection state.
 *
 * @module @yeisme/dsh-terminal/client
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react'
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

const styles: Record<'root' | 'header' | 'heading' | 'description' | 'status' | 'console' | 'prompt' | 'message' | 'terminalSurface' | 'surfaceToolbar' | 'surfaceButton', CSSProperties> = {
  root: {
    display: 'grid',
    alignContent: 'start',
    gap: 8,
    width: '100%',
    minHeight: '100%',
    color: 'var(--dsw-alias-label-primary, #f2f2f4)',
  },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  heading: { margin: 0, fontSize: 22, fontWeight: 680, letterSpacing: '-0.02em' },
  description: { margin: '6px 0 0', color: 'var(--dsw-alias-label-tertiary, #92929b)', fontSize: 13 },
  status: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 28,
    padding: '0 10px',
    color: 'var(--dsw-alias-label-secondary, #c6c6cb)',
    background: 'var(--dsw-alias-bg-layer-1, #232324)',
    border: '1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12))',
    borderRadius: 999,
    fontSize: 11,
    fontVariantNumeric: 'tabular-nums',
  },
  console: {
    minHeight: 96,
    padding: 14,
    color: 'var(--dsw-alias-label-secondary, #c6c6cb)',
    background: 'var(--dsw-alias-bg-layer-1, #202024)',
    border: '1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12))',
    borderRadius: 9,
    fontSize: 13,
    lineHeight: 1.6,
  },
  prompt: { color: 'var(--dsw-alias-state-business-primary, #79a8ff)', fontWeight: 700 },
  message: { color: 'var(--dsw-alias-label-tertiary, #92929b)' },
  terminalSurface: {
    minHeight: 320,
    overflow: 'hidden',
    padding: 12,
    background: '#101012',
    border: '1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12))',
    borderRadius: 12,
  },
  surfaceToolbar: { display: 'flex', justifyContent: 'flex-end', gap: 6, minHeight: 30, marginBottom: 6 },
  surfaceButton: {
    minHeight: 28,
    padding: '0 9px',
    color: 'var(--dsw-alias-label-secondary, #c6c6cb)',
    background: 'var(--dsw-alias-bg-layer-1, #232324)',
    border: '1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12))',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 11,
  },
}

const terminalStyles = `
[data-dsh-terminal-panel] [data-terminal-surface] { position: relative; }
[data-dsh-terminal-panel] [data-terminal-surface] .xterm { position: relative; height: 100%; min-height: 292px; padding: 2px; user-select: none; }
[data-dsh-terminal-panel] [data-terminal-surface] .xterm-helpers { position: absolute; top: 0; z-index: 5; }
[data-dsh-terminal-panel] [data-terminal-surface] .xterm-helper-textarea { position: absolute; top: 0; left: -9999em; width: 0; height: 0; opacity: 0; z-index: -5; overflow: hidden; resize: none; white-space: nowrap; }
[data-dsh-terminal-panel] [data-terminal-surface] .xterm-viewport { position: absolute; inset: 0; overflow-y: auto; background: transparent; cursor: default; }
[data-dsh-terminal-panel] [data-terminal-surface] .xterm-screen { position: relative; min-height: 292px; }
[data-dsh-terminal-panel] [data-terminal-surface] .xterm-rows { position: absolute; left: 0; top: 0; }
[data-dsh-terminal-panel] button:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #79a8ff); outline-offset: 1px; }
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
        const [{ Terminal }, { FitAddon }, nextAttachment] = await Promise.all([
          import('@xterm/xterm'),
          import('@xterm/addon-fit'),
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
            cursor: '#79a8ff',
            selectionBackground: 'rgba(121,168,255,.3)',
          },
        })
        terminal.open(surface)
        const fit = new FitAddon()
        fitRef.current = fit
        terminal.loadAddon(fit)
        fit.fit()
        outputDispose = attachment.subscribe(chunk => {
          if (chunk.terminalId !== terminalId || chunk.epoch !== attachment?.epoch || chunk.sequence <= lastSequence) return
          if (chunk.sequence > lastSequence + 1) terminal?.write('\r\n[output gap; reconnect to resync]\r\n')
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
      void attachment?.detach()
    }
  }, [host, terminalId, connectionAttempt])

  return <div style={{ minWidth: 0 }}>
    {(error !== undefined || ready) && <div style={styles.surfaceToolbar}>
      {error !== undefined && <span role="alert" style={{ ...styles.message, marginRight: 'auto' }}>{error}</span>}
      {ready && <button type="button" style={styles.surfaceButton} onClick={() => fitRef.current?.fit()} data-terminal-fit>适配窗口</button>}
      {error !== undefined && <button type="button" style={styles.surfaceButton} onClick={() => { setReady(false); setError(undefined); setConnectionAttempt(value => value + 1) }} data-terminal-reconnect>重新连接</button>}
    </div>}
    <div ref={surfaceRef} style={styles.terminalSurface} aria-label={error === undefined ? 'Interactive terminal' : `Interactive terminal unavailable: ${error}`} data-terminal-surface />
  </div>
}

/** Terminal renderer with a lazy xterm boundary and honest fallback states. */
export function TerminalPanel({ state = 'disconnected', status, host, terminalId }: TerminalPanelProps) {
  const interactive = host?.attachTerminal !== undefined && terminalId !== undefined && state !== 'exited'
  return (
    <section aria-label="Terminal" data-dsh-terminal-panel data-terminal-state={state} style={styles.root}>
      <style data-dsh-terminal-styles>{terminalStyles}</style>
      <span style={{ ...styles.status, justifySelf: 'end' }} data-terminal-status>
        {STATE_TEXT[state]}
        {status !== undefined ? ` · ${status}` : ''}
      </span>
      {interactive
        ? <InteractiveTerminal host={host} terminalId={terminalId} />
        : <div style={styles.console} role="status" aria-label="Terminal compatibility status" data-terminal-compatibility>
          {state === 'exited'
            ? '该终端已经退出。重新打开会创建新的 DSH PTY 会话。'
            : '当前没有可附着的 interactive terminal V2 会话；不会显示占位输出或伪输入框。'}
        </div>}
    </section>
  )
}

export default TerminalPanel
