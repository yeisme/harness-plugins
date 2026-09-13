#!/usr/bin/env node
// Evidence wrapper around the existing Vitest consumer tests; never enables model execution.
import { mkdir, writeFile } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { homedir } from 'node:os'
const root = resolve(import.meta.dirname, '..')
const started = new Date()
const runId = `project-ops-${started.toISOString().replace(/[:.]/g, '-')}-${process.pid}`
const directory = resolve(root, 'temp/integration-test-runs', runId)
await mkdir(resolve(directory, 'artifacts'), { recursive: true })
const ownerRoot = resolve(root, '../ordo')
const build = spawnSync('bun', ['run', 'build'], { cwd: ownerRoot, encoding: 'utf8', timeout: 60_000 })
const args = ['--filter', '@yeisme/dsh-ordo-agent-ops', 'exec', 'vitest', 'run', 'tests/project-owner-integration.spec.ts']
const child = spawn('pnpm', args, { cwd: root, env: { ...process.env, DSH_PROJECT_OPS_INTEGRATION_RUN: directory }, stdio: ['ignore', 'pipe', 'pipe'] })
let stdout = build.stdout ?? ''; let stderr = build.stderr ?? ''
child.stdout.on('data', value => { stdout += value })
child.stderr.on('data', value => { stderr += value })
const testCode = await new Promise(resolveExit => { child.on('error', () => resolveExit(127)); child.on('close', value => resolveExit(value ?? 1)) })
const code = build.status === 0 ? testCode : build.status ?? 1
const redact = value => String(value).replaceAll(root, '[PROJECT_ROOT]').replaceAll(ownerRoot, '[ORDO_ROOT]').replaceAll(homedir(), '[USER_HOME]').replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/(authorization|cookie|token|password|secret)\s*[:=]\s*\S+/gi, '$1=[REDACTED]')
for (const [file, body] of Object.entries({
  'summary.json': JSON.stringify({ run_id: runId, status: code === 0 ? 'passed' : 'failed', exit_code: code, started_at: started.toISOString(), finished_at: new Date().toISOString(), real_model_execution: false, scenario: 'two-project-cli-consumer', redacted: true }, null, 2),
  'command.txt': 'node scripts/run-project-ops-integration.mjs\n',
  'stdout.log': redact(stdout), 'stderr.log': redact(stderr),
  'env.json': JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, redacted: true }, null, 2),
})) await writeFile(resolve(directory, file), body)
process.stdout.write(`Project operations integration ${code === 0 ? 'passed' : 'failed'}: temp/integration-test-runs/${runId}\n`)
process.exitCode = code
