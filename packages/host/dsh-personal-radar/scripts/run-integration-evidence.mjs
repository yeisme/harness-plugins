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
import { spawnSync } from 'node:child_process'
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
  real_radar_server: 'unavailable in this environment; acceptance uses radar.mcp.handoff.v1 fixtures via the fake provider',
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
