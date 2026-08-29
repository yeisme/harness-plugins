/**
 * Host plugin: sessionProjections/sessions seams → tokenUsage Remote.
 *
 * The ledger folds official `tokenUsage` projection deltas; the balance
 * client queries DeepSeek's official route only, host-side, with the API key
 * resolved through the credential port and never projected. Missing seams
 * fail closed: the plugin unloads without faking a ledger.
 *
 * @module @yeisme/dsh-token-usage-host
 */

import type { Context } from '@deepseek-ai/cordis'
import { TokenUsageRemoteService } from './remote.ts'
import { TokenUsageService } from './service.ts'

export const name = 'dsh-token-usage-host'
export const inject = ['typert', 'sessionProjections'] as const

/** Structural faces: linked dev packages may differ physically from DSH core. */
interface SessionProjectionRegistryFace {
  onChanged(listener: (session: { readonly id: string }, key: string, value: unknown, seq: number) => void): () => void
}

interface SessionEventLike {
  readonly type?: string
  readonly provider?: unknown
}

interface TokenUsagePluginConfig {
  /** Env var the credential port reads for the official-route API key. */
  readonly apiKeyEnv?: string
  readonly balanceBaseUrl?: string
}

function readEnvCredential(envName: string): string | undefined {
  const value = process.env[envName]
  return value === undefined || value.trim().length === 0 ? undefined : value.trim()
}

/**
 * Apply the host plugin. `apply` subscribes to the projection change feed
 * (tokenUsage deltas) and `session/event` (`request/context` provider rows);
 * both subscriptions ride the caller's fiber and end with it.
 */
export function apply(ctx: Context, config: TokenUsagePluginConfig = {}): void {
  let registry: SessionProjectionRegistryFace | undefined
  try {
    registry = ctx.get('sessionProjections') as SessionProjectionRegistryFace | undefined
  } catch {
    registry = undefined
  }
  if (registry === undefined || typeof registry.onChanged !== 'function') {
    // Fail closed: without the projection seam there is no honest ledger.
    return
  }
  const apiKeyEnv = config.apiKeyEnv ?? 'DEEPSEEK_API_KEY'
  const service = new TokenUsageService({
    credentials: { resolveApiKey: () => readEnvCredential(apiKeyEnv) },
    ...(config.balanceBaseUrl === undefined ? {} : { baseUrl: config.balanceBaseUrl }),
  })
  const ledger = service.ledger

  ctx.effect(() => registry.onChanged((session, key, value) => {
    if (key !== 'tokenUsage') return
    ledger.observeTokenUsage(session.id, value, Date.now())
  }), 'dsh-token-usage-host: ledger projection feed')

  const onSessionEvent = (session: { readonly id: string }, event: SessionEventLike): void => {
    if (event.type !== 'request/context') return
    if (typeof event.provider !== 'string' || event.provider.length === 0) return
    ledger.observeProvider(session.id, event.provider)
  }
  // The official event name arrives with the dsh-session Context augmentation;
  // linked dev packages may resolve a different copy, so subscribe structurally.
  ;(ctx as unknown as { on(event: 'session/event', listener: typeof onSessionEvent): () => void }).on('session/event', onSessionEvent)

  // The Remote registers itself on construction and unregisters with the fiber.
  const remote = new TokenUsageRemoteService(ctx, service)
  void remote
}

const DshTokenUsageHostPlugin = { name, inject, apply }
export default DshTokenUsageHostPlugin

export { TokenLedger, BY_SESSION_BOUND, utcDayKey, utcWeekKey } from './ledger.ts'
export type { TokenLedgerSnapshotInput } from './ledger.ts'
export {
  BALANCE_MIN_INTERVAL_MS,
  DEEPSEEK_OFFICIAL_BALANCE_URL,
  DEEPSEEK_OFFICIAL_PROVIDER,
  DeepSeekBalanceClient,
  mapBalanceResponse,
} from './balance.ts'
export type { BalanceCredentialSource, BalanceFetchLike, DeepSeekBalanceClientOptions } from './balance.ts'
export { TokenUsageService } from './service.ts'
export type { TokenUsageServiceFace, TokenUsageServiceOptions, TokenUsageSnapshotParts } from './service.ts'
export { TokenUsageRemoteService, tokenUsageRemoteMarkers } from './remote.ts'
export {
  parseBalanceSnapshot,
  parseUsageSnapshot,
  readBucketsPayload,
  safeSessionRefSchema,
  tokenBucketsSchema,
} from './projection.ts'
export {
  TOKEN_BALANCE_SCHEMA_VERSION,
  TOKEN_USAGE_REMOTE_SERVICE_KEY,
  TOKEN_USAGE_SCHEMA_VERSION,
  TOKEN_USAGE_SPEC_VERSION,
} from './types.ts'
export type {
  TokenBalanceInfoV1,
  TokenBalanceReasonCode,
  TokenBalanceSnapshotV1,
  TokenBalanceStatus,
  TokenBucketsV1,
  TokenUsageFailureV1,
  TokenUsageProviderRowV1,
  TokenUsageRefreshOkV1,
  TokenUsageSessionRowV1,
  TokenUsageSnapshotOkV1,
  TokenUsageSnapshotV1,
} from './types.ts'
