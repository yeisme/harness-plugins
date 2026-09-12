import { readConnectedMarketBrief, readConnectedMarketCatchup, type ConnectedMarketTransport, type MarketCatchupReadResult } from './market-adapter.js'
import type { MarketLoader } from './market-controller.js'
import { isSafeRadarRef } from './contracts.js'
import { readConnectedMarketSignal, readConnectedMarketCompare, type MarketSignalReadResult, type MarketCompareReadResult } from './market-adapter.js'

export interface RadarMarketHostFace {
  readonly schema: 'dsh.radar.market-host.v1'
  contextRef(): string | null
  load: MarketLoader
  loadCatchup?(contextRef: string, cursor: string | null, signal: AbortSignal): Promise<MarketCatchupReadResult>
  loadSignal?(contextRef: string, selection: { signalRef: string; revision: number }, signal: AbortSignal): Promise<MarketSignalReadResult>
  loadCompare?(contextRef: string, left: { signalRef: string; revision: number }, right: { signalRef: string; revision: number }, signal: AbortSignal): Promise<MarketCompareReadResult>
  subscribeContext(listener: (ref: string | null) => void): () => void
  subscribePolicy(listener: () => void): () => void
  locale?: 'zh' | 'en' | 'pseudo'
}
export interface MarketConnectionContext {
  /** Opaque identity must change on connection or conversation switches. */
  ref: string
  connection: ConnectedMarketTransport
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
  return {
    schema: 'dsh.radar.market-host.v1', locale,
    contextRef: () => current()?.ref ?? null,
    subscribeContext: listener => source.subscribeContext(listener),
    subscribePolicy: listener => source.subscribePolicy(listener),
    async loadSignal(contextRef, selection, signal) {
      const before = current()
      if (!before || before.ref !== contextRef || signal.aborted) return {
        ok: false, reason: 'cancelled', recovery: 'Select the active Radar context before reading details.',
      }
      const result = await readConnectedMarketSignal(before.connection, selection, 5000, signal)
      const after = current()
      if (signal.aborted || !after || after.ref !== before.ref || after.connection !== before.connection) return {
        ok: false, reason: 'cancelled', recovery: 'The Radar context changed; discard the earlier detail.',
      }
      return result
    },
    async loadCompare(contextRef, left, right, signal) {
      const before = current()
      if (!before || before.ref !== contextRef || signal.aborted) return { ok: false, reason: 'cancelled', recovery: 'Select the active Radar context before comparing.' }
      const result = await readConnectedMarketCompare(before.connection, left, right, 5000, signal)
      const after = current()
      if (signal.aborted || !after || after.ref !== before.ref || after.connection !== before.connection) return { ok: false, reason: 'cancelled', recovery: 'The Radar context changed; discard the earlier comparison.' }
      return result
    },
    async loadCatchup(contextRef, cursor, signal) {
      const before = current()
      if (!before || before.ref !== contextRef || signal.aborted) return {
        ok: false, reason: 'cancelled', recovery: 'Select the active Radar context before reading catch-up.',
      }
      const result = await readConnectedMarketCatchup(before.connection, cursor, 5000, signal)
      const after = current()
      if (signal.aborted || !after || after.ref !== before.ref || after.connection !== before.connection) return {
        ok: false, reason: 'cancelled', recovery: 'The Radar context changed; discard the earlier page.',
      }
      return result
    },
    async load(contextRef, signal) {
      const before = current()
      if (!before || before.ref !== contextRef || signal.aborted) return {
        ok: false, reason: 'cancelled', recovery: 'Select the active Radar connection and conversation before reading.',
      }
      const result = await readConnectedMarketBrief(before.connection, 5000, signal)
      const after = current()
      if (signal.aborted || !after || after.ref !== before.ref || after.connection !== before.connection) return {
        ok: false, reason: 'cancelled', recovery: 'The Radar context changed; discard the earlier response.',
      }
      return result
    },
  }
}
