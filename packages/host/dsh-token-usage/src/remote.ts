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
import { parseBalanceSnapshot, parseUsageSnapshot } from './projection.ts'
import type { TokenUsageServiceFace } from './service.ts'
import {
  TOKEN_USAGE_REMOTE_SERVICE_KEY,
  TOKEN_USAGE_SPEC_VERSION,
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
}

export function tokenUsageRemoteMarkers(service: TokenUsageRemoteService) {
  return remoteMethods(service)
}
