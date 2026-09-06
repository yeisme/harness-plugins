/**
 * Service face: ledger + balance behind one snapshot/refresh pair.
 *
 * The plugin wires official seams into the ledger; this class only composes
 * and owns no subscriptions, so tests drive it directly.
 *
 * @module @yeisme/dsh-token-usage-host/service
 */

import { DeepSeekBalanceClient, type BalanceCredentialSource } from './balance.ts'
import type { SessionInsightsEngine } from './insights.ts'
import { TokenLedger } from './ledger.ts'
import {
  SESSION_INSIGHTS_SCHEMA_VERSION,
  type SessionInsightsQueryInputV1,
  type SessionInsightsQueryResultV1,
  type TokenBalanceSnapshotV1,
  type TokenUsageCapabilitiesV1,
  type TokenUsageSnapshotV1,
} from './types.ts'

export interface TokenUsageServiceOptions {
  readonly ledger?: TokenLedger
  readonly balance?: DeepSeekBalanceClient
  readonly credentials?: BalanceCredentialSource
  readonly insights?: SessionInsightsEngine
  readonly now?: () => number
}

export interface TokenUsageSnapshotParts {
  readonly usage: TokenUsageSnapshotV1
  readonly balance: TokenBalanceSnapshotV1
}

export interface TokenUsageServiceFace {
  snapshot(): TokenUsageSnapshotParts
  refreshBalance(): Promise<TokenBalanceSnapshotV1>
  /** Additive whole-history query; absent on old hosts — probe capabilities. */
  query?(input: SessionInsightsQueryInputV1): Promise<SessionInsightsQueryResultV1>
  capabilities?(): TokenUsageCapabilitiesV1
}

export class TokenUsageService implements TokenUsageServiceFace {
  readonly ledger: TokenLedger
  private readonly balanceClient: DeepSeekBalanceClient
  private readonly insights: SessionInsightsEngine | undefined
  private readonly now: () => number

  constructor(options: TokenUsageServiceOptions = {}) {
    this.now = options.now ?? (() => Date.now())
    this.ledger = options.ledger ?? new TokenLedger()
    this.insights = options.insights
    this.balanceClient = options.balance ?? new DeepSeekBalanceClient({
      credentials: options.credentials ?? { resolveApiKey: () => undefined },
      now: this.now,
    })
  }

  snapshot(): TokenUsageSnapshotParts {
    return {
      usage: this.ledger.snapshot({ now: this.now() }),
      balance: this.balanceClient.current(),
    }
  }

  refreshBalance(): Promise<TokenBalanceSnapshotV1> {
    return this.balanceClient.refresh(this.ledger.lastProvider() ?? 'unknown')
  }

  capabilities(): TokenUsageCapabilitiesV1 {
    return {
      query:
        this.insights === undefined
          ? { available: false, reason: 'No authorized session history seam is available on this host.' }
          : { available: true, schemaVersion: SESSION_INSIGHTS_SCHEMA_VERSION },
    }
  }

  query(input: SessionInsightsQueryInputV1): Promise<SessionInsightsQueryResultV1> {
    if (this.insights === undefined) {
      return Promise.resolve({
        ok: false,
        code: 'insights_unavailable',
        message: 'The session insights query is not available on this host.',
      })
    }
    return this.insights.query(input)
  }
}
