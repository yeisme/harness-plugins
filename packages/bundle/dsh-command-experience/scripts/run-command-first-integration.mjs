#!/usr/bin/env node

/**
 * Fake official-seam integration runner for command-first Web/TUI.
 *
 * Spawns the shipped Vitest suites that drive directory → draft/update →
 * dispatch → command/run|done → receipt/Activity. Does not boot official
 * `dsh web`.
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(packageRoot, '../../..')
const startedAt = new Date()
const runId = `${startedAt.toISOString().replace(/[:.]/gu, '-')}-${process.pid}-command-first`
const evidenceRoot = resolve(projectRoot, 'temp/integration-test-runs', runId)
const artifactsRoot = resolve(evidenceRoot, 'artifacts')
const publicCommand = 'pnpm --filter @yeisme/dsh-command-experience test:integration'

const suites = [
  { id: 'core-directory-draft', package: '@yeisme/dsh-client-ui-command-experience-core', files: ['tests/presentation.test.ts', 'tests/draft.test.ts', 'tests/p0-catalog.test.ts'] },
  { id: 'web-shell-first-support', package: '@yeisme/dsh-client-ui-command-experience-web', files: ['tests/shell.spec.ts', 'tests/first-support.spec.ts'] },
  { id: 'tui-update-render', package: '@yeisme/dsh-client-ui-command-experience-tui', files: ['tests/shell.spec.ts'] },
  { id: 'session-status-host', package: '@yeisme/dsh-session-status-host', files: ['tests/schema.spec.ts', 'tests/projection.spec.ts'] },
  { id: 'session-status-client', package: '@yeisme/dsh-client-ui-session-status', files: ['tests/wire.spec.ts', 'tests/view-model.spec.ts'] },
  { id: 'entry-convergence', package: '@yeisme/dsh-client-ui-command-experience-core', files: ['tests/entry-convergence.test.ts'] },
]

function redact(text) {
  return String(text)
    .replaceAll(projectRoot, '<repo-root>')
    .replace(/(?:Bearer\s+)\S+/gu, 'Bearer <redacted>')
    .replace(/(?:ghp_|github_pat_)\S+/gu, '<token>')
    .replace(/(api[_-]?key|authorization|sk-[a-z0-9]+)/giu, '<redacted>')
}

mkdirSync(artifactsRoot, { recursive: true })

const results = suites.map(suite => {
  const args = ['--filter', suite.package, 'exec', 'vitest', 'run', ...suite.files]
  const result = spawnSync('pnpm', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 4 * 1024 * 1024,
    timeout: 300_000,
  })
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
writeFileSync(resolve(evidenceRoot, 'env.json'), `${JSON.stringify({
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  ci: process.env.CI === 'true',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
}, null, 2)}\n`)
writeFileSync(resolve(artifactsRoot, 'integration-matrix.json'), `${JSON.stringify({
  schema: 'dsh.command-first.integration-matrix.v1',
  changes: ['dsh-web-command-first-interaction-v1', 'dsh-tui-command-first-interaction-v1'],
  suites: results.map(({ id, status, exit_code }) => ({ id, status, exit_code })),
  official_dsh_web: false,
  seam: 'fake',
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
  redaction: { enabled: true, policy: 'repo-root, bearer, tokens, credential-shaped keys redacted' },
}, null, 2)}\n`)

console.log(`run_id=${runId}`)
console.log(`evidence=${relative(projectRoot, evidenceRoot)}`)
console.log(`status=${failed.length === 0 ? 'passed' : 'failed'} (${results.length - failed.length}/${results.length})`)
for (const result of results) console.log(`  ${result.status === 'passed' ? '✓' : '✗'} ${result.id} (${result.exit_code})`)
process.exit(failed.length === 0 ? 0 : 1)
