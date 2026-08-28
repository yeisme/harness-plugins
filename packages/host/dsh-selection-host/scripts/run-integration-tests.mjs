// 证据运行器：跑 node.spec.ts 并把脱敏输出落到仓库 temp/integration-test-runs/<run-id>/。
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
const command = 'pnpm --filter @yeisme/dsh-selection-host exec vitest run tests/node.spec.ts'

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

const result = spawnSync('pnpm', ['--filter', '@yeisme/dsh-selection-host', 'exec', 'vitest', 'run', 'tests/node.spec.ts'], { cwd: projectRoot, encoding: 'utf8', env: process.env })
const stdout = redact(result.stdout ?? '')
const stderr = redact(result.stderr ?? result.error?.message ?? '')
const exitCode = result.status ?? 1

writeFileSync(resolve(evidenceDir, 'stdout.txt'), stdout)
writeFileSync(resolve(evidenceDir, 'stderr.txt'), stderr)
writeFileSync(resolve(evidenceDir, 'summary.json'), `${JSON.stringify({ command, exitCode, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString() }, null, 2)}\n`)

console.log(`integration evidence: ${relativeEvidenceDir} (exit ${exitCode})`)
process.exit(exitCode)
