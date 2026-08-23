/**
 * `yeisme_session_tags_v1` storage domain 声明（名字须匹配上游 UNIT_NAME_RE：/^[a-z][a-z0-9_]*$/）。
 *
 * 只声明一个 `sessions` 表：key 是 SessionId，value 是 SessionTagRowV1。
 * 不引入全局 tag catalog——可选标签集合由有效行实时去重派生（design 决策 4）。
 * valueSchema 用 zod 描述（storage-domain 在 durable boundary 的校验约定）。
 * domain/表名在构造时自校验，与 `defineDomain` 的 fail-loud 语义等价，
 * 但不引入对 dsh-storage-domain 的运行时依赖（本包 peers 为 optional）。
 *
 * @module @yeisme/dsh-session-tags-host/domain
 */

import { z } from 'zod'
import type { DomainSpec, DomainTableSpec } from '@deepseek-ai/dsh-storage-domain'
import { SESSION_TAGS_DOMAIN } from './constants.ts'
import { MAX_TAGS_PER_SESSION } from './tags.ts'
import type { SessionTagRowV1 } from './wire.ts'

/** SessionId：持久化 key，运行时就是 string（品牌化只服务编译期推导）。 */
export type SessionId = string

/** sessions 表 value 的 zod schema——行形状的持久化权威描述。 */
export const sessionTagRowSchema: z.ZodType<SessionTagRowV1> = z.object({
  session: z.object({
    createdAt: z.string(),
    cwd: z.string().optional(),
  }),
  tags: z.array(z.string()).max(MAX_TAGS_PER_SESSION),
  version: z.string(),
  updatedAt: z.number(),
}).strict()

/** `Domain<S>` 需要的字面量 spec 类型（table 名 → 行类型 的编译期投影）。 */
export interface SessionTagsDomainSpec extends DomainSpec {
  readonly name: typeof SESSION_TAGS_DOMAIN
  readonly version: 1
  readonly tables: {
    readonly sessions: DomainTableSpec<SessionId, SessionTagRowV1>
  }
}

/** storage-domain 名字约束（上游 UNIT_NAME_RE 的本地镜像：小写字母开头，仅 [a-z0-9_]；fail-loud 用）。 */
const NAME_RE = /^[a-z][a-z0-9_]*$/

/** 组装并校验 domain spec；非法名字在构造期抛出。 */
function buildSpec(): SessionTagsDomainSpec {
  if (!NAME_RE.test(SESSION_TAGS_DOMAIN)) {
    throw new Error(`invalid session-tags domain name: ${SESSION_TAGS_DOMAIN}`)
  }
  const spec: SessionTagsDomainSpec = {
    name: SESSION_TAGS_DOMAIN,
    version: 1,
    tables: {
      // 字面量等价于 domainTable(schema)：valueSchema 是唯一运行时字段，
      // __key 是编译期幻影，不需要运行时导入 dsh-storage-domain。
      sessions: { valueSchema: sessionTagRowSchema },
    },
  }
  return spec
}

/**
 * 打开 `yeisme_session_tags_v1` 的 domain 声明（durable 校验 + backend 投影）。
 * 冻结实例；`Domain<SessionTagsDomainSpec>` 会推导出 sessions 表的行类型。
 */
export const sessionTagsDomainSpec: SessionTagsDomainSpec = Object.freeze(buildSpec())
