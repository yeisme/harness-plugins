/** Local controller that folds the DSH session list snapshot into a Pane-safe projection. */

import {
  projectSubagentPane,
  type SubagentCatalogSource,
  type SubagentMode,
  type SubagentPaneNodeV1,
  type SubagentPaneProjectionV1,
  type SubagentSummarySource,
} from './projection.js'

export interface SubagentSessionListLike {
  readonly current?: string
  readonly byId: Readonly<Record<string, SubagentSummarySource>>
  readonly subagentsByParent: Readonly<Record<string, SubagentCatalogSource>>
}

export interface SubagentOpenAddress {
  readonly parentSessionId: string
  readonly childSessionId: string
  readonly mode: SubagentMode
}

export interface SubagentDetailResult {
  readonly ok: boolean
  readonly summary?: string
  readonly error?: string
}

export interface SubagentDetailPort {
  history(address: SubagentOpenAddress, opts?: { readonly maxMessages?: number }): Promise<SubagentDetailResult>
  prompt(address: SubagentOpenAddress & { readonly mode: 'continuable' }, text: string): Promise<SubagentDetailResult>
  interrupt(address: SubagentOpenAddress & { readonly mode: 'continuable' }): Promise<SubagentDetailResult>
}

export interface SubagentMonitorEnvironment {
  getSnapshot(): SubagentSessionListLike
  subscribe(listener: () => void): () => void
  refresh(parentSessionId: string): void | Promise<void>
  openSubagent(address: SubagentOpenAddress): void
  readonly detail?: SubagentDetailPort
}

/** Cache key for the current root and raw list snapshot reference. */
interface ProjectionCache {
  readonly snapshot: SubagentSessionListLike
  readonly rootSessionId: string
  readonly projection: SubagentPaneProjectionV1
}

export class SubagentMonitorController {
  private readonly listeners = new Set<() => void>()
  private readonly env: SubagentMonitorEnvironment
  private readonly unsubscribe: () => void
  private cache: ProjectionCache | undefined
  private generation = 0
  private disposed = false
  private _parallel = false

  constructor(env: SubagentMonitorEnvironment) {
    this.env = env
    this.unsubscribe = env.subscribe(() => this.invalidate())
  }

  getSnapshot(): SubagentPaneProjectionV1 {
    if (this.disposed) throw new Error('SubagentMonitorController is disposed')
    const snapshot = this.env.getSnapshot()
    const rootSessionId = snapshot.current
    if (rootSessionId === undefined) {
      return {
        rootSessionId: '',
        nodes: [],
        runningCount: 0,
        totalTokens: undefined,
        freshness: 'unknown',
        generation: this.generation,
      }
    }
    const cached = this.cache
    if (cached !== undefined && cached.snapshot === snapshot && cached.rootSessionId === rootSessionId) {
      return cached.projection
    }
    const projection = projectSubagentPane({
      rootSessionId,
      catalogs: snapshot.subagentsByParent,
      summaries: snapshot.byId,
      freshness: 'fresh',
      generation: this.generation,
    })
    this.cache = { snapshot, rootSessionId, projection }
    return projection
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  refresh(): void {
    const snapshot = this.env.getSnapshot()
    const rootSessionId = snapshot.current
    if (rootSessionId !== undefined) void this.env.refresh(rootSessionId)
  }

  get parallel(): boolean {
    return this._parallel
  }

  setParallel(enabled: boolean): void {
    if (this._parallel === enabled) return
    this._parallel = enabled
    this.invalidate()
  }

  openInMain(node: SubagentPaneNodeV1): void {
    if (node.parentRef === undefined) return
    this.env.openSubagent({
      parentSessionId: node.parentRef,
      childSessionId: node.ref,
      mode: node.mode,
    })
  }

  async peek(node: SubagentPaneNodeV1): Promise<SubagentDetailResult> {
    const detail = this.env.detail
    if (detail === undefined || node.parentRef === undefined) {
      return { ok: false, error: 'subagent detail API is unavailable' }
    }
    return detail.history({
      parentSessionId: node.parentRef,
      childSessionId: node.ref,
      mode: node.mode,
    }, { maxMessages: 20 })
  }

  async send(node: SubagentPaneNodeV1, text: string): Promise<SubagentDetailResult> {
    const detail = this.env.detail
    if (detail === undefined || node.parentRef === undefined || node.mode !== 'continuable') {
      return { ok: false, error: 'send follow-up requires a continuable subagent and the detail API' }
    }
    return detail.prompt({
      parentSessionId: node.parentRef,
      childSessionId: node.ref,
      mode: 'continuable',
    }, text)
  }

  async interrupt(node: SubagentPaneNodeV1): Promise<SubagentDetailResult> {
    const detail = this.env.detail
    if (detail === undefined || node.parentRef === undefined || node.mode !== 'continuable') {
      return { ok: false, error: 'interrupt requires a continuable subagent and the detail API' }
    }
    return detail.interrupt({
      parentSessionId: node.parentRef,
      childSessionId: node.ref,
      mode: 'continuable',
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.unsubscribe()
    this.listeners.clear()
    this.cache = undefined
  }

  private invalidate(): void {
    if (this.disposed) return
    this.generation += 1
    this.cache = undefined
    for (const listener of [...this.listeners]) {
      try {
        listener()
      } catch {
        // Listener failures never break the controller update loop.
      }
    }
  }
}
