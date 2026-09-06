/**
 * Token usage controller: legacy process snapshot + independent balance state.
 *
 * Usage load/retry and balance refresh are independent slices: a usage
 * failure never drops a successful balance result, and a balance failure
 * never hides the usage projection. Failures surface as honest error slices
 * with the previous value kept (marked stale by the view model) — never
 * retried automatically, never replaced with guesses, never swallowed.
 *
 * @module @yeisme/dsh-client-ui-token-usage/client/controller
 */

import type { TokenBalanceSnapshotV1, TokenUsageRemoteFace, TokenUsageSnapshotV1 } from '../wire.ts'

export type TokenUsageSlice =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly previous?: TokenUsageSnapshotV1 }
  | { readonly status: 'ready'; readonly usage: TokenUsageSnapshotV1 }
  | { readonly status: 'error'; readonly message: string; readonly previous?: TokenUsageSnapshotV1 }

export type TokenBalanceSlice =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly previous?: TokenBalanceSnapshotV1 }
  | { readonly status: 'ready'; readonly balance: TokenBalanceSnapshotV1 }
  | { readonly status: 'error'; readonly message: string; readonly previous?: TokenBalanceSnapshotV1 }

export interface TokenUsageControllerState {
  readonly usage: TokenUsageSlice
  readonly balance: TokenBalanceSlice
}

const IDLE: TokenUsageControllerState = Object.freeze({
  usage: Object.freeze({ status: 'idle' }),
  balance: Object.freeze({ status: 'idle' }),
})

export class TokenUsageController {
  private readonly remote: TokenUsageRemoteFace
  private state: TokenUsageControllerState = IDLE
  private readonly listeners = new Set<() => void>()
  private usageGeneration = 0
  private balanceGeneration = 0
  private disposed = false

  constructor(remote: TokenUsageRemoteFace) {
    this.remote = remote
  }

  getSnapshot(): TokenUsageControllerState {
    return this.state
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private setState(next: TokenUsageControllerState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }

  /** Cancel in-flight reads and discard their late replies (HMR/unload). */
  dispose(): void {
    this.disposed = true
    this.usageGeneration += 1
    this.balanceGeneration += 1
    this.listeners.clear()
  }

  /**
   * Authoritative read-only re-read of the legacy process snapshot. Explicit
   * retry only; errors keep the previous usage value (stale) plus the reason.
   */
  async refresh(): Promise<void> {
    const generation = ++this.usageGeneration
    const previous = this.state.usage.status === 'ready' ? this.state.usage.usage : undefined
    if (this.state.usage.status !== 'ready') {
      this.setState({ ...this.state, usage: previous === undefined ? { status: 'loading' } : { status: 'loading', previous } })
    }
    try {
      const answer = await this.remote.snapshot()
      if (this.disposed || generation !== this.usageGeneration) return
      if (answer.ok) {
        this.setState({
          usage: { status: 'ready', usage: answer.usage },
          balance: { status: 'ready', balance: answer.balance },
        })
      } else {
        this.setState({
          ...this.state,
          usage: {
            status: 'error',
            message: answer.message,
            ...(previous === undefined ? {} : { previous }),
          },
        })
      }
    } catch (error) {
      if (this.disposed || generation !== this.usageGeneration) return
      this.setState({
        ...this.state,
        usage: {
          status: 'error',
          message: error instanceof Error ? error.message : 'tokenUsage remote failed',
          ...(previous === undefined ? {} : { previous }),
        },
      })
    }
  }

  /**
   * Server-authored balance refresh (explicit user action only). Independent
   * of the usage slice: results land whether or not usage is ready, and
   * failures keep the previous balance with a readable reason.
   */
  async refreshBalance(): Promise<void> {
    const generation = ++this.balanceGeneration
    const current = this.state.balance
    const previous = current.status === 'ready' ? current.balance
      : current.status === 'error' || current.status === 'loading' ? current.previous
        : undefined
    this.setState({
      ...this.state,
      balance: previous === undefined ? { status: 'loading' } : { status: 'loading', previous },
    })
    try {
      const answer = await this.remote.refreshBalance()
      if (this.disposed || generation !== this.balanceGeneration) return
      if (answer.ok) {
        this.setState({ ...this.state, balance: { status: 'ready', balance: answer.balance } })
      } else {
        this.setState({
          ...this.state,
          balance: {
            status: 'error',
            message: answer.message,
            ...(previous === undefined ? {} : { previous }),
          },
        })
      }
    } catch (error) {
      if (this.disposed || generation !== this.balanceGeneration) return
      this.setState({
        ...this.state,
        balance: {
          status: 'error',
          message: error instanceof Error ? error.message : 'tokenUsage balance refresh failed',
          ...(previous === undefined ? {} : { previous }),
        },
      })
    }
  }
}

/** Minimal observable for the overlay open/close state. */
export class OverlayToggle {
  private open = false
  private readonly listeners = new Set<() => void>()

  isOpen(): boolean {
    return this.open
  }

  setOpen(open: boolean): void {
    if (this.open === open) return
    this.open = open
    for (const listener of this.listeners) listener()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}

/**
 * Late-bindable controller slot. The remote resolves asynchronously; views
 * subscribe to the binding so a controller arriving after first paint (or
 * never) re-renders them exactly once.
 */
export class ControllerBinding {
  private controller: TokenUsageController | undefined
  private readonly listeners = new Set<() => void>()

  attach(controller: TokenUsageController): void {
    this.controller = controller
    for (const listener of this.listeners) listener()
  }

  getSnapshot(): TokenUsageController | undefined {
    return this.controller
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}
