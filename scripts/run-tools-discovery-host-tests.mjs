#!/usr/bin/env node
/** Isolated real Host/Tools gate. Package builds must be stable before this runs. */
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { homedir } from 'node:os'
const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'temp/dsh-unified-host-source')
const started = Date.now(), runId = `tools-discovery-host-${new Date(started).toISOString().replace(/[:.]/g, '-')}`
const dir = resolve(root, 'temp/integration-test-runs', runId)
await mkdir(resolve(dir, 'artifacts'), { recursive: true })
let result
try {
const target = 'apps/web/tests/tools-discovery-draft.e2e.ts'
const expected = await readFile(resolve(root, 'upstream-prs/tools-pane-layout-v1/new-files', target), 'utf8')
if (!existsSync(resolve(source, target))) throw new Error('Apply upstream-prs/tools-pane-layout-v1 to the reviewed staging checkout before testing')
if (await readFile(resolve(source, target), 'utf8') !== expected) throw new Error('Preserve changed staging test; apply the reviewed packet before testing')
const chrome = process.env.DSH_TEST_CHROME_EXECUTABLE ?? (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined)
const env = { ...process.env, pnpm_config_verify_deps_before_run: 'warn', DSH_SNAPSHOT: 'replay', DSH_TELEMETRY_DISABLED: '1', DSH_TOOLS_EVIDENCE_DIR: resolve(dir, 'artifacts'), ...(chrome ? { DSH_TEST_CHROME_EXECUTABLE: chrome } : {}) }
result = await new Promise(accept => {
  const child = spawn(process.execPath, [resolve(source, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'vitest.web.config.ts', target], { cwd: source, env, stdio: ['ignore', 'pipe', 'pipe'] })
  let out = '', err = ''
  child.stdout.on('data', chunk => { out += chunk }); child.stderr.on('data', chunk => { err += chunk })
  child.once('error', error => { err += error.message })
  child.once('close', code => accept({ code: code ?? 1, out, err }))
})
} catch (error) { result = { code: 1, out: '', err: error.message } }
const redact = value => String(value).replace(/([?&](?:token|key|signature)=)[^\s&"']+/gi, '$1[REDACTED]').replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]').replaceAll(root, '[PROJECT_ROOT]').replaceAll(homedir(), '[USER_HOME]')
const command = 'node scripts/run-tools-discovery-host-tests.mjs'
await Promise.all([
  writeFile(resolve(dir, 'command.txt'), `${command}\n`), writeFile(resolve(dir, 'stdout.log'), redact(result.out)), writeFile(resolve(dir, 'stderr.log'), redact(result.err)),
  writeFile(resolve(dir, 'env.json'), JSON.stringify({ node: process.version, snapshot: 'replay', provider_request: false, real_host: true, real_tools_bundle: true, sessions: 'synthetic isolated workspace' })),
  writeFile(resolve(dir, 'summary.json'), JSON.stringify({ schema_version: 'yeisme.integration_test_evidence.v1', project: 'agent/harness-plugins', run_id: runId, layer: 'e2e', command, status: result.code ? 'failed' : 'passed', exit_code: result.code, started_at: new Date(started).toISOString(), finished_at: new Date().toISOString(), duration_ms: Date.now() - started, evidence: { command: 'command.txt', stdout: 'stdout.log', stderr: 'stderr.log', env: 'env.json', artifacts: 'artifacts/' }, redaction: { enabled: true, policy: 'synthetic keyless sessions; private roots and authentication redacted' } }, null, 2)),
])
console.log(`${result.code ? 'FAIL' : 'PASS'} ${relative(root, dir)}`)
process.exitCode = result.code
