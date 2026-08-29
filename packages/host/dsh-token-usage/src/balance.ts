/**
 * DeepSeek official-route balance client (host-only).
 *
 * Only `deepseek-official` routes are queried. The API key is resolved from
 * the credential port (host seam, e.g. env `DEEPSEEK_API_KEY`) and NEVER
 * enters a projection, log line, or error message. Amounts stay the official
 * strings; a mismatched contract degrades honestly instead of guessing.
 *
 * @module @yeisme/dsh-token-usage-host/balance
 */

import { parseBalanceSnapshot } from './projection.ts'
import type { TokenBalanceInfoV1, TokenBalanceSnapshotV1 } from './types.ts'

export const DEEPSEEK_OFFICIAL_PROVIDER = 'deepseek-official'
export const DEEPSEEK_OFFICIAL_BALANCE_URL = 'https://api.deepseek.com/user/balance'
export const BALANCE_MIN_INTERVAL_MS = 15_000

/** Credential resolution port: the host seam decides where keys live. */
export interface BalanceCredentialSource {
  resolveApiKey(): string | undefined
}

export interface BalanceFetchLike {
  (input: string, init: { method: 'GET'; headers: Readonly<Record<string, string>>; signal: AbortSignal }): Promise<{
    ok: boolean
    status: number
    json(): Promise<unknown>
  }>
}

export interface DeepSeekBalanceClientOptions {
  readonly now?: () => number
  readonly fetch?: BalanceFetchLike
  readonly credentials: BalanceCredentialSource
  readonly baseUrl?: string
}

interface BalanceWireInfo {
  readonly currency?: unknown
  readonly total_balance?: unknown
  readonly granted_balance?: unknown
  readonly topped_up_balance?: unknown
}

function unavailable(
  generatedAt: string,
  reasonCode: 'provider_not_deepseek' | 'credential_missing',
  safeMessage: string,
): TokenBalanceSnapshotV1 {
  const status = reasonCode === 'provider_not_deepseek' ? 'unsupported' : 'unavailable'
  return { schemaVersion: 'token.balance.snapshot.v1alpha1', status, freshness: 'unknown', generatedAt, reasonCode, safeMessage }
}

function amountShape(value: unknown): value is string {
  return typeof value === 'string' && /^\d+(\.\d+)?$/u.test(value)
}

/**
 * Whitelist-map one official response body. Any invalid info row is dropped;
 * an entirely invalid payload is a contract mismatch, never a guess.
 */
export function mapBalanceResponse(body: unknown): { isAvailable: boolean; infos: TokenBalanceInfoV1[] } | null {
  if (body === null || typeof body !== 'object') return null
  const record = body as { is_available?: unknown; balance_infos?: unknown }
  if (typeof record.is_available !== 'boolean' || !Array.isArray(record.balance_infos)) return null
  const infos: TokenBalanceInfoV1[] = []
  for (const row of record.balance_infos as BalanceWireInfo[]) {
    if (row === null || typeof row !== 'object') continue
    if (row.currency !== 'CNY' && row.currency !== 'USD') continue
    if (!amountShape(row.total_balance) || !amountShape(row.granted_balance) || !amountShape(row.topped_up_balance)) continue
    infos.push({
      currency: row.currency,
      totalBalance: row.total_balance,
      grantedBalance: row.granted_balance,
      toppedUpBalance: row.topped_up_balance,
    })
  }
  if (infos.length === 0) return null
  return { isAvailable: record.is_available, infos }
}

export class DeepSeekBalanceClient {
  private readonly now: () => number
  private readonly doFetch: BalanceFetchLike
  private readonly credentials: BalanceCredentialSource
  private readonly baseUrl: string
  private lastCompletedAt = Number.NEGATIVE_INFINITY
  private lastGood: TokenBalanceSnapshotV1 | null = null
  private lastProjection: TokenBalanceSnapshotV1 | null = null

  constructor(options: DeepSeekBalanceClientOptions) {
    this.now = options.now ?? (() => Date.now())
    this.doFetch = options.fetch ?? (fetch as unknown as BalanceFetchLike)
    this.credentials = options.credentials
    this.baseUrl = options.baseUrl ?? DEEPSEEK_OFFICIAL_BALANCE_URL
  }

  /** Current projection without any HTTP (throttle-safe read). */
  current(): TokenBalanceSnapshotV1 {
    if (this.lastProjection !== null) return this.lastProjection
    return unavailable(new Date(this.now()).toISOString(), 'credential_missing', 'Balance has not been refreshed yet.')
  }

  /**
   * Refresh the balance for a DeepSeek official route. Non-DeepSeek
   * providers never issue HTTP. Failures keep the last good amounts and mark
   * the snapshot stale instead of clearing or inventing numbers. A refresh
   * within the 15s throttle window returns the existing projection —
   * success or failure alike — without new HTTP.
   */
  async refresh(provider: string): Promise<TokenBalanceSnapshotV1> {
    const generatedAt = new Date(this.now()).toISOString()
    if (provider !== DEEPSEEK_OFFICIAL_PROVIDER) {
      return this.remember(unavailable(generatedAt, 'provider_not_deepseek', 'Balance is available for the DeepSeek official route only.'))
    }
    if (this.now() - this.lastCompletedAt < BALANCE_MIN_INTERVAL_MS && this.lastProjection !== null) {
      return this.lastProjection
    }
    const apiKey = this.credentials.resolveApiKey()
    if (apiKey === undefined || apiKey.length === 0) {
      return this.remember(unavailable(generatedAt, 'credential_missing', 'No API key is configured for the DeepSeek official route.'))
    }
    try {
      const response = await this.doFetch(this.baseUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      })
      this.lastCompletedAt = this.now()
      if (!response.ok) {
        return this.remember(this.degrade(generatedAt, 'network_failed', `Balance request failed with status ${response.status}.`))
      }
      const mapped = mapBalanceResponse(await response.json())
      if (mapped === null) {
        return this.remember(this.degrade(generatedAt, 'contract_mismatch', 'The balance response did not match the expected contract.'))
      }
      this.lastGood = parseBalanceSnapshot({
        schemaVersion: 'token.balance.snapshot.v1alpha1',
        status: 'ready',
        freshness: 'fresh',
        generatedAt,
        safeMessage: 'DeepSeek balance.',
        isAvailable: mapped.isAvailable,
        infos: mapped.infos,
      })
      return this.remember(this.lastGood)
    } catch {
      this.lastCompletedAt = this.now()
      return this.remember(this.degrade(generatedAt, 'network_failed', 'The balance request could not be completed.'))
    }
  }

  private remember(snapshot: TokenBalanceSnapshotV1): TokenBalanceSnapshotV1 {
    this.lastProjection = snapshot
    return snapshot
  }

  private degrade(generatedAt: string, reasonCode: 'network_failed' | 'contract_mismatch', safeMessage: string): TokenBalanceSnapshotV1 {
    if (this.lastGood === null) {
      return parseBalanceSnapshot({
        schemaVersion: 'token.balance.snapshot.v1alpha1',
        status: 'error',
        freshness: 'unknown',
        generatedAt,
        reasonCode,
        safeMessage,
      })
    }
    return parseBalanceSnapshot({
      schemaVersion: 'token.balance.snapshot.v1alpha1',
      status: 'error',
      freshness: 'stale',
      generatedAt,
      reasonCode,
      safeMessage,
      isAvailable: this.lastGood.isAvailable,
      infos: this.lastGood.infos,
    })
  }
}
