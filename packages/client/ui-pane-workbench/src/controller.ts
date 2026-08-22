import { PaneDragCoordinator } from './drag-coordinator.js'
import {
  PaneWorkspacePersistenceAdapter,
  restorePaneWorkspace,
  serializePaneWorkspace,
} from './persistence.js'
import { markOrphanedPaneViews, type PaneViewRegistry } from './view-registry.js'
import {
  createPaneWorkspace,
  reducePaneWorkspace,
  type PaneRegionId,
  type PaneViewSpecV1,
  type PaneWorkspaceIntentV1,
  type PaneWorkspaceReducerResultV1,
  type PaneWorkspaceV1,
} from './workspace.js'

const RIGHT_WIDTH_RATIO_BASIS = 1_500

export interface PaneWorkspaceLayoutPreference {
  readonly rightVisible?: boolean
  readonly bottomVisible?: boolean
  readonly rightWidth?: number
  readonly bottomRatio?: number
  readonly activeRegion?: PaneRegionId
  readonly maximizedRegion?: PaneRegionId
}

export interface PaneWorkspaceLayoutSnapshot {
  readonly attached: boolean
  readonly rightVisible: boolean
  readonly bottomVisible: boolean
  readonly rightWidth: number
  readonly bottomRatio: number
  readonly activeRegion: PaneRegionId
  readonly maximizedRegion?: PaneRegionId
}

export interface PaneWorkspaceLayoutHandle {
  update(next: PaneWorkspaceLayoutPreference): void
  getSnapshot(): PaneWorkspaceLayoutSnapshot
  subscribe(listener: () => void): () => void
  dispose(): void
}

export interface PaneWorkbenchControllerOptions {
  readonly initialState?: PaneWorkspaceV1
  readonly registry?: PaneViewRegistry
  readonly persistence?: PaneWorkspacePersistenceAdapter
}

/**
 * Canonical external Pane store shared by both DSH workspace slot roots.
 * The legacy `attach(dispatch)` bridge remains for the deprecated one-root
 * Chrome story, while production reads `getSnapshot()` directly.
 */
export class PaneWorkbenchController {
  private state: PaneWorkspaceV1
  private legacyDispatch: ((intent: PaneWorkspaceIntentV1) => void) | undefined
  private pendingOpen: PaneViewSpecV1 | undefined
  private visible = false
  private readonly visibilityListeners = new Set<() => void>()
  private readonly workspaceListeners = new Set<() => void>()
  private registryDispose: (() => void) | undefined
  private layoutHandle: PaneWorkspaceLayoutHandle | undefined
  private layoutDispose: (() => void) | undefined
  private syncingLayout = false
  private currentSession = 'root'
  private message = ''
  readonly drag: PaneDragCoordinator

  constructor(private readonly options: PaneWorkbenchControllerOptions = {}) {
    const loaded = options.initialState ?? options.persistence?.load() ?? createPaneWorkspace()
    this.state = options.registry === undefined ? loaded : markOrphanedPaneViews(loaded, options.registry)
    this.visible = this.state.regions.right.visible || this.state.regions.bottom.visible
    this.drag = new PaneDragCoordinator(() => this.state, intent => this.dispatch(intent))
    if (options.registry !== undefined) {
      this.registryDispose = options.registry.subscribe(() => {
        const next = markOrphanedPaneViews(this.state, options.registry!)
        if (next === this.state) return
        this.state = next
        this.persist()
        this.emitWorkspace()
      })
    }
  }

  readonly getSnapshot = (): PaneWorkspaceV1 => this.state

  readonly subscribeWorkspace = (listener: () => void): (() => void) => {
    this.workspaceListeners.add(listener)
    return () => { this.workspaceListeners.delete(listener) }
  }

  get announcement(): string { return this.message }

  /** Deprecated dispatch bridge used only by the one-root story component. */
  attach(dispatch: (intent: PaneWorkspaceIntentV1) => void): () => void {
    this.legacyDispatch = dispatch
    const pending = this.pendingOpen
    if (pending !== undefined) {
      this.pendingOpen = undefined
      dispatch({ type: 'open_view', request: pending })
    }
    return () => {
      if (this.legacyDispatch === dispatch) this.legacyDispatch = undefined
    }
  }

  bindWorkspaceLayout(handle: PaneWorkspaceLayoutHandle): () => void {
    if (this.layoutHandle !== undefined) throw new Error('paneWorkbench: workspace layout handle already bound')
    this.layoutHandle = handle
    this.layoutDispose = handle.subscribe(() => this.syncFromLayout())
    this.syncLayout()
    return () => {
      this.layoutDispose?.()
      this.layoutDispose = undefined
      if (this.layoutHandle === handle) this.layoutHandle = undefined
    }
  }

  dispatch(intent: PaneWorkspaceIntentV1): PaneWorkspaceReducerResultV1 {
    const result = reducePaneWorkspace(this.state, intent)
    const next = this.options.registry === undefined ? result.state : markOrphanedPaneViews(result.state, this.options.registry)
    this.message = result.effects[0]?.message ?? (result.accepted ? 'Layout updated.' : result.reason ?? 'Layout action was not available.')
    if (next !== this.state) {
      const beforeVisible = this.visible
      this.state = next
      this.visible = next.regions.right.visible || next.regions.bottom.visible
      this.persist()
      this.syncLayout()
      this.emitWorkspace()
      if (beforeVisible !== this.visible) this.emitVisibility()
    }
    if (intent.type === 'activate_view') this.markLayoutActive(this.state.activeRegion)
    return { ...result, state: next }
  }

  show(region: PaneRegionId = 'right'): void {
    this.dispatch({ type: 'set_region_visibility', region, visible: true })
    this.markLayoutActive(region)
  }

  hide(): void {
    this.dispatch({ type: 'set_region_visibility', region: 'right', visible: false })
    this.dispatch({ type: 'set_region_visibility', region: 'bottom', visible: false })
  }

  get isVisible(): boolean { return this.visible }

  subscribe(listener: () => void): () => void {
    this.visibilityListeners.add(listener)
    return () => { this.visibilityListeners.delete(listener) }
  }

  /** Compatible public entry: semantic routing opens and reveals its resolved region. */
  openView(request: PaneViewSpecV1): void {
    const result = this.dispatch({ type: 'open_view', request })
    if (result.accepted) this.markLayoutActive(result.state.activeRegion)
    if (this.legacyDispatch !== undefined) this.legacyDispatch({ type: 'open_view', request })
    else this.pendingOpen = request
  }

  switchSession(sessionId: string | undefined): void {
    const nextSession = sessionId?.trim() || 'root'
    if (nextSession === this.currentSession || this.options.persistence === undefined) return
    const previousSession = this.currentSession
    this.persist()
    this.currentSession = nextSession
    const preset = sessionPreset(nextSession)
    const firstConcreteSession = previousSession === 'root' && nextSession !== 'root'
    const hasPreset = this.options.persistence.hasPreset(preset)
    const restored = firstConcreteSession && !hasPreset
      ? restorePaneWorkspace(serializePaneWorkspace(this.state), this.state.generation + 1)
      : this.options.persistence.loadPreset(preset, this.state.generation + 1)
    this.state = this.options.registry === undefined ? restored : markOrphanedPaneViews(restored, this.options.registry)
    if (firstConcreteSession && !hasPreset) {
      this.options.persistence.savePreset(preset, this.state)
    }
    this.visible = this.state.regions.right.visible || this.state.regions.bottom.visible
    this.syncLayout()
    this.emitWorkspace()
    this.emitVisibility()
  }

  dispose(): void {
    this.persist()
    this.registryDispose?.()
    this.registryDispose = undefined
    this.layoutDispose?.()
    this.layoutDispose = undefined
    this.layoutHandle = undefined
    this.drag.dispose()
    this.visibilityListeners.clear()
    this.workspaceListeners.clear()
    this.legacyDispatch = undefined
    this.pendingOpen = undefined
  }

  private syncLayout(): void {
    const handle = this.layoutHandle
    if (handle === undefined || this.syncingLayout) return
    const current = handle.getSnapshot()
    if (!current.attached) return
    const maximizedGroup = this.state.maximizedGroupId === undefined ? undefined : this.state.groups[this.state.maximizedGroupId]
    const maximizedRegion = maximizedGroup?.region
    const target = {
      rightVisible: this.state.regions.right.visible,
      bottomVisible: this.state.regions.bottom.visible,
      rightWidth: Math.round(this.state.regions.right.size * RIGHT_WIDTH_RATIO_BASIS),
      bottomRatio: this.state.regions.bottom.size,
      activeRegion: this.state.activeRegion,
      maximizedRegion,
    }
    const patch: PaneWorkspaceLayoutPreference = {}
    if (current.rightVisible !== target.rightVisible) Object.assign(patch, { rightVisible: target.rightVisible })
    if (current.bottomVisible !== target.bottomVisible) Object.assign(patch, { bottomVisible: target.bottomVisible })
    if (Math.abs(current.rightWidth - target.rightWidth) >= 1) Object.assign(patch, { rightWidth: target.rightWidth })
    if (Math.abs(current.bottomRatio - target.bottomRatio) >= 0.001) Object.assign(patch, { bottomRatio: target.bottomRatio })
    if (current.activeRegion !== target.activeRegion) Object.assign(patch, { activeRegion: target.activeRegion })
    if (current.maximizedRegion !== target.maximizedRegion) Object.assign(patch, { maximizedRegion: target.maximizedRegion })
    if (Object.keys(patch).length === 0) return
    this.syncingLayout = true
    try { handle.update(patch) } finally { this.syncingLayout = false }
  }

  private syncFromLayout(): void {
    const handle = this.layoutHandle
    if (handle === undefined || this.syncingLayout) return
    const layout = handle.getSnapshot()
    if (!layout.attached) return
    this.syncingLayout = true
    try {
      const rightSize = layout.rightWidth / RIGHT_WIDTH_RATIO_BASIS
      if (Math.abs(rightSize - this.state.regions.right.size) >= 0.001) this.dispatch({ type: 'resize_region', region: 'right', size: rightSize })
      if (Math.abs(layout.bottomRatio - this.state.regions.bottom.size) >= 0.001) this.dispatch({ type: 'resize_region', region: 'bottom', size: layout.bottomRatio })
      if (layout.maximizedRegion === undefined && this.state.maximizedGroupId !== undefined) this.dispatch({ type: 'restore_layout' })
    } finally {
      this.syncingLayout = false
    }
  }

  private markLayoutActive(region: PaneRegionId): void {
    const handle = this.layoutHandle
    if (handle === undefined) return
    handle.update(region === 'right'
      ? { activeRegion: region, rightVisible: true }
      : { activeRegion: region, bottomVisible: true })
  }

  private persist(): void {
    const persistence = this.options.persistence
    if (persistence === undefined) return
    if (this.currentSession === 'root') persistence.saveSession(this.state)
    else persistence.savePreset(sessionPreset(this.currentSession), this.state)
  }

  private emitVisibility(): void {
    for (const listener of [...this.visibilityListeners]) {
      try { listener() } catch { /* activation observers are isolated */ }
    }
  }

  private emitWorkspace(): void {
    for (const listener of [...this.workspaceListeners]) {
      try { listener() } catch { /* workspace observers are isolated */ }
    }
  }
}

function sessionPreset(sessionId: string): string {
  const normalized = sessionId.replace(/[^a-z0-9._:-]/gi, '_').slice(0, 40) || 'root'
  let hash = 2_166_136_261
  for (const char of sessionId) hash = Math.imul(hash ^ char.charCodeAt(0), 16_777_619)
  return `session:${normalized}:${(hash >>> 0).toString(36)}`
}
