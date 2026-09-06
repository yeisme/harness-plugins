#!/usr/bin/env node
/**
 * Evidence for dsh-selection-conversation-actions-v1 task 5.3.
 * Two lanes are recorded separately:
 *   plugin-contract  — owned package typecheck/test (and optional Playwright S1–S9)
 *   real-host        — official DSH / live profile interaction; never inferred from fixtures
 * Unverified lanes stay `not_verified` and are not counted as passed.
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { relative, resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const startedAt = new Date()
const runId = `selection-conversation-actions-${startedAt.toISOString().replace(/[:.]/gu, '-')}-${process.pid}`
const runRoot = resolve(projectRoot, 'temp/integration-test-runs', runId)
const artifacts = resolve(runRoot, 'artifacts')
const includeBrowser = process.argv.includes('--browser')
const includeHost = process.argv.includes('--host')
const publicCommand = [
  'node scripts/run-selection-conversation-actions-evidence.mjs',
  ...(includeBrowser ? ['--browser'] : []),
  ...(includeHost ? ['--host'] : []),
].join(' ')

const pluginCommands = [
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-visual-kit', 'run', 'typecheck']],
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-visual-kit', 'run', 'test']],
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-interaction-space', 'run', 'typecheck']],
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-interaction-space', 'run', 'test']],
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-selection-annotation', 'run', 'typecheck']],
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-selection-annotation', 'run', 'test']],
  ['openspec', ['validate', 'dsh-selection-conversation-actions-v1', '--strict', '--no-interactive']],
]
if (includeBrowser) {
  pluginCommands.push(['pnpm', ['exec', 'playwright', 'test', '--config', 'tests/ui-visual/playwright.config.ts', 'tests/ui-visual/visual-selection-actions.spec.ts', '--update-snapshots=none']])
}

function redact(value) {
  return String(value)
    .replaceAll(projectRoot, '[PROJECT_ROOT]')
    .replaceAll(homedir(), '[USER_HOME]')
    .replace(/(authorization|cookie|token|password|secret)\s*[:=]\s*[^\s]+/giu, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gu, 'Bearer [REDACTED]')
    .replace(/([?&](?:token|key|signature)=)[^\s&"']+/gi, '$1[REDACTED]')
}

function run(binary, args) {
  return new Promise(accept => {
    const child = spawn(binary, args, {
      cwd: projectRoot,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.once('error', error => { stderr += error.message; accept({ code: 1, stdout, stderr }) })
    child.once('close', code => accept({ code: code ?? 1, stdout, stderr }))
  })
}

await mkdir(artifacts, { recursive: true })
await writeFile(resolve(runRoot, 'command.txt'), `${publicCommand}\n`, 'utf8')
await writeFile(resolve(runRoot, 'env.json'), `${JSON.stringify({
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  ci: process.env.CI === 'true',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  include_browser: includeBrowser,
  include_host: includeHost,
  redacted: true,
}, null, 2)}\n`, 'utf8')

let stdout = ''
let stderr = ''
let exitCode = 0
const pluginSteps = []
for (const [binary, args] of pluginCommands) {
  const result = await run(binary, args)
  const command = `${binary} ${args.join(' ')}`
  stdout += `$ ${command}\n${result.stdout}`
  stderr += result.stderr
  pluginSteps.push({ command, exit_code: result.code, status: result.code === 0 ? 'passed' : 'failed' })
  if (result.code !== 0) exitCode = result.code
}

const hostLane = {
  status: 'not_verified',
  reason: 'Official DSH web / live profile selection overlay was not exercised in this run. Fixture Playwright and package tests are plugin-contract only.',
  related_not_counted: [
    'node scripts/run-composer-reference-host-tests.mjs — composer reference draft/send belongs to dsh-web-composer-references-theme-v1 and does not prove this overlay on a live host',
    'http://127.0.0.1:61818/ — existing local web listener returned HTTP 401; not treated as a selection-overlay host',
  ],
}
if (includeHost) {
  const probe = await run('curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code}', 'http://127.0.0.1:61818/'])
  stdout += `$ curl -sS -o /dev/null -w %{http_code} http://127.0.0.1:61818/\n${probe.stdout}\n`
  stderr += probe.stderr
  const httpCode = probe.stdout.trim()
  hostLane.probe = { command: 'curl -sS -o /dev/null -w %{http_code} http://127.0.0.1:61818/', http_code: httpCode, exit_code: probe.code }
  hostLane.status = 'not_verified'
  hostLane.reason = `Local listener at 127.0.0.1:61818 returned HTTP ${httpCode || 'unavailable'}; selection overlay, pin/drag, and draft insert were not exercised on a real host.`
}

await writeFile(resolve(artifacts, 'lanes.json'), `${JSON.stringify({
  plugin_contract: {
    status: pluginSteps.every(step => step.status === 'passed') ? 'passed' : 'failed',
    coverage: includeBrowser
      ? 'package typecheck/test + OpenSpec + Playwright S1–S9 fixture (synthetic draft/target bridge)'
      : 'package typecheck/test + OpenSpec; Playwright S1–S9 recorded separately when --browser is passed',
    steps: pluginSteps,
  },
  real_host: hostLane,
}, null, 2)}\n`, 'utf8')

const finishedAt = new Date()
stdout = redact(stdout)
stderr = redact(stderr)
await writeFile(resolve(runRoot, 'stdout.log'), stdout, 'utf8')
await writeFile(resolve(runRoot, 'stderr.log'), stderr, 'utf8')
const summary = {
  schema_version: 'yeisme.integration_test_evidence.v1',
  project: 'agent/harness-plugins',
  run_id: runId,
  layer: 'component',
  command: publicCommand,
  status: exitCode === 0 ? 'passed' : 'failed',
  exit_code: exitCode,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  evidence: {
    stdout: 'stdout.log',
    stderr: 'stderr.log',
    command: 'command.txt',
    env: 'env.json',
    artifacts: 'artifacts/',
  },
  redaction: { enabled: true, policy: 'yeisme-default' },
  change: 'dsh-selection-conversation-actions-v1',
  lanes: {
    plugin_contract: pluginSteps.every(step => step.status === 'passed') ? 'passed' : 'failed',
    real_host: hostLane.status,
  },
  counted_as_passed: pluginSteps.every(step => step.status === 'passed') ? ['plugin_contract'] : [],
  not_counted: hostLane.status === 'passed' ? [] : ['real_host'],
}
await writeFile(resolve(runRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
process.stdout.write(`Selection conversation evidence: ${relative(projectRoot, resolve(runRoot, 'summary.json'))}\n`)
process.stdout.write(`plugin_contract=${summary.lanes.plugin_contract} real_host=${summary.lanes.real_host} exit=${exitCode}\n`)
process.exitCode = exitCode
