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
/** Create a log-backed label snapshot event. */
export function createSessionLabelsEvent(input) {
    return {
        type: 'session/labels',
        sessionId: input.sessionId,
        labels: [...input.labels],
        revision: input.revision,
        updatedAt: input.updatedAt ?? new Date().toISOString(),
        source: input.source ?? 'user',
    };
}
/** Wrap DSH seam callbacks as a `SessionManagerHostV1`. */
export function createSessionManagerHost(seams) {
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
    };
}
function notImplemented(sessionId) {
    return { status: 'not_implemented', sessionId, reason: 'host adapter not wired yet' };
}
/** Placeholder host adapter used until real DSH services are wired. */
export function createSessionManagerHostPlaceholder() {
    return createSessionManagerHost({
        async listSessions() {
            return [];
        },
        async archiveSession(sessionId) {
            return notImplemented(sessionId);
        },
        async restoreSession(sessionId) {
            return notImplemented(sessionId);
        },
        async trashSession(sessionId) {
            return notImplemented(sessionId);
        },
        async purgeSession(sessionId) {
            return notImplemented(sessionId);
        },
        async setLabels(sessionId) {
            return notImplemented(sessionId);
        },
        async pauseSession(sessionId) {
            return notImplemented(sessionId);
        },
        async resumeSession(sessionId) {
            return notImplemented(sessionId);
        },
        async forkSession(sessionId) {
            return { ...notImplemented(sessionId), childSessionId: undefined };
        },
    });
}
