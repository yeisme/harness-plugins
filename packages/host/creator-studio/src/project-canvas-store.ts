import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { DomainSpec, DomainTableSpec } from '@deepseek-ai/dsh-storage-domain'
import {
  ProjectCanvasDocumentSchema, ProjectCanvasReadRequestSchema, ProjectCanvasSaveRequestSchema, ProjectCanvasReconcileRequestSchema,
  type ProjectCanvasDocument, type ProjectCanvasDraft, type ProjectCanvasScope, type ProjectCanvasReadResult, type ProjectCanvasSaveResult,
} from '@yeisme/dsh-pane-protocol'
import type { CreatorStudioContextV1 } from './types.ts'

const ReceiptSchema = z.object({ requestId: z.string(), digest: z.string(), revision: z.number().int().positive() }).strict()
/** Write-ahead save intent: present only while a commit never settled, so reconcile can answer definitively. */
const InflightSchema = z.object({ requestId: z.string(), digest: z.string(), baseRevision: z.number().int().nonnegative().safe(), document: ProjectCanvasDocumentSchema }).strict()
export const projectCanvasRowSchema = z.object({ document: ProjectCanvasDocumentSchema, receipts: z.array(ReceiptSchema).max(32), inflight: InflightSchema.optional() }).strict()
type Row = z.infer<typeof projectCanvasRowSchema>
export interface ProjectCanvasDomainSpec extends DomainSpec {
  readonly name: 'yeisme_project_canvas_v1'
  readonly version: 1
  readonly tables: { readonly documents: DomainTableSpec<string, Row> }
}
export const projectCanvasDomainSpec: ProjectCanvasDomainSpec = {
  name: 'yeisme_project_canvas_v1', version: 1, tables: { documents: { valueSchema: projectCanvasRowSchema } },
}
export interface ProjectCanvasTable {
  get(key: string): unknown
  put(key: string, value: Row): Promise<void>
}
export interface ProjectCanvasStorage {
  open(spec: ProjectCanvasDomainSpec): Promise<{ table(name: 'documents'): ProjectCanvasTable; close(): Promise<void> }>
}

/** One storage-domain owner per Host; serialize read/check/write in that owner, not in each Pane. */
export class ProjectCanvasStore {
  private domain: ReturnType<ProjectCanvasStorage['open']> | undefined
  private tail: Promise<void> = Promise.resolve()
  private closed = false
  constructor(private readonly storage: ProjectCanvasStorage, private readonly context: () => CreatorStudioContextV1 | undefined) {}

  private current(scope: ProjectCanvasScope): CreatorStudioContextV1 | undefined {
    const context = this.context()
    return !this.closed && context?.workspaceRef === scope.workspaceRef && context.projectRef === scope.projectRef ? structuredClone(context) : undefined
  }

  private async table(): Promise<ProjectCanvasTable> {
    if (this.closed) throw new Error('canvas storage closed')
    if (this.domain === undefined) {
      const opened = this.storage.open(projectCanvasDomainSpec)
      this.domain = opened
      void opened.catch(() => { if (this.domain === opened) this.domain = undefined })
    }
    return (await this.domain).table('documents')
  }

  private key(context: CreatorStudioContextV1, documentId: string): string {
    return JSON.stringify([context.tenantRef, context.workspaceRef, context.projectRef, documentId])
  }

  private unchanged(before: CreatorStudioContextV1, scope: ProjectCanvasScope): boolean {
    return JSON.stringify(this.current(scope)) === JSON.stringify(before)
  }

  async read(input: unknown): Promise<ProjectCanvasReadResult> {
    const request = ProjectCanvasReadRequestSchema.safeParse(input)
    if (!request.success) return { status: 'invalid' }
    const context = this.current(request.data.scope)
    if (context === undefined) return { status: 'forbidden' }
    try {
      await this.tail
      const table = await this.table()
      if (!this.unchanged(context, request.data.scope)) return { status: 'forbidden' }
      const raw = table.get(this.key(context, request.data.documentId))
      if (raw === undefined) return { status: 'missing' }
      const row = projectCanvasRowSchema.safeParse(raw)
      if (!row.success || !this.matches(row.data.document, request.data.scope, request.data.documentId)) return { status: 'error' }
      const draft = this.draftOf(row.data, request.data)
      // A committed row is always at revision >= 1; revision 0 exists only as an unconfirmed write-ahead placeholder.
      if (row.data.document.revision === 0) return draft === undefined ? { status: 'missing' } : { status: 'missing', ...draft }
      return { status: 'ready', document: row.data.document, ...(draft ?? {}) }
    } catch { return { status: 'error' } }
  }

  private matches(document: ProjectCanvasDocument, scope: ProjectCanvasScope, id: string): boolean {
    return document.scope.workspaceRef === scope.workspaceRef && document.scope.projectRef === scope.projectRef && document.id === id
  }

  /** The journal is only surfaced when it still matches this scope and document; it never fabricates a confirmed document. */
  private draftOf(row: Row, request: z.infer<typeof ProjectCanvasReadRequestSchema>): { draft: ProjectCanvasDraft } | undefined {
    const inflight = row.inflight
    if (inflight === undefined || !this.matches(inflight.document, request.scope, request.documentId)
      || inflight.baseRevision !== row.document.revision) return undefined
    return { draft: { requestId: inflight.requestId, baseRevision: inflight.baseRevision, document: inflight.document } }
  }

  async reconcile(input: unknown): Promise<ProjectCanvasSaveResult> {
    const request = ProjectCanvasReconcileRequestSchema.safeParse(input)
    if (!request.success) return { status: 'invalid' }
    const context = this.current(request.data.scope)
    if (context === undefined) return { status: 'forbidden' }
    try {
      await this.tail
      const table = await this.table()
      if (!this.unchanged(context, request.data.scope)) return { status: 'forbidden' }
      const row = projectCanvasRowSchema.safeParse(table.get(this.key(context, request.data.documentId)))
      if (!row.success || !this.matches(row.data.document, request.data.scope, request.data.documentId)) return { status: 'unknown' }
      const receipt = row.data.receipts.find(item => item.requestId === request.data.requestId)
      if (receipt !== undefined) return { status: 'saved', requestId: receipt.requestId, revision: receipt.revision }
      const inflight = row.data.inflight
      if (inflight?.requestId !== request.data.requestId) return { status: 'unknown' }
      // The commit write is a single atomic row put: no receipt with a live journal means it never landed.
      const settled: ProjectCanvasSaveResult = { status: 'not_applied', requestId: inflight.requestId }
      try { await table.put(this.key(context, request.data.documentId), { document: row.data.document, receipts: row.data.receipts }) }
      catch { /* The settlement stays factual even if clearing the journal fails; a retry settles again. */ }
      return settled
    } catch { return { status: 'unknown' } }
  }

  save(input: unknown): Promise<ProjectCanvasSaveResult> {
    const request = ProjectCanvasSaveRequestSchema.safeParse(input)
    if (!request.success) return Promise.resolve({ status: 'invalid' })
    const { document, requestId } = request.data
    const context = this.current(document.scope)
    if (context === undefined) return Promise.resolve({ status: 'forbidden' })
    const work = this.tail.then(async (): Promise<ProjectCanvasSaveResult> => {
      let writing = false
      try {
        const table = await this.table()
        if (!this.unchanged(context, document.scope)) return { status: 'forbidden' }
        const key = this.key(context, document.id)
        const raw = table.get(key)
        const parsed = raw === undefined ? undefined : projectCanvasRowSchema.safeParse(raw)
        if (parsed !== undefined && (!parsed.success || !this.matches(parsed.data.document, document.scope, document.id))) return { status: 'unavailable' }
        const row = parsed?.success ? parsed.data : undefined
        const revision = row?.document.revision ?? 0
        const digest = createHash('sha256').update(JSON.stringify(document)).digest('hex')
        const previous = row?.receipts.find(receipt => receipt.requestId === requestId)
        if (previous !== undefined) return previous.digest === digest
          ? { status: 'saved', requestId, revision: previous.revision }
          : { status: 'conflict', revision }
        // An unsettled intent for another request must be reconciled first; a new save must not overwrite its journal.
        if (row?.inflight !== undefined && row.inflight.requestId !== requestId) return { status: 'unknown' }
        if (document.revision !== revision) return { status: 'conflict', revision }
        if (!Number.isSafeInteger(revision + 1)) return { status: 'unavailable' }
        // Write-ahead journal: if the commit below never settles, reconcile can answer not_applied and
        // a later session can still recover the submitted document instead of guessing.
        await table.put(key, projectCanvasRowSchema.parse({
          document: row?.document ?? { ...document, revision },
          receipts: row?.receipts ?? [],
          inflight: { requestId, digest, baseRevision: revision, document },
        }))
        writing = true
        const next = projectCanvasRowSchema.parse({ document: { ...document, revision: revision + 1 },
          receipts: [...(row?.receipts ?? []), { requestId, digest, revision: revision + 1 }].slice(-32) })
        await table.put(key, next)
        return { status: 'saved', requestId, revision: next.document.revision }
      } catch { return { status: writing ? 'unknown' : 'unavailable' } }
    })
    this.tail = work.then(() => undefined, () => undefined)
    return work
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    await this.tail
    const domain = this.domain
    if (domain !== undefined) await (await domain.catch(() => undefined))?.close()
  }
}
