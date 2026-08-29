import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import process from 'node:process'

const projectRoot = resolve(import.meta.dirname, '..')
const startedAt = new Date()
const runId = `ui-visual-${startedAt.toISOString().replace(/[:.]/gu, '-')}-${process.pid}`
const runRoot = resolve(projectRoot, 'temp/integration-test-runs', runId)
const artifacts = resolve(runRoot, 'artifacts')
const update = process.argv.includes('--update-snapshots')
const publicCommand = update ? 'pnpm run test:visual:update' : 'pnpm run test:visual'
const args = ['exec', 'playwright', 'test', '--config', 'tests/ui-visual/playwright.config.ts', ...(update ? ['--update-snapshots=all'] : [])]

function redact(value) {
  return value
    .replace(/(authorization|cookie|token|password|secret)\s*[:=]\s*[^\s]+/giu, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gu, 'Bearer [REDACTED]')
}

await mkdir(artifacts, { recursive: true })
await writeFile(resolve(runRoot, 'command.txt'), `${publicCommand}\n`, 'utf8')
await writeFile(resolve(runRoot, 'env.json'), `${JSON.stringify({
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  locale: 'en-US',
  color_scheme: 'dark',
  reduced_motion: 'reduce',
  viewport: '1200x900',
  container_widths: [360, 560, 960],
  redacted: true,
}, null, 2)}\n`, 'utf8')

const child = spawn('pnpm', args, {
  cwd: projectRoot,
  env: { ...process.env, UI_VISUAL_EVIDENCE_DIR: artifacts },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let stdout = ''
let stderr = ''
child.stdout.on('data', chunk => { stdout += String(chunk) })
child.stderr.on('data', chunk => { stderr += String(chunk) })
const exitCode = await new Promise((resolveExit, reject) => {
  child.once('error', reject)
  child.once('close', code => resolveExit(code ?? 1))
})
const finishedAt = new Date()
stdout = redact(stdout)
stderr = redact(stderr)
await writeFile(resolve(runRoot, 'stdout.log'), stdout, 'utf8')
await writeFile(resolve(runRoot, 'stderr.log'), stderr, 'utf8')
const summary = {
  schema_version: 'yeisme.integration_test_evidence.v1',
  project: 'agent/harness-plugins',
  run_id: runId,
  layer: 'component',
  command: publicCommand,
  status: exitCode === 0 ? 'passed' : 'failed',
  exit_code: exitCode,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  evidence: {
    summary: relative(projectRoot, resolve(runRoot, 'summary.json')),
    command: relative(projectRoot, resolve(runRoot, 'command.txt')),
    stdout: relative(projectRoot, resolve(runRoot, 'stdout.log')),
    stderr: relative(projectRoot, resolve(runRoot, 'stderr.log')),
    env: relative(projectRoot, resolve(runRoot, 'env.json')),
    artifacts: relative(projectRoot, artifacts),
  },
  redaction: { enabled: true, policy: 'harness-plugins-ui-visual-v1' },
  update_snapshots: update,
}
await writeFile(resolve(runRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
process.stdout.write(stdout)
if (stderr.length > 0) process.stderr.write(stderr)
process.stdout.write(`UI visual evidence: ${relative(projectRoot, resolve(runRoot, 'summary.json'))}\n`)
process.exitCode = exitCode
