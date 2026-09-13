import { expect, test } from 'vitest'
import { probeMarketCapability } from '../src/market-probe.js'
import type { ConnectedMarketTransport } from '../src/market-adapter.js'

function transportWith(document: unknown, log: string[] = []): ConnectedMarketTransport {
  return { async readResource({ uri }) {
    log.push(uri)
    if (document instanceof Error) throw document
    return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(document) }] }
  } }
}

function capabilities(views: string[]): unknown {
  return { spec: 'radar.market_capabilities.v1', views }
}

test('ready probe reports every declared view without touching personal resources', async () => {
  const log: string[] = []
  const result = await probeMarketCapability(transportWith(capabilities([
    'market_capabilities', 'market_reader', 'market_brief', 'market_catchup', 'market_signal', 'market_evidence', 'market_compare',
  ]), log))
  expect(result.status).toBe('ready')
  expect(result.reason).toBe('')
  expect(result.views.market_brief).toBe(true)
  expect(result.views.market_compare).toBe(true)
  expect(log).toEqual(['radar://market/capabilities'])
})

test('reader-only owner keeps the market face disabled with one stable reason', async () => {
  const result = await probeMarketCapability(transportWith(capabilities(['market_capabilities', 'market_reader'])))
  expect(result.status).toBe('reader_only')
  expect(result.reason).toContain('market_capability_reader_only')
  expect(result.views.market_reader).toBe(true)
  expect(result.views.market_brief).toBe(false)
})

test('partial owner declares required views and marks missing deep-read views', async () => {
  const result = await probeMarketCapability(transportWith(capabilities(['market_capabilities', 'market_reader', 'market_brief'])))
  expect(result.status).toBe('partial')
  expect(result.views.market_brief).toBe(true)
  expect(result.views.market_catchup).toBe(false)
  expect(result.views.market_signal).toBe(false)
  expect(result.reason).toContain('market_capability_partial')
})

test('mismatch owner documents are never reinterpreted as market capability', async () => {
  const personal = await probeMarketCapability(transportWith({ spec: 'radar.mcp.handoff.v1', capabilities: ['save', 'dismiss'] }))
  expect(personal.status).toBe('mismatch')
  expect(personal.reason).toContain('market_contract_mismatch')
  const wrongShape = await probeMarketCapability(transportWith({ spec: 'radar.market_capabilities.v1', views: 'market_brief' }))
  expect(wrongShape.status).toBe('mismatch')
  const emptyViews = await probeMarketCapability(transportWith(capabilities([])))
  expect(emptyViews.status).toBe('mismatch')
})

test('unreachable or malformed owners degrade to unavailable without owner diagnostics', async () => {
  const offline = await probeMarketCapability(transportWith(new Error('ECONNREFUSED radar owner internal path /home/user')))
  expect(offline.status).toBe('unavailable')
  expect(offline.reason).not.toContain('/home/user')
  const malformed: ConnectedMarketTransport = { async readResource() { return { contents: [{ uri: 'radar://market/capabilities', text: 'not-json' }] } } }
  const bad = await probeMarketCapability(malformed)
  expect(bad.status).toBe('unavailable')
  const aborted = new AbortController()
  aborted.abort()
  expect((await probeMarketCapability(transportWith(capabilities(['market_brief'])), aborted.signal)).status).toBe('unavailable')
})

test('unknown future views are ignored instead of copied into the projection', async () => {
  const result = await probeMarketCapability(transportWith(capabilities([
    'market_capabilities', 'market_reader', 'market_brief', 'market_telemetry_v9',
  ])))
  expect(result.status).toBe('partial')
  expect(Object.keys(result.views)).not.toContain('market_telemetry_v9')
})
