/**
 * @yeisme/dsh-session-tags-host.
 *
 * Plugin-owned Session tags sidecar. Canonical rows live in the public
 * storage-domain `yeisme.session-tags.v1`. This slice ships package identity,
 * the durable row type, and a versioned placeholder host. Domain table/CAS
 * and Typert Remote arrive in later tasks.
 *
 * @module @yeisme/dsh-session-tags-host
 */

/** Public storage-domain name opened via `ctx.storageDomain`. */
export const SESSION_TAGS_DOMAIN = 'yeisme.session-tags.v1' as const

/** Published host package version. */
export const SESSION_TAGS_HOST_VERSION = '0.1.0-rc.1' as const

/** Capability id advertised by this host face. */
export const SESSION_TAGS_CAPABILITY = 'session-tags-host' as const

/**
 * sidecar 行绑定的 Session 生命周期身份。
 * createdAt 使用 ISO 字符串，而不是把持久化 Session header 原样写入：
 * 避免把会话日志字段泄漏进标签 domain，并在 SessionId 被新生命周期复用时
 * 把旧行判为 stale。cwd 仅作可选身份补充，不得当作授权或路径泄漏面。
 */
export interface SessionTagSessionIdentityV1 {
  readonly createdAt: string
  readonly cwd?: string
}

/**
 * `yeisme.session-tags.v1` sessions 表的一行。
 * SessionId 是存储 key，不重复写入行值；tags 是规范化后的完整目标集合。
 * version 为行级 opaque CAS 令牌，updatedAt 只描述 sidecar，不得回写 Session recency。
 */
export interface SessionTagRowV1 {
  readonly session: SessionTagSessionIdentityV1
  readonly tags: readonly string[]
  readonly version: string
  readonly updatedAt: number
}

/**
 * 后续 3.2 接到公开 `ctx.storageDomain.open(...)` 的构造参数。
 * 3.1 只保存引用，占位 Host 不得打开 domain 或读写记录。
 */
export interface SessionTagsStorageDomainSeam {
  readonly domain: typeof SESSION_TAGS_DOMAIN
}

/**
 * 后续 3.2 接到公开 session-persistence 身份校验的构造参数。
 * 只检查 Session 是否存在且生命周期仍匹配；不得加载或追加 SessionEvent。
 */
export interface SessionTagsPersistenceSeam {
  inspectIdentity(sessionId: string): Promise<SessionTagSessionIdentityV1 | undefined>
}

/**
 * Typed seams for later storage-domain / persistence / Typert wiring.
 * Constructor args only — this package does not call live DSH services.
 */
export interface SessionTagsHostSeamsV1 {
  readonly storageDomain?: SessionTagsStorageDomainSeam
  readonly sessionPersistence?: SessionTagsPersistenceSeam
}

export interface SessionTagsHostV1 {
  readonly version: typeof SESSION_TAGS_HOST_VERSION
  readonly capability: typeof SESSION_TAGS_CAPABILITY
  readonly domain: typeof SESSION_TAGS_DOMAIN
  /** Returns currently known sidecar rows. The placeholder never invents tags. */
  listRows(): Promise<readonly SessionTagRowV1[]>
}

/** Wrap optional later-task seams as a versioned `SessionTagsHostV1`. */
export function createSessionTagsHost(seams: SessionTagsHostSeamsV1 = {}): SessionTagsHostV1 {
  return {
    version: SESSION_TAGS_HOST_VERSION,
    capability: SESSION_TAGS_CAPABILITY,
    domain: SESSION_TAGS_DOMAIN,
    async listRows() {
      // 占位实现必须忽略 seam：未接线时不得伪造标签，也不得探测持久化 Session。
      void seams.storageDomain
      void seams.sessionPersistence
      return Object.freeze([])
    },
  }
}

/** Placeholder host used until domain table/CAS and Remote are implemented. */
export function createSessionTagsHostPlaceholder(
  seams: SessionTagsHostSeamsV1 = {},
): SessionTagsHostV1 {
  return createSessionTagsHost(seams)
}

/** Runtime guard for an owner-provided Session tags host. */
export function isSessionTagsHostV1(value: unknown): value is SessionTagsHostV1 {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<SessionTagsHostV1>
  return candidate.version === SESSION_TAGS_HOST_VERSION
    && candidate.capability === SESSION_TAGS_CAPABILITY
    && candidate.domain === SESSION_TAGS_DOMAIN
    && typeof candidate.listRows === 'function'
}
