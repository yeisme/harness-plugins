/**
 * Pure view-model derivation for the token usage panel.
 *
 * No DOM, no RPC, no guessing: window sums are formatted from the snapshot
 * as received, truncation stays visible, and degrade states pass through.
 *
 * @module @yeisme/dsh-client-ui-token-usage/client/projection
 */

import {
  EMPTY_BUCKETS,
  type TokenBalanceSnapshotV1,
  type TokenBucketsV1,
  type TokenUsageSnapshotV1,
} from '../wire.ts'

export interface TokenUsageViewModel {
  readonly usageAvailable: boolean
  readonly currentSession: { readonly label: string; readonly text: string } | null
  readonly todayText: string
  readonly weekText: string
  readonly processText: string
  readonly bySession: readonly { readonly label: string; readonly text: string }[]
  readonly byProvider: readonly { readonly label: string; readonly text: string }[]
  readonly truncated: boolean
  readonly balance: {
    readonly visible: boolean
    readonly lines: readonly string[]
    readonly freshness: TokenBalanceSnapshotV1['freshness']
    readonly message: string | null
    readonly canRefresh: boolean
  }
  readonly generatedAt: string | null
}

function totalOf(buckets: TokenBucketsV1): number {
  return buckets.uncachedInputTokens + buckets.outputTokens + buckets.cacheReadTokens + buckets.cacheWriteTokens
}

/** Compact token counts: 12.4k / 1.2M; exact below 10k. */
export function formatTokens(count: number): string {
  if (!Number.isFinite(count) || count < 0) return '—'
  if (count < 10_000) return String(count)
  if (count < 1_000_000) return `${(count / 1_000).toFixed(1)}k`
  return `${(count / 1_000_000).toFixed(1)}M`
}

function isBuckets(value: unknown): value is TokenBucketsV1 {
  if (value === null || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.uncachedInputTokens === 'number'
    && typeof record.outputTokens === 'number'
    && typeof record.cacheReadTokens === 'number'
    && typeof record.cacheWriteTokens === 'number'
}

function safeBuckets(value: unknown): TokenBucketsV1 {
  return isBuckets(value) ? value : EMPTY_BUCKETS
}

/**
 * Derive the panel view model. Unknown/short shapes degrade to empty texts
 * rather than throwing; a usage snapshot with `freshness: 'unknown'` and no
 * rows reports `usageAvailable: false` so the panel shows its honest empty
 * state.
 */
export function deriveTokenUsageViewModel(input: {
  readonly usage?: TokenUsageSnapshotV1 | undefined
  readonly balance?: TokenBalanceSnapshotV1 | undefined
}): TokenUsageViewModel {
  const usage = input.usage
  const balance = input.balance
  const windows = usage?.windows
  const bySession = usage?.bySession ?? []
  const byProvider = usage?.byProvider ?? []
  const usageAvailable = usage !== undefined
    && (usage.freshness !== 'unknown' || bySession.length > 0 || totalOf(safeBuckets(windows?.process)) > 0)
  const current = usage?.currentSession
  const balanceVisible = balance?.status === 'ready'
  const balanceLines = balance?.infos?.map(info => `${info.currency} ${info.totalBalance}`) ?? []
  return {
    usageAvailable,
    currentSession: current === undefined ? null : { label: current.label, text: formatTokens(totalOf(safeBuckets(current.buckets))) },
    todayText: formatTokens(totalOf(safeBuckets(windows?.today))),
    weekText: formatTokens(totalOf(safeBuckets(windows?.week))),
    processText: formatTokens(totalOf(safeBuckets(windows?.process))),
    bySession: bySession.map(row => ({ label: row.label, text: formatTokens(totalOf(safeBuckets(row.buckets))) })),
    byProvider: byProvider.map(row => ({ label: row.label, text: formatTokens(totalOf(safeBuckets(row.buckets))) })),
    truncated: usage?.truncated === true,
    balance: {
      visible: balanceVisible,
      lines: balanceLines,
      freshness: balance?.freshness ?? 'unknown',
      message: balanceVisible || balance === undefined ? null : balance.safeMessage,
      canRefresh: balance?.status !== 'unsupported',
    },
    generatedAt: usage?.generatedAt ?? null,
  }
}
