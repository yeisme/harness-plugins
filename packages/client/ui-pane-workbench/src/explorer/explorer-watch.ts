/**
 * Directory owner watch binding and cursor-gap reconcile
 * (dsh-pane-workspace-followups-v1 1.1).
 *
 * The official fs watch seam (`FileWatchCapabilityV1`, tracked in
 * `upstream-prs/fs-watch`) is not merged into any released DSH build, so this
 * controller only binds when the runtime advertises the capability. Without
 * the seam the tree keeps its honest on-demand behavior: no synthetic events,
 * no polling loop, no fake watch, and `available` reports the disabled reason.
 *
 * Event folding is the pure reducer's job (`watch` intent). This controller
 * owns the owner increments around it:
 * - unknown-ref `created`/`renamed` events trigger one targeted
 *   `listChildren(parent)` refresh (the event carries no names);
 * - a sequence gap marks `reconcile_required` and schedules exactly one
 *   authoritative re-read (roots + expanded directories); triggers that pile
 *   up while a read is in flight coalesce into it, and only a fresh gap
 *   detected during the read schedules one more.
 *
 * Reconcile never invents mutations and never resets the user's expansion,
 * selection, focus, or scroll anchor (see `reconcile_apply`).
 *
 * @module @yeisme/dsh-client-ui-pane-workbench/explorer-watch
 */

import {
  reduceExplorerTree,
  type ExplorerTreeNodeV1,
  type ExplorerTreeStateV1,
  type ExplorerTreeWatchEventV1,
} from './tree-state.js'

/** Matches the upstream additive seam id; see upstream-prs/fs-watch. */
export const EXPLORER_FILE_WATCH_CAPABILITY = 'FileWatchCapabilityV1' as const

export const EXPLORER_WATCH_UNAVAILABLE_REASON
  = 'FileWatchCapabilityV1 is not available from this runtime; the tree refreshes only through explicit owner reads.'

export interface ExplorerWatchEventStreamV1 {
  subscribe(listener: (event: ExplorerTreeWatchEventV1) => void): () => void
  /** Owner-side cursor position at call time, when the handle exposes it. */
  snapshotCursor?(): string
}

/** Minimal structural shape of an owner watch source (e.g. ctx.fs). */
export interface ExplorerWatchSourceV1 {
  readonly capabilities?: readonly string[]
  watch?(parentRef?: string): ExplorerWatchEventStreamV1
}

export function hasExplorerWatchCapability(source: ExplorerWatchSourceV1 | undefined): boolean {
  return source?.capabilities?.includes(EXPLORER_FILE_WATCH_CAPABILITY) === true
    && typeof source.watch === 'function'
}

export interface ExplorerWatchControllerV1 {
  /** Capability probe result; false keeps the tree on explicit reads only. */
  readonly available: boolean
  readonly disabledReason: string | undefined
  /**
   * One authoritative re-read of roots plus every expanded directory.
   * Coalesced while a read is in flight; resolves without fetching when the
   * capability is absent. Never polls on its own.
   */
  reconcile(): Promise<void>
  dispose(): void
}

export interface ExplorerWatchControllerDepsV1 {
  readonly source: ExplorerWatchSourceV1 | undefined
  readonly getRoots: () => Promise<readonly ExplorerTreeNodeV1[]>
  readonly listChildren: (ref: string) => Promise<readonly ExplorerTreeNodeV1[]>
  readonly getState: () => ExplorerTreeStateV1
  readonly setState: (next: ExplorerTreeStateV1) => void
}

export function createExplorerWatchController(deps: ExplorerWatchControllerDepsV1): ExplorerWatchControllerV1 {
  if (!hasExplorerWatchCapability(deps.source)) {
    return {
      available: false,
      disabledReason: EXPLORER_WATCH_UNAVAILABLE_REASON,
      reconcile: async () => {},
      dispose: () => {},
    }
  }
  const stream = deps.source!.watch!()
  let disposed = false
  let unsubscribe: (() => void) | undefined
  let reconciling: Promise<void> | undefined
  const refreshingParents = new Set<string>()
  let lastSequence: number | undefined
  let lastCursor: string | undefined

  const applyEvent = (event: ExplorerTreeWatchEventV1): void => {
    if (disposed) return
    lastSequence = event.sequence
    lastCursor = event.cursor
    const next = reduceExplorerTree(deps.getState(), { type: 'watch', event })
    deps.setState(next)
    if (next.freshness === 'reconcile_required') {
      void reconcile()
      return
    }
    if (event.op === 'created' || event.op === 'renamed') void refreshParent(event)
  }

  const refreshParent = async (event: ExplorerTreeWatchEventV1): Promise<void> => {
    if (disposed || reconciling !== undefined) return
    const state = deps.getState()
    if (state.freshness === 'reconcile_required') return
    const parentRef = event.parentRef ?? state.nodes[event.entryRef]?.parentRef
    if (parentRef === undefined) return
    // Never-loaded directories stay lazy; loaded or expanded ones need the authoritative rows.
    if (state.children[parentRef] === undefined && !state.expandedRefs.includes(parentRef)) return
    if (refreshingParents.has(parentRef)) return
    refreshingParents.add(parentRef)
    try {
      const nodes = await deps.listChildren(parentRef)
      if (disposed) return
      const current = deps.getState()
      if (current.nodes[parentRef] === undefined) return
      deps.setState(reduceExplorerTree(current, { type: 'children_ready', ref: parentRef, nodes }))
    } catch {
      // Honest degradation: the parent row stays marked stale; the next event,
      // explicit retry, or gap reconcile repairs it.
    } finally {
      refreshingParents.delete(parentRef)
    }
  }

  const runReconcile = async (): Promise<void> => {
    const start = deps.getState()
    const expanded = [...start.expandedRefs]
    const baselineSequence = lastSequence
    const baselineCursor = stream.snapshotCursor?.() ?? lastCursor
    const [roots, childLists] = await Promise.all([
      deps.getRoots(),
      Promise.all(expanded.map(ref => deps.listChildren(ref))),
    ])
    if (disposed) return
    const childrenByRef: Record<string, readonly ExplorerTreeNodeV1[]> = {}
    expanded.forEach((ref, index) => { childrenByRef[ref] = childLists[index] ?? [] })
    deps.setState(reduceExplorerTree(deps.getState(), {
      type: 'reconcile_apply',
      roots,
      childrenByRef,
      ...(baselineSequence === undefined ? {} : { baselineSequence }),
      ...(baselineCursor === undefined ? {} : { baselineCursor }),
    }))
  }

  const reconcile = (): Promise<void> => {
    if (reconciling !== undefined) return reconciling
    reconciling = runReconcile().finally(() => {
      reconciling = undefined
      // One authoritative read per gap episode: events that landed during the
      // read are absorbed by it; only a fresh gap schedules exactly one more
      // read. Event-driven only — no timers, no polling.
      if (!disposed && deps.getState().freshness === 'reconcile_required') void reconcile()
    })
    return reconciling
  }

  unsubscribe = stream.subscribe(applyEvent)
  return {
    available: true,
    disabledReason: undefined,
    reconcile,
    dispose: () => {
      disposed = true
      unsubscribe?.()
      unsubscribe = undefined
    },
  }
}
