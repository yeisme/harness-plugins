import { expect, test } from 'vitest'
import { createConnectedRadarMarketHost, type MarketConnectionContext } from '../src/market-host.js'

test('host bridge uses only the current existing connection and does not dispatch stale contexts', async () => {
  let reads = 0
  const context = { ref: 'connection-a-session-a', connection: { async readResource() { reads++; throw { data: { code: 'brief_not_found' } } } } }
  const host = createConnectedRadarMarketHost({ current: () => context, subscribeContext: () => () => {}, subscribePolicy: () => () => {} })
  expect(host.contextRef()).toBe(context.ref)
  expect(await host.load('old-session', new AbortController().signal)).toMatchObject({ reason: 'cancelled' })
  expect(reads).toBe(0)
  expect(await host.load(context.ref, new AbortController().signal)).toMatchObject({ reason: 'brief_absent' })
  expect(reads).toBe(1)
})
test('a connection replacement invalidates an old result even if the context ref was reused', async () => {
  let reject!: (error: unknown) => void
  let context: MarketConnectionContext = { ref: 'session-a', connection: { readResource: () => new Promise((_resolve, fail) => { reject = fail }) } }
  const host = createConnectedRadarMarketHost({ current: () => context, subscribeContext: () => () => {}, subscribePolicy: () => () => {} })
  const pending = host.load('session-a', new AbortController().signal)
  context = { ref: 'session-a', connection: { async readResource() { throw new Error('Not used') } } }
  reject({ data: { code: 'brief_not_found' } })
  expect(await pending).toMatchObject({ reason: 'cancelled' })
})
test('subscriptions stay owned by the context source and return its actual cleanup', () => {
  let subscriptions = 0
  const subscribe = () => { subscriptions++; return () => { subscriptions-- } }
  const host = createConnectedRadarMarketHost({ current: () => null, subscribeContext: subscribe, subscribePolicy: subscribe })
  const one = host.subscribeContext(() => {}), two = host.subscribePolicy(() => {})
  expect(subscriptions).toBe(2)
  one(); two()
  expect(subscriptions).toBe(0)
  expect(host.contextRef()).toBeNull()
})

test('detail host rejects stale contexts before dispatch and discards responses after connection replacement', async () => {
  let calls = 0, reject!: (error: unknown) => void
  let context: MarketConnectionContext = { ref: 'session-a', connection: { readResource() {
    calls++; return new Promise((_resolve, fail) => { reject = fail })
  } } }
  const host = createConnectedRadarMarketHost({ current: () => context, subscribeContext: () => () => {}, subscribePolicy: () => () => {} })
  const selection = { signalRef: 'signal-a', revision: 1 }
  expect(await host.loadSignal!('session-old', selection, new AbortController().signal)).toMatchObject({ reason: 'cancelled' })
  expect(calls).toBe(0)
  const pending = host.loadSignal!('session-a', selection, new AbortController().signal)
  context = { ref: 'session-b', connection: context.connection }
  reject({ data: { code: 'signal_not_found' } })
  expect(await pending).toMatchObject({ reason: 'cancelled' })
  expect(calls).toBe(1)
})

test('probeCapability classifies through the current connection and reports no-connection honestly', async () => {
  const transport = { async readResource({ uri }: { uri: string }) {
    return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ spec: 'radar.market_capabilities.v1', views: ['market_capabilities', 'market_reader'] }) }] }
  } }
  const host = createConnectedRadarMarketHost({ current: () => ({ ref: 'session-a', connection: transport }), subscribeContext: () => () => {}, subscribePolicy: () => () => {} })
  const probe = await host.probeCapability!()
  expect(probe.status).toBe('reader_only')
  expect(probe.reason).toContain('market_capability_reader_only')
  const empty = createConnectedRadarMarketHost({ current: () => null, subscribeContext: () => () => {}, subscribePolicy: () => () => {} })
  expect((await empty.probeCapability!()).status).toBe('unavailable')
})

test('probeCapability results from a replaced connection are discarded', async () => {
  let release!: (value: unknown) => void
  const read = new Promise<unknown>(resolve => { release = resolve })
  let context: MarketConnectionContext = { ref: 'session-a', connection: { async readResource() { return read } } }
  const host = createConnectedRadarMarketHost({ current: () => context, subscribeContext: () => () => {}, subscribePolicy: () => () => {} })
  const pending = host.probeCapability!()
  context = { ref: 'session-b', connection: { async readResource() { throw new Error('Not used') } } }
  release({ contents: [{ uri: 'radar://market/capabilities', mimeType: 'application/json', text: JSON.stringify({ spec: 'radar.market_capabilities.v1', views: ['market_capabilities', 'market_reader', 'market_brief'] }) }] })
  const result = await pending
  expect(result.status).toBe('unavailable')
  expect(result.reason).toContain('connection changed')
})

test('mutate is refused without the owner mutation seam and mutationsAvailable stays false', async () => {
  const host = createConnectedRadarMarketHost({ current: () => ({ ref: 'session-a', connection: { async readResource() { throw new Error('unused') } } }), subscribeContext: () => () => {}, subscribePolicy: () => () => {} })
  expect(host.mutationsAvailable!()).toBe(false)
  const intent = { schema: 'dsh.radar.market-mutation.v1', kind: 'mark_read', selections: [{ signalRef: 'signal-a', revision: 1 }], readerRevision: 1, policyRevision: 'sha256:policy', idempotencyKey: 'x', payloadDigest: 'x' } as never
  const refused = await host.mutate!('session-a', intent, new AbortController().signal)
  expect(refused).toMatchObject({ ok: false, reason: 'capability_unavailable' })
})
