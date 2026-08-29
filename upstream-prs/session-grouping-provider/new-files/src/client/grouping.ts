/**
 * Generic third-party session-grouping registry (experimental, v1alpha1).
 *
 * 该模块是唯一的 DSH 侧扩展 seam：只描述“分组投影 + 搜索词 + 会话动作”，
 * 不含 tags、文件夹、收藏夹等任何具体领域类型。渲染、过滤（未知/归档/
 * subagent-only 会话）、组内排序与视图菜单全部归 Workspace Browser；
 * provider 只拥有组顺序、成员关系与自有动作。
 *
 * 不变量（测试钉住）：
 * 1. provider id 全局唯一；重复注册 fail loud（后一个注册抛错并指明冲突
 *    id），已注册 provider 保持可用。
 * 2. 注册/dispose 归调用 fiber：register 经由 this.ctx.effect 安装清理
 *    （Service 代理会把 this.ctx 绑定到调用方 context），插件卸载/HMR
 *    后不留菜单项、订阅、动作或展示状态；返回的 disposer 幂等。
 * 3. registry 对每个 provider 的 subscribe 做转发聚合：任一 provider 快照
 *    变化、注册或卸载都会推进 revision observable，浏览器据此重渲染；
 *    registry 不缓存 provider 快照（不建第二份 store，快照权威在
 *    provider）。
 * 4. `searchTermsBySession` 是有界纯文本；浏览器只把它并入本地搜索，
 *    不改远端内容搜索语义。
 */
import { Context, Service } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'

/** One provider group: unique id, display label, and member sessions. */
export interface SessionGroupingGroupV1Alpha1 {
  readonly id: string
  readonly label: string
  readonly sessionIds: readonly SessionId[]
  /** Optional provider-local parent group id for a two-level hierarchy. */
  readonly parentId?: string
  /** Optional semantic color token; the Browser owns its visual mapping. */
  readonly color?: string
}

/**
 * Provider snapshot: a stable read-only projection. The same object reference
 * MUST be returned by {@link SessionGroupingProviderV1Alpha1.getSnapshot}
 * until the next {@link SessionGroupingProviderV1Alpha1.subscribe} listener
 * call; `revision` moves whenever the projection materially changes.
 */
export interface SessionGroupingSnapshotV1Alpha1 {
  readonly revision: string | number
  readonly groups: readonly SessionGroupingGroupV1Alpha1[]
  /** Bounded plain-text search terms merged into the browser's local search. */
  readonly searchTermsBySession?: Readonly<Record<string, readonly string[]>>
}

/** A session-scoped action a provider may contribute to native session rows. */
export interface SessionGroupingActionV1Alpha1 {
  readonly id: string
  readonly label: string | (() => string)
  /** Open the provider's own surface; DSH never executes domain mutations. */
  open(sessionId: SessionId): void
}

/**
 * A third-party grouping projection. A session MAY appear in several groups;
 * duplicate ids inside one group render once (browser-side dedupe).
 */
export interface SessionGroupingProviderV1Alpha1 {
  readonly id: string
  readonly label: string | (() => string)
  /** Menu placement hint among external entries; ascending, then registration order. */
  readonly order?: number
  getSnapshot(): SessionGroupingSnapshotV1Alpha1
  subscribe(listener: () => void): () => void
  readonly sessionActions?: readonly SessionGroupingActionV1Alpha1[]
}

/** Registry-visible registration (browser menu/derivation input). */
export interface SessionGroupingRegistrationV1Alpha1 {
  readonly provider: SessionGroupingProviderV1Alpha1
  /** Resolved display label (label may be a function). */
  readonly label: string
  /** Registration sequence for stable ordering among equal `order` values. */
  readonly seq: number
}

/** The live registry state handed to the browser through the hooks compartment. */
export interface SessionGroupingsStateV1Alpha1 {
  /** Moves on every registration change or provider snapshot notification. */
  readonly revision: number
  /** Active registrations ordered by provider `order`, then registration seq. */
  readonly providers: readonly SessionGroupingRegistrationV1Alpha1[]
}

/** 选择键格式：外部 provider 的持久化分组值（与内建 `workspace`/`flat` 可区分）。 */
export const EXTERNAL_GROUPING_PREFIX = 'provider:' as const

/** 持久化视图值：内建值或 `provider:<providerId>`。 */
export type SessionGroupBy =
  | 'workspace'
  | 'flat'
  | `${typeof EXTERNAL_GROUPING_PREFIX}${string}`

/** Build the persisted selection key of one provider. */
export function externalGroupingKey(providerId: string): `provider:${string}` {
  return `${EXTERNAL_GROUPING_PREFIX}${providerId}`
}

/** Resolve a provider id from a selection key; `undefined` for built-in values. */
export function providerIdOfGroupBy(groupBy: string): string | undefined {
  return groupBy.startsWith(EXTERNAL_GROUPING_PREFIX)
    ? groupBy.slice(EXTERNAL_GROUPING_PREFIX.length)
    : undefined
}

/** One registered entry plus the registry's forwarding subscription. */
interface RegistrationRecord {
  readonly registration: SessionGroupingRegistrationV1Alpha1
  unsubscribe: () => void
}

/**
 * The `ctx.sessionGroupings` service: an effect-scoped registry of external
 * grouping providers. Browser-owned rendering reads it through the browser
 * registration's hooks compartment; third-party plugins register through
 * their own ctx (the Service proxy binds effects to the caller's fiber).
 */
export class SessionGroupings extends Service {
  /** Additive renderer capabilities used by providers before emitting hierarchy hints. */
  readonly capabilities = Object.freeze({ hierarchy: true, semanticColor: true })
  private readonly records = new Map<string, RegistrationRecord>()
  private nextSeq = 0
  private revision = 0
  private readonly listeners = new Set<() => void>()
  /** Last published state; rebuilt only on change so the reference is stable. */
  private published: SessionGroupingsStateV1Alpha1 = Object.freeze({
    revision: 0,
    providers: Object.freeze([]),
  })

  constructor(ctx: Context) {
    super(ctx, 'sessionGroupings')
  }

  /**
   * Register one provider. Fails loud on a duplicate id (the existing
   * registration stays untouched); the returned disposer is idempotent and
   * ALSO runs when the calling fiber unloads (plugin unload / HMR).
   */
  register(provider: SessionGroupingProviderV1Alpha1): () => void {
    if (provider === null || typeof provider !== 'object') {
      throw new Error('sessionGroupings.register: provider must be an object')
    }
    if (typeof provider.id !== 'string' || provider.id === '') {
      throw new Error('sessionGroupings.register: provider.id must be a non-empty string')
    }
    if (typeof provider.getSnapshot !== 'function' || typeof provider.subscribe !== 'function') {
      throw new Error(`sessionGroupings.register: provider "${provider.id}" must provide getSnapshot and subscribe`)
    }
    if (provider.id.startsWith(EXTERNAL_GROUPING_PREFIX) || provider.id === 'workspace' || provider.id === 'flat') {
      throw new Error(`sessionGroupings.register: provider id "${provider.id}" collides with a built-in or reserved value`)
    }
    if (this.records.has(provider.id)) {
      throw new Error(`sessionGroupings.register: duplicate provider id "${provider.id}"`)
    }
    const registration: SessionGroupingRegistrationV1Alpha1 = Object.freeze({
      provider,
      label: typeof provider.label === 'function' ? provider.label() : provider.label,
      seq: this.nextSeq++,
    })
    // 聚合转发 provider 快照通知：registry 不读快照内容，只推进 revision。
    const unsubscribe = provider.subscribe(() => { this.bump() })
    this.records.set(provider.id, { registration, unsubscribe })
    this.bump()
    let disposed = false
    const dispose = (): void => {
      if (disposed) return
      disposed = true
      const record = this.records.get(provider.id)
      if (record === undefined || record.registration !== registration) return
      this.records.delete(provider.id)
      unsubscribe()
      this.bump()
    }
    // 经 this.ctx.effect 挂到调用方 fiber：插件卸载/HMR 自动清理。
    // register 是原型方法（非实例箭头函数），cordis Service 代理因此把
    // this.ctx 绑定为调用者 context —— 与 SlotRegistry.register 同一机制。
    const disposeEffect = this.ctx.effect(() => dispose, `sessionGroupings.register(${JSON.stringify(provider.id)})`)
    return () => {
      dispose()
      void disposeEffect()
    }
  }

  /** Current registrations ordered for menu display. */
  list(): readonly SessionGroupingRegistrationV1Alpha1[] {
    return this.published.providers
  }

  /** Live registry state (stable reference between revisions). */
  getSnapshot(): SessionGroupingsStateV1Alpha1 {
    return this.published
  }

  /** Subscribe to registry revisions; returns the unsubscriber. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** The hooks-compartment observable handed to the browser registration. */
  observer(): HostObservable<SessionGroupingsStateV1Alpha1> {
    return {
      getSnapshot: () => this.getSnapshot(),
      subscribe: listener => this.subscribe(listener),
    }
  }

  /** Advance the revision, rebuild the published state, and notify. */
  private bump(): void {
    const providers = [...this.records.values()]
      .map(record => record.registration)
      .sort((a, b) =>
        (a.provider.order ?? Number.POSITIVE_INFINITY) - (b.provider.order ?? Number.POSITIVE_INFINITY)
        || a.seq - b.seq,
      )
    this.revision += 1
    this.published = Object.freeze({ revision: this.revision, providers: Object.freeze(providers) })
    for (const listener of [...this.listeners]) listener()
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Experimental v1alpha1 external session-grouping registry. */
    sessionGroupings: SessionGroupings
  }
}

/** The fake provider's public shape: the contract plus a test-only `setGroups` mutator. */
export type FakeSessionGroupingProviderV1Alpha1 = SessionGroupingProviderV1Alpha1 & {
  /** Test-only mutation channel (documented fake; never part of the contract). */
  setGroups(
    groups: readonly SessionGroupingGroupV1Alpha1[],
    searchTermsBySession?: Readonly<Record<string, readonly string[]>>,
  ): void
}

/** Minimal fake provider for conformance docs/tests (no DSH-private imports). */
export function fakeSessionGroupingProvider(options: {
  readonly id: string
  readonly label?: string
  readonly groups?: readonly SessionGroupingGroupV1Alpha1[]
  readonly searchTermsBySession?: Readonly<Record<string, readonly string[]>>
  readonly onAction?: (sessionId: SessionId) => void
}): FakeSessionGroupingProviderV1Alpha1 {
  let revision = 0
  let groups = options.groups ?? []
  let searchTermsBySession = options.searchTermsBySession
  const listeners = new Set<() => void>()
  let snapshot: SessionGroupingSnapshotV1Alpha1 = Object.freeze({
    revision,
    groups,
    ...(searchTermsBySession === undefined ? {} : { searchTermsBySession }),
  })
  const rebuild = (): void => {
    revision += 1
    snapshot = Object.freeze({
      revision,
      groups,
      ...(searchTermsBySession === undefined ? {} : { searchTermsBySession }),
    })
    for (const listener of [...listeners]) listener()
  }
  return {
    id: options.id,
    label: options.label ?? options.id,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    ...(options.onAction === undefined ? {} : {
      sessionActions: [{
        id: `${options.id}.open`,
        label: `${options.label ?? options.id} action`,
        open: (sessionId: SessionId) => { options.onAction?.(sessionId) },
      }],
    }),
    // Test-only mutator channel (documented fake, never part of the contract).
    setGroups(next: readonly SessionGroupingGroupV1Alpha1[], terms?: Readonly<Record<string, readonly string[]>>): void {
      groups = next
      searchTermsBySession = terms
      rebuild()
    },
  }
}
