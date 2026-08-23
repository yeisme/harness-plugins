/**
 * SessionTags sidecar 核心：行级 CAS 写入 + 生命周期身份校验。
 *
 * 不变量（design 决策 4/5，全部在注释与测试中固定）：
 * 1. durability-before-memory：本服务不持有任何行副本。所有读写都穿过
 *    storage-domain 的表端口——那里的内存态只在 backend 落盘后才更新，
 *    因此本服务的“读”天然与耐久化状态一致。
 * 2. 写入串行化：同一 SessionId 的 set 在行级队列上排队，检查与写入之间
 *    不会被同 key 的其他写入穿插；不同 SessionId 互不阻塞。
 * 3. immutable snapshot：list/set 返回的行对象全部冻结，绝不原地改写。
 * 4. set 只接收“完整目标集合 + ifVersion”；CAS 失败返回权威行并禁用写入，
 *    绝不自动重试或替换 writer。
 * 5. no-op 写入（目标 tags 与当前行材料相同且版本匹配）不产生 put、
 *    不换 version、不动 updatedAt。
 * 6. 空 tags 且版本匹配 → 删除 sidecar 行（返回无标签的权威结果）。
 * 7. sidecar 是模型不可见的：不触碰 SessionEvent、不改 Session recency。
 *
 * @module @yeisme/dsh-session-tags-host/service
 */

import { randomUUID } from 'node:crypto'
import {
  SESSION_TAGS_DOMAIN,
} from './constants.ts'
import { normalizeTags, tagsMaterialEqual } from './tags.ts'
import type { SessionTagRowV1, SessionTagSessionIdentityV1, SessionTagsListEntryV1 } from './wire.ts'

/** storage-domain `sessions` 表的最小结构端口（KvTable 的读写子集）。 */
export interface SessionTagsTablePort {
  get(sessionId: string): SessionTagRowV1 | undefined
  entries(): IterableIterator<[string, SessionTagRowV1]>
  put(sessionId: string, row: SessionTagRowV1): Promise<void>
  delete(sessionId: string): Promise<boolean>
}

/** Session 生命周期身份读取端口：只允许 metadata-only 读取，禁止加载日志。 */
export interface SessionIdentityPort {
  inspectIdentity(sessionId: string): Promise<SessionTagSessionIdentityV1 | undefined>
}

/** sidecar 核心构造依赖。 */
export interface SessionTagsSidecarDeps {
  readonly table: SessionTagsTablePort
  readonly identity: SessionIdentityPort
  /** 可注入的版本生成器（opaque version；测试可固定）。 */
  readonly newVersion?: () => string
}

/**
 * 生成 opaque 行版本：不编码任何业务语义，只保证材料变化时必然不同。
 */
function defaultNewVersion(): string {
  return `stv1-${randomUUID()}`
}

/** list 结果：specVersion + 当前有效（非 stale）行条目。 */
export interface SessionTagsListOk {
  readonly ok: true
  readonly specVersion: '1.0'
  readonly entries: readonly SessionTagsListEntryV1[]
}

/** set 成功结果：`row === null` 表示该 Session 的行已被清空删除。 */
export interface SessionTagsSetOk {
  readonly ok: true
  readonly sessionId: string
  readonly tags: readonly string[]
  readonly row: SessionTagRowV1 | null
}

/** typed business failure（wire 层复用；unknown/partial 状态绝不自动重试）。 */
export type SessionTagsFailure =
  | { readonly ok: false; readonly code: 'session-not-found'; readonly message: string }
  | {
      readonly ok: false
      readonly code: 'tags-invalid'
      readonly message: string
      readonly reasons: readonly string[]
    }
  | {
      readonly ok: false
      readonly code: 'version-conflict'
      readonly message: string
      /** 当前权威行；`null` 表示权威态是“无行”。 */
      readonly row: SessionTagRowV1 | null
    }
  | { readonly ok: false; readonly code: 'storage-unavailable'; readonly message: string }

/** list/set 的完整返回类型。 */
export type SessionTagsListResult = SessionTagsListOk | Extract<SessionTagsFailure, { code: 'storage-unavailable' }>

/** Session 生命周期身份是否与 sidecar 行绑定的身份一致。 */
function identityMatches(
  row: SessionTagRowV1,
  live: SessionTagSessionIdentityV1 | undefined,
): boolean {
  if (live === undefined) return false
  if (row.session.createdAt !== live.createdAt) return false
  if ((row.session.cwd ?? undefined) !== (live.cwd ?? undefined)) return false
  return true
}

/**
 * 行级写队列：每个 SessionId 一条 promise 链，链尾总是已 settle。
 * 队列 entry 生命周期与 key 绑定——链条空转后即被清理，防止 key 无限增长。
 */
class RowQueue {
  private readonly tails = new Map<string, Promise<unknown>>()

  /** 把一个异步临界区排到指定 key 的链尾并返回其结果。 */
  run<T>(sessionId: string, section: () => Promise<T>): Promise<T> {
    const tail = this.tails.get(sessionId) ?? Promise.resolve()
    const next = tail.then(section, section)
    this.tails.set(sessionId, next.catch(() => {}))
    return next
  }
}

/** SessionTags sidecar 核心服务。 */
export class SessionTagsSidecar {
  private readonly table: SessionTagsTablePort
  private readonly identity: SessionIdentityPort
  private readonly newVersion: () => string
  private readonly queue = new RowQueue()

  constructor(deps: SessionTagsSidecarDeps) {
    this.table = deps.table
    this.identity = deps.identity
    this.newVersion = deps.newVersion ?? defaultNewVersion
  }

  /** 本服务绑定的 domain 名（诊断用）。 */
  readonly domain = SESSION_TAGS_DOMAIN

  /**
   * 列出当前有效行：逐行核对 Session 生命周期身份，stale 行不可见、
   * 不删除（重装恢复语义依赖 sidecar 数据保留）。
   */
  async list(): Promise<SessionTagsListResult> {
    try {
      const entries: SessionTagsListEntryV1[] = []
      for (const [sessionId, row] of this.table.entries()) {
        let live: SessionTagSessionIdentityV1 | undefined
        try {
          live = await this.identity.inspectIdentity(sessionId)
        } catch (error) {
          return storageFailure('list: session identity read failed', error)
        }
        if (!identityMatches(row, live)) continue
        entries.push(Object.freeze({ sessionId, row: Object.freeze(row) }))
      }
      return Object.freeze({ ok: true, specVersion: '1.0', entries: Object.freeze(entries) })
    } catch (error) {
      return storageFailure('list: storage read failed', error)
    }
  }

  /**
   * CAS 写入完整目标 tags。步骤与失败码：
   * 1. 规范化 + 校验 → `tags-invalid`（旧行不动）；
   * 2. 读取当前 Session 身份 → 不存在/已删除 → `session-not-found`（storage 无新增）；
   * 3. 读取当前行：若行绑定的生命周期身份与当前 Session 不一致，该行视为
   *    stale——对 CAS 而言权威态是“无行”（ifVersion 必须为 null 才能重建绑定）；
   * 4. 版本比对 → 不匹配 → `version-conflict`（附当前权威行）；
   * 5. 材料相同 → 返回当前行（no-op，不落盘、不换版本）；
   * 6. 空 tags → 删除行；否则写入新行（新 opaque version + updatedAt）。
   * 全程在该 Session 的行级队列内执行，检查与写入不会被打穿。
   */
  async set(input: {
    readonly sessionId: string
    readonly tags: readonly string[]
    readonly ifVersion: string | null
  }): Promise<SessionTagsSetOk | SessionTagsFailure> {
    if (typeof input.sessionId !== 'string' || input.sessionId === '') {
      return { ok: false, code: 'session-not-found', message: 'sessionId must be a non-empty string' }
    }
    const normalized = normalizeTags(Array.isArray(input.tags) ? input.tags : [])
    if (!normalized.ok) {
      return {
        ok: false,
        code: 'tags-invalid',
        message: 'target tags violate the v1 tag model',
        reasons: normalized.reasons,
      }
    }
    const tags = normalized.tags
    return this.queue.run(input.sessionId, async () => this.setLocked(input.sessionId, tags, input.ifVersion))
  }

  /** 行级队列内的临界区（不得在外部直接调用）。 */
  private async setLocked(
    sessionId: string,
    tags: readonly string[],
    ifVersion: string | null,
  ): Promise<SessionTagsSetOk | SessionTagsFailure> {
    let live: SessionTagSessionIdentityV1 | undefined
    try {
      live = await this.identity.inspectIdentity(sessionId)
    } catch (error) {
      return storageFailure('set: session identity read failed', error)
    }
    if (live === undefined) {
      return { ok: false, code: 'session-not-found', message: `session "${sessionId}" is not persisted` }
    }

    let current: SessionTagRowV1 | undefined
    try {
      current = this.table.get(sessionId)
    } catch (error) {
      return storageFailure('set: storage read failed', error)
    }

    // stale 行（SessionId 被新生命周期复用）对 CAS 视为“无行”：
    // 旧标签属于已死亡的生命周期，绝不能附加到当前会话，也不能作为
    // 权威值返回给 Client 去覆盖。ifVersion 为 null 才允许重建绑定。
    const liveRow = current !== undefined && identityMatches(current, live) ? current : undefined
    const authoritative: SessionTagRowV1 | null = liveRow ?? null

    if (ifVersion === null) {
      if (authoritative !== null) {
        return {
          ok: false,
          code: 'version-conflict',
          message: 'a row already exists; reconcile with the authoritative row',
          row: authoritative,
        }
      }
    } else {
      if (authoritative === null || authoritative.version !== ifVersion) {
        return {
          ok: false,
          code: 'version-conflict',
          message: 'ifVersion does not match the authoritative row',
          row: authoritative,
        }
      }
    }

    // no-op：材料相同（且版本已匹配）→ 返回当前行，不落盘、不换版本。
    if (authoritative !== null && tagsMaterialEqual(authoritative.tags, tags)) {
      return { ok: true, sessionId, tags: authoritative.tags, row: Object.freeze(authoritative) }
    }

    const now = Date.now()
    try {
      if (tags.length === 0) {
        await this.table.delete(sessionId)
        return { ok: true, sessionId, tags: [], row: null }
      }
      const row: SessionTagRowV1 = Object.freeze({
        session: Object.freeze({
          createdAt: live.createdAt,
          ...(live.cwd === undefined ? {} : { cwd: live.cwd }),
        }),
        tags,
        version: this.newVersion(),
        updatedAt: now,
      })
      await this.table.put(sessionId, row)
      return { ok: true, sessionId, tags: row.tags, row }
    } catch (error) {
      return storageFailure('set: durable write failed', error)
    }
  }
}

/** 统一把底层异常折叠为 typed `storage-unavailable`（不泄漏绝对路径等细节）。 */
function storageFailure(stage: string, error: unknown): Extract<SessionTagsFailure, { code: 'storage-unavailable' }> {
  const detail = error instanceof Error ? error.message : String(error)
  return {
    ok: false,
    code: 'storage-unavailable',
    message: `${stage}: ${detail}`,
  }
}

/** 构造 sidecar 核心。 */
export function createSessionTagsSidecar(deps: SessionTagsSidecarDeps): SessionTagsSidecar {
  return new SessionTagsSidecar(deps)
}
