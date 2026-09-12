import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { DomainSpec, DomainTableSpec } from '@deepseek-ai/dsh-storage-domain'
import { PaneActionRequestSchema, PaneActionReconcileRequestSchema, type PaneContextV1 } from '@yeisme/dsh-pane-protocol'
import type { CreatorStudioContextV1 } from './types.ts'
import { creatorStudioContextSchema } from './validation.ts'

/** Only a lookup identity: no action values, body, receipt, or execution status. */
export const operationRecoveryRowSchema = z.object({
  schemaVersion: z.literal('creator.operation-recovery.v1alpha1'),
  request: PaneActionReconcileRequestSchema.extend({ context: creatorStudioContextSchema.refine(context => context.projectRef !== undefined) }),
  targetVersion: PaneActionRequestSchema.shape.expectedTargetVersion,
  descriptorRef: PaneActionRequestSchema.shape.descriptorRef,
}).strict()
export type OperationRecoveryRow = z.infer<typeof operationRecoveryRowSchema>
export interface OperationRecoveryDomainSpec extends DomainSpec {
  readonly name: 'yeisme_creator_recovery_v1'
  readonly version: 1
  readonly tables: { readonly requests: DomainTableSpec<string, OperationRecoveryRow> }
}
export const operationRecoveryDomainSpec: OperationRecoveryDomainSpec = {
  name: 'yeisme_creator_recovery_v1', version: 1, tables: { requests: { valueSchema: operationRecoveryRowSchema } },
}
export interface OperationRecoveryTable {
  get(key: string): unknown
  entries(): IterableIterator<[string, unknown]>
  put(key: string, value: OperationRecoveryRow): Promise<void>
  delete(key: string): Promise<boolean>
}
export interface OperationRecoveryStorage {
  open(spec: OperationRecoveryDomainSpec): Promise<{ table(name: 'requests'): OperationRecoveryTable; close(): Promise<void> }>
}
const identity = (context: PaneContextV1) => JSON.stringify([context.tenantRef, context.workspaceRef, context.projectRef, context.principalRef])
const sameContext = (a: PaneContextV1, b: CreatorStudioContextV1) =>
  (['tenantRef', 'workspaceRef', 'projectRef', 'sessionRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision'] as const).every(key => a[key] === b[key])

/** One Host-owned instance per domain; only the owner may confirm and remove a lookup identity. */
export class OperationRecoveryStore {
  private domain: ReturnType<OperationRecoveryStorage['open']> | undefined
  private tail: Promise<void> = Promise.resolve()
  private closed = false
  constructor(private readonly storage: OperationRecoveryStorage, private readonly current: () => CreatorStudioContextV1 | undefined) {}
  private key(row: OperationRecoveryRow) {
    return createHash('sha256').update(JSON.stringify([identity(row.request.context), row.request.owner, row.request.actionId, row.request.expectedTargetRef])).digest('hex')
  }
  private async table() {
    if (this.closed) throw Error('recovery store closed')
    if (!this.domain) {
      const opened = this.storage.open(operationRecoveryDomainSpec)
      this.domain = opened
      void opened.catch(() => { if (this.domain === opened) this.domain = undefined })
    }
    return (await this.domain).table('requests')
  }
  private active(context: CreatorStudioContextV1) {
    const now = this.current()
    return !this.closed && now !== undefined && sameContext(context, now)
  }
  private rows(table: OperationRecoveryTable, context: CreatorStudioContextV1) {
    const rows: OperationRecoveryRow[] = []
    for (const [key, raw] of table.entries()) {
      const row = operationRecoveryRowSchema.parse(raw)
      if (this.key(row) !== key) throw Error('recovery identity mismatch')
      if (identity(row.request.context) === identity(context)) rows.push(row)
      if (rows.length > 128) throw Error('recovery index capacity exceeded')
    }
    return rows
  }
  async list(): Promise<{ status: 'ready'; rows: OperationRecoveryRow[] } | { status: 'unavailable' }> {
    const context = this.current()
    if (!context?.projectRef || this.closed) return { status: 'unavailable' }
    const scope = { ...context }
    try {
      await this.tail
      const table = await this.table()
      if (!this.active(scope)) return { status: 'unavailable' }
      return { status: 'ready', rows: structuredClone(this.rows(table, scope)) }
    } catch { return { status: 'unavailable' } }
  }
  async reserve(input: unknown): Promise<{ status: 'saved' | 'existing'; row: OperationRecoveryRow } | { status: 'unavailable' | 'invalid' | 'full' }> {
    const parsed = PaneActionRequestSchema.safeParse(input), context = this.current()
    if (!parsed.success || !context?.projectRef || !sameContext(parsed.data.context, context)) return { status: 'invalid' }
    const scope = { ...context }, action = parsed.data
    const parsedRow = operationRecoveryRowSchema.safeParse({ schemaVersion: 'creator.operation-recovery.v1alpha1', descriptorRef: action.descriptorRef, targetVersion: action.expectedTargetVersion,
      request: { schema: 'pane.action-reconcile-request.v1alpha1', owner: action.owner, actionId: action.actionId, expectedTargetRef: action.expectedTargetRef, context: action.context, idempotencyKey: action.idempotencyKey } })
    if (!parsedRow.success) return { status: 'invalid' }
    const row = parsedRow.data
    const work = this.tail.then(async () => {
      try {
        const table = await this.table()
        if (!this.active(scope)) return { status: 'unavailable' as const }
        const rows = this.rows(table, scope), key = this.key(row)
        const existing = rows.find(item => this.key(item) === key)
        if (existing) return { status: 'existing' as const, row: structuredClone(existing) }
        if (rows.length >= 128) return { status: 'full' as const }
        await table.put(key, row)
        if (!this.active(scope)) return { status: 'unavailable' as const }
        return { status: 'saved' as const, row: structuredClone(row) }
      } catch { return { status: 'unavailable' as const } }
    })
    this.tail = work.then(() => undefined, () => undefined)
    return work
  }
  /** Host-only acknowledgment after a verified owner receipt; not a browser mutation API. */
  async forget(input: OperationRecoveryRow): Promise<boolean> {
    const parsed = operationRecoveryRowSchema.safeParse(input), context = this.current()
    if (!parsed.success || !context || identity(parsed.data.request.context) !== identity(context)) return false
    const scope = { ...context }, row = parsed.data
    const work = this.tail.then(async () => {
      try {
        const table = await this.table()
        if (!this.active(scope)) return false
        const stored = operationRecoveryRowSchema.safeParse(table.get(this.key(row)))
        if (!stored.success || JSON.stringify(stored.data) !== JSON.stringify(row)) return false
        await table.delete(this.key(row))
        return this.active(scope)
      } catch { return false }
    })
    this.tail = work.then(() => undefined, () => undefined)
    return work
  }
  async close() {
    this.closed = true
    await this.tail
    if (this.domain) await (await this.domain.catch(() => undefined))?.close()
  }
}
