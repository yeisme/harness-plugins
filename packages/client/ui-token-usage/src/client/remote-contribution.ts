/**
 * Browser-side self-mounted `tokenUsage` Remote contribution.
 *
 * Out-of-tree namespaces are not in the Client assembly's generated
 * allowlist, so this plugin mounts its own strict descriptor through the
 * public `ctx.remote.$mount()` API. No zod/typert runtime dependency
 * (single-file ModuleLoader contract): parsing is structural and mirrors
 * `@yeisme/dsh-token-usage-host` field-for-field.
 *
 * @module @yeisme/dsh-client-ui-token-usage/client/remote-contribution
 */

import type {
  TokenBalanceSnapshotV1,
  TokenBucketsV1,
  TokenUsageRefreshAnswerV1,
  TokenUsageSnapshotAnswerV1,
} from '../wire.ts'

interface MinimalSchema<Output> {
  parse(value: unknown): Output
}

interface StrictCodec {
  readonly mode: 'strict'
  readonly typeSymbol: string
  readonly schema: MinimalSchema<unknown>
}

export interface TokenUsageInvocationDescriptor {
  readonly id: string
  readonly service: 'tokenUsage'
  readonly namespace: 'tokenUsage'
  readonly method: 'snapshot' | 'refreshBalance'
  readonly invocation: { readonly kind: 'direct' }
  readonly parameters: readonly []
  readonly result: StrictCodec
}

export interface TokenUsageRemoteContribution {
  readonly package: '@yeisme/dsh-token-usage-host'
  readonly descriptors: readonly TokenUsageInvocationDescriptor[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function expectString(value: unknown, field: string): void {
  if (typeof value !== 'string') throw new TypeError(`tokenUsage wire: ${field} must be a string`)
}

function parseBuckets(value: unknown, field: string): TokenBucketsV1 {
  if (!isRecord(value)) throw new TypeError(`tokenUsage wire: ${field} must be a record`)
  for (const key of ['uncachedInputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens']) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
      throw new TypeError(`tokenUsage wire: ${field}.${key} must be a number`)
    }
  }
  return value as unknown as TokenBucketsV1
}

function parseBalance(value: unknown, field: string): TokenBalanceSnapshotV1 {
  if (!isRecord(value)) throw new TypeError(`tokenUsage wire: ${field} must be a record`)
  expectString(value.schemaVersion, `${field}.schemaVersion`)
  expectString(value.generatedAt, `${field}.generatedAt`)
  expectString(value.safeMessage, `${field}.safeMessage`)
  if (value.status !== 'ready' && value.status !== 'unavailable' && value.status !== 'unsupported' && value.status !== 'error') {
    throw new TypeError(`tokenUsage wire: ${field}.status invalid`)
  }
  if (value.infos !== undefined) {
    if (!Array.isArray(value.infos)) throw new TypeError(`tokenUsage wire: ${field}.infos must be an array`)
    for (const info of value.infos) {
      if (!isRecord(info)) throw new TypeError(`tokenUsage wire: ${field}.infos[] must be a record`)
      if (info.currency !== 'CNY' && info.currency !== 'USD') {
        throw new TypeError(`tokenUsage wire: ${field}.infos[].currency invalid`)
      }
      expectString(info.totalBalance, `${field}.infos[].totalBalance`)
      expectString(info.grantedBalance, `${field}.infos[].grantedBalance`)
      expectString(info.toppedUpBalance, `${field}.infos[].toppedUpBalance`)
    }
  }
  return value as unknown as TokenBalanceSnapshotV1
}

const snapshotAnswerSchema: MinimalSchema<TokenUsageSnapshotAnswerV1> = {
  parse(value: unknown): TokenUsageSnapshotAnswerV1 {
    if (!isRecord(value) || typeof value.ok !== 'boolean') {
      throw new TypeError('tokenUsage.snapshot answer: ok discriminator missing')
    }
    if (value.ok) {
      expectString(value.specVersion, 'snapshot.specVersion')
      const usage = value.usage
      if (!isRecord(usage)) throw new TypeError('tokenUsage.snapshot answer: usage must be a record')
      expectString(usage.schemaVersion, 'usage.schemaVersion')
      expectString(usage.generatedAt, 'usage.generatedAt')
      const windows = isRecord(usage.windows) ? usage.windows : {}
      parseBuckets(windows.today ?? {}, 'usage.windows.today')
      parseBuckets(windows.week ?? {}, 'usage.windows.week')
      parseBuckets(windows.process ?? {}, 'usage.windows.process')
      if (!Array.isArray(usage.bySession) || !Array.isArray(usage.byProvider)) {
        throw new TypeError('tokenUsage.snapshot answer: bySession/byProvider must be arrays')
      }
      parseBalance(value.balance, 'snapshot.balance')
    }
    return value as unknown as TokenUsageSnapshotAnswerV1
  },
}

const refreshAnswerSchema: MinimalSchema<TokenUsageRefreshAnswerV1> = {
  parse(value: unknown): TokenUsageRefreshAnswerV1 {
    if (!isRecord(value) || typeof value.ok !== 'boolean') {
      throw new TypeError('tokenUsage.refreshBalance answer: ok discriminator missing')
    }
    if (value.ok) {
      expectString(value.specVersion, 'refresh.specVersion')
      parseBalance(value.balance, 'refresh.balance')
    }
    return value as unknown as TokenUsageRefreshAnswerV1
  },
}

export const tokenUsageRemoteContribution: TokenUsageRemoteContribution = {
  package: '@yeisme/dsh-token-usage-host',
  descriptors: [
    {
      id: '@yeisme/dsh-token-usage-host/tokenUsage.snapshot@1',
      service: 'tokenUsage',
      namespace: 'tokenUsage',
      method: 'snapshot',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'strict', typeSymbol: 'TokenUsageSnapshotAnswerV1', schema: snapshotAnswerSchema },
    },
    {
      id: '@yeisme/dsh-token-usage-host/tokenUsage.refreshBalance@1',
      service: 'tokenUsage',
      namespace: 'tokenUsage',
      method: 'refreshBalance',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'strict', typeSymbol: 'TokenUsageRefreshAnswerV1', schema: refreshAnswerSchema },
    },
  ],
}
