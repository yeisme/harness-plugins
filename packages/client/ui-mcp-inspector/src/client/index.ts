/**
 * DSH Web Tools inspector client plugin.
 *
 * Registers one "Tools" pane in Pane Workbench. Session MCP
 * activity is derived from ConversationSnapshot; the skills/MCP catalog and
 * enablement overlay come from the host `toolHub` Remote when mounted.
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector/client
 */

import type { ClientContext, ISessions } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { createElement } from 'react'
import type { ToolsTranslator } from './McpInspectorView.tsx'
import { en, NS, zh } from './locales.ts'
import { ToolsPane } from './pane.tsx'

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
export const inject = ['locale', 'sessions'] as const

interface PaneFace {
  registerView(input: {
    descriptor: Record<string, unknown>
    i18n: { namespace: string; labelKey: string }
    component: () => unknown
  }): () => void
  openView(input: unknown): unknown
}

function asPane(value: unknown): PaneFace | undefined {
  const pane = value as Partial<PaneFace> | undefined
  return typeof pane?.registerView === 'function' && typeof pane.openView === 'function' ? pane as PaneFace : undefined
}

/** Optional service probe also handles sibling load order and hot unload. */
export function apply(ctx: ClientContext): () => void {
  const disposeLocale = ctx.locale.register(NS, { zh, en })
  const t = ctx.locale.bind(NS) as unknown as ToolsTranslator
  const sessions = ctx.get('sessions') as ISessions
  let pane: PaneFace | undefined
  let disposePane = () => {}
  const mount = (next: PaneFace | undefined): void => {
    if (next === pane) return
    disposePane()
    disposePane = () => {}
    pane = next
    if (next === undefined) return
    disposePane = next.registerView({
      descriptor: {
        kind: 'mcp-inspector', label: t('view.tools'), componentKey: 'mcp-inspector',
        role: 'inspector', preferredRegion: 'right', retention: 'recreate', singleton: true,
      },
      i18n: { namespace: NS, labelKey: 'view.tools' },
      component: () => createElement(ToolsPane, { ctx, sessions, t }),
    })
  }
  let offService = () => {}
  try {
    let initial: unknown
    try { initial = ctx.get('paneWorkbench' as never) } catch { /* optional host capability */ }
    mount(asPane(initial))
    offService = ctx.on('internal/service', (service, value) => {
      if (service === 'paneWorkbench') mount(asPane(value))
    }, { global: true })
  } catch (error) {
    disposePane()
    disposeLocale()
    throw error
  }
  return () => { offService(); disposePane(); disposeLocale() }
}
