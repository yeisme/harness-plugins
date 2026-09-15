/**
 * Market capability probe for the connected Radar owner.
 *
 * Reads only the owner-published `radar://market/capabilities` resource and
 * classifies the market face availability before any view renders. The probe
 * never mutates, never falls back to the personal opportunity contract, and
 * never fabricates a view the owner did not declare: a missing capability is
 * reported as a disabled reason so the legacy personal Radar entry stays the
 * only honest surface.
 */

import type { ConnectedMarketTransport } from './market-adapter.js'

export const MARKET_REQUIRED_VIEWS = ['market_brief', 'market_reader'] as const
export const MARKET_OPTIONAL_VIEWS = ['market_catchup', 'market_signal', 'market_evidence', 'market_compare', 'market_reviews', 'market_review'] as const
export type MarketViewName = typeof MARKET_REQUIRED_VIEWS[number] | typeof MARKET_OPTIONAL_VIEWS[number] | 'market_capabilities'

export type MarketCapabilityStatus =
  /** All required views are declared by the owner; the market face may mount. */
  | 'ready'
  /** The owner only exposes the reader view; briefs cannot be read yet. */
  | 'reader_only'
  /** Required views exist but some optional deep-read views are missing. */
  | 'partial'
  /** The owner answered with an incompatible contract shape. */
  | 'mismatch'
  /** The owner did not answer or the transport failed. */
  | 'unavailable'

export interface MarketCapabilityProbeResultV1 {
  readonly schema: 'dsh.radar.market-capability-probe.v1'
  readonly status: MarketCapabilityStatus
  /** Stable disabled reason when status is not ready; empty string otherwise. */
  readonly reason: string
  /** Per-view availability exactly as the owner declared it. */
  readonly views: Readonly<Record<MarketViewName, boolean>>
}

export const MARKET_PROBE_REASONS = {
  ready: '',
  reader_only: 'market_capability_reader_only: the Radar owner exposes the market reader view but no market briefs yet; the market face stays disabled',
  partial: 'market_capability_partial: the Radar owner does not expose every market deep-read view; only declared views may render',
  mismatch: 'market_contract_mismatch: the Radar owner market capability resource does not match radar.market_capabilities.v1',
  unavailable: 'market_capability_unavailable: the Radar owner did not answer the market capability read; no market data is assumed',
} as const

function emptyViews(): Record<MarketViewName, boolean> {
  const views = { market_capabilities: false } as Record<MarketViewName, boolean>
  for (const view of [...MARKET_REQUIRED_VIEWS, ...MARKET_OPTIONAL_VIEWS]) views[view] = false
  return views
}

function result(status: MarketCapabilityStatus, views: Record<MarketViewName, boolean>): MarketCapabilityProbeResultV1 {
  return { schema: 'dsh.radar.market-capability-probe.v1', status, reason: MARKET_PROBE_REASONS[status], views: { ...views } }
}

/**
 * Probe the owner market capability. Structural contract:
 * `{ spec: 'radar.market_capabilities.v1', views: string[] }`. Any other
 * shape — including a personal/opportunity capability document — is a
 * mismatch, never reinterpreted as market data.
 */
export async function probeMarketCapability(transport: ConnectedMarketTransport, signal?: AbortSignal): Promise<MarketCapabilityProbeResultV1> {
  if (signal?.aborted) return result('unavailable', emptyViews())
  if (!transport || typeof transport.readResource !== 'function') return result('unavailable', emptyViews())
  let raw: unknown
  try {
    const response = await transport.readResource({ uri: 'radar://market/capabilities' }, signal ? { signal } : undefined)
    const contents = (response as { contents?: unknown } | null)?.contents
    if (!Array.isArray(contents) || contents.length !== 1) return result('mismatch', emptyViews())
    const row = contents[0] as { uri?: unknown; text?: unknown }
    if (row?.uri !== 'radar://market/capabilities' || typeof row.text !== 'string' || row.text.length > 1_000_000) return result('mismatch', emptyViews())
    raw = JSON.parse(row.text)
  } catch {
    // Offline owners, malformed JSON and aborts all degrade to one honest
    // unavailable reason; no diagnostic text from the owner is surfaced.
    return result('unavailable', emptyViews())
  }
  const row = raw as { spec?: unknown; views?: unknown } | null
  if (!row || typeof row !== 'object' || row.spec !== 'radar.market_capabilities.v1' || !Array.isArray(row.views) || row.views.length > 64) {
    return result('mismatch', emptyViews())
  }
  const views = emptyViews()
  for (const view of row.views) {
    if (typeof view !== 'string' || !Object.hasOwn(views, view)) continue // Unknown future views are ignored, not copied.
    views[view as MarketViewName] = true
  }
  views.market_capabilities = true
  const ready = MARKET_REQUIRED_VIEWS.every(view => views[view])
  if (!ready) {
    // Reader-only is the only degraded shape worth distinguishing: the owner
    // is reachable and speaks the market contract, but publishes no briefs.
    return result(views.market_reader ? 'reader_only' : 'mismatch', views)
  }
  const partial = MARKET_OPTIONAL_VIEWS.some(view => !views[view])
  return result(partial ? 'partial' : 'ready', views)
}
