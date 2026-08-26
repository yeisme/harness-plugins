/**
 * zh/en 字典（注册进 ctx.locale；key 只在本插件命名空间内）。
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector/client
 */

export const NS = 'mcpInspector' as const

export const zh = {
  'view.mcp': 'MCP',
  'catalog.unavailable': '目录在当前版本不可用（catalog: unavailable in this version）',
  'empty.activity': '本会话暂无 MCP 工具调用（No MCP tool activity in this session）',
  'server.calls': '{calls} 次调用',
  'server.errors': '{errors} 次错误',
  'record.running': '运行中',
  'record.error': '错误',
} as const

export const en = {
  'view.mcp': 'MCP',
  'catalog.unavailable': 'catalog: unavailable in this version',
  'empty.activity': 'No MCP tool activity in this session',
  'server.calls': '{calls} calls',
  'server.errors': '{errors} errors',
  'record.running': 'running',
  'record.error': 'error',
} as const

export type McpInspectorKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    mcpInspector: McpInspectorKey
  }
}
