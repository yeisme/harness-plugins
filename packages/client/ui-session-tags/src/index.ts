/**
 * @yeisme/dsh-client-ui-session-tags node/host-side entry.
 *
 * Browser logic lives in `./client`; the node side is intentionally a no-op
 * so pure host profiles can compose this package without client effects.
 *
 * @module @yeisme/dsh-client-ui-session-tags
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'client-ui-session-tags'
export const inject: readonly string[] = []

export function apply(_ctx: Context): void {
  // no-op host face
}

const ClientUiSessionTagsPlugin = { name, inject, apply }
export default ClientUiSessionTagsPlugin
