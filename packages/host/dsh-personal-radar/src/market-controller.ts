import type { MarketReadResult, MarketCatchupReadResult, MarketSignalReadResult, MarketCompareReadResult } from './market-adapter.js'
import { isSafeRadarRef } from './contracts.js'

export interface MarketReadingState<Result = MarketReadResult> {
  readonly contextRef: string | null
  readonly loading: boolean
  readonly result: Result | null
}
export type MarketLoader = (contextRef: string, signal: AbortSignal) => Promise<MarketReadResult>

/** Ephemeral display state only: no owner mutations, local persistence or automatic retries. */
export function createMarketReadingController(load: MarketLoader) {
  return createReadingController(load, () => ({ ok: false, reason: 'offline', recovery: 'Inspect the active Radar connection.' } as MarketReadResult))
}

function createReadingController<Result>(load: (contextRef: string, signal: AbortSignal) => Promise<Result>, failed: () => Result) {
  let state: MarketReadingState<Result> = { contextRef: null, loading: false, result: null }
  let generation = 0
  let disposed = false
  let active: AbortController | undefined
  const listeners = new Set<(state: MarketReadingState<Result>) => void>()
  const emit = () => {
    const version = generation
    for (const listener of [...listeners]) {
      if (disposed || generation !== version) break
      if (!listeners.has(listener)) continue
      // A broken view subscription must not abort state transitions or expose
      // arbitrary exception text; detach it and keep healthy views updated.
      try { listener(structuredClone(state)) } catch { listeners.delete(listener) }
    }
  }
  const invalidate = () => { generation++; active?.abort(); active = undefined }
  return {
    snapshot: (): MarketReadingState<Result> => structuredClone(state),
    subscribe(listener: (state: MarketReadingState<Result>) => void) {
      if (disposed) throw new Error('market_controller_disposed')
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    setContext(contextRef: string | null) {
      if (disposed) return
      if (contextRef !== null && !isSafeRadarRef(contextRef)) throw new Error('market_unsafe_ref')
      invalidate()
      state = { contextRef, loading: false, result: null }
      emit()
    },
    invalidatePolicy() {
      if (disposed) return
      invalidate()
      state = { ...state, loading: false, result: null }
      emit()
    },
    async refresh() {
      if (disposed || state.contextRef === null) return
      invalidate()
      const request = generation, contextRef = state.contextRef
      const controller = new AbortController()
      active = controller
      state = { contextRef, loading: true, result: null }
      emit()
      if (disposed || request !== generation || controller.signal.aborted) return
      let result: Result
      try { result = await load(contextRef, controller.signal) }
      catch { result = failed() }
      // Also guard transports that ignore AbortSignal and resolve after a switch.
      if (disposed || request !== generation || contextRef !== state.contextRef) return
      active = undefined
      state = { contextRef, loading: false, result: structuredClone(result) }
      emit()
    },
    dispose() {
      if (disposed) return
      invalidate()
      disposed = true
      state = { contextRef: null, loading: false, result: null }
      listeners.clear()
    },
  }
}

export type MarketCatchupLoader = (contextRef: string, cursor: string | null, signal: AbortSignal) => Promise<MarketCatchupReadResult>
export function createMarketCatchupController(load: MarketCatchupLoader) {
  let cursor: string | null = null
  const base = createReadingController((context, signal) => load(context, cursor, signal),
    () => ({ ok: false, reason: 'offline', recovery: 'Inspect the active Radar connection.' } as MarketCatchupReadResult))
  return {
    ...base,
    setContext(contextRef: string | null) { cursor = null; base.setContext(contextRef) },
    invalidatePolicy() { cursor = null; base.invalidatePolicy() },
    first() { cursor = null; return base.refresh() },
    async next() {
      const state = base.snapshot()
      if (state.loading || !state.result?.ok || state.result.page.nextCursor === null) return
      cursor = state.result.page.nextCursor
      await base.refresh()
    },
  }
}

export interface MarketSignalSelection { signalRef: string; revision: number }
export type MarketSignalLoader = (contextRef: string, selection: MarketSignalSelection, signal: AbortSignal) => Promise<MarketSignalReadResult>
export function createMarketDetailController(load: MarketSignalLoader) {
  let selection: MarketSignalSelection | null = null
  let disposed = false
  const base = createReadingController(async (context, signal): Promise<MarketSignalReadResult> => {
    if (!selection) return { ok: false, reason: 'cancelled', recovery: 'Select a stored signal revision.' }
    return load(context, { ...selection }, signal)
  }, () => ({ ok: false, reason: 'offline', recovery: 'Inspect the active Radar connection.' } as MarketSignalReadResult))
  return {
    ...base,
    selection: () => selection ? { ...selection } : null,
    setContext(contextRef: string | null) { selection = null; base.setContext(contextRef) },
    invalidatePolicy() { selection = null; base.invalidatePolicy() },
    async select(next: MarketSignalSelection) {
      if (disposed || base.snapshot().contextRef === null) return
      if (!isSafeRadarRef(next.signalRef) || !Number.isSafeInteger(next.revision) || next.revision < 1) throw new Error('market_selection_invalid')
      selection = { ...next }
      await base.refresh()
    },
    close() { selection = null; base.invalidatePolicy() },
    dispose() { disposed = true; selection = null; base.dispose() },
  }
}

export type MarketCompareLoader = (contextRef: string, left: MarketSignalSelection, right: MarketSignalSelection, signal: AbortSignal) => Promise<MarketCompareReadResult>
export function createMarketCompareController(load: MarketCompareLoader) {
  let selections: [MarketSignalSelection, MarketSignalSelection] | null = null
  let disposed = false
  const base = createReadingController(async (context, signal): Promise<MarketCompareReadResult> => {
    if (!selections) return { ok: false, reason: 'cancelled', recovery: 'Select two stored signal revisions.' }
    return load(context, { ...selections[0] }, { ...selections[1] }, signal)
  }, () => ({ ok: false, reason: 'offline', recovery: 'Inspect the active Radar connection.' } as MarketCompareReadResult))
  return { ...base,
    selections: () => selections ? [{ ...selections[0] }, { ...selections[1] }] as [MarketSignalSelection, MarketSignalSelection] : null,
    setContext(contextRef: string | null) { selections = null; base.setContext(contextRef) },
    invalidatePolicy() { selections = null; base.invalidatePolicy() },
    async select(left: MarketSignalSelection, right: MarketSignalSelection) {
      if (disposed || base.snapshot().contextRef === null || left.signalRef === right.signalRef && left.revision === right.revision) return
      if (![left, right].every(item => isSafeRadarRef(item.signalRef) && Number.isSafeInteger(item.revision) && item.revision > 0)) throw new Error('market_selection_invalid')
      selections = [{ ...left }, { ...right }]
      await base.refresh()
    },
    close() { selections = null; base.invalidatePolicy() },
    dispose() { disposed = true; selections = null; base.dispose() },
  }
}
