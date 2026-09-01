import { subscriptionHandle, type SubscriptionHandle } from '@yeisme/dsh-plugin-contracts'
import { PaneDragCoordinator } from './drag-coordinator.js'
import type { ExperienceTierTrackerV1, WorkspaceDisabledReasonKey } from './experience-tier.js'
import { t } from './i18n/locale.js'
import {
  PaneWorkspacePersistenceAdapter,
  restorePaneWorkspace,
  serializePaneWorkspace,
} from './persistence.js'
import {
  createClosedHistoryBatch,
  noteRecentPane,
  PaneManagementPersistenceAdapter,
  removeCustomGroup,
  sanitizePaneRenditionRef,
  sanitizePaneRestoreState,
  togglePaneFavorite,
  updateCustomGroup,
  upsertCustomGroup,
  type PaneManagementProfileV1,
  type PaneManagementScopeV1,
  type PaneManagementSnapshotV1,
  type PaneWorkspaceManagementV1,
  type PaneClosedHistoryBatchV1,
  type PaneRestoreStateV1,
  type PaneSafeRenditionRendererV1,
} from './management.js'
import { markOrphanedPaneViews, type PaneViewRegistry } from './view-registry.js'
import {
  collectBulkCloseTargets,
  createPaneWorkspace,
  reducePaneWorkspace,
  type PaneRegionId,
  type PaneViewSpecV1,
  type PaneWorkspaceIntentV1,
  type PaneWorkspaceIntentV1Additive,
  type PaneWorkspaceReducerResultV1,
  type PaneWorkspaceV1,
} from './workspace.js'

const RIGHT_WIDTH_RATIO_BASIS = 1_500

/** Intents that need host-owned geometry; Tier 0 keeps a single region, so these are gated. */
export const PANE_TIER0_GEOMETRY_INTENTS = Object.freeze([
  'split_with_view',
  'move_group',
  'maximize_group',
  'resize_split',
  'resize_region',
] as const)

/**
 * Pre-dispatch capability gate. Returns the standard disabled-reason key when
 * the intent needs host geometry that Tier 0 does not provide; the reducer
 * state stays untouched for gated intents. Cross-region `move_view` is a
 * move-to-region gesture; same-group reorder stays allowed.
 */
export function gateTier0GeometryIntent(
  intent: PaneWorkspaceIntentV1Additive,
  state: PaneWorkspaceV1,
  tier: 0 | 1 | 2,
): WorkspaceDisabledReasonKey | undefined {
  if (tier !== 0) return undefined
  if ((PANE_TIER0_GEOMETRY_INTENTS as readonly string[]).includes(intent.type)) return 'reason.geometryTier0'
  if (intent.type === 'move_view' || intent.type === 'reorder_view') {
    const view = state.views[intent.viewId]
    const target = state.groups[intent.targetGroupId]
    if (view !== undefined && target !== undefined && view.groupId !== target.id) {
      const source = state.groups[view.groupId]
      if (source !== undefined && source.region !== target.region) return 'reason.geometryTier0'
    }
  }
  return undefined
}

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
  readonly managementPersistence?: PaneManagementPersistenceAdapter
  readonly renditionRenderer?: PaneSafeRenditionRendererV1
  /** Session experience tier projection. Tier 0 gates host-geometry intents before dispatch. */
  readonly experienceTier?: ExperienceTierTrackerV1
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
  private readonly managementListeners = new Set<() => void>()
  private managementSnapshotCache: PaneManagementSnapshotV1 | undefined
  private registryEvents: SubscriptionHandle | undefined
  private layoutHandle: PaneWorkspaceLayoutHandle | undefined
  private layoutEvents: SubscriptionHandle | undefined
  private syncingLayout = false
  private currentSession = 'root'
  private managementScope: PaneManagementScopeV1 = { kind: 'session', ref: 'session:root' }
  private managementProfile: PaneManagementProfileV1
  private workspaceManagement: PaneWorkspaceManagementV1
  private closedHistory: readonly PaneClosedHistoryBatchV1[]
  private lastClosedBatchId: string | undefined
  private readonly restoreByViewId = new Map<string, PaneRestoreStateV1>()
  private message = ''
  readonly drag: PaneDragCoordinator
  /** Session experience tier projection, when the host supplied one. Read live per dispatch. */
  readonly experienceTier: ExperienceTierTrackerV1 | undefined
  readonly renditionRenderer: PaneSafeRenditionRendererV1 | undefined

  constructor(private readonly options: PaneWorkbenchControllerOptions = {}) {
    const loaded = options.initialState ?? options.persistence?.load() ?? createPaneWorkspace()
    this.experienceTier = options.experienceTier
    this.renditionRenderer = options.renditionRenderer
    this.managementProfile = options.managementPersistence?.loadProfile() ?? {
      schema: 'pane.management.v1', groups: [], favoritePaneKinds: [], recentPaneKinds: [],
    }
    this.workspaceManagement = options.managementPersistence?.loadWorkspace(this.managementScope) ?? {
      schema: 'pane.management.v1', scope: this.managementScope, groupMembership: {}, pinnedResourceKeys: [],
    }
    this.closedHistory = options.managementPersistence?.loadHistory(this.managementScope).batches ?? []
    this.state = options.registry === undefined ? loaded : markOrphanedPaneViews(loaded, options.registry)
    this.visible = this.state.regions.right.visible || this.state.regions.bottom.visible
    this.drag = new PaneDragCoordinator(() => this.state, intent => this.dispatch(intent))
    if (options.registry !== undefined) {
      this.registryEvents = subscriptionHandle(options.registry.subscribe(() => {
        const next = markOrphanedPaneViews(this.state, options.registry!)
        if (next === this.state) return
        this.state = next
        this.persist()
        this.emitWorkspace()
      }))
    }
  }

  readonly getSnapshot = (): PaneWorkspaceV1 => this.state

  readonly subscribeWorkspace = (listener: () => void): (() => void) => {
    this.workspaceListeners.add(listener)
    return () => { this.workspaceListeners.delete(listener) }
  }

  readonly getManagementSnapshot = (): PaneManagementSnapshotV1 => {
    this.managementSnapshotCache ??= {
      scope: this.managementScope,
      profile: this.managementProfile,
      workspace: this.workspaceManagement,
      history: this.closedHistory,
      lastClosedBatch: this.lastClosedBatchId === undefined ? undefined : this.closedHistory.find(batch => batch.id === this.lastClosedBatchId),
    }
    return this.managementSnapshotCache
  }

  readonly subscribeManagement = (listener: () => void): (() => void) => {
    this.managementListeners.add(listener)
    return () => { this.managementListeners.delete(listener) }
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
    this.layoutEvents = subscriptionHandle(handle.subscribe(() => this.syncFromLayout()))
    this.syncLayout()
    return () => {
      this.layoutEvents?.unsubscribe()
      this.layoutEvents = undefined
      if (this.layoutHandle === handle) this.layoutHandle = undefined
    }
  }

  dispatch(intent: PaneWorkspaceIntentV1Additive): PaneWorkspaceReducerResultV1 {
    const before = this.state
    const tier = this.experienceTier?.getSnapshot().tier
    const gated = tier === undefined ? undefined : gateTier0GeometryIntent(intent, this.state, tier)
    if (gated !== undefined) {
      this.message = t(gated)
      return {
        state: this.state,
        accepted: false,
        reason: gated,
        effects: [{ type: 'announce', message: this.message, politeness: 'polite' }],
      }
    }
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
    const closedViewIds = result.accepted ? closedViewIdsForIntent(before, intent, result) : []
    if (closedViewIds.length > 0) this.recordClosedViews(before, closedViewIds)
    if (result.accepted && intent.type === 'pin_view') {
      const view = next.views[intent.viewId] ?? before.views[intent.viewId]
      if (view !== undefined) {
        const pinned = next.views[intent.viewId]?.pinned ?? false
        const keys = new Set(this.workspaceManagement.pinnedResourceKeys)
        if (pinned) keys.add(view.resourceKey)
        else keys.delete(view.resourceKey)
        this.workspaceManagement = { ...this.workspaceManagement, pinnedResourceKeys: [...keys] }
        this.saveManagement()
        this.emitManagement()
      }
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
    if (result.accepted) {
      this.managementProfile = noteRecentPane(this.managementProfile, request.kind)
      this.saveManagement()
      this.emitManagement()
    }
    if (this.legacyDispatch !== undefined) this.legacyDispatch({ type: 'open_view', request })
    else this.pendingOpen = request
  }

  switchSession(sessionId: string | undefined): void {
    const nextSession = sessionId?.trim() || 'root'
    if (nextSession === this.currentSession || this.options.persistence === undefined) return
    const previousSession = this.currentSession
    this.persist()
    this.currentSession = nextSession
    this.setManagementContext(undefined, nextSession)
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
    this.registryEvents?.unsubscribe()
    this.registryEvents = undefined
    this.layoutEvents?.unsubscribe()
    this.layoutEvents = undefined
    this.layoutHandle = undefined
    this.drag.dispose()
    this.visibilityListeners.clear()
    this.workspaceListeners.clear()
    this.managementListeners.clear()
    this.legacyDispatch = undefined
    this.pendingOpen = undefined
    this.restoreByViewId.clear()
  }

  setManagementContext(workspaceRef?: string, sessionRef?: string): void {
    const nextScope: PaneManagementScopeV1 = workspaceRef === undefined
      ? { kind: 'session', ref: safeScopeRef('session', sessionRef ?? this.currentSession) }
      : { kind: 'workspace', ref: safeScopeRef('workspace', workspaceRef) }
    if (nextScope.kind === this.managementScope.kind && nextScope.ref === this.managementScope.ref) return
    const previous = this.managementScope
    if (previous.kind === 'session' && nextScope.kind === 'workspace') this.options.managementPersistence?.seedScope(previous, nextScope)
    this.managementScope = nextScope
    this.workspaceManagement = this.options.managementPersistence?.loadWorkspace(nextScope) ?? {
      schema: 'pane.management.v1', scope: nextScope, groupMembership: {}, pinnedResourceKeys: [],
    }
    this.closedHistory = this.options.managementPersistence?.loadHistory(nextScope).batches ?? []
    this.lastClosedBatchId = undefined
    this.emitManagement()
  }

  updateRestoreState(viewId: string, state?: unknown, renditionRef?: unknown): boolean {
    if (this.state.views[viewId] === undefined) return false
    const safeState = state === undefined ? undefined : sanitizePaneRestoreState(state)
    const safeRenditionRef = renditionRef === undefined ? undefined : sanitizePaneRenditionRef(renditionRef)
    if (state !== undefined && safeState === undefined) return false
    if (renditionRef !== undefined && safeRenditionRef === undefined) return false
    if (safeState === undefined && safeRenditionRef === undefined) this.restoreByViewId.delete(viewId)
    else this.restoreByViewId.set(viewId, { state: safeState, renditionRef: safeRenditionRef })
    return true
  }

  getRestoreState(viewId: string): PaneRestoreStateV1 | undefined {
    return this.restoreByViewId.get(viewId)
  }

  restoreClosedBatch(batchId?: string): boolean {
    const batch = batchId === undefined ? this.closedHistory[0] : this.closedHistory.find(item => item.id === batchId)
    if (batch === undefined) return false
    let activeViewId: string | undefined
    for (const entry of [...batch.entries].sort((left, right) => left.index - right.index)) {
      const targetGroupId = this.state.groups[entry.groupId] === undefined ? undefined : entry.groupId
      this.openView({ ...entry.view, targetGroupId, dirty: false })
      const opened = Object.values(this.state.views).find(view => (
        view.id === entry.view.viewId || (view.kind === entry.view.kind && view.resourceKey === entry.view.resourceKey)
      ))
      if (opened === undefined) continue
      if (entry.restore !== undefined) this.restoreByViewId.set(opened.id, entry.restore)
      if (targetGroupId !== undefined) this.dispatch({ type: 'reorder_view', viewId: opened.id, targetGroupId, index: entry.index })
      if (entry.wasActive) activeViewId = opened.id
    }
    if (activeViewId !== undefined) this.dispatch({ type: 'activate_view', viewId: activeViewId })
    this.closedHistory = this.closedHistory.filter(item => item.id !== batch.id)
    if (this.lastClosedBatchId === batch.id) this.lastClosedBatchId = undefined
    this.saveManagement()
    this.emitManagement()
    return true
  }

  saveCustomGroup(input: { readonly id?: string; readonly label: string; readonly paneKinds?: readonly string[] }): void {
    this.managementProfile = upsertCustomGroup(this.managementProfile, input)
    this.saveManagement()
    this.emitManagement()
  }

  addKindsToCustomGroup(groupId: string, paneKinds: readonly string[]): void {
    const current = this.workspaceManagement.groupMembership[groupId] ?? []
    this.workspaceManagement = {
      ...this.workspaceManagement,
      groupMembership: {
        ...this.workspaceManagement.groupMembership,
        [groupId]: [...new Set([...current, ...paneKinds])],
      },
    }
    this.saveManagement()
    this.emitManagement()
  }

  deleteCustomGroup(groupId: string): void {
    this.managementProfile = removeCustomGroup(this.managementProfile, groupId)
    this.saveManagement()
    this.emitManagement()
  }

  editCustomGroup(groupId: string, patch: { readonly label?: string; readonly pinned?: boolean; readonly move?: -1 | 1 }): void {
    this.managementProfile = updateCustomGroup(this.managementProfile, groupId, patch)
    this.saveManagement()
    this.emitManagement()
  }

  toggleFavorite(kind: string): void {
    this.managementProfile = togglePaneFavorite(this.managementProfile, kind)
    this.saveManagement()
    this.emitManagement()
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

  private recordClosedViews(before: PaneWorkspaceV1, viewIds: readonly string[]): void {
    const restoreByViewId = Object.fromEntries(viewIds.map(viewId => [viewId, this.restoreByViewId.get(viewId)]))
    const batch = createClosedHistoryBatch({ state: before, viewIds, scope: this.managementScope, restoreByViewId })
    if (batch === undefined) return
    for (const viewId of viewIds) this.restoreByViewId.delete(viewId)
    this.closedHistory = [batch, ...this.closedHistory.filter(item => item.id !== batch.id)]
    this.lastClosedBatchId = batch.id
    this.saveManagement()
    this.emitManagement()
  }

  private saveManagement(): void {
    this.options.managementPersistence?.saveProfile(this.managementProfile)
    this.options.managementPersistence?.saveWorkspace(this.workspaceManagement)
    this.options.managementPersistence?.saveHistory(this.managementScope, this.closedHistory)
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

  private emitManagement(): void {
    this.managementSnapshotCache = undefined
    for (const listener of [...this.managementListeners]) {
      try { listener() } catch { /* management observers are isolated */ }
    }
  }
}

function closedViewIdsForIntent(
  before: PaneWorkspaceV1,
  intent: PaneWorkspaceIntentV1Additive,
  result: PaneWorkspaceReducerResultV1,
): readonly string[] {
  if (intent.type === 'close_view') return before.views[intent.viewId] === undefined ? [] : [intent.viewId]
  if (intent.type === 'bulk_close') return collectBulkCloseTargets(before, intent.groupId, intent.mode, intent.sourceViewId)
  if (intent.type === 'bulk_close_safe') return result.details?.bulkCloseSafe?.closedViewIds ?? []
  return []
}

function safeScopeRef(kind: 'session' | 'workspace', value: string): string {
  const raw = value.trim()
  if (/^[a-z0-9][a-z0-9._:-]{0,119}$/i.test(raw)) return `${kind}:${raw}`
  let hash = 2_166_136_261
  for (const char of raw) hash = Math.imul(hash ^ char.charCodeAt(0), 16_777_619)
  return `${kind}:${(hash >>> 0).toString(36)}`
}

function sessionPreset(sessionId: string): string {
  const normalized = sessionId.replace(/[^a-z0-9._:-]/gi, '_').slice(0, 40) || 'root'
  let hash = 2_166_136_261
  for (const char of sessionId) hash = Math.imul(hash ^ char.charCodeAt(0), 16_777_619)
  return `session:${normalized}:${(hash >>> 0).toString(36)}`
}
