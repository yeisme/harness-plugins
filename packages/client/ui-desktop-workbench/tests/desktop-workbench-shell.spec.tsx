// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DesktopWorkbenchShell } from '../src/client/desktop-workbench-shell.tsx'
import { bindSessionManagerHost } from '@yeisme/dsh-session-manager'
import type { SessionManagerHostV1 } from '@yeisme/dsh-session-manager'
import type { WorkbenchTabV1 } from '@yeisme/dsh-workbench-core'

const tabs: WorkbenchTabV1[] = [
  { id: 'desktop-files', moduleId: 'dsh-desktop-workbench', title: '文件', order: 20, closable: true, scope: 'session-maybe' },
]

afterEach(cleanup)

describe('DesktopWorkbenchShell', () => {
  it('renders the session sidebar and a workbench tab', () => {
    render(<DesktopWorkbenchShell tabs={tabs} renderTab={tab => <div>{tab.title}</div>} />)
    expect(screen.getByRole('complementary', { name: 'Sessions' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '文件' })).toBeTruthy()
    expect(document.querySelector('[data-dsh-desktop-workbench]')?.getAttribute('data-sidebar-visible')).toBe('true')
  })

  it('renders real rows when a host-bound session service is live', async () => {
    const bound: SessionManagerHostV1 = {
      version: '0.1.0-rc.1',
      capability: 'session-manager',
      async listSessions() {
        return [{ sessionId: 'session-1', title: '后端设计', workspaceName: 'repo', archived: false, running: false, unread: false, labels: [] }]
      },
      async archiveSession(sessionId) { return { status: 'ok', sessionId } },
      async restoreSession(sessionId) { return { status: 'ok', sessionId } },
      async trashSession(sessionId) { return { status: 'ok', sessionId } },
      async purgeSession(sessionId) { return { status: 'ok', sessionId } },
      async setLabels(sessionId) { return { status: 'ok', sessionId } },
      async pauseSession(sessionId) { return { status: 'ok', sessionId } },
      async resumeSession(sessionId) { return { status: 'ok', sessionId } },
      async forkSession(sessionId) { return { status: 'ok', sessionId } },
    }
    const unbind = bindSessionManagerHost(bound)
    try {
      render(<DesktopWorkbenchShell tabs={tabs} renderTab={tab => <div>{tab.title}</div>} />)
      expect(await screen.findByText('后端设计')).toBeTruthy()
      expect(screen.getByRole('complementary', { name: 'Sessions' })).toBeTruthy()
    } finally {
      unbind()
    }
  })

  it('toggles the session sidebar and exposes an explicit return action', () => {
    const onClose = vi.fn()
    render(<DesktopWorkbenchShell tabs={tabs} renderTab={tab => <div>{tab.title}</div>} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '隐藏会话侧栏' }))
    expect(document.querySelector('[data-dsh-desktop-workbench]')?.getAttribute('data-sidebar-visible')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: '返回 DSH 会话' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
