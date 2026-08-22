/**
 * Terminal Pane for the Desktop Workbench.
 *
 * This component consumes a V1/V2 terminal host and renders a VS Code-like
 * terminal list plus the xterm.js projection. It does not own PTY state;
 * DSH/terminal host remains canonical.
 *
 * @module @yeisme/dsh-client-ui-desktop-workbench/client
 */

import { useEffect, useMemo, useState } from 'react'
import { TerminalPanel, type TerminalPanelState } from '@yeisme/dsh-terminal'
import { isTerminalHostV2, type TerminalHostV1, type TerminalHostV2, type TerminalSessionV1 } from '@yeisme/dsh-terminal-host'

export type TerminalHostCompatible = TerminalHostV1 | TerminalHostV2

export interface TerminalPaneProps {
  /** Terminal host adapter. */
  host: TerminalHostCompatible
  /** Optional callback after a terminal mutation receipt. */
  onMutation?: ((receipt: import('@yeisme/dsh-terminal-host').TerminalMutationReceiptV1) => void) | undefined
}

function asInteractiveHost(host: TerminalHostCompatible): TerminalHostV2 | undefined {
  return isTerminalHostV2(host) ? host : undefined
}

const terminalPaneStyles = `
[data-dsh-terminal-pane]{display:flex;min-width:0;min-height:100%;height:100%;flex-direction:column;color:var(--dsw-alias-label-primary,#f2f2f4);background:var(--dsw-alias-bg-base,#171719);font:13px/1.45 var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif)}
[data-dsh-terminal-pane] .dwt-toolbar{display:flex;min-height:38px;align-items:center;gap:10px;padding:0 10px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));background:var(--dsw-alias-bg-elevated,#1c1c1f)}
[data-dsh-terminal-pane] .dwt-summary{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary,#92929b);font-size:12px}
[data-dsh-terminal-pane] .dwt-actions{display:flex;gap:6px;margin-left:auto}
[data-dsh-terminal-pane] button{min-height:28px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));border-radius:7px;background:var(--dsw-alias-bg-layer-1,#29292d);color:var(--dsw-alias-label-secondary,#c6c6cb);cursor:pointer;font:inherit}
[data-dsh-terminal-pane] button:hover:not(:disabled),[data-dsh-terminal-pane] button:focus-visible{background:var(--dsw-alias-fill-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#fff);outline:2px solid var(--dsw-alias-state-business-primary,#79a8ff);outline-offset:-2px}
[data-dsh-terminal-pane] button:disabled{cursor:not-allowed;opacity:.45}
[data-dsh-terminal-pane] .dwt-action{padding:0 10px}
[data-dsh-terminal-pane] .dwt-action-primary{border-color:rgba(121,168,255,.45);background:rgba(73,117,185,.32);color:#dce9ff}
[data-dsh-terminal-pane] .dwt-message{margin:12px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:9px;background:var(--dsw-alias-bg-layer-1,#202024);color:var(--dsw-alias-label-secondary,#c6c6cb)}
[data-dsh-terminal-pane] .dwt-message strong{display:block;margin-bottom:4px;color:var(--dsw-alias-label-primary,#f2f2f4)}
[data-dsh-terminal-pane] .dwt-error{border-color:rgba(242,90,90,.35);color:var(--dsw-alias-state-error-secondary,#f68b8b)}
[data-dsh-terminal-pane] .dwt-layout{display:grid;min-width:0;min-height:0;flex:1;grid-template-columns:minmax(156px,22%) minmax(0,1fr)}
[data-dsh-terminal-pane] .dwt-list{min-width:0;overflow:auto;border-right:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));background:var(--dsw-specific-sidebar-fill,#1c1c1f)}
[data-dsh-terminal-pane] .dwt-list ul{display:grid;gap:2px;margin:0;padding:6px;list-style:none}
[data-dsh-terminal-pane] .dwt-list li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px}
[data-dsh-terminal-pane] .dwt-session{min-width:0;padding:0 8px;overflow:hidden;text-align:left;text-overflow:ellipsis;white-space:nowrap}
[data-dsh-terminal-pane] .dwt-session[aria-pressed='true']{border-color:rgba(121,168,255,.35);background:rgba(88,137,210,.2);color:#e4efff}
[data-dsh-terminal-pane] .dwt-close{width:28px;padding:0}
[data-dsh-terminal-pane] .dwt-surface{min-width:0;min-height:0;overflow:auto;padding:10px}
@media(max-width:600px){[data-dsh-terminal-pane] .dwt-layout{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}[data-dsh-terminal-pane] .dwt-list{max-height:116px;border-right:0;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1))}}
`

export function TerminalPane({ host, onMutation }: TerminalPaneProps) {
  const interactiveHost = asInteractiveHost(host)
  const [terminals, setTerminals] = useState<readonly TerminalSessionV1[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = async (): Promise<readonly TerminalSessionV1[]> => {
    if (interactiveHost === undefined) {
      setLoading(false)
      setTerminals([])
      setSelectedId(null)
      return []
    }
    setLoading(true)
    setError(null)
    try {
      const next = await interactiveHost.listTerminals()
      setTerminals(next)
      setSelectedId(current => current !== null && next.some(terminal => terminal.terminalId === current) ? current : next[0]?.terminalId ?? null)
      return next
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      return []
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactiveHost])

  const selected = useMemo(
    () => terminals.find(terminal => terminal.terminalId === selectedId) ?? null,
    [terminals, selectedId],
  )
  const runMutation = async (action: () => Promise<import('@yeisme/dsh-terminal-host').TerminalMutationReceiptV1>): Promise<void> => {
    try {
      const receipt = await action()
      onMutation?.(receipt)
      if (receipt.status !== 'ok') {
        setError(receipt.reason ?? `终端操作未完成：${receipt.status}`)
        return
      }
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }

  const state: TerminalPanelState = selected?.running === true ? 'connected' : selected === null ? 'disconnected' : 'exited'
  const openTerminal = async (): Promise<void> => {
    if (interactiveHost === undefined) return
    try {
      const created = await interactiveHost.openTerminal()
      const next = await refresh()
      setSelectedId(next.some(terminal => terminal.terminalId === created.terminalId) ? created.terminalId : next[0]?.terminalId ?? null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }

  return (
    <section aria-label="Terminals" data-dsh-terminal-pane data-terminal-capability={interactiveHost === undefined ? 'unsupported' : 'interactive'} data-freshness={interactiveHost === undefined ? 'contract_mismatch' : 'fresh'}>
      <style data-dsh-terminal-pane-styles>{terminalPaneStyles}</style>
      <header className="dwt-toolbar">
        <span className="dwt-summary" role="status" aria-live="polite">
          {loading ? '正在连接终端服务…' : error !== null ? '终端服务需要处理' : `${terminals.length} 个终端`}
        </span>
        <div className="dwt-actions">
          <button className="dwt-action dwt-action-primary" type="button" disabled={interactiveHost === undefined || loading} title={interactiveHost === undefined ? '需要 DSH interactive terminal V2 capability' : '新建终端'} onClick={() => void openTerminal()}>新建终端</button>
          <button className="dwt-action" type="button" disabled={interactiveHost === undefined || loading} onClick={() => void refresh()}>刷新</button>
        </div>
      </header>
      {interactiveHost === undefined && <div className="dwt-message" role="status" data-terminal-compatibility>
        <strong>交互式终端尚不可用</strong>
        缺少 TerminalInteractiveCapabilityV1 / TerminalHostV2。这里不会创建占位终端、伪造输入输出，也不会解封 xterm。
      </div>}
      {error !== null && <div className="dwt-message dwt-error" role="alert">{error}</div>}
      {interactiveHost !== undefined && !loading && error === null && terminals.length === 0 && <div className="dwt-message" role="status">
        <strong>还没有终端会话</strong>
        使用上方“新建终端”创建由 DSH 管理的真实 PTY 会话。
      </div>}
      {terminals.length > 0 && <div className="dwt-layout">
        <nav className="dwt-list" aria-label="终端会话">
          <ul data-dsh-terminal-list>
            {terminals.map(terminal => (
              <li key={terminal.terminalId}>
                <button className="dwt-session" type="button" aria-pressed={selectedId === terminal.terminalId} onClick={() => { setSelectedId(terminal.terminalId) }}>
                  {terminal.title} · {terminal.running ? '运行中' : '已退出'}
                </button>
                <button className="dwt-close" type="button" aria-label={`关闭 ${terminal.title}`} title={`关闭 ${terminal.title}`} onClick={() => void runMutation(() => interactiveHost?.closeTerminal(terminal.terminalId) ?? Promise.resolve({ status: 'rejected', terminalId: terminal.terminalId, reason: 'interactive terminal capability unavailable' }))}>×</button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="dwt-surface">
          {selected !== null && <TerminalPanel state={state} status={selected.title} host={interactiveHost} terminalId={selected.terminalId} />}
        </div>
      </div>}
    </section>
  )
}

export default TerminalPane
