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
  PipelineRunProjectionSchema,
  ProjectCanvasDocumentSchema,
  ProjectCanvasReadRequestSchema,
  type PipelineRunProjectionV1,
  type ProjectCanvasDocument,
  type ProjectCanvasEdge,
  type ProjectCanvasNode,
  type ProjectCanvasReadResult,
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
import {
  projectCanvasDomainSpec,
  projectCanvasRowSchema,
  type ProjectCanvasStorage,
  type ProjectCanvasTable,
} from '@yeisme/dsh-creator-studio-host'
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
  readonly availability: CreativePipelineSnapshotAvailabilityV1
}

export type CreativePipelineSnapshotResultV1 = CreativePipelineWorkbenchSnapshotV1 | CreativePipelineSnapshotFailureV1

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

type CanvasDomain = { table(name: 'documents'): ProjectCanvasTable; close(): Promise<void> }

/**
 * Read-only view over the shared Creator Studio canvas domain. Reuses the exact
 * domain spec and key pattern so rows written by the single existing writer
 * (Creator Studio gateway) are read back with identical semantics, including
 * the journaled (unconfirmed) draft surfacing rules.
 */
class PipelineCanvasReader {
  private domain: Promise<CanvasDomain> | undefined
  private closed = false

  constructor(private readonly storage: ProjectCanvasStorage) {}

  private table(): Promise<ProjectCanvasTable> {
    if (this.closed) return Promise.reject(new Error('pipeline canvas storage closed'))
    if (this.domain === undefined) {
      const opened = this.storage.open(projectCanvasDomainSpec)
      this.domain = opened
      void opened.catch(() => { if (this.domain === opened) this.domain = undefined })
    }
    return this.domain.then(domain => domain.table('documents'))
  }

  private key(context: CreativePipelineContextV1, documentId: string): string {
    return JSON.stringify([context.tenantRef, context.workspaceRef, context.projectRef, documentId])
  }

  async read(context: CreativePipelineContextV1, documentId: string): Promise<ProjectCanvasReadResult> {
    try {
      const table = await this.table()
      if (this.closed) return { status: 'error' }
      const raw = table.get(this.key(context, documentId))
      if (raw === undefined) return { status: 'missing' }
      const row = projectCanvasRowSchema.safeParse(raw)
      if (!row.success) return { status: 'error' }
      const document = row.data.document
      if (document.scope.workspaceRef !== context.workspaceRef || document.scope.projectRef !== context.projectRef
        || document.id !== documentId) return { status: 'error' }
      const inflight = row.data.inflight
      const draft = inflight !== undefined
        && inflight.document.scope.workspaceRef === context.workspaceRef
        && inflight.document.scope.projectRef === context.projectRef
        && inflight.document.id === documentId
        && inflight.baseRevision === document.revision
        ? { draft: { requestId: inflight.requestId, baseRevision: inflight.baseRevision, document: inflight.document } }
        : undefined
      // A committed row is always at revision >= 1; revision 0 exists only as an unconfirmed write-ahead placeholder.
      if (document.revision === 0) return draft === undefined ? { status: 'missing' } : { status: 'missing', ...draft }
      return { status: 'ready', document, ...(draft ?? {}) }
    } catch {
      return { status: 'error' }
    }
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    const domain = this.domain
    this.domain = undefined
    try { await domain?.then(opened => opened.close()) } catch { /* close is best-effort */ }
  }
}

/** Safe Remote for the pipeline workbench. It owns no domain canonical state. */
export class CreativePipelineGateway extends TypertRemoteService {
  private readonly canvasReader: PipelineCanvasReader | undefined

  constructor(ctx: Context) {
    super(ctx, CREATIVE_PIPELINE_SERVICE_KEY)
    const storage = ctx.get('storageDomain' as never) as ProjectCanvasStorage | undefined
    if (storage !== undefined && typeof storage.open === 'function') {
      this.canvasReader = new PipelineCanvasReader(storage)
      ctx.effect(() => async () => { await this.canvasReader?.close() }, 'creativePipeline.canvas')
    }
  }

  private get expectedContext(): CreativePipelineContextV1 | undefined {
    return validateCreativePipelineContext(this.ctx.get(CREATIVE_PIPELINE_EXPECTED_CONTEXT as never))
  }

  /** Read-only canvas projection through the shared storage seam. Writes stay with the single existing writer. */
  @Remote('canvasRead')
  async canvasRead(input: unknown): Promise<ProjectCanvasReadResult> {
    const request = ProjectCanvasReadRequestSchema.safeParse(input)
    if (!request.success) return { status: 'invalid' }
    const context = this.expectedContext
    if (context === undefined || this.canvasReader === undefined) return { status: 'unavailable' }
    if (request.data.scope.workspaceRef !== context.workspaceRef || request.data.scope.projectRef !== context.projectRef) {
      return { status: 'forbidden' }
    }
    const result = await this.canvasReader.read(context, request.data.documentId)
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
    if (this.canvasReader === undefined) {
      return this.failure('unavailable', 'storage_unavailable', 'Pipeline canvas storage is not mounted; no layout or safe reference can be projected.')
    }
    const read = await this.canvasReader.read(context, CANVAS_DOCUMENT_ID)
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

function runLayerStatus(layer: PipelineRunLayer): CreativePipelineRunStateKindV1 {
  if (layer.status !== 'ready') return 'needs_contract'
  const states = layer.runs.map(run => run.state.state)
  for (const state of ['running', 'paused', 'blocked', 'stale', 'partial', 'unknown'] as const) {
    if (states.includes(state)) return state
  }
  return layer.runs.length > 0 ? 'needs_contract' : 'unknown'
}

export default CreativePipelineGateway
