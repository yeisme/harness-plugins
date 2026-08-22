/**
 * Login-state profile metadata (Phase 1, plugin side only).
 *
 * Cookies are quasi-credentials: this projection is metadata ONLY. Raw
 * cookie/token values are forbidden by the parser, never persisted by the
 * store, and never rendered. Real jar storage and apply/switch live behind
 * the future host seam (`web.cookieJars`, upstream-prs backlog).
 *
 * @module @yeisme/dsh-client-ui-session-cookie-manager
 */

/** Keys a profile projection must never carry. */
export const FORBIDDEN_PROFILE_KEYS = [
  'cookie', 'cookies', 'token', 'value', 'values', 'secret', 'password',
  'credential', 'credentials', 'bearer', 'header', 'headers', 'body', 'content', 'raw',
] as const

const ID_MAX = 64
const SITE_MAX = 200
const NAME_MAX = 100
const SUMMARY_MAX = 120
const CAP_MAX = 24

/** Metadata for one per-site/per-account login-state profile. */
export interface ProfileMetaV1 {
  profileId: string
  /** Site scope: `*` or a host-like token; never a URL or path. */
  siteScope: string
  displayName: string
  /** Redacted account identifier summary; never a credential. */
  accountSummary?: string
  capabilities: readonly string[]
  createdAt: string
  updatedAt: string
}

export type ProfileParseResult =
  | { ok: true; value: ProfileMetaV1 }
  | { ok: false; error: string }

function isClean(value: unknown, max: number): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value)
}

function isIsoLike(value: unknown): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
}

/** Parse and validate one profile metadata object; fail closed on forbidden fields. */
export function parseProfileMeta(input: unknown): ProfileParseResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'profile must be an object' }
  }
  const record = input as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if ((FORBIDDEN_PROFILE_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: `forbidden field on profile: ${key}` }
    }
  }
  if (!isClean(record.profileId, ID_MAX) || /[\\/]|:\/\//.test(record.profileId as string)) {
    return { ok: false, error: 'profileId must be a clean opaque token' }
  }
  if (!isClean(record.siteScope, SITE_MAX) || /[\\/]|:\/\//.test(record.siteScope as string)) {
    return { ok: false, error: 'siteScope must be `*` or a host-like token, not a URL or path' }
  }
  if (!isClean(record.displayName, NAME_MAX)) return { ok: false, error: 'displayName must be a clean bounded string' }
  if (record.accountSummary !== undefined && !isClean(record.accountSummary, SUMMARY_MAX)) {
    return { ok: false, error: 'accountSummary must be a clean bounded string' }
  }
  if (!Array.isArray(record.capabilities)
    || record.capabilities.length > CAP_MAX
    || record.capabilities.some(c => typeof c !== 'string' || c.length === 0)) {
    return { ok: false, error: 'capabilities must be a bounded array of non-empty strings' }
  }
  if (!isIsoLike(record.createdAt) || !isIsoLike(record.updatedAt)) {
    return { ok: false, error: 'createdAt/updatedAt must be ISO-like timestamps' }
  }
  return {
    ok: true,
    value: {
      profileId: record.profileId as string,
      siteScope: record.siteScope as string,
      displayName: record.displayName as string,
      ...record.accountSummary === undefined ? {} : { accountSummary: record.accountSummary as string },
      capabilities: [...record.capabilities as string[]],
      createdAt: record.createdAt as string,
      updatedAt: record.updatedAt as string,
    },
  }
}
