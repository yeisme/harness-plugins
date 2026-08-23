/**
 * `sessionTags` Remote 的 Client 侧 wire 镜像。
 *
 * 结构与 `@yeisme/dsh-session-tags-host` 的 wire 类型逐字段一致
 * （bundle 层有 sync 测试钉住两侧不漂移）。Client 只依赖这些纯类型与
 * 结构判定，不 import Host 包——ModuleLoader 单文件契约要求 client.js
 * 自包含。
 *
 * @module @yeisme/dsh-client-ui-session-tags/client/wire
 */

/** sidecar 行绑定的 Session 生命周期身份。 */
export interface SessionTagSessionIdentityV1 {
  readonly createdAt: string
  readonly cwd?: string
}

/** `yeisme_session_tags_v1` sessions 表的一行（Client 可见的投影）。 */
export interface SessionTagRowV1 {
  readonly session: SessionTagSessionIdentityV1
  readonly tags: readonly string[]
  readonly version: string
  readonly updatedAt: number
}

/** list 应答的单条目：SessionId（存储 key）+ 行值。 */
export interface SessionTagsListEntryV1 {
  readonly sessionId: string
  readonly row: SessionTagRowV1
}

/** `sessionTags.list` 成功应答。 */
export interface SessionTagsListOkV1 {
  readonly ok: true
  readonly specVersion: '1.0'
  readonly entries: readonly SessionTagsListEntryV1[]
}

/** `sessionTags.set` 请求：完整目标集合 + 行级 CAS 令牌。 */
export interface SessionTagsSetInputV1 {
  readonly sessionId: string
  readonly tags: readonly string[]
  readonly ifVersion: string | null
}

/** typed failure（四个 code 固定；unknown/partial 只禁用 mutation 并要求 reconcile）。 */
export interface SessionNotFoundFailureV1 {
  readonly ok: false
  readonly code: 'session-not-found'
  readonly message: string
}

export interface TagsInvalidFailureV1 {
  readonly ok: false
  readonly code: 'tags-invalid'
  readonly message: string
  readonly reasons: readonly string[]
}

export interface VersionConflictFailureV1 {
  readonly ok: false
  readonly code: 'version-conflict'
  readonly message: string
  readonly row: SessionTagRowV1 | null
}

export interface StorageUnavailableFailureV1 {
  readonly ok: false
  readonly code: 'storage-unavailable'
  readonly message: string
}

export type SessionTagsListAnswerV1 = SessionTagsListOkV1 | StorageUnavailableFailureV1

export type SessionTagsSetAnswerV1 =
  | { readonly ok: true; readonly sessionId: string; readonly tags: readonly string[]; readonly row: SessionTagRowV1 | null }
  | SessionNotFoundFailureV1
  | TagsInvalidFailureV1
  | VersionConflictFailureV1
  | StorageUnavailableFailureV1

/** `sessionTags` Remote 的结构端口（Typert client 绑定的最小面）。 */
export interface SessionTagsRemoteFace {
  list(): Promise<SessionTagsListAnswerV1>
  set(input: SessionTagsSetInputV1): Promise<SessionTagsSetAnswerV1>
}

/** 失败码字面量集合（与 Host 侧 `SESSION_TAGS_FAILURE_CODES` 同步）。 */
export const SESSION_TAGS_FAILURE_CODES = [
  'session-not-found',
  'tags-invalid',
  'version-conflict',
  'storage-unavailable',
] as const

export type SessionTagsFailureCode = (typeof SESSION_TAGS_FAILURE_CODES)[number]
