#!/usr/bin/env node
/** Keyless Host gate for the synthetic Creator/Browser workspace fixture. */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const source = resolve(root, 'temp/dsh-unified-host-source')
await realpath(source)
const started = Date.now()
const runId = `creative-workspace-host-${new Date(started).toISOString().replace(/[:.]/g, '-')}-${process.pid}`
const dir = resolve(root, 'temp/integration-test-runs', runId)
await mkdir(resolve(dir, 'artifacts'), { recursive: true })
const command = 'node scripts/run-creative-workspace-host-tests.mjs'
const redact = value => String(value)
  .replace(/([?&](?:token|key|signature)=)[^\s&"']+/giu, '$1[REDACTED]')
  .replace(/Bearer\s+[^\s"']+/giu, 'Bearer [REDACTED]')
  .replaceAll(root, '[PROJECT_ROOT]').replaceAll(homedir(), '[USER_HOME]')
const exec = (cmd, args, cwd = source) => new Promise(resolveResult => {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, pnpm_config_verify_deps_before_run: 'warn', DSH_SNAPSHOT: 'replay', DSH_TELEMETRY_DISABLED: '1', DSH_CREATIVE_WORKSPACE_PLUGIN_ROOT: root, DSH_CREATIVE_WORKSPACE_EVIDENCE_DIR: resolve(dir, 'artifacts'), DSH_CREATIVE_CREATOR_HOST_MODULE: new URL('../packages/bundle/dsh-creator-studio/lib/index.js', import.meta.url).href }, stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = '', stderr = ''
  child.stdout.on('data', chunk => { stdout += chunk })
  child.stderr.on('data', chunk => { stderr += chunk })
  child.once('error', error => { stderr += error.message })
  child.once('close', code => resolveResult({ code: code ?? 1, stdout, stderr }))
})
const fingerprint = async () => {
  const entries = []
  for (const [label, cwd, paths] of [
    ['host', source, ['apps/web/tests/creative-workspace.e2e.ts', 'apps/web/tests/creative-workspace-overlay.yml', 'apps/web/tests/creative-workspace-fixture', 'apps/web/tests/scaffold.ts', 'apps/web/tests/support.ts', 'packages/api/session-controller', 'packages/context/session-reference', 'packages/client/modules', 'packages/client/ui-conversation', 'vitest.web.config.ts', 'package.json', 'pnpm-lock.yaml']],
    ['plugins', root, ['packages/host/creator-studio', 'packages/client/ui-creator-studio', 'packages/bundle/dsh-creator-studio', 'packages/host/dsh-browser-host', 'packages/client/ui-browser-pane', 'packages/bundle/dsh-browser-pane', 'packages/client/ui-pane-workbench', 'packages/bundle/dsh-desktop-workbench', 'packages/bundle/pane-workbench', 'packages/bundle/dsh-rich-media', 'scripts/run-creative-workspace-host-tests.mjs', 'package.json', 'pnpm-lock.yaml']],
  ]) {
    const listing = await exec('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...paths], cwd)
    if (listing.code !== 0) throw new Error(`Cannot fingerprint ${label} inputs`)
    for (const path of [...new Set(listing.stdout.split('\0').filter(Boolean))].sort()) {
      if (/(^|\/)(lib|node_modules|\.artifacts)\//u.test(path)) continue
      let digest
      try { digest = createHash('sha256').update(await readFile(resolve(cwd, path))).digest('hex') } catch (error) {
        if (error?.code !== 'ENOENT') throw error
        digest = 'deleted'
      }
      entries.push({ path: `${label}/${path}`, sha256: digest })
    }
  }
  return entries
}

const head = await exec('git', ['rev-parse', 'HEAD'])
const before = await exec('git', ['diff', '--stat'])
const inputsBefore = await fingerprint()
const packageManifest = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'))
const result = await exec(process.execPath, [resolve(source, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'vitest.web.config.ts', 'apps/web/tests/creative-workspace.e2e.ts'])
const failureShot = resolve(source, '.artifacts/web-e2e-creative-workspace.png')
try {
  const info = await stat(failureShot)
  if (info.mtimeMs >= started && info.mtimeMs <= Date.now()) await copyFile(failureShot, resolve(dir, 'artifacts/web-e2e-creative-workspace.png'))
} catch (error) {
  if (error?.code !== 'ENOENT') console.warn('Unable to retain the Host failure screenshot')
}
const after = await exec('git', ['diff', '--stat'])
const inputsAfter = await fingerprint()
const inputsUnchanged = JSON.stringify(inputsBefore) === JSON.stringify(inputsAfter)
const exitCode = result.code || (inputsUnchanged ? 0 : 1)
await Promise.all([
  writeFile(resolve(dir, 'command.txt'), `${command}\n`),
  writeFile(resolve(dir, 'stdout.log'), redact(result.stdout)),
  writeFile(resolve(dir, 'stderr.log'), redact(result.stderr)),
  writeFile(resolve(dir, 'env.json'), JSON.stringify({ node: process.version, platform: process.platform, source_head: head.stdout.trim(), source_version: packageManifest.version, snapshot_mode: 'replay', provider_request: false, external_requests: false, dependency_verification: 'direct_local_vitest_without_package_manager' }, null, 2)),
  writeFile(resolve(dir, 'artifacts/source-inputs-before.json'), JSON.stringify(inputsBefore, null, 2)),
  writeFile(resolve(dir, 'artifacts/source-inputs-after.json'), JSON.stringify(inputsAfter, null, 2)),
  writeFile(resolve(dir, 'artifacts/source-diff-before.txt'), redact(before.stdout)),
  writeFile(resolve(dir, 'artifacts/source-diff-after.txt'), redact(after.stdout)),
  writeFile(resolve(dir, 'summary.json'), JSON.stringify({ schema_version: 'yeisme.integration_test_evidence.v1', project: 'agent/harness-plugins', run_id: runId, layer: 'e2e', command, status: exitCode ? 'failed' : 'passed', exit_code: exitCode, test_exit_code: result.code, source_inputs_unchanged: inputsUnchanged, started_at: new Date(started).toISOString(), finished_at: new Date().toISOString(), duration_ms: Date.now() - started, evidence: { stdout: 'stdout.log', stderr: 'stderr.log', command: 'command.txt', env: 'env.json', artifacts: 'artifacts/' }, redaction: { enabled: true, policy: 'synthetic keyless scenario; credentials and local paths redacted' }, source_diff_stat_unchanged: before.stdout === after.stdout, tests: ['creative-workspace.e2e.ts'], scope: 'real Host and ModuleLoader with synthetic Creator owner and Browser projection', real_domain_acceptance: false, real_viewport_provider: false }, null, 2)),
])
console.log(`Creative workspace Host gate: ${exitCode ? 'FAIL' : 'PASS'}; evidence: ${relative(root, dir)}`)
process.exitCode = exitCode
