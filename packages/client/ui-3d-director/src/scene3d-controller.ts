import {
  CanvasBindingSchema,
  GenerationChangeSetSchema,
  GltfCapabilityGapSchema,
  parseGltfCapabilityReport,
  parseSceneDocument,
  SceneGraphReadResultSchema,
  SceneWorkbenchReadResultSchema,
  SceneGraphSaveResultSchema,
  SCENE_3D_SCHEMA,
  ShotSchema,
  type CanvasBindingV1,
  type GenerationChangeSetV1,
  type GltfCapabilityGapV1,
  type GltfCapabilityReportV1,
  type SceneDocumentV1,
  type SceneGraphReadRequest,
  type SceneGraphSaveRequest,
  type ShotV1,
} from '@yeisme/dsh-pane-protocol'
import type { Scene3DDirectorRemote, Scene3DReconcileRequest } from './remote.js'
import { hasScene3DChangeSetControls } from './remote.js'

export type Scene3DLoadStatus = 'loading' | 'ready' | 'missing' | 'unavailable' | 'forbidden' | 'invalid' | 'error'
export type Scene3DSaveStatus = 'clean' | 'dirty' | 'saving' | 'unknown' | 'conflict' | 'error'

/** Bounded, text-first conflict summary: local draft vs the owner-confirmed revision. */
export interface Scene3DConflictState {
  readonly localBaseVersion: number
  readonly remoteVersion: number
  readonly pendingEditCount: number
  readonly summary: string
}

export type Scene3DExportState =
  | { readonly status: 'idle' }
  | { readonly status: 'exporting' }
  | { readonly status: 'exported'; readonly size: number; readonly mediaType: string }
  | { readonly status: 'blocked'; readonly reason: string; readonly gaps: readonly GltfCapabilityGapV1[] }
  | { readonly status: 'failed'; readonly reason: string }

export type Scene3DImportOutcome =
  | { readonly status: 'imported'; readonly warnings: readonly string[] }
  | { readonly status: 'failed'; readonly reason: string }

/** Draft keyframe edit produced by the timeline; applied to the shot draft, never saved directly. */
export type Scene3DShotKeyframeEdit =
  | { readonly type: 'move-keyframe'; readonly keyframeId: string; readonly frame: number }

export interface Scene3DNodeTransformPatch {
  readonly translate?: [number, number, number]
  readonly rotate?: [number, number, number, number]
  readonly scale?: [number, number, number]
}

/** Read-only change-set preview parsed from the host; comparison baseline included, never patch bytes. */
export type Scene3DChangeSetPreviewResult =
  | { readonly status: 'ready'; readonly changeSet: GenerationChangeSetV1; readonly currentVersion: number; readonly baseRevisionRetained: boolean }
  | { readonly status: 'missing' | 'unavailable' | 'forbidden' | 'invalid'; readonly reason: string }

/** Outcome of an accept/reject/rollback control. Failures always carry a bounded reason. */
export type Scene3DChangeSetActionOutcome =
  | { readonly status: 'accepted'; readonly version: number }
  | { readonly status: 'rejected' }
  | { readonly status: 'rolled_back'; readonly version: number }
  | { readonly status: 'conflict'; readonly version: number }
  | { readonly status: 'failed'; readonly reason: string }

export interface Scene3DViewState {
  readonly status: Scene3DLoadStatus
  readonly saveStatus: Scene3DSaveStatus
  readonly dirty: boolean
  /** True while a revision conflict freezes writes; mutation controls must be disabled. */
  readonly frozen: boolean
  readonly document?: SceneDocumentV1 | undefined
  readonly shots: readonly ShotV1[]
  readonly bindings: readonly CanvasBindingV1[]
  readonly changeSets: readonly GenerationChangeSetV1[]
  readonly changeSetsStatus: 'unknown' | 'ready' | 'unavailable'
  readonly conflict?: Scene3DConflictState | undefined
  readonly export: Scene3DExportState
  readonly selectedShotRef?: string | undefined
  readonly selectedNodeId?: string | undefined
}

export interface Scene3DControllerOptions {
  /** Shot projections supplied by the embedding surface; zod fail-closed. */
  readonly shots?: readonly unknown[]
  /** Canvas bindings supplied by the embedding surface; zod fail-closed. */
  readonly bindings?: readonly unknown[]
  readonly newId?: () => string
  /** Receives exported GLB bytes (base64) plus the authoritative report; the controller never fetches or stores bytes. */
  readonly onExportBytes?: (bytesBase64: string, report: GltfCapabilityReportV1) => void
}

const MAX_REASON = 240

function boundedReason(text: string): string {
  const flattened = text.replace(/[\u0000-\u001F\u007F]+/gu, ' ').trim()
  const value = flattened.length > 0 ? flattened : 'unknown'
  return value.length <= MAX_REASON ? value : `${value.slice(0, MAX_REASON - 1)}…`
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

/** Bounded failure reason for change-set control results, including transition/missing details. */
function changeSetFailureReason(value: Record<string, unknown>, action: 'accept' | 'reject' | 'rollback'): string {
  if (value.status === 'invalid_transition') {
    return boundedReason(`The change set can no longer be ${action}ed from status ${String(value.from)}.`)
  }
  if (value.status === 'missing') return 'The change set is no longer listed by the owner.'
  if (value.status === 'not_applied') return 'The commit was not applied; reconcile the save state.'
  if (value.status === 'revision_not_retained') return 'The prior revision fell out of the retained history; rollback is no longer possible.'
  if (typeof value.reason === 'string') return boundedReason(value.reason)
  return boundedReason(`change_set_${action}_${typeof value.status === 'string' ? value.status : 'error'}`)
}

function emptyDocument(target: SceneGraphReadRequest): SceneDocumentV1 {
  return {
    schema: SCENE_3D_SCHEMA,
    scope: target.scope,
    id: target.documentId,
    version: 0,
    scenes: [{ id: 'main', label: 'Main scene', rootNodeIds: [], default: true }],
    nodes: [],
    resources: [],
    extensions: { used: [], required: [] },
    capabilityReport: { gltfVersion: '2.0', extensions: [], export: { ready: true, gaps: [] } },
  }
}

function sameTarget(document: SceneDocumentV1, target: SceneGraphReadRequest): boolean {
  return document.id === target.documentId
    && document.scope.workspaceRef === target.scope.workspaceRef
    && document.scope.projectRef === target.scope.projectRef
}

interface PendingSave {
  readonly shots?: ShotV1[]
  readonly request: SceneGraphSaveRequest
  readonly baseVersion: number
  readonly editCount: number
}

/**
 * One controller per scene document. Owns the local draft and the revision
 * protocol against the `scene3dDirector` host remote:
 * - every payload is fail-closed parsed against pane-protocol schemas;
 * - a revision conflict freezes writes, keeps the local draft, summarizes the
 *   local/remote divergence and exposes owner reconcile entries — it never
 *   auto-overwrites, retries, or replaces the owner writer;
 * - an unknown save settles only through reconcileScene;
 * - transport loss degrades to an explanatory state and never polls.
 */
export class Scene3DController {
  private state: Scene3DViewState = {
    status: 'loading',
    saveStatus: 'clean',
    dirty: false,
    frozen: false,
    shots: [],
    bindings: [],
    changeSets: [],
    changeSetsStatus: 'unknown',
    export: { status: 'idle' },
  }
  private listeners = new Set<() => void>()
  private generation = 0
  private disposed = false
  private pending: PendingSave | undefined
  private shotsDirty = false
  private shotsPersisted = false
  get shotSaveUnavailable(): boolean { return this.shotsDirty && !this.canPersistShots }
  get canPersistShots(): boolean { return typeof this.remote.sceneWorkbenchRead === 'function' && typeof this.remote.saveSceneWorkbench === 'function' }
  private editCount = 0
  private readonly newId: () => string
  private readonly onExportBytes?: (bytesBase64: string, report: GltfCapabilityReportV1) => void

  constructor(
    private readonly remote: Scene3DDirectorRemote,
    readonly target: SceneGraphReadRequest,
    options: Scene3DControllerOptions = {},
  ) {
    this.newId = options.newId ?? (() => `scene3d-save-${crypto.randomUUID()}`)
    if (options.onExportBytes !== undefined) this.onExportBytes = options.onExportBytes
    if (options.shots !== undefined) this.setShots(options.shots)
    if (options.bindings !== undefined) this.setBindings(options.bindings)
  }

  getSnapshot = (): Scene3DViewState => this.state
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  private publish(state: Scene3DViewState): void {
    if (this.disposed) return
    this.state = state
    for (const listener of this.listeners) listener()
  }

  /** Validate replacement Shot projections (fail closed: any violation → invalid). */
  setShots(input: readonly unknown[]): boolean {
    if (this.shotsDirty || this.shotsPersisted || this.pending !== undefined) return false
    const shots: ShotV1[] = []
    for (const entry of input) {
      const parsed = ShotSchema.safeParse(entry)
      if (!parsed.success) {
        this.publish({ ...this.state, status: 'invalid' })
        return false
      }
      shots.push(parsed.data)
    }
    this.publish({ ...this.state, shots })
    return true
  }

  /** Validate replacement CanvasBinding projections (fail closed). */
  setBindings(input: readonly unknown[]): boolean {
    const bindings: CanvasBindingV1[] = []
    for (const entry of input) {
      const parsed = CanvasBindingSchema.safeParse(entry)
      if (!parsed.success) {
        this.publish({ ...this.state, status: 'invalid' })
        return false
      }
      bindings.push(parsed.data)
    }
    this.publish({ ...this.state, bindings })
    return true
  }

  async load(): Promise<void> {
    if (this.disposed || this.pending !== undefined || this.state.dirty) return
    const generation = ++this.generation
    this.publish({ ...this.state, status: 'loading' })
    let raw: unknown
    try {
      raw = this.canPersistShots ? await this.remote.sceneWorkbenchRead!(this.target) : await this.remote.sceneRead(this.target)
    } catch {
      if (generation === this.generation && !this.disposed) this.publish({ ...this.state, status: 'error' })
      return
    }
    if (generation !== this.generation || this.disposed) return
    let loadedShots: ShotV1[] | undefined
    if (this.canPersistShots) {
      const workbench = SceneWorkbenchReadResultSchema.safeParse(raw)
      if (!workbench.success) { this.publish({ ...this.state, status: 'invalid' }); return }
      raw = workbench.data.result; loadedShots = workbench.data.shots
    }
    const result = SceneGraphReadResultSchema.safeParse(raw)
    if (!result.success) {
      this.publish({ ...this.state, status: 'invalid' })
      return
    }
    const read = result.data
    if (read.status !== 'ready' && read.status !== 'missing') {
      this.publish({ ...this.state, status: read.status })
      return
    }
    if (loadedShots !== undefined) this.shotsPersisted = true
    const confirmed = read.status === 'ready' ? read.document : undefined
    if (confirmed !== undefined && !sameTarget(confirmed, this.target)) {
      this.publish({ ...this.state, status: 'invalid' })
      return
    }
    // A journaled save whose commit never settled replays as a draft and is reconciled first.
    const draft = read.draft !== undefined && read.draft.baseVersion === (confirmed?.version ?? 0) ? read.draft : undefined
    if (draft !== undefined) {
      if (!sameTarget(draft.document, this.target) || draft.document.version !== draft.baseVersion) {
        this.publish({ ...this.state, status: 'invalid' })
        return
      }
      const pending: PendingSave = {
        request: { requestId: draft.requestId, document: draft.document },
        baseVersion: draft.baseVersion,
        editCount: this.editCount,
        ...(loadedShots === undefined ? {} : { shots: loadedShots }),
      }
      this.pending = pending
      this.publish({ ...this.state, shots: loadedShots ?? this.state.shots, status: 'ready', document: draft.document, dirty: true, saveStatus: 'saving' })
      try {
        const receipt = await this.remote.reconcileScene(this.reconcileRequest(pending))
        if (generation !== this.generation || this.disposed) return
        this.acceptSaveResult(receipt, pending, true)
      } catch {
        if (generation === this.generation && !this.disposed) this.publish({ ...this.state, saveStatus: 'unknown' })
      }
      return
    }
    if (confirmed === undefined) {
      this.publish({ ...this.state, status: 'missing', document: undefined, dirty: false, saveStatus: 'clean' })
    } else {
      this.shotsDirty = false
      this.publish({ ...this.state, shots: loadedShots ?? this.state.shots, status: 'ready', document: confirmed, dirty: false, saveStatus: 'clean' })
    }
  }

  /** Start a fresh version-0 scene draft after a `missing` read. */
  createDraft(): void {
    if (this.disposed || this.state.status !== 'missing') return
    this.editCount = 0
    this.publish({ ...this.state, status: 'ready', document: emptyDocument(this.target), dirty: true, saveStatus: 'dirty' })
  }

  selectShot(shotRef: string | undefined): void {
    if (this.disposed) return
    this.publish({ ...this.state, selectedShotRef: shotRef })
  }

  selectNode(nodeId: string | undefined): void {
    if (this.disposed) return
    this.publish({ ...this.state, selectedNodeId: nodeId })
  }

  private editableDocument(): SceneDocumentV1 | undefined {
    if (this.disposed || this.state.status !== 'ready' || this.state.frozen) return undefined
    return this.state.document
  }

  /** Draft transform edit; conflict-frozen or non-ready states refuse without side effects. */
  editNodeTransform(nodeId: string, patch: Scene3DNodeTransformPatch): boolean {
    const document = this.editableDocument()
    if (document === undefined) return false
    const index = document.nodes.findIndex(node => node.id === nodeId)
    const node = document.nodes[index]
    if (index < 0 || node === undefined) return false
    const transform = {
      translate: patch.translate ?? node.transform.translate,
      rotate: patch.rotate ?? node.transform.rotate,
      scale: patch.scale ?? node.transform.scale,
    }
    const nodes = document.nodes.map((entry, at) => at === index ? { ...entry, transform } : entry)
    this.editCount += 1
    this.publish({ ...this.state, document: { ...document, nodes }, dirty: true, saveStatus: this.pending !== undefined ? this.state.saveStatus : 'dirty' })
    return true
  }

  /** Draft visibility edit; same freeze rules as transforms. */
  setNodeVisibility(nodeId: string, visible: boolean): boolean {
    const document = this.editableDocument()
    if (document === undefined) return false
    const index = document.nodes.findIndex(node => node.id === nodeId)
    if (index < 0) return false
    const nodes = document.nodes.map((entry, at) => at === index ? { ...entry, visible } : entry)
    this.editCount += 1
    this.publish({ ...this.state, document: { ...document, nodes }, dirty: true, saveStatus: this.pending !== undefined ? this.state.saveStatus : 'dirty' })
    return true
  }

  /** Apply a timeline keyframe edit to the shot draft. Shots share the negotiated workbench save; legacy hosts cannot confirm them. */
  editShotKeyframe(shotRef: string, edit: Scene3DShotKeyframeEdit): boolean {
    if (this.disposed || this.state.status !== 'ready' || this.state.frozen) return false
    const shot = this.state.shots.find(entry => entry.shotRef === shotRef)
    if (shot === undefined) return false
    if (edit.type === 'move-keyframe') {
      if (!Number.isFinite(edit.frame)) return false
      const keyframe = shot.keyframes.find(entry => entry.id === edit.keyframeId)
      if (keyframe === undefined) return false
      const frame = Math.min(Math.max(edit.frame, shot.frameRange.start), shot.frameRange.end)
      if (frame === keyframe.frame) return false
      const shots = this.state.shots.map(entry => entry.shotRef !== shotRef ? entry : {
        ...entry,
        keyframes: entry.keyframes.map(item => item.id === edit.keyframeId ? { ...item, frame } : item),
      })
      this.editCount += 1
      this.shotsDirty = true
      this.publish({ ...this.state, shots, dirty: true, saveStatus: this.pending !== undefined ? this.state.saveStatus : 'dirty' })
      return true
    }
    return false
  }

  /** Save the current scene draft against its base revision. Never retried automatically. */
  async save(): Promise<void> {
    const document = this.state.document
    if (this.disposed || !this.state.dirty || document === undefined || this.pending !== undefined || this.state.frozen) return
    if (this.shotsDirty && !this.canPersistShots) { this.publish({ ...this.state, saveStatus: 'error' }); return }
    const pending: PendingSave = { request: { requestId: this.newId(), document }, baseVersion: document.version, editCount: this.editCount, ...(this.canPersistShots ? { shots: structuredClone([...this.state.shots]) } : {}) }
    this.pending = pending
    this.publish({ ...this.state, saveStatus: 'saving' })
    try {
      this.acceptSaveResult(await (pending.shots ? this.remote.saveSceneWorkbench!({ ...pending.request, shots: pending.shots }) : this.remote.saveScene(pending.request)), pending)
    } catch {
      if (this.pending === pending && !this.disposed) this.publish({ ...this.state, saveStatus: 'unknown' })
    }
  }

  private reconcileRequest(pending: PendingSave): Scene3DReconcileRequest {
    return { ...this.target, requestId: pending.request.requestId }
  }

  /** Settle an unknown save through the owner reconcile channel; the only retry-like entry. */
  async reconcile(): Promise<void> {
    const pending = this.pending
    if (pending === undefined || this.state.saveStatus === 'saving' || this.disposed) return
    this.publish({ ...this.state, saveStatus: 'saving' })
    try {
      this.acceptSaveResult(await this.remote.reconcileScene(this.reconcileRequest(pending)), pending, true)
    } catch {
      if (!this.disposed) this.publish({ ...this.state, saveStatus: 'unknown' })
    }
  }

  private acceptSaveResult(raw: unknown, pending: PendingSave, reconciling = false): void {
    if (this.disposed || this.pending !== pending) return
    const result = SceneGraphSaveResultSchema.safeParse(raw)
    // Anything unparseable can never be claimed as a confirmed write.
    if (!result.success) {
      this.publish({ ...this.state, saveStatus: 'unknown' })
      return
    }
    const receipt = result.data
    if (receipt.status === 'not_applied') {
      if (receipt.requestId !== pending.request.requestId) {
        this.publish({ ...this.state, saveStatus: 'unknown' })
        return
      }
      this.pending = undefined
      this.publish({ ...this.state, saveStatus: 'dirty' })
      return
    }
    if (receipt.status === 'saved') {
      const document = this.state.document
      if (receipt.requestId !== pending.request.requestId || receipt.version !== pending.baseVersion + 1 || document === undefined) {
        this.publish({ ...this.state, saveStatus: 'unknown' })
        return
      }
      // Only the acknowledged snapshot advances; edits made during the flight stay dirty.
      const dirty = document.version !== pending.baseVersion || this.editCount !== pending.editCount
      this.pending = undefined
      if (pending.shots) this.shotsPersisted = true
      if (!dirty && pending.shots) this.shotsDirty = false
      this.editCount = dirty ? this.editCount : 0
      this.publish({ ...this.state, document: { ...document, version: receipt.version }, dirty, saveStatus: dirty ? 'dirty' : 'clean' })
      return
    }
    if (receipt.status === 'conflict') {
      this.pending = undefined
      const localBaseVersion = pending.baseVersion
      const pendingEditCount = this.editCount
      const summary = `Local draft is based on revision ${localBaseVersion} with ${pendingEditCount} unconfirmed edit${pendingEditCount === 1 ? '' : 's'}; the owner confirmed revision ${receipt.version}. Writes are frozen until you reconcile.`
      this.publish({
        ...this.state,
        saveStatus: 'conflict',
        frozen: true,
        conflict: { localBaseVersion, remoteVersion: receipt.version, pendingEditCount, summary },
      })
      return
    }
    if (receipt.status === 'unknown' || reconciling) {
      this.publish({ ...this.state, saveStatus: 'unknown' })
      return
    }
    // unavailable / forbidden / invalid: the host rejected before any write could land.
    this.pending = undefined
    this.publish({ ...this.state, saveStatus: 'error' })
  }

  /**
   * Conflict resolution keeps the local draft by default: `reapply` rebases it
   * onto the owner-confirmed revision, `discard` reloads the owner truth.
   */
  resolveConflict(action: 'reapply' | 'discard'): void {
    if (this.disposed || this.state.saveStatus !== 'conflict' || this.state.conflict === undefined) return
    if (action === 'discard') {
      this.editCount = 0
      // Bypass the dirty guard: the user explicitly dropped the local draft.
      this.pending = undefined
      this.shotsDirty = false
      this.publish({ ...this.state, status: 'loading', dirty: false, frozen: false, saveStatus: 'clean', conflict: undefined })
      void this.load()
      return
    }
    const document = this.state.document
    const remoteVersion = this.state.conflict.remoteVersion
    if (document === undefined || remoteVersion <= document.version) return
    this.publish({
      ...this.state,
      document: { ...document, version: remoteVersion },
      dirty: true,
      frozen: false,
      saveStatus: 'dirty',
      conflict: undefined,
    })
  }

  /** Export the committed scene as GLB; capability gaps block and explain, never silently drop. */
  async exportScene(): Promise<void> {
    const document = this.state.document
    if (this.disposed || document === undefined || this.state.frozen || this.state.export.status === 'exporting') return
    const report = document.capabilityReport
    if (!report.export.ready) {
      this.publish({ ...this.state, export: { status: 'blocked', reason: 'Export is blocked by capability gaps; nothing was discarded.', gaps: report.export.gaps } })
      return
    }
    this.publish({ ...this.state, export: { status: 'exporting' } })
    let raw: unknown
    try {
      raw = await this.remote.exportGlb(this.target)
    } catch {
      if (!this.disposed) this.publish({ ...this.state, export: { status: 'failed', reason: 'The export channel failed; nothing was exported.' } })
      return
    }
    if (this.disposed) return
    this.acceptExportResult(raw)
  }

  private acceptExportResult(raw: unknown): void {
    if (typeof raw !== 'object' || raw === null) {
      this.publish({ ...this.state, export: { status: 'failed', reason: 'The export result failed the contract.' } })
      return
    }
    const value = raw as Record<string, unknown>
    if (value.status === 'exported') {
      if (typeof value.bytesBase64 !== 'string' || typeof value.size !== 'number') {
        this.publish({ ...this.state, export: { status: 'failed', reason: 'The export payload failed the contract.' } })
        return
      }
      let report: GltfCapabilityReportV1
      try {
        report = parseGltfCapabilityReport(value.report)
      } catch {
        this.publish({ ...this.state, export: { status: 'failed', reason: 'The export capability report failed the contract.' } })
        return
      }
      this.onExportBytes?.(value.bytesBase64, report)
      this.publish({ ...this.state, export: { status: 'exported', size: value.size, mediaType: 'model/gltf-binary' } })
      return
    }
    if (value.status === 'capability_blocked') {
      const gaps: GltfCapabilityGapV1[] = []
      if (!Array.isArray(value.gaps)) {
        this.publish({ ...this.state, export: { status: 'failed', reason: 'The export blocker failed the contract.' } })
        return
      }
      for (const entry of value.gaps) {
        const parsed = GltfCapabilityGapSchema.safeParse(entry)
        if (!parsed.success) {
          this.publish({ ...this.state, export: { status: 'failed', reason: 'The export blocker failed the contract.' } })
          return
        }
        gaps.push(parsed.data)
      }
      const reason = typeof value.reason === 'string' ? boundedReason(value.reason) : 'Export is blocked by capability gaps.'
      this.publish({ ...this.state, export: { status: 'blocked', reason, gaps } })
      return
    }
    const reason = typeof value.reason === 'string' ? boundedReason(value.reason) : `export_${typeof value.status === 'string' ? value.status : 'error'}`
    this.publish({ ...this.state, export: { status: 'failed', reason } })
  }

  /**
   * Import a GLB through the host byte source; the client only passes the
   * opaque source ref. An imported document becomes the local version-0 draft.
   */
  async importGlb(sourceRef: string, documentId?: string): Promise<Scene3DImportOutcome> {
    if (this.disposed || this.state.frozen) return { status: 'failed', reason: 'The workbench is read-only right now.' }
    let raw: unknown
    try {
      raw = await this.remote.importGlb({ scope: this.target.scope, sourceRef, ...(documentId === undefined ? {} : { documentId }) })
    } catch {
      return { status: 'failed', reason: 'The import channel failed; nothing was imported.' }
    }
    if (this.disposed) return { status: 'failed', reason: 'The workbench was closed during import.' }
    if (typeof raw !== 'object' || raw === null) return { status: 'failed', reason: 'The import result failed the contract.' }
    const value = raw as Record<string, unknown>
    if (value.status === 'imported') {
      let document: SceneDocumentV1
      try {
        document = parseSceneDocument(value.document)
      } catch {
        return { status: 'failed', reason: 'The imported scene failed the scene document contract.' }
      }
      if (!sameTarget(document, this.target) || document.version !== 0) {
        return { status: 'failed', reason: 'The imported scene escaped the bound context.' }
      }
      const warnings = Array.isArray(value.warnings)
        ? value.warnings.filter((warning): warning is string => typeof warning === 'string').slice(0, 32).map(boundedReason)
        : []
      this.editCount = 0
      this.publish({ ...this.state, status: 'ready', document, dirty: true, saveStatus: 'dirty', conflict: undefined })
      return { status: 'imported', warnings }
    }
    const reason = typeof value.reason === 'string' ? boundedReason(value.reason) : `import_${typeof value.status === 'string' ? value.status : 'error'}`
    return { status: 'failed', reason }
  }

  /** Whether the probed host exposes the change-set review controls (preview/accept/reject/rollback). */
  get changeSetControlsAvailable(): boolean {
    return hasScene3DChangeSetControls(this.remote)
  }

  /** Read-only change-set preview; fail-closed parsed, never throws. */
  async previewChangeSet(changeSetRef: string): Promise<Scene3DChangeSetPreviewResult> {
    const unavailable = { status: 'unavailable' as const, reason: 'The host does not expose change-set controls.' }
    if (this.disposed || typeof this.remote.previewChangeSet !== 'function') return unavailable
    let raw: unknown
    try {
      raw = await this.remote.previewChangeSet({ ...this.target, changeSetRef })
    } catch {
      return { status: 'unavailable', reason: 'The change-set channel failed; nothing changed.' }
    }
    if (this.disposed || typeof raw !== 'object' || raw === null) {
      return { status: 'invalid', reason: 'The change-set preview failed the contract.' }
    }
    const value = raw as Record<string, unknown>
    if (value.status === 'ready') {
      const parsed = GenerationChangeSetSchema.safeParse(value.changeSet)
      const currentVersion = value.currentVersion
      if (!parsed.success || typeof currentVersion !== 'number' || !Number.isSafeInteger(currentVersion) || currentVersion < 0
        || typeof value.baseRevisionRetained !== 'boolean') {
        return { status: 'invalid', reason: 'The change-set preview failed the contract.' }
      }
      return { status: 'ready', changeSet: parsed.data, currentVersion, baseRevisionRetained: value.baseRevisionRetained }
    }
    if (value.status === 'missing') return { status: 'missing', reason: 'The change set is no longer listed by the owner.' }
    if (value.status === 'forbidden') return { status: 'forbidden', reason: 'The owner rejected this context.' }
    if (value.status === 'unavailable') return { status: 'unavailable', reason: typeof value.reason === 'string' ? boundedReason(value.reason) : 'The change-set log is unavailable.' }
    return { status: 'invalid', reason: 'The change-set preview failed the contract.' }
  }

  /**
   * Accept a pending/preview change set: the current local draft is committed
   * as its resulting revision through the conflict-fenced save. The generation
   * owner must have recorded an artifact ref; a conflict freezes writes with
   * the same semantics as a draft save.
   */
  async acceptChangeSet(changeSetRef: string): Promise<Scene3DChangeSetActionOutcome> {
    if (this.shotsDirty) return { status: 'failed', reason: 'Save previsualization edits before accepting a generation change set.' }
    const acceptedEditCount = this.editCount
    const failure = this.changeSetMutationBlock('accept')
    if (failure !== undefined) return { status: 'failed', reason: failure }
    const document = this.state.document
    const changeSet = this.state.changeSets.find(entry => entry.changeSetRef === changeSetRef)
    if (document === undefined || changeSet === undefined) return { status: 'failed', reason: 'The change set is not listed; refresh and try again.' }
    if (changeSet.artifactRef === undefined) {
      return { status: 'failed', reason: 'The generation owner recorded no artifact ref for this change set.' }
    }
    let raw: unknown
    try {
      raw = await this.remote.acceptChangeSet!({
        ...this.target, changeSetRef, requestId: this.newId(), document, artifactRef: changeSet.artifactRef,
      })
    } catch {
      return { status: 'failed', reason: 'The change-set channel failed; nothing was accepted.' }
    }
    if (this.disposed) return { status: 'failed', reason: 'The workbench was closed during accept.' }
    const value = asRecord(raw)
    if (value === undefined) return { status: 'failed', reason: 'The accept result failed the contract.' }
    if (value.status === 'accepted') {
      const version = value.version
      const parsed = GenerationChangeSetSchema.safeParse(value.changeSet)
      if (typeof version !== 'number' || version !== document.version + 1 || !parsed.success) {
        this.publish({ ...this.state, saveStatus: 'unknown' })
        return { status: 'failed', reason: 'The accept result failed the contract; reconcile the save state.' }
      }
      // The committed snapshot is exactly the acknowledged draft.
      const dirty = this.editCount !== acceptedEditCount
      if (!dirty) this.editCount = 0
      this.publish({ ...this.state, document: { ...(this.state.document ?? document), version }, dirty, saveStatus: dirty ? 'dirty' : 'clean' })
      await this.refreshChangeSets()
      return { status: 'accepted', version }
    }
    if (value.status === 'conflict' && typeof value.version === 'number') {
      const localBaseVersion = document.version
      const pendingEditCount = this.editCount
      const summary = `Local draft is based on revision ${localBaseVersion} with ${pendingEditCount} unconfirmed edit${pendingEditCount === 1 ? '' : 's'}; the owner confirmed revision ${value.version}. Writes are frozen until you reconcile.`
      this.pending = undefined
      this.publish({
        ...this.state,
        saveStatus: 'conflict',
        frozen: true,
        conflict: { localBaseVersion, remoteVersion: value.version, pendingEditCount, summary },
      })
      return { status: 'conflict', version: value.version }
    }
    return { status: 'failed', reason: changeSetFailureReason(value, 'accept') }
  }

  /** Reject a pending/preview change set; the audited record stays, stamped rejected. */
  async rejectChangeSet(changeSetRef: string, reason?: string): Promise<Scene3DChangeSetActionOutcome> {
    if (this.disposed) return { status: 'failed', reason: 'The workbench is closed.' }
    if (typeof this.remote.rejectChangeSet !== 'function') {
      return { status: 'failed', reason: 'The host does not expose change-set controls.' }
    }
    let raw: unknown
    try {
      raw = await this.remote.rejectChangeSet({ ...this.target, changeSetRef, ...(reason === undefined ? {} : { reason }) })
    } catch {
      return { status: 'failed', reason: 'The change-set channel failed; nothing was rejected.' }
    }
    if (this.disposed) return { status: 'failed', reason: 'The workbench was closed during reject.' }
    const value = asRecord(raw)
    if (value === undefined) return { status: 'failed', reason: 'The reject result failed the contract.' }
    if (value.status === 'updated') {
      if (!GenerationChangeSetSchema.safeParse(value.changeSet).success) {
        return { status: 'failed', reason: 'The reject result failed the contract.' }
      }
      await this.refreshChangeSets()
      return { status: 'rejected' }
    }
    return { status: 'failed', reason: changeSetFailureReason(value, 'reject') }
  }

  /**
   * Roll back an accepted change set. The owner re-commits the retained prior
   * revision as a new version; on success the panel reloads the owner truth.
   * Refused while a local draft is dirty or writes are frozen — the local draft
   * is never silently dropped.
   */
  async rollbackChangeSet(changeSetRef: string): Promise<Scene3DChangeSetActionOutcome> {
    const failure = this.changeSetMutationBlock('rollback')
    if (failure !== undefined) return { status: 'failed', reason: failure }
    if (this.state.dirty) return { status: 'failed', reason: 'Save or discard the local draft before rolling back; the draft is never dropped silently.' }
    let raw: unknown
    try {
      raw = await this.remote.rollbackChangeSet!({ ...this.target, changeSetRef, requestId: this.newId() })
    } catch {
      return { status: 'failed', reason: 'The change-set channel failed; nothing was rolled back.' }
    }
    if (this.disposed) return { status: 'failed', reason: 'The workbench was closed during rollback.' }
    const value = asRecord(raw)
    if (value === undefined) return { status: 'failed', reason: 'The rollback result failed the contract.' }
    if (value.status === 'rolled_back') {
      const version = value.version
      if (typeof version !== 'number' || !Number.isSafeInteger(version) || !GenerationChangeSetSchema.safeParse(value.changeSet).success) {
        return { status: 'failed', reason: 'The rollback result failed the contract.' }
      }
      // The scene moved owner-side; reload the confirmed truth before further edits.
      this.editCount = 0
      this.publish({ ...this.state, status: 'loading', dirty: false, saveStatus: 'clean', conflict: undefined })
      await this.load()
      await this.refreshChangeSets()
      return { status: 'rolled_back', version }
    }
    if (value.status === 'conflict' && typeof value.version === 'number') {
      return { status: 'conflict', version: value.version }
    }
    return { status: 'failed', reason: changeSetFailureReason(value, 'rollback') }
  }

  /** Shared mutation gate for accept/rollback: frozen, unsaved-ready, and seam presence. */
  private changeSetMutationBlock(action: 'accept' | 'rollback'): string | undefined {
    if (this.disposed) return 'The workbench is closed.'
    if (this.state.frozen) return 'Writes are frozen until the revision conflict is reconciled.'
    if (this.state.status !== 'ready' || this.state.document === undefined) return 'No scene is loaded.'
    if (this.state.saveStatus === 'saving') return 'A save is in flight; wait for it to settle.'
    if (action === 'accept' && typeof this.remote.acceptChangeSet !== 'function') return 'The host does not expose change-set controls.'
    if (action === 'rollback' && typeof this.remote.rollbackChangeSet !== 'function') return 'The host does not expose change-set controls.'
    return undefined
  }

  /** Refresh the append-only generation change sets; any contract violation degrades the listing. */
  async refreshChangeSets(): Promise<void> {
    if (this.disposed) return
    let raw: unknown
    try {
      raw = await this.remote.listChangeSets(this.target)
    } catch {
      if (!this.disposed) this.publish({ ...this.state, changeSetsStatus: 'unavailable' })
      return
    }
    if (this.disposed) return
    if (typeof raw !== 'object' || raw === null || (raw as Record<string, unknown>).status !== 'ready') {
      this.publish({ ...this.state, changeSetsStatus: 'unavailable' })
      return
    }
    const entries = (raw as Record<string, unknown>).changeSets
    const changeSets: GenerationChangeSetV1[] = []
    if (!Array.isArray(entries)) {
      this.publish({ ...this.state, changeSetsStatus: 'unavailable' })
      return
    }
    for (const entry of entries) {
      const parsed = GenerationChangeSetSchema.safeParse(entry)
      if (!parsed.success) {
        this.publish({ ...this.state, changeSetsStatus: 'unavailable', changeSets: [] })
        return
      }
      changeSets.push(parsed.data)
    }
    this.publish({ ...this.state, changeSets, changeSetsStatus: 'ready' })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.generation += 1
    this.listeners.clear()
  }
}
