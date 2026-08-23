/**
 * `sessionTags` Remote 的 wire 合同类型。
 *
 * 这些类型是跨 Host/Client 的唯一权威描述：Client 侧包保留结构镜像，
 * bundle 层有 sync 测试钉住两侧不漂移。所有字段都是 JSON 可序列化的
 * 纯数据（Typert Remote 的载体约束）。
 *
 * @module @yeisme/dsh-session-tags-host/wire
 */

/** sidecar 行绑定的 Session 生命周期身份（cwd 可缺省或显式 undefined：
 * 与 zod 输出形态一致，exactOptionalPropertyTypes 下两侧可互相赋值）。 */
export interface SessionTagSessionIdentityV1 {
  readonly createdAt: string
  readonly cwd?: string | undefined
}

/** `yeisme.session-tags.v1` sessions 表的一行。 */
export interface SessionTagRowV1 {
  readonly session: SessionTagSessionIdentityV1
  readonly tags: readonly string[]
  readonly version: string
  readonly updatedAt: number
}

/** list 应答的单条目：SessionId（存储 key）+ 行值。行值本身不重复存 id。 */
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

/** `sessionTags.set` 成功应答；`row === null` 表示行已清空删除。 */
export interface SessionTagsSetOkV1 {
  readonly ok: true
  readonly sessionId: string
  readonly tags: readonly string[]
  readonly row: SessionTagRowV1 | null
}

/** typed business failure 集合（固定四个 code，不新增、不复用语义）。 */
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

/** `sessionTags.set` 请求：完整目标集合 + 行级 CAS 令牌。 */
export interface SessionTagsSetInputV1 {
  readonly sessionId: string
  readonly tags: readonly string[]
  readonly ifVersion: string | null
}

/** wire 上的失败码字面量集合（Client 侧 switch 的 exhaustive 依据）。 */
export const SESSION_TAGS_FAILURE_CODES = [
  'session-not-found',
  'tags-invalid',
  'version-conflict',
  'storage-unavailable',
] as const

export type SessionTagsFailureCode = (typeof SESSION_TAGS_FAILURE_CODES)[number]
