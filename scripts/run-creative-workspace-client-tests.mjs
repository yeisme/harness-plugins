#!/usr/bin/env node
/** Scoped synthetic client verification with deterministic cwd and retained evidence. */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve, relative } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const cwd = resolve(root, 'packages/client/ui-creator-studio')
const runId = `creative-workspace-client-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`
const dir = resolve(root, 'temp/integration-test-runs', runId)
await mkdir(resolve(dir, 'artifacts'), { recursive: true })
const args = [resolve(cwd, 'node_modules/vitest/vitest.mjs'), 'run', 'tests/auctra-recovery-drafts.spec.tsx', 'tests/operation-recovery-notice.spec.tsx', 'tests/candidate-history.spec.tsx', 'tests/artifact-auto-save.spec.tsx', 'tests/artifact-workspace.spec.tsx', 'tests/action-composer.spec.tsx', 'tests/controller.spec.ts']
const fingerprint = async () => {
  const files = ['package.json', 'vitest.config.ts']
  for (const folder of ['src', 'tests']) {
    for (const path of await readdir(resolve(cwd, folder), { recursive: true })) {
      if (/\.(?:ts|tsx|css|json)$/u.test(path)) files.push(`${folder}/${path}`)
    }
  }
  const result = {}
  for (const path of files.sort()) result[path] = createHash('sha256').update(await readFile(resolve(cwd, path))).digest('hex')
  return result
}
const redact = value => value.replaceAll(root, '[PROJECT_ROOT]').replaceAll(homedir(), '[USER_HOME]')
const before = await fingerprint()
const started = Date.now()
const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
let stdout = '', stderr = ''
child.stdout.on('data', chunk => { stdout += chunk })
child.stderr.on('data', chunk => { stderr += chunk })
const code = await new Promise(done => { child.once('error', error => { stderr += error.message; done(1) }); child.once('close', value => done(value ?? 1)) })
const after = await fingerprint()
const unchanged = JSON.stringify(before) === JSON.stringify(after)
const exitCode = code === 0 && unchanged ? 0 : 1
await Promise.all([
  writeFile(resolve(dir, 'stdout.log'), redact(stdout)),
  writeFile(resolve(dir, 'stderr.log'), redact(stderr)),
  writeFile(resolve(dir, 'command.txt'), 'node scripts/run-creative-workspace-client-tests.mjs\n' + redact([process.execPath, ...args].join(' ')) + '\n'),
  writeFile(resolve(dir, 'env.json'), JSON.stringify({ cwd: relative(root, cwd), node: process.version, platform: process.platform, scope: 'synthetic client component and controller; no Host or real owner acceptance' }, null, 2)),
  writeFile(resolve(dir, 'artifacts/source-inputs-before.json'), JSON.stringify(before, null, 2)),
  writeFile(resolve(dir, 'artifacts/source-inputs-after.json'), JSON.stringify(after, null, 2)),
  writeFile(resolve(dir, 'summary.json'), JSON.stringify({ schema_version: 'yeisme.integration_test_evidence.v1', run_id: runId, exit_code: exitCode, test_exit_code: code, source_inputs_unchanged: unchanged, duration_ms: Date.now() - started, scope: 'client', redacted: true }, null, 2)),
])
console.log(`Creative workspace client gate: ${exitCode === 0 ? 'PASS' : 'FAIL'}; evidence: ${relative(root, dir)}`)
process.exitCode = exitCode
