/**
 * Official-seam production adapter for the DSH session manager host.
 *
 * Data sources (all probed structurally; DSH remains the canonical owner):
 * - `ctx.sessionPersistence` — session header corpus (metadata-only `list()`,
 *   raw prefix read via `readFrom()` for fork seeds; never a full-log fold).
 * - `ctx.workspaceRegistry` — durable workspace grouping, the archive set,
 *   and the durable `archiveSession` write.
 * - `ctx.agents` — live agent status for the running flag, plus the official
 *   `create()` factory used by fork.
 * - `ctx.sessionQuery` (optional) — live-preferred logical corpus and batched
 *   log-backed title folds. Absent it, rows list honestly without titles.
 *
 * Honesty contract: a face without an official seam degrades to the same
 * typed receipts as the placeholder (`not_implemented` with the missing-seam
 * reason); nothing is fabricated. User labels stay owned by the sessionTags
 * host sidecar, so `setLabels` is intentionally not wired here. `unread`
 * stays `false` (no notification seam exists) and rows without a folded title
 * keep `title` absent rather than guessing one.
 *
 * @module @yeisme/dsh-session-manager/adapter
 */

import type {
  DshSessionManagerSeams,
  SessionForkReceiptV1,
  SessionManagerHostV1,
  SessionMutationReceiptV1,
  SessionSummaryV1,
} from './index.ts'

/** Structural header face of `sessionPersistence.list()` rows. */
export interface OfficialSessionHeaderFace {
  readonly id: string
  readonly createdAt: number
  readonly cwd?: string
  readonly parentSession?: string
  readonly seedLength?: number
  readonly origin?: string
  readonly delegationDepth?: number
}

/** Structural record face of `sessionQuery.listSessions()` rows. */
export interface OfficialSessionRecordFace {
  readonly header: OfficialSessionHeaderFace
  readonly live: boolean
  readonly persisted: boolean
}

/** Minimal structural event face used only to locate turn boundaries. */
export interface OfficialSessionEventFace {
  readonly type?: unknown
}

/** Optional owner services handed to the adapter as opaque objects. */
export interface DshSessionManagerSeamSources {
  readonly sessionPersistence?: unknown
  readonly workspaceRegistry?: unknown
  readonly agents?: unknown
  readonly sessionQuery?: unknown
}

/** Structural face of the official session persistence service. */
interface SessionPersistenceFace {
  list(signal?: AbortSignal): Promise<readonly OfficialSessionHeaderFace[]>
  readFrom?(sessionId: string, fromSeq: number, signal?: AbortSignal): Promise<{
    meta: OfficialSessionHeaderFace
    events: readonly OfficialSessionEventFace[]
  }>
}

/** Structural face of one official workspace entity. */
interface OfficialWorkspaceFace {
  readonly id: string
  readonly title: string
  readonly path: string
  readonly sessionIds: readonly string[]
  attachSession?(sessionId: string): Promise<void>
}

/** Structural face of the official workspace registry (`ctx.workspaceRegistry`). */
interface WorkspaceRegistryFace {
  list(): readonly OfficialWorkspaceFace[]
  readonly archivedSessionIds: readonly string[]
  archiveSession(sessionId: string): Promise<void>
}

/** Structural face of one live official agent. */
interface OfficialAgentFace {
  readonly id: string
  readonly status: unknown
}

/** Structural face of the official agent registry (`ctx.agents`). */
interface AgentsFace {
  get(sessionId: string): OfficialAgentFace | undefined
  create?(options: OfficialCreateAgentOptions): Promise<unknown>
}

/** Structural options accepted by the official agent factory's `create()`. */
export interface OfficialCreateAgentOptions {
  readonly sessionId: string
  readonly meta?: {
    readonly cwd?: string
    readonly parentSession?: string
    readonly seedLength?: number
  }
  readonly seed?: readonly OfficialSessionEventFace[]
}

/** Structural face of the official session query engine (optional enrichment). */
interface SessionQueryFace {
  listSessions?(signal?: AbortSignal): Promise<readonly OfficialSessionRecordFace[]>
  readTitleSnapshots?(sessionIds: readonly string[], signal?: AbortSignal): Promise<readonly OfficialTitleObservationResultFace[]>
}

/** Structural title fold result of `sessionQuery.readTitleSnapshots()`. */
type OfficialTitleObservationResultFace = {
  readonly sessionId: string
  readonly status: 'fulfilled'
  readonly value: { readonly title?: { readonly title: string; readonly updatedAt: number } }
} | {
  readonly sessionId: string
  readonly status: 'rejected'
  readonly reason: unknown
}

function asPersistence(source: unknown): SessionPersistenceFace | undefined {
  if (source === null || typeof source !== 'object') return undefined
  const candidate = source as Partial<SessionPersistenceFace>
  return typeof candidate.list === 'function' ? (candidate as SessionPersistenceFace) : undefined
}

function asRegistry(source: unknown): WorkspaceRegistryFace | undefined {
  if (source === null || typeof source !== 'object') return undefined
  const candidate = source as Partial<WorkspaceRegistryFace>
  return typeof candidate.list === 'function'
    && typeof candidate.archivedSessionIds !== 'undefined'
    && typeof candidate.archiveSession === 'function'
    ? (candidate as WorkspaceRegistryFace) : undefined
}

function asAgents(source: unknown): AgentsFace | undefined {
  if (source === null || typeof source !== 'object') return undefined
  const candidate = source as Partial<AgentsFace>
  return typeof candidate.get === 'function' ? (candidate as AgentsFace) : undefined
}

function asQuery(source: unknown): SessionQueryFace | undefined {
  if (source === null || typeof source !== 'object') return undefined
  const candidate = source as Partial<SessionQueryFace>
  return typeof candidate.listSessions === 'function' || typeof candidate.readTitleSnapshots === 'function'
    ? (candidate as SessionQueryFace) : undefined
}

/** Required seams absent or shape-drifted; each entry names the missing face. */
export function sessionManagerSeamGaps(sources: DshSessionManagerSeamSources): readonly string[] {
  const gaps: string[] = []
  if (asPersistence(sources.sessionPersistence) === undefined) gaps.push('sessionPersistence.list')
  if (asRegistry(sources.workspaceRegistry) === undefined) gaps.push('workspaceRegistry.list+archive')
  if (asAgents(sources.agents) === undefined) gaps.push('agents.get')
  return gaps
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function notImplemented(sessionId: string, reason: string): SessionMutationReceiptV1 {
  return { status: 'not_implemented', sessionId, reason }
}

function rejected(sessionId: string, error: unknown): SessionMutationReceiptV1 {
  return { status: 'rejected', sessionId, reason: reasonOf(error) }
}

function basenameOf(cwd: string): string {
  return cwd.split(/[\\/]/).filter(Boolean).at(-1) ?? cwd
}

/** Fork child ids are fresh opaque ids minted locally for the official factory. */
function mintChildSessionId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi !== undefined && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  throw new Error('no crypto.randomUUID available to mint a fork session id')
}

/** Longest stored prefix that ends on a balanced turn boundary; no synthetic closers. */
function balancedSeedOf(events: readonly OfficialSessionEventFace[]): readonly OfficialSessionEventFace[] {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.type === 'turn/end') return events.slice(0, index + 1)
  }
  return []
}

/**
 * Build the typed seam set over official services. Missing required seams keep
 * placeholder semantics per face (empty list plus `not_implemented` receipts
 * naming the absent seam), so a half-wired host degrades exactly like the
 * placeholder instead of fabricating rows.
 */
export function createOfficialSeamsSessionManagerSeams(sources: DshSessionManagerSeamSources): DshSessionManagerSeams {
  const persistence = asPersistence(sources.sessionPersistence)
  const registry = asRegistry(sources.workspaceRegistry)
  const agents = asAgents(sources.agents)
  const query = asQuery(sources.sessionQuery)

  const missingSeamReason = (): string => {
    const gaps = sessionManagerSeamGaps(sources)
    return gaps.length > 0 ? `official seam unavailable: ${gaps.join(', ')}` : 'official seam unavailable'
  }

  async function foldSessions(): Promise<readonly SessionSummaryV1[]> {
    if (persistence === undefined || registry === undefined || agents === undefined) return []
    let records: readonly { header: OfficialSessionHeaderFace }[]
    if (query?.listSessions !== undefined) {
      records = await query.listSessions()
    } else {
      const headers = await persistence.list()
      records = headers.map(header => ({ header }))
    }
    const unique = new Map<string, { header: OfficialSessionHeaderFace }>()
    for (const record of records) {
      if (!unique.has(record.header.id)) unique.set(record.header.id, record)
    }
    const membership = new Map<string, { ref: string; name: string }>()
    for (const workspace of registry.list()) {
      for (const sessionId of workspace.sessionIds) {
        membership.set(sessionId, { ref: workspace.id, name: workspace.title })
      }
    }
    const archived = new Set(registry.archivedSessionIds)
    let titles: Map<string, { title: string; updatedAt: number }> | undefined
    if (query?.readTitleSnapshots !== undefined && unique.size > 0) {
      const observations = await query.readTitleSnapshots([...unique.keys()])
      titles = new Map()
      for (const observation of observations) {
        if (observation.status !== 'fulfilled') continue
        const title = observation.value.title
        if (title !== undefined) titles.set(observation.sessionId, title)
      }
    }
    return [...unique.values()]
      .sort((left, right) => right.header.createdAt - left.header.createdAt)
      .map(({ header }): SessionSummaryV1 => {
        const group = membership.get(header.id)
          ?? (header.cwd === undefined ? undefined : { ref: header.cwd, name: basenameOf(header.cwd) })
        const title = titles?.get(header.id)
        return {
          sessionId: header.id,
          ...(title !== undefined ? { title: title.title } : {}),
          ...(group !== undefined ? { workspaceRef: group.ref, workspaceName: group.name } : {}),
          archived: archived.has(header.id),
          running: agents.get(header.id)?.status === 'running',
          unread: false,
          labels: [],
          ...(title !== undefined ? { updatedAt: new Date(title.updatedAt).toISOString() } : {}),
          ...(header.parentSession !== undefined ? { parentSessionId: header.parentSession } : {}),
        }
      })
  }

  return {
    async listSessions(): Promise<readonly SessionSummaryV1[]> {
      if (persistence === undefined || registry === undefined || agents === undefined) {
        throw new Error(missingSeamReason())
      }
      return foldSessions()
    },
    async archiveSession(sessionId: string): Promise<SessionMutationReceiptV1> {
      if (registry === undefined) return notImplemented(sessionId, missingSeamReason())
      try {
        await registry.archiveSession(sessionId)
        return { status: 'ok', sessionId }
      } catch (error) {
        return rejected(sessionId, error)
      }
    },
    async restoreSession(sessionId: string): Promise<SessionMutationReceiptV1> {
      return notImplemented(sessionId, 'official workspaceRegistry publishes no unarchive seam (archive set is append-only)')
    },
    async trashSession(sessionId: string): Promise<SessionMutationReceiptV1> {
      return notImplemented(sessionId, 'official DSH publishes no trash seam for third-party hosts')
    },
    async purgeSession(sessionId: string): Promise<SessionMutationReceiptV1> {
      return notImplemented(sessionId, 'official DSH publishes no purge seam for third-party hosts')
    },
    async setLabels(sessionId: string): Promise<SessionMutationReceiptV1> {
      return notImplemented(sessionId, 'session labels are owned by the sessionTags host sidecar seam')
    },
    async pauseSession(sessionId: string): Promise<SessionMutationReceiptV1> {
      return notImplemented(sessionId, 'official DSH publishes no third-party pause seam (cancel is not pause)')
    },
    async resumeSession(sessionId: string): Promise<SessionMutationReceiptV1> {
      return notImplemented(sessionId, 'official DSH publishes no third-party resume-without-message seam')
    },
    async forkSession(sessionId: string): Promise<SessionForkReceiptV1> {
      if (persistence === undefined || agents === undefined) {
        return notImplemented(sessionId, missingSeamReason())
      }
      if (typeof persistence.readFrom !== 'function' || typeof agents.create !== 'function') {
        return notImplemented(sessionId, 'fork needs official sessionPersistence.readFrom and agents.create seams')
      }
      try {
        const { meta, events } = await persistence.readFrom(sessionId, 0)
        const seed = balancedSeedOf(events)
        const childSessionId = mintChildSessionId()
        await agents.create({
          sessionId: childSessionId,
          meta: {
            ...(meta.cwd === undefined ? {} : { cwd: meta.cwd }),
            parentSession: sessionId,
            seedLength: seed.length,
          },
          seed,
        })
        // Best-effort grouping: keep the fork under the parent's workspace.
        const parentWorkspace = registry?.list().find(workspace => workspace.sessionIds.includes(sessionId))
        if (parentWorkspace !== undefined && typeof parentWorkspace.attachSession === 'function') {
          try {
            await parentWorkspace.attachSession(childSessionId)
          } catch {
            // Grouping is presentation-only; the durable fork already succeeded.
          }
        }
        return { status: 'ok', sessionId, childSessionId }
      } catch (error) {
        return rejected(sessionId, error)
      }
    },
  }
}

/** Wrap the official-seam adapter as a ready-to-mount `SessionManagerHostV1`. */
export function createOfficialSeamsSessionManagerHost(sources: DshSessionManagerSeamSources): SessionManagerHostV1 {
  const seams = createOfficialSeamsSessionManagerSeams(sources)
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
