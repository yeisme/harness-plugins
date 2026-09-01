/**
 * @yeisme/dsh-session-manager host.
 *
 * This package exposes the host side of the self-maintained DSH session
 * manager. DSH remains the canonical owner of session logs, archive state,
 * labels, and lifecycle; this host adapts official DSH services through a
 * typed seam so the client stays testable and DSH-independent. The root also
 * carries the optional Cordis host plugin (`default` export) that mounts the
 * official-seam production adapter whenever the DSH services are live.
 *
 * @module @yeisme/dsh-session-manager
 */

import {
  createOfficialSeamsSessionManagerHost,
  sessionManagerSeamGaps,
} from './adapter.ts'

export interface SessionSummaryV1 {
  /** Opaque DSH session id. */
  readonly sessionId: string
  /** Safe display title, when known. */
  readonly title?: string | undefined
  /** Opaque workspace ref, when known. */
  readonly workspaceRef?: string | undefined
  /** Safe workspace display name, when known. */
  readonly workspaceName?: string | undefined
  /** Whether the session is archived. */
  readonly archived: boolean
  /** Whether the session is currently running. */
  readonly running: boolean
  /** Whether the session has an unread notification. */
  readonly unread: boolean
  /** Whether DSH is waiting for user interaction. */
  readonly pendingInteraction?: boolean | undefined
  /** Whether DSH reported the session as completed. */
  readonly completed?: boolean | undefined
  /** User labels attached to this session. */
  readonly labels: readonly string[]
  /** ISO timestamp of the last update, when known. */
  readonly updatedAt?: string | undefined
  /** Opaque parent session id when this row is a rewrite/fork child. */
  readonly parentSessionId?: string | undefined
  /** How the child session was created. Unknown origins stay unlabeled as original. */
  readonly origin?: 'edit' | 'retry' | 'fork' | undefined
}

export type SessionMutationStatus = 'ok' | 'not_implemented' | 'rejected'

export interface SessionMutationReceiptV1 {
  readonly status: SessionMutationStatus
  readonly sessionId: string
  /** Typed failure/skip reason; absent when status is ok. */
  readonly reason?: string
}

export interface SessionForkReceiptV1 extends SessionMutationReceiptV1 {
  /** Opaque child session id when a fork was created. */
  readonly childSessionId?: string
}

export interface SessionLabelsEventV1 {
  /** Stable event type, matching the planned DSH `session/labels` event. */
  readonly type: 'session/labels'
  /** Opaque DSH session id. */
  readonly sessionId: string
  /** Complete normalized label snapshot. */
  readonly labels: readonly string[]
  /** Monotonic revision for optimistic concurrency. */
  readonly revision: number
  /** ISO timestamp of the label update. */
  readonly updatedAt: string
  /** Who authored the label snapshot. */
  readonly source: 'user' | 'fork'
}

/** Create a log-backed label snapshot event. */
export function createSessionLabelsEvent(input: {
  sessionId: string
  labels: readonly string[]
  revision: number
  updatedAt?: string
  source?: 'user' | 'fork'
}): SessionLabelsEventV1 {
  return {
    type: 'session/labels',
    sessionId: input.sessionId,
    labels: [...input.labels],
    revision: input.revision,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    source: input.source ?? 'user',
  }
}

export interface SessionManagerHostV1 {
  readonly version: '0.1.0-rc.1'
  readonly capability: 'session-manager'
  /** Lists all sessions visible to the current profile. */
  listSessions(): Promise<readonly SessionSummaryV1[]>
  /** Archives a session. */
  archiveSession(sessionId: string): Promise<SessionMutationReceiptV1>
  /** Restores an archived session. */
  restoreSession(sessionId: string): Promise<SessionMutationReceiptV1>
  /** Moves a session to the trash/archive recycle area. */
  trashSession(sessionId: string): Promise<SessionMutationReceiptV1>
  /** Permanently purges a trashed session. */
  purgeSession(sessionId: string): Promise<SessionMutationReceiptV1>
  /** Replaces the user label snapshot for a session. */
  setLabels(sessionId: string, labels: readonly string[], expectedRevision?: number): Promise<SessionMutationReceiptV1>
  /** Pauses a running session's current turn. */
  pauseSession(sessionId: string): Promise<SessionMutationReceiptV1>
  /** Resumes/continues a paused or idle session. */
  resumeSession(sessionId: string): Promise<SessionMutationReceiptV1>
  /** Forks a child session from the given session. */
  forkSession(sessionId: string): Promise<SessionForkReceiptV1>
}

/**
 * Typed seam into DSH owner services. This keeps the host contract pure and
 * testable; the production adapter maps these callbacks onto the official
 * `ctx.sessionPersistence`, `ctx.workspaceRegistry`, and `ctx.agents` services
 * (see `createOfficialSeamsSessionManagerSeams`; labels stay with the
 * sessionTags storageDomain sidecar).
 */
export interface DshSessionManagerSeams {
  listSessions(): Promise<readonly SessionSummaryV1[]>
  archiveSession(sessionId: string): Promise<SessionMutationReceiptV1>
  restoreSession(sessionId: string): Promise<SessionMutationReceiptV1>
  trashSession(sessionId: string): Promise<SessionMutationReceiptV1>
  purgeSession(sessionId: string): Promise<SessionMutationReceiptV1>
  setLabels(sessionId: string, labels: readonly string[], expectedRevision?: number): Promise<SessionMutationReceiptV1>
  pauseSession(sessionId: string): Promise<SessionMutationReceiptV1>
  resumeSession(sessionId: string): Promise<SessionMutationReceiptV1>
  forkSession(sessionId: string): Promise<SessionForkReceiptV1>
}

/** Wrap DSH seam callbacks as a `SessionManagerHostV1`. */
export function createSessionManagerHost(seams: DshSessionManagerSeams): SessionManagerHostV1 {
  return {
    version: '0.1.0-rc.1',
    capability: 'session-manager',
    listSessions: seams.listSessions,
    archiveSession: seams.archiveSession,
    restoreSession: seams.restoreSession,
    trashSession: seams.trashSession,
    purgeSession: seams.purgeSession,
    setLabels: seams.setLabels,
    pauseSession: seams.pauseSession,
    resumeSession: seams.resumeSession,
    forkSession: seams.forkSession,
  }
}

function notImplemented(sessionId: string): SessionMutationReceiptV1 {
  return { status: 'not_implemented', sessionId, reason: 'host adapter not wired yet' }
}

/** Placeholder host adapter used until real DSH services are wired. */
export function createSessionManagerHostPlaceholder(): SessionManagerHostV1 {
  return createSessionManagerHost({
    async listSessions() {
      return []
    },
    async archiveSession(sessionId) {
      return notImplemented(sessionId)
    },
    async restoreSession(sessionId) {
      return notImplemented(sessionId)
    },
    async trashSession(sessionId) {
      return notImplemented(sessionId)
    },
    async purgeSession(sessionId) {
      return notImplemented(sessionId)
    },
    async setLabels(sessionId) {
      return notImplemented(sessionId)
    },
    async pauseSession(sessionId) {
      return notImplemented(sessionId)
    },
    async resumeSession(sessionId) {
      return notImplemented(sessionId)
    },
    async forkSession(sessionId) {
      return notImplemented(sessionId)
    },
  })
}

/**
 * Optional Cordis context key used by Desktop Workbench when the host plugin
 * has mounted a real owner-backed session manager service.
 */
export const SESSION_MANAGER_HOST_CONTEXT_KEY = 'dsh.sessionManagerHost' as const

/** Runtime guard for an owner-provided `SessionManagerHostV1` service. */
export function isSessionManagerHostV1(value: unknown): value is SessionManagerHostV1 {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<SessionManagerHostV1>
  return candidate.version === '0.1.0-rc.1'
    && candidate.capability === 'session-manager'
    && typeof candidate.listSessions === 'function'
    && typeof candidate.archiveSession === 'function'
    && typeof candidate.restoreSession === 'function'
    && typeof candidate.trashSession === 'function'
    && typeof candidate.purgeSession === 'function'
    && typeof candidate.setLabels === 'function'
    && typeof candidate.pauseSession === 'function'
    && typeof candidate.resumeSession === 'function'
    && typeof candidate.forkSession === 'function'
}

let boundSessionManagerHost: SessionManagerHostV1 | undefined

/**
 * Late-bind a real session manager service for default host resolution.
 * Hosts and plugins call this when an owner-backed service is live; the
 * returned disposer restores the placeholder default.
 */
export function bindSessionManagerHost(host: SessionManagerHostV1): () => void {
  boundSessionManagerHost = host
  return () => {
    if (boundSessionManagerHost === host) boundSessionManagerHost = undefined
  }
}

/**
 * Resolve the default session manager host: the plugin- or host-bound real
 * service when one is live, otherwise the honest placeholder (empty list
 * plus `not_implemented` receipts). Consumers that already hold a host
 * instance keep passing it explicitly.
 */
export function resolveSessionManagerHost(): SessionManagerHostV1 {
  return boundSessionManagerHost ?? createSessionManagerHostPlaceholder()
}

export {
  createOfficialSeamsSessionManagerHost,
  createOfficialSeamsSessionManagerSeams,
  sessionManagerSeamGaps,
} from './adapter.ts'
export type {
  DshSessionManagerSeamSources,
  OfficialCreateAgentOptions,
  OfficialSessionEventFace,
  OfficialSessionHeaderFace,
  OfficialSessionRecordFace,
} from './adapter.ts'

/**
 * Minimal structural Cordis face the host plugin needs. Official seam names
 * are probed dynamically (published DSH releases may lack them), so the
 * package carries no static cordis dependency. Every member is optional:
 * a context without `inject` simply keeps the placeholder default.
 */
export interface SessionManagerHostPluginContext {
  inject?(names: readonly string[], callback: (child: SessionManagerHostPluginContext) => void | (() => void)): unknown
  provide?(key: string, service: unknown): (() => void) | void
  effect?(setup: () => () => void, label?: string): unknown
  get?(name: string): unknown
}

/** Cordis plugin name. */
export const name = 'dsh-session-manager-host'

/** No static dependencies: official seams are probed dynamically. */
export const inject = [] as const

/** Official seam names probed by {@link apply}. */
const OFFICIAL_SESSION_SEAMS = ['sessionPersistence', 'workspaceRegistry', 'agents'] as const

function optionalSeam(ctx: SessionManagerHostPluginContext, seamName: string): unknown {
  try {
    return ctx.get?.(seamName)
  } catch {
    // Optional enrichment seam absent; rows stay honest without it.
    return undefined
  }
}

/**
 * Host plugin entry: when the official `sessionPersistence`, `workspaceRegistry`,
 * and `agents` services are all live with the expected shape, mount the
 * official-seam adapter as the resolved default host and provide it on
 * `SESSION_MANAGER_HOST_CONTEXT_KEY`. Missing or shape-drifted seams keep the
 * placeholder default (empty list, typed `not_implemented` receipts), matching
 * the terminal-host dynamic-inject precedent: the plugin still loads.
 *
 * When `ctx.effect` is available the adapter lifecycle rides the plugin fiber
 * (HMR and owner unload dispose it); the returned disposer is idempotent and
 * safe to call from either path.
 */
export function apply(ctx: SessionManagerHostPluginContext): () => void {
  let disposeInject: (() => void) | undefined
  let disposed = false
  const teardown = (): void => {
    if (disposed) return
    disposed = true
    disposeInject?.()
  }
  const wire = (): void => {
    if (typeof ctx.inject !== 'function') return
    const dispose = ctx.inject(OFFICIAL_SESSION_SEAMS, child => {
      const record = child as unknown as Record<string, unknown>
      const sources = {
        sessionPersistence: record['sessionPersistence'],
        workspaceRegistry: record['workspaceRegistry'],
        agents: record['agents'],
        sessionQuery: optionalSeam(child, 'sessionQuery'),
      }
      if (sessionManagerSeamGaps(sources).length > 0) {
        // Shape drift: stay on the placeholder default rather than guessing.
        return
      }
      const host = createOfficialSeamsSessionManagerHost(sources)
      const unbind = bindSessionManagerHost(host)
      const unprovide = child.provide?.(SESSION_MANAGER_HOST_CONTEXT_KEY, host)
      return () => {
        if (typeof unprovide === 'function') unprovide()
        unbind()
      }
    })
    if (typeof dispose === 'function') disposeInject = dispose as () => void
  }
  if (typeof ctx.effect === 'function') {
    ctx.effect(() => {
      wire()
      return teardown
    }, 'dsh-session-manager-host: official seam adapter lifecycle')
  } else {
    wire()
  }
  return teardown
}

const DshSessionManagerHostPlugin = { name, inject, apply }
export default DshSessionManagerHostPlugin
