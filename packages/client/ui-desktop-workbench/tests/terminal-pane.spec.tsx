// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TerminalPane } from '../src/client/terminal-pane.tsx'
import type { TerminalHostV1, TerminalHostV2, TerminalSessionV1 } from '@yeisme/dsh-terminal-host'

afterEach(cleanup)

const sessions: readonly TerminalSessionV1[] = [
  { terminalId: 't-1', title: 'zsh', running: false },
  { terminalId: 't-2', title: 'bash', running: false },
]

function fakeHost(): TerminalHostV2 & { calls: string[] } {
  const calls: string[] = []
  const host: TerminalHostV2 = {
    version: '0.2.0-rc.1',
    capability: 'terminal-host',
    async listTerminals() {
      calls.push('list')
      return sessions
    },
    async openTerminal(title = 'zsh') {
      calls.push(`open:${title}`)
      return { terminalId: 't-3', title, running: true }
    },
    async closeTerminal(terminalId) {
      calls.push(`close:${terminalId}`)
      return { status: 'ok', terminalId }
    },
    async writeInput(terminalId, data) {
      calls.push(`write:${terminalId}:${data}`)
      return { status: 'ok', terminalId }
    },
    async resizeTerminal(terminalId, cols, rows) {
      calls.push(`resize:${terminalId}:${cols}:${rows}`)
      return { status: 'ok', terminalId }
    },
    async attachTerminal() {
      throw new Error('not expected for exited test sessions')
    },
  }
  return { ...host, calls }
}

describe('TerminalPane', () => {
  it('renders terminal list and selected terminal state', async () => {
    render(<TerminalPane host={fakeHost()} />)
    expect(await screen.findByText('zsh · 已退出')).toBeTruthy()
    expect(screen.getByText('bash · 已退出')).toBeTruthy()
    expect(screen.getByText(/已退出 · zsh/)).toBeTruthy()
  })

  it('opens and closes terminals through the interactive owner host', async () => {
    const host = fakeHost()
    render(<TerminalPane host={host} />)
    await screen.findByText('zsh · 已退出')
    fireEvent.click(screen.getByRole('button', { name: '新建终端' }))
    expect(host.calls).toContain('open:zsh')
    fireEvent.click(screen.getByRole('button', { name: '关闭 zsh' }))
    expect(host.calls).toContain('close:t-1')
    expect(screen.queryByRole('form', { name: 'Terminal input' })).toBeNull()
  })

  it('shows a compatibility state instead of dead controls for a legacy host', async () => {
    const legacy: TerminalHostV1 = {
      version: '0.1.0-rc.1',
      capability: 'terminal-host',
      async listTerminals() { return sessions },
      async openTerminal() { return sessions[0]! },
      async closeTerminal(terminalId) { return { status: 'ok', terminalId } },
      async writeInput(terminalId) { return { status: 'ok', terminalId } },
      async resizeTerminal(terminalId) { return { status: 'ok', terminalId } },
    }
    render(<TerminalPane host={legacy} />)
    expect(await screen.findByText('交互式终端尚不可用')).toBeTruthy()
    expect(document.querySelector('[data-dsh-terminal-pane]')?.getAttribute('data-freshness')).toBe('contract_mismatch')
    expect((screen.getByRole('button', { name: '新建终端' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('form', { name: 'Terminal input' })).toBeNull()
  })
})
