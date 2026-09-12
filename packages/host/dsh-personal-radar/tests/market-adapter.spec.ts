import { expect, test } from 'vitest'
import { readConnectedMarketBrief, readConnectedMarketCatchup, type ConnectedMarketTransport } from '../src/market-adapter.js'
import { readConnectedMarketSignal } from '../src/market-adapter.js'

function transport(options: { policyChange?: boolean; missingCapability?: boolean; malformed?: boolean } = {}) {
  const calls: string[] = []
  let readers = 0
  const client: ConnectedMarketTransport = { async readResource({ uri }) {
    calls.push(uri)
    let data: unknown
    if (uri.endsWith('/capabilities')) data = { spec: 'radar.market_capabilities.v1', views: options.missingCapability ? [] : ['market_brief', 'market_reader'] }
    else if (uri.endsWith('/reader')) data = { spec: 'radar.market_reader.v1', reader_ref: 'local', revision: ++readers,
      policy_revision: options.policyChange && readers === 2 ? 'sha256:changed' : 'sha256:policy' }
    else data = { spec: 'radar.market_brief.v1', brief_ref: 'brief-1', digest: 'sha256:brief', policy_revision: 'sha256:policy',
      generated_at: '2026-09-11T08:00:00.000Z', timezone: 'UTC', window: { start: '2026-09-10T00:00:00Z', end: '2026-09-11T00:00:00Z' },
      status: 'empty', main: [], watching: [], remaining: 0, filtered: false, correction_count: 0, limitations: [],
      coverage: { spec: 'radar.market_source_gaps.v1', sources: [] } }
    return { contents: [{ uri, text: options.malformed ? 'invalid-json' : JSON.stringify(data) }] }
  } }
  return { client, calls }
}
test('connected MCP reads without a binary and returns the latest reader revision', async () => {
  const fake = transport()
  const result = await readConnectedMarketBrief(fake.client)
  expect(result.ok).toBe(true)
  if (result.ok) { expect(result.brief.status).toBe('empty'); expect(result.reader.revision).toBe(2) }
  expect(fake.calls).toEqual(['radar://market/capabilities', 'radar://market/reader', 'radar://market/briefs/latest', 'radar://market/reader'])
})
test('policy changes discard all returned content, while missing capability stops before reading it', async () => {
  const changed = await readConnectedMarketBrief(transport({ policyChange: true }).client)
  expect(changed).toMatchObject({ ok: false, reason: 'policy_changed' })
  expect(changed).not.toHaveProperty('brief')
  const missing = transport({ missingCapability: true })
  expect(await readConnectedMarketBrief(missing.client)).toMatchObject({ ok: false, reason: 'capability_unavailable' })
  expect(missing.calls).toHaveLength(1)
})
test('malformed, absent and offline responses are distinct and never echo private errors', async () => {
  expect(await readConnectedMarketBrief(transport({ malformed: true }).client)).toMatchObject({ reason: 'contract_mismatch' })
  const absent = { async readResource() { throw { data: { code: 'brief_not_found' } } } }
  expect(await readConnectedMarketBrief(absent)).toMatchObject({ reason: 'brief_absent' })
  const offline = await readConnectedMarketBrief({ async readResource() { throw new Error('cookie=private') } })
  expect(offline).toMatchObject({ reason: 'offline' })
  expect(JSON.stringify(offline)).not.toContain('private')
})
test('timeout aborts a pending read and returns without retrying', async () => {
  let calls = 0, signal: AbortSignal | undefined
  const result = await readConnectedMarketBrief({ readResource(_input, options) {
    calls++; signal = options?.signal
    return new Promise(() => {})
  } }, 10)
  expect(result).toMatchObject({ ok: false, reason: 'timeout' })
  expect(calls).toBe(1)
  expect(signal?.aborted).toBe(true)
})

test('external cancellation drops a late response and never starts the next resource read', async () => {
  const controller = new AbortController()
  let calls = 0, finish: ((value: unknown) => void) | undefined
  const pending = readConnectedMarketBrief({ readResource() {
    calls++
    return new Promise(resolve => { finish = resolve })
  } }, 5000, controller.signal)
  controller.abort()
  expect(await pending).toMatchObject({ ok: false, reason: 'cancelled' })
  finish!({ contents: [{ uri: 'radar://market/capabilities', text: JSON.stringify({
    spec: 'radar.market_capabilities.v1', views: ['market_brief', 'market_reader'],
  }) }] })
  await Promise.resolve()
  await Promise.resolve()
  expect(calls).toBe(1)
  const fake = transport()
  expect(await readConnectedMarketBrief(fake.client, 5000, controller.signal)).toMatchObject({ reason: 'cancelled' })
  expect(fake.calls).toEqual([])
})

test('catch-up enforces the reader revision across paged reads and preserves continuation', async () => {
  let reads = 0, changing = false
  const connection: ConnectedMarketTransport = { async readResource({ uri }) {
    const data = uri.endsWith('capabilities') ? { spec: 'radar.market_capabilities.v1', views: ['market_reader', 'market_catchup'] }
      : uri.endsWith('/reader') ? { spec: 'radar.market_reader.v1', reader_ref: 'local', revision: changing ? ++reads : 1, policy_revision: 'sha256:policy' }
        : { spec: 'radar.market_catchup.v1', reader_revision: 1, policy_revision: 'sha256:policy',
          window: { start: '2026-09-10T00:00:00Z', end: '2026-09-11T00:00:00Z' },
          signals: [], next_cursor: 'next_page', history_limited: true, limitations: [] }
    return { contents: [{ uri, text: JSON.stringify(data) }] }
  } }
  const result = await readConnectedMarketCatchup(connection, 'old_page')
  expect(result).toMatchObject({ ok: true, page: { nextCursor: 'next_page', signals: [] } })
  changing = true
  const stale = await readConnectedMarketCatchup(connection)
  expect(stale).toMatchObject({ ok: false, reason: 'state_changed' })
  expect(stale).not.toHaveProperty('page')
  await expect(readConnectedMarketCatchup(connection, 'https://example.invalid')).rejects.toThrow('market_cursor_invalid')
})

test('owner-invalidated cursors request a fresh page rather than masquerading as offline', async () => {
  const connection: ConnectedMarketTransport = { async readResource() { throw { data: { code: 'cursor_invalid' } } } }
  const result = await readConnectedMarketCatchup(connection, 'syntactically_valid')
  expect(result).toMatchObject({ ok: false, reason: 'state_changed' })
  if (!result.ok) expect(result.recovery).toContain('Discard the old cursor')
})

test('detail reads exact revisions and rejects a silently substituted latest revision', async () => {
  let revision = 1
  const paths: string[] = []
  const connection: ConnectedMarketTransport = { async readResource({ uri }) {
    paths.push(uri)
    const data = uri.endsWith('capabilities') ? { spec: 'radar.market_capabilities.v1', views: ['market_reader', 'market_signal'] }
      : uri.endsWith('/reader') ? { spec: 'radar.market_reader.v1', reader_ref: 'local', revision: 1, policy_revision: 'sha256:policy' }
        : { spec: 'radar.market_signal.v1', signal_ref: 'signal-1', revision, title: 'Old judgment', market: 'unknown',
          observed_at: '2026-09-11T08:00:00Z', claim_kind: 'newly_observed', lifecycle: 'active', source_ref: 'hongguo',
          origin: 'fixture', assertion_level: 'observed', comparison: null, evidence_refs: ['evidence-1'], limitations: [] }
    return { contents: [{ uri, text: JSON.stringify(data) }] }
  } }
  expect(await readConnectedMarketSignal(connection, { signalRef: 'signal-1', revision: 1 })).toMatchObject({ ok: true, signal: { revision: 1 } })
  expect(paths).toContain('radar://market/signals/signal-1/revisions/1')
  revision = 2
  expect(await readConnectedMarketSignal(connection, { signalRef: 'signal-1', revision: 1 })).toMatchObject({ ok: false, reason: 'contract_mismatch' })
})

test.each(['signal_not_found', 'evidence_not_found'])('missing %s is not treated as a disconnected owner', async code => {
  const connection: ConnectedMarketTransport = { async readResource() { throw { data: { code } } } }
  const result = await readConnectedMarketSignal(connection, { signalRef: 'signal-missing', revision: 7 })
  expect(result).toMatchObject({ ok: false, reason: 'reference_unavailable' })
  if (!result.ok) expect(result.recovery).toContain('without substituting the latest revision')
})
