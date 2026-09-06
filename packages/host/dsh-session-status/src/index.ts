/**
 * Host plugin: sessions/agents/sessionProjections seams → sessionStatus Remote.
 *
 * Every official seam is probed structurally and degrades per source: a
 * missing `sessions` store drops identity/runtime, a missing `agents`
 * registry drops lifecycle/runtime labels, and a missing
 * `sessionProjections` registry drops tokenMeter context facts. The Remote
 * is always registered so clients receive typed degradation instead of a
 * dead namespace. No seam absence ever throws.
 *
 * @module @yeisme/dsh-session-status-host
 */

import type { Context } from '@deepseek-ai/cordis'
import { SessionStatusRemoteService } from './remote.ts'
import { SessionStatusService, type SessionStatusLookup } from './service.ts'
import type { TokenMeterFacts } from './projection.ts'
import type { SessionLifecycle } from './types.ts'

export const name = 'dsh-session-status-host'
export const inject = [] as const

/** Structural faces: linked dev packages may differ physically from DSH core. */
interface SessionLike {
  readonly id: string
}

interface SessionStoreFace {
  get?(id: string): SessionLike | undefined
}

interface AgentOptionsLike {
  readonly provider?: unknown
  readonly model?: unknown
}

interface AgentLike {
  readonly status?: unknown
  readonly options?: AgentOptionsLike
}

interface AgentsFace {
  get?(id: string): AgentLike | undefined
}

interface ProjectionSnapshotFace {
  readonly values?: Record<string, unknown>
}

interface SessionProjectionsFace {
  onChanged?(listener: (session: SessionLike, key: string, value: unknown, seq: number) => void): () => void
  snapshot?(session: SessionLike): ProjectionSnapshotFace
}

interface ContextPressureLike {
  readonly pressureTokens?: unknown
  readonly projectedTokens?: unknown
  readonly contextWindow?: unknown
}

const PROVIDER_ID = /^[a-z0-9][a-z0-9._-]*$/u

function optionalGet(ctx: Context, key: string): unknown {
  try {
    return (ctx as unknown as { get(name: never): unknown }).get(key as never)
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asSessionStore(value: unknown): SessionStoreFace | undefined {
  if (!isRecord(value) || typeof value.get !== 'function') return undefined
  return value as unknown as SessionStoreFace
}

function asAgents(value: unknown): AgentsFace | undefined {
  if (!isRecord(value) || typeof value.get !== 'function') return undefined
  return value as unknown as AgentsFace
}

function asSessionProjections(value: unknown): SessionProjectionsFace | undefined {
  if (!isRecord(value)) return undefined
  const candidate = value as unknown as SessionProjectionsFace
  if (typeof candidate.onChanged !== 'function' && typeof candidate.snapshot !== 'function') {
    return undefined
  }
  return candidate
}

function finiteTokenCount(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined
  return Math.trunc(value)
}

function safeLabel(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : undefined
}

function lifecycleOf(agents: AgentsFace | undefined, sessionRef: string): SessionLifecycle {
  if (agents === undefined) return 'unknown'
  const agent = agents.get?.(sessionRef)
  return agent?.status === 'running' ? 'running' : 'idle'
}

/**
 * tokenMeter facts come only from the owner `contextPressure` projection:
 * the newest request pressure paired with the newest route capacity. The
 * process ledger is never consulted.
 */
function tokenMeterLookup(
  registry: SessionProjectionsFace | undefined,
  sessions: SessionStoreFace | undefined,
): SessionStatusLookup['tokenMeter'] {
  if (registry?.snapshot === undefined || sessions?.get === undefined) return undefined
  const { snapshot } = registry
  const { get } = sessions
  return (sessionRef: string): TokenMeterFacts | null => {
    const session = get.call(sessions, sessionRef)
    if (session === undefined) return null
    let cut: ProjectionSnapshotFace
    try {
      cut = snapshot.call(registry, session)
    } catch {
      return null
    }
    const pressure = cut.values?.['contextPressure'] as ContextPressureLike | undefined
    if (!isRecord(pressure)) return null
    const used = finiteTokenCount(pressure.projectedTokens) ?? finiteTokenCount(pressure.pressureTokens)
    const limit = finiteTokenCount(pressure.contextWindow)
    if (used === undefined || limit === undefined || limit <= 0) return null
    return { usedTokens: used, limitTokens: limit }
  }
}

/**
 * Apply the host plugin. Probes are one-shot at mount; each lookup reads the
 * owner seam live per snapshot, and the projection change feed (when the
 * seam exists) advances the revision clock. All subscriptions ride the
 * caller's fiber and end with it.
 */
export function apply(ctx: Context): void {
  const registry = asSessionProjections(optionalGet(ctx, 'sessionProjections'))
  const sessions = asSessionStore(optionalGet(ctx, 'sessions'))
  const agents = asAgents(optionalGet(ctx, 'agents'))

  const lookup: SessionStatusLookup = {}
  if (sessions?.get !== undefined) {
    const { get } = sessions
    lookup.identity = (sessionRef: string) => {
      const session = get.call(sessions, sessionRef)
      if (session === undefined) return null
      return {
        sessionRef,
        label: sessionRef.slice(0, 12),
        lifecycle: lifecycleOf(agents, sessionRef),
      }
    }
  }
  if (agents?.get !== undefined) {
    const { get } = agents
    lookup.runtime = (sessionRef: string) => {
      const agent = get.call(agents, sessionRef)
      const provider = safeLabel(agent?.options?.provider, 64)
      const model = safeLabel(agent?.options?.model, 80)
      const runtime: { providerId?: string; modelLabel?: string } = {
        ...(provider !== undefined && PROVIDER_ID.test(provider) ? { providerId: provider } : {}),
        ...(model !== undefined ? { modelLabel: model } : {}),
      }
      return runtime.providerId === undefined && runtime.modelLabel === undefined ? null : runtime
    }
  }
  const tokenMeter = tokenMeterLookup(registry, sessions)
  if (tokenMeter !== undefined) lookup.tokenMeter = tokenMeter

  const service = new SessionStatusService({ lookup })

  // The Remote registers itself on construction and unregisters with the fiber.
  const remote = new SessionStatusRemoteService(ctx, service)
  void remote

  if (registry?.onChanged !== undefined) {
    const onChanged = registry.onChanged
    ctx.effect(() => {
      const listener = (_session: SessionLike, key: string): void => {
        if (key === 'contextPressure' || key === 'contextBreakdown') {
          service.noteSourceChange()
        }
      }
      let off: unknown
      try {
        off = onChanged.call(registry, listener)
      } catch {
        off = undefined
      }
      return () => {
        if (typeof off === 'function') (off as () => void)()
      }
    }, 'dsh-session-status-host: projection change feed')
  }
}

const DshSessionStatusHostPlugin = { name, inject, apply }
export default DshSessionStatusHostPlugin

export { SessionStatusService } from './service.ts'
export type { SessionStatusLookup, SessionStatusServiceOptions } from './service.ts'
export { SessionStatusRemoteService, sessionStatusRemoteMarkers } from './remote.ts'
export type { SessionStatusProbeV1 } from './remote.ts'
export {
  assembleSessionStatusSnapshot,
  collectLimits,
  contextTone,
  projectContext,
  unavailableSnapshot,
} from './projection.ts'
export type { ProviderLimitAdapter, SessionStatusSources, TokenMeterFacts } from './projection.ts'
export {
  parseSafeSessionRef,
  parseSessionStatusSnapshot,
  safeSessionRefSchema,
  sessionStatusSnapshotSchema,
} from './schema.ts'
export {
  SESSION_STATUS_LIMIT_BOUND,
  SESSION_STATUS_REMOTE_SERVICE_KEY,
  SESSION_STATUS_SCHEMA_VERSION,
  SESSION_STATUS_SPEC_VERSION,
} from './types.ts'
export type {
  LimitScope,
  SessionContextStatusV1,
  SessionIdentityV1,
  SessionLimitWindowV1,
  SessionRuntimeSummaryV1,
  SessionStatusFailureV1,
  SessionStatusFreshness,
  SessionStatusOverall,
  SessionStatusSnapshotOkV1,
  SessionStatusSnapshotV1,
  SourceStatus,
} from './types.ts'
