// 3D Director Shot-scenario integration evidence runner
// (dsh-3d-director-gltf-workbench-v1, tasks 4.2/4.4).
//
// Runs the three reproducible Shot scenarios (real client Scene3DController ↔
// real host SceneGraphGateway over an in-memory storageDomain seam) and writes
// redacted evidence to temp/integration-test-runs/3d-director-<date>-<pid>/
// using the yeisme.integration_test_evidence.v1 summary schema. When a passing
// ui-visual run for visual-3d-director.spec.ts exists, the manifest references
// it (task 4.3 screenshots) without copying artifacts.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const startedAt = new Date()
const datestamp = startedAt.toISOString().slice(0, 10).replaceAll('-', '')
const runId = `3d-director-${datestamp}-${startedAt.toISOString().replace(/[-:.TZ]/g, '').slice(8, 14)}-${process.pid}`
const evidenceDir = resolve(projectRoot, 'temp/integration-test-runs', runId)
const relativeEvidenceDir = relative(projectRoot, evidenceDir)

const SCENARIOS = [
  { id: 'P', name: 'previsualization-keyframes-save-remount-journal-recovery', fixture: 'real controller/gateway/store, in-memory storageDomain and commit-loss injection; no model execution' },
  { id: 'A', name: 'shot-anchored-open-scrub-step-sampling', fixture: 'SceneDocumentV1 + ShotV1 (translate/visibility keyframes) + CanvasBindingV1, synthetic' },
  { id: 'B', name: 'edit-save-conflict-freeze-reconcile', fixture: 'in-memory storageDomain + one-shot commit-loss injection, synthetic' },
  { id: 'C', name: 'glb-import-capability-report-export-blocked', fixture: 'minimal valid GLB containers (clean + KHR_lights_punctual), synthetic' },
]
const commands = [
  ['pnpm', ['--filter', '@yeisme/dsh-3d-director-host', 'exec', 'vitest', 'run', 'tests/shot-scenarios.integration.spec.ts']],
]
const withPipeline = process.argv.includes('--pipeline')
if (withPipeline) {
  commands.push(['pnpm', ['--filter', '@yeisme/dsh-client-ui-ai-drama-director', 'exec', 'vitest', 'run', 'tests/pipeline-integration.spec.tsx']])
  SCENARIOS.push({ id: 'W', name: 'pipeline-single-canvas-owner-save-reopen', fixture: 'real canvas application store with in-memory storage and synthetic pipeline snapshot' })
}
const publicCommand = `node scripts/run-3d-director-integration.mjs${withPipeline ? ' --pipeline' : ''}`

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
  fixture_tier: 'synthetic',
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

// Link the newest PASSING ui-visual evidence for the 3D Director spec (4.3).
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
  change: 'dsh-3d-director-gltf-workbench-v1',
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
  redaction: { enabled: true, policy: 'harness-plugins-3d-director-v1', self_check: leaks.length === 0 ? 'passed' : `failed: ${leaks.join(', ')}` },
  notes: [
    'Real Scene3DController ↔ SceneGraphGateway chaining over an in-memory storageDomain seam; the only injected fault is a one-shot commit loss in scenario B.',
    'GLB fixtures are minimal valid containers built in-test; no credentials, prompts, provider payloads, or absolute paths are recorded.',
    'Does not verify the WebGL viewport path (package tests + visual spec fallback tree cover the selection contract), the production profile, or multi-process writes.',
  ],
}, null, 2)}\n`)

console.log(`[3d-director] status=${exitCode === 0 ? 'passed' : 'failed'} exit=${exitCode}`)
console.log(`evidence: ${relativeEvidenceDir}`)
if (visualRun) console.log(`visual evidence: ${visualRun.summary}`)
process.exitCode = exitCode
