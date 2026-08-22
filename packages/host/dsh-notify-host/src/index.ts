/**
 * @yeisme/dsh-notify-host.
 *
 * This package exposes the host side of event notifications for the desktop
 * workbench. It listens to DSH turn/approval/subagent/workflow events through
 * a typed seam and exposes a safe notification list to the client.
 *
 * @module @yeisme/dsh-notify-host
 */

export type NotificationKindV1 =
  | 'completed'
  | 'error'
  | 'approval'
  | 'blocked'
  | 'interrupted'
  | 'max_tokens'
  | 'background_job'

export interface NotificationEventV1 {
  /** Stable notification id. */
  readonly id: string
  readonly kind: NotificationKindV1
  /** Safe display title. */
  readonly title: string
  /** Bounded safe summary. */
  readonly summary?: string | undefined
  /** Opaque session id when the notification is session-bound. */
  readonly sessionId?: string | undefined
  /** ISO timestamp. */
  readonly timestamp: string
  /** Whether the user has marked it read. */
  readonly read: boolean
}

export type NotificationMutationStatus = 'ok' | 'not_implemented' | 'rejected'

export interface NotificationMutationReceiptV1 {
  readonly status: NotificationMutationStatus
  readonly notificationId?: string | undefined
  readonly reason?: string
}

export interface NotificationHostV1 {
  readonly version: '0.1.0-rc.1'
  readonly capability: 'notify-host'
  /** Lists notifications, newest first. */
  listNotifications(): Promise<readonly NotificationEventV1[]>
  /** Marks a single notification read. */
  markRead(notificationId: string): Promise<NotificationMutationReceiptV1>
  /** Marks all notifications read. */
  markAllRead(): Promise<NotificationMutationReceiptV1>
  /** Clears all notifications from the queue. */
  clear(): Promise<NotificationMutationReceiptV1>
}

export interface DshNotificationSeams {
  listNotifications(): Promise<readonly NotificationEventV1[]>
  markRead(notificationId: string): Promise<NotificationMutationReceiptV1>
  markAllRead(): Promise<NotificationMutationReceiptV1>
  clear(): Promise<NotificationMutationReceiptV1>
}

export function createNotificationHost(seams: DshNotificationSeams): NotificationHostV1 {
  return {
    version: '0.1.0-rc.1',
    capability: 'notify-host',
    listNotifications: seams.listNotifications,
    markRead: seams.markRead,
    markAllRead: seams.markAllRead,
    clear: seams.clear,
  }
}

function notImplemented(): NotificationMutationReceiptV1 {
  return { status: 'not_implemented', reason: 'host adapter not wired yet' }
}

export function createNotificationHostPlaceholder(): NotificationHostV1 {
  return createNotificationHost({
    async listNotifications() {
      return []
    },
    async markRead() {
      return notImplemented()
    },
    async markAllRead() {
      return notImplemented()
    },
    async clear() {
      return notImplemented()
    },
  })
}
