/**
 * Read-only adapters from omdsh-style owner projections (model-provider
 * snapshot and account/session resume snapshot) to the panel's account
 * projections. Structural typing only: this package never imports the omdsh
 * package, and the adapters drop every field the panel must not see (reasons
 * and server-authored action refs stay host-side).
 *
 * @module @yeisme/dsh-client-ui-session-cookie-manager
 */

import type { AccountProjectionV1 } from './panel.tsx'

/** Minimal structural view of one omdsh provider group. */
export interface ProviderGroupLike {
  readonly id: string
  readonly name: string
  readonly status: 'available' | 'needs-key' | 'unavailable' | 'stale'
  readonly reason?: string
  readonly modelCount: number
}

/** Minimal structural view of one provider snapshot revision. */
export interface ProviderSnapshotLike {
  readonly revision: number
  readonly state: 'unavailable' | 'ready' | 'stale' | 'partial'
  readonly providers: readonly ProviderGroupLike[]
}

/**
 * Minimal structural view of one owner session summary (Resume Workspace
 * surface). `actionRefs` and `reason` are deliberately NOT part of this view:
 * resume actions stay server-authored behind the owner gateway, and failure
 * reasons stay host-side.
 */
export interface SessionSummaryLike {
  readonly ref: string
  readonly title: string
  readonly status: 'active' | 'idle' | 'running' | 'archived' | 'unknown'
  readonly updatedAt?: string
  readonly modelLabel?: string
  readonly enabled: boolean
}

/** Minimal structural view of one owner session-list snapshot revision. */
export interface SessionListSnapshotLike {
  readonly revision: number
  readonly state: 'unavailable' | 'ready' | 'stale' | 'partial'
  readonly sessions: readonly SessionSummaryLike[]
}

/** Map provider statuses onto account statuses; 'unavailable' snapshot yields none. */
export function providerSnapshotToAccounts(snapshot: ProviderSnapshotLike | undefined): readonly AccountProjectionV1[] {
  if (snapshot === undefined || snapshot.state === 'unavailable') return []
  return snapshot.providers.map(provider => ({
    provider: provider.name,
    accountSummary: `${provider.modelCount} model${provider.modelCount === 1 ? '' : 's'}`,
    status: provider.status === 'available' ? 'active' : provider.status === 'stale' ? 'expired' : 'unknown',
  }))
}

/** Map session statuses onto account statuses; owner-disabled rows are dropped. */
export function sessionSnapshotToAccounts(snapshot: SessionListSnapshotLike | undefined): readonly AccountProjectionV1[] {
  if (snapshot === undefined || snapshot.state === 'unavailable') return []
  return snapshot.sessions
    .filter(session => session.enabled)
    .map(session => ({
      provider: session.modelLabel ?? 'session',
      accountSummary: session.title,
      status: session.status === 'active' || session.status === 'running'
        ? 'active'
        : session.status === 'archived' ? 'expired' : 'unknown',
    }))
}

/**
 * Compose the read-only account panel rows from every existing owner
 * projection. Derived per call — the composition never caches snapshot state,
 * so the owners remain the single state source.
 */
export function composeAccountProjections(
  providerSnapshot: ProviderSnapshotLike | undefined,
  sessionSnapshot: SessionListSnapshotLike | undefined,
): readonly AccountProjectionV1[] {
  return [...providerSnapshotToAccounts(providerSnapshot), ...sessionSnapshotToAccounts(sessionSnapshot)]
}

interface OfficialSessionRowLike {
  readonly displayTitle?: string
  readonly running?: boolean
  readonly pendingInteraction?: unknown
  readonly completed?: boolean
  readonly updatedAt?: string
}

interface OfficialSessionListLike {
  readonly ids?: readonly string[]
  readonly byId?: Record<string, OfficialSessionRowLike | undefined>
  readonly current?: string
}

/**
 * Fold the official DSH `sessions.list` snapshot into the login-account
 * session projection. Missing or empty lists stay undefined (honest empty
 * accounts), never demo rows.
 */
export function officialSessionsToSnapshot(sessions: unknown): SessionListSnapshotLike | undefined {
  const list = asOfficialList(sessions)
  if (list === undefined) return undefined
  const ids = list.ids ?? Object.keys(list.byId ?? {})
  const rows: SessionSummaryLike[] = []
  for (const id of ids) {
    if (typeof id !== 'string' || id.trim() === '') continue
    const row = list.byId?.[id]
    const title = typeof row?.displayTitle === 'string' && row.displayTitle.trim() !== '' ? row.displayTitle : id
    const status: SessionSummaryLike['status'] = row?.running === true
      ? 'running'
      : row?.completed === true
        ? 'archived'
        : row?.pendingInteraction !== undefined
          ? 'active'
          : 'idle'
    rows.push({
      ref: id,
      title,
      status,
      ...(typeof row?.updatedAt === 'string' ? { updatedAt: row.updatedAt } : {}),
      enabled: true,
    })
  }
  return { revision: 1, state: 'ready', sessions: rows }
}

function asOfficialList(sessions: unknown): OfficialSessionListLike | undefined {
  if (sessions === null || typeof sessions !== 'object') return undefined
  const root = sessions as { list?: { getSnapshot?: () => unknown } }
  if (typeof root.list?.getSnapshot !== 'function') return undefined
  const snapshot = root.list.getSnapshot()
  if (snapshot === null || typeof snapshot !== 'object') return undefined
  return snapshot as OfficialSessionListLike
}
