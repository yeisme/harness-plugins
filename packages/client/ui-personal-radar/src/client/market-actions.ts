/**
 * Explicit market read/watch actions with honest pending states.
 *
 * The controller is a thin orchestrator: intents are typed
 * dsh.radar.market-mutation.v1 objects built by the host package, dispatched
 * through the host mutation seam, and settled only by owner receipts. It
 * never fabricates success (pending stays pending), never mixes market
 * watch/unwatch with the legacy personal save/dismiss feedback kinds, and
 * only ever submits the signal revisions the user actually sees.
 */

import {
  buildMarketMutationIntent,
  type MarketMutationKind,
  type MarketMutationSelection,
  type RadarMarketHostFace,
} from '@yeisme/dsh-personal-radar'

export type MarketActionState = 'pending' | 'accepted' | 'rejected' | 'conflict' | 'unknown' | 'reconciled'

export interface MarketActionEntry {
  readonly kind: MarketMutationKind
  readonly state: MarketActionState
  readonly reason: string
  readonly selections: readonly MarketMutationSelection[]
}

export interface MarketActionsState {
  readonly available: boolean
  readonly entries: Readonly<Record<string, MarketActionEntry>>
}

export interface MarketActionsController {
  snapshot(): MarketActionsState
  subscribe(listener: (state: MarketActionsState) => void): () => void
  /** Mark exactly the displayed items as read; paging pages submit separately. */
  markRead(displayed: readonly MarketMutationSelection[], context: { readerRevision: number; policyRevision: string }): Promise<void>
  undoRead(displayed: readonly MarketMutationSelection[], context: { readerRevision: number; policyRevision: string }): Promise<void>
  watch(selection: MarketMutationSelection, context: { readerRevision: number; policyRevision: string }): Promise<void>
  unwatch(selection: MarketMutationSelection, context: { readerRevision: number; policyRevision: string }): Promise<void>
  pauseWatch(selection: MarketMutationSelection, context: { readerRevision: number; policyRevision: string }): Promise<void>
  resumeWatch(selection: MarketMutationSelection, context: { readerRevision: number; policyRevision: string }): Promise<void>
  /** Reconcile one unknown outcome by its original key; never re-sends. */
  reconcile(idempotencyKey: string): Promise<void>
  dispose(): void
}

const MUTATION_SEAM_UNAVAILABLE: MarketActionsState = { available: false, entries: {} }

export function createMarketActionsController(host: RadarMarketHostFace, onAuthoritativeChange: () => void = () => {}): MarketActionsController {
  const canMutate = typeof host.mutate === 'function' && typeof host.lookupMutationReceipt === 'function' && (host.mutationsAvailable?.() ?? false)
  if (!canMutate) {
    return {
      snapshot: () => MUTATION_SEAM_UNAVAILABLE,
      subscribe: () => () => {},
      markRead: async () => {}, undoRead: async () => {}, watch: async () => {}, unwatch: async () => {},
      pauseWatch: async () => {}, resumeWatch: async () => {}, reconcile: async () => {}, dispose: () => {},
    }
  }
  const mutate = host.mutate!
  const lookup = host.lookupMutationReceipt!
  let state: MarketActionsState = { available: true, entries: {} }
  let disposed = false
  const listeners = new Set<(state: MarketActionsState) => void>()
  const emit = () => {
    for (const listener of [...listeners]) {
      try { listener(structuredClone(state)) } catch { listeners.delete(listener) }
    }
  }
  const guard = (displayed: readonly MarketMutationSelection[]) => {
    if (disposed) return 'disposed' as const
    if (!Array.isArray(displayed) || displayed.length < 1 || displayed.length > 100) return 'invalid' as const
    return null
  }
  const run = async (kind: MarketMutationKind, selections: readonly MarketMutationSelection[], context: { readerRevision: number; policyRevision: string }) => {
    if (disposed || host.mutationsAvailable?.() === false) return
    const intent = await buildMarketMutationIntent(kind, selections, context.readerRevision, context.policyRevision)
    const existing = state.entries[intent.idempotencyKey]
    // A double click reuses the same deterministic key: while pending the
    // second click is a no-op (no fake success, no second submit), and after
    // settlement the stored receipt is already authoritative.
    if (existing !== undefined && (existing.state === 'pending' || existing.state === 'accepted' || existing.state === 'reconciled')) return
    state = { ...state, entries: { ...state.entries, [intent.idempotencyKey]: { kind, state: 'pending', reason: 'submitted', selections: selections.map(item => ({ ...item })) } } }
    emit()
    const result = await mutate(host.contextRef() ?? '', intent, new AbortController().signal)
    if (disposed) return
    if (!result.ok) {
      // A context change or missing seam is honest, never a fake success.
      state = { ...state, entries: { ...state.entries, [intent.idempotencyKey]: { kind, state: result.reason === 'capability_unavailable' ? 'rejected' : 'unknown', reason: result.reason, selections: selections.map(item => ({ ...item })) } } }
      emit()
      return
    }
    const receipt = result.receipt
    state = { ...state, entries: { ...state.entries, [intent.idempotencyKey]: { kind, state: receipt.outcome === 'reconciled' ? 'reconciled' : receipt.outcome, reason: receipt.reason, selections: selections.map(item => ({ ...item })) } } }
    emit()
    if (receipt.outcome === 'accepted' || receipt.outcome === 'conflict') onAuthoritativeChange()
  }
  return {
    snapshot: () => structuredClone(state),
    subscribe(listener) {
      if (disposed) throw new Error('market_actions_disposed')
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    async markRead(displayed, context) { if (guard(displayed) === null) await run('mark_read', displayed, context) },
    async undoRead(displayed, context) { if (guard(displayed) === null) await run('undo_read', displayed, context) },
    async watch(selection, context) { if (guard([selection]) === null) await run('watch', [selection], context) },
    async unwatch(selection, context) { if (guard([selection]) === null) await run('unwatch', [selection], context) },
    async pauseWatch(selection, context) { if (guard([selection]) === null) await run('pause_watch', [selection], context) },
    async resumeWatch(selection, context) { if (guard([selection]) === null) await run('resume_watch', [selection], context) },
    async reconcile(idempotencyKey) {
      if (disposed || state.entries[idempotencyKey]?.state !== 'unknown') return
      const receipt = await lookup(host.contextRef() ?? '', idempotencyKey, new AbortController().signal)
      if (disposed || receipt === null) return
      const previous = state.entries[idempotencyKey]
      if (previous === undefined) return
      state = { ...state, entries: { ...state.entries, [idempotencyKey]: { ...previous, state: 'reconciled', reason: receipt.reason } } }
      emit()
      onAuthoritativeChange()
    },
    dispose() {
      if (disposed) return
      disposed = true
      listeners.clear()
      state = { available: false, entries: {} }
    },
  }
}
