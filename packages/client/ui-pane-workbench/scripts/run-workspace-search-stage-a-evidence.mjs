import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(packageRoot, '../../..')
const startedAt = new Date()
const runId = `workspace-search-stage-a-${startedAt.toISOString().replace(/[:.]/g, '-')}-${process.pid}`
const evidenceDir = resolve(projectRoot, 'temp/integration-test-runs', runId)
const relativeEvidenceDir = relative(projectRoot, evidenceDir)
const publicCommand = 'pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test:workspace-search-stage-a'
const testFiles = [
  'tests/workspace-search-identity.spec.ts',
  'tests/workspace-search-overlay.spec.tsx',
  'tests/workspace-search-query.spec.ts',
  'tests/workspace-search-open.spec.ts',
  'tests/conversation-search-host.spec.ts',
  'tests/search-center-source.spec.ts',
  'tests/search-source-registry.spec.ts',
  'tests/search-center-controls.spec.ts',
]

function redact(input) {
  return String(input)
    .replaceAll(projectRoot, '[PROJECT_ROOT]')
    .replaceAll(homedir(), '[USER_HOME]')
    .replace(/(authorization\s*[:=]\s*)([^\s]+)/gi, '$1[REDACTED]')
    .replace(/((?:token|password|cookie|secret)\s*[:=]\s*)([^\s]+)/gi, '$1[REDACTED]')
    .replace(/(raw[_ -]?prompt\s*[:=]\s*)(.+)$/gim, '$1[REDACTED]')
}

mkdirSync(resolve(evidenceDir, 'artifacts'), { recursive: true })
writeFileSync(resolve(evidenceDir, 'command.txt'), `${publicCommand}\n`)
writeFileSync(resolve(evidenceDir, 'env.json'), `${JSON.stringify({
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  ci: process.env.CI === 'true',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  viewports: [360, 560, 960],
  zoom: '200%',
  catalog_size: 5000,
  history_owner: 'not_probed',
  history_query_lane: 'adapter_contract_only',
  redacted: true,
}, null, 2)}\n`)

const result = spawnSync('pnpm', [
  '--filter', '@yeisme/dsh-client-ui-pane-workbench',
  'exec', 'vitest', 'run', ...testFiles,
], {
  cwd: projectRoot,
  encoding: 'utf8',
  env: process.env,
})

const stdout = redact(result.stdout ?? '')
const stderr = redact(result.stderr ?? result.error?.message ?? '')
const exitCode = result.status ?? 1
const finishedAt = new Date()
const status = exitCode === 0 ? 'passed' : 'failed'
const p95Match = stdout.match(/p95=([0-9.]+)ms/)

writeFileSync(resolve(evidenceDir, 'stdout.log'), stdout)
writeFileSync(resolve(evidenceDir, 'stderr.log'), stderr)
writeFileSync(resolve(evidenceDir, 'artifacts/stage-matrix.json'), `${JSON.stringify({
  stage_a: {
    viewports_px: [360, 560, 960],
    zoom: '200%',
    long_title: 'zh+en truncated, HTML not executed',
    locales: ['en', 'zh'],
    adjacent_pane_isolation: 'neighbor color/background/font unchanged',
    catalog_size: 5000,
    p95_ms: p95Match === null ? null : Number(p95Match[1]),
    p95_budget_ms: 100,
  },
  stage_b: {
    live_history_owner: false,
    adapter_contract: 'available/unavailable/contract_mismatch fixtures',
    live_query: 'not_verified',
    mock_query: exitCode === 0 ? 'verified' : 'not_verified',
  },
}, null, 2)}\n`)
writeFileSync(resolve(evidenceDir, 'summary.json'), `${JSON.stringify({
  schema_version: 'yeisme.integration_test_evidence.v1',
  project: 'agent/harness-plugins',
  run_id: runId,
  layer: 'component',
  command: publicCommand,
  status,
  exit_code: exitCode,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  evidence: {
    command: `${relativeEvidenceDir}/command.txt`,
    stdout: `${relativeEvidenceDir}/stdout.log`,
    stderr: `${relativeEvidenceDir}/stderr.log`,
    env: `${relativeEvidenceDir}/env.json`,
    artifacts: `${relativeEvidenceDir}/artifacts`,
  },
  redaction: {
    enabled: true,
    policy: 'yeisme.integration-test-redaction.v1',
  },
  notes: {
    live_history_owner: 'not_probed',
    live_history_query: 'not_verified',
  },
}, null, 2)}\n`)

process.stdout.write(`integration evidence: ${relativeEvidenceDir}\n`)
if (stdout.length > 0) process.stdout.write(stdout)
if (stderr.length > 0) process.stderr.write(stderr)
process.exitCode = exitCode
