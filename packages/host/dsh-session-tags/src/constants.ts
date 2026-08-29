/**
 * 包级常量的单一来源（index.ts 对外 re-export，避免模块环）。
 *
 * @module @yeisme/dsh-session-tags-host/constants
 */

/** Public storage-domain name opened via `ctx.storageDomain`. */
export const SESSION_TAGS_DOMAIN = 'yeisme_session_tags_v1' as const

/** Published host package version. */
export const SESSION_TAGS_HOST_VERSION = '0.1.0-rc.1' as const

/** Capability id advertised by this host face. */
export const SESSION_TAGS_CAPABILITY = 'session-tags-host' as const

/** Typert Remote 服务名（wire namespace；`sessionTags.list` / `sessionTags.set`）。 */
export const SESSION_TAGS_REMOTE_SERVICE_KEY = 'sessionTags' as const

/** Remote wire 合同版本。 */
export const SESSION_TAGS_SPEC_VERSION = '1.0' as const

/** Additive conversation organization domain; the tags v1 domain is unchanged. */
export const SESSION_ORGANIZATION_DOMAIN = 'yeisme_session_organization_v1' as const

/** Typert Remote namespace for organization management. */
export const SESSION_ORGANIZATION_REMOTE_SERVICE_KEY = 'sessionOrganization' as const

/** Additive organization wire contract version. */
export const SESSION_ORGANIZATION_SPEC_VERSION = '1.0' as const

/** Automatic classification writes only at or above this confidence. */
export const SESSION_ORGANIZATION_AUTO_CONFIDENCE = 0.8 as const

/** Administrator purge grants are browser-session scoped and short lived. */
export const SESSION_ORGANIZATION_ADMIN_TTL_MS = 15 * 60 * 1000

/** Reversible batch receipts remain available for thirty days. */
export const SESSION_ORGANIZATION_BATCH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
