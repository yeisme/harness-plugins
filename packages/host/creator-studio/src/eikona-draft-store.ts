import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { DomainSpec, DomainTableSpec } from '@deepseek-ai/dsh-storage-domain'
import { eikonaDraftSchema, eikonaDraftQuerySchema, eikonaDraftSaveSchema, type EikonaDraft, type EikonaDraftReadResult, type EikonaDraftSaveResult } from './eikona-draft-contract.ts'
import type { CreatorStudioContextV1 } from './types.ts'

const requestId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u)
const query = eikonaDraftQuerySchema
const save = eikonaDraftSaveSchema
const receipt = z.object({ requestId, digest: z.string(), revision: z.number().int().positive().safe() }).strict()
const rowSchema = z.object({ draft: eikonaDraftSchema, receipts: z.array(receipt).max(32) }).strict()
type Row = z.infer<typeof rowSchema>
interface DraftDomain extends DomainSpec {
  readonly name: 'yeisme_eikona_drafts_v1'
  readonly version: 1
  readonly tables: { readonly drafts: DomainTableSpec<string, Row> }
}
export const eikonaDraftDomain: DraftDomain = { name: 'yeisme_eikona_drafts_v1', version: 1, tables: { drafts: { valueSchema: rowSchema } } }
export interface EikonaDraftStorage {
  open(spec: DraftDomain): Promise<{ table(name: 'drafts'): { get(key: string): unknown; put(key: string, value: Row): Promise<void> }; close(): Promise<void> }>
}

/** One instance per Host: all read/check/write operations share this queue. */
export class EikonaDraftStore {
  private domain: ReturnType<EikonaDraftStorage['open']> | undefined
  private tail: Promise<void> = Promise.resolve()
  private closed = false
  constructor(private storage: EikonaDraftStorage, private context: () => CreatorStudioContextV1 | undefined) {}
  private authorized(scope: EikonaDraft['scope']) {
    const current = this.context()
    return !this.closed && current !== undefined && current.tenantRef === scope.tenantRef && current.workspaceRef === scope.workspaceRef && current.projectRef === scope.projectRef
  }
  private key(scope: EikonaDraft['scope'], id: string) { return JSON.stringify([scope.tenantRef, scope.workspaceRef, scope.projectRef, id]) }
  private async table() {
    if (this.closed) throw new Error('draft store closed')
    if (!this.domain) {
      const opened = this.storage.open(eikonaDraftDomain)
      this.domain = opened
      void opened.catch(() => { if (this.domain === opened) this.domain = undefined })
    }
    return (await this.domain).table('drafts')
  }
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work)
    this.tail = result.then(() => undefined, () => undefined)
    return result
  }
  read(input: unknown): Promise<EikonaDraftReadResult> {
    const parsed = query.safeParse(input)
    if (!parsed.success) return Promise.resolve({ status: 'invalid' })
    const { scope, id } = parsed.data
    const context = JSON.stringify(this.context())
    return this.enqueue(async (): Promise<EikonaDraftReadResult> => {
      if (!this.authorized(scope) || JSON.stringify(this.context()) !== context) return { status: 'forbidden' }
      try {
        const table = await this.table()
        if (!this.authorized(scope) || JSON.stringify(this.context()) !== context) return { status: 'forbidden' }
        const raw = table.get(this.key(scope, id))
        if (raw === undefined) return { status: 'missing' }
        const row = rowSchema.safeParse(raw)
        if (!row.success || this.key(row.data.draft.scope, row.data.draft.id) !== this.key(scope, id)) return { status: 'error' }
        return { status: 'ready', draft: row.data.draft }
      } catch { return { status: 'error' } }
    })
  }
  save(input: unknown): Promise<EikonaDraftSaveResult> {
    const parsed = save.safeParse(input)
    if (!parsed.success) return Promise.resolve({ status: 'invalid' })
    const { draft, requestId: id } = parsed.data
    const context = JSON.stringify(this.context())
    const digest = createHash('sha256').update(JSON.stringify(draft)).digest('hex')
    return this.enqueue(async (): Promise<EikonaDraftSaveResult> => {
      let writing = false
      const valid = () => this.authorized(draft.scope) && JSON.stringify(this.context()) === context
      if (!valid()) return { status: 'forbidden' }
      try {
        const table = await this.table()
        if (!valid()) return { status: 'forbidden' }
        const key = this.key(draft.scope, draft.id), raw = table.get(key)
        const existing = raw === undefined ? undefined : rowSchema.parse(raw)
        if (existing && this.key(existing.draft.scope, existing.draft.id) !== key) return { status: 'error' }
        const prior = existing?.receipts.find(item => item.requestId === id)
        if (prior) return prior.digest === digest ? { status: 'saved', requestId: id, revision: prior.revision } : { status: 'conflict' }
        if (draft.revision !== (existing?.draft.revision ?? 0) || draft.revision === Number.MAX_SAFE_INTEGER) return { status: 'conflict' }
        const revision = draft.revision + 1
        writing = true
        await table.put(key, { draft: { ...draft, revision }, receipts: [...(existing?.receipts ?? []), { requestId: id, digest, revision }].slice(-32) })
        if (!valid()) return { status: 'unknown' }
        return { status: 'saved', requestId: id, revision }
      } catch { return { status: writing ? 'unknown' : 'error' } }
    })
  }
  reconcile(input: unknown): Promise<EikonaDraftSaveResult> {
    const parsed = query.extend({ requestId }).safeParse(input)
    if (!parsed.success) return Promise.resolve({ status: 'invalid' })
    const { scope, id, requestId: request } = parsed.data
    const context = JSON.stringify(this.context())
    return this.enqueue(async (): Promise<EikonaDraftSaveResult> => {
      const valid = () => this.authorized(scope) && JSON.stringify(this.context()) === context
      if (!valid()) return { status: 'forbidden' }
      try {
        const table = await this.table()
        if (!valid()) return { status: 'forbidden' }
        const row = rowSchema.safeParse(table.get(this.key(scope, id)))
        if (!row.success || this.key(row.data.draft.scope, row.data.draft.id) !== this.key(scope, id)) return { status: 'unknown' }
        const found = row.data.receipts.find(item => item.requestId === request)
        return found ? { status: 'saved', requestId: request, revision: found.revision } : { status: 'unknown' }
      } catch { return { status: 'unknown' } }
    })
  }
  async close() {
    this.closed = true
    await this.tail
    await (await this.domain)?.close()
  }
}
