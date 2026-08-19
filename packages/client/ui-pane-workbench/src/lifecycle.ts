import type { PaneViewInstanceV1 } from './workspace.js'

export type PaneViewLifecycleState = 'registered' | 'waiting-for-size' | 'activating' | 'active' | 'suspended' | 'disposed'

export interface PaneViewLifecycleHooks {
  readonly activate: (view: PaneViewInstanceV1) => void
  readonly suspend?: (view: PaneViewInstanceV1) => void
  readonly dispose?: (view: PaneViewInstanceV1) => void
}

export interface PaneRetentionBudgetV1 {
  /** Maximum simultaneously active views of one kind. */
  readonly maxActive: number
  /** Maximum registered/retained views of one kind before LRU eviction. */
  readonly maxRetained: number
}

export interface PaneRetentionSnapshotV1 {
  readonly viewId: string
  readonly kind: string
  readonly state: PaneViewLifecycleState
  readonly lastUsed: number
}

export interface PaneAnimationFrame {
  request(callback: () => void): number
  cancel(handle: number): void
}

const browserFrame: PaneAnimationFrame = {
  request: callback => requestAnimationFrame(callback),
  cancel: handle => cancelAnimationFrame(handle),
}

/**
 * Delays size-sensitive activation until two consecutive visible frames. It is
 * DOM-agnostic so browser observers remain a thin adapter around this state machine.
 */
export class PaneViewLifecycleController {
  private state: PaneViewLifecycleState = 'registered'
  private visibleFrames = 0
  private frame?: number
  private projectionVisible = false

  constructor(
    private readonly view: PaneViewInstanceV1,
    private readonly hooks: PaneViewLifecycleHooks,
    private readonly animationFrame: PaneAnimationFrame = browserFrame,
  ) {}

  get snapshot(): PaneViewLifecycleState { return this.state }

  observeSize(width: number, height: number, projectionVisible: boolean): void {
    if (this.state === 'disposed') return
    this.projectionVisible = projectionVisible
    if (!projectionVisible || width <= 0 || height <= 0) {
      this.visibleFrames = 0
      if (this.state === 'active') this.suspend()
      else this.state = 'waiting-for-size'
      return
    }
    if (this.state === 'active') return
    this.state = 'waiting-for-size'
    if (this.frame === undefined) this.frame = this.animationFrame.request(() => this.advanceVisibleFrame(width, height))
  }

  hide(): void {
    this.projectionVisible = false
    this.visibleFrames = 0
    if (this.frame !== undefined) this.animationFrame.cancel(this.frame)
    this.frame = undefined
    if (this.state === 'active') this.suspend()
  }

  close(): void {
    if (this.state === 'disposed') return
    if (this.frame !== undefined) this.animationFrame.cancel(this.frame)
    this.frame = undefined
    this.state = 'disposed'
    this.hooks.dispose?.(this.view)
  }

  private advanceVisibleFrame(width: number, height: number): void {
    this.frame = undefined
    if (!this.projectionVisible || width <= 0 || height <= 0 || this.state === 'disposed') return
    this.visibleFrames += 1
    if (this.visibleFrames < 2) {
      this.frame = this.animationFrame.request(() => this.advanceVisibleFrame(width, height))
      return
    }
    this.state = 'activating'
    this.hooks.activate(this.view)
    this.state = 'active'
  }

  private suspend(): void {
    this.state = 'suspended'
    if (this.view.retention === 'recreate') this.hooks.dispose?.(this.view)
    else this.hooks.suspend?.(this.view)
  }
}

const DEFAULT_RETENTION_BUDGET: PaneRetentionBudgetV1 = { maxActive: 2, maxRetained: 8 }

interface RetainedView {
  readonly view: PaneViewInstanceV1
  controller: PaneViewLifecycleController
  lastUsed: number
}

/**
 * Coordinates measured activation and bounded per-kind retention without
 * owning view data or scheduling a background loop. Eviction is LRU and only
 * happens in response to registration, observation, or activation.
 */
export class PaneRetentionManager {
  private readonly entries = new Map<string, RetainedView>()
  private clock = 0

  constructor(
    private readonly budgets: Readonly<Record<string, PaneRetentionBudgetV1>> = {},
    private readonly defaultBudget: PaneRetentionBudgetV1 = DEFAULT_RETENTION_BUDGET,
    private readonly animationFrame: PaneAnimationFrame = browserFrame,
  ) {}

  register(view: PaneViewInstanceV1, hooks: PaneViewLifecycleHooks): () => void {
    if (this.entries.has(view.id)) throw new Error(`pane view ${view.id} is already retained`)
    const entry: RetainedView = {
      view,
      lastUsed: ++this.clock,
      controller: undefined as never,
    }
    entry.controller = new PaneViewLifecycleController(view, {
      ...hooks,
      activate: activatedView => {
        hooks.activate(activatedView)
        entry.lastUsed = ++this.clock
      },
      suspend: suspendedView => hooks.suspend?.(suspendedView),
      dispose: disposedView => hooks.dispose?.(disposedView),
    }, {
      request: callback => this.animationFrame.request(() => {
        callback()
        this.enforce(view.kind, view.id)
      }),
      cancel: handle => this.animationFrame.cancel(handle),
    })
    this.entries.set(view.id, entry)
    this.enforce(view.kind, view.id)
    return () => this.unregister(view.id)
  }

  observeSize(viewId: string, width: number, height: number, projectionVisible: boolean): void {
    const entry = this.entries.get(viewId)
    if (entry === undefined) return
    entry.controller.observeSize(width, height, projectionVisible)
    this.enforce(entry.view.kind, viewId)
  }

  touch(viewId: string): void {
    const entry = this.entries.get(viewId)
    if (entry !== undefined) entry.lastUsed = ++this.clock
  }

  hide(viewId: string): void {
    this.entries.get(viewId)?.controller.hide()
  }

  close(viewId: string): void {
    this.unregister(viewId)
  }

  snapshot(): readonly PaneRetentionSnapshotV1[] {
    return [...this.entries.values()]
      .map(entry => ({ viewId: entry.view.id, kind: entry.view.kind, state: entry.controller.snapshot, lastUsed: entry.lastUsed }))
      .sort((left, right) => left.lastUsed - right.lastUsed || left.viewId.localeCompare(right.viewId))
  }

  private unregister(viewId: string): void {
    const entry = this.entries.get(viewId)
    if (entry === undefined) return
    entry.controller.close()
    this.entries.delete(viewId)
  }

  private enforce(kind: string, protectedViewId: string): void {
    const entries = [...this.entries.values()].filter(entry => entry.view.kind === kind)
    const budget = normalizeBudget(this.budgets[kind] ?? this.defaultBudget)
    const active = entries.filter(entry => entry.controller.snapshot === 'active')
      .sort((left, right) => left.lastUsed - right.lastUsed || left.view.id.localeCompare(right.view.id))
    while (active.length > budget.maxActive) {
      const candidate = active.find(entry => entry.view.id !== protectedViewId) ?? active[0]
      if (candidate === undefined) break
      candidate.controller.hide()
      active.splice(active.indexOf(candidate), 1)
    }

    const retained = entries.filter(entry => entry.controller.snapshot !== 'disposed')
      .sort((left, right) => left.lastUsed - right.lastUsed || left.view.id.localeCompare(right.view.id))
    while (retained.length > budget.maxRetained) {
      const candidate = retained.find(entry => entry.view.id !== protectedViewId && entry.controller.snapshot !== 'active')
        ?? retained.find(entry => entry.view.id !== protectedViewId)
      if (candidate === undefined) break
      candidate.controller.close()
      this.entries.delete(candidate.view.id)
      retained.splice(retained.indexOf(candidate), 1)
    }
  }
}

function normalizeBudget(input: PaneRetentionBudgetV1): PaneRetentionBudgetV1 {
  return {
    maxActive: Math.max(1, Math.floor(Number.isFinite(input.maxActive) ? input.maxActive : DEFAULT_RETENTION_BUDGET.maxActive)),
    maxRetained: Math.max(1, Math.floor(Number.isFinite(input.maxRetained) ? input.maxRetained : DEFAULT_RETENTION_BUDGET.maxRetained)),
  }
}
