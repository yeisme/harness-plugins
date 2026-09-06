#!/usr/bin/env node
/** Keyless real-host gate; evidence belongs to the plugin change, not a temp checkout. */
import { spawn } from 'node:child_process'
import { copyFile, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const source = resolve(root, 'temp/dsh-unified-host-source')
const allowed = new Set(['reference-composer.e2e.ts', 'reference-composer-multi.e2e.ts', 'composer-draft-scroll.e2e.ts'])
const tests = process.argv.slice(2)
if (!tests.length) tests.push('reference-composer.e2e.ts')
if (tests.some(test => !allowed.has(test))) throw new Error('Only the composer reference host gates are allowed')
await realpath(source)
const started = Date.now()
const runId = `composer-host-${new Date(started).toISOString().replace(/[:.]/g, '-')}-${process.pid}`
const dir = resolve(root, 'temp/integration-test-runs', runId)
await mkdir(resolve(dir, 'artifacts'), { recursive: true })
const command = `node scripts/run-composer-reference-host-tests.mjs ${tests.join(' ')}`
const redact = value => String(value)
  .replace(/([?&](?:token|key|signature)=)[^\s&"']+/gi, '$1[REDACTED]')
  .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
  .replaceAll(root, '[PROJECT_ROOT]').replaceAll(homedir(), '[USER_HOME]')
const exec = (cmd, args) => new Promise(accept => {
  // pnpm 11 otherwise defaults to installing before a run. Verification must
  // retain the shared dependency tree and report drift, never reinstall it.
  const child = spawn(cmd, args, { cwd: source, env: { ...process.env, pnpm_config_verify_deps_before_run: 'warn', DSH_SNAPSHOT: 'replay', DSH_TELEMETRY_DISABLED: '1', DSH_REFERENCE_EVIDENCE_DIR: resolve(dir, 'artifacts') }, stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = '', stderr = ''
  child.stdout.on('data', chunk => { stdout += chunk })
  child.stderr.on('data', chunk => { stderr += chunk })
  child.once('error', error => { stderr += error.message })
  child.once('close', code => accept({ code: code ?? 1, stdout, stderr }))
})
const head = await exec('git', ['rev-parse', 'HEAD'])
const before = await exec('git', ['diff', '--stat'])
const packageManifest = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'))
const result = await exec('pnpm', ['exec', 'vitest', 'run', '--config', 'vitest.web.config.ts', ...tests.map(test => `apps/web/tests/${test}`)])
// Existing Host helpers write failure shots into .artifacts. Retain only a
// shot produced during this run; never attach a previous failure as new proof.
if (tests.includes('reference-composer-multi.e2e.ts')) {
  const shot = resolve(source, '.artifacts/web-e2e-reference-composer-multi.png')
  try {
    const info = await stat(shot)
    if (info.mtimeMs >= started && info.mtimeMs <= Date.now()) {
      await copyFile(shot, resolve(dir, 'artifacts/reference-composer-multi-failure.png'))
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') console.warn('Unable to retain the Host failure screenshot')
  }
}
const after = await exec('git', ['diff', '--stat'])
const duration = Date.now() - started
await Promise.all([
  writeFile(resolve(dir, 'command.txt'), `${command}\n`),
  writeFile(resolve(dir, 'stdout.log'), redact(result.stdout)),
  writeFile(resolve(dir, 'stderr.log'), redact(result.stderr)),
  writeFile(resolve(dir, 'env.json'), JSON.stringify({ node: process.version, platform: process.platform, source_head: head.stdout.trim(), source_version: packageManifest.version, snapshot_mode: 'replay', provider_request: false, dependency_verification: 'warn_without_install' }, null, 2)),
  writeFile(resolve(dir, 'artifacts/source-diff-before.txt'), redact(before.stdout)),
  writeFile(resolve(dir, 'artifacts/source-diff-after.txt'), redact(after.stdout)),
  writeFile(resolve(dir, 'summary.json'), JSON.stringify({ schema_version: 'yeisme.integration_test_evidence.v1', project: 'agent/harness-plugins', run_id: runId, layer: 'e2e', command, status: result.code ? 'failed' : 'passed', exit_code: result.code, started_at: new Date(started).toISOString(), finished_at: new Date().toISOString(), duration_ms: duration, evidence: { stdout: 'stdout.log', stderr: 'stderr.log', command: 'command.txt', env: 'env.json', artifacts: 'artifacts/' }, redaction: { enabled: true, policy: 'synthetic keyless scenarios; credentials and local paths redacted' }, source_diff_stat_unchanged: before.stdout === after.stdout, tests, scope: tests.includes('reference-composer-multi.e2e.ts') ? 'real host and plugin overlay with keyless replay' : 'real host with keyless replay; plugin overlay requires separate coverage' }, null, 2)),
])
console.log(`Composer real-host gate: ${result.code ? 'FAIL' : 'PASS'}; evidence: ${relative(root, dir)}`)
process.exitCode = result.code
