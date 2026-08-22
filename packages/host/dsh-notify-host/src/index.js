/**
 * @yeisme/dsh-notify-host.
 *
 * This package exposes the host side of event notifications for the desktop
 * workbench. It listens to DSH turn/approval/subagent/workflow events through
 * a typed seam and exposes a safe notification list to the client.
 *
 * @module @yeisme/dsh-notify-host
 */
export function createNotificationHost(seams) {
    return {
        version: '0.1.0-rc.1',
        capability: 'notify-host',
        listNotifications: seams.listNotifications,
        markRead: seams.markRead,
        markAllRead: seams.markAllRead,
        clear: seams.clear,
    };
}
function notImplemented() {
    return { status: 'not_implemented', reason: 'host adapter not wired yet' };
}
export function createNotificationHostPlaceholder() {
    return createNotificationHost({
        async listNotifications() {
            return [];
        },
        async markRead() {
            return notImplemented();
        },
        async markAllRead() {
            return notImplemented();
        },
        async clear() {
            return notImplemented();
        },
    });
}
