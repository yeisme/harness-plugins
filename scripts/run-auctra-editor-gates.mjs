/** Retain the existing project quality commands as per-run closeout evidence. */
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve, relative } from 'node:path'

const gates = { test: ['pnpm', ['test']], plugins: ['pnpm', ['run', 'check:plugins']], bundles: ['pnpm', ['run', 'check:bundles']], surfaces: ['pnpm', ['run', 'check:surfaces']], visual: ['pnpm', ['run', 'test:visual']] }
const gate = process.argv[2]
if (process.argv.length !== 3 || !Object.hasOwn(gates, gate)) throw Error('Choose one gate: test, plugins, bundles, surfaces, visual')
const root = resolve(import.meta.dirname, '..'), start = new Date()
const runId = `auctra-editor-${gate}-${start.toISOString().replace(/[:.]/g, '-')}-${process.pid}`
const dir = resolve(root, 'temp/integration-test-runs', runId)
await mkdir(resolve(dir, 'artifacts'), { recursive: true })
const [command, args] = gates[gate]
const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
let stdout = '', stderr = ''
child.stdout.on('data', chunk => { stdout += chunk })
child.stderr.on('data', chunk => { stderr += chunk })
const code = await new Promise(done => { child.once('error', error => { stderr += error.message; done(1) }); child.once('close', value => done(value ?? 1)) })
const redact = text => text.replaceAll(root, '[PROJECT_ROOT]').replaceAll(homedir(), '[USER_HOME]')
  .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/((?:token|password|cookie|secret)\s*[:=]\s*)\S+/gi, '$1[REDACTED]')
await Promise.all([
  writeFile(resolve(dir, 'command.txt'), `${command} ${args.join(' ')}\n`),
  writeFile(resolve(dir, 'stdout.log'), redact(stdout)), writeFile(resolve(dir, 'stderr.log'), redact(stderr)),
  writeFile(resolve(dir, 'env.json'), JSON.stringify({ node: process.version, platform: process.platform, gate }, null, 2)),
  writeFile(resolve(dir, 'summary.json'), JSON.stringify({ schema_version: 'yeisme.integration_test_evidence.v1', project: 'agent/harness-plugins', run_id: runId,
    layer: 'component', scope: 'Existing project-wide quality gate; not an owner or production acceptance claim', command: `${command} ${args.join(' ')}`,
    status: code === 0 ? 'passed' : 'failed', exit_code: code, started_at: start.toISOString(), finished_at: new Date().toISOString(), duration_ms: Date.now() - start.getTime(),
    evidence: { stdout: 'stdout.log', stderr: 'stderr.log', command: 'command.txt', env: 'env.json', artifacts: 'artifacts/' }, redaction: { enabled: true } }, null, 2)),
])
console.log(`Auctra editor ${gate}: ${code === 0 ? 'PASS' : 'FAIL'}; evidence: ${relative(root, dir)}`)
process.exitCode = code
