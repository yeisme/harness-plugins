/**
 * Shared per-target session-insights binding.
 *
 * One binding per (sessionRef + query scope + identity scope); every surface
 * on the same target shares it through a refcounted registry. Lifecycle
 * contract (design §5):
 *
 * - First subscribe to version notifications, then read the revisioned
 *   snapshot; if an update arrived during the read, re-read once more (no
 *   startup gap).
 * - Change notifications coalesce to at most one re-read per `coalesceMs`;
 *   the binding never issues model calls, balance queries, or command
 *   replays — only the authoritative read-only snapshot.
 * - A generation counter per query discards late replies after an explicit
 *   target switch, close, or permission revocation (A's late reply must not
 *   overwrite B).
 * - Source replacement (reconnect/HMR/provider swap) releases the old
 *   subscription before binding the new source, then re-reads once.
 * - Data-error retry is explicit (`refresh()`); the old value is kept and
 *   marked stale. `stale_cursor` keeps the current pages and asks for an
 *   explicit first-page re-read.
 * - Without a version-notification seam (`subscribeVersion` absent) the
 *   binding reports `subscription: false`: manual refresh only.
 *
 * @module @yeisme/dsh-client-ui-token-usage/client/insights-binding
 */

import type {
  SessionInsightsQueryInputV1,
  SessionInsightsQueryResultV1,
  SessionInsightsScope,
  SessionInsightsSnapshotV1,
} from '../wire.ts'

/** Query identity: target object + scope + the scope's identity fields. */
export interface SessionInsightsTarget {
  readonly sessionRef: string
  readonly scope: SessionInsightsScope
  readonly runRef?: string
  readonly from?: string
  readonly to?: string
  readonly timeZone?: string
  readonly includeDescendants?: boolean
}

export function sessionInsightsTargetKey(target: SessionInsightsTarget): string {
  return [
    target.sessionRef,
    target.scope,
    target.runRef ?? '',
    target.from ?? '',
    target.to ?? '',
    target.timeZone ?? '',
    target.includeDescendants === true ? '1' : '0',
  ].join('|')
}

export interface SessionInsightsSource {
  query(input: SessionInsightsQueryInputV1): Promise<SessionInsightsQueryResultV1>
  /** Optional version-notification seam; absent → manual refresh only. */
  subscribeVersion?(sessionRef: string, listener: () => void): () => void
}

export type SessionInsightsBindingStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface SessionInsightsBindingState {
  readonly status: SessionInsightsBindingStatus
  /** Last safe snapshot; kept across refreshes and failures (see `stale`). */
  readonly snapshot?: SessionInsightsSnapshotV1
  /** True when `snapshot` is not known-current (refresh in flight or failed). */
  readonly stale: boolean
  /** Readable reason for `error`; also set when the page cursor went stale. */
  readonly message?: string
  /** Live version feed present; false → manual refresh only, never promised otherwise. */
  readonly subscription: boolean
  /** The paginated cursor was invalidated; an explicit first-page re-read is required. */
  readonly staleCursor: boolean
  /** A `loadMore()` page read is in flight. */
  readonly loadingMore: boolean
}

export interface SessionInsightsBindingOptions {
  /** Change-notification coalescing window; defaults to 250ms. */
  readonly coalesceMs?: number
}

const IDLE_STATE: SessionInsightsBindingState = Object.freeze({
  status: 'idle',
  stale: false,
  subscription: false,
  staleCursor: false,
  loadingMore: false,
})

export class SessionInsightsBinding {
  readonly target: SessionInsightsTarget
  private source: SessionInsightsSource
  private readonly coalesceMs: number
  private state: SessionInsightsBindingState = IDLE_STATE
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

  constructor(target: SessionInsightsTarget, source: SessionInsightsSource, options: SessionInsightsBindingOptions = {}) {
    this.target = target
    this.source = source
    this.coalesceMs = options.coalesceMs ?? 250
  }

  getSnapshot(): SessionInsightsBindingState {
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

  private setState(next: SessionInsightsBindingState): void {
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
    this.unsubscribeFeed = subscribeVersion.call(this.source, this.target.sessionRef, () => {
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

  /** Explicit re-read of the first page (user retry / manual refresh). */
  refresh(): Promise<void> {
    return this.read()
  }

  /**
   * Transport recovery: re-read the authoritative read-only snapshot only.
   * Never replays commands, balance queries, or model actions.
   */
  reconnect(): Promise<void> {
    return this.read()
  }

  /**
   * Source replacement (HMR / provider swap / reconnect with a new remote):
   * release the old subscription before binding the new source, then re-read.
   */
  attachSource(source: SessionInsightsSource): void {
    if (this.disposed) return
    this.source = source
    this.generation += 1
    if (this.consumers > 0) {
      this.subscribeFeed()
      void this.read()
    }
  }

  private queryInput(): SessionInsightsQueryInputV1 {
    const target = this.target
    return {
      sessionRef: target.sessionRef,
      scope: target.scope,
      ...(target.runRef === undefined ? {} : { runRef: target.runRef }),
      ...(target.from === undefined ? {} : { from: target.from }),
      ...(target.to === undefined ? {} : { to: target.to }),
      ...(target.timeZone === undefined ? {} : { timeZone: target.timeZone }),
      ...(target.includeDescendants === undefined ? {} : { includeDescendants: target.includeDescendants }),
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
      staleCursor: false,
      loadingMore: false,
      ...(previous === undefined ? {} : { snapshot: previous }),
    })
    try {
      const answer = await this.source.query(this.queryInput())
      if (this.disposed || generation !== this.generation) return // late reply discarded
      if (answer.ok) {
        // An update arrived during the read: re-read once instead of
        // publishing a snapshot that is already behind.
        if (this.queuedRead) {
          this.queuedRead = false
          this.readInFlight = false
          return this.read()
        }
        this.setState({
          status: 'ready',
          snapshot: answer.snapshot,
          stale: false,
          subscription: this.state.subscription,
          staleCursor: false,
          loadingMore: false,
        })
      } else {
        this.setState({
          status: 'error',
          message: answer.message,
          stale: previous !== undefined,
          subscription: this.state.subscription,
          staleCursor: answer.code === 'stale_cursor',
          loadingMore: false,
          ...(previous === undefined ? {} : { snapshot: previous }),
        })
      }
    } catch (error) {
      if (this.disposed || generation !== this.generation) return
      this.setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'tokenUsage query failed',
        stale: previous !== undefined,
        subscription: this.state.subscription,
        staleCursor: false,
        loadingMore: false,
        ...(previous === undefined ? {} : { snapshot: previous }),
      })
    } finally {
      if (generation === this.generation) this.readInFlight = false
    }
  }

  /** Explicit next-page read; appends rows de-duplicated by attemptRef. */
  async loadMore(): Promise<void> {
    if (this.disposed || this.consumers === 0) return
    const current = this.state.snapshot
    if (current === undefined || current.nextCursor === undefined || this.state.loadingMore) return
    const generation = this.generation
    this.setState({ ...this.state, loadingMore: true })
    try {
      const answer = await this.source.query({ ...this.queryInput(), cursor: current.nextCursor })
      if (this.disposed || generation !== this.generation) return
      if (answer.ok) {
        const seen = new Set(current.requests.map(row => row.attemptRef))
        const merged = [
          ...current.requests,
          ...answer.snapshot.requests.filter(row => !seen.has(row.attemptRef)),
        ]
        this.setState({
          ...this.state,
          status: 'ready',
          stale: false,
          staleCursor: false,
          loadingMore: false,
          snapshot: {
            ...current,
            revision: answer.snapshot.revision,
            generatedAt: answer.snapshot.generatedAt,
            requests: merged,
            truncated: answer.snapshot.truncated,
            ...(answer.snapshot.nextCursor === undefined ? {} : { nextCursor: answer.snapshot.nextCursor }),
          },
        })
      } else if (answer.code === 'stale_cursor') {
        // Keep the current pages; the user re-reads the first page explicitly.
        this.setState({ ...this.state, loadingMore: false, staleCursor: true, message: answer.message })
      } else {
        this.setState({ ...this.state, loadingMore: false, message: answer.message })
      }
    } catch (error) {
      if (this.disposed || generation !== this.generation) return
      this.setState({
        ...this.state,
        loadingMore: false,
        message: error instanceof Error ? error.message : 'tokenUsage query failed',
      })
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
 * Refcounted registry: surfaces on the same target share one binding; the
 * binding is disposed when its last consumer unmounts.
 */
export class SessionInsightsBindingRegistry {
  private readonly bindings = new Map<string, SessionInsightsBinding>()
  private readonly options: SessionInsightsBindingOptions

  constructor(options: SessionInsightsBindingOptions = {}) {
    this.options = options
  }

  /** Shared binding for a target; pairs with `release(binding)`. */
  acquire(target: SessionInsightsTarget, source: SessionInsightsSource): SessionInsightsBinding {
    const key = sessionInsightsTargetKey(target)
    let binding = this.bindings.get(key)
    if (binding === undefined) {
      const created = new SessionInsightsBinding(target, source, this.options)
      created.setOnEmpty(() => {
        if (created.consumerCount !== 0) return
        created.dispose()
        if (this.bindings.get(key) === created) this.bindings.delete(key)
      })
      this.bindings.set(key, created)
      binding = created
    }
    binding.acquire()
    return binding
  }

  release(binding: SessionInsightsBinding): void {
    binding.release()
  }

  /** HMR / provider replacement: re-source every live binding. */
  attachSource(source: SessionInsightsSource): void {
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
