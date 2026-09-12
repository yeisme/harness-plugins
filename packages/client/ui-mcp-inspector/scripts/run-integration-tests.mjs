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
const host = process.argv.includes('--host')
const testPackage = host ? '@yeisme/dsh-tool-hub-host' : '@yeisme/dsh-client-ui-mcp-inspector'
const testFiles = host ? ['tests/loader-composition.spec.ts', 'tests/gateway.spec.ts', 'tests/service.spec.ts', 'tests/reference-reader.spec.ts', 'tests/reference-reader.owner.spec.ts', 'tests/session-catalog-scope.owner.spec.ts'] : ['tests/pane.test.tsx', 'tests/remote.test.ts', 'tests/session-catalog.test.ts', 'tests/apply.test.ts', 'tests/installed-search-source.test.ts', 'tests/search-owner-integration.test.ts', 'tests/skill-document-reader.test.tsx', 'tests/session-search-source.test.ts']
const command = `pnpm --filter ${testPackage} exec vitest run ${testFiles.join(' ')}`

function redact(input) {
  return input.replaceAll(projectRoot, '.')
    .replace(/(authorization\s*[:=]\s*)([^\s]+)/gi, '$1[REDACTED]')
    .replace(/((?:token|password|cookie|secret)\s*[:=]\s*)([^\s]+)/gi, '$1[REDACTED]')
    .replace(/(raw[_ -]?prompt\s*[:=]\s*)(.+)$/gim, '$1[REDACTED]')
}

mkdirSync(resolve(evidenceDir, 'artifacts'), { recursive: true })
writeFileSync(resolve(evidenceDir, 'command.txt'), `${command}\n`)
writeFileSync(resolve(evidenceDir, 'env.json'), `${JSON.stringify({
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  ci: process.env.CI === 'true',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
}, null, 2)}\n`)

const result = spawnSync('pnpm', [
  '--filter', testPackage,
  'exec', 'vitest', 'run', ...testFiles,
], {
  cwd: projectRoot,
  encoding: 'utf8',
  env: { ...process.env, ...(host ? { DSH_REFERENCE_READER_ARTIFACTS: resolve(evidenceDir, 'artifacts/skill-reader') } : {}) },
})

const stdout = redact(result.stdout ?? '')
const stderr = redact(result.stderr ?? result.error?.message ?? '')
const exitCode = result.status ?? 1
const finishedAt = new Date()
const status = exitCode === 0 ? 'passed' : 'failed'

writeFileSync(resolve(evidenceDir, 'stdout.log'), stdout)
writeFileSync(resolve(evidenceDir, 'stderr.log'), stderr)
writeFileSync(resolve(evidenceDir, 'summary.json'), `${JSON.stringify({
  schema_version: 'yeisme.integration_test_evidence.v1',
  project: 'agent/harness-plugins',
  run_id: runId,
  layer: 'integration',
  command,
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
}, null, 2)}\n`)

process.stdout.write(`integration evidence: ${relativeEvidenceDir}\n`)
if (stdout.length > 0) process.stdout.write(stdout)
if (stderr.length > 0) process.stderr.write(stderr)
process.exitCode = exitCode
