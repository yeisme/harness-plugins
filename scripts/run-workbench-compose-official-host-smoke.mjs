#!/usr/bin/env node

/**
 * dsh-workbench-compose 官方 Workbench/Pane 宿主冒烟证据 harness（compose 6.3）。
 *
 * 覆盖 dsh-workbench-compose-v1 任务 6.3 的可本地复验部分：
 * 1. focused gates：compose package typecheck/test/build；
 * 2. 官方 dsh CLI 冒烟：sandbox DSH_HOME 内 `plugin --profile web add`（绝对路径本地包）、
 *    `--dump-config`（单一 compose row、无 unresolved）与 web profile boot；
 * 3. 官方宿主面探针：从已安装官方 dsh 的内置 layout 类型面提取 `shell.workspace.*`
 *    slot 声明，证明本插件所探测的官方 Workbench/Pane 宿主 slot 在该运行时真实存在。
 *
 * 本 harness 不把 browser Playwright / 官方 `dsh web` 视觉面当作插件完成门（仓库公约）；
 * browser e2e 视觉证据仍属可选增强。真实 Host 数据投影（6.1）不在本 harness 范围。
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const projectRoot = resolve(import.meta.dirname, '..')
const composePackage = join(projectRoot, 'packages/bundle/dsh-workbench-compose')
const startedAt = new Date()
const runId = `dsh-workbench-compose-official-host-smoke-${startedAt.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z')}-${process.pid}`
const evidenceDir = join(projectRoot, 'temp', 'integration-test-runs', runId)
const artifactsDir = join(evidenceDir, 'artifacts')
const dshHome = join(tmpdir(), `dsh-compose-smoke-${process.pid}-${Date.now()}`)
mkdirSync(artifactsDir, { recursive: true })

const resolvedDsh = spawnSync('which', ['dsh'], { encoding: 'utf8' }).stdout?.trim()
if (!resolvedDsh) throw new Error('dsh executable is not available for the workbench compose official host smoke runner')

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
  const actualExit = result.error === undefined ? result.status ?? 1 : result.error.code === 'ETIMEDOUT' ? 'timeout' : result.error.code ?? 127
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

// ---- 1. focused gates ----

runCheck('compose-typecheck', ['pnpm', '--filter', '@yeisme/dsh-workbench-compose', 'run', 'typecheck'])
runCheck('compose-test', ['pnpm', '--filter', '@yeisme/dsh-workbench-compose', 'run', 'test'])
runCheck('compose-build', ['pnpm', '--filter', '@yeisme/dsh-workbench-compose', 'run', 'build'])

// ---- 2. 官方 CLI 冒烟（sandbox DSH_HOME，绝对路径本地包）----

const dshEnv = { DSH_HOME: dshHome }

runCheck('dsh-version', ['dsh', '--version'], { env: dshEnv, assert: out => { writeFileSync(join(artifactsDir, 'dsh-version.txt'), out) } })

runCheck(
  'dsh-plugin-add-local-path',
  ['dsh', 'plugin', '--profile', 'web', 'add', composePackage],
  {
    env: dshEnv,
    timeout: 300_000,
    assert: (out, err) => {
      forbidText(err, ['ERR_', 'ELIFECYCLE', 'MISSING'], 'plugin add stderr')
      const profileManifestPath = join(dshHome, 'profiles/web/package.json')
      if (!existsSync(profileManifestPath)) throw new Error('profile manifest was not created')
      const profileManifest = readFileSync(profileManifestPath, 'utf8')
      requireText(profileManifest, ['@yeisme/dsh-workbench-compose'], 'profile manifest dependency')
      const bundles = JSON.parse(profileManifest).dsh?.profile?.bundles ?? []
      if (!bundles.includes('@yeisme/dsh-workbench-compose')) throw new Error('compose package did not join dsh.profile.bundles layer stack')
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
      requireText(out, ["# == @yeisme/dsh-workbench-compose", '- id: dsh-workbench-compose'], 'dump-config compose row')
      const rowMatches = out.match(/^- id: dsh-workbench-compose$/gm) ?? []
      if (rowMatches.length !== 1) throw new Error(`expected exactly one dsh-workbench-compose row, found ${rowMatches.length}`)
      forbidText(out, ['unresolved'], 'dump-config rows')
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
      forbidText((out + err).toLowerCase(), ['loadfail', 'cannot resolve', 'enoent'], 'web boot diagnostics')
    },
  },
)

// ---- 3. 官方宿主面探针：已安装官方 dsh 的 layout slot 声明 ----

const officialHostProbe = () => {
  const npmRoot = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout?.trim()
  const layoutTypes = npmRoot
    ? join(npmRoot, '@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/lib/types/client/index.d.ts')
    : ''
  if (!layoutTypes || !existsSync(layoutTypes)) throw new Error(`official layout type surface not found at ${redact(layoutTypes)}`)
  const surface = readFileSync(layoutTypes, 'utf8')
  const slots = [...surface.matchAll(/'((?:shell|sidebar|conversation|details|root)[a-z.]*)'\s*:\s*\{/g)].map(match => match[1])
  const unique = [...new Set(slots)]
  const probe = {
    probedAt: new Date().toISOString(),
    dsh: resolvedDsh,
    layoutTypesPath: redact(layoutTypes),
    declaredSlots: unique,
    hasWorkspaceRight: unique.includes('shell.workspace.right'),
    hasWorkspaceBottom: unique.includes('shell.workspace.bottom'),
  }
  writeFileSync(join(artifactsDir, 'official-host-surface.json'), JSON.stringify(probe, null, 2))
  return probe
}

let hostProbe
try {
  hostProbe = officialHostProbe()
  if (!hostProbe.hasWorkspaceRight) {
    checks.push({ id: 'official-host-surface', command: 'npm root -g + read dsh-client-ui-layout types', expected_exit: 0, actual_exit: 1, status: 'failed', message: 'installed official dsh runtime does not declare shell.workspace.right; the direct host path cannot activate' })
    if (exitCode === 0) exitCode = 1
  } else {
    checks.push({ id: 'official-host-surface', command: 'npm root -g + read dsh-client-ui-layout types', expected_exit: 0, actual_exit: 0, status: 'passed' })
  }
} catch (error) {
  checks.push({ id: 'official-host-surface', command: 'npm root -g + read dsh-client-ui-layout types', expected_exit: 0, actual_exit: 1, status: 'failed', message: redact(String(error?.message ?? error)) })
  if (exitCode === 0) exitCode = 1
}

// ---- 收尾：证据目录 + 沙盒清理 ----

const finishedAt = new Date()
const summary = {
  runId,
  change: 'dsh-workbench-compose-v1 (task 6.3 official Workbench/Pane host wiring — local evidence)',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  status: exitCode === 0 ? 'passed' : 'failed',
  exitCode,
  checks,
  scope: {
    included: 'focused compose gates; official dsh CLI local-path plugin add; --dump-config single compose row; web profile boot smoke; installed-runtime official workspace slot probe',
    excluded: 'browser Playwright visual evidence (optional, not a plugin completion gate); real Host data projection (task 6.1, blocked on browser-consumable host seam)',
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
console.log(`[${summary.status}] ${runId} (exit ${exitCode})`)
process.exit(exitCode)
