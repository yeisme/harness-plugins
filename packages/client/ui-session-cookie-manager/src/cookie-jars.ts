/**
 * Plugin-local probe for the additive `web.cookieJars` host seam.
 *
 * Published DSH still lacks `WebCookieJarsV1`. Probe first; never invent a
 * local jar. The host owns cookie bytes. This module only exchanges profile
 * refs and redacted receipts.
 *
 * @module @yeisme/dsh-client-ui-session-cookie-manager/cookie-jars
 */

export const COOKIE_JARS_CAPABILITY = 'WebCookieJarsV1' as const

export type CookieJarAction = 'apply' | 'switch' | 'clear'

export interface CookieJarProfileRef {
  readonly profileRef: string
  readonly siteScope: string
}

export interface CookieJarReceipt {
  readonly action: CookieJarAction
  readonly profileRef: string
  readonly status: 'accepted' | 'rejected'
  readonly reason?: string
}

export interface CookieJarSource {
  readonly capabilities?: readonly string[]
  applyJar?(profile: CookieJarProfileRef): Promise<CookieJarReceipt>
  switchJar?(from: CookieJarProfileRef, to: CookieJarProfileRef): Promise<CookieJarReceipt>
  clearJar?(profile: CookieJarProfileRef): Promise<CookieJarReceipt>
}

const FORBIDDEN_KEY = /cookie|token|authorization|set-cookie|bearer/i

/** Profile refs must be opaque tokens, never credential-shaped strings. */
export function isSafeCookieJarProfile(profile: CookieJarProfileRef): boolean {
  return profile.profileRef.length > 0
    && profile.siteScope.length > 0
    && !FORBIDDEN_KEY.test(profile.profileRef)
    && !profile.profileRef.includes('=')
}

/** True only when the host advertises the capability and all three actions. */
export function hasCookieJarsCapability(source: CookieJarSource | undefined): boolean {
  return source?.capabilities?.includes(COOKIE_JARS_CAPABILITY) === true
    && typeof source.applyJar === 'function'
    && typeof source.switchJar === 'function'
    && typeof source.clearJar === 'function'
}

export function redactCookieJarReceipt(receipt: CookieJarReceipt): CookieJarReceipt {
  if (receipt.reason !== undefined && FORBIDDEN_KEY.test(receipt.reason)) {
    return { ...receipt, reason: 'redacted' }
  }
  return receipt
}

function asFunction(value: unknown): ((...args: never[]) => unknown) | undefined {
  return typeof value === 'function' ? value as (...args: never[]) => unknown : undefined
}

/**
 * Bind a live host face when it actually exposes WebCookieJarsV1.
 * Published DSH and incomplete stubs return undefined.
 */
export function bindCookieJars(source: unknown): CookieJarSource | undefined {
  if (source === null || typeof source !== 'object') return undefined
  const record = source as Record<string, unknown>
  const applyJar = asFunction(record.applyJar) as CookieJarSource['applyJar']
  const switchJar = asFunction(record.switchJar) as CookieJarSource['switchJar']
  const clearJar = asFunction(record.clearJar) as CookieJarSource['clearJar']
  if (applyJar === undefined || switchJar === undefined || clearJar === undefined) return undefined
  const capabilities = Array.isArray(record.capabilities)
    ? record.capabilities.filter((item): item is string => typeof item === 'string')
    : []
  const candidate: CookieJarSource = { capabilities, applyJar, switchJar, clearJar }
  return hasCookieJarsCapability(candidate) ? candidate : undefined
}

export type CookieJarCallResult =
  | { ok: true; receipt: CookieJarReceipt }
  | { ok: false; reason: string }

function wrapReceipt(receipt: CookieJarReceipt): CookieJarCallResult {
  const redacted = redactCookieJarReceipt(receipt)
  return redacted.status === 'accepted'
    ? { ok: true, receipt: redacted }
    : { ok: false, reason: redacted.reason ?? 'rejected' }
}

/** Apply one profile jar. Unsafe refs never reach the host. */
export async function applyCookieJar(
  source: CookieJarSource,
  profile: CookieJarProfileRef,
): Promise<CookieJarCallResult> {
  if (!isSafeCookieJarProfile(profile)) {
    return { ok: false, reason: 'unsafe profile ref' }
  }
  const applyJar = source.applyJar
  if (applyJar === undefined) return { ok: false, reason: 'web.cookieJars unavailable' }
  return wrapReceipt(await applyJar(profile))
}

/**
 * Atomic switch: one host transaction replaces the current jar.
 * Callers MUST NOT apply-then-clear locally.
 */
export async function switchCookieJar(
  source: CookieJarSource,
  from: CookieJarProfileRef,
  to: CookieJarProfileRef,
): Promise<CookieJarCallResult> {
  if (!isSafeCookieJarProfile(from) || !isSafeCookieJarProfile(to)) {
    return { ok: false, reason: 'unsafe profile ref' }
  }
  const switchJar = source.switchJar
  if (switchJar === undefined) return { ok: false, reason: 'web.cookieJars unavailable' }
  return wrapReceipt(await switchJar(from, to))
}

/** Clear one profile jar. Unsafe refs never reach the host. */
export async function clearCookieJar(
  source: CookieJarSource,
  profile: CookieJarProfileRef,
): Promise<CookieJarCallResult> {
  if (!isSafeCookieJarProfile(profile)) {
    return { ok: false, reason: 'unsafe profile ref' }
  }
  const clearJar = source.clearJar
  if (clearJar === undefined) return { ok: false, reason: 'web.cookieJars unavailable' }
  return wrapReceipt(await clearJar(profile))
}

export function receiptErrorMessage(result: CookieJarCallResult): string | undefined {
  return result.ok ? undefined : result.reason
}
