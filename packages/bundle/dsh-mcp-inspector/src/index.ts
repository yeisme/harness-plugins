/**
 * @yeisme/dsh-mcp-inspector root entry (Host face).
 *
 * Composes `@yeisme/dsh-tool-hub-host`: catalog projection, enablement
 * preferences, and `toolHub` Remote. Session logs and prompt admission stay
 * with DSH Host. Browser UI lives in `./client`.
 *
 * @module @yeisme/dsh-mcp-inspector
 */

import { apply as hostApply, inject as hostInject } from '@yeisme/dsh-tool-hub-host'

export const name = 'dsh-mcp-inspector'
export const inject = hostInject
export const apply = hostApply

const DshMcpInspectorPlugin = { name, inject, apply }
export default DshMcpInspectorPlugin
