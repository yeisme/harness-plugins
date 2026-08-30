/**
 * @yeisme/dsh-client-ui-personal-radar node/host-side entry.
 *
 * Browser logic and badge/command/pane registration live in `./client`.
 * The host-side face is a no-op so pure host profiles can compose safely.
 *
 * @module @yeisme/dsh-client-ui-personal-radar
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'client-ui-personal-radar'
export const inject: readonly string[] = []

export function apply(_ctx: Context): void {
  // no-op host face
}

const ClientUiPersonalRadarPlugin = { name, inject, apply }

export default ClientUiPersonalRadarPlugin
