/**
 * Process-scoped cross-session token ledger.
 *
 * The ledger only folds deltas of the official `tokenUsage` projection
 * (sessionProjections change feed) — it never replays session logs and never
 * builds a tokenizer. Buckets are disjoint; totals are their plain sum.
 * Sessions leaving the store keep their history: usage already happened, so
 * windows never subtract.
 *
 * After a host restart the first observed totals count once as the initial
 * delta (documented process-ledger semantics, "since process start").
 *
 * @module @yeisme/dsh-token-usage-host/ledger
 */

import { readBucketsPayload, safeSessionRefSchema } from './projection.ts'
import type { TokenBucketsV1, TokenUsageSnapshotV1, TokenUsageSessionRowV1 } from './types.ts'

export const BY_SESSION_BOUND = 20

const EMPTY: TokenBucketsV1 = Object.freeze({
  uncachedInputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
})

function addBuckets(left: TokenBucketsV1, right: TokenBucketsV1): TokenBucketsV1 {
  return {
    uncachedInputTokens: left.uncachedInputTokens + right.uncachedInputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
    cacheWriteTokens: left.cacheWriteTokens + right.cacheWriteTokens,
  }
}

function bucketDelta(next: TokenBucketsV1, previous: TokenBucketsV1): TokenBucketsV1 {
  return {
    uncachedInputTokens: next.uncachedInputTokens - previous.uncachedInputTokens,
    outputTokens: next.outputTokens - previous.outputTokens,
    cacheReadTokens: next.cacheReadTokens - previous.cacheReadTokens,
    cacheWriteTokens: next.cacheWriteTokens - previous.cacheWriteTokens,
  }
}

function totalOf(buckets: TokenBucketsV1): number {
  return buckets.uncachedInputTokens + buckets.outputTokens + buckets.cacheReadTokens + buckets.cacheWriteTokens
}

/** UTC day key, e.g. `2026-08-27`. */
export function utcDayKey(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10)
}

/** UTC ISO-8601 week key (Monday start), e.g. `2026-W35`. */
export function utcWeekKey(epochMs: number): string {
  const date = new Date(epochMs)
  const day = date.getUTCDay() || 7
  const thursday = new Date(date)
  thursday.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

interface SessionRecord {
  readonly sessionRef: string
  readonly label: string
  buckets: TokenBucketsV1
  lastSeen: TokenBucketsV1
  lastChangedAt: number
}

export interface TokenLedgerSnapshotInput {
  readonly now: number
  /** Sessions with at least one non-zero bucket enter bySession. */
  readonly includeEmpty?: boolean
}

/**
 * Fold state for the tokenUsage Remote. One instance per host process.
 */
export class TokenLedger {
  private readonly sessions = new Map<string, SessionRecord>()
  private readonly providers = new Map<string, TokenBucketsV1>()
  private readonly providerLabels = new Map<string, string>()
  private readonly days = new Map<string, TokenBucketsV1>()
  private readonly weeks = new Map<string, TokenBucketsV1>()
  private process: TokenBucketsV1 = EMPTY
  private lastActivityAt: number | null = null
  private lastActivityRef: string | null = null
  private providerBySession = new Map<string, string>()

  /**
   * Fold one official tokenUsage observation. The delta against the last
   * observation of the same session is signed: a replacement sample that
   * lowers a step's totals folds back down instead of double counting.
   */
  observeTokenUsage(sessionRefRaw: string, bucketsRaw: unknown, at: number): void {
    const ref = safeSessionRefSchema.safeParse(sessionRefRaw)
    if (!ref.success) return
    const sessionRef = ref.data
    const buckets = readBucketsPayload(bucketsRaw)
    if (buckets === null) return
    const existing = this.sessions.get(sessionRef)
    if (existing === undefined) {
      this.record(sessionRef, sessionRef, buckets, buckets, at)
      return
    }
    const delta = bucketDelta(buckets, existing.lastSeen)
    if (totalOf(delta) === 0) {
      existing.lastSeen = buckets
      return
    }
    existing.lastSeen = buckets
    this.applyDelta(sessionRef, delta, at)
  }

  /** Remember the provider route for a session (`request/context` events). */
  observeProvider(sessionRefRaw: string, provider: string): void {
    const ref = safeSessionRefSchema.safeParse(sessionRefRaw)
    if (!ref.success || provider.length === 0 || provider.length > 64) return
    this.providerBySession.set(ref.data, provider)
  }

  /** The most recently routed provider, used for balance availability. */
  lastProvider(): string | null {
    if (this.providerBySession.size === 0) return null
    let last: string | null = null
    for (const value of this.providerBySession.values()) last = value
    return last
  }

  private record(
    sessionRef: string,
    label: string,
    initialDelta: TokenBucketsV1,
    lastSeen: TokenBucketsV1,
    at: number,
  ): void {
    // First observation folds in once (process-start semantics); the record
    // starts empty so applyDelta is the single accumulation path.
    this.sessions.set(sessionRef, { sessionRef, label, buckets: EMPTY, lastSeen, lastChangedAt: at })
    this.applyDelta(sessionRef, initialDelta, at)
  }

  private applyDelta(sessionRef: string, delta: TokenBucketsV1, at: number): void {
    const record = this.sessions.get(sessionRef)
    if (record === undefined) return
    record.buckets = addBuckets(record.buckets, delta)
    record.lastChangedAt = at
    this.process = addBuckets(this.process, delta)
    this.lastActivityAt = at
    this.lastActivityRef = sessionRef
    const day = this.days.get(utcDayKey(at)) ?? EMPTY
    this.days.set(utcDayKey(at), addBuckets(day, delta))
    const week = this.weeks.get(utcWeekKey(at)) ?? EMPTY
    this.weeks.set(utcWeekKey(at), addBuckets(week, delta))
    const providerId = this.providerBySession.get(sessionRef) ?? 'unknown'
    const providerTotals = this.providers.get(providerId) ?? EMPTY
    this.providers.set(providerId, addBuckets(providerTotals, delta))
    if (!this.providerLabels.has(providerId)) {
      this.providerLabels.set(providerId, providerId === 'unknown' ? 'Unknown provider' : providerId)
    }
  }

  /**
   * Build the safe usage snapshot. Windows reflect the UTC day/week of `now`;
   * a restart or clock jump just means the older keys stop matching.
   */
  snapshot(input: TokenLedgerSnapshotInput): TokenUsageSnapshotV1 {
    const now = input.now
    const rows = [...this.sessions.values()]
      .filter(record => input.includeEmpty === true || totalOf(record.buckets) > 0)
      .sort((left, right) => right.lastChangedAt - left.lastChangedAt || left.sessionRef.localeCompare(right.sessionRef))
    const truncated = rows.length > BY_SESSION_BOUND
    const bySession: readonly TokenUsageSessionRowV1[] = rows
      .slice(0, BY_SESSION_BOUND)
      .map(record => ({ sessionRef: record.sessionRef, label: record.label, buckets: record.buckets }))
    const current =
      this.lastActivityRef === null ? undefined : this.sessions.get(this.lastActivityRef)
    // A record exists only after a real tokenUsage observation, so the most
    // recently active one is the honest "current" row even at zero totals.
    const currentSession =
      current === undefined
        ? undefined
        : { sessionRef: current.sessionRef, label: current.label, buckets: current.buckets }
    return {
      schemaVersion: 'token.usage.snapshot.v1alpha1',
      generatedAt: new Date(now).toISOString(),
      freshness: this.lastActivityAt === null ? 'unknown' : 'fresh',
      ...(currentSession === undefined ? {} : { currentSession }),
      windows: {
        today: this.days.get(utcDayKey(now)) ?? EMPTY,
        week: this.weeks.get(utcWeekKey(now)) ?? EMPTY,
        process: this.process,
      },
      bySession,
      byProvider: [...this.providers.entries()]
        .filter(([, buckets]) => totalOf(buckets) > 0)
        .map(([providerId, buckets]) => ({
          providerId,
          label: this.providerLabels.get(providerId) ?? providerId,
          buckets,
        }))
        .sort((left, right) => totalOf(right.buckets) - totalOf(left.buckets)),
      truncated,
    }
  }

  /** Forget a session's live tracking (its folded history stays). */
  forget(sessionRef: string): void {
    this.providerBySession.delete(sessionRef)
  }
}
