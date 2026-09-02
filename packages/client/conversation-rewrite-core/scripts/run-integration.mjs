import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { cp, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(packageRoot, '../../..')
const startedAt = new Date()
const runId = `conversation-rewrite-core-v2-${startedAt.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}Z-${process.pid}`
const evidenceDir = resolve(projectRoot, 'temp/integration-test-runs', runId)
const relativeEvidenceDir = relative(projectRoot, evidenceDir)
const commands = [
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-conversation-rewrite-core', 'run', 'typecheck']],
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-conversation-rewrite-core', 'run', 'test']],
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-conversation-rewrite', 'run', 'test']],
  ['pnpm', ['--filter', '@yeisme/dsh-client-ui-conversation-rewrite', 'run', 'test:integration']],
]

function redact(input) {
  return input
    .replaceAll(projectRoot, '[PROJECT_ROOT]')
    .replace(/\/(?:tmp|private\/tmp)\/[A-Za-z0-9._/-]+/g, '[TEMP_PATH]')
    .replace(/(authorization\s*[:=]\s*)([^\s]+)/gi, '$1[REDACTED]')
    .replace(/((?:token|password|cookie|secret)\s*[:=]\s*)([^\s]+)/gi, '$1[REDACTED]')
}

mkdirSync(resolve(evidenceDir, 'artifacts'), { recursive: true })
const commandText = commands.map(([binary, args]) => `${binary} ${args.join(' ')}`).join('\n')
writeFileSync(resolve(evidenceDir, 'command.txt'), `${commandText}\n`)
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
for (const [binary, args] of commands) {
  const result = spawnSync(binary, args, { cwd: projectRoot, encoding: 'utf8' })
  stdout += `$ ${binary} ${args.join(' ')}\n${result.stdout ?? ''}`
  stderr += result.stderr ?? result.error?.message ?? ''
  if ((result.status ?? 1) !== 0) exitCode = result.status ?? 1
}

// ── pack canary：验证 files/exports/tarball 完整性并记录 digest 供 dsh-tui 消费 ──
const canary = { status: 'skipped' }
try {
  const packDir = await mkdtemp(join(tmpdir(), 'rrc-pack-'))
  const packResult = spawnSync('pnpm', ['pack', `--pack-destination`, packDir], { cwd: packageRoot, encoding: 'utf8' })
  stdout += `$ pnpm pack (canary)\n${packResult.stdout ?? ''}`
  stderr += packResult.stderr ?? ''
  const tarballName = readdirSync(packDir).find((name) => name.endsWith('.tgz'))
  if (tarballName === undefined) throw new Error('pack produced no tarball')
  const tarballPath = join(packDir, tarballName)
  const digest = createHash('sha256').update(readFileSync(tarballPath)).digest('hex')
  const pkg = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'))
  const requiredFiles = ['lib/index.js', 'lib/testing.js', 'lib/types/index.d.ts', 'lib/types/testing.d.ts', 'README.md']
  const listing = spawnSync('tar', ['-tzf', tarballPath], { encoding: 'utf8' })
  const entries = (listing.stdout ?? '').split('\n')
  const missing = requiredFiles.filter((file) => !entries.some((entry) => entry.endsWith(file)))
  if (missing.length > 0) throw new Error(`tarball missing files: ${missing.join(', ')}`)
  // 保留 tarball 副本到 evidence，供 dsh-tui 本地 consumer 验证使用
  await cp(tarballPath, resolve(evidenceDir, 'artifacts', tarballName))
  canary.status = 'ok'
  canary.package = pkg.name
  canary.version = pkg.version
  canary.tarball = tarballName
  canary.sha256 = digest
  canary.files = requiredFiles
  canary.sizeBytes = readFileSync(tarballPath).length
  rmSync(packDir, { recursive: true, force: true })
} catch (error) {
  canary.status = 'failed'
  canary.error = redact(String(error?.message ?? error))
  exitCode = exitCode === 0 ? 1 : exitCode
}

stdout = redact(stdout)
stderr = redact(stderr)
const finishedAt = new Date()
writeFileSync(resolve(evidenceDir, 'stdout.log'), stdout)
writeFileSync(resolve(evidenceDir, 'stderr.log'), stderr)
writeFileSync(resolve(evidenceDir, 'artifacts', 'canary.json'), `${JSON.stringify(canary, null, 2)}\n`)
writeFileSync(resolve(evidenceDir, 'summary.json'), `${JSON.stringify({
  schema_version: 'yeisme.integration_test_evidence.v1',
  project: 'agent/harness-plugins',
  run_id: runId,
  layer: 'integration',
  change: 'dsh-conversation-rewrite-core-v2',
  command: commandText,
  status: exitCode === 0 ? 'passed' : 'failed',
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  packages: ['@yeisme/dsh-client-ui-conversation-rewrite-core', '@yeisme/dsh-client-ui-conversation-rewrite'],
  pack_canary: canary,
  redaction: 'project root/absolute temp paths redacted; no prompt text recorded (fixtures use synthetic values only)',
}, null, 2)}\n`)

console.log(`[run-integration] status=${exitCode === 0 ? 'passed' : 'failed'} evidence=${relativeEvidenceDir}`)
process.exit(exitCode)
