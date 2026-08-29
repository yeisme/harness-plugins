/**
 * Tool-hub item ids and MCP public-name parsing.
 *
 * @module @yeisme/dsh-tool-hub-host/ids
 */

export type ToolHubFamily = 'mcp' | 'skill' | 'native'
export type ToolHubItemId = `skill:${string}` | `tool:${string}` | `mcp:${string}`

const ID_RE = /^(skill|tool|mcp):[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/
const MCP_PREFIX = 'mcp__'

export function isToolHubItemId(value: string): value is ToolHubItemId {
  return ID_RE.test(value)
}

export function skillId(name: string): ToolHubItemId {
  return `skill:${name}`
}

export function toolId(name: string): ToolHubItemId {
  return `tool:${name}`
}

export function mcpId(server: string): ToolHubItemId {
  return `mcp:${server}`
}

export function parseToolHubItemId(value: string): { family: ToolHubFamily; name: string } | undefined {
  if (!isToolHubItemId(value)) return undefined
  const separator = value.indexOf(':')
  return { family: value.slice(0, separator) as ToolHubFamily, name: value.slice(separator + 1) }
}

/** Parse `mcp__<server>__<tool>`; reject names without a unique server. */
export function splitMcpToolName(name: string): { server: string; tool: string } | undefined {
  if (!name.startsWith(MCP_PREFIX)) return undefined
  const rest = name.slice(MCP_PREFIX.length)
  const separator = rest.indexOf('__')
  if (separator <= 0) return undefined
  const server = rest.slice(0, separator)
  const tool = rest.slice(separator + 2)
  if (server.length === 0 || tool.length === 0) return undefined
  return { server, tool }
}

export function boundLabel(value: unknown, fallback: string, max = 160): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > max) return fallback
  return trimmed
}
