// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ComposedDesktopWorkbench } from '../src/client/composed-workbench.tsx'
import type { SessionManagerHostV1 } from '@yeisme/dsh-session-manager'
import type { FileHostV1 } from '@yeisme/dsh-file-host'
import type { FileEntryV1 } from '@yeisme/dsh-file-document'
import type { TerminalHostV2, TerminalSessionV1 } from '@yeisme/dsh-terminal-host'

afterEach(cleanup)

function fakeSessionHost(): SessionManagerHostV1 {
  return {
    version: '0.1.0-rc.1',
    capability: 'session-manager',
    async listSessions() {
      return [{ sessionId: 'session-1', title: '设计', workspaceRef: 'ws-1', workspaceName: 'repo', archived: false, running: false, unread: false, labels: [] }]
    },
    async archiveSession(sessionId) { return { status: 'ok', sessionId } },
    async restoreSession(sessionId) { return { status: 'ok', sessionId } },
    async trashSession(sessionId) { return { status: 'ok', sessionId } },
    async purgeSession(sessionId) { return { status: 'ok', sessionId } },
    async setLabels(sessionId) { return { status: 'ok', sessionId } },
    async pauseSession(sessionId) { return { status: 'ok', sessionId } },
    async resumeSession(sessionId) { return { status: 'ok', sessionId } },
    async forkSession(sessionId) { return { status: 'ok', sessionId, childSessionId: 'child' } },
  }
}

function fakeFileHost(): FileHostV1 {
  const files: readonly FileEntryV1[] = [
    { id: 'dir-1', name: 'src', kind: 'directory', capabilities: ['open'] },
    { id: 'file-1', parentId: 'dir-1', name: 'index.ts', kind: 'text', mediaType: 'text/typescript', capabilities: ['preview', 'open'] },
  ]
  return {
    version: '0.1.0-rc.1',
    capability: 'file-host',
    async listEntries(parentRef) {
      if (parentRef === undefined) return [files[0]]
      if (parentRef === 'dir-1') return [files[1]]
      return []
    },
  }
}

describe('ComposedDesktopWorkbench', () => {
  it('renders session sidebar and file pane in the desktop shell', async () => {
    render(
      <ComposedDesktopWorkbench
        sessionHost={fakeSessionHost()}
        fileHost={fakeFileHost()}
      />,
    )
    expect(await screen.findByText('设计')).toBeTruthy()
    expect(screen.getByRole('tab', { name: '文件' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '文件' }))
    expect(await screen.findByText('src')).toBeTruthy()
  })

  it('renders an honest compatibility state when no terminal owner is wired', async () => {
    render(<ComposedDesktopWorkbench terminalState="connected" terminalStatus="zsh" />)
    fireEvent.click(await screen.findByRole('tab', { name: '终端' }))
    expect(screen.getByText(/当前没有可附着的 interactive terminal V2 会话/iu)).toBeTruthy()
  })

  it('renders terminal pane when a terminal host is wired', async () => {
    const terminalHost: TerminalHostV2 = {
      version: '0.2.0-rc.1',
      capability: 'terminal-host',
      async listTerminals() {
        const sessions: TerminalSessionV1[] = [{ terminalId: 't-1', title: 'zsh', running: false }]
        return sessions
      },
      async openTerminal(title = 'zsh') { return { terminalId: 't-2', title, running: true } },
      async closeTerminal(terminalId) { return { status: 'ok', terminalId } },
      async writeInput(terminalId) { return { status: 'ok', terminalId } },
      async resizeTerminal(terminalId) { return { status: 'ok', terminalId } },
      async attachTerminal() { throw new Error('not expected for an exited terminal') },
    }
    render(<ComposedDesktopWorkbench terminalHost={terminalHost} />)
    fireEvent.click(await screen.findByRole('tab', { name: '终端' }))
    expect(await screen.findByText('zsh · 已退出')).toBeTruthy()
    expect(screen.getByText(/已退出 · zsh/)).toBeTruthy()
  })
})
