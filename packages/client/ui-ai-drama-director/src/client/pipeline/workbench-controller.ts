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
 * The snapshot envelope is decoded fail-closed: any contract violation
 * degrades the whole workbench to a disabled state with a bounded reason.
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
  PipelineRunProjectionSchema,
  type PipelineRunProjectionV1,
} from '@yeisme/dsh-pane-protocol'
import type { ProjectCanvasScope } from '@yeisme/dsh-pane-protocol'
import { ProjectCanvasController } from '@yeisme/dsh-client-ui-pane-domain'
import { buildPipelineInspectorViewModel, PIPELINE_RUN_MUTATION_BLOCKED_STATUSES, type PipelineInspectorViewModelV1 } from './inspector-state.js'
import {
  createMediaAccessResolver,
  validatePipelineMediaRef,
  type PipelineMediaAccessResolver,
  type PipelineMediaEntry,
  type PipelineMediaResolution,
  type PipelineMediaResolveFn,
} from './media.js'
import type { PipelineAssetNodeIntentV1, PipelineMediaDragPosition } from './media-drag.js'
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
 */
export interface PipelineWorkbenchOwnerFaceV1 {
  snapshot(): Promise<unknown>
  dispatchRunAction?(input: PipelineWorkbenchRunActionRequestV1): Promise<unknown>
  resolveMedia?: PipelineMediaResolveFn
  canvasRemote?: PipelineCanvasRemote
  canvasScope?: ProjectCanvasScope
  canvasDocumentId?: string
}

export interface PipelineWorkbenchEdgeItemV1 {
  readonly id: string
  readonly kind: CreativePipelineEdgeProjectionV1['kind']
  readonly label: string
  readonly selected: boolean
}

export type PipelineWorkbenchPhase = 'loading' | 'ready' | 'disabled' | 'error'

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
  readonly edgeItems: readonly PipelineWorkbenchEdgeItemV1[]
  readonly objects: readonly PipelineObjectListItem[]
  readonly runStrip: BottomRunStripProps
  readonly canvas?: ProjectCanvasController
  /** Media access resolver; release is owned by the controller dispose. */
  readonly mediaResolver: PipelineMediaAccessResolver
}

export const PIPELINE_WORKBENCH_NO_CHANNEL_REASON =
  'Host action channel is unavailable; run controls stay disabled and nothing is executed locally.'

const MAX_STRIP_TEXT = 160
const MAX_OBJECT_TITLE = 80
const DROPPED_ASSET_SIZE = { width: 240, height: 160 } as const

interface DecodedSnapshotV1 {
  readonly project: PipelineProjectOption
  readonly capsule: WorkSurfaceCapsuleV1
  readonly nodes: readonly CreativePipelineNodeProjectionV1[]
  readonly edges: readonly CreativePipelineEdgeProjectionV1[]
  readonly runs: ReadonlyMap<string, CreativePipelineRunProjectionV1>
  readonly runProjections: ReadonlyMap<string, PipelineRunProjectionV1>
}

type SnapshotDecodeResult =
  | { readonly ok: true; readonly value: DecodedSnapshotV1 }
  | { readonly ok: false; readonly reason: string }

function bounded(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

/** Fail-closed envelope decode: any bad item fails the whole snapshot. */
export function decodePipelineWorkbenchSnapshotV1(input: unknown): SnapshotDecodeResult {
  const invalid = (reason: string): SnapshotDecodeResult => ({ ok: false, reason })
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return invalid('pipeline snapshot must be an object')
  const value = input as Record<string, unknown>
  if (value.schema !== PIPELINE_WORKBENCH_SNAPSHOT_SCHEMA) return invalid('pipeline snapshot schema is not supported')
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
  return {
    ok: true,
    value: {
      project: { ref: projectRef, label: bounded(projectInput.label, MAX_OBJECT_TITLE) },
      capsule: capsule.value,
      nodes,
      edges,
      runs,
      runProjections,
    },
  }
}

function stripEntry(id: string, text: string, status?: string, meta?: string): PipelineRunStripEntry {
  return { id, text: bounded(text, MAX_STRIP_TEXT), ...(status === undefined ? {} : { status }), ...(meta === undefined ? {} : { meta }) }
}

export interface PipelineWorkbenchControllerDeps {
  readonly owner: PipelineWorkbenchOwnerFaceV1
  readonly newId?: () => string
}

export class PipelineWorkbenchController {
  private readonly owner: PipelineWorkbenchOwnerFaceV1
  private readonly newId: () => string
  private readonly listeners = new Set<() => void>()
  private readonly mediaResolver: PipelineMediaAccessResolver
  private readonly resolutions = new Set<PipelineMediaResolution>()
  private readonly canvas: ProjectCanvasController | undefined
  private canvasUnsubscribe: (() => void) | undefined

  private state: PipelineWorkbenchViewStateV1
  private decoded: DecodedSnapshotV1 | undefined
  private surfaceOverride: CreativeWorkSurfaceKindV1 | undefined
  private selectedEdgeId: string | undefined
  private selectedNodeId: string | undefined
  private notice: string | undefined
  private generation = 0
  private disposed = false

  constructor(deps: PipelineWorkbenchControllerDeps) {
    this.owner = deps.owner
    this.newId = deps.newId ?? (() => `node-${crypto.randomUUID()}`)
    this.mediaResolver = createMediaAccessResolver({
      resolve: deps.owner.resolveMedia ?? (async () => undefined),
    })
    if (deps.owner.canvasRemote !== undefined && deps.owner.canvasScope !== undefined) {
      this.canvas = new ProjectCanvasController(deps.owner.canvasRemote, {
        scope: deps.owner.canvasScope,
        documentId: deps.owner.canvasDocumentId ?? 'main',
      })
      this.canvasUnsubscribe = this.canvas.subscribe(() => this.onCanvasChange())
    }
    this.state = this.compose('loading')
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

  /** Re-derives the published view state from the decoded projection + local observer state. */
  private compose(phase: PipelineWorkbenchPhase, reason?: string): PipelineWorkbenchViewStateV1 {
    const decoded = this.decoded
    const actionChannelReason = typeof this.owner.dispatchRunAction === 'function' ? undefined : PIPELINE_WORKBENCH_NO_CHANNEL_REASON
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
        runStrip: { log: [], validation: [], queue: [] },
        ...(this.canvas === undefined ? {} : { canvas: this.canvas }),
        mediaResolver: this.mediaResolver,
      }
    }
    const capsule: WorkSurfaceCapsuleV1 = this.surfaceOverride === undefined || this.surfaceOverride === decoded.capsule.surface
      ? decoded.capsule
      : { ...decoded.capsule, surface: this.surfaceOverride, menu: { ...decoded.capsule.menu, surface: this.surfaceOverride } }
    const nodesById = new Map(decoded.nodes.map(node => [node.id, node]))
    const edge = decoded.edges.find(item => item.id === this.selectedEdgeId)
    const runProjection = edge?.kind === 'execution' ? decoded.runProjections.get(edge.owner_projection_ref) : undefined
    const runDetail = runProjection === undefined ? undefined : decoded.runs.get(runProjection.runRef)
    let inspector = buildPipelineInspectorViewModel({
      ...(edge === undefined ? {} : { edge }),
      ...(runProjection === undefined ? {} : { run: runProjection }),
      ...(runDetail === undefined ? {} : { runDetail }),
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
    const objects: PipelineObjectListItem[] = decoded.nodes.map(node => ({
      id: node.id,
      kind: node.kind,
      title: bounded(node.summary.text, MAX_OBJECT_TITLE),
      status: node.status,
      selected: node.id === this.selectedNodeId,
    }))
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
      edgeItems,
      objects,
      runStrip,
      ...(this.canvas === undefined ? {} : { canvas: this.canvas }),
      mediaResolver: this.mediaResolver,
    }
  }

  /**
   * (Re-)reads the owner projection. Late results are fenced by generation;
   * a stale read never overwrites a newer one. Never throws.
   */
  async load(): Promise<void> {
    if (this.disposed) return
    const token = ++this.generation
    this.publish(this.compose('loading'))
    let raw: unknown
    try {
      raw = await this.owner.snapshot()
    } catch {
      if (token === this.generation && !this.disposed) this.publish(this.compose('error', 'Pipeline owner projection read failed'))
      return
    }
    if (token !== this.generation || this.disposed) return
    const decoded = decodePipelineWorkbenchSnapshotV1(raw)
    if (!decoded.ok) {
      this.decoded = undefined
      this.publish(this.compose('disabled', decoded.reason))
      return
    }
    this.decoded = decoded.value
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

  private onCanvasChange(): void {
    if (this.disposed) return
    const selection = this.canvas?.getSnapshot().editor?.selection ?? []
    const next = selection.at(-1)
    if (next === this.selectedNodeId) return
    this.selectedNodeId = next
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
        position: { x: Math.max(0, Math.round(position.x)), y: Math.max(0, Math.round(position.y)) },
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
    this.canvasUnsubscribe?.()
    this.canvasUnsubscribe = undefined
    this.canvas?.dispose()
    for (const resolution of this.resolutions) this.mediaResolver.release(resolution)
    this.resolutions.clear()
    this.listeners.clear()
  }
}
