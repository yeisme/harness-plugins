// Canvas storage integration evidence, following the existing focused runner format.
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const startedAt = new Date()
const runId = `project-canvas-storage-${startedAt.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}Z-${process.pid}`
const evidenceDir = resolve(projectRoot, 'temp/integration-test-runs', runId)
const relativeEvidenceDir = relative(projectRoot, evidenceDir)
const commands = [
  ['pnpm', ['--filter', '@yeisme/dsh-creator-studio-host', 'exec', 'vitest', 'run', 'tests/project-canvas-storage.integration.spec.ts', 'tests/eikona-draft-storage.integration.spec.ts']],
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
  change: 'dsh-project-canvas-storage',
  startedAt: startedAt.toISOString(),
  finishedAt: new Date().toISOString(),
  status: exitCode === 0 ? 'passed' : 'failed',
  exitCode,
  steps,
  evidenceDir: relativeEvidenceDir,
  notes: [
    'Real DSH staging storage-domain and JSON backend; fixture canvas, actual disk save and fresh Context remount.',
    'Does not verify browser interaction, production profile, domain owners, or multi-process writes.',
  ],
}, null, 2)}\n`)

console.log(`[project-canvas-storage] status=${exitCode === 0 ? 'passed' : 'failed'} exit=${exitCode}`)
console.log(`evidence: ${relativeEvidenceDir}`)
process.exitCode = exitCode
