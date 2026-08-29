/**
 * Service face: ledger + balance behind one snapshot/refresh pair.
 *
 * The plugin wires official seams into the ledger; this class only composes
 * and owns no subscriptions, so tests drive it directly.
 *
 * @module @yeisme/dsh-token-usage-host/service
 */

import { DeepSeekBalanceClient, type BalanceCredentialSource } from './balance.ts'
import { TokenLedger } from './ledger.ts'
import type { TokenBalanceSnapshotV1, TokenUsageSnapshotV1 } from './types.ts'

export interface TokenUsageServiceOptions {
  readonly ledger?: TokenLedger
  readonly balance?: DeepSeekBalanceClient
  readonly credentials?: BalanceCredentialSource
  readonly now?: () => number
}

export interface TokenUsageSnapshotParts {
  readonly usage: TokenUsageSnapshotV1
  readonly balance: TokenBalanceSnapshotV1
}

export interface TokenUsageServiceFace {
  snapshot(): TokenUsageSnapshotParts
  refreshBalance(): Promise<TokenBalanceSnapshotV1>
}

export class TokenUsageService implements TokenUsageServiceFace {
  readonly ledger: TokenLedger
  private readonly balanceClient: DeepSeekBalanceClient
  private readonly now: () => number

  constructor(options: TokenUsageServiceOptions = {}) {
    this.now = options.now ?? (() => Date.now())
    this.ledger = options.ledger ?? new TokenLedger()
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
}
