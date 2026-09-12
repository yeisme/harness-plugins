import type { ConnectedMarketTransport } from './market-adapter.js'

export interface DiscoveredMarketSearch {
  name: string
  inputSchema: unknown
}
export type MarketToolCaller = (name: string, args: { view: string; cursor?: string; signal?: string; revision?: number; evidence?: string }, signal?: AbortSignal) => Promise<unknown>

/** The caller supplies the exact discovered public name; never reconstruct MCP namespace names. */
export function createMarketToolTransport(tool: DiscoveredMarketSearch, call: MarketToolCaller): ConnectedMarketTransport {
  const schema = tool.inputSchema as { properties?: { view?: { enum?: unknown } } } | null
  const views = schema?.properties?.view?.enum
  if (typeof tool.name !== 'string' || !tool.name.length || tool.name.length > 160 || !Array.isArray(views) ||
    !['market_capabilities', 'market_reader', 'market_brief'].every(view => views.includes(view))) throw new Error('market_tool_contract_mismatch')
  const paths: Record<string, string> = {
    'radar://market/capabilities': 'market_capabilities',
    'radar://market/reader': 'market_reader',
    'radar://market/briefs/latest': 'market_brief',
  }
  return { async readResource({ uri }, options) {
    let args: Parameters<MarketToolCaller>[1]
    const detail = /^radar:\/\/market\/signals\/([A-Za-z0-9][A-Za-z0-9._:-]{0,159})\/revisions\/([1-9]\d*)(?:\/evidence\/([A-Za-z0-9][A-Za-z0-9._:-]{0,159}))?$/.exec(uri)
    if (detail) {
      const view = detail[3] ? 'market_evidence' : 'market_signal'
      const revision = Number(detail[2])
      if (!views.includes(view) || !Number.isSafeInteger(revision)) throw new Error('market_resource_unavailable')
      args = { view, signal: detail[1]!, revision, ...(detail[3] ? { evidence: detail[3] } : {}) }
    } else if (uri === 'radar://market/catchup' || uri.startsWith('radar://market/catchup?')) {
      const query = new URL(uri).searchParams
      const cursor = query.get('cursor')
      if (!views.includes('market_catchup') || [...query.keys()].some(key => key !== 'cursor') || query.getAll('cursor').length > 1 ||
        (cursor !== null && (!/^[A-Za-z0-9_-]+$/.test(cursor) || cursor.length > 2048))) throw new Error('market_resource_unavailable')
      args = { view: 'market_catchup', ...(cursor !== null ? { cursor } : {}) }
    } else {
      if (!Object.hasOwn(paths, uri)) throw new Error('market_resource_unavailable')
      args = { view: paths[uri]! }
    }
    const response = await call(tool.name, args, options?.signal) as {
      isError?: boolean; content?: { type?: string; text?: string }[]
    }
    if (!response || !Array.isArray(response.content) || response.content.length !== 1 ||
      response.content[0]?.type !== 'text' || typeof response.content[0].text !== 'string' || response.content[0].text.length > 1_000_000) throw new Error('market_tool_contract_mismatch')
    const value = JSON.parse(response.content[0].text) as { error?: unknown }
    if (response.isError || value?.error) {
      const code = value?.error
      throw { data: { code: ['brief_not_found', 'signal_not_found', 'evidence_not_found', 'content_blocked', 'state_conflict', 'cursor_invalid'].includes(String(code)) ? code : 'market_read_failed' } }
    }
    return { contents: [{ uri, mimeType: 'application/json', text: response.content[0].text }] }
  } }
}
