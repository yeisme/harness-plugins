/**
 * Shared per-session status binding.
 *
 * Capsule, popover, and pane bound to the same sessionRef share one
 * refcounted binding. Lifecycle contract (design §5):
 *
 * - First subscribe to version notifications, then read the revisioned
 *   snapshot; if an update arrived during the read, re-read once (no
 *   startup gap).
 * - Change notifications coalesce to at most one re-read per `coalesceMs`;
 *   the binding only ever re-reads the authoritative read-only snapshot —
 *   no command replays, no model calls, no automatic retry.
 * - A generation counter discards late replies after an explicit target
 *   switch, close, or permission revocation.
 * - Source replacement (reconnect/HMR/provider swap) releases the old
 *   subscription before binding the new source, then re-reads once.
 * - Data-error retry is explicit (`refresh()`); the last value is kept and
 *   marked stale. Without a subscription seam the binding reports
 *   `subscription: false` — manual refresh only.
 *
 * @module @yeisme/dsh-client-ui-session-status/binding
 */

import {
  parseSessionStatusSnapshot,
  type SessionStatusSnapshotAnswerV1,
  type SessionStatusSnapshotV1,
} from './wire.ts'

export interface SessionStatusSource {
  snapshot(input: { readonly sessionRef: string }): Promise<SessionStatusSnapshotAnswerV1>
  /** Optional version-notification seam; absent → manual refresh only. */
  subscribeVersion?(sessionRef: string, listener: () => void): () => void
}

export type SessionStatusBindingStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface SessionStatusBindingState {
  readonly status: SessionStatusBindingStatus
  /** Last safe snapshot; kept across refreshes and failures (see `stale`). */
  readonly snapshot?: SessionStatusSnapshotV1
  /** True when `snapshot` is not known-current (refresh in flight or failed). */
  readonly stale: boolean
  /** Readable reason for `error`. */
  readonly message?: string
  /** Live version feed present; false → manual refresh only. */
  readonly subscription: boolean
}

export interface SessionStatusBindingOptions {
  /** Change-notification coalescing window; defaults to 250ms. */
  readonly coalesceMs?: number
}

const IDLE_STATE: SessionStatusBindingState = Object.freeze({
  status: 'idle',
  stale: false,
  subscription: false,
})

export class SessionStatusBinding {
  readonly sessionRef: string
  private source: SessionStatusSource
  private readonly coalesceMs: number
  private state: SessionStatusBindingState = IDLE_STATE
  private readonly listeners = new Set<() => void>()
  private generation = 0
  private consumers = 0
  private disposed = false
  private unsubscribeFeed: (() => void) | undefined
  private feedDirty = false
  private readInFlight = false
  private queuedRead = false
  private lastReadStartedAt = 0
  private coalesceTimer: ReturnType<typeof setTimeout> | undefined
  private onEmpty: (() => void) | undefined

  constructor(sessionRef: string, source: SessionStatusSource, options: SessionStatusBindingOptions = {}) {
    this.sessionRef = sessionRef
    this.source = source
    this.coalesceMs = options.coalesceMs ?? 250
  }

  getSnapshot(): SessionStatusBindingState {
    return this.state
  }

  get consumerCount(): number {
    return this.consumers
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private setState(next: SessionStatusBindingState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }

  /** Registry hook: fires when the last consumer released. */
  setOnEmpty(hook: (() => void) | undefined): void {
    this.onEmpty = hook
  }

  /**
   * Acquire a consumer. The first consumer subscribes to the version feed
   * first and then starts the authoritative read (subscribe-before-read).
   */
  acquire(): void {
    if (this.disposed) return
    this.consumers += 1
    if (this.consumers === 1) this.start()
  }

  /** Release a consumer; the last release cancels reads and the feed. */
  release(): void {
    if (this.disposed || this.consumers === 0) return
    this.consumers -= 1
    if (this.consumers === 0) {
      this.stopFeed()
      this.generation += 1 // discard any late reply after close
      this.onEmpty?.()
    }
  }

  private start(): void {
    this.generation += 1
    this.feedDirty = false
    this.subscribeFeed()
    void this.read()
  }

  private subscribeFeed(): void {
    this.stopFeed()
    const subscribeVersion = this.source.subscribeVersion
    if (typeof subscribeVersion !== 'function') {
      this.setState({ ...this.state, subscription: false })
      return
    }
    this.unsubscribeFeed = subscribeVersion.call(this.source, this.sessionRef, () => {
      this.notifyRevision()
    })
    this.setState({ ...this.state, subscription: true })
  }

  private stopFeed(): void {
    const unsubscribe = this.unsubscribeFeed
    this.unsubscribeFeed = undefined
    if (unsubscribe !== undefined) {
      try { unsubscribe() } catch { /* feed teardown is best-effort */ }
    }
    if (this.coalesceTimer !== undefined) {
      clearTimeout(this.coalesceTimer)
      this.coalesceTimer = undefined
    }
  }

  /**
   * Version notification from the feed. Coalesced to at most one re-read per
   * `coalesceMs`; a notification during a read marks the read dirty so the
   * snapshot is re-read after it settles (no startup gap).
   */
  notifyRevision(): void {
    if (this.disposed || this.consumers === 0) return
    this.feedDirty = true
    if (this.readInFlight) {
      this.queuedRead = true
      return
    }
    const elapsed = Date.now() - this.lastReadStartedAt
    if (elapsed >= this.coalesceMs) {
      this.feedDirty = false
      void this.read()
      return
    }
    if (this.coalesceTimer !== undefined) return
    this.coalesceTimer = setTimeout(() => {
      this.coalesceTimer = undefined
      if (!this.feedDirty || this.disposed || this.consumers === 0) return
      this.feedDirty = false
      void this.read()
    }, this.coalesceMs - elapsed)
  }

  /** Explicit re-read (user retry / manual refresh). */
  refresh(): Promise<void> {
    return this.read()
  }

  /**
   * Transport recovery: re-read the authoritative read-only snapshot only.
   * Never replays commands or model actions.
   */
  reconnect(): Promise<void> {
    return this.read()
  }

  /**
   * Source replacement (HMR / provider swap / reconnect with a new remote):
   * release the old subscription before binding the new source, then re-read.
   */
  attachSource(source: SessionStatusSource): void {
    if (this.disposed) return
    this.source = source
    this.generation += 1
    if (this.consumers > 0) {
      this.subscribeFeed()
      void this.read()
    }
  }

  private async read(): Promise<void> {
    if (this.disposed || this.consumers === 0) return
    const generation = ++this.generation
    this.readInFlight = true
    this.lastReadStartedAt = Date.now()
    const previous = this.state.snapshot
    this.setState({
      status: 'loading',
      stale: previous !== undefined,
      subscription: this.state.subscription,
      ...(previous === undefined ? {} : { snapshot: previous }),
    })
    try {
      const answer = await this.source.snapshot({ sessionRef: this.sessionRef })
      if (this.disposed || generation !== this.generation) return // late reply discarded
      if (answer.ok) {
        const parsed = parseSessionStatusSnapshot(answer.snapshot)
        if (parsed === null) {
          this.setState({
            status: 'error',
            message: 'snapshot failed validation',
            stale: previous !== undefined,
            subscription: this.state.subscription,
            ...(previous === undefined ? {} : { snapshot: previous }),
          })
          return
        }
        // An update arrived during the read: re-read once instead of
        // publishing a snapshot that is already behind.
        if (this.queuedRead) {
          this.queuedRead = false
          this.readInFlight = false
          return this.read()
        }
        this.setState({
          status: 'ready',
          snapshot: parsed,
          stale: false,
          subscription: this.state.subscription,
        })
      } else {
        this.setState({
          status: 'error',
          message: answer.message,
          stale: previous !== undefined,
          subscription: this.state.subscription,
          ...(previous === undefined ? {} : { snapshot: previous }),
        })
      }
    } catch (error) {
      if (this.disposed || generation !== this.generation) return
      this.setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'sessionStatus remote failed',
        stale: previous !== undefined,
        subscription: this.state.subscription,
        ...(previous === undefined ? {} : { snapshot: previous }),
      })
    } finally {
      if (generation === this.generation) this.readInFlight = false
    }
  }

  /** Full teardown: cancel in-flight reads, release the feed, drop listeners. */
  dispose(): void {
    this.disposed = true
    this.generation += 1
    this.consumers = 0
    this.stopFeed()
    this.listeners.clear()
  }
}

/**
 * Refcounted registry: surfaces on the same sessionRef share one binding;
 * the binding is disposed when its last consumer unmounts.
 */
export class SessionStatusBindingRegistry {
  private readonly bindings = new Map<string, SessionStatusBinding>()
  private readonly options: SessionStatusBindingOptions

  constructor(options: SessionStatusBindingOptions = {}) {
    this.options = options
  }

  /** Shared binding for a session; pairs with `release(binding)`. */
  acquire(sessionRef: string, source: SessionStatusSource): SessionStatusBinding {
    let binding = this.bindings.get(sessionRef)
    if (binding === undefined) {
      const created = new SessionStatusBinding(sessionRef, source, this.options)
      created.setOnEmpty(() => {
        if (created.consumerCount !== 0) return
        created.dispose()
        if (this.bindings.get(sessionRef) === created) this.bindings.delete(sessionRef)
      })
      this.bindings.set(sessionRef, created)
      binding = created
    }
    binding.acquire()
    return binding
  }

  release(binding: SessionStatusBinding): void {
    binding.release()
  }

  /** HMR / provider replacement: re-source every live binding. */
  attachSource(source: SessionStatusSource): void {
    for (const binding of this.bindings.values()) binding.attachSource(source)
  }

  get size(): number {
    return this.bindings.size
  }

  dispose(): void {
    for (const binding of this.bindings.values()) binding.dispose()
    this.bindings.clear()
  }
}
