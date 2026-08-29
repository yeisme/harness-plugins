/**
 * Client-side DramaContextV1 resolution over the drama host transport.
 *
 * unknown/partial/stale states disable every mutation and require the owner
 * to reconcile; the client never auto-retries and never fabricates context.
 * Recovery emits a redacted `context_recovered` evidence event carrying only
 * the recovery duration.
 */

import {
  resolveCurrentDramaContext,
  shouldResyncContext,
  type DramaContextV1,
  type DramaFreshnessV1,
} from '@yeisme/dsh-ai-drama-director'
import type { DramaEvidenceEmitter } from './evidence.js'
import type { DramaHostTransport } from './probe.js'

export type DramaContextStatus =
  | 'unavailable'
  | 'ready'
  | 'partial'
  | DramaFreshnessV1

export interface DramaContextSnapshotV1 {
  readonly status: DramaContextStatus
  readonly context?: DramaContextV1
  readonly reason: string
  /** Mutations (generate/review/repair/handoff) only when the context is fresh. */
  readonly mutationsEnabled: boolean
  readonly mutationReason?: string
}

export interface DramaContextStore {
  getSnapshot(): DramaContextSnapshotV1
  /** Explicit owner round-trip. Returns the new snapshot; never auto-retried. */
  refresh(): Promise<DramaContextSnapshotV1>
  /** Re-resolve after a context switch; records recovery duration evidence. */
  reconcile(): Promise<DramaContextSnapshotV1>
  subscribe(listener: () => void): () => void
}

export interface DramaContextStoreOptions {
  readonly transport?: DramaHostTransport
  readonly emitter?: DramaEvidenceEmitter
  readonly now?: () => number
}

const UNAVAILABLE: DramaContextSnapshotV1 = {
  status: 'unavailable',
  reason: 'missing drama owner projection',
  mutationsEnabled: false,
  mutationReason: 'missing drama owner projection',
}

function toSnapshot(
  context: DramaContextV1 | undefined,
  reason: string,
): DramaContextSnapshotV1 {
  if (context === undefined) {
    // A contract-invalid owner snapshot is a partial projection: fail closed.
    return {
      status: 'partial',
      reason,
      mutationsEnabled: false,
      mutationReason: reason,
    }
  }
  if (context.freshness === 'fresh') {
    return { status: 'ready', context, reason, mutationsEnabled: true }
  }
  const mutationReason = `context freshness is ${context.freshness}; reconcile with the owner before mutating`
  return {
    status: context.freshness,
    context,
    reason,
    mutationsEnabled: false,
    mutationReason,
  }
}

export function createDramaContextStore(options: DramaContextStoreOptions): DramaContextStore {
  const now = options.now ?? Date.now
  const listeners = new Set<() => void>()
  let snapshot: DramaContextSnapshotV1 = options.transport === undefined
    ? UNAVAILABLE
    : {
      status: 'partial',
      reason: 'drama context has not been resolved yet',
      mutationsEnabled: false,
      mutationReason: 'drama context has not been resolved yet',
    }
  let degradedSince: number | undefined

  const emit = (): void => {
    for (const listener of listeners) listener()
  }

  const resolve = async (): Promise<DramaContextSnapshotV1> => {
    const transport = options.transport
    if (transport === undefined) {
      snapshot = UNAVAILABLE
      return snapshot
    }
    const previous = snapshot.context
    const resolved = await resolveCurrentDramaContext({
      snapshot: () => transport.snapshot(),
    })
    if (!resolved.ok || resolved.context === undefined) {
      snapshot = toSnapshot(undefined, resolved.reason)
      degradedSince ??= now()
      emit()
      return snapshot
    }
    const context: DramaContextV1 = resolved.context
    const recovered = context.freshness === 'fresh'
      && degradedSince !== undefined
      && (previous === undefined || shouldResyncContext(previous, context) || snapshot.status !== 'ready')
    snapshot = toSnapshot(context, resolved.reason)
    if (recovered) {
      options.emitter?.emit('context_recovered', { durationMs: Math.max(0, now() - (degradedSince ?? now())) })
      degradedSince = undefined
    } else if (context.freshness !== 'fresh') {
      degradedSince ??= now()
    }
    emit()
    return snapshot
  }

  return {
    getSnapshot() {
      return snapshot
    },
    refresh: resolve,
    reconcile: resolve,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
