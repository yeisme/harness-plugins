/**
 * Pipeline workbench composition controller (dsh-creative-pipeline-visual-workbench-v1, D6).
 *
 * Owns the vertical-slice wiring between the frozen D1 contracts and the D2–D4
 * components:
 * - capsule Agent ⇄ Workbench switching is local surface state only; it never
 *   resets projectRef, edge selection, run projections, or permissions;
 * - edge selection → `buildPipelineInspectorViewModel` with the pane-protocol
 *   run projection (transport shape) plus the richer SDK run detail;
 * - pause/resume/reconcile go through the injected host action channel only;
 *   when the channel is missing every run action is disabled with a reason and
 *   nothing is executed locally — no retry, no writer replacement;
 * - media drop intents become canvas asset-node draft intents on the embedded
 *   ProjectCanvas draft (a local UI draft transition, never an owner write);
 * - late async results are fenced by projectRef + generation;
 * - dispose is symmetric and idempotent (subscriptions, canvas controller,
 *   tracked media resolutions).
 *
 * The snapshot envelope is decoded fail-closed: a contract violation with no
 * previously decoded data degrades the whole workbench to a disabled/error
 * state with a bounded reason; once a good projection is on screen, a failed
 * refresh keeps the graph and canvas drafts and shows a compact error strip.
 * The envelope schema id below is the NEUTRAL snapshot contract name shared
 * by any projection owner (fixture or real); fixture identity is carried by
 * the `creativePipelineFixture` service key and the fixture exports, never
 * by this schema value, so a real owner can pass the same fail-closed gate.
 */

import {
  decodeCreativePipelineEdgeProjectionV1,
  decodeCreativePipelineNodeProjectionV1,
  decodeCreativePipelineRunProjectionV1,
  decodeWorkSurfaceCapsuleV1,
  type CreativePipelineEdgeProjectionV1,
  type CreativePipelineNodeProjectionV1,
  type CreativePipelineRunActionKindV1,
  type CreativePipelineRunProjectionV1,
  type CreativeWorkSurfaceKindV1,
  type WorkSurfaceCapsuleV1,
} from '@yeisme/dsh-plugin-contracts'
import {
  CanvasBindingSchema,
  PipelineRunProjectionSchema,
  ProjectCanvasDocumentSchema,
  ShotSchema,
  type CanvasBindingV1,
  type PipelineRunProjectionV1,
  type ShotV1,
} from '@yeisme/dsh-pane-protocol'
import type { ProjectCanvasScope } from '@yeisme/dsh-pane-protocol'
import { ProjectCanvasController } from '@yeisme/dsh-client-ui-pane-domain'
import {
  Scene3DController,
  SCENE_3D_PROBE_REASONS,
  type Scene3DDirectorRemote,
  type Scene3DLoadStatus,
  type Scene3DSaveStatus,
  type Scene3DViewState,
} from '@yeisme/dsh-client-ui-3d-director'
import { buildPipelineInspectorViewModel, PIPELINE_RUN_MUTATION_BLOCKED_STATUSES, type PipelineConfirmationRecordV1, type PipelineInspectorViewModelV1 } from './inspector-state.js'
import {
  createMediaAccessResolver,
  validatePipelineMediaRef,
  type PipelineMediaAccessResolver,
  type PipelineMediaEntry,
  type PipelineMediaResolution,
  type PipelineMediaResolveFn,
} from './media.js'
import type { PipelineAssetNodeIntentV1, PipelineMediaDragPosition } from './media-drag.js'
import { findScene3DBindingForCanvasNode, findScene3DBindingForSceneObject } from './scene-3d.js'
import {
  PaneLinkSequenceGate,
  decodePipelineCandidateAdoption,
  decodePipelinePaneSelectionHandoff,
  type PipelineCandidateAdoptionV1,
  type PipelinePaneLinkOutcome,
  type PipelinePaneSelectionHandoffV1,
} from './pane-selection.js'
import type {
  BottomRunStripProps,
  PipelineObjectListItem,
  PipelineProjectOption,
  PipelineRunStripEntry,
} from './types.js'

/** Neutral snapshot envelope schema id accepted by the fail-closed decoder; owner-agnostic (fixture or real). */
export const PIPELINE_WORKBENCH_SNAPSHOT_SCHEMA = 'dsh.creative-pipeline-workbench-snapshot.v1alpha1' as const

export interface PipelineWorkbenchRunActionRequestV1 {
  readonly schema: 'dsh.creative-pipeline-run-action.v1'
  readonly action: CreativePipelineRunActionKindV1
  readonly runRef: string
  readonly projectRef: string
  readonly generation: number
}

/** Structural alias: ui-pane-domain does not export ProjectCanvasRemote from its package entry. */
export type PipelineCanvasRemote = ConstructorParameters<typeof ProjectCanvasController>[0]

/**
 * Pipeline projection source. `dispatchRunAction` is the host action channel:
 * when absent, run controls stay disabled with a reason and the controller
 * never executes anything locally.
 *
 * Observation seam (R7, aligned with DomainOwnerEventTransport semantics):
 * `subscribe`/`onUnavailable`/`onAvailable` are owner-driven signals only —
 * never timer polling. A push or a channel recovery triggers exactly one
 * projection re-read; a disconnect only degrades the view (the last safe
 * projection stays on screen) and is never retried automatically.
 */
export interface PipelineWorkbenchOwnerFaceV1 {
  snapshot(): Promise<unknown>
  dispatchRunAction?(input: PipelineWorkbenchRunActionRequestV1): Promise<unknown>
  resolveMedia?: PipelineMediaResolveFn
  canvasRemote?: PipelineCanvasRemote
  canvasScope?: ProjectCanvasScope
  canvasDocumentId?: string
  /** Owner push signal: the projection may have changed; re-read once. */
  subscribe?(listener: () => void): () => void
  /** Channel lost: degrade only, keep the last safe projection, never retry. */
  onUnavailable?(listener: () => void): () => void
  /** Channel recovered: re-read the authoritative snapshot exactly once. */
  onAvailable?(listener: () => void): () => void
  /**
   * Optional `scene3dDirector` host remote for the embedded Shot-anchored 3D
   * viewport. Absent → the Inspector 3D entry stays disabled with the probe
   * reason; nothing is fabricated locally.
   */
  scene3dRemote?: Scene3DDirectorRemote
}

/** Root-level availability the owner projects next to the decoded collections. */
export interface PipelineWorkbenchAvailabilityV1 {
  readonly canvas: 'ready' | 'missing'
  readonly runs: 'ready' | 'needs_contract' | 'contract_mismatch'
}

/** Owner-declared failure statuses carried by a data-less degrade envelope. */
export type PipelineWorkbenchFailureStatus = 'unavailable' | 'needs_contract' | 'contract_mismatch'

/**
 * Preview/confirm record store (R6). Records are keyed by the execution edge
 * ref; the input-version dimension is carried inside the record itself, so a
 * post-preview input change derives `invalidated` instead of silently losing
 * the confirmation. Injectable; the controller default is in-memory.
 */
export interface PipelineConfirmationStoreV1 {
  get(edgeRef: string): PipelineConfirmationRecordV1 | undefined
  set(edgeRef: string, record: PipelineConfirmationRecordV1): void
}

export interface PipelineWorkbenchEdgeItemV1 {
  readonly id: string
  readonly kind: CreativePipelineEdgeProjectionV1['kind']
  readonly label: string
  readonly selected: boolean
}

export type PipelineWorkbenchPhase = 'loading' | 'ready' | 'disabled' | 'error'

/** Shot node currently selected on the pipeline canvas, resolved to its owner ref + bound scene object. */
export interface PipelineSelectedShotV1 {
  readonly nodeId: string
  readonly shotRef: string
  readonly title: string
  /** Bound scene object from the owner-projected CanvasBindingV1 set, when one exists. */
  readonly sceneObjectRef?: string
}

/** Embedded 3D viewport state (priority 6): probe-first availability, open flag, and the lazy scene controller. */
export interface PipelineScene3DViewV1 {
  /** True when the remote seam AND the owner scene binding both probe; otherwise `reason` explains the disabled entry. */
  readonly available: boolean
  readonly reason?: string
  readonly open: boolean
  readonly documentId?: string
  readonly loadStatus?: Scene3DLoadStatus
  readonly saveStatus?: Scene3DSaveStatus
  /** Read-only freeze (revision conflict) projected from the scene controller. */
  readonly frozen?: boolean
  /** Present once the viewport was opened at least once; kept alive across close to preserve local drafts. */
  readonly controller?: Scene3DController
}

/** Last professional-pane selection handoff applied by stable ref (task 3.2). */
export interface PipelinePaneSelectionStateV1 {
  readonly source: PipelinePaneSelectionHandoffV1['source']
  readonly kind: PipelinePaneSelectionHandoffV1['selection']['kind']
  readonly ref: string
}

/** One applied candidate adoption, keyed by the candidate's fixed ref (task 3.2). */
export interface PipelineCandidateAdoptionStateV1 {
  readonly source: PipelinePaneSelectionHandoffV1['source']
  readonly candidateRef: string
  readonly adoptedVersion: string
  readonly adoptedForShotRef?: string
  readonly artifact?: PipelineCandidateAdoptionV1['artifact']
  readonly seq: number
}

export interface PipelineWorkbenchViewStateV1 {
  readonly phase: PipelineWorkbenchPhase
  /** Bounded reason for disabled/error phases, and for the last rejected intent. */
  readonly reason?: string
  readonly generation: number
  readonly projectRef?: string
  readonly project?: PipelineProjectOption
  readonly capsule?: WorkSurfaceCapsuleV1
  readonly nodes: readonly CreativePipelineNodeProjectionV1[]
  readonly edges: readonly CreativePipelineEdgeProjectionV1[]
  readonly selectedEdgeId?: string
  readonly inspector: PipelineInspectorViewModelV1
  /** Present when the host action channel is missing; run controls are force-disabled with this reason. */
  readonly actionChannelReason?: string
  /** Bounded visible notice: rejected drop reasons, channel absence, unknown settlements. */
  readonly notice?: string
  /**
   * Honest-degrade banner projected by the owner envelope (partial snapshot,
   * runs needs_contract/contract_mismatch, canvas missing) or by an offline
   * owner channel. The decoded graph stays fully rendered behind it.
   */
  readonly availabilityBanner?: string
  /**
   * Compact refresh-failure strip (R7): set when a re-read failed while an
   * earlier snapshot is still decoded — the graph and canvas drafts stay on
   * screen instead of being replaced by a full SurfaceState.
   */
  readonly errorStrip?: string
  readonly edgeItems: readonly PipelineWorkbenchEdgeItemV1[]
  readonly objects: readonly PipelineObjectListItem[]
  readonly runStrip: BottomRunStripProps
  readonly canvas?: ProjectCanvasController
  /** Media access resolver; release is owned by the controller dispose. */
  readonly mediaResolver: PipelineMediaAccessResolver
  /** Shot node selection (canvas id + owner shot ref) when the current canvas selection is a shot node. */
  readonly selectedShot?: PipelineSelectedShotV1
  /** Embedded 3D viewport state; `available === false` always carries a bounded reason. */
  readonly scene3d: PipelineScene3DViewV1
  /** Last professional-pane selection handoff applied by stable object ref. */
  readonly paneSelection?: PipelinePaneSelectionStateV1
  /** Candidate adoptions backfilled into this envelope, keyed by fixed candidate ref. */
  readonly candidateAdoptions: readonly PipelineCandidateAdoptionStateV1[]
}

export const PIPELINE_WORKBENCH_NO_CHANNEL_REASON =
  'Host action channel is unavailable; run controls stay disabled and nothing is executed locally.'

const MAX_STRIP_TEXT = 160
const MAX_OBJECT_TITLE = 80
const DROPPED_ASSET_SIZE = { width: 240, height: 160 } as const
/** Pane-link clock skew tolerance: a source far in the future is dropped, not clamped. */
const PIPELINE_PANE_LINK_CLOCK_SKEW_MS = 10 * 60 * 1000
/** Bounded adoption registry: beyond this, the oldest adoption is evicted. */
const MAX_CANDIDATE_ADOPTIONS = 64

export const PIPELINE_SCENE_3D_NO_PROJECTION_REASON =
  'The pipeline owner did not project a 3D scene binding for this shot.'
export const PIPELINE_SCENE_3D_NO_SCOPE_REASON =
  'The pipeline owner did not project a scene scope; the 3D viewport stays disabled.'

/** Owner-projected 3D scene attachment (priority 6): which scene document plus its Shot/CanvasBinding projections. */
interface DecodedScene3DV1 {
  readonly documentId: string
  readonly shots: readonly ShotV1[]
  readonly bindings: readonly CanvasBindingV1[]
}

interface DecodedSnapshotV1 {
  readonly project: PipelineProjectOption
  readonly capsule: WorkSurfaceCapsuleV1
  readonly nodes: readonly CreativePipelineNodeProjectionV1[]
  readonly edges: readonly CreativePipelineEdgeProjectionV1[]
  readonly runs: ReadonlyMap<string, CreativePipelineRunProjectionV1>
  readonly runProjections: ReadonlyMap<string, PipelineRunProjectionV1>
  /** Owner-declared snapshot status; fixture envelopes without the field count as ready. */
  readonly status: 'ready' | 'partial'
  readonly availability?: PipelineWorkbenchAvailabilityV1
  /** Canvas binding projected by the real owner envelope; the lazy canvas controller is keyed from it. */
  readonly canvasScope?: ProjectCanvasScope
  readonly canvasDocumentId?: string
  /** Owner-projected 3D scene attachment; absent when the owner does not project one. */
  readonly scene3d?: DecodedScene3DV1
  /** Bounded reason when the envelope carried a `scene3d` section that failed the contract (adjunct fail-closed). */
  readonly scene3dReason?: string
}

type SnapshotDecodeResult =
  | { readonly ok: true; readonly value: DecodedSnapshotV1 }
  | { readonly ok: false; readonly reason: string; readonly failureStatus?: PipelineWorkbenchFailureStatus }

function bounded(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

/** Fail-closed envelope decode: any bad item fails the whole snapshot. */
export function decodePipelineWorkbenchSnapshotV1(input: unknown): SnapshotDecodeResult {
  const invalid = (reason: string, failureStatus?: PipelineWorkbenchFailureStatus): SnapshotDecodeResult =>
    failureStatus === undefined ? { ok: false, reason } : { ok: false, reason, failureStatus }
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return invalid('pipeline snapshot must be an object')
  const value = input as Record<string, unknown>
  if (value.schema !== PIPELINE_WORKBENCH_SNAPSHOT_SCHEMA) return invalid('pipeline snapshot schema is not supported')
  // Data-less degrade envelope (real owner fail-closed path): the declared
  // failure status drives the SurfaceState mapping; safeMessage is the bounded
  // owner-authored reason. Nothing is decoded past this point.
  if (value.status === 'unavailable' || value.status === 'needs_contract' || value.status === 'contract_mismatch') {
    const safeMessage = typeof value.safeMessage === 'string' && value.safeMessage.length > 0
      ? bounded(value.safeMessage, MAX_STRIP_TEXT)
      : `Pipeline projection is ${value.status}.`
    return invalid(safeMessage, value.status)
  }
  if (value.status !== undefined && value.status !== 'ready' && value.status !== 'partial') {
    return invalid('pipeline snapshot status is not supported')
  }
  const projectInput = typeof value.project === 'object' && value.project !== null ? value.project as Record<string, unknown> : undefined
  if (projectInput === undefined || typeof projectInput.label !== 'string' || projectInput.label.length === 0) {
    return invalid('pipeline snapshot project is missing')
  }
  let projectRef: string
  try {
    projectRef = validatePipelineMediaRef(projectInput.ref, 'snapshot.project.ref')
  } catch (error) {
    return invalid(error instanceof Error ? error.message : 'snapshot.project.ref is not a safe opaque ref')
  }

  const capsule = decodeWorkSurfaceCapsuleV1(value.capsule)
  if (!capsule.ok) return invalid(`${capsule.code}: ${capsule.reason}`)
  if (capsule.value.project_ref !== projectRef) return invalid('capsule project_ref does not match the snapshot project')

  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges) || !Array.isArray(value.runs) || !Array.isArray(value.runProjections)) {
    return invalid('pipeline snapshot collections must be arrays')
  }
  const nodes: CreativePipelineNodeProjectionV1[] = []
  for (const item of value.nodes) {
    const decoded = decodeCreativePipelineNodeProjectionV1(item)
    if (!decoded.ok) return invalid(`${decoded.code}: ${decoded.reason}`)
    nodes.push(decoded.value)
  }
  const edges: CreativePipelineEdgeProjectionV1[] = []
  for (const item of value.edges) {
    const decoded = decodeCreativePipelineEdgeProjectionV1(item)
    if (!decoded.ok) return invalid(`${decoded.code}: ${decoded.reason}`)
    edges.push(decoded.value)
  }
  const runs = new Map<string, CreativePipelineRunProjectionV1>()
  for (const item of value.runs) {
    const decoded = decodeCreativePipelineRunProjectionV1(item)
    if (!decoded.ok) return invalid(`${decoded.code}: ${decoded.reason}`)
    runs.set(decoded.value.run_ref, decoded.value)
  }
  const runProjections = new Map<string, PipelineRunProjectionV1>()
  for (const item of value.runProjections) {
    const parsed = PipelineRunProjectionSchema.safeParse(item)
    if (!parsed.success) return invalid('pipeline run projection failed the transport schema')
    runProjections.set(parsed.data.executionEdgeRef, parsed.data)
  }

  let availability: PipelineWorkbenchAvailabilityV1 | undefined
  if (value.availability !== undefined) {
    if (typeof value.availability !== 'object' || value.availability === null || Array.isArray(value.availability)) {
      return invalid('pipeline snapshot availability is not supported')
    }
    const raw = value.availability as Record<string, unknown>
    const canvasOk = raw.canvas === 'ready' || raw.canvas === 'missing'
    const runsOk = raw.runs === 'ready' || raw.runs === 'needs_contract' || raw.runs === 'contract_mismatch'
    if (!canvasOk || !runsOk) {
      return invalid('pipeline snapshot availability is not supported')
    }
    availability = { canvas: raw.canvas as 'ready' | 'missing', runs: raw.runs as 'ready' | 'needs_contract' | 'contract_mismatch' }
  }

  let canvasScope: ProjectCanvasScope | undefined
  let canvasDocumentId: string | undefined
  if (value.canvas !== undefined) {
    const canvas = ProjectCanvasDocumentSchema.safeParse(value.canvas)
    if (!canvas.success) return invalid('pipeline canvas document failed the transport schema', 'contract_mismatch')
    if (canvas.data.scope.projectRef !== projectRef) {
      return invalid('pipeline canvas scope does not match the snapshot project', 'contract_mismatch')
    }
    canvasScope = canvas.data.scope
    canvasDocumentId = canvas.data.id
  }

  let scene3d: DecodedScene3DV1 | undefined
  let scene3dReason: string | undefined
  if (value.scene3d !== undefined) {
    const section = decodeScene3DSection(value.scene3d)
    if (section.ok) scene3d = section.value
    // Adjunct fail-closed: a broken 3D section never takes the pipeline graph
    // down; the Inspector entry degrades with the bounded reason instead.
    else scene3dReason = section.reason
  }

  return {
    ok: true,
    value: {
      project: { ref: projectRef, label: bounded(projectInput.label, MAX_OBJECT_TITLE) },
      capsule: capsule.value,
      nodes,
      edges,
      runs,
      runProjections,
      status: value.status === 'partial' ? 'partial' : 'ready',
      ...(availability === undefined ? {} : { availability }),
      ...(canvasScope === undefined || canvasDocumentId === undefined ? {} : { canvasScope, canvasDocumentId }),
      ...(scene3d === undefined ? {} : { scene3d }),
      ...(scene3dReason === undefined ? {} : { scene3dReason }),
    },
  }
}

/** Fail-closed decode of the optional `scene3d` envelope section against the frozen pane-protocol scene-3d schemas. */
function decodeScene3DSection(input: unknown): { readonly ok: true; readonly value: DecodedScene3DV1 } | { readonly ok: false; readonly reason: string } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, reason: 'pipeline scene3d section is not an object; the 3D viewport stays disabled' }
  }
  const value = input as Record<string, unknown>
  if (typeof value.documentId !== 'string' || value.documentId.length === 0) {
    return { ok: false, reason: 'pipeline scene3d section has no document id; the 3D viewport stays disabled' }
  }
  if (!Array.isArray(value.shots) || !Array.isArray(value.bindings)) {
    return { ok: false, reason: 'pipeline scene3d section collections must be arrays; the 3D viewport stays disabled' }
  }
  const shots: ShotV1[] = []
  for (const entry of value.shots) {
    const parsed = ShotSchema.safeParse(entry)
    if (!parsed.success) return { ok: false, reason: 'pipeline scene3d shot failed the transport schema; the 3D viewport stays disabled' }
    shots.push(parsed.data)
  }
  const bindings: CanvasBindingV1[] = []
  for (const entry of value.bindings) {
    const parsed = CanvasBindingSchema.safeParse(entry)
    if (!parsed.success) return { ok: false, reason: 'pipeline scene3d canvas binding failed the transport schema; the 3D viewport stays disabled' }
    bindings.push(parsed.data)
  }
  return { ok: true, value: { documentId: bounded(value.documentId, MAX_STRIP_TEXT), shots, bindings } }
}

function stripEntry(id: string, text: string, status?: string, meta?: string): PipelineRunStripEntry {
  return { id, text: bounded(text, MAX_STRIP_TEXT), ...(status === undefined ? {} : { status }), ...(meta === undefined ? {} : { meta }) }
}

export interface PipelineWorkbenchControllerDeps {
  readonly owner: PipelineWorkbenchOwnerFaceV1
  readonly newId?: () => string
  /** Preview/confirm record store (R6); defaults to an in-memory Map. */
  readonly confirmations?: PipelineConfirmationStoreV1
  /** Probed `scene3dDirector` remote; takes precedence over `owner.scene3dRemote`. */
  readonly scene3dRemote?: Scene3DDirectorRemote
}

const AVAILABILITY_RUN_REASONS: Readonly<Record<Exclude<PipelineWorkbenchAvailabilityV1['runs'], 'ready'>, string>> = {
  needs_contract: 'Run projections require the owner contract; run controls stay disabled with reasons.',
  contract_mismatch: 'Run projections failed the owner contract; showing the layout only, run controls stay disabled.',
}

const PIPELINE_OFFLINE_BANNER = 'Pipeline owner channel is offline; showing the last safe projection. No automatic retry.'
const PIPELINE_REFRESH_FAILED_STRIP = 'Pipeline owner projection refresh failed; showing the last safe projection.'

export class PipelineWorkbenchController {
  private readonly owner: PipelineWorkbenchOwnerFaceV1
  private readonly newId: () => string
  private readonly listeners = new Set<() => void>()
  private readonly mediaResolver: PipelineMediaAccessResolver
  private readonly resolutions = new Set<PipelineMediaResolution>()
  private readonly confirmations: PipelineConfirmationStoreV1
  private readonly defaultConfirmations = new Map<string, PipelineConfirmationRecordV1>()
  private canvas: ProjectCanvasController | undefined
  private canvasUnsubscribe: (() => void) | undefined
  private readonly ownerDisposers: Array<() => void> = []
  private readonly scene3dRemote: Scene3DDirectorRemote | undefined
  private scene3dController: Scene3DController | undefined
  private scene3dUnsubscribe: (() => void) | undefined
  private scene3dOpen = false
  /** Last scene node id the canvas-driven sync pushed (echo guard for pick routing). */
  private scene3dPushedNodeId: string | undefined
  /** Last scene node id observed from the scene controller (pick detection). */
  private scene3dObservedNodeId: string | undefined
  /** Per-source monotonic sequence gate for professional-pane link entries (task 3.2). */
  private readonly paneLinkSeq = new PaneLinkSequenceGate()
  /** Applied candidate adoptions keyed by the candidate's fixed ref; bounded, insertion-ordered. */
  private readonly candidateAdoptions = new Map<string, PipelineCandidateAdoptionStateV1>()
  /** Last APPLIED pane selection handoff, projected through the view state. */
  private paneSelection: PipelinePaneSelectionStateV1 | undefined

  private state: PipelineWorkbenchViewStateV1
  private decoded: DecodedSnapshotV1 | undefined
  private surfaceOverride: CreativeWorkSurfaceKindV1 | undefined
  private selectedEdgeId: string | undefined
  private selectedNodeId: string | undefined
  private notice: string | undefined
  private errorStrip: string | undefined
  private offlineBanner: string | undefined
  private generation = 0
  private disposed = false

  constructor(deps: PipelineWorkbenchControllerDeps) {
    this.owner = deps.owner
    this.newId = deps.newId ?? (() => `node-${crypto.randomUUID()}`)
    this.scene3dRemote = deps.scene3dRemote ?? deps.owner.scene3dRemote
    this.confirmations = deps.confirmations ?? {
      get: key => this.defaultConfirmations.get(key),
      set: (key, record) => { this.defaultConfirmations.set(key, record) },
    }
    this.mediaResolver = createMediaAccessResolver({
      resolve: deps.owner.resolveMedia ?? (async () => undefined),
    })
    if (deps.owner.canvasRemote !== undefined && deps.owner.canvasScope !== undefined) {
      this.startCanvas(deps.owner.canvasScope, deps.owner.canvasDocumentId ?? 'main')
    }
    // Owner-driven observation (R7): push or recovery → exactly one re-read;
    // disconnect → degrade the banner only. No timers, no automatic retry.
    if (typeof deps.owner.subscribe === 'function') {
      this.ownerDisposers.push(deps.owner.subscribe(() => { void this.load() }))
    }
    if (typeof deps.owner.onUnavailable === 'function') {
      this.ownerDisposers.push(deps.owner.onUnavailable(() => {
        if (this.disposed) return
        this.offlineBanner = PIPELINE_OFFLINE_BANNER
        this.publish(this.compose(this.state.phase))
      }))
    }
    if (typeof deps.owner.onAvailable === 'function') {
      this.ownerDisposers.push(deps.owner.onAvailable(() => {
        if (this.disposed) return
        this.offlineBanner = undefined
        void this.load()
      }))
    }
    this.state = this.compose('loading')
  }

  /** Creates the canvas controller once a binding (explicit or envelope-projected) is known. */
  private startCanvas(scope: ProjectCanvasScope, documentId: string): void {
    if (this.canvas !== undefined || this.owner.canvasRemote === undefined) return
    this.canvas = new ProjectCanvasController(this.owner.canvasRemote, { scope, documentId })
    this.canvasUnsubscribe = this.canvas.subscribe(() => this.onCanvasChange())
  }

  getSnapshot = (): PipelineWorkbenchViewStateV1 => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private publish(state: PipelineWorkbenchViewStateV1): void {
    if (this.disposed) return
    this.state = state
    for (const listener of this.listeners) listener()
  }

  /** Composes the honest-degrade banner from the channel state + owner-projected availability. */
  private availabilityBanner(decoded: DecodedSnapshotV1 | undefined): string | undefined {
    const parts: string[] = []
    if (this.offlineBanner !== undefined) parts.push(this.offlineBanner)
    const availability = decoded?.availability
    if (availability !== undefined) {
      if (availability.canvas === 'missing' && this.canvas?.getSnapshot().editor === undefined) {
        parts.push('No canvas document is projected yet; the canvas region stays empty until the owner commits one.')
      }
      if (availability.runs !== 'ready') parts.push(AVAILABILITY_RUN_REASONS[availability.runs])
    }
    return parts.length === 0 ? undefined : parts.join(' ')
  }

  /** Re-derives the published view state from the decoded projection + local observer state. */
  private compose(phase: PipelineWorkbenchPhase, reason?: string): PipelineWorkbenchViewStateV1 {
    const decoded = this.decoded
    const actionChannelReason = typeof this.owner.dispatchRunAction === 'function' ? undefined : PIPELINE_WORKBENCH_NO_CHANNEL_REASON
    const banner = this.availabilityBanner(decoded)
    if (decoded === undefined) {
      return {
        phase,
        ...(reason === undefined ? {} : { reason }),
        generation: this.generation,
        nodes: [],
        edges: [],
        edgeItems: [],
        objects: [],
        inspector: { selection: 'none' },
        ...(actionChannelReason === undefined ? {} : { actionChannelReason }),
        ...(this.notice === undefined ? {} : { notice: this.notice }),
        ...(banner === undefined ? {} : { availabilityBanner: banner }),
        ...(this.errorStrip === undefined ? {} : { errorStrip: this.errorStrip }),
        runStrip: { log: [], validation: [], queue: [] },
        ...(this.canvas === undefined ? {} : { canvas: this.canvas }),
        mediaResolver: this.mediaResolver,
        scene3d: this.composeScene3D(undefined),
        ...(this.paneSelection === undefined ? {} : { paneSelection: this.paneSelection }),
        candidateAdoptions: [],
      }
    }
    const capsule: WorkSurfaceCapsuleV1 = this.surfaceOverride === undefined || this.surfaceOverride === decoded.capsule.surface
      ? decoded.capsule
      : { ...decoded.capsule, surface: this.surfaceOverride, menu: { ...decoded.capsule.menu, surface: this.surfaceOverride } }
    const nodesById = new Map(decoded.nodes.map(node => [node.id, node]))
    const edge = decoded.edges.find(item => item.id === this.selectedEdgeId)
    const runProjection = edge?.kind === 'execution' ? decoded.runProjections.get(edge.owner_projection_ref) : undefined
    const runDetail = runProjection === undefined ? undefined : decoded.runs.get(runProjection.runRef)
    const confirmation = edge?.kind === 'execution' ? this.confirmations.get(edge.id) : undefined
    let inspector = buildPipelineInspectorViewModel({
      ...(edge === undefined ? {} : { edge }),
      ...(runProjection === undefined ? {} : { run: runProjection }),
      ...(runDetail === undefined ? {} : { runDetail }),
      ...(confirmation === undefined ? {} : { confirmation }),
      nodes: nodesById,
    })
    if (inspector.selection === 'execution' && actionChannelReason !== undefined) {
      inspector = {
        ...inspector,
        actions: inspector.actions.map(action => ({ action: action.action, enabled: false, disabledReason: actionChannelReason })),
      }
    }
    const edgeItems: PipelineWorkbenchEdgeItemV1[] = decoded.edges.map(item => ({
      id: item.id,
      kind: item.kind,
      label: `${nodesById.get(item.source)?.summary.text ?? item.source} → ${nodesById.get(item.target)?.summary.text ?? item.target}`,
      selected: item.id === this.selectedEdgeId,
    }))
    const localDocument = this.canvas?.getSnapshot().editor?.document
    // Adoption backfill overlay (task 3.2): a candidate adopted in a
    // professional pane flips its object row to `adopted` with the adopted
    // fixed ref until the owner snapshot refresh carries the truth. Only rows
    // whose stable ref matches an adoption change; unrelated nodes are never
    // touched and no pane is reopened (compose is a pure re-derivation).
    const adoptionFor = (ref: string | undefined): PipelineCandidateAdoptionStateV1 | undefined =>
      ref === undefined ? undefined : this.candidateAdoptions.get(ref)
    const overlayAdoption = (item: PipelineObjectListItem, ref: string | undefined): PipelineObjectListItem => {
      const adoption = adoptionFor(ref)
      return adoption === undefined ? item : { ...item, status: 'adopted', version: adoption.adoptedVersion }
    }
    const objects: PipelineObjectListItem[] = localDocument ? localDocument.nodes.map(node => overlayAdoption({
      id: node.id, kind: node.kind, title: bounded(node.title, MAX_OBJECT_TITLE),
      // Execution status still comes only from the owner projection.
      ...(nodesById.get(node.id)?.status === undefined ? {} : { status: nodesById.get(node.id)!.status }),
      selected: node.id === this.selectedNodeId,
    }, 'domainRef' in node ? node.domainRef : undefined)) : decoded.nodes.map(node => overlayAdoption({
      id: node.id, kind: node.kind, title: bounded(node.summary.text, MAX_OBJECT_TITLE),
      status: node.status, selected: node.id === this.selectedNodeId,
    }, node.ref))
    const runStrip: BottomRunStripProps = {
      log: [...decoded.runs.values()].map(run =>
        stripEntry(run.run_ref, `Run ${run.run_ref}: ${run.state.state} — ${run.state.reason}`, run.state.state, run.revision)),
      validation: decoded.edges
        .filter((item): item is Extract<CreativePipelineEdgeProjectionV1, { kind: 'execution' }> => item.kind === 'execution' && item.draft !== undefined)
        .map(item => stripEntry(item.id, `Connection draft kept: ${item.draft!.reason}`, 'blocked')),
      queue: [...decoded.runs.values()]
        .filter(run => run.progress !== undefined)
        .map(run => stripEntry(`${run.run_ref}:progress`, `${run.run_ref} ${run.progress!.completed}/${run.progress!.total}`, run.state.state)),
    }
    const selectedShot = this.resolveSelectedShot(decoded)
    return {
      phase,
      ...(reason === undefined ? {} : { reason }),
      generation: this.generation,
      projectRef: decoded.project.ref,
      project: decoded.project,
      capsule,
      nodes: decoded.nodes,
      edges: decoded.edges,
      ...(this.selectedEdgeId === undefined ? {} : { selectedEdgeId: this.selectedEdgeId }),
      inspector,
      ...(actionChannelReason === undefined ? {} : { actionChannelReason }),
      ...(this.notice === undefined ? {} : { notice: this.notice }),
      ...(banner === undefined ? {} : { availabilityBanner: banner }),
      ...(this.errorStrip === undefined ? {} : { errorStrip: this.errorStrip }),
      edgeItems,
      objects,
      runStrip,
      ...(this.canvas === undefined ? {} : { canvas: this.canvas }),
      mediaResolver: this.mediaResolver,
      ...(selectedShot === undefined ? {} : { selectedShot }),
      scene3d: this.composeScene3D(decoded),
      ...(this.paneSelection === undefined ? {} : { paneSelection: this.paneSelection }),
      candidateAdoptions: [...this.candidateAdoptions.values()],
    }
  }

  /**
   * Resolves the current canvas selection to a pipeline shot node. The canvas
   * draft document maps node id → domainRef; pipeline projections key on the
   * same id, with the owner ref as fallback for canvas-only nodes.
   */
  private resolveSelectedShot(decoded: DecodedSnapshotV1): PipelineSelectedShotV1 | undefined {
    const selectedId = this.selectedNodeId
    if (selectedId === undefined) return undefined
    const canvasNode = this.canvas?.getSnapshot().editor?.document.nodes.find(node => node.id === selectedId)
    const domainRef = canvasNode !== undefined && 'domainRef' in canvasNode ? canvasNode.domainRef : undefined
    const pipelineNode = decoded.nodes.find(node => node.id === selectedId)
      ?? (domainRef === undefined ? undefined : decoded.nodes.find(node => node.ref === domainRef))
    if (pipelineNode === undefined || pipelineNode.kind !== 'shot') return undefined
    const sceneObjectRef = decoded.scene3d?.bindings.find(binding => binding.shotRef === pipelineNode.ref)?.sceneObjectRef
    return {
      nodeId: pipelineNode.id,
      shotRef: pipelineNode.ref,
      title: bounded(pipelineNode.summary.text, MAX_OBJECT_TITLE),
      ...(sceneObjectRef === undefined ? {} : { sceneObjectRef }),
    }
  }

  /** Bounded disabled reason for the 3D viewport entry, or undefined when both seams probe. */
  private scene3dDisabledReason(decoded: DecodedSnapshotV1 | undefined): string | undefined {
    if (decoded === undefined) return PIPELINE_SCENE_3D_NO_PROJECTION_REASON
    if (decoded.scene3dReason !== undefined) return decoded.scene3dReason
    if (decoded.scene3d === undefined) return PIPELINE_SCENE_3D_NO_PROJECTION_REASON
    if (this.scene3dRemote === undefined) return SCENE_3D_PROBE_REASONS.needsContract
    if (decoded.canvasScope === undefined && this.owner.canvasScope === undefined) return PIPELINE_SCENE_3D_NO_SCOPE_REASON
    return undefined
  }

  private composeScene3D(decoded: DecodedSnapshotV1 | undefined): PipelineScene3DViewV1 {
    const reason = this.scene3dDisabledReason(decoded)
    const controller = this.scene3dController
    const snapshot = controller?.getSnapshot()
    return {
      available: reason === undefined,
      ...(reason === undefined ? {} : { reason }),
      open: this.scene3dOpen,
      ...(decoded?.scene3d === undefined ? {} : { documentId: decoded.scene3d.documentId }),
      ...(controller === undefined ? {} : { controller }),
      ...(snapshot === undefined ? {} : { loadStatus: snapshot.status, saveStatus: snapshot.saveStatus, frozen: snapshot.frozen }),
    }
  }

  /**
   * (Re-)reads the owner projection. Late results are fenced by generation;
   * a stale read never overwrites a newer one. Never throws.
   *
   * R7: when a previous snapshot is already decoded, a failed re-read keeps
   * the graph, the selection, and canvas drafts on screen and surfaces a
   * compact error strip — the whole workbench is only replaced by a
   * SurfaceState when there is nothing decoded to show. A data-less degrade
   * envelope (needs_contract/unavailable) maps to `disabled`, a
   * contract_mismatch to `error`.
   */
  async load(): Promise<void> {
    if (this.disposed) return
    const token = ++this.generation
    this.errorStrip = undefined
    // A refresh over decoded data never blanks the graph into a loading state.
    this.publish(this.compose(this.decoded === undefined ? 'loading' : 'ready'))
    let raw: unknown
    try {
      raw = await this.owner.snapshot()
    } catch {
      if (token !== this.generation || this.disposed) return
      if (this.decoded !== undefined) {
        this.errorStrip = PIPELINE_REFRESH_FAILED_STRIP
        this.publish(this.compose('ready'))
      } else {
        this.publish(this.compose('error', 'Pipeline owner projection read failed'))
      }
      return
    }
    if (token !== this.generation || this.disposed) return
    const decoded = decodePipelineWorkbenchSnapshotV1(raw)
    if (!decoded.ok) {
      if (this.decoded !== undefined) {
        // The owner degraded after a good read: keep the last safe projection.
        this.errorStrip = bounded(decoded.reason, MAX_STRIP_TEXT)
        this.publish(this.compose('ready'))
        return
      }
      this.decoded = undefined
      this.publish(this.compose(decoded.failureStatus === 'contract_mismatch' ? 'error' : 'disabled', decoded.reason))
      return
    }
    this.decoded = decoded.value
    // Real-owner path: the canvas binding is projected inside the envelope;
    // the canvas controller starts lazily on the first snapshot that carries it.
    if (this.canvas === undefined && decoded.value.canvasScope !== undefined) {
      this.startCanvas(decoded.value.canvasScope, decoded.value.canvasDocumentId ?? 'main')
    }
    this.reconcileScene3DTarget(decoded.value)
    if (this.scene3dController !== undefined && decoded.value.scene3d !== undefined) {
      // Projection refresh revalidates fail-closed; a violation flips the scene
      // controller to `invalid`, which the viewport region renders honestly.
      this.scene3dController.setShots(decoded.value.scene3d.shots)
      this.scene3dController.setBindings(decoded.value.scene3d.bindings)
    }
    this.publish(this.compose('ready'))
    if (this.canvas !== undefined) void this.canvas.load()
  }

  /** Capsule surface switch: local surface state only — project, selection, and runs are untouched. */
  switchSurface(surface: CreativeWorkSurfaceKindV1): void {
    if (this.disposed || this.decoded === undefined) return
    this.surfaceOverride = surface
    this.publish(this.compose(this.state.phase))
  }

  /** Edge selection drives the inspector view model; passing undefined clears it. */
  selectEdge(edgeId?: string): void {
    if (this.disposed) return
    this.selectedEdgeId = edgeId
    this.publish(this.compose(this.state.phase))
  }

  /** Compact-list node selection routes through the canvas draft editor (single selection source). */
  selectObject(nodeId: string): void {
    if (this.disposed) return
    this.canvas?.edit({ type: 'select', ids: [nodeId] })
  }

  /**
   * Apply one professional-pane selection handoff (task 3.2). The selection is
   * resolved by STABLE OBJECT REF (pipeline projection ref first, then the
   * canvas draft node's domainRef/id) — never by row index. Late or duplicate
   * deliveries (per-source monotonic sequence), cross-project payloads, and
   * contract violations are dropped whole; nothing retries. An applied handoff
   * routes through the same single selection truth as a canvas click, so the
   * shot anchor and the embedded 3D viewport converge with it.
   */
  applyPaneSelectionHandoff(input: unknown): PipelinePaneLinkOutcome {
    const drop = (reason: string): PipelinePaneLinkOutcome => ({ status: 'dropped', reason })
    const decodedHandoff = decodePipelinePaneSelectionHandoff(input)
    if (!decodedHandoff.ok) return drop(decodedHandoff.reason)
    const handoff = decodedHandoff.value
    if (this.disposed) return drop('The workbench is closed.')
    const decoded = this.decoded
    if (decoded === undefined) return drop('The pipeline projection is not loaded.')
    if (handoff.projectRef !== decoded.project.ref) return drop('The pane link is for another project; it never touches this workbench.')
    if (handoff.issuedAt > Date.now() + PIPELINE_PANE_LINK_CLOCK_SKEW_MS) return drop('The pane link clock is ahead; the handoff was dropped.')
    // One ordered stream per source: a handoff that is not strictly newer than
    // the last accepted entry (selection or adoption) is late/duplicate.
    if (!this.paneLinkSeq.accept(handoff.source, handoff.seq)) return drop('Late or duplicate pane link dropped.')
    const nodeId = this.resolvePaneSelectionNodeId(handoff.selection.ref)
    if (nodeId === undefined) return drop(`No object carries the fixed ref ${bounded(handoff.selection.ref, MAX_OBJECT_TITLE)}.`)
    this.paneSelection = { source: handoff.source, kind: handoff.selection.kind, ref: handoff.selection.ref }
    // Duplicate target: applying again is idempotent — no canvas edit churn.
    if (nodeId !== this.selectedNodeId) {
      const canvas = this.canvas
      if (canvas === undefined || !canvas.edit({ type: 'select', ids: [nodeId] })) {
        // No canvas draft (the owner projected no canvas binding): keep the
        // selection truth locally and converge the embedded viewport directly.
        this.selectedNodeId = nodeId
        this.syncScene3DSelection()
      }
    }
    this.publish(this.compose(this.state.phase))
    return { status: 'applied' }
  }

  /**
   * Record one candidate adoption from a professional pane (task 3.2). The
   * adoption is keyed by the candidate's fixed ref and backfills the derived
   * object list (status `adopted` + adopted version) until the next owner
   * snapshot refresh carries the owner truth. The canvas DRAFT is never
   * rewritten: candidate version/artifact truth belongs to the owner. No pane
   * is reopened and unrelated nodes are untouched. Late/duplicate and
   * cross-project entries are dropped whole.
   */
  applyCandidateAdoption(input: unknown): PipelinePaneLinkOutcome {
    const drop = (reason: string): PipelinePaneLinkOutcome => ({ status: 'dropped', reason })
    const decodedAdoption = decodePipelineCandidateAdoption(input)
    if (!decodedAdoption.ok) return drop(decodedAdoption.reason)
    const adoption = decodedAdoption.value
    if (this.disposed) return drop('The workbench is closed.')
    const decoded = this.decoded
    if (decoded === undefined) return drop('The pipeline projection is not loaded.')
    if (adoption.projectRef !== decoded.project.ref) return drop('The pane link is for another project; it never touches this workbench.')
    if (!this.paneLinkSeq.accept(adoption.source, adoption.seq)) return drop('Late or duplicate pane link dropped.')
    // Bounded registry: the newest adoption per candidate ref wins; the oldest
    // entry is evicted when the registry is full.
    if (this.candidateAdoptions.size >= MAX_CANDIDATE_ADOPTIONS && !this.candidateAdoptions.has(adoption.candidateRef)) {
      const oldest = this.candidateAdoptions.keys().next().value
      if (oldest !== undefined) this.candidateAdoptions.delete(oldest)
    }
    this.candidateAdoptions.delete(adoption.candidateRef)
    this.candidateAdoptions.set(adoption.candidateRef, {
      source: adoption.source,
      candidateRef: adoption.candidateRef,
      adoptedVersion: adoption.adoptedVersion,
      seq: adoption.seq,
      ...(adoption.adoptedForShotRef === undefined ? {} : { adoptedForShotRef: adoption.adoptedForShotRef }),
      ...(adoption.artifact === undefined ? {} : { artifact: adoption.artifact }),
    })
    this.notice = `Candidate ${bounded(adoption.candidateRef, MAX_OBJECT_TITLE)} adopted (${bounded(adoption.adoptedVersion, MAX_OBJECT_TITLE)}).`
    this.publish(this.compose(this.state.phase))
    return { status: 'applied' }
  }

  /** Stable-ref resolution: pipeline projection ref first, then the canvas draft node's domainRef/id. */
  private resolvePaneSelectionNodeId(ref: string, depth = 0): string | undefined {
    const decoded = this.decoded
    if (decoded === undefined) return undefined
    const byProjection = decoded.nodes.find(node => node.ref === ref)
    if (byProjection !== undefined) return byProjection.id
    // A 3D Director handoff addresses the scene object: the owner-projected
    // CanvasBinding maps sceneObjectRef → the canvas node's stable ref (the
    // binding's nodeRef keys the canvas node id or its domain ref). The depth
    // guard keeps a pathological binding cycle from recursing.
    if (depth < 2) {
      const binding = decoded.scene3d?.bindings.find(entry => entry.sceneObjectRef === ref)
      if (binding !== undefined) {
        const bound = this.resolvePaneSelectionNodeId(binding.nodeRef, depth + 1)
        if (bound !== undefined) return bound
      }
    }
    const canvasNodes = this.canvas?.getSnapshot().editor?.document.nodes
    return canvasNodes?.find(node => node.id === ref || ('domainRef' in node && node.domainRef === ref))?.id
  }

  private onCanvasChange(): void {
    if (this.disposed) return
    const selection = this.canvas?.getSnapshot().editor?.selection ?? []
    const next = selection.at(-1)
    if (next === this.selectedNodeId) { this.publish(this.compose(this.state.phase)); return }
    this.selectedNodeId = next
    // Canvas → 3D: a shot selection anchors the embedded viewport (shot + bound scene object).
    this.syncScene3DSelection()
    this.publish(this.compose(this.state.phase))
  }

  /**
   * Opens the embedded Shot-anchored 3D viewport. The scene controller is
   * created lazily on first open and kept across close so local drafts
   * survive; a disabled entry (missing remote seam, missing owner projection,
   * contract violation) surfaces the bounded reason as a notice and opens
   * nothing.
   */
  openScene3DViewport(): void {
    if (this.disposed) return
    const decoded = this.decoded
    const reason = this.scene3dDisabledReason(decoded)
    if (reason !== undefined || decoded?.scene3d === undefined) {
      this.notice = reason ?? PIPELINE_SCENE_3D_NO_PROJECTION_REASON
      this.publish(this.compose(this.state.phase))
      return
    }
    if (this.scene3dController === undefined) {
      const scope = decoded.canvasScope ?? this.owner.canvasScope
      if (scope === undefined || this.scene3dRemote === undefined) return
      const controller = new Scene3DController(
        this.scene3dRemote,
        { scope, documentId: decoded.scene3d.documentId },
        { shots: decoded.scene3d.shots, bindings: decoded.scene3d.bindings },
      )
      this.scene3dController = controller
      this.scene3dUnsubscribe = controller.subscribe(() => this.onScene3DChange())
    }
    this.scene3dOpen = true
    this.syncScene3DSelection()
    this.publish(this.compose(this.state.phase))
    void this.scene3dController.load()
  }

  /** Hides the viewport region; the scene controller (and its local draft) stays alive. */
  closeScene3DViewport(): void {
    if (this.disposed || !this.scene3dOpen) return
    this.scene3dOpen = false
    this.publish(this.compose(this.state.phase))
  }

  /**
   * Project/context switch isolation: when the refreshed projection moved the
   * scene target (different document id or scope, or the owner stopped
   * projecting a 3D section), the stale scene controller is disposed and the
   * region closes. Late results from the old target stay fenced by its own
   * generation; a reopened viewport re-reads the new owner truth.
   */
  private reconcileScene3DTarget(decoded: DecodedSnapshotV1): void {
    const controller = this.scene3dController
    if (controller === undefined) return
    const section = decoded.scene3d
    const scope = decoded.canvasScope ?? this.owner.canvasScope
    const moved = section === undefined || scope === undefined
      || section.documentId !== controller.target.documentId
      || scope.workspaceRef !== controller.target.scope.workspaceRef
      || scope.projectRef !== controller.target.scope.projectRef
    if (!moved) return
    this.scene3dUnsubscribe?.()
    this.scene3dUnsubscribe = undefined
    controller.dispose()
    this.scene3dController = undefined
    this.scene3dOpen = false
    this.scene3dPushedNodeId = undefined
    this.scene3dObservedNodeId = undefined
  }

  /**
   * 3D → canvas selection: the scene node's `canvasNodeRef` (or, failing that,
   * the owner-projected CanvasBinding reverse lookup) selects the matching
   * pipeline canvas node — id first, then domainRef. Scene-only objects
   * without a back-pointer only update the 3D-side selection (silent).
   */
  selectScene3DNode(nodeId: string): void {
    if (this.disposed) return
    const scene = this.scene3dController
    if (scene === undefined) return
    if (scene.getSnapshot().selectedNodeId !== nodeId) scene.selectNode(nodeId)
    const canvas = this.canvas
    if (canvas === undefined) return
    const sceneNode = scene.getSnapshot().document?.nodes.find(node => node.id === nodeId)
    let canvasRef = sceneNode?.canvasNodeRef
    if (canvasRef === undefined && this.decoded?.scene3d !== undefined) {
      canvasRef = findScene3DBindingForSceneObject(this.decoded.scene3d.bindings, nodeId, sceneNode?.resourceRef)?.nodeRef
    }
    if (canvasRef === undefined) return
    const editor = canvas.getSnapshot().editor
    const target = editor?.document.nodes.find(node => node.id === canvasRef || ('domainRef' in node && node.domainRef === canvasRef))
    if (target === undefined || editor === undefined) return
    if (editor.selection.length === 1 && editor.selection[0] === target.id) return
    canvas.edit({ type: 'select', ids: [target.id] })
  }

  /**
   * Canvas selection → scene controller shot + bound scene object (guarded
   * against redundant publishes). Shot selections re-anchor the viewport shot;
   * bound non-shot nodes (asset/character/scene) only highlight their scene
   * object; unbound selections never touch — or clear — the scene side.
   */
  private syncScene3DSelection(): void {
    const scene = this.scene3dController
    const decoded = this.decoded
    if (scene === undefined || decoded === undefined) return
    const snapshot = scene.getSnapshot()
    const shot = this.resolveSelectedShot(decoded)
    let target: string | undefined
    if (shot !== undefined) {
      if (snapshot.selectedShotRef !== shot.shotRef) scene.selectShot(shot.shotRef)
      if (shot.sceneObjectRef !== undefined) target = this.scene3dNodeIdForRef(snapshot, shot.sceneObjectRef)
    } else if (this.selectedNodeId !== undefined && decoded.scene3d !== undefined) {
      const selectedId = this.selectedNodeId
      const pipelineNode = decoded.nodes.find(item => item.id === selectedId)
      const canvasNode = this.canvas?.getSnapshot().editor?.document.nodes.find(item => item.id === selectedId)
      const domainRef = canvasNode !== undefined && 'domainRef' in canvasNode ? canvasNode.domainRef : undefined
      const binding = findScene3DBindingForCanvasNode(decoded.scene3d.bindings, selectedId, pipelineNode?.ref ?? domainRef)
      if (binding !== undefined) target = this.scene3dNodeIdForRef(snapshot, binding.sceneObjectRef)
    }
    // Track only what THIS sync pushed; a scene selection that differs from
    // the push is a user pick and is routed back to the canvas, never clobbered.
    this.scene3dPushedNodeId = target
    if (target !== undefined && snapshot.selectedNodeId !== target) scene.selectNode(target)
  }

  /** Maps a binding sceneObjectRef to a scene node id (id first, then resourceRef); falls back to the raw ref. */
  private scene3dNodeIdForRef(snapshot: Scene3DViewState, ref: string): string {
    const document = snapshot.document
    if (document === undefined) return ref
    return document.nodes.find(node => node.id === ref || node.resourceRef === ref)?.id ?? ref
  }

  private onScene3DChange(): void {
    if (this.disposed) return
    const scene = this.scene3dController
    if (scene === undefined) return
    const picked = scene.getSnapshot().selectedNodeId
    // A selection value that is neither the last observed nor our own pushed
    // highlight is a user pick: route it to the canvas (single selection
    // truth). Anything else (push echo, document load, refresh) re-runs the
    // guarded sync so freshly loaded documents resolve pending mappings.
    const isPick = picked !== undefined && picked !== this.scene3dObservedNodeId && picked !== this.scene3dPushedNodeId
    this.scene3dObservedNodeId = picked
    if (isPick) {
      this.selectScene3DNode(picked)
    } else {
      this.syncScene3DSelection()
    }
    this.publish(this.compose(this.state.phase))
  }

  /**
   * Run action entry (pause/resume/reconcile). The request goes through the
   * host action channel only; without a channel nothing executes. Settlement
   * failures surface a bounded notice and are never retried automatically.
   * Defense-in-depth: pause/resume re-check the inspector disable matrix before
   * dispatch, so a programmatic caller bypassing the UI cannot mutate a
   * blocked/stale/unknown/needs_contract/partial or non-fresh run.
   */
  async runAction(action: CreativePipelineRunActionKindV1, runRef: string): Promise<void> {
    if (this.disposed) return
    const channel = this.owner.dispatchRunAction
    if (channel === undefined) {
      this.notice = PIPELINE_WORKBENCH_NO_CHANNEL_REASON
      this.publish(this.compose(this.state.phase))
      return
    }
    const projectRef = this.decoded?.project.ref
    if (projectRef === undefined) return
    if (action === 'pause' || action === 'resume') {
      const guardReason = this.runMutationGuardReason(runRef)
      if (guardReason !== undefined) {
        this.notice = guardReason
        this.publish(this.compose(this.state.phase))
        return
      }
    }
    const token = this.generation
    try {
      await channel({
        schema: 'dsh.creative-pipeline-run-action.v1',
        action,
        runRef,
        projectRef,
        generation: token,
      })
    } catch {
      // Late/unknown settlement on an outdated generation is dropped entirely.
      if (token !== this.generation || this.disposed || this.decoded?.project.ref !== projectRef) return
      this.notice = 'Run action settlement is unknown; no automatic retry — reconcile with the owner.'
      this.publish(this.compose(this.state.phase))
    }
  }

  /**
   * Pre-dispatch guard for pause/resume: derives the same disable matrix the
   * inspector enforces, from the decoded projection (not from UI state).
   * Returns the bounded rejection reason, or undefined when dispatch is allowed.
   */
  private runMutationGuardReason(runRef: string): string | undefined {
    const decoded = this.decoded
    if (decoded === undefined) return 'Pipeline snapshot is not loaded; run controls stay disabled.'
    const runProjection = [...decoded.runProjections.values()].find(item => item.runRef === runRef)
    if (runProjection === undefined) {
      return 'Owner run projection is unavailable; the adapter contract is required before run controls activate.'
    }
    const status = runProjection.status
    const statusReason = runProjection.blocker?.reason ?? runProjection.reason ?? `Run is ${status}.`
    if (PIPELINE_RUN_MUTATION_BLOCKED_STATUSES.includes(status)) {
      return `${statusReason} Owner reconcile is required; no automatic retry.`
    }
    if (runProjection.freshness !== 'fresh') {
      return `Run projection is ${runProjection.freshness}; reconcile before mutation.`
    }
    return undefined
  }

  /**
   * Media drop → canvas asset-node draft intent. The node is a local canvas
   * draft entry carrying only the opaque ref/kind/version; it is never an
   * owner write. The position arrives canvas-relative from the drop handler.
   */
  receiveAssetNodeIntent(intent: PipelineAssetNodeIntentV1, position: PipelineMediaDragPosition): void {
    if (this.disposed) return
    const canvas = this.canvas
    const editor = canvas?.getSnapshot().editor
    if (canvas === undefined || editor === undefined) {
      this.rejectDrop('Canvas draft is not ready; the asset node intent was not applied.')
      return
    }
    const id = this.newId()
    const accepted = canvas.edit({
      type: 'add',
      nodes: [{
        id,
        kind: 'asset',
        title: bounded(intent.ref, MAX_OBJECT_TITLE),
        position: { x: Math.round(position.x), y: Math.round(position.y) },
        size: { ...DROPPED_ASSET_SIZE },
        domainRef: intent.ref,
        version: intent.version,
        artifact: {
          schema: 'pane.artifact.v1alpha1',
          owner: 'pipeline-media',
          kind: intent.mediaKind,
          ref: intent.ref,
          version: intent.version,
          mediaType: intent.mediaKind === 'image' ? 'image/*' : 'video/*',
          title: bounded(intent.ref, MAX_OBJECT_TITLE),
          evidenceRefs: [],
          capabilities: ['preview'],
        },
      }],
    })
    this.notice = accepted
      ? `Asset node draft created for ${bounded(intent.ref, MAX_OBJECT_TITLE)}.`
      : 'Asset node intent was rejected by the canvas draft.'
    this.publish(this.compose(this.state.phase))
  }

  /**
   * Records a run preview for an execution edge (R6). The record is keyed by
   * the edge ref and carries the source input version captured at preview
   * time; a later input-version change derives `invalidated` in the inspector
   * instead of silently inheriting the old confirmation.
   */
  recordRunPreview(edgeId: string): void {
    if (this.disposed) return
    const decoded = this.decoded
    const edge = decoded?.edges.find(item => item.id === edgeId && item.kind === 'execution')
    if (decoded === undefined || edge === undefined) {
      this.notice = 'Preview requires a decoded execution edge; nothing was recorded.'
      this.publish(this.compose(this.state.phase))
      return
    }
    const inputVersion = decoded.nodes.find(node => node.id === edge.source)?.version
    if (inputVersion === undefined) {
      this.notice = 'Input version is unknown; the preview was not recorded.'
      this.publish(this.compose(this.state.phase))
      return
    }
    const existing = this.confirmations.get(edge.id)
    this.confirmations.set(edge.id, {
      previewInputVersion: inputVersion,
      // A re-preview on the same input version keeps its confirmation; a
      // preview on a new version supersedes it.
      ...(existing?.confirmedInputVersion === inputVersion ? { confirmedInputVersion: inputVersion } : {}),
    })
    this.publish(this.compose(this.state.phase))
  }

  /**
   * Confirms the recorded preview against the CURRENT input version. Confirm
   * on a drifted input is refused with a visible reason — re-preview first.
   */
  confirmRunPreview(edgeId: string): void {
    if (this.disposed) return
    const decoded = this.decoded
    const edge = decoded?.edges.find(item => item.id === edgeId && item.kind === 'execution')
    const record = this.confirmations.get(edgeId)
    const inputVersion = edge === undefined ? undefined : decoded?.nodes.find(node => node.id === edge.source)?.version
    if (edge === undefined || record?.previewInputVersion === undefined) {
      this.notice = 'No preview is recorded for this edge; preview the run before confirming.'
      this.publish(this.compose(this.state.phase))
      return
    }
    if (inputVersion === undefined || inputVersion !== record.previewInputVersion) {
      this.notice = 'Input version changed after preview; the confirmation is invalidated — re-preview required.'
      this.publish(this.compose(this.state.phase))
      return
    }
    this.confirmations.set(edge.id, { ...record, confirmedInputVersion: inputVersion })
    this.publish(this.compose(this.state.phase))
  }

  /** Rejected drops surface a bounded, visible reason in the canvas region. */
  rejectDrop(reason: string): void {
    if (this.disposed) return
    this.notice = bounded(reason, MAX_STRIP_TEXT)
    this.publish(this.compose(this.state.phase))
  }

  /** Resolves media through the tracked resolver; resolutions are released on dispose. */
  async resolveMedia(entry: PipelineMediaEntry): Promise<PipelineMediaResolution> {
    const resolution = await this.mediaResolver.resolve(entry)
    this.resolutions.add(resolution)
    return resolution
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.generation += 1
    for (const dispose of this.ownerDisposers.splice(0)) dispose()
    this.canvasUnsubscribe?.()
    this.canvasUnsubscribe = undefined
    this.canvas?.dispose()
    this.scene3dUnsubscribe?.()
    this.scene3dUnsubscribe = undefined
    this.scene3dController?.dispose()
    for (const resolution of this.resolutions) this.mediaResolver.release(resolution)
    this.resolutions.clear()
    this.listeners.clear()
  }
}
