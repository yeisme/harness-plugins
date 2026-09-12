/**
 * DSH MCP Inspector browser entry.
 *
 * Re-exports the Tools pane registration from `@yeisme/dsh-client-ui-mcp-inspector/client`.
 * Business state remains with the host and the shared inspector.
 *
 * @module @yeisme/dsh-mcp-inspector/client
 */

export {
  apply,
  inject,
  McpInspectorView,
  filterCatalog,
  en,
  NS,
  zh,
} from '@yeisme/dsh-client-ui-mcp-inspector/client'
export type {
  McpInspectorKey,
} from '@yeisme/dsh-client-ui-mcp-inspector/client'
