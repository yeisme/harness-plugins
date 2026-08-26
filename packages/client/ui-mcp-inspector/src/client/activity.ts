/**
 * MCP 调用活动派生（纯函数，无框架依赖）。
 *
 * 输入是 ConversationSnapshot 的结构化子集：已落地的 tool-result 节点与
 * 运行中的 tool call。`mcp__<server>__<tool>` 分组规则与 dsh-console 的
 * `splitMcpTool` 一致：server 名可含下划线；解析不出唯一 server 的条目丢弃。
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector/client
 */

/** 已落地调用的结构化视图（来自 kind === 'tool-result' 节点）。 */
export interface ActivityToolResultNode {
  kind: 'tool-result'
  seq: number
  time: number
  call: { name: string } | null
  callTime: number | null
  isError: boolean
}

/** 运行中调用的结构化视图（来自 runningCalls）。 */
export interface ActivityRunningCall {
  name: string
  time: number
}

export interface McpCallRecord {
  server: string
  tool: string
  time: number
  durationMs: number | null
  isError: boolean
  running: boolean
}

export interface McpServerActivity {
  server: string
  calls: number
  errors: number
  running: number
  records: McpCallRecord[]
}

const MCP_PREFIX = 'mcp__'

/** 解析 `mcp__<server>__<tool>`；不匹配或无唯一 server 时返回 null。 */
export function splitMcpToolName(name: string): { server: string; tool: string } | null {
  if (!name.startsWith(MCP_PREFIX)) return null
  const rest = name.slice(MCP_PREFIX.length)
  const separator = rest.indexOf('__')
  if (separator <= 0) return null
  return { server: rest.slice(0, separator), tool: rest.slice(separator + 2) }
}

/** 按时间倒序聚合 per-server 活动；同输入输出确定。 */
export function deriveMcpActivity(
  nodes: readonly ActivityToolResultNode[],
  runningCalls: readonly ActivityRunningCall[] = [],
): McpServerActivity[] {
  const byServer = new Map<string, McpServerActivity>()
  const land = (server: string, record: McpCallRecord) => {
    const group = byServer.get(server) ?? { server, calls: 0, errors: 0, running: 0, records: [] }
    group.calls += 1
    if (record.isError) group.errors += 1
    if (record.running) group.running += 1
    group.records.push(record)
    byServer.set(server, group)
  }
  for (const call of runningCalls) {
    const parsed = splitMcpToolName(call.name)
    if (!parsed) continue
    land(parsed.server, { server: parsed.server, tool: parsed.tool, time: call.time, durationMs: null, isError: false, running: true })
  }
  for (const node of nodes) {
    const name = node.call?.name
    if (typeof name !== 'string') continue
    const parsed = splitMcpToolName(name)
    if (!parsed) continue
    land(parsed.server, {
      server: parsed.server,
      tool: parsed.tool,
      time: node.time,
      durationMs: node.callTime !== null && node.time >= node.callTime ? node.time - node.callTime : null,
      isError: node.isError,
      running: false,
    })
  }
  for (const group of byServer.values()) {
    group.records.sort((a, b) => b.time - a.time || (b.running ? 1 : 0) - (a.running ? 1 : 0))
    group.records = group.records.slice(0, 20)
  }
  return [...byServer.values()].sort((a, b) => b.calls - a.calls || a.server.localeCompare(b.server))
}
