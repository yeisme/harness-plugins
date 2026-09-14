/**
 * Storage-domain persistence for DSH-side compile-session projections (task 2.3).
 *
 * Pattern owner: packages/host/dsh-3d-director/src/scene-store.ts —
 * - structural (dependency-free) storage seam: the host binds the real
 *   `ctx.storageDomain` face at wiring time, tests fake it;
 * - ONE storage-domain owner per Host: the domain is opened lazily exactly
 *   once (single-open discipline), read/put serialized on a single tail
 *   promise inside that owner, never per pane;
 * - rows are validated by the frozen TemplateRegistryCompileRowSchema before
 *   every put and after every get (shape drift fails closed to `undefined`);
 * - keys are DSH-session scoped (`templateRegistrySessionKey`), so
 *   conversations never see each other's compile sessions.
 *
 * The domain stores ONLY projections/recovery contracts — the registry
 * session itself stays in the owner's workspace project store. It is not a
 * second copy of domain state.
 *
 * @module @yeisme/dsh-template-registry/store
 */

import {
  TEMPLATE_REGISTRY_DOMAIN,
  TEMPLATE_REGISTRY_TABLE,
  TemplateRegistryCompileRowSchema,
  templateRegistryDomainSpec,
  templateRegistrySessionKey,
  type TemplateRegistryCompileRow,
  type TemplateRegistryDomainSpecShape,
} from './contracts.js'

/** Table port: synchronous get + async put (mirrors the scene-store face). */
export interface TemplateRegistryTablePort {
  get(key: string): unknown
  put(key: string, value: TemplateRegistryCompileRow): Promise<void>
}

export interface TemplateRegistryDomainHandle {
  table(name: typeof TEMPLATE_REGISTRY_TABLE): TemplateRegistryTablePort
  close(): Promise<void>
}

/** Structural seam for the real DSH storage-domain facility. */
export interface TemplateRegistryStorage {
  open(spec: TemplateRegistryDomainSpecShape): Promise<TemplateRegistryDomainHandle>
}

export type TemplateRegistryStoreStatus = 'saved' | 'unavailable'

/**
 * Single-owner compile-session row store. All mutations run on one tail
 * promise; a storage failure degrades honestly to `unavailable` (rows are
 * never fabricated) and `close()` is final.
 */
export class TemplateRegistrySessionStore {
  private domain: Promise<TemplateRegistryDomainHandle> | undefined
  private tail: Promise<unknown> = Promise.resolve()
  private closed = false

  constructor(private readonly storage: TemplateRegistryStorage) {}

  /** Serialized row put under the DSH-session-scoped key. */
  save(row: TemplateRegistryCompileRow): Promise<TemplateRegistryStoreStatus> {
    if (this.closed) return Promise.resolve('unavailable')
    // Validate BEFORE entering the queue: a contract-invalid row never
    // reaches storage (fail-closed, mirrors scene-store parseSceneGraphRow).
    const parsed = TemplateRegistryCompileRowSchema.safeParse(row)
    if (!parsed.success) return Promise.resolve('unavailable')
    const work = this.tail.then(async (): Promise<TemplateRegistryStoreStatus> => {
      const table = await this.table()
      await table.put(templateRegistrySessionKey(row.dshSessionRef, row.session.id), parsed.data)
      return 'saved'
    }).catch((): TemplateRegistryStoreStatus => 'unavailable')
    this.tail = work
    return work
  }

  /** Load one row; missing or shape-drifted rows return undefined. */
  async load(dshSessionRef: string, registrySessionId: string): Promise<TemplateRegistryCompileRow | undefined> {
    if (this.closed) return undefined
    try {
      await this.tail
      const table = await this.table()
      const raw = table.get(templateRegistrySessionKey(dshSessionRef, registrySessionId))
      if (raw === undefined) return undefined
      const parsed = TemplateRegistryCompileRowSchema.safeParse(raw)
      return parsed.success ? parsed.data : undefined
    } catch {
      return undefined
    }
  }

  /** Final close of the single-open domain handle. */
  async close(): Promise<void> {
    this.closed = true
    await this.tail.catch(() => undefined)
    const opened = this.domain
    this.domain = undefined
    if (opened !== undefined) await opened.then(handle => handle.close()).catch(() => undefined)
  }

  /** Lazy single open: the domain facility enforces single-open per name; a failed open resets so a retry may succeed. */
  private async table(): Promise<TemplateRegistryTablePort> {
    if (this.domain === undefined) {
      const opened = this.storage.open(templateRegistryDomainSpec)
      this.domain = opened
      void opened.catch(() => { if (this.domain === opened) this.domain = undefined })
    }
    return (await this.domain).table(TEMPLATE_REGISTRY_TABLE)
  }
}

/** Domain name re-export for wiring assertions (frozen `yeisme_template_registry_v1`). */
export const TEMPLATE_REGISTRY_STORAGE_DOMAIN = TEMPLATE_REGISTRY_DOMAIN
