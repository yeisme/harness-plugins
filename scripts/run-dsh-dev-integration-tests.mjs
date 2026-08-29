#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, relative, resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const startedAt = new Date()
const runId = `${startedAt.toISOString().replaceAll(':', '-').replaceAll('.', '-')}-${process.pid}`
const evidenceDir = join(projectRoot, 'temp', 'integration-test-runs', runId)
const artifactsDir = join(evidenceDir, 'artifacts')
mkdirSync(artifactsDir, { recursive: true })

const commands = [
  ['node', ['--test', 'scripts/dsh-dev.spec.mjs']],
  ['node', ['scripts/dsh-dev.mjs', '--check']],
]

function commandText(command, args) {
  return [command, ...args].join(' ')
}

function redact(value) {
  return value
    .replaceAll(projectRoot, '[PROJECT_ROOT]')
    .replaceAll(homedir(), '[USER_HOME]')
    .replace(/(authorization|token|password|cookie)=\S+/gi, '$1=[REDACTED]')
}

let stdout = ''
let stderr = ''
let exitCode = 0
for (const [command, args] of commands) {
  const label = `$ ${commandText(command, args)}\n`
  stdout += label
  const result = spawnSync(command, args, { cwd: projectRoot, encoding: 'utf8', env: process.env })
  stdout += result.stdout ?? ''
  stderr += result.stderr ?? ''
  if ((result.status ?? 1) !== 0) {
    exitCode = result.status ?? 1
    break
  }
}

const finishedAt = new Date()
const rel = path => relative(projectRoot, path).split('\\').join('/')
const command = commands.map(([bin, args]) => commandText(bin, args)).join('\n')
const summary = {
  schema_version: 'yeisme.integration_test_evidence.v1',
  project: 'agent/harness-plugins',
  run_id: runId,
  layer: 'integration',
  command,
  status: exitCode === 0 ? 'passed' : 'failed',
  exit_code: exitCode,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  evidence: {
    command: rel(join(evidenceDir, 'command.txt')),
    stdout: rel(join(evidenceDir, 'stdout.log')),
    stderr: rel(join(evidenceDir, 'stderr.log')),
    env: rel(join(evidenceDir, 'env.json')),
    artifacts: rel(artifactsDir),
  },
  redaction: { enabled: true, policy: 'yeisme.integration-test-redaction.v1' },
}

writeFileSync(join(evidenceDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
writeFileSync(join(evidenceDir, 'command.txt'), `${command}\n`)
writeFileSync(join(evidenceDir, 'stdout.log'), redact(stdout))
writeFileSync(join(evidenceDir, 'stderr.log'), redact(stderr))
writeFileSync(join(evidenceDir, 'env.json'), `${JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, ci: process.env.CI === 'true', timezone: 'UTC' }, null, 2)}\n`)
writeFileSync(join(artifactsDir, 'contract.txt'), 'discover -> validate -> build graph -> profile sync -> HMR/restart\n')

process.stdout.write(`integration evidence: ${rel(evidenceDir)}\n`)
process.stdout.write(redact(stdout))
process.stderr.write(redact(stderr))
process.exitCode = exitCode
