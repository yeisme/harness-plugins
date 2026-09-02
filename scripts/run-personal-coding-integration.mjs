#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, relative, resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const workspaceRoot = resolve(projectRoot, '../..')
const startedAt = new Date()
const runId = `${startedAt.toISOString().replaceAll(':', '-').replaceAll('.', '-')}-${process.pid}`
const evidenceDir = join(projectRoot, 'temp', 'integration-test-runs', runId)
const artifactsDir = join(evidenceDir, 'artifacts')
mkdirSync(artifactsDir, { recursive: true })

const commands = [
  ['pnpm', ['--filter', '@yeisme/dsh-plugin-contracts', 'test']],
  ['pnpm', ['--filter', '@yeisme/dsh-plugin-catalog', 'test']],
  ['pnpm', ['--filter', '@yeisme/dsh-plugin-toolchain', 'test']],
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-command-experience-core', 'test']],
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-command-experience-web', 'test']],
  ['node', ['scripts/check-plugins.mjs', '--only=personal-coding-contract', '--no-report']],
  ['bun', [join(workspaceRoot, 'scripts/verify-dsh-personal-coding-contracts.ts')]],
]

const display = ([bin, args]) => [bin, ...args].join(' ')
const redact = value => value
  .replaceAll(projectRoot, '[PROJECT_ROOT]')
  .replaceAll(workspaceRoot, '[WORKSPACE_ROOT]')
  .replaceAll(homedir(), '[USER_HOME]')
  .replace(/(authorization|token|password|cookie|secret)\s*[:=]\s*\S+/gi, '$1=[REDACTED]')

let stdout = ''
let stderr = ''
let exitCode = 0
for (const command of commands) {
  stdout += `$ ${display(command)}\n`
  const result = spawnSync(command[0], command[1], { cwd: projectRoot, encoding: 'utf8', env: process.env, maxBuffer: 16 * 1024 * 1024 })
  stdout += result.stdout ?? ''
  stderr += result.stderr ?? ''
  if ((result.status ?? 1) !== 0) { exitCode = result.status ?? 1; break }
}

const finishedAt = new Date()
const rel = path => relative(projectRoot, path).split('\\').join('/')
const commandText = commands.map(display).join('\n')
const summary = {
  schema_version: 'yeisme.integration_test_evidence.v1',
  project: 'agent/harness-plugins',
  run_id: runId,
  layer: 'integration',
  command: redact(commandText),
  status: exitCode === 0 ? 'passed' : 'failed',
  exit_code: exitCode,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  evidence: { command: rel(join(evidenceDir, 'command.txt')), stdout: rel(join(evidenceDir, 'stdout.log')), stderr: rel(join(evidenceDir, 'stderr.log')), env: rel(join(evidenceDir, 'env.json')), artifacts: `${rel(artifactsDir)}/` },
  redaction: { enabled: true, policy: 'yeisme.integration-test-redaction.v1' },
}

writeFileSync(join(evidenceDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
writeFileSync(join(evidenceDir, 'command.txt'), `${redact(commandText)}\n`)
writeFileSync(join(evidenceDir, 'stdout.log'), redact(stdout))
writeFileSync(join(evidenceDir, 'stderr.log'), redact(stderr))
writeFileSync(join(evidenceDir, 'env.json'), `${JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, ci: process.env.CI === 'true', timezone: 'UTC' }, null, 2)}\n`)
writeFileSync(join(artifactsDir, 'contract.txt'), 'base pack -> plugin V1 -> Web/TUI semantic parity -> Ordo preview-CAS\n')

process.stdout.write(`personal coding integration evidence: ${rel(evidenceDir)}\n`)
process.stdout.write(redact(stdout))
process.stderr.write(redact(stderr))
process.exitCode = exitCode
