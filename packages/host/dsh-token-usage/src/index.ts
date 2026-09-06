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
import { HostCredentialSource, type CredentialProviderFace } from './balance.ts'
import { SessionInsightsEngine, type SessionContextRead } from './insights.ts'
import { TokenUsageRemoteService } from './remote.ts'
import { SessionQueryHistorySource, type SessionQueryFace } from './session-query-source.ts'
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

function probeService<T>(ctx: Context, key: string, guard: (value: unknown) => value is T): T | undefined {
  let value: unknown
  try {
    value = (ctx as unknown as { get(name: string): unknown }).get(key)
  } catch {
    return undefined
  }
  return guard(value) ? value : undefined
}

function isSessionQueryFace(value: unknown): value is SessionQueryFace {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { readSession?: unknown }).readSession === 'function'
  )
}

function isCredentialProviderFace(value: unknown): value is CredentialProviderFace {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { resolve?: unknown }).resolve === 'function'
  )
}

/** Read the contextPressure projection feed value into a safe context block. */
function readContextPressure(value: unknown): SessionContextRead | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const record = value as { projectedTokens?: unknown; pressureTokens?: unknown; contextWindow?: unknown }
  const projected = typeof record.projectedTokens === 'number' && record.projectedTokens >= 0 ? record.projectedTokens : undefined
  const pressure = typeof record.pressureTokens === 'number' && record.pressureTokens >= 0 ? record.pressureTokens : undefined
  const limit = typeof record.contextWindow === 'number' && record.contextWindow >= 0 ? record.contextWindow : undefined
  const used = projected ?? pressure
  if (used === undefined && limit === undefined) return undefined
  return { ...(used === undefined ? {} : { used }), ...(limit === undefined ? {} : { limit }) }
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
  const credentialProvider = probeService(ctx, 'credentials', isCredentialProviderFace)
  const credentials = new HostCredentialSource({
    ...(credentialProvider === undefined ? {} : { provider: credentialProvider }),
    ref: apiKeyEnv,
    fallback: () => readEnvCredential(apiKeyEnv),
  })
  const sessionQuery = probeService(ctx, 'sessionQuery', isSessionQueryFace)
  const contextCache = new Map<string, SessionContextRead>()
  const insights =
    sessionQuery === undefined
      ? undefined
      : new SessionInsightsEngine(new SessionQueryHistorySource(sessionQuery, { contextCache }))
  const service = new TokenUsageService({
    credentials,
    ...(insights === undefined ? {} : { insights }),
    ...(config.balanceBaseUrl === undefined ? {} : { baseUrl: config.balanceBaseUrl }),
  })
  const ledger = service.ledger

  ctx.effect(() => registry.onChanged((session, key, value) => {
    if (key === 'tokenUsage') {
      ledger.observeTokenUsage(session.id, value, Date.now())
      // Keep insights revisions live: refold the changed session in the
      // background. Idempotent — replays never double count; failures are
      // contained (the next explicit query re-reads authoritatively).
      insights?.query({ sessionRef: session.id }).catch(() => undefined)
      return
    }
    if (key === 'contextPressure') {
      const read = readContextPressure(value)
      if (read === undefined) contextCache.delete(session.id)
      else contextCache.set(session.id, read)
    }
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
  HostCredentialSource,
  mapBalanceResponse,
} from './balance.ts'
export type { BalanceCredentialSource, BalanceFetchLike, CredentialProviderFace, DeepSeekBalanceClientOptions, HostCredentialSourceOptions } from './balance.ts'
export { TokenUsageService } from './service.ts'
export type { TokenUsageServiceFace, TokenUsageServiceOptions, TokenUsageSnapshotParts } from './service.ts'
export { TokenUsageRemoteService, tokenUsageRemoteMarkers } from './remote.ts'
export {
  SessionInaccessibleError,
  SessionInsightsEngine,
  normalizeInsightsQuery,
  normalizeSampleBuckets,
} from './insights.ts'
export type {
  BucketSemantics,
  NormalizedInsightsQuery,
  RawCost,
  RawTokenUsage,
  RawUsageSample,
  SessionContextRead,
  SessionHistoryRead,
  SessionHistorySource,
  SessionInsightsStoreOptions,
} from './insights.ts'
export { SessionQueryHistorySource, samplesFromSessionLog } from './session-query-source.ts'
export type { SessionQueryFace, SessionQueryHistorySourceOptions } from './session-query-source.ts'
export {
  insightsQueryInputSchema,
  parseBalanceSnapshot,
  parseInsightsQueryInput,
  parseInsightsSnapshot,
  parseUsageSnapshot,
  readBucketsPayload,
  safeSessionRefSchema,
  tokenBucketsSchema,
} from './projection.ts'
export {
  SESSION_INSIGHTS_BREAKDOWN_BOUND,
  SESSION_INSIGHTS_DEFAULT_LIMIT,
  SESSION_INSIGHTS_MAX_LIMIT,
  SESSION_INSIGHTS_SCHEMA_VERSION,
  TOKEN_BALANCE_SCHEMA_VERSION,
  TOKEN_USAGE_REMOTE_SERVICE_KEY,
  TOKEN_USAGE_SCHEMA_VERSION,
  TOKEN_USAGE_SPEC_VERSION,
} from './types.ts'
export type {
  SessionInsightsBreakdownRowV1,
  SessionInsightsBreakdownV1,
  SessionInsightsBucketsV1,
  SessionInsightsContextV1,
  SessionInsightsCostKind,
  SessionInsightsCostV1,
  SessionInsightsCoverageV1,
  SessionInsightsDescendantsV1,
  SessionInsightsInheritedV1,
  SessionInsightsQueryFailureCode,
  SessionInsightsQueryFailureV1,
  SessionInsightsQueryInputV1,
  SessionInsightsQueryOkV1,
  SessionInsightsQueryResultV1,
  SessionInsightsReasonCode,
  SessionInsightsRequestRowV1,
  SessionInsightsScope,
  SessionInsightsSnapshotV1,
  SessionInsightsSourceV1,
  SessionInsightsTotalsV1,
  TokenBalanceInfoV1,
  TokenBalanceReasonCode,
  TokenBalanceSnapshotV1,
  TokenBalanceStatus,
  TokenBucketsV1,
  TokenUsageCapabilitiesOkV1,
  TokenUsageCapabilitiesV1,
  TokenUsageFailureV1,
  TokenUsageProviderRowV1,
  TokenUsageQueryCapabilityV1,
  TokenUsageRefreshOkV1,
  TokenUsageSessionRowV1,
  TokenUsageSnapshotOkV1,
  TokenUsageSnapshotV1,
} from './types.ts'
