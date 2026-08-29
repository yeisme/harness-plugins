/**
 * MCP 调用活动派生（纯函数，无框架依赖）。
 *
 * 输入是 ConversationSnapshot 的结构化子集：已落地的 tool-result 节点与
 * 运行中的 tool call。`mcp__<server>__<tool>` 分组：server 名可含下划线；
 * 解析不出唯一 server 的条目丢弃。
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

export type ToolActivityFamily = 'mcp' | 'skill' | 'native'

export interface ToolActivityRecord {
  readonly itemId: `mcp:${string}` | `tool:${string}` | null
  readonly family: ToolActivityFamily
  readonly server?: string
  readonly tool: string
  readonly time: number
  readonly durationMs: number | null
  readonly isError: boolean
  readonly running: boolean
  readonly sequence: number
}

export interface ToolActivitySnapshot {
  readonly calls: number
  readonly errors: number
  readonly running: number
  readonly records: readonly ToolActivityRecord[]
}

const MCP_PREFIX = 'mcp__'
const SAFE_TOOL_NAME = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/
const MAX_TOOL_ACTIVITY_RECORDS = 200

/** 解析 `mcp__<server>__<tool>`；不匹配或无唯一 server 时返回 null。 */
export function splitMcpToolName(name: string): { server: string; tool: string } | null {
  if (!name.startsWith(MCP_PREFIX)) return null
  const rest = name.slice(MCP_PREFIX.length)
  const separator = rest.indexOf('__')
  if (separator <= 0) return null
  return { server: rest.slice(0, separator), tool: rest.slice(separator + 2) }
}

function parseToolActivity(name: string): Pick<ToolActivityRecord, 'itemId' | 'family' | 'server' | 'tool'> | null {
  if (name === 'skill') return { itemId: null, family: 'skill', tool: 'skill' }
  const mcp = splitMcpToolName(name)
  if (mcp !== null) return { itemId: `mcp:${mcp.server}`, family: 'mcp', server: mcp.server, tool: mcp.tool }
  if (!SAFE_TOOL_NAME.test(name)) return null
  return { itemId: `tool:${name}`, family: 'native', tool: name }
}

/**
 * 统一派生会话工具活动；只读取 safe call name/timing/error，不读取 arguments/result。
 * summary 统计全部合法记录，records 只保留最近 200 条供 UI 渲染。
 */
export function deriveToolActivity(
  nodes: readonly ActivityToolResultNode[],
  runningCalls: readonly ActivityRunningCall[] = [],
): ToolActivitySnapshot {
  const records: ToolActivityRecord[] = []
  let calls = 0
  let errors = 0
  let running = 0
  const land = (record: ToolActivityRecord) => {
    calls += 1
    if (record.isError) errors += 1
    if (record.running) running += 1
    records.push(record)
  }
  runningCalls.forEach((call, index) => {
    const parsed = parseToolActivity(call.name)
    if (parsed === null) return
    land({ ...parsed, time: call.time, durationMs: null, isError: false, running: true, sequence: Number.MAX_SAFE_INTEGER - index })
  })
  for (const node of nodes) {
    const name = node.call?.name
    if (typeof name !== 'string') continue
    const parsed = parseToolActivity(name)
    if (parsed === null) continue
    land({
      ...parsed,
      time: node.time,
      durationMs: node.callTime !== null && node.time >= node.callTime ? node.time - node.callTime : null,
      isError: node.isError,
      running: false,
      sequence: node.seq,
    })
  }
  records.sort((a, b) => b.time - a.time || b.sequence - a.sequence || a.tool.localeCompare(b.tool))
  return { calls, errors, running, records: records.slice(0, MAX_TOOL_ACTIVITY_RECORDS) }
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
