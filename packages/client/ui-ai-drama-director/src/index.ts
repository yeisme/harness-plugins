/**
 * @yeisme/dsh-client-ui-ai-drama-director node/host-side entry.
 *
 * Browser logic and command/pane registration live in `./client`.
 * The host-side face is a no-op to allow pure host profile composition.
 *
 * @module @yeisme/dsh-client-ui-ai-drama-director
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'client-ui-ai-drama-director'
export const inject: readonly string[] = []

export function apply(_ctx: Context): void {
  // no-op host face
}

const ClientUiAiDramaDirectorPlugin = { name, inject, apply }

export default ClientUiAiDramaDirectorPlugin
