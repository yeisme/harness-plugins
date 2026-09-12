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
