import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { readdirSync, readFileSync, readlinkSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import process from 'node:process'
import { collectVisualProvenance, serializeProvenance } from './visual-provenance.mjs'

// Playwright 经 `pnpm exec` 间接拉起 webServer 时信号无法穿透 pnpm 垫片，
// server.mjs 会被遗留在 4178 端口并毒化下一次运行（"already used"）。
// Linux 环境经 /proc 按监听端口反查 pid 清理；其它平台无泄漏场景则跳过。
function killPortListeners(port) {
  if (process.platform !== 'linux') return
  const hex = port.toString(16).toUpperCase().padStart(4, '0')
  const inodes = new Set()
  for (const table of ['/proc/net/tcp', '/proc/net/tcp6']) {
    let rows
    try { rows = readFileSync(table, 'utf8').split('\n').slice(1) } catch { continue }
    for (const row of rows) {
      const cols = row.trim().split(/\s+/)
      if (cols[3] !== '0A') continue // LISTEN
      if (cols[1]?.endsWith(`:${hex}`)) inodes.add(cols[9])
    }
  }
  if (inodes.size === 0) return
  for (const pid of readdirSync('/proc')) {
    if (!/^\d+$/.test(pid)) continue
    let fds
    try { fds = readdirSync(`/proc/${pid}/fd`) } catch { continue }
    for (const fd of fds) {
      let link
      try { link = readlinkSync(`/proc/${pid}/fd/${fd}`) } catch { continue }
      if (inodes.has(link.match(/^socket:\[(\d+)\]$/)?.[1])) {
        try { process.kill(Number(pid), 'SIGKILL') } catch { /* 已退出 */ }
        break
      }
    }
  }
}

const projectRoot = resolve(import.meta.dirname, '..')
const startedAt = new Date()
const runId = `ui-visual-${startedAt.toISOString().replace(/[:.]/gu, '-')}-${process.pid}`
const runRoot = resolve(projectRoot, 'temp/integration-test-runs', runId)
const artifacts = resolve(runRoot, 'artifacts')
const update = process.argv.includes('--update-snapshots')
const testFile = process.argv.find(arg => /^visual-[a-z-]+\.spec\.ts$/.test(arg))
const publicCommand = `node scripts/run-ui-visual-tests.mjs${update ? ' --update-snapshots' : ''}${testFile ? ` ${testFile}` : ''}`
const args = ['exec', 'playwright', 'test', '--config', 'tests/ui-visual/playwright.config.ts', update ? '--update-snapshots=all' : '--update-snapshots=none']

if (testFile) args.push(testFile)

function redact(value) {
  return value
    .replace(/(authorization|cookie|token|password|secret)\s*[:=]\s*[^\s]+/giu, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gu, 'Bearer [REDACTED]')
}

await mkdir(artifacts, { recursive: true })
killPortListeners(4178)
const provenance = await collectVisualProvenance({ projectRoot })
await writeFile(resolve(artifacts, 'visual-provenance.json'), `${JSON.stringify(serializeProvenance(provenance), null, 2)}\n`, 'utf8')
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
  device_scale_factor: 1,
  browser_selection: provenance.browser.selection,
  browser_available: provenance.browser.status === 'available',
  overrides_set: provenance.overrides_set,
  redacted: true,
}, null, 2)}\n`, 'utf8')

let stdout = ''
let stderr = ''
let exitCode = 1
if (provenance.browser.status !== 'available' || provenance.browser.executable_path === undefined) {
  stderr = `Visual browser unavailable: ${provenance.browser.reason ?? 'matching Playwright headless shell is unavailable'}\n`
} else {
  const child = spawn('pnpm', args, {
    cwd: projectRoot,
    // Explicit user overrides are retained by collectVisualProvenance; when
    // absent, this pins the exact headless-shell revision from browsers.json.
    env: { ...process.env, UI_VISUAL_EVIDENCE_DIR: artifacts, DSH_TEST_CHROME_EXECUTABLE: provenance.browser.executable_path },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', chunk => { stdout += String(chunk) })
  child.stderr.on('data', chunk => { stderr += String(chunk) })
  exitCode = await new Promise((resolveExit, reject) => {
    child.once('error', reject)
    child.once('close', code => resolveExit(code ?? 1))
  })
  killPortListeners(4178)
}
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
    visual_provenance: relative(projectRoot, resolve(artifacts, 'visual-provenance.json')),
  },
  redaction: { enabled: true, policy: 'harness-plugins-ui-visual-v1' },
  update_snapshots: update,
}
await writeFile(resolve(runRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
process.stdout.write(stdout)
if (stderr.length > 0) process.stderr.write(stderr)
process.stdout.write(`UI visual evidence: ${relative(projectRoot, resolve(runRoot, 'summary.json'))}\n`)
process.exitCode = exitCode
