#!/usr/bin/env node

/**
 * Ordo 统一 package 的官方 CLI 冒烟证据 harness。
 *
 * 覆盖 dsh-plugin-package-consolidation-v1 / dsh-plugin-ecosystem-consolidation-v1 /
 * dsh-ordo-command-interaction-v1 三个 change 的可本地复验部分：
 * 1. focused gates：unified package typecheck/build/test + 三个 rc.7 shim test + check:bundles；
 * 2. 官方 dsh CLI 冒烟：sandbox DSH_HOME 内 `plugin --profile web add`（绝对路径本地包）、
 *    `--dump-config`（单一 ordo root row、无 unresolved/重复 row、无旧 leaf row）与 web profile boot；
 * 3. 外部 owner blocker 探针：composition package 在 npm registry 是否仍 404。
 *
 * 本 harness 不构成 5.2/2.2 的 clean-profile 验收：`@yeisme/dsh-ordo-agent-ops` 与
 * `@yeisme/dsh-agent-composition-preview` 均未发布到 npm，npm 规格安装与独立 composition row
 * 仍由外部 owner 阻塞；此处只证明官方 CLI 路径与当前 patch 形态兼容。
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const projectRoot = resolve(import.meta.dirname, '..')
const unifiedPackage = join(projectRoot, 'packages/bundle/ordo-agent-ops')
const startedAt = new Date()
const runId = `dsh-ordo-official-cli-smoke-${startedAt.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z')}-${process.pid}`
const evidenceDir = join(projectRoot, 'temp', 'integration-test-runs', runId)
const artifactsDir = join(evidenceDir, 'artifacts')
const dshHome = join(tmpdir(), `dsh-ordo-smoke-${process.pid}-${Date.now()}`)
mkdirSync(artifactsDir, { recursive: true })

const resolvedDsh = spawnSync('which', ['dsh'], { encoding: 'utf8' }).stdout?.trim()
if (!resolvedDsh) throw new Error('dsh executable is not available for the official CLI smoke runner')

const redact = value => String(value)
  .replaceAll(projectRoot, '[PROJECT_ROOT]')
  .replaceAll(dshHome, '[TEMP_DSH_HOME]')
  .replaceAll(homedir(), '[USER_HOME]')
  .replace(/(authorization|token|password|cookie|secret)\s*[:=]\s*\S+/gi, '$1=[REDACTED]')

const checks = []
let stdoutLog = ''
let stderrLog = ''
let exitCode = 0

function runCheck(id, command, { expectedExit = 0, env = {}, timeout, assert } = {}) {
  const display = [command[0], ...command.slice(1)].join(' ')
  const result = spawnSync(command[0], command.slice(1), {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 32 * 1024 * 1024,
    ...(timeout === undefined ? {} : { timeout }),
  })
  const actualExit = result.error === undefined ? result.status ?? 1 : result.error.code === 'ETIMEDOUT' ? 'timeout' : 127
  const out = redact(result.stdout ?? '')
  const err = redact(result.stderr ?? result.error?.message ?? '')
  let status = actualExit === expectedExit ? 'passed' : 'failed'
  let message
  if (status === 'passed' && typeof assert === 'function') {
    try { assert(out, err, actualExit, result) } catch (error) {
      status = 'failed'
      message = error instanceof Error ? error.message : String(error)
    }
  }
  const check = { id, command: redact(display), expected_exit: expectedExit, actual_exit: actualExit, status, ...(message === undefined ? {} : { message }) }
  checks.push(check)
  stdoutLog += `$ ${redact(display)} (expected exit ${expectedExit})\n${out}`
  stderrLog += `$ ${redact(display)} (expected exit ${expectedExit})\n${err}${message === undefined ? '' : `\n${redact(message)}\n`}`
  if (check.status === 'failed' && exitCode === 0) exitCode = actualExit === 'timeout' ? 124 : (actualExit || 1)
  return { ...check, stdout: out, stderr: err, result }
}

function requireText(haystack, needles, label) {
  for (const needle of needles) {
    if (!haystack.includes(needle)) throw new Error(`${label} missing ${JSON.stringify(needle)}`)
  }
}

function forbidText(haystack, needles, label) {
  for (const needle of needles) {
    if (haystack.includes(needle)) throw new Error(`${label} unexpectedly contains ${JSON.stringify(needle)}`)
  }
}

// ---- 1. focused gates（当前 HEAD 上的实现状态复核）----

runCheck('unified-typecheck', ['pnpm', '--filter', '@yeisme/dsh-ordo-agent-ops', 'run', 'typecheck'])
runCheck('unified-build', ['pnpm', '--filter', '@yeisme/dsh-ordo-agent-ops', 'run', 'build'])
runCheck('unified-test', ['pnpm', '--filter', '@yeisme/dsh-ordo-agent-ops', 'run', 'test'])
runCheck('shim-ordo-commands-test', ['pnpm', '--filter', '@yeisme/dsh-host-ordo-commands', 'run', 'test'])
runCheck('shim-host-ordo-agent-ops-test', ['pnpm', '--filter', '@yeisme/dsh-host-ordo-agent-ops', 'run', 'test'])
runCheck('shim-ui-ordo-agent-ops-test', ['pnpm', '--filter', '@yeisme/dsh-client-ui-ordo-agent-ops', 'run', 'test'])
runCheck('check-bundles', ['pnpm', 'run', 'check:bundles'])

// ---- 2. 官方 CLI 冒烟（sandbox DSH_HOME，绝对路径本地包）----

const dshEnv = { DSH_HOME: dshHome }

runCheck('dsh-version', ['dsh', '--version'], { env: dshEnv, assert: out => { writeFileSync(join(artifactsDir, 'dsh-version.txt'), out) } })

runCheck(
  'dsh-plugin-add-local-path',
  ['dsh', 'plugin', '--profile', 'web', 'add', unifiedPackage],
  {
    env: dshEnv,
    timeout: 300_000,
    assert: (out, err) => {
      forbidText(err, ['ERR_', 'ELIFECYCLE', 'MISSING'], 'plugin add stderr')
      const profileManifest = readFileSync(join(dshHome, 'profiles/web/package.json'), 'utf8')
      requireText(profileManifest, ['@yeisme/dsh-ordo-agent-ops'], 'profile manifest dependency')
      const bundles = JSON.parse(profileManifest).dsh?.profile?.bundles ?? []
      if (!bundles.includes('@yeisme/dsh-ordo-agent-ops')) throw new Error('unified package did not join dsh.profile.bundles layer stack')
      writeFileSync(join(artifactsDir, 'profile-manifest.json'), JSON.stringify(JSON.parse(profileManifest), null, 2))
    },
  },
)

runCheck(
  'dsh-dump-config',
  ['dsh', '--profile', 'web', '--dump-config'],
  {
    env: dshEnv,
    timeout: 120_000,
    assert: out => {
      writeFileSync(join(artifactsDir, 'dump-config.yml'), out)
      requireText(out, ["# == @yeisme/dsh-ordo-agent-ops", "- id: ordo-agent-ops"], 'dump-config unified row')
      const rowMatches = out.match(/^- id: ordo-agent-ops$/gm) ?? []
      if (rowMatches.length !== 1) throw new Error(`expected exactly one ordo-agent-ops row, found ${rowMatches.length}`)
      // 旧 leaf shim 不得作为 profile row 出现；unresolved/error 标记不得出现。
      forbidText(out, ['@yeisme/dsh-host-ordo-agent-ops', '@yeisme/dsh-host-ordo-commands', '@yeisme/dsh-client-ui-ordo-agent-ops', 'unresolved', 'agent-composition-preview'], 'dump-config rows')
    },
  },
)

runCheck(
  'dsh-web-boot-smoke',
  ['dsh', '--profile', 'web'],
  {
    env: dshEnv,
    timeout: 45_000,
    expectedExit: 'timeout',
    // boot 是常驻进程：45s 超时 SIGTERM 属预期；判定标准是 banner 出现且无插件加载失败。
    assert: (out, err) => {
      requireText(out, ['dsh web: http://127.0.0.1:'], 'web boot banner')
      forbidText((out + err).toLowerCase(), ['ordo-agent-ops', 'loadfail', 'cannot resolve', 'enoent'], 'web boot diagnostics')
    },
  },
)

// ---- 3. 外部 owner blocker 探针 ----

const blockerProbe = async () => {
  const results = {}
  for (const name of ['@yeisme/dsh-agent-composition-preview', '@yeisme/dsh-ordo-agent-ops']) {
    const url = `https://registry.npmjs.org/${name.replaceAll('/', '%2F')}`
    try {
      const response = await fetch(url, { method: 'GET' })
      results[name] = { registryUrl: url, httpStatus: response.status, exists: response.ok }
    } catch (error) {
      results[name] = { registryUrl: url, error: String(error) }
    }
  }
  return results
}

const blockers = await blockerProbe()
writeFileSync(join(artifactsDir, 'blockers.json'), JSON.stringify({ probedAt: new Date().toISOString(), probes: blockers }, null, 2))
// composition package 仍 404 是本 harness 的前提（若已发布，5.2/2.2 应转入正式 clean-profile 验收）。
if (blockers['@yeisme/dsh-agent-composition-preview']?.exists) {
  checks.push({ id: 'composition-owner-published', command: 'registry probe', expected_exit: 404, actual_exit: 200, status: 'failed', message: 'composition package is now published; run the full clean-profile acceptance instead of this smoke' })
  if (exitCode === 0) exitCode = 1
}

// ---- 收尾：证据目录 + 沙盒清理 ----

const finishedAt = new Date()
const summary = {
  runId,
  change: 'dsh-plugin-package-consolidation-v1 + dsh-plugin-ecosystem-consolidation-v1 + dsh-ordo-command-interaction-v1 (blocker recheck + official CLI smoke)',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  status: exitCode === 0 ? 'passed' : 'failed',
  exitCode,
  checks,
  scope: {
    included: 'focused gates; official dsh CLI local-path plugin add; --dump-config single unified Ordo row; web profile boot smoke; npm registry blocker probes',
    excluded: 'npm-spec clean install (packages unpublished); independent composition row (external owner); browser Playwright surface evidence; ordo.agent_qualify.request action (not opened)',
  },
}
writeFileSync(join(evidenceDir, 'summary.json'), JSON.stringify(summary, null, 2))
writeFileSync(join(evidenceDir, 'command.txt'), checks.map(check => check.command).join('\n') + '\n')
writeFileSync(join(evidenceDir, 'stdout.log'), stdoutLog)
writeFileSync(join(evidenceDir, 'stderr.log'), stderrLog)
writeFileSync(join(evidenceDir, 'env.json'), JSON.stringify({
  node: process.version,
  dsh: resolvedDsh,
  platform: process.platform,
  arch: process.arch,
  ci: process.env.CI === 'true',
  timezone: 'UTC',
}, null, 2))

rmSync(dshHome, { recursive: true, force: true })

console.log(`evidence: ${evidenceDir}`)
console.log(`status: ${summary.status} (${checks.filter(c => c.status === 'passed').length}/${checks.length} checks passed)`)
process.exit(exitCode)
