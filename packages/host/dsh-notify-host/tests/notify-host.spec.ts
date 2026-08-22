import { describe, expect, it } from 'vitest'
import { createNotificationHost, createNotificationHostPlaceholder, type DshNotificationSeams, type NotificationEventV1, type NotificationHostV1 } from '../src/index.ts'

const events: readonly NotificationEventV1[] = [
  { id: 'n-1', kind: 'approval', title: '需要审批', timestamp: '2026-08-19T00:00:00.000Z', read: false },
]

function fakeSeams(): DshNotificationSeams & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
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
}

describe('@yeisme/dsh-notify-host', () => {
  it('exposes a versioned host contract', () => {
    const host: NotificationHostV1 = createNotificationHostPlaceholder()
    expect(host.version).toBe('0.1.0-rc.1')
    expect(host.capability).toBe('notify-host')
  })

  it('returns empty list and typed not_implemented from placeholder', async () => {
    const host = createNotificationHostPlaceholder()
    await expect(host.listNotifications()).resolves.toEqual([])
    await expect(host.markRead('n-1')).resolves.toMatchObject({ status: 'not_implemented' })
  })

  it('delegates through the typed seam', async () => {
    const seams = fakeSeams()
    const host = createNotificationHost(seams)
    await expect(host.listNotifications()).resolves.toEqual(events)
    await host.markRead('n-1')
    await host.markAllRead()
    await host.clear()
    expect(seams.calls).toEqual(['list', 'read:n-1', 'readAll', 'clear'])
  })
})
