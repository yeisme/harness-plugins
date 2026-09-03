// Selection Interaction V2 集成证据 harness：跑拥有切片的 focused checks +
// bundle smoke，写六件套脱敏证据到 temp/integration-test-runs/<run-id>/。
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const startedAt = new Date()
const runId = `selection-interaction-v2-${startedAt.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}Z-${process.pid}`
const evidenceDir = resolve(projectRoot, 'temp/integration-test-runs', runId)
const relativeEvidenceDir = relative(projectRoot, evidenceDir)
const commands = [
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-interaction-space', 'run', 'typecheck']],
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-interaction-space', 'run', 'test']],
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-selection-annotation', 'run', 'typecheck']],
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-selection-annotation', 'run', 'test']],
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-pane-workbench', 'exec', 'vitest', 'run', 'tests/selection-interaction-designer.spec.tsx']],
  ['pnpm', ['--filter', '@yeisme/dsh-selection-annotation', 'run', 'test']],
  ['pnpm', ['--filter', '@yeisme/dsh-interaction-space', 'run', 'test']],
  ['pnpm', ['run', 'check:bundles']],
  ['openspec', ['validate', 'dsh-selection-interaction-v2', '--strict', '--no-interactive']],
]

function redact(input) {
  return input
    .replaceAll(projectRoot, '[PROJECT_ROOT]')
    .replace(/\/(?:tmp|private\/tmp)\/[A-Za-z0-9._/-]+/g, '[TEMP_PATH]')
    .replace(/(authorization\s*[:=]\s*)([^\s]+)/gi, '$1[REDACTED]')
    .replace(/((?:token|password|cookie|secret)\s*[:=]\s*)([^\s]+)/gi, '$1[REDACTED]')
}

mkdirSync(resolve(evidenceDir, 'artifacts'), { recursive: true })
writeFileSync(resolve(evidenceDir, 'command.txt'), `${commands.map(([b, a]) => `${b} ${a.join(' ')}`).join('\n')}\n`)
writeFileSync(resolve(evidenceDir, 'env.json'), `${JSON.stringify({
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  ci: process.env.CI === 'true',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
}, null, 2)}\n`)

let stdout = ''
let stderr = ''
let exitCode = 0
const steps = []
for (const [binary, args] of commands) {
  const result = spawnSync(binary, args, { cwd: projectRoot, encoding: 'utf8' })
  const status = result.status ?? 1
  stdout += `$ ${binary} ${args.join(' ')}\n${result.stdout ?? ''}`
  stderr += result.stderr ?? result.error?.message ?? ''
  steps.push({ command: `${binary} ${args.join(' ')}`, exitCode: status })
  if (status !== 0) exitCode = status
}

writeFileSync(resolve(evidenceDir, 'stdout.log'), redact(stdout))
writeFileSync(resolve(evidenceDir, 'stderr.log'), redact(stderr))
writeFileSync(resolve(evidenceDir, 'artifacts', 'steps.json'), `${JSON.stringify({ steps }, null, 2)}\n`)
writeFileSync(resolve(evidenceDir, 'summary.json'), `${JSON.stringify({
  runId,
  change: 'dsh-selection-interaction-v2',
  startedAt: startedAt.toISOString(),
  finishedAt: new Date().toISOString(),
  status: exitCode === 0 ? 'passed' : 'failed',
  exitCode,
  steps,
  evidenceDir: relativeEvidenceDir,
  notes: [
    'focused slice gates: interaction-space (contracts/registry/normalizer/reducer/layer/preferences) + selection-annotation (unit+integration V2/V1 adapter) + designer section + bundle smokes',
    'jsdom coverage: stable→Actions→explicit action→typed intent→owner receipt; V1 adapter fallback + rollback keeps context; sensitive/opt-out exclusion; HMR/dispose symmetric release',
    'browser Playwright journeys (360/560/960px, dark/reduced-motion screenshots) remain in the V2 canary browser gate, per plugin-host-protocol not a plugin completion gate',
  ],
}, null, 2)}\n`)

console.log(`[selection-interaction-v2] status=${exitCode === 0 ? 'passed' : 'failed'} exit=${exitCode}`)
console.log(`evidence: ${relativeEvidenceDir}`)
process.exitCode = exitCode
