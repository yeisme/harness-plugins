/**
 * Bounded dedup stores for handoff nonces and artifact-intent idempotency
 * keys. Session-scoped, insertion-ordered, with an expiry sweep so a
 * consumed nonce never replays inside the session and the store never
 * grows without bound.
 *
 * The client never auto-retries, so it never replays a nonce itself; after a
 * restart the handoff expiry window is the residual line of defense (the
 * host signer remains the nonce authority).
 */

export type DedupCheck = 'new' | 'replay'

export interface BoundedDedupStore {
  /** Reports whether a key was already consumed. Does not mutate. */
  check(key: string): DedupCheck
  /** Consumes a key. Returns 'replay' without mutating when already consumed. */
  mark(key: string, expiresAt?: number): DedupCheck
  /** Drops keys whose expiry passed; also runs implicitly on `mark`. */
  sweep(): void
  readonly size: number
}

export interface BoundedDedupStoreOptions {
  readonly capacity?: number
  readonly now?: () => number
}

export const DRAMA_NONCE_STORE_CAPACITY = 256

export function createBoundedDedupStore(options: BoundedDedupStoreOptions = {}): BoundedDedupStore {
  const capacity = Math.max(1, Math.trunc(options.capacity ?? DRAMA_NONCE_STORE_CAPACITY))
  const now = options.now ?? Date.now
  const entries = new Map<string, number | undefined>()

  const sweep = (): void => {
    const at = now()
    for (const [key, expiresAt] of entries) {
      if (expiresAt !== undefined && expiresAt <= at) entries.delete(key)
    }
  }

  return {
    check(key) {
      return entries.has(key) ? 'replay' : 'new'
    },
    mark(key, expiresAt) {
      sweep()
      if (entries.has(key)) return 'replay'
      entries.set(key, expiresAt)
      while (entries.size > capacity) {
        const oldest = entries.keys().next()
        if (oldest.done) break
        entries.delete(oldest.value)
      }
      return 'new'
    },
    sweep,
    get size() {
      return entries.size
    },
  }
}

/** Nonce replay store for the Workbench handoff consumption gate. */
export function createDramaNonceStore(options: BoundedDedupStoreOptions = {}): BoundedDedupStore {
  return createBoundedDedupStore(options)
}
