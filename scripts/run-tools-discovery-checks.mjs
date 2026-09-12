#!/usr/bin/env node
/** Serial feature gates with failure-preserving, redacted evidence. Never rewrites snapshots. */
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { relative, resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const gates = {
  'feature-build': [
    ['node', 'scripts/build-editable-reference-host.mjs'],
    ['pnpm', '--filter', '@yeisme/dsh-client-ui-mcp-inspector', 'build'],
    ['pnpm', '--filter', '@yeisme/dsh-mcp-inspector', 'build'],
    ['pnpm', '--filter', '@yeisme/dsh-desktop-workbench', 'build'],
    ['node', 'scripts/dsh-workbench.mjs', '--check'],
  ],
  focused: [
    ['pnpm', '--filter', '@yeisme/dsh-tool-hub-host', 'exec', 'vitest', 'run', 'tests/catalog.spec.ts', 'tests/gateway.spec.ts', 'tests/guard.spec.ts', 'tests/loader-composition.spec.ts', 'tests/service.spec.ts'],
    ['pnpm', '--filter', '@yeisme/dsh-client-ui-mcp-inspector', 'test'],
    ['node', '--test', 'scripts/workbench-runtime.spec.mjs', 'scripts/dsh-dev.spec.mjs'],
  ],
  typecheck: [['pnpm', 'run', 'typecheck']],
  surfaces: [['pnpm', 'run', 'check:surfaces']],
  plugins: [['pnpm', 'run', 'check:plugins']],
  visual: [['pnpm', 'run', 'test:visual']],
  'visual-tools': [['node', 'scripts/run-ui-visual-tests.mjs', 'visual-tools-discovery.spec.ts']],
  openspec: [['openspec', 'validate', 'dsh-tools-discovery-draft-v1', '--strict', '--no-interactive']],
  'openspec-all': [['openspec', 'validate', '--all', '--no-interactive']],
  layout: [['node', 'scripts/test-tools-pane-layout.mjs']],
  patches: [['node', 'scripts/test-workbench-patches.mjs']],
  host: [['node', 'scripts/run-tools-discovery-host-tests.mjs']],
}
const requested = process.argv.slice(2)
if (!requested.length || requested.some(gate => !Object.hasOwn(gates, gate))) {
  console.error(`Usage: node scripts/run-tools-discovery-checks.mjs ${Object.keys(gates).join('|')} [...]`)
  process.exit(2)
}
const started = Date.now()
const runId = `tools-discovery-${requested.join('-')}-${new Date(started).toISOString().replace(/[:.]/g, '-')}`
const dir = resolve(root, 'temp/integration-test-runs', runId)
await mkdir(resolve(dir, 'artifacts'), { recursive: true })
const command = `node scripts/run-tools-discovery-checks.mjs ${requested.join(' ')}`
const redact = value => String(value).replace(/([?&](?:token|key|signature)=)[^\s&"']+/gi, '$1[REDACTED]').replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]').replaceAll(root, '[PROJECT_ROOT]').replaceAll(homedir(), '[USER_HOME]')
let stdout = '', stderr = '', exitCode = 0
const results = []
for (const gate of requested) {
  for (const [program, ...args] of gates[gate]) {
    const start = Date.now()
    const result = await new Promise(accept => {
      const child = spawn(program, args, { cwd: root, env: { ...process.env, pnpm_config_verify_deps_before_run: 'warn' }, stdio: ['ignore', 'pipe', 'pipe'] })
      let out = '', err = ''
      child.stdout.on('data', chunk => { out += chunk })
      child.stderr.on('data', chunk => { err += chunk })
      child.once('error', error => { err += error.message })
      child.once('close', code => accept({ code: code ?? 1, out, err }))
    })
    stdout += redact(result.out); stderr += redact(result.err)
    results.push({ gate, command: [program, ...args].join(' '), exit_code: result.code, duration_ms: Date.now() - start })
    if (result.code && !exitCode) exitCode = result.code
    console.log(`${gate}: ${result.code ? 'FAIL' : 'PASS'} (${Date.now() - start}ms)`)
    if (result.code) break
  }
}
await Promise.all([
  writeFile(resolve(dir, 'command.txt'), `${command}\n${results.map(row => row.command).join('\n')}\n`),
  writeFile(resolve(dir, 'stdout.log'), stdout),
  writeFile(resolve(dir, 'stderr.log'), stderr),
  writeFile(resolve(dir, 'env.json'), JSON.stringify({ node: process.version, platform: process.platform, provider_request: false, gates: requested, dependency_verification: 'warn_no_install', snapshots_updated: false }, null, 2)),
  writeFile(resolve(dir, 'summary.json'), JSON.stringify({ schema_version: 'yeisme.integration_test_evidence.v1', project: 'agent/harness-plugins', run_id: runId, layer: 'integration', command, status: exitCode ? 'failed' : 'passed', exit_code: exitCode, started_at: new Date(started).toISOString(), finished_at: new Date().toISOString(), duration_ms: Date.now() - started, results, evidence: { command: 'command.txt', stdout: 'stdout.log', stderr: 'stderr.log', env: 'env.json', artifacts: 'artifacts/' }, redaction: { enabled: true, policy: 'local synthetic tests, credentials and local roots redacted' } }, null, 2)),
])
console.log(`Evidence: ${relative(root, dir)}`)
process.exitCode = exitCode
