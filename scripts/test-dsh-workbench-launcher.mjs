#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
const root = resolve(import.meta.dirname, '..')
const runId = `workbench-launcher-${new Date().toISOString().replace(/[:.]/g, '-')}`
const dir = resolve(root, 'temp/integration-test-runs', runId)
const home = resolve(root, 'temp', runId)
await mkdir(resolve(dir, 'artifacts'), { recursive: true })
let out = '', err = '', failure
const commands = []
async function run(args) {
  commands.push(`node ${args.join(' ')}`)
  const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', c => { out += c }); child.stderr.on('data', c => { err += c })
  const code = await new Promise(done => { child.once('error', error => { err += error.message; done(1) }); child.once('close', code => done(code ?? 1)) })
  assert.equal(code, 0, 'Official profile command must succeed')
}
try {
  await run(['temp/dsh-unified-host-source/apps/cli/lib/bin.js', 'plugin', '--profile', 'web', 'add', '@deepseek-ai/dsh-client-ui-layout@0.1.2-rc.1'])
  const manifest = async () => JSON.parse(await readFile(resolve(home, 'profiles/web/package.json'), 'utf8'))
  const name = '@deepseek-ai/dsh-client-ui-layout'
  const original = (await manifest()).dependencies[name]
  await run(['scripts/dsh-workbench.mjs', '--prepare-only'])
  assert((await manifest()).dependencies[name].startsWith('link:'))
  const installed = (await manifest()).dependencies
  assert.equal(Object.keys(installed).filter(name => name.startsWith('@yeisme/')).length, 32)
  await run(['scripts/dsh-workbench.mjs', '--rollback'])
  const restored = (await manifest()).dependencies
  assert.equal(restored[name], original)
  for (const [key, value] of Object.entries(installed)) if (key !== name) assert.equal(restored[key], value)
} catch (error) { failure = error.message }
const redact = text => text.replaceAll(root, '[PROJECT_ROOT]').replace(/([?&]token=)[^\s&]+/g, '$1[REDACTED]')
await Promise.all([
  writeFile(resolve(dir, 'summary.json'), JSON.stringify({ runId, status: failure ? 'failed' : 'passed', failure, originalVersionRestored: !failure, otherDependenciesPreserved: !failure, redacted: true }, null, 2)),
  writeFile(resolve(dir, 'command.txt'), commands.join('\n') + '\n'),
  writeFile(resolve(dir, 'stdout.log'), redact(out)), writeFile(resolve(dir, 'stderr.log'), redact(err)),
  writeFile(resolve(dir, 'env.json'), JSON.stringify({ node: process.version, home: 'disposable isolated home', paidCalls: false, redacted: true })),
])
console.log(`${failure ? 'FAIL' : 'PASS'} Evidence: temp/integration-test-runs/${runId}`)
process.exitCode = failure ? 1 : 0
