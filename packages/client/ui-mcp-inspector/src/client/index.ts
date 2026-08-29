/**
 * DSH Web Tools inspector client plugin.
 *
 * Registers one "Tools" tab in the conversation view ring. Session MCP
 * activity is derived from ConversationSnapshot; the skills/MCP catalog and
 * enablement overlay come from the host `toolHub` Remote when mounted.
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { createElement } from 'react'
import { ToolsHubBinding } from './binding.ts'
import { McpInspectorView, type ToolsTranslator } from './McpInspectorView.tsx'
import { createToolsHubController } from './controller.ts'
import { en, NS, zh } from './locales.ts'
import { resolveToolHubRemote } from './remote.ts'

export { McpInspectorView, renderToolsInspectorTree } from './McpInspectorView.tsx'
export type { ActivityFilter, ActivityMode, ToolsInspectorTreeProps, ToolsInspectorViewProps, ToolsNotice, ToolsSection, ToolsTranslator } from './McpInspectorView.tsx'
export { deriveMcpActivity, deriveToolActivity, splitMcpToolName } from './activity.ts'
export type {
  ActivityRunningCall,
  ActivityToolResultNode,
  McpCallRecord,
  McpServerActivity,
  ToolActivityFamily,
  ToolActivityRecord,
  ToolActivitySnapshot,
} from './activity.ts'
export { filterCatalog, itemMatchesFilter, countByAvailability, countByFamily } from './filter.ts'
export { ToolsHubBinding } from './binding.ts'
export { ToolsHubController, createToolsHubController } from './controller.ts'
export { toolHubRemoteContribution } from './remote-contribution.ts'
export { resolveToolHubRemote } from './remote.ts'
export { normalizeToolHubClientError, ToolHubClientError } from './remote.ts'
export type { ToolHubClientErrorCode } from './remote.ts'
export type {
  ToolHubAvailability,
  ToolHubCatalogAnswerV1,
  ToolHubCatalogV1,
  ToolHubFamily,
  ToolHubHealthStateV1,
  ToolHubHealthV1,
  ToolHubItemId,
  ToolHubItemV1,
  ToolHubOrigin,
  ToolHubReasonCodeV1,
  ToolHubSetEnabledAnswerV1,
  ToolHubSetEnabledInputV1,
} from './wire.ts'
export { en, NS, zh } from './locales.ts'
export type { McpInspectorKey } from './locales.ts'

export const name = 'client-ui-mcp-inspector'
export const inject = ['slots', 'locale'] as const

/**
 * Mount dictionaries and the conversation view tab. Catalog remote is probed
 * asynchronously; missing host degrades to activity-only with an honest banner.
 */
export function apply(ctx: ClientContext): () => void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-mcp-inspector: dictionaries')
  const t = ctx.locale.bind(NS)
  const binding = new ToolsHubBinding()
  let disposed = false
  void resolveToolHubRemote(ctx).then(remote => {
    // Plugin can unload while the probe is in flight; attaching afterwards
    // would leak a controller nobody disposes (creator-studio pattern).
    if (disposed || remote === undefined) return
    const controller = createToolsHubController(remote)
    binding.attach(controller)
    void controller.refresh()
  })
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'mcp-inspector',
    order: 20,
    locale: NS,
    label: () => t('view.tools'),
  }, (props: Parameters<typeof McpInspectorView>[0]) => createElement(McpInspectorView, { ...props, binding, t: t as unknown as ToolsTranslator })))
  return () => {
    disposed = true
    binding.dispose()
  }
}
