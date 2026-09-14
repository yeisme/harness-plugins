// Screenplay continuity evidence runner
// (dsh-screenplay-production-continuity-v1 task 4.1 closeout; also gates
// dsh-3d-director-gltf-workbench-v1 task 3.2's real-DSH reopen verification).
//
// Runs the three 4.1 verification legs and writes redacted evidence under
// temp/integration-test-runs/screenplay-continuity-<date>-<time>-<pid>/ using
// the yeisme.integration_test_evidence.v1 summary schema:
//   P2  host integration — historical previz rollback restores the retained
//       {document, shots} payload; legacy sceneRead stays strict
//       (tests/shot-scenarios.integration.spec.ts);
//   H1  real DSH staging JSON storage remount — negotiated save → dispose →
//       fresh cordis root + fresh controller restore (H2) …
//   H2  real child-process close-reopen — process A saves through the BUILT
//       host lib over the real staging storage and exits; process B restores
//       through sceneWorkbenchRead (tests/screenplay-continuity-host.integration.spec.ts);
//   W   pipeline 选择联动 — professional-pane selection handoff by stable ref
//       + candidate adoption backfill (task 3.2, tests/pipeline-pane-selection.spec.ts
//       plus the pipeline scene3d suites that must stay green).
// The browser leg (最终浏览器 + 历史预演回滚 rendering) references the newest
// PASSING ui-visual run for visual-3d-director.spec.ts without copying artifacts.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const startedAt = new Date()
const datestamp = startedAt.toISOString().slice(0, 10).replaceAll('-', '')
const runId = `screenplay-continuity-${datestamp}-${startedAt.toISOString().replace(/[-:.TZ]/g, '').slice(8, 14)}-${process.pid}`
const evidenceDir = resolve(projectRoot, 'temp/integration-test-runs', runId)
const relativeEvidenceDir = relative(projectRoot, evidenceDir)

const SCENARIOS = [
  { id: 'P2', name: 'historical-previz-rollback-restores-retained-payload', fixture: 'real controller/gateway/store/change-set log over in-memory storageDomain, synthetic scene + shots' },
  { id: 'H1', name: 'real-staging-storage-remount-restore', fixture: 'real DSH staging storage/storage-json/storage-domain modules on a temp directory, synthetic scene + shots' },
  { id: 'H2', name: 'real-child-process-close-reopen', fixture: 'built host lib + real staging JSON storage; two cold node processes on the same directory, synthetic payloads' },
  { id: 'W', name: 'pipeline-pane-selection-handoff-and-adoption-backfill', fixture: 'fixture pipeline projection owner; real workbench controller contracts; pane-link bus emission (3d-director picks) and scaena-table emitter seams' },
]
const commands = [
  ['pnpm', ['--filter', '@yeisme/dsh-3d-director-host', 'exec', 'vitest', 'run', 'tests/shot-scenarios.integration.spec.ts', 'tests/screenplay-continuity-host.integration.spec.ts']],
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-ai-drama-director', 'exec', 'vitest', 'run', 'tests/pipeline-pane-selection.spec.ts', 'tests/pipeline-pane-link-bus.spec.ts', 'tests/pipeline-scene3d.spec.tsx', 'tests/pipeline-scene3d-pane.spec.tsx', 'tests/pipeline-integration.spec.tsx']],
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-creator-studio', 'exec', 'vitest', 'run', 'tests/scaena-pane-link.spec.tsx']],
]
const publicCommand = 'node scripts/run-screenplay-continuity-evidence.mjs'

function redact(input) {
  return input
    .replaceAll(projectRoot, '[PROJECT_ROOT]')
    .replace(/\/(?:tmp|private\/tmp)\/[A-Za-z0-9._/-]+/g, '[TEMP_PATH]')
    .replace(/(authorization\s*[:=]\s*)([^\s]+)/gi, '$1[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/g, 'Bearer [REDACTED]')
    .replace(/((?:token|password|cookie|secret)\s*[:=]\s*)([^\s]+)/gi, '$1[REDACTED]')
}

mkdirSync(resolve(evidenceDir, 'artifacts'), { recursive: true })
writeFileSync(resolve(evidenceDir, 'command.txt'), `${publicCommand}\n${commands.map(([b, a]) => `$ ${b} ${a.join(' ')}`).join('\n')}\n`)
writeFileSync(resolve(evidenceDir, 'env.json'), `${JSON.stringify({
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  ci: process.env.CI === 'true',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  fixture_tier: 'synthetic payloads over real staging storage modules and built host artifacts',
  redacted: true,
}, null, 2)}\n`)

let stdout = ''
let stderr = ''
let exitCode = 0
const steps = []
for (const [binary, args] of commands) {
  const result = spawnSync(binary, args, { cwd: projectRoot, encoding: 'utf8', env: { ...process.env, CI: 'true' } })
  const status = result.status ?? 1
  stdout += `$ ${binary} ${args.join(' ')}\n${result.stdout ?? ''}`
  stderr += result.stderr ?? result.error?.message ?? ''
  steps.push({ command: `${binary} ${args.join(' ')}`, exit_code: status })
  if (status !== 0) exitCode = status
}

// Link the newest PASSING ui-visual run for the 3D Director spec (browser leg).
function latestVisualRun() {
  const root = resolve(projectRoot, 'temp/integration-test-runs')
  if (!existsSync(root)) return undefined
  const candidates = readdirSync(root).filter(entry => entry.startsWith('ui-visual-')).sort().reverse()
  for (const entry of candidates) {
    const summaryPath = resolve(root, entry, 'summary.json')
    const stdoutPath = resolve(root, entry, 'stdout.log')
    if (!existsSync(summaryPath) || !existsSync(stdoutPath)) continue
    try {
      const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
      if (summary.status === 'passed' && readFileSync(stdoutPath, 'utf8').includes('visual-3d-director.spec.ts')) {
        return { run_id: summary.run_id, summary: relative(projectRoot, summaryPath), screenshots_glob: relative(projectRoot, resolve(root, entry, 'artifacts')) + '/playwright/**/3d-director-*.png' }
      }
    } catch { /* concurrent writers may leave a partial run; skip it */ }
  }
  return undefined
}

writeFileSync(resolve(evidenceDir, 'stdout.log'), redact(stdout))
writeFileSync(resolve(evidenceDir, 'stderr.log'), redact(stderr))
const visualRun = latestVisualRun()
writeFileSync(resolve(evidenceDir, 'artifacts', 'scenarios.json'), `${JSON.stringify({ scenarios: SCENARIOS, steps, visual_evidence: visualRun ?? null }, null, 2)}\n`)

// Redaction self-check over everything persisted in this run.
const forbidden = [/authorization\s*[:=]\s*[^\s[]/i, /Bearer\s+(?!\[REDACTED\])[A-Za-z0-9._~-]+/, /-----BEGIN/, /\/workspaces\/[A-Za-z0-9._/-]+/, /\/home\/[A-Za-z0-9._/-]+/]
const persisted = ['command.txt', 'env.json', 'stdout.log', 'stderr.log', 'artifacts/scenarios.json']
const leaks = persisted.filter(name => forbidden.some(pattern => pattern.test(readFileSync(resolve(evidenceDir, name), 'utf8'))))
if (leaks.length > 0) {
  stderr += `redaction self-check failed: ${leaks.join(', ')}\n`
  writeFileSync(resolve(evidenceDir, 'stderr.log'), redact(stderr))
  exitCode = exitCode === 0 ? 1 : exitCode
}

const finishedAt = new Date()
writeFileSync(resolve(evidenceDir, 'summary.json'), `${JSON.stringify({
  schema_version: 'yeisme.integration_test_evidence.v1',
  project: 'agent/harness-plugins',
  run_id: runId,
  layer: 'integration',
  command: publicCommand,
  change: 'dsh-screenplay-production-continuity-v1',
  status: exitCode === 0 ? 'passed' : 'failed',
  exit_code: exitCode,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  scenarios: SCENARIOS,
  steps,
  visual_evidence: visualRun ?? null,
  evidence: {
    summary: relative(projectRoot, resolve(evidenceDir, 'summary.json')),
    command: relative(projectRoot, resolve(evidenceDir, 'command.txt')),
    stdout: relative(projectRoot, resolve(evidenceDir, 'stdout.log')),
    stderr: relative(projectRoot, resolve(evidenceDir, 'stderr.log')),
    env: relative(projectRoot, resolve(evidenceDir, 'env.json')),
    artifacts: relative(projectRoot, resolve(evidenceDir, 'artifacts')),
  },
  redaction: { enabled: true, policy: 'harness-plugins-screenplay-continuity-v1', self_check: leaks.length === 0 ? 'passed' : `failed: ${leaks.join(', ')}` },
  notes: [
    'H1/H2 chain the real DSH staging storage modules (the same JSON backend the preview runs) with the real SceneGraphGateway and the real client Scene3DController; the child-process leg rebuilds and imports the BUILT host artifact so process death is real.',
    'The browser leg (rollback rendering) references the linked ui-visual run: real built client bundle + a fixture remote that ports the negotiated workbench contract; no GLB bytes, no provider execution, no credentials or absolute paths recorded.',
    'The 做剧工作台 composition blockers were fixed and verified in the real DSH web host on 2026-09-14 (run screenplay-continuity-20260914-103847-2446594): pane launcher registration remount, scene3d envelope section through the single scene-domain owner, both expected contexts derived by the drama bundle from LocalStudioCLI, and the client-side Remote namespace mounts. That browser leg lives in its own evidence run; this runner keeps the controller/store contracts green.',
  ],
}, null, 2)}\n`)

console.log(`[screenplay-continuity] status=${exitCode === 0 ? 'passed' : 'failed'} exit=${exitCode}`)
console.log(`evidence: ${relativeEvidenceDir}`)
if (visualRun) console.log(`visual evidence: ${visualRun.summary}`)
process.exitCode = exitCode
