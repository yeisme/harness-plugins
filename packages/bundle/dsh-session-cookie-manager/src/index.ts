/**
 * @yeisme/dsh-session-cookie-manager root entry.
 *
 * No-op Host face: cookie storage, jar apply/switch and quota sources stay
 * with the DSH Host (Phase 2 `web.cookieJars` seam). Browser interactions
 * are exported from `./client`.
 *
 * @module @yeisme/dsh-session-cookie-manager
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-session-cookie-manager'
export const inject: readonly string[] = []

/** No-op Host lifecycle: no DSH core fork, no Host-private reimplementation. */
export function apply(_ctx: Context): void {
  // host side intentionally empty
}

const DshSessionCookieManagerPlugin = { name, inject, apply }
export default DshSessionCookieManagerPlugin
