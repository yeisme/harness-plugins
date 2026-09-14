/**
 * CreativePipelineGateway — safe Host Remote for the creative pipeline visual
 * workbench (dsh-creative-pipeline-visual-workbench-v1, real-owner wave).
 *
 * Service key (wire namespace): `creativePipeline`. The gateway owns no domain
 * truth and never creates a scheduler, ledger, writer lease, or terminal
 * result:
 * - layout / drafts / safe references are READ from the approved `storageDomain`
 *   seam, reusing the exact Creator Studio canvas domain spec and the
 *   `[tenantRef, workspaceRef, projectRef, documentId]` key pattern
 *   (see packages/host/creator-studio/src/project-canvas-store.ts). The reader
 *   is deliberately read-only: canvas saves keep flowing through the single
 *   existing writer (the Creator Studio gateway), so this gateway never becomes
 *   a second writer.
 * - run projections come from an optional injected run-owner face
 *   (`creativePipelineRunOwner`, e.g. an Ordo-backed adapter). When the owner is
 *   missing or violates the contract the run layer degrades honestly to
 *   `needs_contract` / `contract_mismatch` with empty collections — a `running`
 *   state is never fabricated.
 * - the tenant/workspace/project context is provided by the bundle/integration
 *   (`creativePipelineExpectedContext`) before or after construction and is
 *   re-read and fenced after every await; it is never derived from browser
 *   parameters. Without it every method fails closed.
 *
 * Every emitted snapshot item passes the same fail-closed decoders the browser
 * controller uses (`@yeisme/dsh-plugin-contracts` creative-pipeline decoders)
 * plus the pane-protocol zod schemas (run projections, canvas document) before
 * leaving the gateway; any violation degrades the whole snapshot instead of
 * emitting partial truth. No credentials, raw prompts, provider payloads, or
 * absolute paths ever enter the projection.
 *
 * Deliberately NOT exported from the package barrel (`index.ts`): the browser
 * client bundle inlines the barrel, and this module imports the host-only
 * typert protocol. Consumers import `@yeisme/dsh-ai-drama-director/pipeline-gateway`.
 *
 * @module @yeisme/dsh-ai-drama-director/pipeline-gateway
 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import {
  CanvasBindingSchema,
  PipelineRunProjectionSchema,
  ProjectCanvasDocumentSchema,
  ProjectCanvasReadRequestSchema,
  SceneGraphReadResultSchema,
  SceneWorkbenchReadResultSchema,
  ShotSchema,
  type CanvasBindingV1,
  type PipelineRunProjectionV1,
  type ProjectCanvasDocument,
  type ProjectCanvasEdge,
  type ProjectCanvasNode,
  type ProjectCanvasReadResult,
  type SceneDocumentV1,
  type ShotV1,
} from '@yeisme/dsh-pane-protocol'
import {
  decodeCreativePipelineEdgeProjectionV1,
  decodeCreativePipelineNodeProjectionV1,
  decodeCreativePipelineRunProjectionV1,
  decodeWorkSurfaceCapsuleV1,
  type CreativePipelineEdgeProjectionV1,
  type CreativePipelineNodeProjectionV1,
  type CreativePipelineRunProjectionV1,
  type CreativePipelineRunStateKindV1,
  type WorkSurfaceCapsuleV1,
} from '@yeisme/dsh-plugin-contracts'
import { isSafeDramaRef } from './contracts.js'

/** Neutral snapshot envelope schema id shared with the client fail-closed decoder. */
export const CREATIVE_PIPELINE_SNAPSHOT_SCHEMA = 'dsh.creative-pipeline-workbench-snapshot.v1alpha1' as const
/** Context service key carrying the server-bound pipeline context (never browser-derived). */
export const CREATIVE_PIPELINE_EXPECTED_CONTEXT = 'creativePipelineExpectedContext' as const
/** Context service key for an optional run-projection owner (e.g. an Ordo-backed adapter). */
export const CREATIVE_PIPELINE_RUN_OWNER = 'creativePipelineRunOwner' as const
export const CREATIVE_PIPELINE_CONTEXT_SCHEMA = 'dsh.creative-pipeline-context.v1alpha1' as const
export const CREATIVE_PIPELINE_RUN_OWNER_SNAPSHOT_SCHEMA = 'dsh.creative-pipeline-run-owner-snapshot.v1alpha1' as const
export const CREATIVE_PIPELINE_SERVICE_KEY = 'creativePipeline' as const

const CANVAS_DOCUMENT_ID = 'main'
const MAX_REF = 160
const MAX_PROJECT_TITLE = 160
const MAX_LABEL = 80
const MAX_REASON = 240

/** Same sensitive-token sweep the drama context validator applies to free text. */
const UNSAFE_TEXT = /(?:^|[:/\\])(?:etc|home|usr|var)|file:\/\/|authorization|cookie|token|secret|password|-----BEGIN|\s--|https?:\/\//i
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/
const ABSOLUTE_PATH = /^(?:[A-Za-z]:[\\/]|\\\\|\/(?:Users|home|root|private|var|workspaces)(?:\/|$))/

/** Server-bound pipeline context. Only opaque refs and an optional bounded title. */
export interface CreativePipelineContextV1 {
  readonly schema: typeof CREATIVE_PIPELINE_CONTEXT_SCHEMA
  readonly tenantRef: string
  readonly workspaceRef: string
  readonly projectRef: string
  readonly projectTitle?: string
}

export function validateCreativePipelineContext(input: unknown): CreativePipelineContextV1 | undefined {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return undefined
  const value = input as Record<string, unknown>
  if (value.schema !== CREATIVE_PIPELINE_CONTEXT_SCHEMA) return undefined
  const { tenantRef, workspaceRef, projectRef, projectTitle } = value
  if (typeof tenantRef !== 'string' || tenantRef.length > MAX_REF || !isSafeDramaRef(tenantRef)) return undefined
  if (typeof workspaceRef !== 'string' || workspaceRef.length > MAX_REF || !isSafeDramaRef(workspaceRef)) return undefined
  if (typeof projectRef !== 'string' || projectRef.length > MAX_REF || !isSafeDramaRef(projectRef)) return undefined
  if (projectTitle !== undefined) {
    if (typeof projectTitle !== 'string' || projectTitle.length === 0 || projectTitle.length > MAX_PROJECT_TITLE) return undefined
    if (UNSAFE_TEXT.test(projectTitle) || CONTROL_CHARS.test(projectTitle) || ABSOLUTE_PATH.test(projectTitle)) return undefined
  }
  return {
    schema: CREATIVE_PIPELINE_CONTEXT_SCHEMA,
    tenantRef,
    workspaceRef,
    projectRef,
    ...(projectTitle !== undefined ? { projectTitle } : {}),
  }
}

function samePipelineContext(left: CreativePipelineContextV1, right: CreativePipelineContextV1): boolean {
  return left.tenantRef === right.tenantRef
    && left.workspaceRef === right.workspaceRef
    && left.projectRef === right.projectRef
    && left.projectTitle === right.projectTitle
}

function bounded(text: string, max: number): { readonly text: string; readonly truncated: boolean } {
  return text.length <= max ? { text, truncated: false } : { text: `${text.slice(0, max - 1)}…`, truncated: true }
}

function boundedReason(text: string): string {
    const flattened = text.replace(/[\u0000-\u001F\u007F]+/gu, ' ').trim()
  return bounded(flattened.length > 0 ? flattened : 'unknown', MAX_REASON).text
}

/** Failure envelope: decodable schema id, but no fabricated projection fields. */
export interface CreativePipelineSnapshotFailureV1 {
  readonly schema: typeof CREATIVE_PIPELINE_SNAPSHOT_SCHEMA
  readonly status: 'unavailable' | 'needs_contract' | 'contract_mismatch'
  readonly reasonCode: string
  readonly safeMessage: string
}

export interface CreativePipelineSnapshotAvailabilityV1 {
  readonly canvas: 'ready' | 'missing'
  readonly runs: 'ready' | 'needs_contract' | 'contract_mismatch'
}

/** Real-owner snapshot envelope; the browser controller decodes it fail-closed. */
export interface CreativePipelineWorkbenchSnapshotV1 {
  readonly schema: typeof CREATIVE_PIPELINE_SNAPSHOT_SCHEMA
  readonly status: 'ready' | 'partial'
  readonly generatedAt: string
  readonly project: { readonly ref: string; readonly label: string }
  readonly capsule: WorkSurfaceCapsuleV1
  readonly nodes: readonly CreativePipelineNodeProjectionV1[]
  readonly edges: readonly CreativePipelineEdgeProjectionV1[]
  readonly runs: readonly CreativePipelineRunProjectionV1[]
  readonly runProjections: readonly PipelineRunProjectionV1[]
  /** Committed canvas document; omitted when no document exists yet. Never the unconfirmed draft. */
  readonly canvas?: ProjectCanvasDocument
  /** Committed 3D scene attachment; omitted when no scene row exists for this project. */
  readonly scene3d?: CreativePipelineScene3DSectionV1
  readonly availability: CreativePipelineSnapshotAvailabilityV1
}

export type CreativePipelineSnapshotResultV1 = CreativePipelineWorkbenchSnapshotV1 | CreativePipelineSnapshotFailureV1

/**
 * Scene document id the pipeline anchors its embedded 3D viewport to — the
 * same `main` convention the 3D Director workbench and its tests use, so the
 * pipeline projection and the 3D Director pane observe ONE scene document per
 * project through their respective owners.
 */
export const CREATIVE_PIPELINE_SCENE_3D_DOCUMENT_ID = 'main' as const
/** Bounded adjunct section: beyond this the section degrades instead of growing. */
const MAX_SCENE_3D_SHOTS = 256
const MAX_SCENE_3D_BINDINGS = 512

/**
 * Optional `scene3d` envelope section: the Shot-anchored 3D attachment the
 * workbench opens its embedded viewport from. Committed previsualization
 * shots plus canvas bindings derived from the scene document's stable
 * `canvasNodeRef` back-pointers — never fabricated when the scene store has
 * no committed row for this project.
 */
export interface CreativePipelineScene3DSectionV1 {
  readonly documentId: string
  readonly shots: readonly ShotV1[]
  readonly bindings: readonly CanvasBindingV1[]
}

/**
 * Optional run-projection owner. `snapshot` returns a raw, untrusted projection
 * the gateway validates item-by-item before anything reaches the browser.
 */
export interface CreativePipelineRunOwnerFaceV1 {
  snapshot(context: CreativePipelineContextV1): unknown | Promise<unknown>
}

interface PipelineRunLayer {
  readonly status: CreativePipelineSnapshotAvailabilityV1['runs']
  readonly runs: readonly CreativePipelineRunProjectionV1[]
  readonly runProjections: readonly PipelineRunProjectionV1[]
}

const DOMAIN_NODE_KINDS = new Set(['asset', 'character', 'scene', 'shot', 'candidate'])

/**
 * In-process canvas owner face: the Creator Studio gateway service
 * (`creatorStudio`) is the SINGLE canvas-domain owner in a composed host —
 * the storage-domain facility enforces one open per domain name, so this
 * gateway must never open the canvas domain itself. It delegates reads to the
 * owner service and stays read-only (the single writer contract is unchanged).
 */
interface CanvasOwnerFaceV1 {
  canvasRead(input: unknown): Promise<ProjectCanvasReadResult>
}

/**
 * In-process scene owner face: the 3D Director gateway service
 * (`scene3dDirector`) owns the scene domain for the same single-open reason.
 * The optional workbench read carries the committed scene document plus its
 * previsualization shots.
 */
interface Scene3DOwnerFaceV1 {
  sceneWorkbenchRead?(input: unknown): Promise<unknown>
  sceneRead?(input: unknown): Promise<unknown>
}

/** Safe Remote for the pipeline workbench. It owns no domain canonical state. */
export class CreativePipelineGateway extends TypertRemoteService {
  constructor(ctx: Context) {
    super(ctx, CREATIVE_PIPELINE_SERVICE_KEY)
  }

  /** The single canvas-domain owner, resolved per read (owner may arrive later). */
  private canvasOwner(): CanvasOwnerFaceV1 | undefined {
    try {
      const service = this.ctx.get('creatorStudio' as never)
      return service !== null && typeof service === 'object' && typeof (service as CanvasOwnerFaceV1).canvasRead === 'function'
        ? service as CanvasOwnerFaceV1
        : undefined
    } catch {
      return undefined
    }
  }

  /** The single scene-domain owner, resolved per read (owner may arrive later). */
  private scene3DOwner(): Scene3DOwnerFaceV1 | undefined {
    try {
      const service = this.ctx.get('scene3dDirector' as never)
      return service !== null && typeof service === 'object'
        && (typeof (service as Scene3DOwnerFaceV1).sceneWorkbenchRead === 'function' || typeof (service as Scene3DOwnerFaceV1).sceneRead === 'function')
        ? service as Scene3DOwnerFaceV1
        : undefined
    } catch {
      return undefined
    }
  }

  private get expectedContext(): CreativePipelineContextV1 | undefined {
    return validateCreativePipelineContext(this.ctx.get(CREATIVE_PIPELINE_EXPECTED_CONTEXT as never))
  }

  /**
   * Read-only canvas projection delegated to the single canvas-domain owner
   * (the Creator Studio gateway service). Writes stay with that owner.
   */
  @Remote('canvasRead')
  async canvasRead(input: unknown): Promise<ProjectCanvasReadResult> {
    const request = ProjectCanvasReadRequestSchema.safeParse(input)
    if (!request.success) return { status: 'invalid' }
    const context = this.expectedContext
    const owner = this.canvasOwner()
    if (context === undefined || owner === undefined) return { status: 'unavailable' }
    if (request.data.scope.workspaceRef !== context.workspaceRef || request.data.scope.projectRef !== context.projectRef) {
      return { status: 'forbidden' }
    }
    const result = await owner.canvasRead(request.data)
    const latest = this.expectedContext
    if (latest === undefined || !samePipelineContext(context, latest)) return { status: 'forbidden' }
    return result
  }

  @Remote('snapshot')
  async snapshot(): Promise<CreativePipelineSnapshotResultV1> {
    try {
      return await this.composeSnapshot()
    } catch {
      return this.failure('unavailable', 'snapshot_read_failed', 'The pipeline projection read failed; nothing was fabricated.')
    }
  }

  private failure(status: CreativePipelineSnapshotFailureV1['status'], reasonCode: string, safeMessage: string): CreativePipelineSnapshotFailureV1 {
    return { schema: CREATIVE_PIPELINE_SNAPSHOT_SCHEMA, status, reasonCode: bounded(reasonCode, MAX_LABEL).text, safeMessage: boundedReason(safeMessage) }
  }

  private async composeSnapshot(): Promise<CreativePipelineSnapshotResultV1> {
    const context = this.expectedContext
    if (context === undefined) {
      return this.failure('needs_contract', 'context_unavailable', 'The pipeline workbench is waiting for a bound tenant/workspace/project context.')
    }
    const canvasOwner = this.canvasOwner()
    if (canvasOwner === undefined) {
      return this.failure('unavailable', 'canvas_owner_unavailable', 'The pipeline canvas projection is waiting for the single canvas owner service.')
    }
    const read = await canvasOwner.canvasRead({ scope: { workspaceRef: context.workspaceRef, projectRef: context.projectRef }, documentId: CANVAS_DOCUMENT_ID })
    if (read.status === 'error' || read.status === 'invalid' || read.status === 'unavailable' || read.status === 'forbidden') {
      return this.failure('unavailable', 'canvas_read_failed', 'The pipeline canvas projection could not be read; nothing was fabricated.')
    }
    const document = read.status === 'ready' ? read.document : undefined
    if (document !== undefined
      && (document.scope.workspaceRef !== context.workspaceRef || document.scope.projectRef !== context.projectRef)) {
      return this.failure('contract_mismatch', 'canvas_scope_mismatch', 'The stored canvas does not match the bound project context.')
    }

    const nodes: CreativePipelineNodeProjectionV1[] = []
    const nodeKinds = new Map<string, string>()
    if (document !== undefined) {
      for (const node of document.nodes) nodeKinds.set(node.id, node.kind)
      for (const node of document.nodes) {
        if (!DOMAIN_NODE_KINDS.has(node.kind)) continue
        const decoded = decodeCreativePipelineNodeProjectionV1(pipelineNodeInput(node))
        if (!decoded.ok) return this.failure('contract_mismatch', 'node_contract_mismatch', `A canvas node failed the pipeline projection contract: ${decoded.reason}`)
        nodes.push(decoded.value)
      }
    }
    const edges: CreativePipelineEdgeProjectionV1[] = []
    const executionEdgeRefs = new Set<string>()
    if (document !== undefined) {
      for (const edge of document.edges) {
        if (edge.kind === 'reference') {
          if (!DOMAIN_NODE_KINDS.has(nodeKinds.get(edge.source) ?? '') || !DOMAIN_NODE_KINDS.has(nodeKinds.get(edge.target) ?? '')) continue
          const decoded = decodeCreativePipelineEdgeProjectionV1({ id: edge.id, kind: 'reference', source: edge.source, target: edge.target, ...(edge.label === undefined ? {} : { label: edge.label }) })
          if (!decoded.ok) return this.failure('contract_mismatch', 'edge_contract_mismatch', `A canvas edge failed the pipeline projection contract: ${decoded.reason}`)
          edges.push(decoded.value)
          continue
        }
        const decoded = decodeCreativePipelineEdgeProjectionV1(executionEdgeInput(edge))
        if (!decoded.ok) return this.failure('contract_mismatch', 'edge_contract_mismatch', `A canvas edge failed the pipeline projection contract: ${decoded.reason}`)
        executionEdgeRefs.add(decoded.value.id)
        edges.push(decoded.value)
      }
    }

    const runLayer = await this.readRunLayer(context, executionEdgeRefs)
    const latest = this.expectedContext
    if (latest === undefined || !samePipelineContext(context, latest)) {
      return this.failure('needs_contract', 'context_changed', 'The pipeline context changed while composing the projection; reconcile with the owner.')
    }

    // Adjunct scene3d section: delegated to the single scene-domain owner and
    // decoded fail-closed; a missing owner, missing scene, or violating row
    // degrades the embedded viewport only (bounded reason on the client) and
    // never fails the pipeline snapshot.
    const scene3d = await this.readScene3DSection(context, document)

    const title = context.projectTitle ?? context.projectRef
    const label = bounded(title, MAX_LABEL)
    const runState = runLayerStatus(runLayer)
    const headline = runLayer.runs.find(run => run.state.state === 'running') ?? runLayer.runs[0]
    const nextAction = runLayer.status !== 'ready'
      ? 'Run projections require the owner contract; the layout stays read-only.'
      : headline?.state.next_action ?? 'Review the pipeline canvas.'
    const capsule = decodeWorkSurfaceCapsuleV1({
      contract_version: 'dsh.creative-pipeline.v1',
      project_ref: context.projectRef,
      surface: 'workbench',
      unsaved_draft: ('draft' in read ? read.draft : undefined) !== undefined,
      pending_review: false,
      ...(headline === undefined ? {} : { run: { state: headline.state.state, ...(headline.progress === undefined ? {} : { progress: headline.progress }) } }),
      menu: {
        project: label,
        surface: 'workbench',
        work_context: { text: 'Pipeline workbench', truncated: false },
        run_state: runState,
        next_action: bounded(nextAction, MAX_REASON),
      },
    })
    if (!capsule.ok) return this.failure('contract_mismatch', 'capsule_contract_mismatch', `The capsule failed the pipeline projection contract: ${capsule.reason}`)

    const envelope: CreativePipelineWorkbenchSnapshotV1 = {
      schema: CREATIVE_PIPELINE_SNAPSHOT_SCHEMA,
      status: document === undefined || runLayer.status !== 'ready' ? 'partial' : 'ready',
      generatedAt: new Date().toISOString(),
      project: { ref: context.projectRef, label: label.text },
      capsule: capsule.value,
      nodes,
      edges,
      runs: runLayer.runs,
      runProjections: runLayer.runProjections,
      ...(document === undefined ? {} : { canvas: document }),
      ...(scene3d === undefined ? {} : { scene3d }),
      availability: { canvas: document === undefined ? 'missing' : 'ready', runs: runLayer.status },
    }
    // Final fail-closed gate: everything leaving the gateway re-passes the transport schemas.
    if (envelope.canvas !== undefined && !ProjectCanvasDocumentSchema.safeParse(envelope.canvas).success) {
      return this.failure('contract_mismatch', 'canvas_contract_mismatch', 'The composed canvas document failed the transport schema.')
    }
    if (!envelope.runProjections.every(projection => PipelineRunProjectionSchema.safeParse(projection).success)) {
      return this.failure('contract_mismatch', 'run_contract_mismatch', 'A composed run projection failed the transport schema.')
    }
    return envelope
  }

  /**
   * Reads the optional `scene3d` section through the single scene-domain
   * owner (the 3D Director gateway service). The negotiated workbench read is
   * preferred (document + committed previz shots); the legacy strict read is
   * the fallback. Every payload re-passes the frozen transport schema before
   * the section is composed; any miss degrades to an omitted section.
   */
  private async readScene3DSection(context: CreativePipelineContextV1, canvas: ProjectCanvasDocument | undefined): Promise<CreativePipelineScene3DSectionV1 | undefined> {
    const owner = this.scene3DOwner()
    if (owner === undefined) return undefined
    const request = { scope: { workspaceRef: context.workspaceRef, projectRef: context.projectRef }, documentId: CREATIVE_PIPELINE_SCENE_3D_DOCUMENT_ID }
    let document: SceneDocumentV1 | undefined
    let shots: readonly ShotV1[] | undefined
    try {
      if (typeof owner.sceneWorkbenchRead === 'function') {
        const parsed = SceneWorkbenchReadResultSchema.safeParse(await owner.sceneWorkbenchRead(request))
        if (!parsed.success) return undefined
        if (parsed.data.result.status !== 'ready') return undefined
        document = parsed.data.result.document
        shots = parsed.data.shots
      } else {
        const parsed = SceneGraphReadResultSchema.safeParse(await owner.sceneRead?.(request))
        if (!parsed.success || parsed.data.status !== 'ready') return undefined
        document = parsed.data.document
      }
    } catch {
      return undefined
    }
    if (document === undefined
      || document.scope.workspaceRef !== context.workspaceRef || document.scope.projectRef !== context.projectRef
      || document.id !== CREATIVE_PIPELINE_SCENE_3D_DOCUMENT_ID || document.version === 0) return undefined
    return this.composeScene3DSection(canvas, document, shots ?? [])
  }

  /**
   * Composes the optional `scene3d` section from the committed scene row.
   *
   * Bindings derive from the scene document's stable `canvasNodeRef`
   * back-pointers — the scene object's own id is the `sceneObjectRef`, the
   * back-pointer keys the canvas node — and only for scene objects a
   * committed shot actually references (camera, object list, visibility, or
   * keyframes, by node id or resourceRef). An unreferenced object has no
   * honest shot association, so it stays unbound: the pipeline ⇄ 3D selection
   * sync stays silent for it in both directions by contract. Layout positions
   * reuse the canvas node's committed position when it resolves; otherwise
   * the binding carries a zero position (selection semantics only).
   *
   * Every emitted item re-passes the frozen transport schemas; any violation
   * drops the whole section (adjunct fail-closed), never a partial truth.
   */
  private composeScene3DSection(
    canvas: ProjectCanvasDocument | undefined,
    sceneDocument: SceneDocumentV1,
    sceneShots: readonly ShotV1[],
  ): CreativePipelineScene3DSectionV1 | undefined {
    const shots: ShotV1[] = []
    for (const shot of sceneShots.slice(0, MAX_SCENE_3D_SHOTS)) {
      const parsed = ShotSchema.safeParse(shot)
      if (!parsed.success) return undefined
      shots.push(parsed.data)
    }
    const bindings: CanvasBindingV1[] = []
    for (const node of sceneDocument.nodes) {
      if (node.canvasNodeRef === undefined) continue
      const shotRef = shotRefForSceneObject(shots, node.id, node.resourceRef)
      if (shotRef === undefined) continue
      const position = canvasNodePosition(canvas, node.canvasNodeRef)
      const candidate = {
        nodeRef: node.canvasNodeRef,
        shotRef,
        sceneObjectRef: node.id,
        edgeKind: 'reference' as const,
        layout: { position },
      }
      const parsed = CanvasBindingSchema.safeParse(candidate)
      if (!parsed.success) return undefined
      bindings.push(parsed.data)
      if (bindings.length >= MAX_SCENE_3D_BINDINGS) break
    }
    return { documentId: CREATIVE_PIPELINE_SCENE_3D_DOCUMENT_ID, shots, bindings }
  }

  /**
   * Run layer from the optional owner face. Missing owner → honest
   * `needs_contract` with empty collections; a contract-violating owner →
   * `contract_mismatch` with empty collections. Never throws, never retries.
   */
  private async readRunLayer(context: CreativePipelineContextV1, executionEdgeRefs: ReadonlySet<string>): Promise<PipelineRunLayer> {
    const empty = (status: PipelineRunLayer['status']): PipelineRunLayer => ({ status, runs: [], runProjections: [] })
    const owner = this.ctx.get(CREATIVE_PIPELINE_RUN_OWNER as never) as CreativePipelineRunOwnerFaceV1 | undefined
    if (owner === undefined || typeof owner.snapshot !== 'function') return empty('needs_contract')
    let raw: unknown
    try {
      raw = await owner.snapshot(context)
    } catch {
      return empty('contract_mismatch')
    }
    const latest = this.expectedContext
    if (latest === undefined || !samePipelineContext(context, latest)) return empty('contract_mismatch')
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return empty('contract_mismatch')
    const value = raw as Record<string, unknown>
    if (value.schema !== CREATIVE_PIPELINE_RUN_OWNER_SNAPSHOT_SCHEMA
      || !Array.isArray(value.runs) || !Array.isArray(value.runProjections)) return empty('contract_mismatch')
    const runs: CreativePipelineRunProjectionV1[] = []
    const runRefs = new Set<string>()
    for (const item of value.runs) {
      const decoded = decodeCreativePipelineRunProjectionV1(item)
      if (!decoded.ok || runRefs.has(decoded.value.run_ref)) return empty('contract_mismatch')
      runRefs.add(decoded.value.run_ref)
      runs.push(decoded.value)
    }
    const runProjections: PipelineRunProjectionV1[] = []
    const projectedEdges = new Set<string>()
    for (const item of value.runProjections) {
      const parsed = PipelineRunProjectionSchema.safeParse(item)
      if (!parsed.success) return empty('contract_mismatch')
      if (!executionEdgeRefs.has(parsed.data.executionEdgeRef) || projectedEdges.has(parsed.data.executionEdgeRef)) return empty('contract_mismatch')
      projectedEdges.add(parsed.data.executionEdgeRef)
      runProjections.push(parsed.data)
    }
    return { status: 'ready', runs, runProjections }
  }
}

function pipelineNodeInput(node: ProjectCanvasNode): unknown {
  const domain = node as Extract<ProjectCanvasNode, { kind: 'asset' | 'character' | 'scene' | 'shot' | 'candidate' }>
  return {
    id: domain.id,
    kind: domain.kind,
    ref: domain.domainRef,
    summary: { text: domain.summary ?? domain.title, truncated: false },
    version: domain.version,
    status: 'ready',
    layout: { x: domain.position.x, y: domain.position.y, width: domain.size.width, height: domain.size.height },
    freshness: 'fresh',
  }
}

function executionEdgeInput(edge: Extract<ProjectCanvasEdge, { kind: 'execution' }>): unknown {
  return {
    id: edge.id,
    kind: 'execution',
    source: edge.source,
    target: edge.target,
    input_purpose: edge.purpose,
    output_version: edge.output,
    // The owner keys run projections by the canvas execution edge id; without a
    // mounted owner no projection claims this ref, so nothing is fabricated.
    owner_projection_ref: edge.id,
  }
}

/**
 * First committed shot that references the scene object (node id or
 * resourceRef) through its camera, object list, visibility, or keyframes.
 * `undefined` = no honest shot association; the binding is then skipped.
 */
function shotRefForSceneObject(shots: readonly ShotV1[], nodeId: string, resourceRef: string | undefined): string | undefined {
  for (const shot of shots) {
    const refs = [nodeId, ...(resourceRef === undefined ? [] : [resourceRef])]
    if (refs.includes(shot.cameraRef)) return shot.shotRef
    if (shot.objectRefs.some(ref => refs.includes(ref))) return shot.shotRef
    if (shot.visibility.some(entry => refs.includes(entry.objectRef))) return shot.shotRef
    if (shot.keyframes.some(keyframe => refs.includes(keyframe.objectRef))) return shot.shotRef
  }
  return undefined
}

/** Committed canvas position for a bound canvas node (id or domainRef); zero fallback is selection-layout only. */
function canvasNodePosition(canvas: ProjectCanvasDocument | undefined, nodeRef: string): { readonly x: number; readonly y: number } {
  const node = canvas?.nodes.find(entry => entry.id === nodeRef || ('domainRef' in entry && entry.domainRef === nodeRef))
  return node === undefined ? { x: 0, y: 0 } : { x: node.position.x, y: node.position.y }
}

function runLayerStatus(layer: PipelineRunLayer): CreativePipelineRunStateKindV1 {
  if (layer.status !== 'ready') return 'needs_contract'
  const states = layer.runs.map(run => run.state.state)
  for (const state of ['running', 'paused', 'blocked', 'stale', 'partial', 'unknown'] as const) {
    if (states.includes(state)) return state
  }
  return layer.runs.length > 0 ? 'needs_contract' : 'unknown'
}

export default CreativePipelineGateway
