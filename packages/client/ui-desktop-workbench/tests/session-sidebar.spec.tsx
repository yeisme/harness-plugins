// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

afterEach(cleanup)
import { SessionSidebar } from '../src/client/session-sidebar.tsx'
import type { SessionManagerHostV1, SessionSummaryV1 } from '@yeisme/dsh-session-manager'

const sessions: readonly SessionSummaryV1[] = [
  {
    sessionId: 'session-1',
    title: '后端设计',
    workspaceRef: 'ws-1',
    workspaceName: 'yeisme-agent',
    archived: false,
    running: true,
    unread: false,
    labels: ['backend'],
    updatedAt: '2026-08-19T00:00:00.000Z',
  },
  {
    sessionId: 'session-2',
    title: '归档任务',
    workspaceRef: 'ws-2',
    workspaceName: 'docs',
    archived: true,
    running: false,
    unread: true,
    labels: [],
    updatedAt: '2026-08-18T00:00:00.000Z',
  },
  {
    sessionId: 'session-3',
    title: '文档整理',
    workspaceRef: 'ws-2',
    workspaceName: 'docs',
    archived: false,
    running: false,
    unread: false,
    labels: ['docs'],
    updatedAt: '2026-08-17T00:00:00.000Z',
  },
  {
    sessionId: 'session-4',
    title: '重试分支',
    workspaceRef: 'ws-1',
    workspaceName: 'yeisme-agent',
    archived: false,
    running: false,
    unread: false,
    labels: [],
    updatedAt: '2026-08-19T01:00:00.000Z',
    parentSessionId: 'session-1',
    origin: 'retry',
  },
]

type FakeHost = SessionManagerHostV1 & { calls: string[] }

function fakeHost(overrides: Partial<SessionManagerHostV1> = {}): FakeHost {
  const calls: string[] = []
  const host: SessionManagerHostV1 = {
    version: '0.1.0-rc.1',
    capability: 'session-manager',
    async listSessions() {
      calls.push('list')
      return sessions
    },
    async archiveSession(sessionId) {
      calls.push(`archive:${sessionId}`)
      return { status: 'ok', sessionId }
    },
    async restoreSession(sessionId) {
      calls.push(`restore:${sessionId}`)
      return { status: 'ok', sessionId }
    },
    async trashSession(sessionId) {
      calls.push(`trash:${sessionId}`)
      return { status: 'ok', sessionId }
    },
    async purgeSession(sessionId) {
      calls.push(`purge:${sessionId}`)
      return { status: 'ok', sessionId }
    },
    async setLabels(sessionId, labels, expectedRevision) {
      calls.push(`labels:${sessionId}:${labels.join(',')}:${String(expectedRevision ?? '')}`)
      return { status: 'ok', sessionId }
    },
    async pauseSession(sessionId) {
      calls.push(`pause:${sessionId}`)
      return { status: 'ok', sessionId }
    },
    async resumeSession(sessionId) {
      calls.push(`resume:${sessionId}`)
      return { status: 'ok', sessionId }
    },
    async forkSession(sessionId) {
      calls.push(`fork:${sessionId}`)
      return { status: 'ok', sessionId, childSessionId: 'child' }
    },
    ...overrides,
  }
  return { ...host, calls }
}

describe('SessionSidebar', () => {
  it('renders active and archived sessions grouped by workspace', async () => {
    render(<SessionSidebar host={fakeHost()} />)
    expect(await screen.findByText('后端设计')).toBeTruthy()
    expect(screen.getByText('文档整理')).toBeTruthy()
    expect(screen.getByText('已归档（1）')).toBeTruthy()
    const archivedSummary = screen.getByText('已归档（1）')
    const archived = archivedSummary.closest('details') as HTMLElement
    expect(archived.open).toBe(false)
    fireEvent.click(archivedSummary)
    expect(archived.open).toBe(true)
    expect(within(archived).getByText('归档任务')).toBeTruthy()
  })

  it('filters by search query', async () => {
    render(<SessionSidebar host={fakeHost()} />)
    await screen.findByText('后端设计')
    const input = screen.getByRole('searchbox', { name: '搜索会话' })
    fireEvent.change(input, { target: { value: 'docs' } })
    expect(screen.queryByText('后端设计')).toBeNull()
    expect(screen.getByText('文档整理')).toBeTruthy()
  })

  it('calls pause/archive/fork actions through the host', async () => {
    const host = fakeHost()
    render(<SessionSidebar host={host} />)
    await screen.findByText('后端设计')
    const row = screen.getByText('后端设计').closest('li') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: '暂停' }))
    fireEvent.click(within(row).getByRole('button', { name: '分支' }))
    fireEvent.click(within(row).getByRole('button', { name: '归档' }))
    expect(host.calls).toContain('pause:session-1')
    expect(host.calls).toContain('fork:session-1')
    expect(host.calls).toContain('archive:session-1')
  })

  it('shows rewrite lineage on child sessions and keeps originals unlabeled', async () => {
    render(<SessionSidebar host={fakeHost()} lineageOf={session => ({
      origin: session.origin ?? 'unknown',
      text: session.parentSessionId === undefined ? 'Original session' : `From ${session.parentSessionId} · ${session.origin}`,
    })} />)
    await screen.findByText('后端设计')
    expect(screen.queryByText('Original session')).toBeNull()
    const child = screen.getByText('重试分支').closest('li') as HTMLElement
    expect(within(child).getByText('From session-1 · retry')).toBeTruthy()
    expect(child.querySelector('[data-dsh-session-lineage="retry"]')).toBeTruthy()
  })

  it('calls trash and purge actions through the host', async () => {
    const host = fakeHost()
    render(<SessionSidebar host={host} />)
    await screen.findByText('后端设计')
    const activeRow = screen.getByText('后端设计').closest('li') as HTMLElement
    fireEvent.click(within(activeRow).getByRole('button', { name: '删除' }))
    expect(host.calls).toContain('trash:session-1')

    const archivedSummary = screen.getByText('已归档（1）')
    fireEvent.click(archivedSummary)
    const archivedRow = screen.getByText('归档任务').closest('li') as HTMLElement
    fireEvent.click(within(archivedRow).getByRole('button', { name: '彻底删除' }))
    expect(host.calls).toContain('purge:session-2')
  })
})
