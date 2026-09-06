/**
 * Session insights aggregation engine (host-only, pure, discardable).
 *
 * Folds owner-reported usage samples into the `session.insights.snapshot.v1alpha1`
 * projection. Invariants (openspec dsh-session-insights-and-status §4):
 *
 * - Idempotent per request/attempt identity: a streaming chunk followed by the
 *   final cumulative sample for the same attempt counts once (final replaces);
 *   distinct retry attempts each count; a bucket reclassification with an
 *   unchanged total still updates buckets and bumps the revision.
 * - Buckets sum only when confirmed disjoint; `cache_in_input` samples are
 *   normalized by this adapter; unknown semantics mark coverage partial and
 *   are never guessed into the sums.
 * - Fork-inherited history is shown separately, never re-charged. Descendant
 *   (sub-agent) merges require a verified owner relationship and dedup by
 *   authoritative attempt identity.
 * - Ranges are half-open [from,to) on actual request time; requests without
 *   timestamps are never attributed to a range. Sum-of-request-durations and
 *   wall-clock span are kept separate.
 * - The cache is keyed by session+scope+filter and discarded on any revision
 *   change; nothing persists across host restarts.
 *
 * @module @yeisme/dsh-token-usage-host/insights
 */

import { safeSessionRefSchema } from './projection.ts'
import type {
  SessionInsightsBucketsV1,
  SessionInsightsCostV1,
  SessionInsightsQueryInputV1,
  SessionInsightsQueryResultV1,
  SessionInsightsReasonCode,
  SessionInsightsRequestRowV1,
  SessionInsightsSnapshotV1,
  TokenBucketsV1,
} from './types.ts'
import {
  SESSION_INSIGHTS_BREAKDOWN_BOUND,
  SESSION_INSIGHTS_DEFAULT_LIMIT,
  SESSION_INSIGHTS_SCHEMA_VERSION,
  TOKEN_USAGE_SPEC_VERSION,
} from './types.ts'

/* ----------------------------- raw inputs ----------------------------- */

/** Provider bucket semantics for one usage sample. */
export type BucketSemantics = 'disjoint' | 'cache_in_input' | 'unknown'

export interface RawTokenUsage {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens?: number
  readonly cacheWriteTokens?: number
}

export interface RawCost {
  readonly kind: 'settled' | 'estimate'
  readonly amount: string
  readonly currency: string
  readonly source?: string
  readonly effectiveAt?: string
}

/**
 * One owner-reported usage observation. `attemptRef` is the authoritative
 * attempt identity; samples sharing it are the streaming/final series of one
 * attempt. `inherited` marks fork-seed history; `originSessionRef` marks
 * samples folded from a verified descendant session.
 */
export interface RawUsageSample {
  readonly attemptRef: string
  readonly requestRef?: string
  readonly runRef?: string
  readonly eventRef?: string
  readonly happenedAt?: number
  readonly kind: 'chunk' | 'final'
  readonly status?: 'completed' | 'cancelled' | 'failed'
  readonly usage?: RawTokenUsage
  readonly bucketSemantics?: BucketSemantics
  readonly model?: string
  readonly provider?: string
  readonly durationMs?: number
  readonly cost?: RawCost
  readonly inherited?: boolean
  readonly originSessionRef?: string
}

export interface SessionHistoryRead {
  /** True only when the owner proved the read covers the complete history. */
  readonly complete: boolean
  readonly samples: readonly RawUsageSample[]
  readonly availableRange?: { readonly from: number; readonly to: number }
  readonly missingReason?: string
}

export interface SessionContextRead {
  readonly used?: number
  readonly limit?: number
}

/** Thrown by a source when the session is inaccessible or no longer exists. */
export class SessionInaccessibleError extends Error {
  constructor(message = 'The session is not accessible.') {
    super(message)
    this.name = 'SessionInaccessibleError'
  }
}

export interface SessionHistorySource {
  readonly id: 'session_query' | 'unavailable'
  read(sessionRef: string): Promise<SessionHistoryRead>
  /** Verified owner relationship for descendant (sub-agent) merges. */
  listDescendants?(sessionRef: string): Promise<readonly string[]>
  readContext?(sessionRef: string): Promise<SessionContextRead | undefined>
}

/* --------------------------- decimal amounts --------------------------- */

const COST_SCALE = 6
const COST_FACTOR = 10n ** BigInt(COST_SCALE)

function parseAmount(value: string): bigint | null {
  if (!/^\d+(\.\d+)?$/u.test(value)) return null
  const dot = value.indexOf('.')
  const int = dot === -1 ? value : value.slice(0, dot)
  const frac = dot === -1 ? '' : value.slice(dot + 1)
  if (frac.length > COST_SCALE) return null
  return BigInt(int) * COST_FACTOR + BigInt((frac + '0'.repeat(COST_SCALE)).slice(0, COST_SCALE))
}

function formatAmount(scaled: bigint): string {
  const int = scaled / COST_FACTOR
  const frac = (scaled % COST_FACTOR).toString().padStart(COST_SCALE, '0').replace(/0+$/u, '')
  return frac.length === 0 ? int.toString() : `${int.toString()}.${frac}`
}

/* ------------------------------- cursors ------------------------------- */

interface CursorPayload {
  readonly v: 1
  readonly s: string
  readonly f: string
  readonly rev: number
  readonly off: number
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodeCursor(raw: string): CursorPayload | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (parsed === null || typeof parsed !== 'object') return null
    const record = parsed as Record<string, unknown>
    if (record.v !== 1) return null
    if (typeof record.s !== 'string' || typeof record.f !== 'string') return null
    if (typeof record.rev !== 'number' || !Number.isInteger(record.rev) || record.rev < 0) return null
    if (typeof record.off !== 'number' || !Number.isInteger(record.off) || record.off < 0) return null
    return { v: 1, s: record.s, f: record.f, rev: record.rev, off: record.off }
  } catch {
    return null
  }
}

/** Stable filter key: cursor validity is bound to session+filter+revision. */
function filterKeyOf(input: NormalizedInsightsQuery): string {
  return JSON.stringify({
    scope: input.scope,
    runRef: input.runRef ?? null,
    from: input.from ?? null,
    to: input.to ?? null,
    timeZone: input.timeZone ?? null,
    includeDescendants: input.includeDescendants,
    limit: input.limit,
  })
}

/* ------------------------------ fold state ----------------------------- */

interface AttemptRecord {
  readonly attemptRef: string
  requestRef?: string
  runRef?: string
  eventRef?: string
  happenedAt?: number
  status: 'completed' | 'cancelled' | 'failed' | 'unknown'
  model?: string
  provider?: string
  durationMs?: number
  cost?: RawCost
  inherited: boolean
  originSessionRef: string
  hasUsage: boolean
  /** Usage present but bucket semantics unconfirmed — never summed. */
  unnormalizable: boolean
  buckets: TokenBucketsV1 | null
  usageIsFinal: boolean
}

function bucketsEqual(left: TokenBucketsV1 | null, right: TokenBucketsV1 | null): boolean {
  if (left === null || right === null) return left === right
  return (
    left.uncachedInputTokens === right.uncachedInputTokens &&
    left.outputTokens === right.outputTokens &&
    left.cacheReadTokens === right.cacheReadTokens &&
    left.cacheWriteTokens === right.cacheWriteTokens
  )
}

function costEqual(left: RawCost | undefined, right: RawCost | undefined): boolean {
  if (left === undefined || right === undefined) return left === right
  return (
    left.kind === right.kind &&
    left.amount === right.amount &&
    left.currency === right.currency &&
    left.source === right.source &&
    left.effectiveAt === right.effectiveAt
  )
}

/**
 * Normalize one sample's usage into disjoint buckets. `cache_in_input` is the
 * confirmed provider convention this adapter owns (uncached = input - cache);
 * unknown semantics yield `unnormalizable` and never enter any sum.
 */
export function normalizeSampleBuckets(
  usage: RawTokenUsage,
  semantics: BucketSemantics,
): { readonly buckets: TokenBucketsV1; readonly unnormalizable: false } | { readonly buckets: null; readonly unnormalizable: true } {
  const cacheRead = usage.cacheReadTokens ?? 0
  const cacheWrite = usage.cacheWriteTokens ?? 0
  if (semantics === 'unknown') return { buckets: null, unnormalizable: true }
  if (semantics === 'cache_in_input') {
    const uncached = usage.inputTokens - cacheRead - cacheWrite
    if (uncached < 0) return { buckets: null, unnormalizable: true }
    return {
      buckets: { uncachedInputTokens: uncached, outputTokens: usage.outputTokens, cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite },
      unnormalizable: false,
    }
  }
  return {
    buckets: {
      uncachedInputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: cacheRead,
      cacheWriteTokens: cacheWrite,
    },
    unnormalizable: false,
  }
}

function validUsage(usage: RawTokenUsage): boolean {
  const values = [usage.inputTokens, usage.outputTokens, usage.cacheReadTokens ?? 0, usage.cacheWriteTokens ?? 0]
  return values.every(value => Number.isFinite(value) && Number.isInteger(value) && value >= 0)
}

function safeBounded(value: string | undefined, max: number): string | undefined {
  if (value === undefined || value.length === 0 || value.length > max) return undefined
  return value
}

interface SessionFoldState {
  readonly attempts: Map<string, AttemptRecord>
  revision: number
}

export interface SessionInsightsStoreOptions {
  readonly chunkSize?: number
  /** Yield control between aggregation chunks (default: setImmediate). */
  readonly schedule?: () => Promise<void>
}

export interface NormalizedInsightsQuery {
  readonly sessionRef: string
  readonly scope: 'session' | 'run' | 'range'
  readonly runRef?: string
  readonly from?: number
  readonly to?: number
  readonly timeZone?: string
  readonly includeDescendants: boolean
  readonly cursor?: string
  readonly limit: number
}

/** Normalize a wire-validated input into engine form (epoch bounds, defaults). */
export function normalizeInsightsQuery(input: SessionInsightsQueryInputV1): NormalizedInsightsQuery {
  const query: NormalizedInsightsQuery = {
    sessionRef: input.sessionRef,
    scope: input.scope ?? 'session',
    includeDescendants: input.includeDescendants ?? false,
    limit: input.limit ?? SESSION_INSIGHTS_DEFAULT_LIMIT,
    ...(input.runRef === undefined ? {} : { runRef: input.runRef }),
    ...(input.from === undefined ? {} : { from: Date.parse(input.from) }),
    ...(input.to === undefined ? {} : { to: Date.parse(input.to) }),
    ...(input.timeZone === undefined ? {} : { timeZone: input.timeZone }),
    ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
  }
  return query
}

const EMPTY_TOTALS: SessionInsightsBucketsV1 = Object.freeze({
  uncachedInputTokens: null,
  outputTokens: null,
  cacheReadTokens: null,
  cacheWriteTokens: null,
})

function toWireBuckets(buckets: TokenBucketsV1): SessionInsightsBucketsV1 {
  return { ...buckets }
}

/**
 * Discardable per-session fold store plus query engine. Owns no persistence
 * and no subscriptions; callers re-read owner sources and re-fold freely —
 * idempotency makes replays free of double counting.
 */
export class SessionInsightsEngine {
  private readonly states = new Map<string, SessionFoldState>()
  private readonly cache = new Map<string, { readonly revision: number; readonly snapshot: SessionInsightsSnapshotV1 }>()
  private readonly chunkSize: number
  private readonly schedule: () => Promise<void>
  private readonly now: () => number

  constructor(
    private readonly source: SessionHistorySource,
    options: SessionInsightsStoreOptions & { readonly now?: () => number } = {},
  ) {
    this.chunkSize = options.chunkSize ?? 1024
    this.schedule = options.schedule ?? (() => new Promise(resolve => setImmediate(resolve)))
    this.now = options.now ?? (() => Date.now())
  }

  /** Current revision of one session's aggregation (0 before any fold). */
  revisionOf(sessionRef: string): number {
    return this.states.get(sessionRef)?.revision ?? 0
  }

  /**
   * Fold owner samples idempotently. Returns true when any attempt record
   * changed (including zero-total bucket reclassifications) and the revision
   * was bumped. Samples with unsafe refs or invalid usage are dropped.
   */
  fold(sessionRefRaw: string, samples: readonly RawUsageSample[]): boolean {
    const ref = safeSessionRefSchema.safeParse(sessionRefRaw)
    if (!ref.success) return false
    const sessionRef = ref.data
    let state = this.states.get(sessionRef)
    if (state === undefined) {
      state = { attempts: new Map(), revision: 0 }
      this.states.set(sessionRef, state)
    }
    let changed = false
    for (const sample of samples) {
      if (this.applySample(state, sessionRef, sample)) changed = true
    }
    if (changed) {
      state.revision += 1
      this.cache.clear()
    }
    return changed
  }

  private applySample(state: SessionFoldState, sessionRef: string, sample: RawUsageSample): boolean {
    const attemptRefParsed = safeSessionRefSchema.safeParse(sample.attemptRef)
    if (!attemptRefParsed.success) return false
    const attemptRef = attemptRefParsed.data
    const requestRef = sample.requestRef === undefined ? undefined : safeSessionRefSchema.safeParse(sample.requestRef)
    if (requestRef !== undefined && !requestRef.success) return false
    const runRef = sample.runRef === undefined ? undefined : safeSessionRefSchema.safeParse(sample.runRef)
    if (runRef !== undefined && !runRef.success) return false
    const eventRef = sample.eventRef === undefined ? undefined : safeSessionRefSchema.safeParse(sample.eventRef)
    if (eventRef !== undefined && !eventRef.success) return false
    if (sample.usage !== undefined && !validUsage(sample.usage)) return false
    if (sample.happenedAt !== undefined && (!Number.isFinite(sample.happenedAt) || sample.happenedAt < 0)) return false
    if (sample.durationMs !== undefined && (!Number.isFinite(sample.durationMs) || sample.durationMs < 0)) return false
    if (sample.cost !== undefined && parseAmount(sample.cost.amount) === null) return false
    if (sample.cost !== undefined && !/^[A-Z]{3}$/u.test(sample.cost.currency)) return false

    const origin = sample.originSessionRef ?? sessionRef
    const existing = state.attempts.get(attemptRef)
    if (existing !== undefined && origin !== existing.originSessionRef) {
      // Authoritative identity already folded from another session (parent
      // summary already carries this attempt): count once, drop the copy.
      return false
    }

    const candidate: AttemptRecord = existing === undefined
      ? {
          attemptRef,
          status: sample.status ?? 'unknown',
          inherited: sample.inherited ?? false,
          originSessionRef: origin,
          hasUsage: false,
          unnormalizable: false,
          buckets: null,
          usageIsFinal: false,
        }
      : { ...existing }

    if (requestRef !== undefined && requestRef.success) candidate.requestRef = requestRef.data
    if (runRef !== undefined && runRef.success) candidate.runRef = runRef.data
    if (eventRef !== undefined && eventRef.success) candidate.eventRef = eventRef.data
    if (sample.happenedAt !== undefined) candidate.happenedAt = sample.happenedAt
    if (sample.status !== undefined) candidate.status = sample.status
    const model = safeBounded(sample.model, 160)
    if (model !== undefined) candidate.model = model
    const provider = safeBounded(sample.provider, 64)
    if (provider !== undefined) candidate.provider = provider
    if (sample.durationMs !== undefined) candidate.durationMs = sample.durationMs
    if (sample.cost !== undefined) candidate.cost = sample.cost
    if (sample.inherited === true) candidate.inherited = true

    if (sample.usage !== undefined) {
      // Final cumulative replaces; a chunk landing after the final is replay.
      if (sample.kind === 'final' || !candidate.usageIsFinal) {
        const normalized = normalizeSampleBuckets(sample.usage, sample.bucketSemantics ?? 'disjoint')
        candidate.hasUsage = true
        candidate.usageIsFinal = sample.kind === 'final'
        candidate.buckets = normalized.buckets
        candidate.unnormalizable = normalized.unnormalizable
      }
    }

    if (existing !== undefined && recordsEqual(existing, candidate)) return false
    state.attempts.set(attemptRef, candidate)
    return true
  }

  /**
   * Run one authorized query: re-read the owner history, fold idempotently,
   * and build the paginated snapshot. Totals always cover the verified whole
   * range, never the current page.
   */
  async query(
    input: SessionInsightsQueryInputV1,
    hooks: { readonly onProgress?: (processed: number, total: number) => void } = {},
  ): Promise<SessionInsightsQueryResultV1> {
    const query = normalizeInsightsQuery(input)

    let read: SessionHistoryRead
    try {
      read = await this.source.read(query.sessionRef)
    } catch (error) {
      if (error instanceof SessionInaccessibleError) {
        return { ok: false, code: 'session_inaccessible', message: 'The session is not accessible.' }
      }
      // History failed, but the context projection may still be showable.
      const contextRead = this.source.readContext === undefined
        ? undefined
        : await this.source.readContext(query.sessionRef).catch(() => undefined)
      return {
        ok: true,
        specVersion: TOKEN_USAGE_SPEC_VERSION,
        snapshot: this.failedReadSnapshot(query, contextRead),
      }
    }

    this.fold(query.sessionRef, read.samples)

    const descendantRefs: readonly string[] | undefined = query.includeDescendants
      ? await this.readDescendants(query.sessionRef)
      : undefined
    let descendantsUnverifiedReason: string | undefined
    if (query.includeDescendants && descendantRefs === undefined) {
      descendantsUnverifiedReason = 'Descendant merge requires a verified owner relationship; none is available.'
    } else if (descendantRefs !== undefined) {
      for (const descendantRef of descendantRefs) {
        try {
          const childRead = await this.source.read(descendantRef)
          this.fold(query.sessionRef, markOrigin(childRead.samples, descendantRef))
        } catch {
          descendantsUnverifiedReason = 'A descendant session could not be read; merged totals stay unavailable.'
        }
      }
    }

    const state = this.states.get(query.sessionRef)
    const revision = state?.revision ?? 0

    if (query.scope === 'run') {
      const runRefs = new Set<string>()
      for (const record of state?.attempts.values() ?? []) {
        if (!record.inherited && record.originSessionRef === query.sessionRef && record.runRef !== undefined) {
          runRefs.add(record.runRef)
        }
      }
      if (runRefs.size === 0) {
        return {
          ok: true,
          specVersion: TOKEN_USAGE_SPEC_VERSION,
          snapshot: this.unavailableRunSnapshot(query, revision),
        }
      }
      // Reject without filling in a latest run; no other-session data leaks.
      if (query.runRef === undefined || !runRefs.has(query.runRef)) {
        return { ok: false, code: 'invalid_input', message: 'runRef does not belong to the session.' }
      }
    }

    let offset = 0
    if (query.cursor !== undefined) {
      const payload = decodeCursor(query.cursor)
      if (payload === null || payload.s !== query.sessionRef || payload.f !== filterKeyOf(query)) {
        return { ok: false, code: 'invalid_cursor', message: 'The cursor does not match this session and filter.' }
      }
      if (payload.rev !== revision) {
        return { ok: false, code: 'stale_cursor', message: 'The aggregation changed; re-read from the first page.' }
      }
      offset = payload.off
    }

    const cacheKey = `${query.sessionRef}|${filterKeyOf(query)}|${offset}`
    const cached = this.cache.get(cacheKey)
    if (cached !== undefined && cached.revision === revision) {
      return { ok: true, specVersion: TOKEN_USAGE_SPEC_VERSION, snapshot: cached.snapshot }
    }

    const contextRead = this.source.readContext === undefined
      ? undefined
      : await this.source.readContext(query.sessionRef).catch(() => undefined)

    const snapshot = await this.buildSnapshot(query, read, revision, offset, contextRead, descendantsUnverifiedReason, descendantRefs, hooks)
    if (this.cache.size >= 64) this.cache.clear()
    this.cache.set(cacheKey, { revision, snapshot })
    return { ok: true, specVersion: TOKEN_USAGE_SPEC_VERSION, snapshot }
  }

  private async readDescendants(sessionRef: string): Promise<readonly string[] | undefined> {
    if (this.source.listDescendants === undefined) return undefined
    try {
      return await this.source.listDescendants(sessionRef)
    } catch {
      return undefined
    }
  }

  private failedReadSnapshot(query: NormalizedInsightsQuery, contextRead: SessionContextRead | undefined): SessionInsightsSnapshotV1 {
    return {
      schemaVersion: SESSION_INSIGHTS_SCHEMA_VERSION,
      sessionRef: query.sessionRef,
      scope: query.scope,
      revision: this.revisionOf(query.sessionRef),
      generatedAt: new Date(this.now()).toISOString(),
      freshness: 'unknown',
      coverage: { status: 'unknown', missingReason: 'The session history could not be read.' },
      source: {
        history: this.source.id,
        context: contextRead === undefined ? 'unavailable' : 'session_projections',
        cost: 'unknown',
      },
      totals: { buckets: EMPTY_TOTALS, requestCount: null, sumRequestDurationMs: null, wallClockMs: null },
      context:
        contextRead === undefined
          ? { status: 'unavailable', reason: 'The context projection source is unavailable.' }
          : {
              status: 'available',
              ...(contextRead.used === undefined ? {} : { used: contextRead.used }),
              ...(contextRead.limit === undefined ? {} : { limit: contextRead.limit }),
              ...(contextRead.used !== undefined && contextRead.limit !== undefined
                ? { remaining: Math.max(0, contextRead.limit - contextRead.used) }
                : {}),
            },
      byModel: { rows: [], truncated: false },
      byProvider: { rows: [], truncated: false },
      requests: [],
      truncated: false,
      reasonCode: 'history_read_failed',
      safeMessage: 'The session history could not be read; consumption is unknown.',
    }
  }

  private async buildSnapshot(
    query: NormalizedInsightsQuery,
    read: SessionHistoryRead,
    revision: number,
    offset: number,
    contextRead: SessionContextRead | undefined,
    descendantsUnverifiedReason: string | undefined,
    descendantRefs: readonly string[] | undefined,
    hooks: { readonly onProgress?: (processed: number, total: number) => void },
  ): Promise<SessionInsightsSnapshotV1> {
    const state = this.states.get(query.sessionRef)
    const all = [...(state?.attempts.values() ?? [])]

    const merged = descendantRefs !== undefined && descendantsUnverifiedReason === undefined
    const scoped: AttemptRecord[] = []
    const inheritedRecords: AttemptRecord[] = []
    const descendantRecords: AttemptRecord[] = []
    let processed = 0
    for (const record of all) {
      processed += 1
      if (processed % this.chunkSize === 0) {
        hooks.onProgress?.(processed, all.length)
        await this.schedule()
      }
      if (record.inherited) {
        inheritedRecords.push(record)
        continue
      }
      if (record.originSessionRef !== query.sessionRef) {
        if (merged) descendantRecords.push(record)
        continue
      }
      if (!this.inScope(record, query)) continue
      scoped.push(record)
    }
    const counted = merged ? [...scoped, ...descendantRecords.filter(record => this.inScope(record, query))] : scoped

    let missingTimestamps = 0
    const ranged: AttemptRecord[] = []
    for (const record of counted) {
      if (query.scope === 'range') {
        if (record.happenedAt === undefined) {
          // Range attribution unknown — never attributed to today.
          missingTimestamps += 1
          continue
        }
        if (query.from !== undefined && record.happenedAt < query.from) continue
        if (query.to !== undefined && record.happenedAt >= query.to) continue
      }
      ranged.push(record)
    }

    const totals = this.aggregateTotals(ranged)
    const missingUsage = ranged.filter(record => !record.hasUsage).length
    const unnormalized = ranged.filter(record => record.hasUsage && record.unnormalizable).length

    const sorted = [...ranged].sort((left, right) => {
      const leftTime = left.happenedAt ?? Number.POSITIVE_INFINITY
      const rightTime = right.happenedAt ?? Number.POSITIVE_INFINITY
      return leftTime - rightTime || left.attemptRef.localeCompare(right.attemptRef)
    })
    const page = sorted.slice(offset, offset + query.limit)
    const hasMore = offset + query.limit < sorted.length

    const reasons: SessionInsightsReasonCode[] = []
    if (unnormalized > 0) reasons.push('bucket_semantics_unknown')
    if (missingUsage > 0) reasons.push('usage_missing')
    if (missingTimestamps > 0) reasons.push('timestamps_missing')
    if (descendantsUnverifiedReason !== undefined) reasons.push('descendant_merge_unverified')
    const complete =
      read.complete &&
      missingUsage === 0 &&
      unnormalized === 0 &&
      missingTimestamps === 0 &&
      descendantsUnverifiedReason === undefined
    const status = complete ? 'complete' : 'partial'

    const reasonMessages: Record<SessionInsightsReasonCode, string> = {
      history_source_unavailable: 'No authorized history seam is available.',
      history_read_failed: 'The session history could not be read.',
      run_scope_unavailable: 'The history source cannot attribute runs.',
      bucket_semantics_unknown: `${unnormalized} request(s) report unconfirmed bucket semantics and are excluded from totals.`,
      usage_missing: `${missingUsage} request(s) have no owner-reported usage.`,
      timestamps_missing: `${missingTimestamps} request(s) have no timestamp; their range attribution is unknown.`,
      descendant_merge_unverified: descendantsUnverifiedReason ?? 'Descendant merge is not verified.',
      context_source_unavailable: 'The context projection source is unavailable.',
    }
    const reasonCode = reasons[0]

    const coverage: SessionInsightsSnapshotV1['coverage'] = {
      status,
      knownRequests: ranged.length,
      ...(read.complete ? { missingUsageRequests: missingUsage } : {}),
      ...(read.availableRange === undefined
        ? {}
        : {
            availableRange: {
              from: new Date(read.availableRange.from).toISOString(),
              to: new Date(read.availableRange.to).toISOString(),
            },
          }),
      ...(reasonCode === undefined ? {} : { missingReason: reasonMessages[reasonCode] }),
    }

    const costRows = this.aggregateCosts(ranged)

    const snapshot: SessionInsightsSnapshotV1 = {
      schemaVersion: SESSION_INSIGHTS_SCHEMA_VERSION,
      sessionRef: query.sessionRef,
      scope: query.scope,
      revision,
      generatedAt: new Date(this.now()).toISOString(),
      freshness: 'fresh',
      coverage,
      source: {
        history: this.source.id,
        context: contextRead === undefined ? 'unavailable' : 'session_projections',
        cost: costRows.some(row => row.kind === 'settled')
          ? 'provider_settled'
          : costRows.length > 0
            ? 'price_snapshot'
            : 'unknown',
      },
      totals: {
        buckets: totals.buckets,
        requestCount: ranged.length,
        ...(missingUsage > 0 ? { missingUsageRequests: missingUsage } : {}),
        sumRequestDurationMs: totals.sumRequestDurationMs,
        wallClockMs: totals.wallClockMs,
        ...(costRows.length > 0 ? { cost: costRows } : {}),
      },
      context:
        contextRead === undefined
          ? { status: 'unavailable', reason: 'The context projection source is unavailable.' }
          : {
              status: 'available',
              ...(contextRead.used === undefined ? {} : { used: contextRead.used }),
              ...(contextRead.limit === undefined ? {} : { limit: contextRead.limit }),
              ...(contextRead.used !== undefined && contextRead.limit !== undefined
                ? { remaining: Math.max(0, contextRead.limit - contextRead.used) }
                : {}),
            },
      ...(inheritedRecords.length > 0 ? { inherited: this.aggregateSide(inheritedRecords) } : {}),
      ...(query.includeDescendants
        ? {
            descendants:
              descendantsUnverifiedReason !== undefined
                ? { status: 'unavailable' as const, reason: descendantsUnverifiedReason }
                : {
                    status: 'merged' as const,
                    requestCount: descendantRecords.length,
                    buckets: this.sumBuckets(descendantRecords),
                  },
          }
        : {}),
      byModel: this.breakdown(ranged, record => record.model),
      byProvider: this.breakdown(ranged, record => record.provider),
      requests: page.map(record => this.toRow(record, query.sessionRef)),
      ...(hasMore
        ? {
            nextCursor: encodeCursor({
              v: 1,
              s: query.sessionRef,
              f: filterKeyOf(query),
              rev: revision,
              off: offset + query.limit,
            }),
          }
        : {}),
      truncated: hasMore,
      ...(reasonCode === undefined
        ? {}
        : { reasonCode, safeMessage: reasonMessages[reasonCode] }),
    }
    return snapshot
  }

  private unavailableRunSnapshot(query: NormalizedInsightsQuery, revision: number): SessionInsightsSnapshotV1 {
    return {
      schemaVersion: SESSION_INSIGHTS_SCHEMA_VERSION,
      sessionRef: query.sessionRef,
      scope: query.scope,
      revision,
      generatedAt: new Date(this.now()).toISOString(),
      freshness: 'fresh',
      coverage: { status: 'unknown', missingReason: 'The history source cannot attribute runs to this session.' },
      source: {
        history: this.source.id,
        context: this.source.readContext === undefined ? 'unavailable' : 'session_projections',
        cost: 'unknown',
      },
      totals: { buckets: EMPTY_TOTALS, requestCount: null, sumRequestDurationMs: null, wallClockMs: null },
      context: { status: 'unavailable', reason: 'The context projection source is unavailable.' },
      byModel: { rows: [], truncated: false },
      byProvider: { rows: [], truncated: false },
      requests: [],
      truncated: false,
      reasonCode: 'run_scope_unavailable',
      safeMessage: 'Run-scoped statistics are unavailable for this session.',
    }
  }

  private inScope(record: AttemptRecord, query: NormalizedInsightsQuery): boolean {
    if (query.scope === 'run') return record.runRef === query.runRef
    return true
  }

  private aggregateTotals(records: readonly AttemptRecord[]): {
    buckets: SessionInsightsBucketsV1
    sumRequestDurationMs: number | null
    wallClockMs: number | null
  } {
    let buckets: TokenBucketsV1 = { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
    let sawDurationless = false
    let durationSum = 0
    let firstStart: number | null = null
    let lastEnd: number | null = null
    for (const record of records) {
      if (record.buckets !== null) {
        buckets = {
          uncachedInputTokens: buckets.uncachedInputTokens + record.buckets.uncachedInputTokens,
          outputTokens: buckets.outputTokens + record.buckets.outputTokens,
          cacheReadTokens: buckets.cacheReadTokens + record.buckets.cacheReadTokens,
          cacheWriteTokens: buckets.cacheWriteTokens + record.buckets.cacheWriteTokens,
        }
      }
      if (record.durationMs === undefined) {
        sawDurationless = true
      } else {
        durationSum += record.durationMs
        if (record.happenedAt !== undefined) {
          const start = record.happenedAt
          const end = record.happenedAt + record.durationMs
          firstStart = firstStart === null ? start : Math.min(firstStart, start)
          lastEnd = lastEnd === null ? end : Math.max(lastEnd, end)
        }
      }
    }
    return {
      buckets: toWireBuckets(buckets),
      // A partial sum would silently under-report: all-or-unknown.
      sumRequestDurationMs: sawDurationless ? null : durationSum,
      wallClockMs: firstStart === null || lastEnd === null ? null : lastEnd - firstStart,
    }
  }

  private aggregateSide(records: readonly AttemptRecord[]): { requestCount: number; buckets: SessionInsightsBucketsV1 } {
    return { requestCount: records.length, buckets: this.sumBuckets(records) }
  }

  private sumBuckets(records: readonly AttemptRecord[]): SessionInsightsBucketsV1 {
    let buckets: TokenBucketsV1 = { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
    for (const record of records) {
      if (record.buckets === null) continue
      buckets = {
        uncachedInputTokens: buckets.uncachedInputTokens + record.buckets.uncachedInputTokens,
        outputTokens: buckets.outputTokens + record.buckets.outputTokens,
        cacheReadTokens: buckets.cacheReadTokens + record.buckets.cacheReadTokens,
        cacheWriteTokens: buckets.cacheWriteTokens + record.buckets.cacheWriteTokens,
      }
    }
    return toWireBuckets(buckets)
  }

  private aggregateCosts(records: readonly AttemptRecord[]): SessionInsightsCostV1[] {
    const groups = new Map<string, { readonly sample: RawCost; total: bigint }>()
    for (const record of records) {
      if (record.cost === undefined) continue
      const amount = parseAmount(record.cost.amount)
      if (amount === null) continue
      const key = `${record.cost.kind}|${record.cost.currency}`
      const group = groups.get(key)
      if (group === undefined) {
        groups.set(key, { sample: record.cost, total: amount })
      } else {
        group.total += amount
      }
    }
    return [...groups.values()].map(group => ({
      kind: group.sample.kind,
      amount: formatAmount(group.total),
      currency: group.sample.currency,
      ...(group.sample.source === undefined ? {} : { source: group.sample.source }),
      ...(group.sample.effectiveAt === undefined ? {} : { effectiveAt: group.sample.effectiveAt }),
    }))
  }

  private breakdown(
    records: readonly AttemptRecord[],
    keyOf: (record: AttemptRecord) => string | undefined,
  ): { rows: { key: string; label: string; requestCount: number; buckets: SessionInsightsBucketsV1 }[]; truncated: boolean } {
    const groups = new Map<string, { requestCount: number; buckets: TokenBucketsV1 }>()
    for (const record of records) {
      const key = keyOf(record) ?? 'unknown'
      const group = groups.get(key) ?? {
        requestCount: 0,
        buckets: { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      }
      group.requestCount += 1
      if (record.buckets !== null) {
        group.buckets = {
          uncachedInputTokens: group.buckets.uncachedInputTokens + record.buckets.uncachedInputTokens,
          outputTokens: group.buckets.outputTokens + record.buckets.outputTokens,
          cacheReadTokens: group.buckets.cacheReadTokens + record.buckets.cacheReadTokens,
          cacheWriteTokens: group.buckets.cacheWriteTokens + record.buckets.cacheWriteTokens,
        }
      }
      groups.set(key, group)
    }
    const rows = [...groups.entries()]
      .sort((left, right) => {
        const leftTotal =
          left[1].buckets.uncachedInputTokens + left[1].buckets.outputTokens + left[1].buckets.cacheReadTokens + left[1].buckets.cacheWriteTokens
        const rightTotal =
          right[1].buckets.uncachedInputTokens + right[1].buckets.outputTokens + right[1].buckets.cacheReadTokens + right[1].buckets.cacheWriteTokens
        return rightTotal - leftTotal || left[0].localeCompare(right[0])
      })
      .map(([key, group]) => ({
        key,
        label: key === 'unknown' ? 'Unknown' : key,
        requestCount: group.requestCount,
        buckets: toWireBuckets(group.buckets),
      }))
    return { rows: rows.slice(0, SESSION_INSIGHTS_BREAKDOWN_BOUND), truncated: rows.length > SESSION_INSIGHTS_BREAKDOWN_BOUND }
  }

  private toRow(record: AttemptRecord, sessionRef: string): SessionInsightsRequestRowV1 {
    return {
      attemptRef: record.attemptRef,
      ...(record.requestRef === undefined ? {} : { requestRef: record.requestRef }),
      ...(record.runRef === undefined ? {} : { runRef: record.runRef }),
      sessionRef,
      ...(record.eventRef === undefined ? {} : { eventRef: record.eventRef }),
      ...(record.happenedAt === undefined ? {} : { happenedAt: new Date(record.happenedAt).toISOString() }),
      buckets: record.buckets === null ? null : toWireBuckets(record.buckets),
      ...(record.model === undefined ? {} : { model: record.model }),
      ...(record.provider === undefined ? {} : { provider: record.provider }),
      ...(record.cost === undefined
        ? {}
        : {
            cost: {
              kind: record.cost.kind,
              amount: record.cost.amount,
              currency: record.cost.currency,
              ...(record.cost.source === undefined ? {} : { source: record.cost.source }),
              ...(record.cost.effectiveAt === undefined ? {} : { effectiveAt: record.cost.effectiveAt }),
            },
          }),
      ...(record.durationMs === undefined ? {} : { durationMs: record.durationMs }),
      status: record.status,
    }
  }
}

function recordsEqual(left: AttemptRecord, right: AttemptRecord): boolean {
  return (
    left.requestRef === right.requestRef &&
    left.runRef === right.runRef &&
    left.eventRef === right.eventRef &&
    left.happenedAt === right.happenedAt &&
    left.status === right.status &&
    left.model === right.model &&
    left.provider === right.provider &&
    left.durationMs === right.durationMs &&
    left.inherited === right.inherited &&
    left.originSessionRef === right.originSessionRef &&
    left.hasUsage === right.hasUsage &&
    left.unnormalizable === right.unnormalizable &&
    left.usageIsFinal === right.usageIsFinal &&
    bucketsEqual(left.buckets, right.buckets) &&
    costEqual(left.cost, right.cost)
  )
}

function markOrigin(samples: readonly RawUsageSample[], originSessionRef: string): RawUsageSample[] {
  return samples.map(sample => ({ ...sample, originSessionRef }))
}
