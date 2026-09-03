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
  apply as applySessionManagerHost,
  createSessionManagerHost,
  createSessionManagerHostPlaceholder,
  resolveSessionManagerHost,
  type DshSessionManagerSeams,
  type SessionForkReceiptV1,
  type SessionManagerHostPluginContext,
  type SessionManagerHostV1,
  type SessionMutationReceiptV1,
  type SessionMutationStatus,
  type SessionSummaryV1,
} from '@yeisme/dsh-session-manager'
import { createFileHostPlaceholder, type FileHostV1 } from '@yeisme/dsh-file-host'
import { createOpaqueFileRefRegistry, FILE_OPAQUE_REF_HOST_CONTEXT_KEY, handleYeismeFilesApi, NodeFileResourceMutationOwner, NodeFileTransferOwner } from '@yeisme/dsh-file-host/node'
import { createTerminalHostPlaceholder, type TerminalHostV1, type TerminalHostV2 } from '@yeisme/dsh-terminal-host'
import { createNotificationHostPlaceholder, type NotificationHostV1 } from '@yeisme/dsh-notify-host'

/**
 * Bundle descriptor. The `hosts` accessors resolve late: the session host
 * prefers the plugin- or host-bound real service (official DSH seams wired by
 * the session-manager host plugin) and falls back to the honest placeholder.
 */
export const desktopWorkbenchBundleV1: {
  readonly id: 'dsh-desktop-workbench'
  readonly version: '0.1.0-rc.1'
  readonly module: typeof desktopWorkbenchModule
  readonly hosts: {
    readonly session: SessionManagerHostV1
    readonly file: FileHostV1
    readonly terminal: TerminalHostV1
    readonly notify: NotificationHostV1
  }
} = {
  id: 'dsh-desktop-workbench',
  version: '0.1.0-rc.1',
  module: desktopWorkbenchModule,
  hosts: {
    get session() { return resolveSessionManagerHost() },
    get file() { return createFileHostPlaceholder() },
    get terminal() { return createTerminalHostPlaceholder() },
    get notify() { return createNotificationHostPlaceholder() },
  },
}

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

/** Structural Cordis face this bundle's node half consumes. */
type DesktopWorkbenchNodeContext = {
  webServer?: WebServerFace
  sessions?: SessionStoreFace
  get?(name: string): unknown
} & Partial<SessionManagerHostPluginContext>

function sessionCwdOf(ctx: DesktopWorkbenchNodeContext, sessionId?: string, clientCwd?: string): string | undefined {
  if (clientCwd !== undefined && clientCwd !== '') return clientCwd
  try {
    const sessions = (ctx.sessions ?? ctx.get?.('sessions')) as SessionStoreFace | undefined
    if (sessionId !== undefined && sessions?.get !== undefined) {
      const headerCwd = sessions.get(sessionId)?.header?.cwd
      if (headerCwd !== undefined && headerCwd !== '') return headerCwd
    }
  } catch {
    // Missing session store is an unavailable owner for opaque requests.
  }
  // Legacy path-backed calls may still explicitly provide client cwd. Opaque
  // V2 callers must fail closed instead of reading process.cwd().
  return sessionId === undefined ? process.cwd() : undefined
}

/**
 * Node half: fenced workspace explorer API used by the File Pane, plus the
 * session-manager host plugin that wires the official `sessionPersistence`,
 * `workspaceRegistry`, and `agents` seams into the default session host when
 * they are live. The plugin loads even when a seam is absent; consumers then
 * keep the honest placeholder default.
 *
 * The explorer API is adapted from DSH-better-sidebar `fs.tree` / `fs.read`,
 * served at `/yeisme-files/api` so it does not collide with `/sidebar/api`.
 */
export function apply(ctx: DesktopWorkbenchNodeContext): () => void {
  const disposeSessionHostPlugin = applySessionManagerHost(ctx)
  const disposers: Array<() => void> = [disposeSessionHostPlugin]
  const webServer = (ctx.webServer ?? ctx.get?.('webServer')) as WebServerFace | undefined
  if (webServer === undefined || typeof webServer.register !== 'function') {
    return () => {
      for (const dispose of disposers.reverse()) dispose()
    }
  }
  const opaqueRefs = createOpaqueFileRefRegistry()
  const mutationOwners = new Map<string, NodeFileResourceMutationOwner>()
  const transferOwners = new Map<string, NodeFileTransferOwner>()
  const mutationOwner = (cwd: string): NodeFileResourceMutationOwner => {
    let owner = mutationOwners.get(cwd)
    if (owner === undefined) { owner = new NodeFileResourceMutationOwner(cwd, opaqueRefs); mutationOwners.set(cwd, owner) }
    return owner
  }
  const transferOwner = (cwd: string): NodeFileTransferOwner => {
    let owner = transferOwners.get(cwd)
    if (owner === undefined) { owner = new NodeFileTransferOwner(cwd, opaqueRefs); transferOwners.set(cwd, owner) }
    return owner
  }
  const unprovide = ctx.provide?.(FILE_OPAQUE_REF_HOST_CONTEXT_KEY, opaqueRefs)
  const dispose = webServer.register({
    kind: 'prefix',
    path: '/yeisme-files/api',
    handler: (req, res) => handleYeismeFilesApi(req as never, res as never, {
      sessionCwd: (sessionId, clientCwd) => sessionCwdOf(ctx, sessionId, clientCwd),
      opaqueRefs,
      mutationOwner,
      transferOwner,
    }),
  })
  return () => {
    dispose()
    if (typeof unprovide === 'function') unprovide()
    for (const teardown of disposers) teardown()
  }
}

const DesktopWorkbenchPlugin = { name, inject, apply }

export default DesktopWorkbenchPlugin
