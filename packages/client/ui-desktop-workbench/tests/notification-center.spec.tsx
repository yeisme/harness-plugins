// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NotificationCenter } from '../src/client/notification-center.tsx'
import type { NotificationEventV1, NotificationHostV1 } from '@yeisme/dsh-notify-host'

afterEach(cleanup)

const events: readonly NotificationEventV1[] = [
  { id: 'n-1', kind: 'approval', title: '需要审批', summary: 'run #12', timestamp: '2026-08-19T00:00:00.000Z', read: false },
  { id: 'n-2', kind: 'completed', title: '任务完成', timestamp: '2026-08-19T01:00:00.000Z', read: true },
]

function fakeHost(): NotificationHostV1 & { calls: string[] } {
  const calls: string[] = []
  const host: NotificationHostV1 = {
    version: '0.1.0-rc.1',
    capability: 'notify-host',
    async listNotifications() {
      calls.push('list')
      return events
    },
    async markRead(id) {
      calls.push(`read:${id}`)
      return { status: 'ok', notificationId: id }
    },
    async markAllRead() {
      calls.push('readAll')
      return { status: 'ok' }
    },
    async clear() {
      calls.push('clear')
      return { status: 'ok' }
    },
  }
  return { ...host, calls }
}

describe('NotificationCenter', () => {
  it('renders unread count and notification list', async () => {
    render(<NotificationCenter host={fakeHost()} />)
    expect(await screen.findByText('通知（1）')).toBeTruthy()
    expect(screen.getByText('需要审批')).toBeTruthy()
    expect(screen.getByText('任务完成')).toBeTruthy()
  })

  it('marks read, marks all read, and clears through the host', async () => {
    const host = fakeHost()
    render(<NotificationCenter host={host} />)
    await screen.findByText('需要审批')
    fireEvent.click(screen.getByRole('button', { name: '标记已读' }))
    fireEvent.click(screen.getByRole('button', { name: '全部已读' }))
    fireEvent.click(screen.getByRole('button', { name: '清理' }))
    expect(host.calls).toContain('read:n-1')
    expect(host.calls).toContain('readAll')
    expect(host.calls).toContain('clear')
  })
})
