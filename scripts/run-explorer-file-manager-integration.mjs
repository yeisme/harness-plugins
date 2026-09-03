// Canonical Explorer / references / file-resource integration evidence runner.
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const startedAt = new Date()
const runId = `dsh-explorer-file-manager-${startedAt.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}Z-${process.pid}`
const evidenceDir = resolve(projectRoot, 'temp/integration-test-runs', runId)
const relativeEvidenceDir = relative(projectRoot, evidenceDir)
const commands = [
  ['pnpm', ['--filter', '@yeisme/dsh-file-host', 'run', 'typecheck']],
  ['pnpm', ['--filter', '@yeisme/dsh-file-host', 'run', 'test']],
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-pane-workbench', 'run', 'typecheck']],
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-pane-workbench', 'exec', 'vitest', 'run', 'tests/explorer-v4.spec.tsx', 'tests/chrome-tokens.spec.ts']],
  ['pnpm', ['--filter', '@yeisme/dsh-file-document', 'run', 'test']],
  ['pnpm', ['--filter', '@yeisme/dsh-desktop-workbench', 'run', 'test']],
  ['pnpm', ['--filter', '@yeisme/dsh-workbench-compose', 'run', 'test']],
  ['pnpm', ['run', 'check:bundles']],
  ['openspec', ['validate', 'dsh-web-explorer-reference-v1', '--strict', '--no-interactive']],
  ['openspec', ['validate', 'dsh-file-resource-mutation-v1', '--strict', '--no-interactive']],
]

function redact(input) {
  return input
    .replaceAll(projectRoot, '[PROJECT_ROOT]')
    .replace(/\/(?:tmp|private\/tmp)\/[A-Za-z0-9._/-]+/g, '[TEMP_PATH]')
    .replace(/(authorization\s*[:=]\s*)([^\s]+)/gi, '$1[REDACTED]')
    .replace(/((?:token|password|cookie|secret|credential)\s*[:=]\s*)([^\s]+)/gi, '$1[REDACTED]')
    .replace(/(raw[_ -]?prompt\s*[:=]\s*)(.+)$/gim, '$1[REDACTED]')
}

mkdirSync(resolve(evidenceDir, 'artifacts'), { recursive: true })
writeFileSync(resolve(evidenceDir, 'command.txt'), `${commands.map(([binary, args]) => `${binary} ${args.join(' ')}`).join('\n')}\n`)
writeFileSync(resolve(evidenceDir, 'env.json'), `${JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, ci: process.env.CI === 'true', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }, null, 2)}\n`)

let stdout = ''
let stderr = ''
let exitCode = 0
const steps = []
for (const [binary, args] of commands) {
  const result = spawnSync(binary, args, { cwd: projectRoot, encoding: 'utf8', env: process.env })
  const status = result.status ?? 1
  stdout += `$ ${binary} ${args.join(' ')}\n${result.stdout ?? ''}`
  stderr += result.stderr ?? result.error?.message ?? ''
  steps.push({ command: `${binary} ${args.join(' ')}`, exitCode: status })
  if (status !== 0 && exitCode === 0) exitCode = status
}

const finishedAt = new Date()
writeFileSync(resolve(evidenceDir, 'stdout.log'), redact(stdout))
writeFileSync(resolve(evidenceDir, 'stderr.log'), redact(stderr))
writeFileSync(resolve(evidenceDir, 'artifacts', 'steps.json'), `${JSON.stringify({ steps }, null, 2)}\n`)
writeFileSync(resolve(evidenceDir, 'summary.json'), `${JSON.stringify({
  schema_version: 'yeisme.integration_test_evidence.v1',
  project: 'agent/harness-plugins',
  changes: ['dsh-web-explorer-reference-v1', 'dsh-file-resource-mutation-v1'],
  run_id: runId,
  layer: 'integration',
  status: exitCode === 0 ? 'passed' : 'failed',
  exit_code: exitCode,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  steps,
  evidence: { command: `${relativeEvidenceDir}/command.txt`, stdout: `${relativeEvidenceDir}/stdout.log`, stderr: `${relativeEvidenceDir}/stderr.log`, env: `${relativeEvidenceDir}/env.json`, artifacts: `${relativeEvidenceDir}/artifacts` },
  redaction: { enabled: true, policy: 'yeisme.integration-test-redaction.v1' },
}, null, 2)}\n`)

process.stdout.write(`[dsh-explorer-file-manager] status=${exitCode === 0 ? 'passed' : 'failed'} exit=${exitCode}\n`)
process.stdout.write(`evidence: ${relativeEvidenceDir}\n`)
process.exitCode = exitCode
