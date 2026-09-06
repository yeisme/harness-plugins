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

import { createHash } from 'node:crypto'

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
import {
  COMPOSER_REFERENCE_OWNER_CONTEXT_KEY,
  createFileHostPlaceholder,
  type ComposerReferenceOwnerClaimV1,
  type ComposerReferenceOwnerRegistryV1,
  type FileHostV1,
} from '@yeisme/dsh-file-host'
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

interface AgentRegistryFace {
  get(sessionId: string): unknown
}

interface TerminalRegistryFace {
  list(owner: unknown): readonly { readonly sessionId: string; readonly name?: string; readonly type: string; readonly status: unknown }[]
  read(owner: unknown, terminalId: string, request: { readonly offset?: number; readonly count?: number }): {
    readonly text: string
    readonly totalLines: number
    readonly lineBegin: number
    readonly lineEnd: number
    readonly truncated: boolean
  }
}

/** Structural Cordis face this bundle's node half consumes. */
type DesktopWorkbenchNodeContext = {
  webServer?: WebServerFace
  sessions?: SessionStoreFace
  get?(name: string): unknown
} & Partial<SessionManagerHostPluginContext>

function sessionCwdOf(ctx: DesktopWorkbenchNodeContext, sessionId?: string, clientCwd?: string): string | undefined {
  try {
    const sessions = (ctx.sessions ?? ctx.get?.('sessions')) as SessionStoreFace | undefined
    if (sessionId !== undefined && sessions?.get !== undefined) {
      const headerCwd = sessions.get(sessionId)?.header?.cwd
      if (headerCwd !== undefined && headerCwd !== '') return headerCwd
    }
  } catch {
    // Missing session store is an unavailable owner for opaque requests.
  }
  // A session id always selects its server-owned workspace.  Legacy callers
  // still carry `cwd`, but it is descriptive only once a session is present:
  // accepting it as authority would let a browser retarget the file owner.
  if (sessionId !== undefined) return undefined
  // Pre-session legacy calls remain available for the local host workspace.
  // Do not make a browser-supplied absolute path an authority boundary.
  void clientCwd
  return process.cwd()
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
  const referenceOwners: ComposerReferenceOwnerRegistryV1 = {
    version: 1,
    async resolve(input, signal) {
      signal.throwIfAborted()
      if (input.reference.owner === 'dsh.local') {
        return opaqueRefs.resolveComposerReference(input.cwd, input.reference, signal)
      }
      if (input.reference.owner !== 'dsh.terminal' || input.reference.kind !== 'terminal'
        || input.reference.intent !== 'content' || input.reference.scope !== 'terminal/scrollback'
        || input.reference.window !== undefined || input.reference.region !== undefined) return undefined
      const agents = ctx.get?.('agents') as AgentRegistryFace | undefined
      const terminals = ctx.get?.('terminals') as TerminalRegistryFace | undefined
      const owner = agents?.get(input.sessionId)
      if (owner === undefined || terminals === undefined) return undefined
      const row = terminals.list(owner).find(candidate => candidate.sessionId === input.reference.ref)
      if (row === undefined) return undefined
      const read = terminals.read(owner, row.sessionId, { offset: 0, count: 200 })
      const proof = terminalReferenceProof(row, read)
      if (proof.version !== input.reference.version || proof.digest !== input.reference.digest) return undefined
      return {
        id: input.reference.id,
        owner: 'dsh.terminal',
        ref: input.reference.ref,
        kind: 'terminal',
        intent: 'content',
        version: proof.version,
        digest: proof.digest,
        scope: 'terminal/scrollback',
        label: row.name ?? row.sessionId,
        preview: read.text.replace(/\s+/gu, ' ').trim().slice(0, 240),
        snapshot: { type: 'terminal', text: read.text.slice(0, 16_384), truncated: read.truncated || read.text.length > 16_384 },
      }
    },
  }
  const unprovideReferenceOwners = ctx.provide?.(COMPOSER_REFERENCE_OWNER_CONTEXT_KEY, referenceOwners)
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
    if (typeof unprovideReferenceOwners === 'function') unprovideReferenceOwners()
    if (typeof unprovide === 'function') unprovide()
    for (const teardown of disposers) teardown()
  }
}

function terminalReferenceProof(
  row: { readonly sessionId: string; readonly type: string; readonly status: unknown },
  read: { readonly text: string; readonly totalLines: number; readonly lineBegin: number; readonly lineEnd: number; readonly truncated: boolean },
): Pick<ComposerReferenceOwnerClaimV1, 'version' | 'digest'> {
  const value = JSON.stringify({ id: row.sessionId, type: row.type, status: row.status, totalLines: read.totalLines, lineBegin: read.lineBegin, lineEnd: read.lineEnd, truncated: read.truncated, text: read.text })
  const digest = createHash('sha256').update(value).digest('hex')
  return { version: `sha256:${digest}`, digest }
}

const DesktopWorkbenchPlugin = { name, inject, apply }

export default DesktopWorkbenchPlugin
