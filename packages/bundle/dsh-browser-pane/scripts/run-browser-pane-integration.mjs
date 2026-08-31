#!/usr/bin/env node

/**
 * browser-pane 4.1-4.4 integration runner: real bundle, fake provider,
 * fake viewport transport, full flows and failure paths, with the standard
 * redacted six-file evidence set.
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(packageRoot, '../../..')
const startedAt = new Date()
const runId = `${startedAt.toISOString().replace(/[:.]/gu, '-')}-${process.pid}-browser-pane`
const evidenceRoot = resolve(projectRoot, 'temp/integration-test-runs', runId)
const artifactsRoot = resolve(evidenceRoot, 'artifacts')
const publicCommand = 'pnpm --filter @yeisme/dsh-browser-pane run test:integration'

const suites = [
  { id: 'contracts-and-validators', package: '@yeisme/dsh-browser-host', files: ['tests/validation.spec.ts'] },
  { id: 'fake-provider-flows', package: '@yeisme/dsh-browser-host', files: ['tests/fake-provider.spec.ts'] },
  { id: 'client-reducer-and-gating', package: '@yeisme/dsh-client-ui-browser-pane', files: ['tests/reducer.spec.ts', 'tests/phases.spec.ts'] },
  { id: 'viewport-control-navigation-actions', package: '@yeisme/dsh-client-ui-browser-pane', files: ['tests/viewport-transport.spec.ts', 'tests/control-lease.spec.ts', 'tests/navigation.spec.ts', 'tests/actions.spec.ts', 'tests/teardown.spec.ts'] },
  { id: 'registration-and-bundle', package: '@yeisme/dsh-browser-pane', files: ['tests/registration.spec.ts', 'tests/bundle.spec.ts'] },
]

function redact(text) {
  return text
    .replaceAll(projectRoot, '<repo-root>')
    .replace(/(?:Bearer\s+)\S+/gu, 'Bearer <redacted>')
    .replace(/(?:ghp_|github_pat_)\S+/gu, '<token>')
}

mkdirSync(artifactsRoot, { recursive: true })

const results = suites.map(suite => {
  const args = ['--filter', suite.package, 'exec', 'vitest', 'run', ...suite.files]
  const result = spawnSync('pnpm', args, { cwd: projectRoot, encoding: 'utf8', env: process.env, maxBuffer: 4 * 1024 * 1024, timeout: 300_000 })
  const exitCode = result.status ?? 1
  return {
    id: suite.id,
    package: suite.package,
    files: suite.files,
    command: `pnpm ${args.join(' ')}`,
    status: exitCode === 0 ? 'passed' : 'failed',
    exit_code: exitCode,
    stdout: redact(result.stdout ?? ''),
    stderr: redact(result.stderr ?? result.error?.message ?? ''),
  }
})

const failed = results.filter(result => result.exit_code !== 0)
const finishedAt = new Date()

writeFileSync(resolve(evidenceRoot, 'command.txt'), `${publicCommand}\n${results.map(result => result.command).join('\n')}\n`)
writeFileSync(resolve(evidenceRoot, 'stdout.log'), results.map(result => `## ${result.id} (${result.status})\n${result.stdout}`).join('\n'))
writeFileSync(resolve(evidenceRoot, 'stderr.log'), results.map(result => result.stderr.length === 0 ? '' : `## ${result.id}\n${result.stderr}`).filter(Boolean).join('\n'))
writeFileSync(resolve(evidenceRoot, 'env.json'), `${JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, ci: process.env.CI === 'true', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }, null, 2)}\n`)
writeFileSync(resolve(artifactsRoot, 'integration-matrix.json'), `${JSON.stringify({
  schema: 'dsh.browser-pane.integration-matrix.v1',
  change: 'dsh-browser-pane-v1',
  task: '4.1-4.4',
  suites: results.map(({ id, status, exit_code }) => ({ id, status, exit_code })),
  provider: 'fake',
  viewport_transport: 'fake',
  real_browser_runtime: 'deferred_to_owner_openspec',
}, null, 2)}\n`)
writeFileSync(resolve(evidenceRoot, 'summary.json'), `${JSON.stringify({
  schema_version: 'yeisme.integration_test_evidence.v1',
  project: 'agent/harness-plugins',
  run_id: runId,
  layer: 'integration',
  command: publicCommand,
  status: failed.length === 0 ? 'passed' : 'failed',
  exit_code: failed.length === 0 ? 0 : 1,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  checks: results.map(({ id, status, exit_code }) => ({ id, status, exit_code })),
  redaction: { enabled: true, policy: 'repo-root, bearer, and github tokens redacted; failure exit codes preserved' },
}, null, 2)}\n`)

console.log(`run_id=${runId}`)
console.log(`evidence=${relative(projectRoot, evidenceRoot)}`)
console.log(`status=${failed.length === 0 ? 'passed' : 'failed'} (${results.length - failed.length}/${results.length})`)
for (const result of results) console.log(`  ${result.status === 'passed' ? '✓' : '✗'} ${result.id} (${result.exit_code})`)
process.exit(failed.length === 0 ? 0 : 1)
