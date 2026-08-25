/**
 * @yeisme/dsh-ai-drama-director root entry.
 *
 * Installable DSH Web bundle for AI Drama Director pack. Host face is no-op:
 * commands, panes, and preset registration live in the client face at `./client`.
 *
 * @module @yeisme/dsh-ai-drama-director
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-ai-drama-director'
export const inject: readonly string[] = []

/** No-op Host lifecycle: this change adds no DSH core fork and does not replicate private Host implementation. */
export function apply(_ctx: Context): void {
  // host side intentionally empty
}

const DshAiDramaDirectorPlugin = { name, inject, apply }

export default DshAiDramaDirectorPlugin
