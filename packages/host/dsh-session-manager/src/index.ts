/**
 * @yeisme/dsh-session-manager host.
 *
 * This package exposes the host side of the self-maintained DSH session
 * manager. DSH remains the canonical owner of session logs, archive state,
 * labels, and lifecycle; this host adapts official DSH services through a
 * typed seam so the client stays testable and DSH-independent.
 *
 * @module @yeisme/dsh-session-manager
 */

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
 * testable; a real DSH adapter maps these callbacks onto `ctx.sessionPersistence`,
 * `ctx.workspaceRegistry`, `ctx.agents`, and `ctx.storageDomain`.
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
      return { ...notImplemented(sessionId), childSessionId: undefined }
    },
  })
}
