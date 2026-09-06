/**
 * `tokenUsage` Typert Remote service face.
 *
 * Thin forwarder: the ledger and balance client own state. Failures return
 * as-is — never retried, never auto-refreshed by this layer.
 *
 * @module @yeisme/dsh-token-usage-host/remote
 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService, remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { parseBalanceSnapshot, parseInsightsQueryInput, parseInsightsSnapshot, parseUsageSnapshot } from './projection.ts'
import type { TokenUsageServiceFace } from './service.ts'
import {
  TOKEN_USAGE_REMOTE_SERVICE_KEY,
  TOKEN_USAGE_SPEC_VERSION,
  type SessionInsightsQueryResultV1,
  type TokenUsageCapabilitiesOkV1,
  type TokenUsageFailureV1,
  type TokenUsageRefreshOkV1,
  type TokenUsageSnapshotOkV1,
} from './types.ts'

export class TokenUsageRemoteService extends TypertRemoteService {
  private readonly service: TokenUsageServiceFace

  constructor(ctx: Context, service: TokenUsageServiceFace) {
    super(ctx, TOKEN_USAGE_REMOTE_SERVICE_KEY)
    this.service = service
  }

  @Remote
  async snapshot(): Promise<TokenUsageSnapshotOkV1 | TokenUsageFailureV1> {
    const built = this.service.snapshot()
    return {
      ok: true,
      specVersion: TOKEN_USAGE_SPEC_VERSION,
      usage: parseUsageSnapshot(built.usage),
      balance: parseBalanceSnapshot(built.balance),
    }
  }

  @Remote
  async refreshBalance(): Promise<TokenUsageRefreshOkV1 | TokenUsageFailureV1> {
    const balance = await this.service.refreshBalance()
    return {
      ok: true,
      specVersion: TOKEN_USAGE_SPEC_VERSION,
      balance: parseBalanceSnapshot(balance),
    }
  }

  /**
   * Capability probe: clients MUST probe before calling `query` instead of
   * guessing by invocation failure on an old host.
   */
  @Remote
  async capabilities(): Promise<TokenUsageCapabilitiesOkV1> {
    const capabilities = this.service.capabilities?.() ?? {
      query: { available: false, reason: 'The connected host predates the insights query capability.' },
    }
    return { ok: true, specVersion: TOKEN_USAGE_SPEC_VERSION, capabilities }
  }

  /**
   * Whole-history session insights query (additive). Input passes the strict
   * whitelist first; the snapshot is re-validated before it leaves the host.
   */
  @Remote
  async query(input: unknown): Promise<SessionInsightsQueryResultV1> {
    if (this.service.query === undefined) {
      return { ok: false, code: 'insights_unavailable', message: 'The session insights query is not available on this host.' }
    }
    const parsed = parseInsightsQueryInput(input)
    if (parsed === undefined) {
      return { ok: false, code: 'invalid_input', message: 'The query input failed validation.' }
    }
    const result = await this.service.query(parsed)
    if (!result.ok) return result
    return { ok: true, specVersion: TOKEN_USAGE_SPEC_VERSION, snapshot: parseInsightsSnapshot(result.snapshot) }
  }
}

export function tokenUsageRemoteMarkers(service: TokenUsageRemoteService) {
  return remoteMethods(service)
}
