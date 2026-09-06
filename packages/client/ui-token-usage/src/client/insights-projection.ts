/**
 * Pure view-model derivation for the session insights statistics pane.
 *
 * No DOM, no RPC, no guessing: nullable buckets stay unknown ('—'), totals
 * are never zero-filled, truncation stays visible, and different currencies
 * are never summed together.
 *
 * @module @yeisme/dsh-client-ui-token-usage/client/insights-projection
 */

import type {
  SessionInsightsBucketsV1,
  SessionInsightsRequestRowV1,
  SessionInsightsSnapshotV1,
} from '../wire.ts'
import { formatTokens } from './projection.ts'

export interface InsightsMetricLine {
  readonly label: 'requests' | 'total' | 'output' | 'cacheRead' | 'cacheWrite' | 'wallClock' | 'sumDuration'
  /** Formatted value; null when unknown (rendered as '—', never zero). */
  readonly text: string | null
}

export interface InsightsBreakdownRowVM {
  readonly key: string
  readonly label: string
  readonly requestCount: string
  readonly tokensText: string | null
}

export interface InsightsRequestRowVM {
  readonly key: string
  readonly happenedAt: string | null
  readonly model: string | null
  readonly status: SessionInsightsRequestRowV1['status']
  readonly tokensText: string | null
  /** Opaque refs for the same-session trajectory locator; never paths/URLs. */
  readonly refs: {
    readonly sessionRef: string
    readonly attemptRef: string
    readonly requestRef?: string
    readonly runRef?: string
    readonly eventRef?: string
  }
}

export interface SessionInsightsViewModel {
  readonly sessionRef: string
  readonly scope: SessionInsightsSnapshotV1['scope']
  readonly revision: number
  readonly generatedAt: string
  readonly freshness: SessionInsightsSnapshotV1['freshness']
  readonly coverageStatus: SessionInsightsSnapshotV1['coverage']['status']
  /** Missing range / reason text; null when coverage is complete. */
  readonly coverageText: string | null
  readonly overview: readonly InsightsMetricLine[]
  readonly composition: readonly { readonly label: string; readonly text: string | null; readonly value: number | null }[]
  readonly costLines: readonly string[]
  readonly byModel: readonly InsightsBreakdownRowVM[]
  readonly byProvider: readonly InsightsBreakdownRowVM[]
  readonly byModelTruncated: boolean
  readonly byProviderTruncated: boolean
  readonly breakdownTruncated: boolean
  readonly context: {
    readonly available: boolean
    readonly usedText: string | null
    readonly limitText: string | null
    readonly remainingText: string | null
    /** Percentage only exists when the owner published a limit. */
    readonly percentText: string | null
    readonly reason: string | null
  }
  readonly requests: readonly InsightsRequestRowVM[]
  readonly nextCursor: string | null
  readonly truncated: boolean
  /** Confirmed-empty zero: coverage complete and the owner reports no requests. */
  readonly emptyConfirmed: boolean
  readonly safeMessage: string | null
}

function totalOf(buckets: SessionInsightsBucketsV1): number | null {
  const parts = [buckets.uncachedInputTokens, buckets.outputTokens, buckets.cacheReadTokens, buckets.cacheWriteTokens]
  if (parts.every(part => part === null)) return null
  // Owner-confirmed disjoint buckets: known parts sum, unknown parts are null
  // (never zero-filled — the sum is over confirmed values only).
  let sum = 0
  for (const part of parts) if (part !== null) sum += part
  return sum
}

function formatCount(value: number | null): string | null {
  return value === null ? null : formatTokens(value)
}

function formatDuration(ms: number | null): string | null {
  if (ms === null) return null
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${Math.round(seconds % 60)}s`
}

function breakdownRows(rows: SessionInsightsSnapshotV1['byModel']['rows']): readonly InsightsBreakdownRowVM[] {
  return rows.map(row => ({
    key: row.key,
    label: row.label,
    requestCount: String(row.requestCount),
    tokensText: formatCount(totalOf(row.buckets)),
  }))
}

function requestRows(rows: readonly SessionInsightsRequestRowV1[]): readonly InsightsRequestRowVM[] {
  return rows.map(row => ({
    key: row.attemptRef,
    happenedAt: row.happenedAt ?? null,
    model: row.model ?? null,
    status: row.status,
    tokensText: row.buckets === null ? null : formatCount(totalOf(row.buckets)),
    refs: {
      sessionRef: row.sessionRef,
      attemptRef: row.attemptRef,
      ...(row.requestRef === undefined ? {} : { requestRef: row.requestRef }),
      ...(row.runRef === undefined ? {} : { runRef: row.runRef }),
      ...(row.eventRef === undefined ? {} : { eventRef: row.eventRef }),
    },
  }))
}

export function deriveSessionInsightsViewModel(snapshot: SessionInsightsSnapshotV1): SessionInsightsViewModel {
  const totals = snapshot.totals
  const coverage = snapshot.coverage
  const context = snapshot.context
  const percentText = context.status === 'available' && context.limit !== undefined && context.limit > 0 && context.used !== undefined
    ? `${Math.round((context.used / context.limit) * 100)}%`
    : null
  const coverageText = coverage.status === 'complete'
    ? null
    : coverage.missingReason
      ?? (coverage.availableRange === undefined ? coverage.status : `${coverage.status} · ${coverage.availableRange.from} → ${coverage.availableRange.to}`)
  return {
    sessionRef: snapshot.sessionRef,
    scope: snapshot.scope,
    revision: snapshot.revision,
    generatedAt: snapshot.generatedAt,
    freshness: snapshot.freshness,
    coverageStatus: coverage.status,
    coverageText,
    overview: [
      { label: 'requests', text: formatCount(totals.requestCount) },
      { label: 'total', text: formatCount(totalOf(totals.buckets)) },
      { label: 'output', text: formatCount(totals.buckets.outputTokens) },
      { label: 'cacheRead', text: formatCount(totals.buckets.cacheReadTokens) },
      { label: 'wallClock', text: formatDuration(totals.wallClockMs) },
      { label: 'sumDuration', text: formatDuration(totals.sumRequestDurationMs) },
    ],
    composition: [
      { label: 'uncachedInput', text: formatCount(totals.buckets.uncachedInputTokens), value: totals.buckets.uncachedInputTokens },
      { label: 'output', text: formatCount(totals.buckets.outputTokens), value: totals.buckets.outputTokens },
      { label: 'cacheRead', text: formatCount(totals.buckets.cacheReadTokens), value: totals.buckets.cacheReadTokens },
      { label: 'cacheWrite', text: formatCount(totals.buckets.cacheWriteTokens), value: totals.buckets.cacheWriteTokens },
    ],
    // Per kind+currency lines; amounts stay official strings, never summed.
    costLines: (totals.cost ?? []).map(cost => `${cost.currency} ${cost.amount} (${cost.kind})`),
    byModel: breakdownRows(snapshot.byModel.rows),
    byProvider: breakdownRows(snapshot.byProvider.rows),
    byModelTruncated: snapshot.byModel.truncated,
    byProviderTruncated: snapshot.byProvider.truncated,
    breakdownTruncated: snapshot.byModel.truncated || snapshot.byProvider.truncated,
    context: {
      available: context.status === 'available',
      usedText: context.used === undefined ? null : formatTokens(context.used),
      limitText: context.limit === undefined ? null : formatTokens(context.limit),
      remainingText: context.remaining === undefined ? null : formatTokens(context.remaining),
      percentText,
      reason: context.reason ?? null,
    },
    requests: requestRows(snapshot.requests),
    nextCursor: snapshot.nextCursor ?? null,
    truncated: snapshot.truncated,
    emptyConfirmed: coverage.status === 'complete' && totals.requestCount === 0,
    safeMessage: snapshot.safeMessage ?? null,
  }
}
