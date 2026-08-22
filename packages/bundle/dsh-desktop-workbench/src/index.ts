/**
 * @yeisme/dsh-desktop-workbench root entry.
 *
 * The node half mounts `/yeisme-files/api` (`fs.tree` / `fs.read`). Browser
 * UI is registered through the `dsh.client` manifest in `./client`. The root
 * also exposes host placeholder factories and the composed registry for
 * programmatic consumers.
 *
 * @module @yeisme/dsh-desktop-workbench
 */

import { desktopWorkbenchModule } from '@yeisme/dsh-client-ui-desktop-workbench'
import {
  createSessionManagerHost,
  createSessionManagerHostPlaceholder,
  type DshSessionManagerSeams,
  type SessionForkReceiptV1,
  type SessionManagerHostV1,
  type SessionMutationReceiptV1,
  type SessionMutationStatus,
  type SessionSummaryV1,
} from '@yeisme/dsh-session-manager'
import { createFileHostPlaceholder, type FileHostV1 } from '@yeisme/dsh-file-host'
import { handleYeismeFilesApi } from '@yeisme/dsh-file-host/node'
import { createTerminalHostPlaceholder, type TerminalHostV1, type TerminalHostV2 } from '@yeisme/dsh-terminal-host'
import { createNotificationHostPlaceholder, type NotificationHostV1 } from '@yeisme/dsh-notify-host'

export const desktopWorkbenchBundleV1 = {
  id: 'dsh-desktop-workbench',
  version: '0.1.0-rc.1',
  module: desktopWorkbenchModule,
  hosts: {
    session: createSessionManagerHostPlaceholder(),
    file: createFileHostPlaceholder(),
    terminal: createTerminalHostPlaceholder(),
    notify: createNotificationHostPlaceholder(),
  },
} as const

export type DesktopWorkbenchBundleV1 = typeof desktopWorkbenchBundleV1

export {
  createSessionManagerHost,
  createSessionManagerHostPlaceholder,
  createFileHostPlaceholder,
  createTerminalHostPlaceholder,
  createNotificationHostPlaceholder,
}
export type {
  DshSessionManagerSeams,
  FileHostV1,
  NotificationHostV1,
  SessionForkReceiptV1,
  SessionManagerHostV1,
  SessionMutationReceiptV1,
  SessionMutationStatus,
  SessionSummaryV1,
  TerminalHostV1,
  TerminalHostV2,
}
export { createDesktopWorkbenchRegistry } from './composed-registry.ts'

export const name = 'dsh-desktop-workbench'
export const inject = ['webServer', 'sessions']

interface WebServerFace {
  register(route: {
    kind: 'prefix' | 'exact'
    path: string
    handler: (req: unknown, res: unknown) => Promise<void> | void
  }): () => void
}

interface SessionStoreFace {
  get?(sessionId: string): { header?: { cwd?: string } } | undefined
}

function sessionCwdOf(ctx: { sessions?: SessionStoreFace; get?(name: string): unknown }, sessionId?: string, clientCwd?: string): string {
  if (clientCwd !== undefined && clientCwd !== '') return clientCwd
  try {
    const sessions = (ctx.sessions ?? ctx.get?.('sessions')) as SessionStoreFace | undefined
    if (sessionId !== undefined && sessions?.get !== undefined) {
      const headerCwd = sessions.get(sessionId)?.header?.cwd
      if (headerCwd !== undefined && headerCwd !== '') return headerCwd
    }
  } catch {
    // Missing session store falls through to process cwd.
  }
  return process.cwd()
}

/**
 * Node half: fenced workspace explorer API used by the File Pane.
 * Adapted from DSH-better-sidebar `fs.tree` / `fs.read`, served at
 * `/yeisme-files/api` so it does not collide with `/sidebar/api`.
 */
export function apply(ctx: { webServer?: WebServerFace; sessions?: SessionStoreFace; get?(name: string): unknown; effect?(fn: () => () => void): void }): () => void {
  const webServer = (ctx.webServer ?? ctx.get?.('webServer')) as WebServerFace | undefined
  if (webServer === undefined || typeof webServer.register !== 'function') return () => {}
  const dispose = webServer.register({
    kind: 'prefix',
    path: '/yeisme-files/api',
    handler: (req, res) => handleYeismeFilesApi(req as never, res as never, {
      sessionCwd: (sessionId, clientCwd) => sessionCwdOf(ctx, sessionId, clientCwd),
    }),
  })
  return dispose
}

const DesktopWorkbenchPlugin = { name, inject, apply }

export default DesktopWorkbenchPlugin
