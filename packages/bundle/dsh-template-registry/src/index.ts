/**
 * @yeisme/dsh-template-registry-bundle root entry (installable host face).
 *
 * The 2.x host layers (stdio MCP transport, typed catalog/session RPCs,
 * storage domain, session projection, connection manager) are exported as a
 * library from `@yeisme/dsh-template-registry`; wiring the
 * `templateRegistryHost` Remote into a live DSH host profile is the host
 * runtime's composition step. This root apply is a deliberate no-op so the
 * bundle stays installable on host-only profiles without spawning anything.
 *
 * @module @yeisme/dsh-template-registry-bundle
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-template-registry'
export const inject: readonly string[] = []

/** No-op Host lifecycle: this change adds no DSH core fork and does not replicate private Host implementation. */
export function apply(_ctx: Context): void {
  // host side intentionally empty
}

const DshTemplateRegistryPlugin = { name, inject, apply }

export default DshTemplateRegistryPlugin
