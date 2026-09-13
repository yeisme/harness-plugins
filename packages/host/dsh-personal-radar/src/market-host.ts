import { readConnectedMarketBrief, readConnectedMarketCatchup, type ConnectedMarketTransport, type MarketCatchupReadResult } from './market-adapter.js'
import type { MarketLoader } from './market-controller.js'
import { isSafeRadarRef } from './contracts.js'
import { readConnectedMarketSignal, readConnectedMarketCompare, type MarketSignalReadResult, type MarketCompareReadResult } from './market-adapter.js'
import { createMarketActionStore, type MarketActionReceiptV1, type MarketMutationIntentV1, type MarketMutationTransport } from './market-actions.js'
import { probeMarketCapability, MARKET_OPTIONAL_VIEWS, MARKET_REQUIRED_VIEWS, type MarketCapabilityProbeResultV1, type MarketViewName } from './market-probe.js'

const emptyMarketViews = (): Record<MarketViewName, boolean> => {
  const views = { market_capabilities: false } as Record<MarketViewName, boolean>
  for (const view of [...MARKET_REQUIRED_VIEWS, ...MARKET_OPTIONAL_VIEWS]) views[view] = false
  return views
}

export interface RadarMarketHostFace {
  readonly schema: 'dsh.radar.market-host.v1'
  contextRef(): string | null
  load: MarketLoader
  loadCatchup?(contextRef: string, cursor: string | null, signal: AbortSignal): Promise<MarketCatchupReadResult>
  loadSignal?(contextRef: string, selection: { signalRef: string; revision: number }, signal: AbortSignal): Promise<MarketSignalReadResult>
  loadCompare?(contextRef: string, left: { signalRef: string; revision: number }, right: { signalRef: string; revision: number }, signal: AbortSignal): Promise<MarketCompareReadResult>
  /** Explicit typed mutation through the current connection; absent seam stays disabled. */
  mutate?(contextRef: string, intent: MarketMutationIntentV1, signal: AbortSignal): Promise<MarketMutationDispatchResult>
  lookupMutationReceipt?(contextRef: string, idempotencyKey: string, signal: AbortSignal): Promise<MarketActionReceiptV1 | null>
  /** True only when the CURRENT connection exposes the mutation seam. */
  mutationsAvailable?(): boolean
  /** One-shot capability probe through the current connection (bounded 5s). */
  probeCapability?(signal?: AbortSignal): Promise<MarketCapabilityProbeResultV1>
  subscribeContext(listener: (ref: string | null) => void): () => void
  subscribePolicy(listener: () => void): () => void
  locale?: 'zh' | 'en' | 'pseudo'
}
export type MarketMutationDispatchResult =
  | { ok: true; receipt: MarketActionReceiptV1 }
  | { ok: false; reason: 'cancelled' | 'capability_unavailable'; recovery: string }
export interface MarketConnectionContext {
  /** Opaque identity must change on connection or conversation switches. */
  ref: string
  connection: ConnectedMarketTransport
  /** Owner mutation seam; read-only connections leave it absent. */
  mutations?: MarketMutationTransport
}
export interface MarketContextSource {
  current(): MarketConnectionContext | null
  subscribeContext(listener: (ref: string | null) => void): () => void
  subscribePolicy(listener: () => void): () => void
}

/** Host composition seam: consume an existing scoped connection, never create one. */
export function createConnectedRadarMarketHost(source: MarketContextSource, locale: 'zh' | 'en' | 'pseudo' = 'zh'): RadarMarketHostFace {
  const current = () => {
    const context = source.current()
    if (context && (!isSafeRadarRef(context.ref) || typeof context.connection?.readResource !== 'function')) throw new Error('market_context_invalid')
    return context
  }
  // One persistent store per composed face: the idempotency ledger survives
  // reads and context switches, while the delegating transport always talks
  // to the CURRENT connection's seam. Absent seam => typed refusal below.
  const delegatingTransport: MarketMutationTransport = {
    async apply(input, options) {
      const mutations = current()?.mutations
      if (mutations === undefined) throw new Error('market_mutation_seam_unavailable')
      return mutations.apply(input, options)
    },
    async lookupReceipt(idempotencyKey, options) {
      const mutations = current()?.mutations
      if (mutations === undefined) throw new Error('market_mutation_seam_unavailable')
      return mutations.lookupReceipt(idempotencyKey, options)
    },
  }
  const store = createMarketActionStore(delegatingTransport)
  const noteRevision = (result: { ok: boolean; reader?: { revision: number } | undefined } | { ok: true; reader: { revision: number } }) => {
    if (result.ok && Number.isSafeInteger(result.reader?.revision)) store.noteReaderRevision(result.reader!.revision)
  }
  const sameContext = (before: MarketConnectionContext, signal: AbortSignal) => {
    const after = current()
    return !signal.aborted && after !== null && after.ref === before.ref && after.connection === before.connection
  }
  return {
    schema: 'dsh.radar.market-host.v1', locale,
    contextRef: () => current()?.ref ?? null,
    subscribeContext: listener => source.subscribeContext(listener),
    subscribePolicy: listener => source.subscribePolicy(listener),
    mutationsAvailable: () => {
      const context = current()
      return context?.mutations !== undefined && typeof context.mutations.apply === 'function' && typeof context.mutations.lookupReceipt === 'function'
    },
    async probeCapability(signal) {
      const context = current()
      if (context === null) return { schema: 'dsh.radar.market-capability-probe.v1', status: 'unavailable', reason: 'market_capability_unavailable: no active Radar connection; the market face stays disabled', views: emptyMarketViews() }
      // Bounded: a hanging owner read must not block view registration.
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<MarketCapabilityProbeResultV1>(resolve => {
        timer = setTimeout(() => resolve({ schema: 'dsh.radar.market-capability-probe.v1', status: 'unavailable',
          reason: 'market_capability_unavailable: the Radar owner did not answer the capability probe; no market data is assumed', views: emptyMarketViews() }), 5000)
      })
      const probe = (async () => {
        const result = await probeMarketCapability(context.connection, signal)
        if (current()?.connection !== context.connection) {
          return { schema: 'dsh.radar.market-capability-probe.v1' as const, status: 'unavailable' as const,
            reason: 'market_capability_unavailable: the Radar connection changed during the probe; retry in the active context', views: emptyMarketViews() }
        }
        return result
      })()
      try { return await Promise.race([probe, timeout]) } finally { if (timer !== undefined) clearTimeout(timer) }
    },
    async mutate(contextRef, intent, signal) {
      const before = current()
      if (!before || before.ref !== contextRef || signal.aborted) return {
        ok: false, reason: 'cancelled', recovery: 'Mutate only in the active Radar connection and conversation context.',
      }
      if (before.mutations === undefined) return {
        ok: false, reason: 'capability_unavailable', recovery: 'The connected Radar owner does not expose the market mutation seam.',
      }
      const outcome = await store.dispatch(intent, signal)
      if (!sameContext(before, signal)) return {
        ok: false, reason: 'cancelled', recovery: 'The Radar context changed; reconcile this action by its original key.',
      }
      return { ok: true, receipt: outcome.receipt }
    },
    async lookupMutationReceipt(contextRef, idempotencyKey, signal) {
      const before = current()
      if (!before || before.ref !== contextRef || signal.aborted || before.mutations === undefined) return null
      const receipt = await store.reconcile(idempotencyKey, signal)
      if (!sameContext(before, signal) || receipt === null) return null
      return receipt
    },
    async loadSignal(contextRef, selection, signal) {
      const before = current()
      if (!before || before.ref !== contextRef || signal.aborted) return {
        ok: false, reason: 'cancelled', recovery: 'Select the active Radar context before reading details.',
      }
      const result = await readConnectedMarketSignal(before.connection, selection, 5000, signal)
      if (!sameContext(before, signal)) return {
        ok: false, reason: 'cancelled', recovery: 'The Radar context changed; discard the earlier detail.',
      }
      noteRevision(result)
      return result
    },
    async loadCompare(contextRef, left, right, signal) {
      const before = current()
      if (!before || before.ref !== contextRef || signal.aborted) return { ok: false, reason: 'cancelled', recovery: 'Select the active Radar context before comparing.' }
      const result = await readConnectedMarketCompare(before.connection, left, right, 5000, signal)
      if (!sameContext(before, signal)) return { ok: false, reason: 'cancelled', recovery: 'The Radar context changed; discard the earlier comparison.' }
      noteRevision(result)
      return result
    },
    async loadCatchup(contextRef, cursor, signal) {
      const before = current()
      if (!before || before.ref !== contextRef || signal.aborted) return {
        ok: false, reason: 'cancelled', recovery: 'Select the active Radar context before reading catch-up.',
      }
      const result = await readConnectedMarketCatchup(before.connection, cursor, 5000, signal)
      if (!sameContext(before, signal)) return {
        ok: false, reason: 'cancelled', recovery: 'The Radar context changed; discard the earlier page.',
      }
      noteRevision(result)
      return result
    },
    async load(contextRef, signal) {
      const before = current()
      if (!before || before.ref !== contextRef || signal.aborted) return {
        ok: false, reason: 'cancelled', recovery: 'Select the active Radar connection and conversation before reading.',
      }
      const result = await readConnectedMarketBrief(before.connection, 5000, signal)
      if (!sameContext(before, signal)) return {
        ok: false, reason: 'cancelled', recovery: 'The Radar context changed; discard the earlier response.',
      }
      noteRevision(result)
      return result
    },
  }
}
