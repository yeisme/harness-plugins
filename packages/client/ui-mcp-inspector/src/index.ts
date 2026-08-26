/**
 * @yeisme/dsh-client-ui-mcp-inspector node/host-side entry.
 *
 * Browser logic lives in `./client`; the node side is intentionally a no-op
 * so pure host profiles can compose this package without client effects.
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'client-ui-mcp-inspector'
export const inject: readonly string[] = []

export function apply(_ctx: Context): void {
  // no-op host face
}

const ClientUiMcpInspectorPlugin = { name, inject, apply }

export default ClientUiMcpInspectorPlugin
