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
  error?: { readonly name?: string; readonly code?: string }
  /** Host-computed render intent from the paired tool/call wire view; opaque here. */
  callView?: unknown
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

/**
 * Owner-authored safe execution summary for one landed call.
 *
 * Only presentation-vocabulary fields the tool itself declared for display are
 * carried: `title` (command or one-line operation summary), optional
 * `description`, optional `kind` and bounded model-facing `locations` paths.
 * `rawInput`, diff bodies and working directories are never projected even when
 * the render intent carries them.
 */
export interface SafeCallSummary {
  readonly title: string
  readonly truncated: boolean
  readonly kind?: string
  readonly description?: string
  readonly locations: readonly string[]
}

export interface ToolActivityRecord {
  readonly itemId: `mcp:${string}` | `tool:${string}` | null
  readonly family: ToolActivityFamily
  readonly server?: string
  readonly tool: string
  readonly time: number
  readonly durationMs: number | null
  readonly isError: boolean
  readonly running: boolean
  readonly errorCode?: string
  readonly errorName?: string
  readonly sequence: number
  readonly summary?: SafeCallSummary
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

const SUMMARY_DISPLAY_LIMIT = 600
const SUMMARY_TITLE_LIMIT = 2000
const SUMMARY_DESCRIPTION_LIMIT = 300
const SUMMARY_LOCATION_LIMIT = 200
const SUMMARY_LOCATIONS = 3
const SAFE_CALL_KIND = /^(read|edit|delete|move|search|execute|fetch|other)$/
const SAFE_SUMMARY_CARD = new Set(['generic', 'terminal', 'diff'])

function boundedText(value: unknown, limit: number): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > limit) return undefined
  // Control characters (except spaces) never belong in a display summary.
  return /[\x00-\x08\x0e-\x1f\x7f]/.test(value) ? undefined : value
}

/**
 * Narrow one host render intent to a safe display summary. Unknown shapes,
 * missing titles or oversized fields yield `undefined` — the caller then shows
 * an explicit "no safe summary" state instead of guessing from raw arguments.
 */
export function deriveSafeCallSummary(callView: unknown): SafeCallSummary | undefined {
  if (typeof callView !== 'object' || callView === null) return undefined
  const view = callView as { card?: unknown; title?: unknown; kind?: unknown; description?: unknown; locations?: unknown }
  if (typeof view.card !== 'string' || !SAFE_SUMMARY_CARD.has(view.card)) return undefined
  const title = boundedText(view.title, SUMMARY_TITLE_LIMIT)
  if (title === undefined) return undefined
  const kind = typeof view.kind === 'string' && SAFE_CALL_KIND.test(view.kind) ? view.kind : undefined
  const description = boundedText(view.description, SUMMARY_DESCRIPTION_LIMIT)
  const locations: string[] = []
  if (Array.isArray(view.locations)) {
    for (const location of view.locations) {
      if (locations.length >= SUMMARY_LOCATIONS) break
      const path = boundedText((location as { path?: unknown })?.path, SUMMARY_LOCATION_LIMIT)
      if (path !== undefined) locations.push(path)
    }
  }
  const truncated = title.length > SUMMARY_DISPLAY_LIMIT
  return {
    title: truncated ? title.slice(0, SUMMARY_DISPLAY_LIMIT) : title,
    truncated,
    ...(kind !== undefined ? { kind } : {}),
    ...(description !== undefined ? { description } : {}),
    locations,
  }
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
    const summary = node.callView === undefined ? undefined : deriveSafeCallSummary(node.callView)
    land({
      ...parsed,
      time: node.time,
      durationMs: node.callTime !== null && node.time >= node.callTime ? node.time - node.callTime : null,
      isError: node.isError,
      running: false,
      sequence: node.seq,
      ...(node.error?.code && /^[A-Za-z0-9_.:-]{1,120}$/.test(node.error.code) ? { errorCode: node.error.code } : {}),
      ...(node.error?.name && /^[A-Za-z0-9_. -]{1,120}$/.test(node.error.name) ? { errorName: node.error.name } : {}),
      ...(summary !== undefined ? { summary } : {}),
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
