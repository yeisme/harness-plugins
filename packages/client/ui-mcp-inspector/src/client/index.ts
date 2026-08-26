/**
 * DSH Web MCP inspector client plugin.
 *
 * Registers one read-only "MCP" tab in the conversation view ring. Activity is
 * derived purely from the session ConversationSnapshot (`tool-result` nodes and
 * running calls) grouped by `mcp__<server>__`; no host seam, no writes, no
 * call affordances. Server connectivity stays honestly degraded until the
 * mcp-inventory seam lands (see openspec dsh-mcp-inspector-v1 design).
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { McpInspectorView } from './McpInspectorView.tsx'
import { en, NS, zh } from './locales.ts'

export { McpInspectorView } from './McpInspectorView.tsx'
export { deriveMcpActivity, splitMcpToolName } from './activity.ts'
export type {
  ActivityRunningCall,
  ActivityToolResultNode,
  McpCallRecord,
  McpServerActivity,
} from './activity.ts'
export { en, NS, zh } from './locales.ts'
export type { McpInspectorKey } from './locales.ts'

export const name = 'client-ui-mcp-inspector'
export const inject = ['slots', 'locale'] as const

/**
 * Mount the client face: dictionaries plus the conversation view tab. The
 * registration rides the slot service's effect wrapper, so unload removes it.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): () => void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-mcp-inspector: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'mcp-inspector',
    order: 20,
    locale: NS,
    label: () => t('view.mcp'),
  }, McpInspectorView))
  return () => {}
}
