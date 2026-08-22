// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GlobalSearch } from '../src/client/global-search.tsx'
import type { SessionManagerHostV1, SessionSummaryV1 } from '@yeisme/dsh-session-manager'

afterEach(cleanup)

const sessions: readonly SessionSummaryV1[] = [
  { sessionId: 'session-1', title: '后端设计', workspaceRef: 'ws-1', workspaceName: 'yeisme-agent', archived: false, running: true, unread: false, labels: ['backend'], updatedAt: '2026-08-19T00:00:00.000Z' },
  { sessionId: 'session-2', title: '归档任务', workspaceRef: 'ws-2', workspaceName: 'docs', archived: true, running: false, unread: true, labels: [], updatedAt: '2026-08-18T00:00:00.000Z' },
]

function fakeHost(): SessionManagerHostV1 {
  return {
    version: '0.1.0-rc.1',
    capability: 'session-manager',
    async listSessions() { return sessions },
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

describe('GlobalSearch', () => {
  it('searches active and archived sessions by title and labels', async () => {
    render(<GlobalSearch host={fakeHost()} />)
    expect(await screen.findByText('后端设计')).toBeTruthy()
    expect(screen.getByText('归档任务')).toBeTruthy()
    const input = screen.getByRole('searchbox', { name: '搜索历史会话' })
    fireEvent.change(input, { target: { value: 'backend' } })
    expect(screen.getByText('后端设计')).toBeTruthy()
    expect(screen.queryByText('归档任务')).toBeNull()
  })
})
