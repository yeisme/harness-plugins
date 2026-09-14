#!/usr/bin/env node
/**
 * SYNTHETIC fixture only — this is NOT the real Radar owner.
 *
 * A minimal MCP stdio server used by market-adapter.spec.ts and the
 * integration evidence runner to exercise the fixed-argv host path
 * (`radar mcp --transport stdio`) end to end with a REAL spawned process.
 * It speaks just enough newline-delimited JSON-RPC for the host transport:
 * initialize → notifications/initialized → resources/read of the bounded
 * radar://market/* set. All payloads are synthetic fixtures.
 *
 * Deterministic mid-read drop: when MARKET_STATE_FILE is set, the FIRST
 * briefs/latest read exits the process without answering (simulating an
 * owner disconnect); the state file records that the drop already happened,
 * so the follow-up read (fresh process) serves the brief normally.
 */
import { writeFileSync } from 'node:fs'

const argv = process.argv.slice(2)
if (JSON.stringify(argv) !== JSON.stringify(['mcp', '--transport', 'stdio'])) {
  process.stderr.write('synthetic fixture expects the frozen RADAR_FIXED_ARGV\n')
  process.exit(2)
}

const reader = { spec: 'radar.market_reader.v1', reader_ref: 'local', revision: 1, policy_revision: 'sha256:policy' }
const signal = {
  spec: 'radar.market_signal.v1', signal_ref: 'signal-fixture-1', revision: 2,
  claim_kind: 'metric_changed', assertion_level: 'corroborated', lifecycle: 'active',
  source_ref: 'hongguo', market: 'CN', title: 'Synthetic fixture signal',
  topics: [], observed_at: '2026-09-13T08:00:00.000Z', observation_refs: [],
  evidence_refs: ['evidence-fixture-1'], comparison: null, limitations: [], origin: 'fixture',
}
const brief = {
  spec: 'radar.market_brief.v1', brief_ref: 'brief-fixture-1', digest: 'sha256:brief-fixture',
  supersedes: null, generated_at: '2026-09-13T09:00:00.000Z', timezone: 'UTC',
  window: { start: '2026-09-12T00:00:00.000Z', end: '2026-09-13T00:00:00.000Z' },
  status: 'ready', order_version: 'market-signal-order.v1', policy_revision: 'sha256:policy',
  main: [signal], watching: [], correction_count: 0, correction_refs: [], visible_signal_refs: [],
  remaining: 0, filtered: false, limitations: ['Synthetic fixture'],
  coverage: { spec: 'radar.market_source_gaps.v1', sources: [] },
}
const evidence = {
  evidence_ref: 'evidence-fixture-1', source_ref: 'hongguo',
  observed_at: '2026-09-13T08:00:00.000Z', summary: 'Synthetic catalog observation sample',
  origin: 'fixture', limitations: ['Synthetic fixture only.'],
}

function resource(uri) {
  if (uri === 'radar://market/capabilities') {
    return { spec: 'radar.market_capabilities.v1', views: ['market_brief', 'market_reader', 'market_signal', 'market_evidence'], lane: 'reader' }
  }
  if (uri === 'radar://market/reader') return reader
  if (uri === 'radar://market/briefs/latest') {
    // Deterministic one-shot disconnect for the recovery journey.
    if (process.env.MARKET_STATE_FILE) {
      try { writeFileSync(process.env.MARKET_STATE_FILE, 'dropped', { flag: 'wx' }); process.exit(3) } catch { /* already dropped once: serve below */ }
    }
    return brief
  }
  const signalMatch = /^radar:\/\/market\/signals\/([^/]+)\/revisions\/(\d+)$/.exec(uri)
  if (signalMatch) {
    if (signalMatch[1] === signal.signal_ref && Number(signalMatch[2]) === signal.revision) return signal
    throw { code: 'signal_not_found' }
  }
  const evidenceMatch = /^radar:\/\/market\/signals\/([^/]+)\/revisions\/(\d+)\/evidence\/([^/]+)$/.exec(uri)
  if (evidenceMatch) {
    if (evidenceMatch[3] === evidence.evidence_ref) return evidence
    throw { code: 'evidence_not_found' }
  }
  throw { code: 'resource_not_found' }
}

let buffer = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', chunk => {
  buffer += chunk
  let index
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim()
    buffer = buffer.slice(index + 1)
    if (!line) continue
    let frame
    try { frame = JSON.parse(line) } catch { continue }
    if (frame.method === 'initialize') {
      respond(frame.id, { protocolVersion: '2025-03-26', capabilities: { resources: {} }, serverInfo: { name: 'synthetic-market-fixture', version: '1' } })
    } else if (frame.method === 'resources/read') {
      try {
        respond(frame.id, { contents: [{ uri: frame.params.uri, mimeType: 'application/json', text: JSON.stringify(resource(frame.params.uri)) }] })
      } catch (error) {
        const code = error && typeof error === 'object' ? error.code : 'market_read_failed'
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: frame.id, error: { code: -32001, message: 'resource error', data: { code } } }) + '\n')
      }
    } // notifications and unknown methods are ignored
  }
})
process.stdin.on('end', () => process.exit(0))

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
}
