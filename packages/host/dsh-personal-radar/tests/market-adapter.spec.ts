import { expect, test } from 'vitest'
import { readConnectedMarketBrief, readConnectedMarketCatchup, readConnectedMarketEvidence, type ConnectedMarketTransport } from '../src/market-adapter.js'
import { readConnectedMarketSignal } from '../src/market-adapter.js'
import { createDualPathMarketTransport, RADAR_FIXED_ARGV, type MarketProcessFactory } from '../src/adapter.js'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const fixtureServer = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'market-stdio-server.mjs')

/**
 * Factory that spawns the SYNTHETIC stdio MCP fixture (real node process) the
 * way the host spawns the Radar CLI: executable + the frozen RADAR_FIXED_ARGV.
 * The fixture itself validates that argv, proving the descriptor contract.
 */
const syntheticSpawn: MarketProcessFactory = ({ argv }) => {
  const { spawn } = process.getBuiltinModule('node:child_process') as typeof import('node:child_process')
  const child = spawn(process.execPath, [fixtureServer, ...argv], { stdio: ['pipe', 'pipe', 'pipe'] })
  const lineListeners = new Set<(line: string) => void>()
  const exitListeners = new Set<(failure: unknown) => void>()
  let buffer = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk
    let index: number
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (line) for (const listener of [...lineListeners]) listener(line)
    }
  })
  const notifyExit = (failure: unknown) => { for (const listener of [...exitListeners]) listener(failure) }
  child.on('error', notifyExit)
  child.on('close', () => notifyExit(new Error('fixture closed')))
  return {
    write: frame => child.stdin.write(frame + '\n'),
    onLine(listener) { lineListeners.add(listener); return () => { lineListeners.delete(listener) } },
    onExit(listener) { exitListeners.add(listener); return () => { exitListeners.delete(listener) } },
    kill: () => child.kill(),
  }
}

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

test('evidence reads stay bound to the exact signal revision and never substitute another item', async () => {
  const paths: string[] = []
  const connection: ConnectedMarketTransport = { async readResource({ uri }) {
    paths.push(uri)
    const data = uri.endsWith('capabilities') ? { spec: 'radar.market_capabilities.v1', views: ['market_reader', 'market_evidence'] }
      : uri.endsWith('/reader') ? { spec: 'radar.market_reader.v1', reader_ref: 'local', revision: 1, policy_revision: 'sha256:policy' }
        : { evidence_ref: 'evidence-1', source_ref: 'hongguo', observed_at: '2026-09-11T08:00:00Z', summary: 'Catalog sample', origin: 'fixture', limitations: [] }
    return { contents: [{ uri, text: JSON.stringify(data) }] }
  } }
  const result = await readConnectedMarketEvidence(connection, { signalRef: 'signal-1', revision: 3 }, 'evidence-1')
  expect(result).toMatchObject({ ok: true, evidence: { evidenceRef: 'evidence-1', policyRevision: 'sha256:policy' } })
  // The evidence resource path is revision-bound; there is no latest fallback.
  expect(paths).toContain('radar://market/signals/signal-1/revisions/3/evidence/evidence-1')
  // A substituted payload under the requested reference is a mismatch.
  expect(await readConnectedMarketEvidence(connection, { signalRef: 'signal-1', revision: 3 }, 'evidence-2')).toMatchObject({ reason: 'contract_mismatch' })
  const missing: ConnectedMarketTransport = { async readResource() { throw { data: { code: 'evidence_not_found' } } } }
  expect(await readConnectedMarketEvidence(missing, { signalRef: 'signal-1', revision: 3 }, 'evidence-9')).toMatchObject({ reason: 'reference_unavailable' })
  await expect(readConnectedMarketEvidence(connection, { signalRef: 'signal-1', revision: 3 }, '../unsafe')).rejects.toThrow('market_selection_invalid')
})

test('no local CLI: the connected MCP path reads the brief with zero process spawns', async () => {
  let spawns = 0
  const countingSpawn: MarketProcessFactory = descriptor => { spawns++; return syntheticSpawn(descriptor) }
  const connected: ConnectedMarketTransport = { async readResource({ uri }) {
    const data = uri.endsWith('capabilities') ? { spec: 'radar.market_capabilities.v1', views: ['market_brief', 'market_reader'] }
      : uri.endsWith('/reader') ? { spec: 'radar.market_reader.v1', reader_ref: 'local', revision: 1, policy_revision: 'sha256:policy' }
        : { spec: 'radar.market_brief.v1', brief_ref: 'brief-1', digest: 'sha256:brief', policy_revision: 'sha256:policy',
          generated_at: '2026-09-13T09:00:00.000Z', timezone: 'UTC', window: { start: '2026-09-12T00:00:00Z', end: '2026-09-13T00:00:00Z' },
          status: 'empty', main: [], watching: [], remaining: 0, filtered: false, correction_count: 0, limitations: [],
          coverage: { spec: 'radar.market_source_gaps.v1', sources: [] } }
    return { contents: [{ uri, text: JSON.stringify(data) }] }
  } }
  const dual = createDualPathMarketTransport({ connected: () => connected, fixedArgv: { binary: 'radar', spawnProcess: countingSpawn } })
  const result = await readConnectedMarketBrief(dual)
  expect(result).toMatchObject({ ok: true, brief: { briefRef: 'brief-1' } })
  // The connected seam answers everything; the fixed-argv fallback never ran.
  expect(spawns).toBe(0)
  dual.dispose()
})

test('owner-side recovery: the fixed-argv path spawns a synthetic stdio server, survives a mid-read drop and re-establishes', async () => {
  const stateDir = await mkdtemp(join(tmpdir(), 'dsh-market-dual-'))
  const stateFile = join(stateDir, 'dropped-once')
  process.env.MARKET_STATE_FILE = stateFile
  try {
    const dual = createDualPathMarketTransport({ connected: () => null, fixedArgv: { binary: 'radar', spawnProcess: syntheticSpawn } })
    // First journey: the synthetic owner dies mid-read; only the shared named
    // offline code comes back, never the process error text.
    const dropped = await readConnectedMarketBrief(dual)
    expect(dropped).toMatchObject({ ok: false, reason: 'offline' })
    expect(JSON.stringify(dropped)).not.toMatch(/exit|ECONN|fixture|private/i)
    // Follow-up read re-establishes a fresh process and reads the brief.
    const recovered = await readConnectedMarketBrief(dual)
    expect(recovered).toMatchObject({ ok: true, brief: { briefRef: 'brief-fixture-1', status: 'ready' }, reader: { revision: 1 } })
    if (recovered.ok) expect(recovered.brief.main[0].claimKind).toBe('metric_changed')
    // The same rebuilt connection also serves revision-bound signal/evidence reads.
    const signal = await readConnectedMarketSignal(dual, { signalRef: 'signal-fixture-1', revision: 2 })
    expect(signal).toMatchObject({ ok: true, signal: { assertionLevel: 'corroborated' } })
    const evidence = await readConnectedMarketEvidence(dual, { signalRef: 'signal-fixture-1', revision: 2 }, 'evidence-fixture-1')
    expect(evidence).toMatchObject({ ok: true, evidence: { evidenceRef: 'evidence-fixture-1' } })
    const missing = await readConnectedMarketEvidence(dual, { signalRef: 'signal-fixture-1', revision: 2 }, 'evidence-missing')
    expect(missing).toMatchObject({ ok: false, reason: 'reference_unavailable' })
    dual.dispose()
  } finally {
    delete process.env.MARKET_STATE_FILE
    await rm(stateDir, { recursive: true, force: true })
  }
}, 15000)
