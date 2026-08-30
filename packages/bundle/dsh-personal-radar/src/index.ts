/**
 * @yeisme/dsh-personal-radar root entry.
 *
 * Installable DSH Web bundle for the Personal Drama Radar pack. The host
 * face is a no-op: badge, commands, and pane registration live in the
 * client face at `./client`.
 *
 * @module @yeisme/dsh-personal-radar
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-personal-radar'
export const inject: readonly string[] = []

/** No-op Host lifecycle: this change adds no DSH core fork and does not replicate private Host implementation. */
export function apply(_ctx: Context): void {
  // host side intentionally empty
}

const DshPersonalRadarPlugin = { name, inject, apply }

export default DshPersonalRadarPlugin
