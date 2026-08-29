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
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceState } from '@yeisme/dsh-client-ui-surface'
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
    <Surface kind="navigator" aria-label="Notifications" data-dsh-notification-center>
      <SurfaceContextBar title={`通知${unreadCount > 0 ? `（${unreadCount}）` : ''}`} description="集中查看审批、任务与 Agent 完成事件。" actions={<span data-dsh-notification-actions><Button type="button" size="sm" variant="toolbar" onClick={() => void run(() => host.markAllRead())}>全部已读</Button><Button type="button" size="sm" variant="toolbar" onClick={() => void run(() => host.clear())}>清理</Button></span>} />
      <div className="ys-body">
      {loading && <SurfaceState phase="loading" title="正在加载通知" description="请稍候…" data-dsh-panel-empty />}
      {error !== null && <SurfaceState phase="error" title="通知加载失败" description={error} data-dsh-panel-empty />}
      {notifications.length === 0 && !loading && error === null && (
        <SurfaceState phase="empty" title="暂时没有新通知" description="需要处理的审批和已完成任务会显示在这里。" data-dsh-panel-empty />
      )}
      {notifications.length > 0 && (
        <ul>
          {notifications.map(notification => (
            <li key={notification.id} data-read={notification.read || undefined}>
              <strong>{notification.title}</strong>
              {notification.summary !== undefined && <span>{notification.summary}</span>}
              {!notification.read && (
                <Button type="button" size="sm" variant="toolbar" onClick={() => void run(() => host.markRead(notification.id))}>标记已读</Button>
              )}
            </li>
          ))}
        </ul>
      )}
      </div>
    </Surface>
  )
}

export default NotificationCenter
