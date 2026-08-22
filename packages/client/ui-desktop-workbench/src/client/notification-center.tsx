/**
 * Notification Center for the Desktop Workbench.
 *
 * This component consumes a `NotificationHostV1` and renders a read/unread
 * notification list with mark-read, mark-all-read, and clear actions. It does
 * not listen to DSH events directly; the host owns the event queue.
 *
 * @module @yeisme/dsh-client-ui-desktop-workbench/client
 */

import { useEffect, useState } from 'react'
import type { NotificationHostV1, NotificationEventV1 } from '@yeisme/dsh-notify-host'

export interface NotificationCenterProps {
  /** Notification host adapter. */
  host: NotificationHostV1
}

export function NotificationCenter({ host }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<readonly NotificationEventV1[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      setNotifications(await host.listNotifications())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host])

  const run = async (action: () => Promise<unknown>): Promise<void> => {
    await action()
    await refresh()
  }

  const unreadCount = notifications.filter(notification => !notification.read).length

  return (
    <section aria-label="Notifications" data-dsh-notification-center>
      <header data-dsh-panel-heading>
        <div>
          <h2>通知{unreadCount > 0 ? `（${unreadCount}）` : ''}</h2>
          <p>集中查看审批、任务与 Agent 完成事件。</p>
        </div>
        <div data-dsh-notification-actions>
          <button type="button" onClick={() => void run(() => host.markAllRead())}>全部已读</button>
          <button type="button" onClick={() => void run(() => host.clear())}>清理</button>
        </div>
      </header>
      {loading && <div data-dsh-panel-empty><strong>正在加载通知</strong><span>请稍候…</span></div>}
      {error !== null && <div role="alert" data-dsh-panel-empty><strong>通知加载失败</strong><span>{error}</span></div>}
      {notifications.length === 0 && !loading && error === null && (
        <div data-dsh-panel-empty>
          <strong>暂时没有新通知</strong>
          <span>需要处理的审批和已完成任务会显示在这里。</span>
        </div>
      )}
      {notifications.length > 0 && (
        <ul>
          {notifications.map(notification => (
            <li key={notification.id} data-read={notification.read || undefined}>
              <strong>{notification.title}</strong>
              {notification.summary !== undefined && <span>{notification.summary}</span>}
              {!notification.read && (
                <button type="button" onClick={() => void run(() => host.markRead(notification.id))}>标记已读</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default NotificationCenter
