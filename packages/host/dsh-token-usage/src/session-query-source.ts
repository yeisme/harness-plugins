/**
 * Authorized history source over the probed `ctx.sessionQuery` seam.
 *
 * Reads complete logical session logs through the official service (never
 * private log files) and maps them into raw usage samples for the insights
 * engine. Owner-confirmed semantics (dsh-token-meter): the four buckets are
 * disjoint, `inputTokens` is uncached input, one (turn, step) is one attempt,
 * and a repeated sample for the same attempt replaces rather than adds.
 *
 * @module @yeisme/dsh-token-usage-host/session-query-source
 */

import {
  SessionInaccessibleError,
  type RawUsageSample,
  type SessionContextRead,
  type SessionHistoryRead,
  type SessionHistorySource,
} from './insights.ts'

/** Structural face of `ctx.sessionQuery` — linked dev packages may differ physically. */
export interface SessionQueryFace {
  readSession(sessionId: string): Promise<{ readonly session: { readonly id: string }; readonly events: readonly unknown[] }>
  traceSession?(sessionId: string): Promise<unknown>
}

interface SessionEventLike {
  readonly type?: unknown
  readonly seq?: unknown
  readonly time?: unknown
  readonly data?: unknown
}

interface UsageLike {
  readonly inputTokens?: unknown
  readonly outputTokens?: unknown
  readonly cacheReadTokens?: unknown
  readonly cacheWriteTokens?: unknown
}

function asCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined
}

function readUsage(value: unknown): RawUsageSample['usage'] | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const usage = value as UsageLike
  const inputTokens = asCount(usage.inputTokens)
  const outputTokens = asCount(usage.outputTokens)
  if (inputTokens === undefined || outputTokens === undefined) return undefined
  const cacheReadTokens = asCount(usage.cacheReadTokens)
  const cacheWriteTokens = asCount(usage.cacheWriteTokens)
  return {
    inputTokens,
    outputTokens,
    ...(cacheReadTokens === undefined ? {} : { cacheReadTokens }),
    ...(cacheWriteTokens === undefined ? {} : { cacheWriteTokens }),
  }
}

interface RouteContext {
  provider?: string
  model?: string
}

function readRouteContext(data: unknown): RouteContext | undefined {
  if (data === null || typeof data !== 'object') return undefined
  const record = data as { provider?: unknown; model?: unknown }
  const provider = typeof record.provider === 'string' && record.provider.length > 0 ? record.provider : undefined
  const model = typeof record.model === 'string' && record.model.length > 0 ? record.model : undefined
  if (provider === undefined && model === undefined) return undefined
  return { ...(provider === undefined ? {} : { provider }), ...(model === undefined ? {} : { model }) }
}

/**
 * Map one complete session log into raw usage samples. Pure and defensive:
 * malformed events are skipped, never guessed. Every closed step is one
 * request; usage may be absent (cancelled/failed without accounting).
 */
export function samplesFromSessionLog(events: readonly unknown[]): RawUsageSample[] {
  const samples: RawUsageSample[] = []
  let route: RouteContext | undefined
  let lastEndSeedSeq = -1
  const stepStarts = new Map<string, number>()
  const stepClosed = new Set<string>()
  const stepInherited = new Set<string>()
  const stepReported = new Set<string>()

  for (const raw of events) {
    if (raw === null || typeof raw !== 'object') continue
    const event = raw as SessionEventLike
    if (typeof event.type !== 'string' || typeof event.seq !== 'number') continue
    if (event.type === 'session/end-seed') {
      lastEndSeedSeq = event.seq
      continue
    }
  }

  for (const raw of events) {
    if (raw === null || typeof raw !== 'object') continue
    const event = raw as SessionEventLike
    if (typeof event.type !== 'string' || typeof event.seq !== 'number') continue
    const time = typeof event.time === 'number' && Number.isFinite(event.time) ? event.time : undefined
    const inherited = event.seq <= lastEndSeedSeq

    if (event.type === 'request/context') {
      route = readRouteContext(event.data)
      continue
    }

    const data = event.data as { turn?: unknown; step?: unknown; chunk?: unknown; usage?: unknown } | undefined
    const turn = typeof data?.turn === 'number' ? data.turn : undefined
    const step = typeof data?.step === 'number' ? data.step : undefined

    if (event.type === 'step/start' && turn !== undefined && step !== undefined) {
      if (time !== undefined) stepStarts.set(`${turn}:${step}`, time)
      if (inherited) stepInherited.add(`${turn}:${step}`)
      continue
    }
    if (event.type === 'step/end' && turn !== undefined && step !== undefined) {
      stepClosed.add(`${turn}:${step}`)
      continue
    }

    if (turn === undefined || step === undefined) continue
    const key = `${turn}:${step}`
    const base = {
      attemptRef: `t${turn}-s${step}`,
      requestRef: `t${turn}`,
      eventRef: `seq-${event.seq}`,
      ...(time === undefined ? {} : { happenedAt: stepStarts.get(key) ?? time }),
      ...(route?.provider === undefined ? {} : { provider: route.provider }),
      ...(route?.model === undefined ? {} : { model: route.model }),
      ...(inherited ? { inherited: true as const } : {}),
    }

    if (event.type === 'assistant/chunk') {
      const chunk = data?.chunk as { type?: unknown; usage?: unknown } | undefined
      if (chunk?.type !== 'usage') continue
      const usage = readUsage(chunk.usage)
      if (usage === undefined) continue
      stepReported.add(key)
      samples.push({ ...base, kind: 'chunk', usage, bucketSemantics: 'disjoint' })
      continue
    }

    if (event.type === 'assistant/message') {
      stepReported.add(key)
      const usage = readUsage(data?.usage)
      samples.push({
        ...base,
        kind: 'final',
        status: 'completed',
        ...(usage === undefined ? {} : { usage, bucketSemantics: 'disjoint' as const }),
      })
      continue
    }
  }

  // Closed steps whose attempt never reported usage or a message: the request
  // happened; its consumption is unknown (cancelled/failed without usage).
  for (const key of stepClosed) {
    if (stepReported.has(key)) continue
    const [turnRaw, stepRaw] = key.split(':')
    const start = stepStarts.get(key)
    samples.push({
      attemptRef: `t${turnRaw}-s${stepRaw}`,
      requestRef: `t${turnRaw}`,
      kind: 'final',
      inherited: stepInherited.has(key),
      ...(start === undefined ? {} : { happenedAt: start }),
    })
  }

  return samples
}

export interface SessionQueryHistorySourceOptions {
  /** Latest contextPressure values observed on the projection change feed. */
  readonly contextCache?: ReadonlyMap<string, SessionContextRead>
}

/**
 * Live source backed by the probed sessionQuery seam. `readSession` covers
 * live and persisted sessions alike, so historical sessions need no new
 * model request; a NOT_FOUND/conflict failure maps to an honest
 * inaccessible/unknown outcome, never fabricated data.
 */
export class SessionQueryHistorySource implements SessionHistorySource {
  readonly id = 'session_query' as const
  private readonly query: SessionQueryFace
  private readonly contextCache: ReadonlyMap<string, SessionContextRead> | undefined

  constructor(query: SessionQueryFace, options: SessionQueryHistorySourceOptions = {}) {
    this.query = query
    this.contextCache = options.contextCache
  }

  async read(sessionRef: string): Promise<SessionHistoryRead> {
    let snapshot: { readonly session: { readonly id: string }; readonly events: readonly unknown[] }
    try {
      snapshot = await this.query.readSession(sessionRef)
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code
      if (code === 'SESSION_QUERY_SESSION_NOT_FOUND') {
        throw new SessionInaccessibleError()
      }
      throw error
    }
    const samples = samplesFromSessionLog(snapshot.events)
    const times = samples
      .map(sample => sample.happenedAt)
      .filter((value): value is number => value !== undefined)
    return {
      // readSession returns one replay-validated complete logical log.
      complete: true,
      samples,
      ...(times.length === 0
        ? {}
        : { availableRange: { from: Math.min(...times), to: Math.max(...times) } }),
    }
  }

  async readContext(sessionRef: string): Promise<SessionContextRead | undefined> {
    return this.contextCache?.get(sessionRef)
  }
}
