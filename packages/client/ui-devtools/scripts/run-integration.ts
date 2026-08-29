import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DevtoolsPanel } from '../src/client/panel.tsx'
import type { BrowserPerformanceRecordV1, DevtoolsRecordV1, DevtoolsSnapshotSuccessV1 } from '../src/wire.ts'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(packageRoot, '../../..')
const evidenceRoot = resolve(projectRoot, 'temp/integration-test-runs')
const started = new Date()
const runId = `${started.toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
const runRoot = join(evidenceRoot, runId)
const artifacts = join(runRoot, 'artifacts')
const command = 'pnpm run test:integration'

function redact(input: string): string {
  return input
    .replaceAll(projectRoot, '[PROJECT_ROOT]')
    .replace(/\/(?:tmp|private\/tmp|home|Users|workspaces)\/[A-Za-z0-9._/-]+/g, '[REDACTED_PATH]')
    .replace(/(authorization\s*[:=]\s*)([^\s]+)/gi, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|token|password|cookie|secret)\s*[:=]\s*)([^\s]+)/gi, '$1[REDACTED]')
    .replace(/((?:raw|system)[_ -]?prompt\s*[:=]\s*)(.+)$/gim, '$1[REDACTED]')
}

function snapshot(records: readonly DevtoolsRecordV1[], cpuProfile: boolean): DevtoolsSnapshotSuccessV1 {
  return {
    ok: true, specVersion: '1.0', bootId: 'fixture-boot', serverTime: 100_000, nextSeq: records.at(-1)?.seq ?? 0, truncated: false,
    capabilities: { logger: true, sessionTimeline: true, hostMetrics: true, cpuProfile, exactRpcCorrelation: false },
    summary: { uptimeMs: 90_000, records: records.length, logs: records.filter(item => item.type === 'log').length, spans: records.filter(item => item.type === 'span').length, samples: records.filter(item => item.type === 'sample').length, findings: records.filter(item => item.type === 'finding').length, errors: records.filter(item => (item.type === 'log' && item.severity === 'error') || (item.type === 'finding' && item.severity === 'error')).length, latestMetrics: { cpuPercent: 14.2, rssBytes: 384 * 1024 * 1024, heapUsedBytes: 144 * 1024 * 1024, heapTotalBytes: 220 * 1024 * 1024, eventLoopUtilization: 0.18, eventLoopDelayP95Ms: 24 } },
    records,
  }
}

const normalRecords: DevtoolsRecordV1[] = [
  { seq: 1, ts: 90_000, type: 'lifecycle', event: 'devtools.ready', severity: 'info', summary: 'DSH DevTools ready' },
  { seq: 2, ts: 94_000, type: 'span', category: 'tool', name: 'read_file', status: 'ok', startTime: 93_900, endTime: 94_000, durationMs: 100, sessionRef: 'session_demo', callRef: 'call_demo' },
  { seq: 3, ts: 95_000, type: 'log', severity: 'warn', source: 'runtime', fingerprint: 'sha256:fixture', summary: 'warn log from runtime; details redacted' },
  { seq: 4, ts: 100_000, type: 'sample', scope: 'host', metrics: { cpuPercent: 14.2, rssBytes: 384 * 1024 * 1024, heapUsedBytes: 144 * 1024 * 1024, heapTotalBytes: 220 * 1024 * 1024, eventLoopUtilization: 0.18, eventLoopDelayP95Ms: 24 } },
]
const slowRecords: DevtoolsRecordV1[] = [...normalRecords, { seq: 5, ts: 100_100, type: 'finding', code: 'host.event_loop_lag', severity: 'warn', summary: 'Event-loop p95 148ms exceeds 100ms', evidenceSeqs: [4] }, { seq: 6, ts: 100_200, type: 'span', category: 'tool', name: 'bash', status: 'ok', startTime: 94_000, endTime: 100_200, durationMs: 6200, sessionRef: 'session_demo', callRef: 'call_slow' }]
const browserRecords: BrowserPerformanceRecordV1[] = [
  { seq: 1, type: 'browser-performance', kind: 'paint', ts: 90_300, name: 'first-contentful-paint', durationMs: 0 },
  { seq: 2, type: 'browser-performance', kind: 'api', ts: 96_000, name: '/api/session.list', durationMs: 720, findingCode: 'web.api_slow' },
  { seq: 3, type: 'browser-performance', kind: 'long-task', ts: 97_000, name: 'self', durationMs: 88, findingCode: 'web.long_task' },
]

function panelHtml(input: { snapshot?: DevtoolsSnapshotSuccessV1; width: number; capturing?: boolean; message?: string }): string {
  const state = input.snapshot === undefined ? { status: 'error' as const, message: 'DevTools Host is unavailable' } : { status: 'ready' as const, snapshot: input.snapshot, clockOffsetMs: 2, clockUncertaintyMs: 4 }
  const markup = renderToStaticMarkup(createElement(DevtoolsPanel, { state, browserRecords, onCaptureCpu: () => undefined, onExport: () => undefined, ...(input.capturing === undefined ? {} : { capturing: input.capturing }), ...(input.message === undefined ? {} : { message: input.message }) }))
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;min-height:100%;background:#111113}body{padding:12px}.fixture{width:${input.width}px;max-width:100%;height:620px;margin:auto}</style></head><body><main class="fixture">${markup}</main></body></html>`
}

async function screenshots(): Promise<string[]> {
  const names: string[] = []
  const browser = await chromium.launch({ headless: true })
  try {
    const cases = [
      { name: '01-normal-1400.png', width: 1400, html: panelHtml({ snapshot: snapshot(normalRecords, true), width: 1360 }) },
      { name: '02-slow-960.png', width: 960, html: panelHtml({ snapshot: snapshot(slowRecords, true), width: 920 }) },
      { name: '03-host-unavailable-560.png', width: 560, html: panelHtml({ width: 520 }) },
      { name: '04-cpu-capture-960.png', width: 960, html: panelHtml({ snapshot: snapshot(normalRecords, true), width: 920, capturing: true, message: 'CPU profiling adds temporary runtime overhead.' }) },
      { name: '05-export-1400.png', width: 1400, html: panelHtml({ snapshot: snapshot(normalRecords, true), width: 1360, message: 'Diagnostics export downloaded.' }) },
    ]
    for (const item of cases) {
      const page = await browser.newPage({ viewport: { width: item.width, height: 700 }, colorScheme: 'dark', reducedMotion: 'reduce' })
      await page.setContent(item.html, { waitUntil: 'load' })
      await page.screenshot({ path: join(artifacts, item.name), fullPage: true })
      names.push(item.name)
      await page.close()
    }
  } finally { await browser.close() }
  return names
}

await mkdir(artifacts, { recursive: true })
await writeFile(join(runRoot, 'command.txt'), `${command}\n`, 'utf8')
await writeFile(join(runRoot, 'env.json'), `${JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, ci: process.env.CI === 'true', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, redaction: 'dsh-devtools-safe-v1' }, null, 2)}\n`, 'utf8')

const checks = [
  ['@yeisme/dsh-devtools-host', 'test'],
  ['@yeisme/dsh-client-ui-devtools', 'test'],
  ['@yeisme/dsh-devtools', 'test'],
] as const
const stdout: string[] = []
const stderr: string[] = []
let exitCode = 0
for (const [pkg, script] of checks) {
  const result = spawnSync('pnpm', ['--filter', pkg, script], { cwd: projectRoot, encoding: 'utf8', env: process.env })
  stdout.push(`package=${pkg} script=${script} exit=${result.status ?? 1}`, result.stdout ?? '')
  if (result.stderr) stderr.push(result.stderr)
  if ((result.status ?? 1) !== 0) { exitCode = result.status ?? 1; break }
}
if (exitCode === 0) {
  try { for (const name of await screenshots()) stdout.push(`screenshot=${name}`) } catch (error) { exitCode = 1; stderr.push(error instanceof Error ? error.message : 'screenshot failure') }
}

const finished = new Date()
await writeFile(join(runRoot, 'stdout.log'), redact(`${stdout.join('\n')}\n`), 'utf8')
await writeFile(join(runRoot, 'stderr.log'), redact(`${stderr.join('\n')}\n`), 'utf8')
await writeFile(join(runRoot, 'summary.json'), `${JSON.stringify({
  schema_version: 'yeisme.integration_test_evidence.v1', project: 'agent/harness-plugins', run_id: runId, layer: 'component', command,
  status: exitCode === 0 ? 'passed' : 'failed', exit_code: exitCode, started_at: started.toISOString(), finished_at: finished.toISOString(), duration_ms: finished.getTime() - started.getTime(),
  evidence: { command: `${relative(projectRoot, join(runRoot, 'command.txt'))}`, stdout: `${relative(projectRoot, join(runRoot, 'stdout.log'))}`, stderr: `${relative(projectRoot, join(runRoot, 'stderr.log'))}`, env: `${relative(projectRoot, join(runRoot, 'env.json'))}`, artifacts: `${relative(projectRoot, artifacts)}/` },
  redaction: { enabled: true, policy: 'dsh-devtools-safe-v1' },
}, null, 2)}\n`, 'utf8')
process.stdout.write(`integration evidence: ${relative(projectRoot, runRoot)}\n`)
process.exitCode = exitCode
