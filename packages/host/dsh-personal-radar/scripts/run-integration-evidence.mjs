#!/usr/bin/env node
/**
 * Integration evidence runner for @yeisme/dsh-personal-radar.
 *
 * Runs the package test suite plus a fixture-based intent round trip
 * (probe → parse → intersection → dispatch → unknown → reconcile) against
 * the fake Radar provider, then writes redacted evidence to
 * temp/integration-test-runs/<run-id>/ per the subproject evidence policy.
 * The real Radar server is unavailable in this environment; fixture-based
 * acceptance is declared explicitly in the summary.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(packageRoot, '../../..')
const startedAt = new Date()
const runId = `${startedAt.toISOString().replace(/[:.]/gu, '-')}-${process.pid}-personal-radar-intents`
const evidenceRoot = resolve(projectRoot, 'temp/integration-test-runs', runId)
const artifactsRoot = resolve(evidenceRoot, 'artifacts')
const commandLog = []
const checks = []
let status = 'passed'
let failure
const liveBinary = process.env.RADAR_LIVE_BINARY ?? ''
const liveOpportunityRef = process.env.RADAR_LIVE_OPPORTUNITY_REF ?? ''
const liveEditionRef = process.env.RADAR_LIVE_EDITION_REF ?? ''
const liveProfileRevision = process.env.RADAR_LIVE_PROFILE_REVISION ?? ''
const liveEvidenceRef = process.env.RADAR_LIVE_EVIDENCE_REF ?? ''
const liveEnabled = [liveBinary, liveOpportunityRef, liveEditionRef, liveProfileRevision, liveEvidenceRef].every(Boolean)

await mkdir(artifactsRoot, { recursive: true })

try {
  run('pnpm', ['run', 'build'], packageRoot)
  run('pnpm', ['run', 'test'], packageRoot)
  checks.push({ stage: 'unit_suite', result: 'passed' })

  const radar = await import(pathToFileURL(resolve(packageRoot, 'lib/index.mjs')).href)
  const fake = radar.createFakeRadarProvider({ forcedOutcomes: ['unknown'] })

  const probe = await radar.probeRadarCapability({
    binary: 'radar',
    checkBinary: async () => true,
    handoffSpec: fake.handoffSpec,
    capabilities: fake.capabilitiesOutput,
    paneSlotAvailable: true,
  })
  assert(probe.ready, 'probe must be ready against fixtures')

  const parsed = radar.parseRadarCommand('/drama radar save opp:integration-1')
  assert(parsed.ok, 'save parse failed')
  const dispatch = await radar.dispatchRadarIntent({ binary: 'radar' }, parsed.intent, fake.runner)
  assert(dispatch.ok && dispatch.receipt.outcome === 'unknown', 'forced kill must surface unknown')

  let ledger = radar.recordRadarDispatch({ entries: {}, pendingUnknown: [] }, dispatch.ok ? dispatch.receipt : undefined).ledger
  assert(radar.isRadarReconcilePending(ledger, parsed.intent.idempotencyKey), 'unknown outcome must await reconcile')
  fake.settleUnknown(parsed.intent.idempotencyKey, { outcome: 'submitted', reason: 'owner completed after reconnect', runRef: 'run:integration-1' })
  ledger = await radar.reconcileRadarUnknown(ledger, parsed.intent.idempotencyKey, fake.lookupReceipt)
  assert(ledger.entries[parsed.intent.idempotencyKey]?.receipt.outcome === 'reconciled', 'owner reconcile must settle the unknown outcome')
  assert(radar.shouldAutoReplayRadarIntent() === false, 'auto replay must stay disabled')
  checks.push({ stage: 'kill_reconnect_reconcile', reconciled: true, auto_replay: false })

  const handoff = radar.createRadarWorkbenchHandoff(
    { opportunityRef: 'opp:integration-1', editionRef: 'edition:integration', profileRevision: 'profile-rev:integration-1' },
    { now: () => 1_787_600_000_000, nonce: () => 'nonce-integration-1' },
  )
  assert(radar.validateRadarWorkbenchHandoff(handoff), 'handoff must carry only safe typed refs')
  const evidence = radar.recordRadarEvidence('handoff_issued', { ts: 1_787_600_000_000, refCount: 3, reasonCode: 'ok' })
  assert(radar.isRedactedRadarEvidence(evidence), 'evidence must pass the redaction check')
  checks.push({ stage: 'handoff_evidence_redaction', ok: true })

  // Market mutation leg (dsh-radar-market-intelligence-v1 §1.4): typed intent,
  // double-click dedupe, unknown→receipt reconcile, stale-revision conflict.
  const marketApplies = []
  const marketLookups = []
  const settled = new Map()
  const marketTransport = {
    async apply({ intent }) {
      marketApplies.push(intent.idempotencyKey)
      if (intent.kind === 'watch') throw new Error('ECONNRESET')
      settled.set(intent.idempotencyKey, { schema: radar.MARKET_RECEIPT_SCHEMA, idempotencyKey: intent.idempotencyKey, outcome: 'accepted', reason: 'owner applied', readerRevision: intent.readerRevision + 1 })
      return { status: 'accepted', readerRevision: intent.readerRevision + 1 }
    },
    async lookupReceipt(key) {
      marketLookups.push(key)
      // The owner settles the disconnected watch after reconnect.
      return settled.get(key) ?? { schema: radar.MARKET_RECEIPT_SCHEMA, idempotencyKey: key, outcome: 'accepted', reason: 'owner completed after reconnect', readerRevision: 6 }
    },
  }
  const marketStore = radar.createMarketActionStore(marketTransport)
  const marketIntent = await radar.buildMarketMutationIntent('mark_read', [{ signalRef: 'signal:integration-1', revision: 1 }], 4, 'sha256:policy-integration')
  const firstMarket = await marketStore.dispatch(marketIntent)
  assert(firstMarket.dispatched === true && firstMarket.receipt.outcome === 'accepted', 'market mark_read must dispatch once and be accepted')
  const doubleClick = await marketStore.dispatch({ ...marketIntent })
  assert(doubleClick.dispatched === false && doubleClick.receipt.outcome === 'accepted', 'market double click must dedupe to the existing receipt')
  assert(marketApplies.length === 1, 'market dedupe must not reach the owner twice')
  const killedKey = (await radar.buildMarketMutationIntent('watch', [{ signalRef: 'signal:integration-1', revision: 1 }], 5, 'sha256:policy-integration')).idempotencyKey
  const killed = await marketStore.dispatch(await radar.buildMarketMutationIntent('watch', [{ signalRef: 'signal:integration-1', revision: 1 }], 5, 'sha256:policy-integration'))
  assert(killed.receipt.outcome === 'unknown', 'disconnected market watch must surface unknown')
  const beforeReconcile = marketApplies.length
  const reconciledWatch = await marketStore.reconcile(killedKey)
  assert(reconciledWatch !== null && reconciledWatch.outcome === 'reconciled', 'market unknown must reconcile via receipt lookup')
  assert(marketApplies.length === beforeReconcile, 'market reconcile must never re-dispatch')
  assert(marketLookups.includes(killedKey), 'market reconcile must query the original key')
  const stale = await marketStore.dispatch(await radar.buildMarketMutationIntent('mark_read', [{ signalRef: 'signal:integration-2', revision: 1 }], 4, 'sha256:policy-integration'))
  assert(stale.receipt.outcome === 'conflict' && stale.dispatched === false, 'stale reader revision must conflict without a write')
  checks.push({
    stage: 'market_mutation_reconcile',
    owner_apply_calls: marketApplies.length,
    double_click_deduped: true,
    unknown_reconciled_without_redispatch: true,
    stale_revision_conflict: true,
  })

  // Market dual host path (dsh-radar-market-intelligence-v1 §1.3): the
  // connected MCP seam must answer with ZERO process spawns, and the
  // fixed-argv fallback must survive a mid-read owner drop and re-establish.
  // The argv leg spawns the SYNTHETIC stdio MCP fixture under tests/fixtures
  // (real node process, minimal MCP protocol, synthetic market payloads).
  const fixtureServerPath = resolve(packageRoot, 'tests/fixtures/market-stdio-server.mjs')
  let dualSpawns = 0
  const countingSpawn = descriptor => {
    dualSpawns++
    return spawnSyntheticServer(fixtureServerPath, descriptor.argv)
  }
  const connectedBrief = { spec: 'radar.market_brief.v1', brief_ref: 'brief-dual-1', digest: 'sha256:brief-dual',
    policy_revision: 'sha256:policy', generated_at: '2026-09-14T09:00:00.000Z', timezone: 'UTC',
    window: { start: '2026-09-13T00:00:00.000Z', end: '2026-09-14T00:00:00.000Z' }, status: 'empty',
    main: [], watching: [], remaining: 0, filtered: false, correction_count: 0, limitations: [],
    coverage: { spec: 'radar.market_source_gaps.v1', sources: [] } }
  const connectedTransport = {
    async readResource({ uri }) {
      const data = uri.endsWith('/capabilities') ? { spec: 'radar.market_capabilities.v1', views: ['market_brief', 'market_reader'] }
        : uri.endsWith('/reader') ? { spec: 'radar.market_reader.v1', reader_ref: 'local', revision: 1, policy_revision: 'sha256:policy' }
          : connectedBrief
      return { contents: [{ uri, text: JSON.stringify(data) }] }
    },
  }
  const dualConnected = radar.createDualPathMarketTransport({ connected: () => connectedTransport, fixedArgv: { binary: 'radar', spawnProcess: countingSpawn } })
  const connectedRead = await radar.readConnectedMarketBrief(dualConnected)
  assert(connectedRead.ok && connectedRead.brief.briefRef === 'brief-dual-1', 'connected MCP path must read the market brief')
  assert(dualSpawns === 0, 'connected MCP path must not spawn any process')
  dualConnected.dispose()

  const dualStateFile = resolve(artifactsRoot, 'market-dual-dropped-once')
  process.env.MARKET_STATE_FILE = dualStateFile
  const dualArgv = radar.createDualPathMarketTransport({ connected: () => null, fixedArgv: { binary: 'radar', spawnProcess: descriptor => spawnSyntheticServer(fixtureServerPath, descriptor.argv) } })
  const droppedRead = await radar.readConnectedMarketBrief(dualArgv)
  assert(!droppedRead.ok && droppedRead.reason === 'offline', 'mid-read owner drop must surface the shared offline code')
  assert(!JSON.stringify(droppedRead).match(/exit|ECONN|fixture/i), 'drop recovery must not leak raw process errors')
  const recoveredRead = await radar.readConnectedMarketBrief(dualArgv)
  assert(recoveredRead.ok && recoveredRead.brief.briefRef === 'brief-fixture-1' && recoveredRead.brief.status === 'ready', 'follow-up read must re-establish and return the synthetic brief')
  const recoveredEvidence = await radar.readConnectedMarketEvidence(dualArgv, { signalRef: 'signal-fixture-1', revision: 2 }, 'evidence-fixture-1')
  assert(recoveredEvidence.ok && recoveredEvidence.evidence.evidenceRef === 'evidence-fixture-1', 'rebuilt argv connection must serve revision-bound evidence reads')
  dualArgv.dispose()
  delete process.env.MARKET_STATE_FILE
  checks.push({
    stage: 'market_dual_path',
    connected_path_spawns: 0,
    argv_drop_reason: 'offline',
    argv_recovery_brief: 'brief-fixture-1',
    argv_recovery_evidence: 'evidence-fixture-1',
    synthetic_fixture: 'tests/fixtures/market-stdio-server.mjs',
  })

  if (liveEnabled) {    const liveConfig = { binary: liveBinary }
    const liveIntent = (kind, refs = [], key = `dsh-live-${kind}`) => ({
      schema: radar.RADAR_INTENT_SCHEMA,
      kind,
      opportunityRefs: refs,
      idempotencyKey: key,
      confirmed: kind === 'refresh',
    })
    const open = await radar.dispatchRadarIntent(liveConfig, liveIntent('open', [liveOpportunityRef]), realRadarRunner)
    assert(open.ok && open.receipt.outcome === 'submitted', 'live reader open must be accepted')
    const save = await radar.dispatchRadarIntent(liveConfig, liveIntent('save', [liveOpportunityRef], 'dsh-live-save-02'), realRadarRunner)
    assert(save.ok && save.receipt.outcome === 'submitted' && save.receipt.feedbackRef !== undefined, 'live save must return an owner feedback receipt')
    const refresh = await radar.dispatchRadarIntent(liveConfig, liveIntent('refresh', [], 'dsh-live-refresh-02'), realRadarRunner)
    assert(refresh.ok && refresh.receipt.outcome === 'submitted' && refresh.receipt.editionRef !== undefined, 'live refresh must return an owner edition ref')
    const disconnected = await radar.dispatchRadarIntent(liveConfig, liveIntent('save', [liveOpportunityRef], 'dsh-live-kill-02'), (descriptor) => realRadarRunner(descriptor, 1))
    assert(disconnected.ok && disconnected.receipt.outcome === 'unknown', 'live disconnect must stay unknown without replay')
    assert(radar.shouldAutoReplayRadarIntent() === false, 'live disconnect must not enable auto replay')

    const liveHandoff = radar.createRadarWorkbenchHandoff(
      { opportunityRef: liveOpportunityRef, editionRef: liveEditionRef, profileRevision: liveProfileRevision, evidenceRefs: [liveEvidenceRef] },
      { now: () => 1_788_217_600_000, nonce: () => 'nonce-live-cross-entry-1' },
    )
    assert(radar.validateRadarWorkbenchHandoff(liveHandoff), 'live DSH → Workbench handoff refs must validate')
    assert(liveHandoff.opportunityRef === liveOpportunityRef && liveHandoff.editionRef === liveEditionRef && liveHandoff.profileRevision === liveProfileRevision && liveHandoff.evidenceRefs[0] === liveEvidenceRef, 'live handoff continuity refs drifted')
    checks.push({
      stage: 'real_radar_server',
      open: 'submitted',
      save: 'submitted',
      refresh: 'submitted',
      disconnect: 'unknown',
      auto_replay: false,
      handoff_refs_continuous: true,
    })
  } else {
    checks.push({ stage: 'real_radar_server', result: 'not_requested', required_env_count: 5 })
  }
  await writeJson(resolve(artifactsRoot, 'conformance-checks.json'), checks)
} catch (error) {
  status = 'failed'
  failure = redact(error instanceof Error ? error.message : String(error))
}

const finishedAt = new Date()
const summary = {
  schema_version: 'yeisme.integration_test_evidence.v1',
  project: 'agent/harness-plugins',
  run_id: runId,
  layer: 'integration',
  command: 'pnpm --dir packages/host/dsh-personal-radar run integration:evidence',
  status,
  exit_code: status === 'passed' ? 0 : 1,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  fixture_based: true,
  live_server_checked: liveEnabled,
  real_radar_server: liveEnabled ? 'verified against a disposable local Radar MCP server' : 'not requested; set the five RADAR_LIVE_* variables to enable the real-server leg',
  failure: failure ?? null,
  checks,
  redaction: { enabled: true, policy: 'yeisme.integration-test-redaction.v1' },
  evidence: {
    summary: relative(projectRoot, resolve(evidenceRoot, 'summary.json')),
    command: relative(projectRoot, resolve(evidenceRoot, 'command.txt')),
    stdout: relative(projectRoot, resolve(evidenceRoot, 'stdout.log')),
    stderr: relative(projectRoot, resolve(evidenceRoot, 'stderr.log')),
    env: relative(projectRoot, resolve(evidenceRoot, 'env.json')),
    artifacts: relative(projectRoot, artifactsRoot),
  },
}

await Promise.all([
  writeJson(resolve(evidenceRoot, 'summary.json'), summary),
  writeFile(resolve(evidenceRoot, 'command.txt'), `${commandLog.join('\n')}\n`, 'utf8'),
  writeFile(resolve(evidenceRoot, 'stdout.log'), `${JSON.stringify(checks, null, 2)}\n`, 'utf8'),
  writeFile(resolve(evidenceRoot, 'stderr.log'), failure === undefined ? '' : `${failure}\n`, 'utf8'),
  writeJson(resolve(evidenceRoot, 'env.json'), {
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    ci: process.env.CI === 'true',
  }),
])

process.stdout.write(`Personal Radar integration evidence: ${summary.evidence.summary}\n`)
if (failure !== undefined) process.stderr.write(`${failure}\n`)
process.exitCode = summary.exit_code

function run(command, args, cwd) {
  commandLog.push(`$ ${command} ${args.map(() => '<arg>').join(' ')}`)
  const result = spawnSync(command, args, { cwd, stdio: 'pipe', encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`${command} exited ${String(result.status)}: ${redact(`${result.stdout ?? ''}${result.stderr ?? ''}`.slice(0, 800))}`)
  }
}

function redact(value) {
  return value
    .replace(/\/[^\s'"]+/gu, '<path>')
    .replace(/(token|secret|password|authorization)=?\S+/giu, '<redacted>')
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

/**
 * Spawn the SYNTHETIC stdio MCP fixture as a real node process standing in
 * for the Radar CLI: executable + the frozen RADAR_FIXED_ARGV descriptor.
 * Line/exit plumbing mirrors the production nodeMarketSpawn factory.
 */
function spawnSyntheticServer(fixturePath, argv) {
  const child = spawn(process.execPath, [fixturePath, ...argv], { stdio: ['pipe', 'pipe', 'pipe'] })
  const lineListeners = new Set()
  const exitListeners = new Set()
  let buffer = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', chunk => {
    buffer += chunk
    let index
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (line) for (const listener of [...lineListeners]) listener(line)
    }
  })
  const notifyExit = failure => { for (const listener of [...exitListeners]) listener(failure) }
  child.on('error', notifyExit)
  child.on('close', () => notifyExit(new Error('synthetic server closed')))
  return {
    write: frame => child.stdin.write(frame + '\n'),
    onLine(listener) { lineListeners.add(listener); return () => lineListeners.delete(listener) },
    onExit(listener) { exitListeners.add(listener); return () => exitListeners.delete(listener) },
    kill: () => child.kill(),
  }
}

async function realRadarRunner(descriptor, killAfterMs) {
  return await new Promise((resolvePromise) => {
    const child = spawn(descriptor.binary, descriptor.argv, { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      resolvePromise(result)
    }
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.on('error', (error) => finish({ ok: false, error: redact(error.message) }))
    child.on('close', () => {
      if (killAfterMs !== undefined) {
        finish({ ok: false, error: 'simulated disconnect: owner outcome unknown' })
        return
      }
      const frames = stdout.split('\n').map((line) => line.trim()).filter(Boolean).flatMap((line) => {
        try { return [JSON.parse(line)] } catch { return [] }
      })
      const response = frames.find((frame) => frame.id === 2)
      if (!response || response.error) {
        finish({ ok: false, error: `rpc error: ${response?.error?.message ?? 'no response'}` })
        return
      }
      if (response.result?.isError === true) {
        finish({ ok: false, error: `owner rejected: ${response.result?.content?.[0]?.text ?? 'isError'}` })
        return
      }
      try {
        const payload = JSON.parse(response.result.content[0].text)
        const facts = payload.facts ?? {}
        finish({
          ok: true,
          receipt: {
            outcome: 'submitted',
            reason: payload.summary ?? 'owner accepted',
            ...(facts.run_ref === undefined ? {} : { runRef: facts.run_ref }),
            ...(facts.edition_ref === undefined ? {} : { editionRef: facts.edition_ref }),
            ...(facts.id === undefined ? {} : { feedbackRef: `feedback:${facts.id}` }),
          },
        })
      } catch {
        finish({ ok: false, error: 'owner response was not a valid typed JSON result' })
      }
    })
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'dsh-personal-radar-evidence', version: '1' } } })}\n`)
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`)
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: descriptor.request.tool, arguments: descriptor.request.args } })}\n`)
    if (killAfterMs === undefined) child.stdin.end()
    else setTimeout(() => child.kill(), killAfterMs)
  })
}
