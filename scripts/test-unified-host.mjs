#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const runId = `unified-host-tests-${new Date().toISOString().replace(/[:.]/g, '-')}`
const dir = resolve(root, 'temp/integration-test-runs', runId)
await mkdir(resolve(dir, 'artifacts'), { recursive: true })
const args = ['exec', 'vitest', 'run', 'packages/client/ui-layout/tests', 'packages/client/ui-renderer/tests', 'packages/client/ui-agent-preset/tests', 'packages/client/ui-workspace/tests']
const child = spawn('pnpm', args, { cwd: resolve(root, 'temp/dsh-unified-host-source'), stdio: ['ignore', 'pipe', 'pipe'] })
let out = '', err = ''
child.stdout.on('data', c => { out += c }); child.stderr.on('data', c => { err += c })
const code = await new Promise(done => { child.once('error', error => { err += error.message; done(1) }); child.once('close', code => done(code ?? 1)) })
const redact = text => text.replaceAll(root, '[PROJECT_ROOT]').replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
await Promise.all([
  writeFile(resolve(dir, 'summary.json'), JSON.stringify({ runId, status: code ? 'failed' : 'passed', exit_code: code, scope: 'ui-layout, explicit SessionProvider, per-session preset controls, sidebar rows', redacted: true }, null, 2)),
  writeFile(resolve(dir, 'command.txt'), `cd temp/dsh-unified-host-source\npnpm ${args.join(' ')}\n`),
  writeFile(resolve(dir, 'stdout.log'), redact(out)), writeFile(resolve(dir, 'stderr.log'), redact(err)),
  writeFile(resolve(dir, 'env.json'), JSON.stringify({ node: process.version, release: 'dsh-v0.1.2-rc.1', redacted: true })),
])
console.log(`${code ? 'FAIL' : 'PASS'} Evidence: temp/integration-test-runs/${runId}`)
process.exitCode = code
