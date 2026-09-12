import { createMarketToolTransport } from './market-tool-transport.js'
import type { ConnectedMarketTransport } from './market-adapter.js'

/** Structural subset of the verified ToolRuntime surface; the host supplies its actual agent object. */
export interface MarketToolRuntime<Agent extends object> {
  schemas(agent: Agent): { name: string; parameters: unknown }[]
  execute(input: { callId: string; name: string; arguments: unknown; agent: Agent; signal: AbortSignal }): Promise<{
    isError: boolean; value?: unknown
  }>
}
export function createScopedMarketToolConnection<Agent extends object>(
  runtime: MarketToolRuntime<Agent>, agent: Agent, searchToolName: string,
): ConnectedMarketTransport {
  if (!agent || typeof agent !== 'object') throw new Error('market_agent_scope_required')
  const discover = () => {
    const matches = runtime.schemas(agent).filter(tool => tool.name === searchToolName)
    if (matches.length !== 1) throw new Error('market_tool_unavailable')
    return { name: matches[0]!.name, inputSchema: matches[0]!.parameters }
  }
  const invoke = async (name: string, args: { view: string }, signal?: AbortSignal) => {
    if (signal?.aborted) throw new Error('market_read_cancelled')
    const result = await runtime.execute({ callId: 'radar-market-' + crypto.randomUUID(), name, arguments: args,
      agent, signal: signal ?? new AbortController().signal })
    // Never call a tool definition directly: execute owns guards, policy and
    // cancellation. Only its successful canonical MCP value reaches projection.
    if (result.isError) throw new Error('market_tool_execution_denied')
    return result.value
  }
  createMarketToolTransport(discover(), invoke)
  return { readResource(input, options) {
    // Tool visibility can change during a long-lived connection. Recheck in
    // the SAME agent scope before every read rather than caching permission.
    return createMarketToolTransport(discover(), invoke).readResource(input, options)
  } }
}
