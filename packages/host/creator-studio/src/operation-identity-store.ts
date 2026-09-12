import { z } from 'zod'
import type { DomainSpec, DomainTableSpec } from '@deepseek-ai/dsh-storage-domain'
import { PaneActionReconcileRequestSchema, type PaneActionReconcileRequestV1 } from '@yeisme/dsh-pane-protocol'
import type { CreatorStudioContextV1 } from './types.ts'

const identitySchema = PaneActionReconcileRequestSchema
export type CreatorOperationIdentityV1 = PaneActionReconcileRequestV1
const rowSchema = z.object({ identity: identitySchema }).strict()
type Row = z.infer<typeof rowSchema>
export interface OperationIdentityDomainSpec extends DomainSpec {
  readonly name: 'yeisme_creator_operation_v1'
  readonly version: 1
  readonly tables: { readonly identities: DomainTableSpec<string, Row> }
}
export const operationIdentityDomainSpec: OperationIdentityDomainSpec = {
  name: 'yeisme_creator_operation_v1', version: 1, tables: { identities: { valueSchema: rowSchema } },
}
export interface OperationIdentityTable {
  get(key: string): unknown
  put(key: string, value: Row): Promise<void>
  delete(key: string): Promise<boolean>
}
export interface OperationIdentityStorage {
  open(spec: OperationIdentityDomainSpec): Promise<{ table(name: 'identities'): OperationIdentityTable; close(): Promise<void> }>
}

function contextKeys(context: CreatorStudioContextV1) {
  return [context.tenantRef, context.workspaceRef, context.projectRef ?? '', context.sessionRef ?? '', context.principalRef,
    context.membershipRevision, context.installationRef, context.pluginDigest, context.policyRevision, context.runtimeGeneration, context.revision] as const
}

/** @deprecated Gateway uses OperationRecoveryStore's write-ahead reservations. Retained only for existing direct callers; not mounted by Gateway. */
export class OperationIdentityStore {
  private domain: ReturnType<OperationIdentityStorage['open']> | undefined
  private tail: Promise<void> = Promise.resolve()
  private closed = false
  constructor(private readonly storage: OperationIdentityStorage, private readonly context: () => CreatorStudioContextV1 | undefined) {}

  private current(): CreatorStudioContextV1 | undefined {
    return this.closed ? undefined : this.context()
  }

  private async table(): Promise<OperationIdentityTable> {
    if (this.closed) throw new Error('operation identity storage closed')
    if (this.domain === undefined) {
      const opened = this.storage.open(operationIdentityDomainSpec)
      this.domain = opened
      void opened.catch(() => { if (this.domain === opened) this.domain = undefined })
    }
    return (await this.domain).table('identities')
  }

  private key(identity: CreatorOperationIdentityV1): string {
    const context = identity.context as CreatorStudioContextV1
    return JSON.stringify([context.tenantRef, context.workspaceRef, context.projectRef ?? '', identity.owner, identity.actionId, identity.expectedTargetRef])
  }

  private matches(identity: CreatorOperationIdentityV1, context: CreatorStudioContextV1): boolean {
    const stored = identity.context as CreatorStudioContextV1
    return contextKeys(stored).every((value, index) => value === contextKeys(context)[index])
  }

  remember(input: unknown): Promise<'stored' | 'invalid' | 'forbidden' | 'unavailable'> {
    const parsed = identitySchema.safeParse(input)
    if (!parsed.success) return Promise.resolve('invalid')
    const context = this.current()
    if (context === undefined || !this.matches(parsed.data, context)) return Promise.resolve('forbidden')
    const work = this.tail.then(async () => {
      const latest = this.current()
      if (latest === undefined || !this.matches(parsed.data, latest)) return 'forbidden' as const
      try {
        await (await this.table()).put(this.key(parsed.data), { identity: parsed.data })
        return 'stored' as const
      } catch { return 'unavailable' as const }
    })
    this.tail = work.then(() => undefined, () => undefined)
    return work
  }

  private query(input: unknown): { owner: string; actionId: string; expectedTargetRef: string } | undefined {
    if (typeof input !== 'object' || input === null) return undefined
    const value = input as { owner?: unknown; actionId?: unknown; expectedTargetRef?: unknown }
    return typeof value.owner === 'string' && value.owner.length > 0 && typeof value.actionId === 'string' && value.actionId.length > 0
      && typeof value.expectedTargetRef === 'string' && value.expectedTargetRef.length > 0
      ? { owner: value.owner, actionId: value.actionId, expectedTargetRef: value.expectedTargetRef } : undefined
  }

  async recall(input: unknown): Promise<CreatorOperationIdentityV1 | undefined> {
    const parsed = this.query(input)
    const context = this.current()
    if (parsed === undefined || context === undefined) return undefined
    try {
      await this.tail
      const latest = this.current()
      if (latest === undefined) return undefined
      const raw = (await this.table()).get(JSON.stringify([latest.tenantRef, latest.workspaceRef, latest.projectRef ?? '', parsed.owner, parsed.actionId, parsed.expectedTargetRef]))
      const row = rowSchema.safeParse(raw)
      if (!row.success || !this.matches(row.data.identity, latest) || row.data.identity.owner !== parsed.owner
        || row.data.identity.actionId !== parsed.actionId || row.data.identity.expectedTargetRef !== parsed.expectedTargetRef) return undefined
      return row.data.identity
    } catch { return undefined }
  }

  forget(input: unknown): Promise<boolean> {
    const parsed = this.query(input)
    if (parsed === undefined) return Promise.resolve(false)
    const work = this.tail.then(async () => {
      const latest = this.current()
      if (latest === undefined) return false
      try {
        return await (await this.table()).delete(JSON.stringify([latest.tenantRef, latest.workspaceRef, latest.projectRef ?? '', parsed.owner, parsed.actionId, parsed.expectedTargetRef]))
      } catch { return false }
    })
    this.tail = work.then(() => undefined, () => undefined)
    return work
  }

  async close(): Promise<void> {
    this.closed = true
    const opened = this.domain
    this.domain = undefined
    if (opened !== undefined) await (await opened).close().catch(() => undefined)
  }
}
