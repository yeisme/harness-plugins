/**
 * DSH MCP Inspector browser entry.
 *
 * 直接复用 `@yeisme/dsh-client-ui-mcp-inspector/client` 的 slot 注册；
 * 本文件只做 re-export，不复制任何业务状态。
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
