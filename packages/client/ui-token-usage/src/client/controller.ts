/**
 * Token usage controller: one snapshot store over the tokenUsage Remote.
 *
 * Read-mostly: `refresh()` pulls `snapshot()`; `refreshBalance()` issues the
 * server-authored action. Failures surface as honest error states — never
 * retried automatically, never replaced with guesses.
 *
 * @module @yeisme/dsh-client-ui-token-usage/client/controller
 */

import type { TokenBalanceSnapshotV1, TokenUsageRemoteFace, TokenUsageSnapshotV1 } from '../wire.ts'

export type TokenUsageControllerState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly usage: TokenUsageSnapshotV1; readonly balance: TokenBalanceSnapshotV1 }
  | { readonly status: 'unavailable'; readonly message: string }

const IDLE: TokenUsageControllerState = Object.freeze({ status: 'idle' })
const LOADING: TokenUsageControllerState = Object.freeze({ status: 'loading' })

export class TokenUsageController {
  private readonly remote: TokenUsageRemoteFace
  private state: TokenUsageControllerState = IDLE
  private readonly listeners = new Set<() => void>()
  private refreshGeneration = 0

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

  async refresh(): Promise<void> {
    const generation = ++this.refreshGeneration
    if (this.state.status !== 'ready') this.setState(LOADING)
    try {
      const answer = await this.remote.snapshot()
      if (generation !== this.refreshGeneration) return
      if (answer.ok) {
        this.setState({ status: 'ready', usage: answer.usage, balance: answer.balance })
      } else {
        this.setState({ status: 'unavailable', message: answer.message })
      }
    } catch (error) {
      if (generation !== this.refreshGeneration) return
      this.setState({ status: 'unavailable', message: error instanceof Error ? error.message : 'tokenUsage remote failed' })
    }
  }

  /** Server-authored balance refresh; keeps the previous usage projection. */
  async refreshBalance(): Promise<void> {
    const current = this.state
    try {
      const answer = await this.remote.refreshBalance()
      if (answer.ok && current.status === 'ready') {
        this.setState({ status: 'ready', usage: current.usage, balance: answer.balance })
      }
    } catch {
      // Balance failures keep the current projection; the panel already
      // renders the honest degrade text from the balance snapshot itself.
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
