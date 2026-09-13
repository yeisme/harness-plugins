/**
 * SceneGraphGateway — safe Host Remote for the 3D Director workbench scene
 * graph (dsh-3d-director-gltf-workbench-v1, Group 2.1/2.2/2.4).
 *
 * Service key (wire namespace): `scene3dDirector`. The gateway owns no domain
 * truth and never creates a scheduler, task ledger, writer lease, or terminal
 * result:
 * - scene graph revisions are READ/WRITTEN through the approved `storageDomain`
 *   seam via SceneGraphStore (key pattern [tenantRef, workspaceRef, projectRef,
 *   sceneRef]), with base-revision conflict fencing and journaled draft
 *   preservation; a conflict never overwrites, retries, or replaces the writer;
 * - generation change sets are append-only records via GenerationChangeSetLog;
 *   accepting one commits a new revision through the same conflict-fenced save;
 *   preview/accept/reject/rollback are exposed as Remote methods whose results
 *   re-pass the change-set schema before leaving the gateway;
 * - GLB bytes never enter any projection: import bytes flow only from the
 *   injected byte source (structurally the dsh-file-host FileBinaryReadV1
 *   contract) into the gltf parser; export bytes leave as a bounded base64
 *   payload only after the capability report proves a lossless export;
 * - the tenant/workspace/project context is server-injected under
 *   `scene3dDirectorExpectedContext` and re-read/fenced after every await; it
 *   is never derived from browser parameters. Without it every method fails
 *   closed.
 *
 * Every emitted payload re-passes the pane-protocol zod schemas (scene
 * document, read/save results, capability report, change sets) before leaving
 * the gateway; any violation degrades the whole result instead of emitting
 * partial truth.
 *
 * @module @yeisme/dsh-3d-director-host/gateway
 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import {
  ArtifactRefSchema,
  GenerationChangeSetSchema,
  SceneDocumentSchema,
  SceneGraphReadRequestSchema,
  SceneWorkbenchReadResultSchema,
  SceneWorkbenchSaveRequestSchema,
  type SceneWorkbenchReadResult,
  SceneGraphReadResultSchema,
  SceneGraphSaveRequestSchema,
  SceneGraphSaveResultSchema,
  parseGltfCapabilityReport,
  type GenerationChangeSetV1,
  type GltfCapabilityGapV1,
  type GltfCapabilityReportV1,
  type SceneDocumentV1,
  type SceneGraphReadResult,
  type SceneGraphSaveResult,
} from '@yeisme/dsh-pane-protocol'
import { exportSceneDocumentToGlb, importGlbToSceneDocument } from './gltf/index.js'
import {
  GenerationChangeSetLog,
  type Scene3DChangeSetAcceptResult,
  type Scene3DChangeSetListResult,
  type Scene3DChangeSetRollbackResult,
  type Scene3DChangeSetTransitionResult,
} from './change-set.js'
import { SceneGraphStore, type Scene3DStorage } from './scene-store.js'

/** Context service key carrying the server-bound 3D Director context (never browser-derived). */
export const SCENE_3D_EXPECTED_CONTEXT = 'scene3dDirectorExpectedContext' as const
/** Context service key for the GLB byte source (dsh-file-host FileBinaryReadV1-compatible). */
export const SCENE_3D_GLB_BYTE_SOURCE = 'scene3dDirectorGlbByteSource' as const
export const SCENE_3D_CONTEXT_SCHEMA = 'dsh.scene-3d-context.v1alpha1' as const
export const SCENE_3D_DIRECTOR_SERVICE_KEY = 'scene3dDirector' as const

const MAX_REF = 160
const MAX_TITLE = 160
const MAX_REASON = 240
const MAX_WARNINGS = 32
/** Raw GLB export cap; larger exports report too_large instead of truncating. */
export const SCENE_3D_EXPORT_BYTE_LIMIT = 8 * 1024 * 1024

const SAFE_REF = /^[a-z0-9][a-z0-9._:/-]*$/i
const UNSAFE_REF_TARGET = /^(?:[A-Za-z]:[\\/]|\\\\|\/|(?:https?|file|javascript|data):)/i
const UNSAFE_TEXT = /(?:^|[:/\\])(?:etc|home|usr|var)|file:\/\/|authorization|cookie|token|secret|password|-----BEGIN|\s--|https?:\/\//i
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/
const ABSOLUTE_PATH = /^(?:[A-Za-z]:[\\/]|\\\\|\/(?:Users|home|root|private|var|workspaces)(?:\/|$))/

/** Server-bound 3D Director context. Only opaque refs and an optional bounded title. */
export interface Scene3DContextV1 {
  readonly schema: typeof SCENE_3D_CONTEXT_SCHEMA
  readonly tenantRef: string
  readonly workspaceRef: string
  readonly projectRef: string
  readonly projectTitle?: string
}

export function validateScene3DContext(input: unknown): Scene3DContextV1 | undefined {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return undefined
  const value = input as Record<string, unknown>
  if (value.schema !== SCENE_3D_CONTEXT_SCHEMA) return undefined
  const { tenantRef, workspaceRef, projectRef, projectTitle } = value
  for (const ref of [tenantRef, workspaceRef, projectRef]) {
    if (typeof ref !== 'string' || ref.length === 0 || ref.length > MAX_REF || !SAFE_REF.test(ref) || UNSAFE_REF_TARGET.test(ref)) return undefined
  }
  if (projectTitle !== undefined) {
    if (typeof projectTitle !== 'string' || projectTitle.length === 0 || projectTitle.length > MAX_TITLE) return undefined
    if (UNSAFE_TEXT.test(projectTitle) || CONTROL_CHARS.test(projectTitle) || ABSOLUTE_PATH.test(projectTitle)) return undefined
  }
  return {
    schema: SCENE_3D_CONTEXT_SCHEMA,
    tenantRef: tenantRef as string,
    workspaceRef: workspaceRef as string,
    projectRef: projectRef as string,
    ...(projectTitle !== undefined ? { projectTitle: projectTitle as string } : {}),
  }
}

function sameScene3DContext(left: Scene3DContextV1, right: Scene3DContextV1): boolean {
  return left.tenantRef === right.tenantRef
    && left.workspaceRef === right.workspaceRef
    && left.projectRef === right.projectRef
    && left.projectTitle === right.projectTitle
}

function boundedReason(text: string): string {
  const flattened = text.replace(/[\u0000-\u001F\u007F]+/gu, ' ').trim()
  const value = flattened.length > 0 ? flattened : 'unknown'
  return value.length <= MAX_REASON ? value : `${value.slice(0, MAX_REASON - 1)}…`
}

/**
 * Bounded binary payload resolved by the file owner; raw paths never cross
 * this contract. Structurally the dsh-file-host `FileBinaryReadV1` shape, so
 * an adapter can wrap `FileHostV1.readBinary` without a package dependency.
 */
export interface Scene3DGlbBytesV1 {
  readonly bytes: Uint8Array
  readonly size: number
  readonly truncated: boolean
  readonly mediaType?: string
  readonly version?: string
}

/** Byte source for GLB import. Bytes go only into the gltf parser, never into a projection. */
export interface Scene3DGlbByteSourceV1 {
  readGlb(sourceRef: string): Promise<Scene3DGlbBytesV1 | undefined>
}

export interface Scene3DImportGlbRequestV1 {
  readonly scope: { readonly workspaceRef: string; readonly projectRef: string }
  /** Opaque source ref resolvable through the mounted byte source. */
  readonly sourceRef: string
  /** Document id for the imported draft; defaults to the parser's document id. */
  readonly documentId?: string
}

export type Scene3DImportGlbResultV1 =
  | { readonly status: 'imported'; readonly document: SceneDocumentV1; readonly warnings: readonly string[] }
  | { readonly status: 'invalid'; readonly code: string; readonly reason: string }
  | { readonly status: 'too_large'; readonly size: number }
  | { readonly status: 'missing' | 'unavailable' | 'forbidden' | 'contract_mismatch'; readonly reason?: string }

export type Scene3DExportGlbResultV1 =
  | { readonly status: 'exported'; readonly bytesBase64: string; readonly size: number; readonly mediaType: 'model/gltf-binary'; readonly report: GltfCapabilityReportV1 }
  | { readonly status: 'capability_blocked'; readonly gaps: readonly GltfCapabilityGapV1[]; readonly reason: string }
  | { readonly status: 'too_large'; readonly size: number }
  | { readonly status: 'missing' | 'invalid' | 'unavailable' | 'forbidden' | 'contract_mismatch' | 'error'; readonly reason?: string }

/**
 * Read-only change-set preview: the audited entry plus what the scene owner can
 * still compare against (current revision and whether the change set's base
 * revision is retained for comparison/rollback). No patch bytes ever cross.
 */
export type Scene3DChangeSetPreviewResultV1 =
  | { readonly status: 'ready'; readonly changeSet: GenerationChangeSetV1; readonly currentVersion: number; readonly baseRevisionRetained: boolean }
  | { readonly status: 'missing' }
  | { readonly status: 'invalid' | 'forbidden' | 'unavailable'; readonly reason?: string }

function isSafeRef(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_REF && SAFE_REF.test(value)
}

function parseScope(input: unknown): { readonly workspaceRef: string; readonly projectRef: string } | undefined {
  const request = SceneGraphReadRequestSchema.safeParse({ scope: (input as Record<string, unknown>)?.scope, documentId: 'probe' })
  return request.success ? request.data.scope : undefined
}

/** Safe Remote for the 3D Director scene graph. It owns no domain canonical state. */
export class SceneGraphGateway extends TypertRemoteService {
  private readonly store: SceneGraphStore | undefined
  private readonly changeSets: GenerationChangeSetLog | undefined

  constructor(ctx: Context) {
    super(ctx, SCENE_3D_DIRECTOR_SERVICE_KEY)
    const storage = ctx.get('storageDomain' as never) as Scene3DStorage | undefined
    if (storage !== undefined && typeof storage.open === 'function') {
      this.store = new SceneGraphStore(storage, () => this.expectedContext)
      this.changeSets = new GenerationChangeSetLog(this.store)
      ctx.effect(() => async () => { await this.store?.close() }, 'scene3dDirector.store')
    }
  }

  private get expectedContext(): Scene3DContextV1 | undefined {
    return validateScene3DContext(this.ctx.get(SCENE_3D_EXPECTED_CONTEXT as never))
  }

  /** Read the committed scene document (plus capability report and any journaled draft). */
  @Remote('sceneRead')
  async sceneRead(input: unknown): Promise<SceneGraphReadResult> {
    const request = SceneGraphReadRequestSchema.safeParse(input)
    if (!request.success) return { status: 'invalid' }
    const context = this.expectedContext
    if (context === undefined || this.store === undefined) return { status: 'unavailable' }
    if (request.data.scope.workspaceRef !== context.workspaceRef || request.data.scope.projectRef !== context.projectRef) {
      return { status: 'forbidden' }
    }
    const result = await this.store.read(request.data)
    const latest = this.expectedContext
    if (latest === undefined || !sameScene3DContext(context, latest)) return { status: 'forbidden' }
    // Fail-closed exit gate: anything that no longer crosses the transport schema degrades to error.
    const gate = SceneGraphReadResultSchema.safeParse(result)
    return gate.success ? gate.data : { status: 'error' }
  }

  /** Negotiated scene + previsualization read; legacy sceneRead stays strict. */
  @Remote('sceneWorkbenchRead')
  async sceneWorkbenchRead(input: unknown): Promise<SceneWorkbenchReadResult> {
    const context = this.expectedContext
    if (!context || !this.store) return { schema: 'dsh.scene-workbench.v1', result: { status: 'unavailable' } }
    const result = await this.store.readWorkbench(input)
    const latest = this.expectedContext
    if (!latest || !sameScene3DContext(context, latest)) return { schema: 'dsh.scene-workbench.v1', result: { status: 'forbidden' } }
    const parsed = SceneWorkbenchReadResultSchema.safeParse(result)
    return parsed.success ? parsed.data : { schema: 'dsh.scene-workbench.v1', result: { status: 'error' } }
  }

  /** Scene and Shot drafts share one CAS revision, journal and receipt. */
  @Remote('saveSceneWorkbench')
  async saveSceneWorkbench(input: unknown): Promise<SceneGraphSaveResult> {
    const request = SceneWorkbenchSaveRequestSchema.safeParse(input)
    if (!request.success) return { status: 'invalid' }
    const context = this.expectedContext
    if (!context || !this.store) return { status: 'unavailable' }
    const result = await this.store.saveWorkbench(request.data)
    const latest = this.expectedContext
    if (!latest || !sameScene3DContext(context, latest)) return { status: 'unknown' }
    const parsed = SceneGraphSaveResultSchema.safeParse(result)
    return parsed.success ? parsed.data : { status: 'unknown' }
  }

  /** Save a scene document against its base revision. Conflicts keep the caller's local draft. */
  @Remote('saveScene')
  async saveScene(input: unknown): Promise<SceneGraphSaveResult> {
    const request = SceneGraphSaveRequestSchema.safeParse(input)
    if (!request.success) return { status: 'invalid' }
    const context = this.expectedContext
    if (context === undefined || this.store === undefined) return { status: 'unavailable' }
    if (request.data.document.scope.workspaceRef !== context.workspaceRef
      || request.data.document.scope.projectRef !== context.projectRef) return { status: 'forbidden' }
    const result = await this.store.save(request.data)
    const latest = this.expectedContext
    if (latest === undefined || !sameScene3DContext(context, latest)) return { status: 'unknown' }
    const gate = SceneGraphSaveResultSchema.safeParse(result)
    // A save may already have landed when the exit gate trips; never claim success we cannot prove.
    return gate.success ? gate.data : { status: 'unknown' }
  }

  /** Reconcile a journaled save whose commit never settled. */
  @Remote('reconcileScene')
  async reconcileScene(input: unknown): Promise<SceneGraphSaveResult> {
    const context = this.expectedContext
    if (context === undefined || this.store === undefined) return { status: 'unavailable' }
    const result = await this.store.reconcile(input)
    const latest = this.expectedContext
    if (latest === undefined || !sameScene3DContext(context, latest)) return { status: 'unknown' }
    const gate = SceneGraphSaveResultSchema.safeParse(result)
    return gate.success ? gate.data : { status: 'unknown' }
  }

  /**
   * Import a GLB into a new workbench scene draft. The byte payload is resolved
   * through the mounted byte source and handed only to the gltf parser; the
   * result is a version-0 draft projection — persistence stays an explicit
   * saveScene call.
   */
  @Remote('importGlb')
  async importGlb(input: unknown): Promise<Scene3DImportGlbResultV1> {
    const context = this.expectedContext
    if (context === undefined) return { status: 'unavailable', reason: 'context_unavailable' }
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return { status: 'invalid', code: 'request_contract', reason: 'The import request failed the contract.' }
    const value = input as Record<string, unknown>
    const scope = parseScope(input)
    if (scope === undefined || !isSafeRef(value.sourceRef)
      || (value.documentId !== undefined && !isSafeRef(value.documentId))) {
      return { status: 'invalid', code: 'request_contract', reason: 'The import request failed the contract.' }
    }
    if (scope.workspaceRef !== context.workspaceRef || scope.projectRef !== context.projectRef) return { status: 'forbidden' }
    const source = this.ctx.get(SCENE_3D_GLB_BYTE_SOURCE as never) as Scene3DGlbByteSourceV1 | undefined
    if (source === undefined || typeof source.readGlb !== 'function') return { status: 'unavailable', reason: 'byte_source_unavailable' }
    let payload: Scene3DGlbBytesV1 | undefined
    try {
      payload = await source.readGlb(value.sourceRef)
    } catch {
      return { status: 'unavailable', reason: 'byte_source_failed' }
    }
    let latest = this.expectedContext
    if (latest === undefined || !sameScene3DContext(context, latest)) return { status: 'forbidden' }
    if (payload === undefined || !(payload.bytes instanceof Uint8Array)) return { status: 'missing', reason: 'source_not_found' }
    if (payload.truncated) return { status: 'too_large', size: payload.size }
    let parsed: Awaited<ReturnType<typeof importGlbToSceneDocument>>
    try {
      // The parser stamps the bound scope/id itself; the gateway still re-gates the result.
      parsed = await importGlbToSceneDocument(payload.bytes, {
        scope,
        ...(value.documentId === undefined ? {} : { documentId: value.documentId as string }),
      })
    } catch {
      return { status: 'invalid', code: 'parser_failed', reason: 'The GLB parser rejected the payload; nothing was imported.' }
    }
    latest = this.expectedContext
    if (latest === undefined || !sameScene3DContext(context, latest)) return { status: 'forbidden' }
    if (!parsed.ok) {
      if (parsed.code === 'too_large') return { status: 'too_large', size: payload.size }
      return { status: 'invalid', code: boundedReason(parsed.code), reason: boundedReason(parsed.reason) }
    }
    // Defense in depth: the imported draft must stay inside the bound scope at version 0.
    const document = parsed.document
    if (document.scope.workspaceRef !== context.workspaceRef || document.scope.projectRef !== context.projectRef
      || document.version !== 0) {
      return { status: 'contract_mismatch', reason: 'The imported scene escaped the bound context.' }
    }
    const gate = SceneDocumentSchema.safeParse(document)
    if (!gate.success) return { status: 'contract_mismatch', reason: 'The imported scene failed the scene document contract.' }
    const warnings = parsed.warnings
      .filter((warning): warning is string => typeof warning === 'string')
      .slice(0, MAX_WARNINGS)
      .map(boundedReason)
    return { status: 'imported', document: gate.data, warnings }
  }

  /**
   * Export the committed scene as GLB. The capability report is authoritative:
   * a non-ready export is blocked with its concrete gaps and never silently
   * discards data. Bytes leave only as a bounded base64 payload.
   */
  @Remote('exportGlb')
  async exportGlb(input: unknown): Promise<Scene3DExportGlbResultV1> {
    const request = SceneGraphReadRequestSchema.safeParse(input)
    if (!request.success) return { status: 'invalid' }
    const context = this.expectedContext
    if (context === undefined || this.store === undefined) return { status: 'unavailable' }
    if (request.data.scope.workspaceRef !== context.workspaceRef || request.data.scope.projectRef !== context.projectRef) {
      return { status: 'forbidden' }
    }
    const read = await this.store.read(request.data)
    let latest = this.expectedContext
    if (latest === undefined || !sameScene3DContext(context, latest)) return { status: 'forbidden' }
    if (read.status !== 'ready') {
      return { status: read.status === 'missing' ? 'missing' : read.status === 'forbidden' ? 'forbidden' : 'unavailable', reason: `scene_${read.status}` }
    }
    const report = documentReport(read.document)
    if (report === undefined) return { status: 'contract_mismatch', reason: 'The stored capability report failed the contract.' }
    if (!report.export.ready) {
      return { status: 'capability_blocked', gaps: report.export.gaps, reason: 'Export is blocked by capability gaps; nothing was discarded.' }
    }
    let exported: Awaited<ReturnType<typeof exportSceneDocumentToGlb>>
    try {
      exported = await exportSceneDocumentToGlb(read.document)
    } catch {
      return { status: 'error', reason: 'The GLB exporter failed; nothing was exported.' }
    }
    latest = this.expectedContext
    if (latest === undefined || !sameScene3DContext(context, latest)) return { status: 'forbidden' }
    if (!exported.ok) {
      return exported.gaps.length > 0 || exported.code === 'capability_blocked'
        ? { status: 'capability_blocked', gaps: exported.gaps, reason: boundedReason(exported.reason) }
        : { status: 'error', reason: boundedReason(exported.reason) }
    }
    const exportReport = reportOrFallback(exported.capabilityReport)
    if (exportReport === undefined) return { status: 'contract_mismatch', reason: 'The export capability report failed the contract.' }
    if (exported.bytes.byteLength > SCENE_3D_EXPORT_BYTE_LIMIT) return { status: 'too_large', size: exported.bytes.byteLength }
    return {
      status: 'exported',
      bytesBase64: Buffer.from(exported.bytes).toString('base64'),
      size: exported.bytes.byteLength,
      mediaType: 'model/gltf-binary',
      report: exportReport,
    }
  }

  /** List the append-only generation change sets recorded for one scene. */
  @Remote('listChangeSets')
  async listChangeSets(input: unknown): Promise<Scene3DChangeSetListResult> {
    const request = SceneGraphReadRequestSchema.safeParse(input)
    if (!request.success) return { status: 'invalid' }
    const context = this.expectedContext
    if (context === undefined || this.changeSets === undefined) return { status: 'unavailable' }
    if (request.data.scope.workspaceRef !== context.workspaceRef || request.data.scope.projectRef !== context.projectRef) {
      return { status: 'forbidden' }
    }
    const result = await this.changeSets.list(request.data)
    const latest = this.expectedContext
    if (latest === undefined || !sameScene3DContext(context, latest)) return { status: 'forbidden' }
    return result
  }

  /** Read-only preview descriptor for one change set: the audited entry plus its comparison baseline. */
  @Remote('previewChangeSet')
  async previewChangeSet(input: unknown): Promise<Scene3DChangeSetPreviewResultV1> {
    const parsed = parseChangeSetControlInput(input)
    if (parsed === undefined) return { status: 'invalid' }
    const context = this.expectedContext
    if (context === undefined || this.changeSets === undefined || this.store === undefined) return { status: 'unavailable' }
    if (parsed.scope.workspaceRef !== context.workspaceRef || parsed.scope.projectRef !== context.projectRef) {
      return { status: 'forbidden' }
    }
    const selector = { scope: parsed.scope, documentId: parsed.documentId }
    const listed = await this.changeSets.list(selector)
    let latest = this.expectedContext
    if (latest === undefined || !sameScene3DContext(context, latest)) return { status: 'forbidden' }
    if (listed.status !== 'ready') return { status: listed.status, ...(listed.reason === undefined ? {} : { reason: listed.reason }) }
    const changeSet = listed.changeSets.find(entry => entry.changeSetRef === parsed.changeSetRef)
    if (changeSet === undefined) return { status: 'missing' }
    const read = await this.store.read(selector)
    latest = this.expectedContext
    if (latest === undefined || !sameScene3DContext(context, latest)) return { status: 'forbidden' }
    const currentVersion = read.status === 'ready' ? read.document.version : 0
    const baseRevisionRetained = changeSet.baseVersion === currentVersion && currentVersion > 0
      ? true
      : changeSet.baseVersion > 0 && (await this.store.readVersion(parsed.scope, parsed.documentId, changeSet.baseVersion)) !== undefined
    latest = this.expectedContext
    if (latest === undefined || !sameScene3DContext(context, latest)) return { status: 'forbidden' }
    // list() already fail-closed gated every entry; re-gate the one leaving the gateway.
    const gate = GenerationChangeSetSchema.safeParse(changeSet)
    if (!gate.success) return { status: 'unavailable', reason: 'contract_mismatch' }
    return { status: 'ready', changeSet: gate.data, currentVersion, baseRevisionRetained }
  }

  /**
   * Accept a pending/preview change set: the submitted document is committed as
   * a new revision through the conflict-fenced save and the change set is
   * stamped accepted with its artifact ref and rollback pointer. A revision
   * conflict freezes the change set in place — never overwritten or retried.
   */
  @Remote('acceptChangeSet')
  async acceptChangeSet(input: unknown): Promise<Scene3DChangeSetAcceptResult> {
    const parsed = parseChangeSetControlInput(input)
    const value = typeof input === 'object' && input !== null ? input as Record<string, unknown> : undefined
    const save = SceneGraphSaveRequestSchema.safeParse({ requestId: value?.requestId, document: value?.document })
    const artifactRef = ArtifactRefSchema.safeParse(value?.artifactRef)
    if (parsed === undefined || !save.success || !artifactRef.success) return { status: 'invalid' }
    const context = this.expectedContext
    if (context === undefined || this.changeSets === undefined) return { status: 'unavailable' }
    if (parsed.scope.workspaceRef !== context.workspaceRef || parsed.scope.projectRef !== context.projectRef
      || save.data.document.scope.workspaceRef !== context.workspaceRef || save.data.document.scope.projectRef !== context.projectRef) {
      return { status: 'forbidden' }
    }
    const result = await this.changeSets.accept({
      scope: parsed.scope,
      documentId: parsed.documentId,
      changeSetRef: parsed.changeSetRef,
      requestId: save.data.requestId,
      document: save.data.document,
      artifactRef: artifactRef.data,
    })
    const latest = this.expectedContext
    if (latest === undefined || !sameScene3DContext(context, latest)) return { status: 'unknown', reason: 'context_changed' }
    return gateChangeSetCarrier(result, { status: 'unknown' as const, reason: 'contract_mismatch' })
  }

  /** Reject a pending/preview change set; the record stays, stamped rejected with an optional bounded reason. */
  @Remote('rejectChangeSet')
  async rejectChangeSet(input: unknown): Promise<Scene3DChangeSetTransitionResult> {
    const parsed = parseChangeSetControlInput(input)
    if (parsed === undefined) return { status: 'invalid' }
    const value = input as Record<string, unknown>
    if (value.reason !== undefined && typeof value.reason !== 'string') return { status: 'invalid' }
    const context = this.expectedContext
    if (context === undefined || this.changeSets === undefined) return { status: 'unavailable' }
    if (parsed.scope.workspaceRef !== context.workspaceRef || parsed.scope.projectRef !== context.projectRef) {
      return { status: 'forbidden' }
    }
    const result = await this.changeSets.transition({
      scope: parsed.scope,
      documentId: parsed.documentId,
      changeSetRef: parsed.changeSetRef,
      status: 'rejected',
      ...(typeof value.reason === 'string' ? { reason: boundedReason(value.reason) } : {}),
    })
    const latest = this.expectedContext
    if (latest === undefined || !sameScene3DContext(context, latest)) return { status: 'unavailable', reason: 'context_changed' }
    return gateChangeSetCarrier(result, { status: 'unavailable' as const, reason: 'contract_mismatch' })
  }

  /**
   * Roll back an accepted change set: the retained prior revision is
   * re-committed as a new scene version (append-only; no committed revision is
   * rewritten) and the change set is stamped rolled_back.
   */
  @Remote('rollbackChangeSet')
  async rollbackChangeSet(input: unknown): Promise<Scene3DChangeSetRollbackResult> {
    const parsed = parseChangeSetControlInput(input)
    const value = typeof input === 'object' && input !== null ? input as Record<string, unknown> : undefined
    if (parsed === undefined || !isSafeRef(value?.requestId)) return { status: 'invalid' }
    const context = this.expectedContext
    if (context === undefined || this.changeSets === undefined) return { status: 'unavailable' }
    if (parsed.scope.workspaceRef !== context.workspaceRef || parsed.scope.projectRef !== context.projectRef) {
      return { status: 'forbidden' }
    }
    const result = await this.changeSets.rollback({
      scope: parsed.scope,
      documentId: parsed.documentId,
      changeSetRef: parsed.changeSetRef,
      requestId: value.requestId as string,
    })
    const latest = this.expectedContext
    if (latest === undefined || !sameScene3DContext(context, latest)) return { status: 'unknown', reason: 'context_changed' }
    return gateChangeSetCarrier(result, { status: 'unknown' as const, reason: 'contract_mismatch' })
  }
}

interface ChangeSetControlInput {
  readonly scope: { readonly workspaceRef: string; readonly projectRef: string }
  readonly documentId: string
  readonly changeSetRef: string
}

function parseChangeSetControlInput(input: unknown): ChangeSetControlInput | undefined {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return undefined
  const value = input as Record<string, unknown>
  const request = SceneGraphReadRequestSchema.safeParse({ scope: value.scope, documentId: value.documentId })
  if (!request.success || !isSafeRef(value.changeSetRef)) return undefined
  return { scope: request.data.scope, documentId: request.data.documentId, changeSetRef: value.changeSetRef }
}

/** Fail-closed exit gate for results carrying a change-set entry: violations degrade, never emit partial truth. */
function gateChangeSetCarrier<T extends { readonly status: string }, F extends { readonly status: string; readonly reason: string }>(result: T, fallback: F): T | F {
  const entry = (result as { readonly changeSet?: unknown }).changeSet
  if (entry === undefined) return result
  return GenerationChangeSetSchema.safeParse(entry).success ? result : fallback
}

function documentReport(document: SceneDocumentV1): GltfCapabilityReportV1 | undefined {  try {
    return parseGltfCapabilityReport(document.capabilityReport)
  } catch {
    return undefined
  }
}

function reportOrFallback(report: unknown): GltfCapabilityReportV1 | undefined {
  try {
    return parseGltfCapabilityReport(report)
  } catch {
    return undefined
  }
}

export default SceneGraphGateway
