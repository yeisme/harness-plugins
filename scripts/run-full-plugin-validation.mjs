#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises'
import { readFileSync, unlinkSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { homedir } from 'node:os'
import { acquireVerificationLock } from './verification-lock.mjs'

const root = resolve(import.meta.dirname, '..')
// A build cleans package output directories. Concurrent full runs would make
// each other's typechecks and visual loaders observe temporarily missing modules.
await mkdir(resolve(root, 'temp'), { recursive: true })
const lockPath = resolve(root, 'temp/full-plugin-validation.pid')
let waiting = false
for (;;) {
  try {
    const lock = await open(lockPath, 'wx', 0o600)
    await lock.writeFile(String(process.pid)); await lock.close()
    break
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    let owner
    try { owner = Number(await readFile(lockPath, 'utf8')) } catch { continue }
    if (Number.isSafeInteger(owner) && owner > 0) {
      try { process.kill(owner, 0) } catch (probe) {
        if (probe.code === 'ESRCH') { await unlink(lockPath).catch(() => {}); continue }
      }
    }
    if (!waiting) { console.log('Waiting for the other full plugin validation run.'); waiting = true }
    await new Promise(done => setTimeout(done, 500))
  }
}
process.once('exit', () => {
  try { if (readFileSync(lockPath, 'utf8') === String(process.pid)) unlinkSync(lockPath) } catch { /* Another cleanup may have already removed the lock. */ }
})
const runId = `full-plugins-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`
const dir = resolve(root, 'temp/integration-test-runs', runId)
await mkdir(resolve(dir, 'artifacts'), { recursive: true })
const names = process.argv.slice(2)
const checks = names.length ? names : ['typecheck', 'test', 'build', 'check:bundles', 'check:surfaces', 'test:visual', 'check:plugins', 'test:dsh-dev', 'test:dsh-dev:integration']
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
if (checks.some(name => !Object.hasOwn(manifest.scripts, name))) throw new Error('Unknown package script')
const release = await acquireVerificationLock(root, { onWait: () => console.log('Waiting for another full plugin verifier to finish...') })
try {
const redact = value => value.replaceAll(root, '[PROJECT_ROOT]').replaceAll(homedir(), '[USER_HOME]').replace(/([?&]token=)[^\s&"']+/gi, '$1[REDACTED]').replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
const results = []
let stdout = '', stderr = ''
for (const name of checks) {
  const command = `pnpm run ${name}`
  const started = Date.now()
  // Verification must report dependency drift rather than letting pnpm 11's
  // default "install" mode mutate the shared dependency tree before a gate.
  const child = spawn('pnpm', ['run', name], {
    cwd: root,
    env: { ...process.env, pnpm_config_verify_deps_before_run: 'warn' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let out = '', err = ''
  child.stdout.on('data', chunk => { out += chunk })
  child.stderr.on('data', chunk => { err += chunk })
  const code = await new Promise(done => { child.once('error', error => { err += error.message; done(1) }); child.once('close', code => done(code ?? 1)) })
  stdout += `${command}\n${redact(out)}\n`
  stderr += `${command}\n${redact(err)}\n`
  results.push({ command, exit_code: code, duration_ms: Date.now() - started, status: code ? 'failed' : 'passed' })
  await writeFile(resolve(dir, 'artifacts', `${name.replaceAll(':', '-')}.log`), redact(out + err))
  await writeFile(resolve(dir, 'summary.json'), JSON.stringify({ schema_version: 'yeisme.integration_test_evidence.v1', run_id: runId, status: 'running', results, redacted: true }, null, 2))
  console.log(`${command}: ${code ? 'FAIL' : 'PASS'}`)
}
const exitCode = results.some(result => result.exit_code) ? 1 : 0
await Promise.all([
  writeFile(resolve(dir, 'stdout.log'), stdout), writeFile(resolve(dir, 'stderr.log'), stderr),
  writeFile(resolve(dir, 'command.txt'), checks.map(name => `pnpm run ${name}`).join('\n') + '\n'),
  writeFile(resolve(dir, 'env.json'), JSON.stringify({ node: process.version, platform: process.platform, dependency_verification: 'warn_without_install', redacted: true }, null, 2)),
  writeFile(resolve(dir, 'summary.json'), JSON.stringify({ schema_version: 'yeisme.integration_test_evidence.v1', run_id: runId, status: exitCode ? 'failed' : 'passed', exit_code: exitCode, results, redacted: true }, null, 2)),
])
console.log(`Full plugin evidence: ${relative(root, dir)}`)
process.exitCode = exitCode
} finally {
  await release()
}
