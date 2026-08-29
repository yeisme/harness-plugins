import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(packageRoot, '../../..')
const startedAt = new Date()
const runId = `${startedAt.toISOString().replace(/[:.]/g, '-')}-${process.pid}`
const evidenceDir = resolve(projectRoot, 'temp/integration-test-runs', runId)
const relativeEvidenceDir = relative(projectRoot, evidenceDir)
const command = 'pnpm --filter @yeisme/dsh-file-host exec vitest run tests/node.spec.ts'

function redact(input) {
  return input
    .replaceAll(projectRoot, '[PROJECT_ROOT]')
    .replace(/\/(?:tmp|private\/tmp)\/[A-Za-z0-9._/-]+/g, '[TEMP_PATH]')
    .replace(/(authorization\s*[:=]\s*)([^\s]+)/gi, '$1[REDACTED]')
    .replace(/((?:token|password|cookie|secret)\s*[:=]\s*)([^\s]+)/gi, '$1[REDACTED]')
    .replace(/(raw[_ -]?prompt\s*[:=]\s*)(.+)$/gim, '$1[REDACTED]')
}

mkdirSync(resolve(evidenceDir, 'artifacts'), { recursive: true })
writeFileSync(resolve(evidenceDir, 'command.txt'), `${command}\n`)
writeFileSync(resolve(evidenceDir, 'env.json'), `${JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, ci: process.env.CI === 'true', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }, null, 2)}\n`)

const result = spawnSync('pnpm', ['--filter', '@yeisme/dsh-file-host', 'exec', 'vitest', 'run', 'tests/node.spec.ts'], { cwd: projectRoot, encoding: 'utf8', env: process.env })
const stdout = redact(result.stdout ?? '')
const stderr = redact(result.stderr ?? result.error?.message ?? '')
const exitCode = result.status ?? 1
const finishedAt = new Date()

writeFileSync(resolve(evidenceDir, 'stdout.log'), stdout)
writeFileSync(resolve(evidenceDir, 'stderr.log'), stderr)
writeFileSync(resolve(evidenceDir, 'summary.json'), `${JSON.stringify({
  schema_version: 'yeisme.integration_test_evidence.v1', project: 'agent/harness-plugins', run_id: runId, layer: 'integration', command,
  status: exitCode === 0 ? 'passed' : 'failed', exit_code: exitCode, started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(), duration_ms: finishedAt.getTime() - startedAt.getTime(),
  evidence: { command: `${relativeEvidenceDir}/command.txt`, stdout: `${relativeEvidenceDir}/stdout.log`, stderr: `${relativeEvidenceDir}/stderr.log`, env: `${relativeEvidenceDir}/env.json`, artifacts: `${relativeEvidenceDir}/artifacts` },
  redaction: { enabled: true, policy: 'yeisme.integration-test-redaction.v1' },
}, null, 2)}\n`)
process.stdout.write(`integration evidence: ${relativeEvidenceDir}\n`)
if (stdout.length > 0) process.stdout.write(stdout)
if (stderr.length > 0) process.stderr.write(stderr)
process.exitCode = exitCode
