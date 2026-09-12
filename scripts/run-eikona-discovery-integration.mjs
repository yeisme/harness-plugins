// Eikona Go-to-Host discovery integration evidence, following the existing focused runner format.
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const startedAt = new Date()
const runId = `eikona-discovery-${startedAt.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}Z-${process.pid}`
const evidenceDir = resolve(projectRoot, 'temp/integration-test-runs', runId)
const relativeEvidenceDir = relative(projectRoot, evidenceDir)
const commands = [
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-creator-studio', 'exec', 'vitest', 'run', 'tests/eikona-image-comparison.spec.tsx', 'tests/eikona-image-preview.spec.tsx', 'tests/eikona-asset-browser.spec.tsx', 'tests/eikona-candidate-review.spec.tsx', 'tests/action-composer.spec.tsx']],
  ['pnpm', ['--filter', '@yeisme/dsh-creator-studio-host', 'exec', 'vitest', 'run', 'tests/eikona-selection-adapter.spec.ts', 'tests/eikona-discovery.integration.spec.ts']],
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
  browser: process.argv.includes('--browser'),
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
  const result = spawnSync(binary, args, { cwd: projectRoot, encoding: 'utf8', env: { ...process.env, EIKONA_DISCOVERY_BROWSER: process.argv.includes('--browser') ? '1' : '0', EIKONA_DISCOVERY_EVIDENCE: evidenceDir } })
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
  change: 'dsh-eikona-discovery',
  startedAt: startedAt.toISOString(),
  finishedAt: new Date().toISOString(),
  status: exitCode === 0 ? 'passed' : 'failed',
  exitCode,
  steps,
  evidenceDir: relativeEvidenceDir,
  notes: [
    process.argv.includes('--browser') ? 'Browser adoption mounts actual DSH Connection and API Gateway client sources, establishes a WebSocket-backed connection generation, and sends direct HTTP RPC without an exposed dispatch bridge. Production ModuleLoader/profile is not covered; the earlier asset preview path still uses its read-only test bridge.' : 'Browser path was not requested.',
    'Adoption registers the installation bundle contribution in the staged Typert registry and invokes selection/dispatch through the actual Typert Gateway.',
    'Actual Remote HTTP checks an in-memory browser session cookie, 401 rejection without selection change, RPC correlation, selection and adoption. No live credentials are used.',
    'Actual Eikona Go DiscoveryAt plus mounted owner HTTP handler consumed by TypeScript Host; Phase A digest compatibility and tamper rejection.',
    'Local fixture HTTP connectivity verified; does not verify full serve middleware, live authorization, production adapter registration, or paid image generation.',
  ],
}, null, 2)}\n`)

console.log(`[eikona-discovery] status=${exitCode === 0 ? 'passed' : 'failed'} exit=${exitCode}`)
console.log(`evidence: ${relativeEvidenceDir}`)
process.exitCode = exitCode
