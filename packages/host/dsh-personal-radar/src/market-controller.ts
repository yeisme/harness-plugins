import type { MarketReadResult, MarketCatchupReadResult, MarketSignalReadResult, MarketCompareReadResult, MarketEvidenceReadResult, MarketReviewIndexReadResult, MarketReviewReadResult } from './market-adapter.js'
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

export type MarketEvidenceLoader = (contextRef: string, selection: MarketSignalSelection, evidenceRef: string, signal: AbortSignal) => Promise<MarketEvidenceReadResult>
export interface MarketEvidenceTimelineEntry {
  readonly state: 'loading' | 'loaded' | 'failed'
  readonly result: MarketEvidenceReadResult | null
}
export interface MarketEvidenceTimelineState {
  readonly contextRef: string | null
  readonly selection: MarketSignalSelection | null
  readonly entries: Readonly<Record<string, MarketEvidenceTimelineEntry>>
}
export type MarketReviewIndexLoader = (contextRef: string, signal: AbortSignal) => Promise<MarketReviewIndexReadResult>
export type MarketReviewLoader = (contextRef: string, reviewRef: string, signal: AbortSignal) => Promise<MarketReviewReadResult>
export interface MarketReviewState {
  readonly contextRef: string | null
  readonly loading: boolean
  readonly index: MarketReviewIndexReadResult | null
  /** Exact frozen review ref currently bound; null while only the list is shown. */
  readonly selection: string | null
  readonly review: MarketReviewReadResult | null
}

/**
 * Weekly review state: the bounded discovery list plus at most one bound
 * frozen review. `refresh()` reloads the list and rebinds the current
 * selection (or the newest owner-frozen review when nothing is selected);
 * a missing review never falls back to another ref. Context, policy and
 * dispose clear both list and bound review so late responses never attach
 * to a new context. Display-only: no persistence, no retries.
 */
export function createMarketReviewController(loadIndex: MarketReviewIndexLoader, loadReview: MarketReviewLoader) {
  let state: MarketReviewState = { contextRef: null, loading: false, index: null, selection: null, review: null }
  let generation = 0
  let disposed = false
  let active: AbortController | undefined
  const listeners = new Set<(state: MarketReviewState) => void>()
  const emit = () => {
    const version = generation
    for (const listener of [...listeners]) {
      if (disposed || generation !== version) break
      if (!listeners.has(listener)) continue
      // A broken view subscription must not abort state transitions; detach
      // it and keep healthy views updated (same policy as the list states).
      try { listener(structuredClone(state)) } catch { listeners.delete(listener) }
    }
  }
  const invalidate = () => { generation++; active?.abort(); active = undefined }
  const failIndex = (): MarketReviewIndexReadResult => ({ ok: false, reason: 'offline', recovery: 'Inspect the active Radar connection.' })
  const failReview = (): MarketReviewReadResult => ({ ok: false, reason: 'offline', recovery: 'Inspect the active Radar connection.' })
  const bind = async (contextRef: string, request: number, reviewRef: string) => {
    const controller = new AbortController()
    active = controller
    state = { ...state, loading: true, selection: reviewRef }
    emit()
    if (disposed || request !== generation) return
    let result: MarketReviewReadResult
    try { result = await loadReview(contextRef, reviewRef, controller.signal) }
    catch { result = failReview() }
    // Guards: a context/policy switch or a newer request must not attach an
    // older review under the new state.
    if (disposed || request !== generation || state.contextRef !== contextRef || state.selection !== reviewRef) return
    active = undefined
    state = { ...state, loading: false, review: structuredClone(result) }
    emit()
  }
  return {
    snapshot: (): MarketReviewState => structuredClone(state),
    subscribe(listener: (state: MarketReviewState) => void) {
      if (disposed) throw new Error('market_controller_disposed')
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    setContext(contextRef: string | null) {
      if (disposed) return
      if (contextRef !== null && !isSafeRadarRef(contextRef)) throw new Error('market_unsafe_ref')
      invalidate()
      state = { contextRef, loading: false, index: null, selection: null, review: null }
      emit()
    },
    invalidatePolicy() {
      if (disposed) return
      invalidate()
      state = { ...state, loading: false, index: null, selection: null, review: null }
      emit()
    },
    async refresh() {
      if (disposed || state.contextRef === null) return
      invalidate()
      const request = generation, contextRef = state.contextRef
      const controller = new AbortController()
      active = controller
      const keepSelection = state.selection
      state = { ...state, loading: true, index: null, selection: null, review: null }
      emit()
      if (disposed || request !== generation) return
      let index: MarketReviewIndexReadResult
      try { index = await loadIndex(contextRef, controller.signal) }
      catch { index = failIndex() }
      if (disposed || request !== generation || contextRef !== state.contextRef) return
      state = { ...state, loading: false, index: structuredClone(index) }
      emit()
      // Auto-bind the newest frozen review only when nothing was selected;
      // an explicit selection survives a refresh and is re-bound below.
      const newest = index.ok && index.index.reviews.length > 0 ? index.index.reviews[0]!.reviewRef : null
      const next = keepSelection ?? newest
      if (next === null) return
      // Selection must exist in the fresh index before binding; a vanished
      // ref degrades to the newest instead of an owner read that cannot succeed.
      const exists = index.ok && index.index.reviews.some(summary => summary.reviewRef === next)
      const bindRef = exists ? next : newest
      if (bindRef !== null) await bind(contextRef, request, bindRef)
    },
    async select(reviewRef: string) {
      if (disposed || state.contextRef === null) return
      if (!isSafeRadarRef(reviewRef)) throw new Error('market_selection_invalid')
      if (state.selection === reviewRef && state.review !== null && !state.loading) return
      invalidate()
      await bind(state.contextRef, generation, reviewRef)
    },
    dispose() {
      if (disposed) return
      invalidate()
      disposed = true
      state = { contextRef: null, loading: false, index: null, selection: null, review: null }
      listeners.clear()
    },
  }
}

/**
 * Per-evidence timeline state for the currently selected signal revision.
 *
 * A second click while an entry is pending or loaded is a no-op (no duplicate
 * owner read), and switching selection, context or policy clears every entry
 * so late responses never attach stale evidence to a new selection. Entries
 * are display-only; nothing is persisted or auto-retried.
 */
export function createMarketEvidenceTimelineController(load: MarketEvidenceLoader) {
  let state: MarketEvidenceTimelineState = { contextRef: null, selection: null, entries: {} }
  let generation = 0
  let disposed = false
  let active: AbortController | undefined
  const listeners = new Set<(state: MarketEvidenceTimelineState) => void>()
  const emit = () => {
    const version = generation
    for (const listener of [...listeners]) {
      if (disposed || generation !== version) break
      if (!listeners.has(listener)) continue
      // A broken view subscription must not abort state transitions; detach
      // it and keep healthy views updated (same policy as the list states).
      try { listener(structuredClone(state)) } catch { listeners.delete(listener) }
    }
  }
  const invalidate = () => { generation++; active?.abort(); active = undefined }
  const clear = () => { state = { contextRef: state.contextRef, selection: null, entries: {} } }
  return {
    snapshot: (): MarketEvidenceTimelineState => structuredClone(state),
    subscribe(listener: (state: MarketEvidenceTimelineState) => void) {
      if (disposed) throw new Error('market_controller_disposed')
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    setContext(contextRef: string | null) {
      if (disposed) return
      if (contextRef !== null && !isSafeRadarRef(contextRef)) throw new Error('market_unsafe_ref')
      invalidate()
      state = { contextRef, selection: null, entries: {} }
      emit()
    },
    invalidatePolicy() {
      if (disposed) return
      invalidate()
      clear()
      emit()
    },
    /** Bind the timeline to one selection; switching it clears all entries. */
    setSelection(selection: MarketSignalSelection | null) {
      if (disposed) return
      if (selection === null) { clear(); emit(); return }
      if (!isSafeRadarRef(selection.signalRef) || !Number.isSafeInteger(selection.revision) || selection.revision < 1) throw new Error('market_selection_invalid')
      if (state.selection?.signalRef === selection.signalRef && state.selection.revision === selection.revision) return
      invalidate()
      state = { ...state, selection: { ...selection }, entries: {} }
      emit()
    },
    async load(evidenceRef: string) {
      if (disposed || state.contextRef === null || state.selection === null) return
      if (!isSafeRadarRef(evidenceRef)) throw new Error('market_selection_invalid')
      const existing = state.entries[evidenceRef]
      if (existing !== undefined && existing.state !== 'failed') return
      const request = generation, contextRef = state.contextRef, selection = { ...state.selection }
      const controller = new AbortController()
      active = controller
      state = { ...state, entries: { ...state.entries, [evidenceRef]: { state: 'loading', result: null } } }
      emit()
      let result: MarketEvidenceReadResult
      try { result = await load(contextRef, selection, evidenceRef, controller.signal) }
      catch { result = { ok: false, reason: 'offline', recovery: 'Inspect the active Radar connection.' } }
      // Guards: transports that ignore AbortSignal or resolve after a switch
      // must not attach evidence to a newer selection or context.
      if (disposed || request !== generation || state.selection === null ||
        state.selection.signalRef !== selection.signalRef || state.selection.revision !== selection.revision ||
        state.contextRef !== contextRef) return
      active = undefined
      state = { ...state, entries: { ...state.entries, [evidenceRef]: { state: result.ok ? 'loaded' : 'failed', result: structuredClone(result) } } }
      emit()
    },
    dispose() {
      if (disposed) return
      invalidate()
      disposed = true
      state = { contextRef: null, selection: null, entries: {} }
      listeners.clear()
    },
  }
}
