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
  deriveMcpActivity,
  deriveToolActivity,
  splitMcpToolName,
  filterCatalog,
  en,
  NS,
  zh,
} from '@yeisme/dsh-client-ui-mcp-inspector/client'
export type {
  ActivityRunningCall,
  ActivityToolResultNode,
  McpCallRecord,
  McpInspectorKey,
  McpServerActivity,
  ToolActivityFamily,
  ToolActivityRecord,
  ToolActivitySnapshot,
} from '@yeisme/dsh-client-ui-mcp-inspector/client'
