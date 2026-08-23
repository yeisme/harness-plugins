/**
 * 包级常量的单一来源（index.ts 对外 re-export，避免模块环）。
 *
 * @module @yeisme/dsh-session-tags-host/constants
 */

/** Public storage-domain name opened via `ctx.storageDomain`. */
export const SESSION_TAGS_DOMAIN = 'yeisme.session-tags.v1' as const

/** Published host package version. */
export const SESSION_TAGS_HOST_VERSION = '0.1.0-rc.1' as const

/** Capability id advertised by this host face. */
export const SESSION_TAGS_CAPABILITY = 'session-tags-host' as const

/** Typert Remote 服务名（wire namespace；`sessionTags.list` / `sessionTags.set`）。 */
export const SESSION_TAGS_REMOTE_SERVICE_KEY = 'sessionTags' as const

/** Remote wire 合同版本。 */
export const SESSION_TAGS_SPEC_VERSION = '1.0' as const
