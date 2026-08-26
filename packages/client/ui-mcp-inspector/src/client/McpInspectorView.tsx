/**
 * MCP 活动只读视图（conversation.view tab；纯读者，无自有 store）。
 *
 * 经 ConvViewProps.useSession 订阅 ConversationSnapshot，派生逻辑全部在
 * activity.ts（纯函数）。只读：不提供任何调用工具的用户动作。
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector/client
 */
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { deriveMcpActivity, type ActivityRunningCall, type ActivityToolResultNode } from './activity.ts'

function formatDuration(ms: number | null): string {
  if (ms === null) return ''
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60_000)}m`
}

function formatTime(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(11, 19)
}

export function McpInspectorView({ useSession }: ConvViewProps): JSX.Element {
  const servers = useSession(snapshot => {
    const landed = snapshot.nodes.filter(node => node.kind === 'tool-result') as unknown as ActivityToolResultNode[]
    return deriveMcpActivity(landed, snapshot.runningCalls as unknown as ActivityRunningCall[])
  })
  return (
    <section aria-label="MCP activity" style={{ padding: '12px 16px', overflowY: 'auto', height: '100%' }}>
      <p style={{ margin: '0 0 12px', opacity: 0.7, fontSize: 12 }}>
        catalog: unavailable in this version
      </p>
      {servers.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No MCP tool activity in this session</p>
      ) : (
        servers.map(server => (
          <article key={server.server} style={{ marginBottom: 16 }}>
            <header style={{ fontWeight: 600 }}>
              mcp__{server.server}
              <span style={{ marginLeft: 8, fontWeight: 400, opacity: 0.7 }}>
                {server.calls} calls{server.errors > 0 ? ` · ${server.errors} errors` : ''}
              </span>
            </header>
            <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0, fontSize: 13 }}>
              {server.records.map((record, index) => (
                <li key={`${record.tool}-${record.time}-${index}`} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
                  <span style={{ opacity: 0.6, minWidth: 64 }}>{formatTime(record.time)}</span>
                  <span style={{ minWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.tool}</span>
                  <span style={{ opacity: 0.7 }}>
                    {record.running ? 'running' : record.isError ? `error · ${formatDuration(record.durationMs)}` : formatDuration(record.durationMs)}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))
      )}
    </section>
  )
}
