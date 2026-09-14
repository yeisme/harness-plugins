/**
 * SceneGraphStore — revisioned persistence for the 3D Director workbench scene
 * graph (dsh-3d-director-gltf-workbench-v1, Group 2.2/2.4).
 *
 * Mirrors the Creator Studio project-canvas store contract
 * (packages/host/creator-studio/src/project-canvas-store.ts) on the pane-protocol
 * SCENE_3D_SCHEMA family:
 * - one storage-domain owner per Host; read/check/write serialized on a single
 *   tail promise inside that owner, never per Pane;
 * - key pattern `[tenantRef, workspaceRef, projectRef, sceneRef]`, so tenants
 *   are isolated while sessions of one project share content;
 * - save validates the base revision (document.version) before writing; a
 *   mismatch returns `conflict` and never overwrites, retries, or replaces the
 *   writer — the caller keeps its local draft;
 * - a write-ahead journal preserves a save intent whose commit never settled,
 *   so `reconcile` can answer `saved` / `not_applied` definitively and a later
 *   session can recover the submitted document as a draft;
 * - every committed save retains the previous committed document in a bounded
 *   `history` ring so generation change sets can roll back without a second
 *   writer;
 * - a missing storage seam degrades honestly to `unavailable`; nothing is
 *   fabricated.
 *
 * The store owns no domain truth beyond workbench scene graph drafts: domain
 * assets, generation runs, approvals and delivery facts stay with their owners.
 * zod is not a direct dependency of this package, so row envelopes are
 * validated by composing the pane-protocol zod schemas with structural checks;
 * the runtime domain facility only calls `valueSchema.parse` at open time.
 *
 * @module @yeisme/dsh-3d-director-host/scene-store
 */

import { createHash } from 'node:crypto'
import {
  GenerationChangeSetSchema,
  SceneDocumentSchema,
  ShotSchema,
  SceneWorkbenchSaveRequestSchema,
  type ShotV1,
  type SceneWorkbenchReadResult,
  SceneGraphReadRequestSchema,
  SceneGraphReconcileRequestSchema,
  SceneGraphSaveRequestSchema,
  type GenerationChangeSetV1,
  type ProjectCanvasScope,
  type SceneDocumentV1,
  type SceneGraphDraft,
  type SceneGraphReadResult,
  type SceneGraphSaveResult,
} from '@yeisme/dsh-pane-protocol'

/** Bounded server-injected context the store fences every access against. */
export interface Scene3DStoreContextV1 {
  readonly tenantRef: string
  readonly workspaceRef: string
  readonly projectRef: string
}

const MAX_RECEIPTS = 32
/** Retained committed revisions available to change-set rollback. */
export const SCENE_3D_HISTORY_LIMIT = 8
const MAX_CHANGE_SETS_PER_SCENE = 256
const MAX_STORE_KEY_PART = 512
const MAX_DIGEST = 160

interface SceneGraphReceiptV1 {
  readonly requestId: string
  readonly digest: string
  readonly version: number
}

/** Write-ahead save intent: present only while a commit never settled. */
interface SceneGraphInflightV1 {
  readonly shots?: readonly ShotV1[]

  readonly requestId: string
  readonly digest: string
  readonly baseVersion: number
  readonly document: SceneDocumentV1
}

/**
 * One retained history-ring entry: the previously committed workbench payload
 * (scene document plus, when the save carried them, its previsualization
 * shots). Rollback re-commits the whole payload — restoring only the document
 * would silently drop the historical previz state (dsh-screenplay-production-
 * continuity-v1 task 4.1 rollback leg). Entries written before the envelope
 * shape persisted as bare documents and stay readable (parseSceneGraphRow).
 */
export interface SceneGraphHistoryEntryV1 {
  readonly document: SceneDocumentV1
  readonly shots?: readonly ShotV1[]
}

export interface SceneGraphRowV1 {
  readonly shots?: readonly ShotV1[]

  readonly document: SceneDocumentV1
  readonly receipts: readonly SceneGraphReceiptV1[]
  readonly inflight?: SceneGraphInflightV1
  /** Bounded ring of previously committed workbench payloads (oldest first) for rollback. */
  readonly history: readonly SceneGraphHistoryEntryV1[]
}

/** Append-only per-scene generation change-set row. */
export interface Scene3DChangeSetRowV1 {
  readonly changeSets: readonly GenerationChangeSetV1[]
}

function isBoundedId(value: unknown, max = MAX_STORE_KEY_PART): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001F\u007F]/.test(value)
}

function isSafeVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function parseReceipt(input: unknown): SceneGraphReceiptV1 | undefined {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return undefined
  const value = input as Record<string, unknown>
  if (!isBoundedId(value.requestId) || !isBoundedId(value.digest, MAX_DIGEST) || !isSafeVersion(value.version) || value.version < 1) return undefined
  return { requestId: value.requestId, digest: value.digest, version: value.version }
}

function parseShots(input: unknown): ShotV1[] | undefined {
  if (input === undefined) return undefined
  if (!Array.isArray(input) || input.length > 1000) throw new Error('Invalid previsualization shots')
  const shots = input.map(value => ShotSchema.parse(value))
  if (new Set(shots.map(shot => shot.shotRef)).size !== shots.length) throw new Error('Duplicate previsualization shot')
  return shots
}

function parseInflight(input: unknown): SceneGraphInflightV1 | undefined {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return undefined
  const value = input as Record<string, unknown>
  if (!isBoundedId(value.requestId) || !isBoundedId(value.digest, MAX_DIGEST) || !isSafeVersion(value.baseVersion)) return undefined
  const document = SceneDocumentSchema.safeParse(value.document)
  if (!document.success) return undefined
  return { requestId: value.requestId, digest: value.digest, baseVersion: value.baseVersion, document: document.data, ...(value.shots === undefined ? {} : { shots: parseShots(value.shots) }) }
}

export function parseSceneGraphRow(input: unknown): SceneGraphRowV1 {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('scene graph row must be an object')
  const value = input as Record<string, unknown>
  const document = SceneDocumentSchema.safeParse(value.document)
  if (!document.success) throw new Error('scene graph row document failed the scene document contract')
  if (!Array.isArray(value.receipts) || value.receipts.length > MAX_RECEIPTS) throw new Error('scene graph row receipts are invalid')
  const receipts = value.receipts.map(parseReceipt)
  if (receipts.some(receipt => receipt === undefined)) throw new Error('scene graph row receipt failed validation')
  const inflight = value.inflight === undefined ? undefined : parseInflight(value.inflight)
  if (value.inflight !== undefined && inflight === undefined) throw new Error('scene graph row journal failed validation')
  if (!Array.isArray(value.history) || value.history.length > SCENE_3D_HISTORY_LIMIT) throw new Error('scene graph row history is invalid')
  const history = value.history.map(parseHistoryEntry)
  return { ...(value.shots === undefined ? {} : { shots: parseShots(value.shots) }), document: document.data, receipts: receipts as SceneGraphReceiptV1[], ...(inflight === undefined ? {} : { inflight }), history }
}

/**
 * History entries cross as `{ document, shots? }` envelopes; bare documents are
 * the pre-envelope persisted shape and stay readable with no shots (a legacy
 * entry never fabricates a historical previz state it did not retain).
 */
function parseHistoryEntry(input: unknown): SceneGraphHistoryEntryV1 {
  const bare = SceneDocumentSchema.safeParse(input)
  if (bare.success) return { document: bare.data }
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('scene graph row history is invalid')
  const value = input as Record<string, unknown>
  const parsed = SceneDocumentSchema.safeParse(value.document)
  if (!parsed.success) throw new Error('scene graph row history entry failed the scene document contract')
  return { ...(value.shots === undefined ? {} : { shots: parseShots(value.shots) }), document: parsed.data }
}

export function parseScene3DChangeSetRow(input: unknown): Scene3DChangeSetRowV1 {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('change-set row must be an object')
  const value = input as Record<string, unknown>
  if (!Array.isArray(value.changeSets) || value.changeSets.length > MAX_CHANGE_SETS_PER_SCENE) throw new Error('change-set row entries are invalid')
  const changeSets = value.changeSets.map(entry => {
    const parsed = GenerationChangeSetSchema.safeParse(entry)
    if (!parsed.success) throw new Error('change-set row entry failed the generation change set contract')
    return parsed.data
  })
  return { changeSets }
}

/**
 * Domain declaration for the 3D Director scene graph. Opened exactly once per
 * Host (the domain facility enforces single-open per name); the change-set log
 * reuses the store's handle instead of opening the domain again. Table names
 * are lowercase snake_case: the real DSH storage backend rejects camelCase
 * table names (UNIT_NAME_RE), so `change_sets` is the only openable spelling.
 */
export const scene3dDomainSpec = {
  name: 'yeisme_scene_3d_graph_v1',
  version: 1,
  tables: {
    documents: { valueSchema: { parse: parseSceneGraphRow } },
    change_sets: { valueSchema: { parse: parseScene3DChangeSetRow } },
  },
} as const
export type Scene3DDomainSpec = typeof scene3dDomainSpec

export interface Scene3DDocumentsTable {
  get(key: string): unknown
  put(key: string, value: SceneGraphRowV1): Promise<void>
}
export interface Scene3DChangeSetsTable {
  get(key: string): unknown
  put(key: string, value: Scene3DChangeSetRowV1): Promise<void>
}
export interface Scene3DDomain {
  table(name: 'documents'): Scene3DDocumentsTable
  table(name: 'change_sets'): Scene3DChangeSetsTable
  close(): Promise<void>
}
export interface Scene3DStorage {
  open(spec: Scene3DDomainSpec): Promise<Scene3DDomain>
}

/** One storage-domain owner per Host; serialize read/check/write in that owner, not in each Pane. */
export class SceneGraphStore {
  private domain: Promise<Scene3DDomain> | undefined
  private tail: Promise<void> = Promise.resolve()
  private closed = false
  constructor(private readonly storage: Scene3DStorage, private readonly context: () => Scene3DStoreContextV1 | undefined) {}

  private current(scope: ProjectCanvasScope): Scene3DStoreContextV1 | undefined {
    const context = this.context()
    return !this.closed && context?.workspaceRef === scope.workspaceRef && context.projectRef === scope.projectRef
      ? structuredClone(context)
      : undefined
  }

  /** Scope-checked context snapshot for trusted collaborators (the change-set log). */
  contextFor(scope: ProjectCanvasScope): Scene3DStoreContextV1 | undefined {
    return this.current(scope)
  }

  private async domainHandle(): Promise<Scene3DDomain> {
    if (this.closed) throw new Error('scene graph storage closed')
    if (this.domain === undefined) {
      const opened = this.storage.open(scene3dDomainSpec)
      this.domain = opened
      void opened.catch(() => { if (this.domain === opened) this.domain = undefined })
    }
    return this.domain
  }

  private async documents(): Promise<Scene3DDocumentsTable> {
    return (await this.domainHandle()).table('documents')
  }

  private key(context: Scene3DStoreContextV1, documentId: string): string {
    return JSON.stringify([context.tenantRef, context.workspaceRef, context.projectRef, documentId])
  }

  private unchanged(before: Scene3DStoreContextV1, scope: ProjectCanvasScope): boolean {
    return JSON.stringify(this.current(scope)) === JSON.stringify(before)
  }

  private matches(document: SceneDocumentV1, scope: ProjectCanvasScope, id: string): boolean {
    return document.scope.workspaceRef === scope.workspaceRef && document.scope.projectRef === scope.projectRef && document.id === id
  }

  /** The journal is only surfaced when it still matches this scope and document; it never fabricates a confirmed document. */
  private draftOf(row: SceneGraphRowV1, request: { scope: ProjectCanvasScope; documentId: string }): { draft: SceneGraphDraft } | undefined {
    const inflight = row.inflight
    if (inflight === undefined || !this.matches(inflight.document, request.scope, request.documentId)
      || inflight.baseVersion !== row.document.version) return undefined
    return { draft: { requestId: inflight.requestId, baseVersion: inflight.baseVersion, document: inflight.document } }
  }

  async read(input: unknown): Promise<SceneGraphReadResult> { return (await this.readWorkbench(input)).result }

  async readWorkbench(input: unknown): Promise<SceneWorkbenchReadResult> {
    const wrap = (result: SceneGraphReadResult, shots?: readonly ShotV1[]): SceneWorkbenchReadResult => ({ schema: 'dsh.scene-workbench.v1', result, ...(shots === undefined ? {} : { shots: [...shots] }) })
    const request = SceneGraphReadRequestSchema.safeParse(input)
    if (!request.success) return wrap({ status: 'invalid' })
    const context = this.current(request.data.scope)
    if (context === undefined) return wrap({ status: 'forbidden' })
    try {
      await this.tail
      const table = await this.documents()
      if (!this.unchanged(context, request.data.scope)) return wrap({ status: 'forbidden' })
      const raw = table.get(this.key(context, request.data.documentId))
      if (raw === undefined) return wrap({ status: 'missing' })
      const row = parseSceneGraphRow(raw)
      if (!this.matches(row.document, request.data.scope, request.data.documentId)) return wrap({ status: 'error' })
      const draft = this.draftOf(row, request.data)
      // A committed row is always at version >= 1; version 0 exists only as an unconfirmed write-ahead placeholder.
      if (row.document.version === 0) return wrap(draft === undefined ? { status: 'missing' } : { status: 'missing', ...draft }, row.inflight?.shots ?? row.shots)
      return wrap({ status: 'ready', document: row.document, ...(draft ?? {}) }, draft ? row.inflight?.shots ?? row.shots : row.shots)
    } catch { return wrap({ status: 'error' }) }
  }

  async reconcile(input: unknown): Promise<SceneGraphSaveResult> {
    const request = SceneGraphReconcileRequestSchema.safeParse(input)
    if (!request.success) return { status: 'invalid' }
    const context = this.current(request.data.scope)
    if (context === undefined) return { status: 'forbidden' }
    try {
      await this.tail
      const table = await this.documents()
      if (!this.unchanged(context, request.data.scope)) return { status: 'forbidden' }
      const raw = table.get(this.key(context, request.data.documentId))
      const row = raw === undefined ? undefined : parseSceneGraphRow(raw)
      if (row === undefined || !this.matches(row.document, request.data.scope, request.data.documentId)) return { status: 'unknown' }
      const receipt = row.receipts.find(item => item.requestId === request.data.requestId)
      if (receipt !== undefined) return { status: 'saved', requestId: receipt.requestId, version: receipt.version }
      const inflight = row.inflight
      if (inflight?.requestId !== request.data.requestId) return { status: 'unknown' }
      // The commit write is a single atomic row put: no receipt with a live journal means it never landed.
      const settled: SceneGraphSaveResult = { status: 'not_applied', requestId: inflight.requestId }
      try { await table.put(this.key(context, request.data.documentId), { document: row.document, receipts: row.receipts, history: row.history, ...(row.shots === undefined ? {} : { shots: row.shots }) }) }
      catch { /* The settlement stays factual even if clearing the journal fails; a retry settles again. */ }
      return settled
    } catch { return { status: 'unknown' } }
  }

  saveWorkbench(input: unknown): Promise<SceneGraphSaveResult> {
    const request = SceneWorkbenchSaveRequestSchema.safeParse(input)
    if (!request.success) return Promise.resolve({ status: 'invalid' })
    try { parseShots(request.data.shots) } catch { return Promise.resolve({ status: 'invalid' }) }
    return this.save({ requestId: request.data.requestId, document: request.data.document }, request.data.shots)
  }

  save(input: unknown, shots?: readonly ShotV1[]): Promise<SceneGraphSaveResult> {
    const request = SceneGraphSaveRequestSchema.safeParse(input)
    if (!request.success) return Promise.resolve({ status: 'invalid' })
    const { document, requestId } = request.data
    const context = this.current(document.scope)
    if (context === undefined) return Promise.resolve({ status: 'forbidden' })
    const work = this.tail.then(async (): Promise<SceneGraphSaveResult> => {
      let writing = false
      try {
        const table = await this.documents()
        if (!this.unchanged(context, document.scope)) return { status: 'forbidden' }
        const key = this.key(context, document.id)
        const raw = table.get(key)
        let row: SceneGraphRowV1 | undefined
        if (raw !== undefined) {
          row = parseSceneGraphRow(raw)
          if (!this.matches(row.document, document.scope, document.id)) return { status: 'unavailable' }
        }
        const version = row?.document.version ?? 0
        const digest = createHash('sha256').update(JSON.stringify(shots === undefined ? document : { document, shots })).digest('hex')
        const previous = row?.receipts.find(receipt => receipt.requestId === requestId)
        if (previous !== undefined) return previous.digest === digest
          ? { status: 'saved', requestId, version: previous.version }
          : { status: 'conflict', version }
        // An unsettled intent for another request must be reconciled first; a new save must not overwrite its journal.
        if (row?.inflight !== undefined && row.inflight.requestId !== requestId) return { status: 'unknown' }
        // Base revision fence: a stale writer conflicts and keeps its local draft; nothing is overwritten or retried.
        if (document.version !== version) return { status: 'conflict', version }
        if (!Number.isSafeInteger(version + 1)) return { status: 'unavailable' }
        // Write-ahead journal: if the commit below never settles, reconcile can answer not_applied and
        // a later session can still recover the submitted document instead of guessing.
        await table.put(key, parseSceneGraphRow({
          document: row?.document ?? { ...document, version },
          receipts: row?.receipts ?? [],
          history: row?.history ?? [],
          ...(row?.shots === undefined ? {} : { shots: row.shots }),
          inflight: { requestId, digest, baseVersion: version, document, ...(shots === undefined ? {} : { shots }) },
        }))
        writing = true
        // Retain the previously committed payload (document AND its committed
        // shots): rollback must restore the historical previz state, not just
        // the scene graph (task 4.1 rollback leg).
        const history: SceneGraphHistoryEntryV1[] = [
          ...(row?.history ?? []),
          ...(row === undefined || row.document.version === 0 ? [] : [{ document: row.document, ...(row.shots === undefined ? {} : { shots: row.shots }) }]),
        ].slice(-SCENE_3D_HISTORY_LIMIT)
        const next = parseSceneGraphRow({ document: { ...document, version: version + 1 },
          receipts: [...(row?.receipts ?? []), { requestId, digest, version: version + 1 }].slice(-MAX_RECEIPTS),
          history, ...((shots ?? row?.shots) === undefined ? {} : { shots: shots ?? row?.shots }) })
        await table.put(key, next)
        return { status: 'saved', requestId, version: next.document.version }
      } catch { return { status: writing ? 'unknown' : 'unavailable' } }
    })
    this.tail = work.then(() => undefined, () => undefined)
    return work
  }

  /**
   * Read one committed revision (current or retained history) for change-set
   * rollback. Returns undefined when the revision was never committed or fell
   * out of the bounded history ring; never fabricates content.
   */
  async readVersion(scope: ProjectCanvasScope, documentId: string, version: number): Promise<SceneDocumentV1 | undefined> {
    return (await this.readWorkbenchVersion(scope, documentId, version))?.document
  }

  /**
   * Read one committed workbench payload (scene document plus its retained
   * previsualization shots) for change-set rollback. `shots` is present only
   * when the historical revision actually committed shots — a legacy ring entry
   * reports none instead of fabricating them, and the caller decides whether
   * the current shots stay (save-without-shots semantics).
   */
  async readWorkbenchVersion(scope: ProjectCanvasScope, documentId: string, version: number): Promise<SceneGraphHistoryEntryV1 | undefined> {
    const context = this.current(scope)
    if (context === undefined || !isSafeVersion(version)) return undefined
    try {
      await this.tail
      const table = await this.documents()
      if (!this.unchanged(context, scope)) return undefined
      const raw = table.get(this.key(context, documentId))
      if (raw === undefined) return undefined
      const row = parseSceneGraphRow(raw)
      if (!this.matches(row.document, scope, documentId)) return undefined
      if (row.document.version === version && row.document.version > 0) {
        return { document: row.document, ...(row.shots === undefined ? {} : { shots: row.shots }) }
      }
      return row.history.find(entry => entry.document.version === version)
    } catch { return undefined }
  }

  /** Serialized change-set row read for the append-only generation log. */
  async readChangeSetRow(scope: ProjectCanvasScope, documentId: string): Promise<Scene3DChangeSetRowV1 | undefined> {
    const context = this.current(scope)
    if (context === undefined) return undefined
    await this.tail
    const table = (await this.domainHandle()).table('change_sets')
    if (!this.unchanged(context, scope)) return undefined
    const raw = table.get(this.key(context, documentId))
    if (raw === undefined) return undefined
    return parseScene3DChangeSetRow(raw)
  }

  /** Serialized change-set row write for the append-only generation log. */
  async writeChangeSetRow(scope: ProjectCanvasScope, documentId: string, row: Scene3DChangeSetRowV1): Promise<void> {
    const context = this.current(scope)
    if (context === undefined) throw new Error('scene graph context unavailable')
    const work = this.tail.then(async () => {
      const table = (await this.domainHandle()).table('change_sets')
      if (!this.unchanged(context, scope)) throw new Error('scene graph context changed')
      await table.put(this.key(context, documentId), parseScene3DChangeSetRow(row))
    })
    this.tail = work.then(() => undefined, () => undefined)
    return work
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    await this.tail
    const domain = this.domain
    this.domain = undefined
    if (domain !== undefined) await (await domain.catch(() => undefined))?.close()
  }
}
