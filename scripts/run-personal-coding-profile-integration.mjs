#!/usr/bin/env node

import { execPath } from 'node:process'
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const projectRoot = resolve(import.meta.dirname, '..')
const workspaceRoot = resolve(projectRoot, '../..')
const tuiLauncher = join(workspaceRoot, 'client/dsh-tui/apps/bin/bin/dsh-tui.mjs')
const startedAt = new Date()
const runId = `${startedAt.toISOString().replaceAll(':', '-').replaceAll('.', '-')}-${process.pid}`
const evidenceDir = join(projectRoot, 'temp', 'integration-test-runs', runId)
const artifactsDir = join(evidenceDir, 'artifacts')
const dshHome = join(tmpdir(), `dsh-personal-profile-${process.pid}-${Date.now()}`)
const failureDshHome = join(tmpdir(), `dsh-personal-profile-failure-${process.pid}-${Date.now()}`)
const failureShimDir = join(failureDshHome, 'shim')
mkdirSync(artifactsDir, { recursive: true })
mkdirSync(failureShimDir, { recursive: true })

const resolvedDsh = spawnSync('which', ['dsh'], { encoding: 'utf8' }).stdout?.trim()
if (!resolvedDsh) throw new Error('dsh executable is not available for the profile integration runner')
const dshShim = join(failureShimDir, 'dsh')
writeFileSync(dshShim, `#!/usr/bin/env node\nimport { spawnSync } from 'node:child_process'\nconst args = process.argv.slice(2)\nif (args[0] === 'plugin' && args.includes('add') && args.at(-1)?.endsWith('/dsh-browser-pane')) {\n  process.stderr.write('fault injection: optional browser pack add failed\\n')\n  process.exit(7)\n}\nconst result = spawnSync(${JSON.stringify(resolvedDsh)}, args, { stdio: 'inherit', env: process.env })\nprocess.exit(result.error === undefined ? result.status ?? 1 : 127)\n`)
chmodSync(dshShim, 0o755)

const redact = value => String(value)
  .replaceAll(projectRoot, '[PROJECT_ROOT]')
  .replaceAll(workspaceRoot, '[WORKSPACE_ROOT]')
  .replaceAll(dshHome, '[TEMP_DSH_HOME]')
  .replaceAll(failureDshHome, '[TEMP_FAILURE_DSH_HOME]')
  .replaceAll(homedir(), '[USER_HOME]')
  .replace(/(authorization|token|password|cookie|secret)\s*[:=]\s*\S+/gi, '$1=[REDACTED]')
  .replace(/\/(?:home|root|private|var|workspaces)\/\S+/g, '[PRIVATE_PATH]')

const checks = []
let stdout = ''
let stderr = ''
let exitCode = 0

function failCheck(id, message) {
  checks.push({ id, command: id, expected_exit: 0, actual_exit: 1, status: 'failed', message })
  stderr += `$ ${id}\n${redact(message)}\n`
  if (exitCode === 0) exitCode = 1
}

function runCheck(id, command, expectedExit = 0, env = {}, assertStdout) {
  const display = [command[0], ...command[1]].join(' ')
  const result = spawnSync(command[0], command[1], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 16 * 1024 * 1024,
  })
  const actualExit = result.error === undefined ? result.status ?? 1 : 127
  const out = redact(result.stdout ?? '')
  const err = redact(result.stderr ?? result.error?.message ?? '')
  let status = actualExit === expectedExit ? 'passed' : 'failed'
  let message
  if (status === 'passed' && typeof assertStdout === 'function') {
    try { assertStdout(out, err, actualExit) } catch (error) {
      status = 'failed'
      message = error instanceof Error ? error.message : String(error)
    }
  }
  const check = { id, command: redact(display), expected_exit: expectedExit, actual_exit: actualExit, status, ...(message === undefined ? {} : { message }) }
  checks.push(check)
  stdout += `$ ${redact(display)} (expected exit ${expectedExit})\n${out}`
  stderr += `$ ${redact(display)} (expected exit ${expectedExit})\n${err}${message === undefined ? '' : `\n${redact(message)}\n`}`
  if (check.status === 'failed' && exitCode === 0) exitCode = actualExit || 1
  return { ...check, stdout: out, stderr: err }
}

function requireAll(haystack, needles, label) {
  for (const needle of needles) {
    if (!haystack.includes(needle)) throw new Error(`${label} missing ${JSON.stringify(needle)}`)
  }
}

function forbidAll(haystack, needles, label) {
  for (const needle of needles) {
    if (haystack.includes(needle)) throw new Error(`${label} leaked ${JSON.stringify(needle)}`)
  }
}

const profileEnv = { DSH_HOME: dshHome }
const failureProfileEnv = { DSH_HOME: failureDshHome, PATH: `${failureShimDir}:${process.env.PATH ?? ''}` }
let base
let optionalPack
let optionalPackFailure
let optionalPackRollback
let unknownPack
let dump
let help
let doctor
let boot
let reload
let dumpAfter
let doctorAfter
let verifier
try {
  base = runCheck('profile_setup_base', [execPath, [tuiLauncher, 'setup', '--source', workspaceRoot, '--yes', '--json']], 0, profileEnv, (out) => {
    const receipt = JSON.parse(out.trim())
    if (receipt.schema_version !== 'dsh.tui.setup_receipt.v1') throw new Error('base setup is not a setup receipt')
    if (receipt.status !== 'updated') throw new Error(`base setup status ${receipt.status}`)
    for (const id of ['tui', 'base', 'dsh-command-experience', 'dsh-terminal', 'ordo-agent-ops']) {
      if (!receipt.added.includes(id)) throw new Error(`base setup did not add ${id}`)
    }
  })
  optionalPack = runCheck('profile_setup_optional_pack', [execPath, [tuiLauncher, 'setup', '--source', workspaceRoot, '--pack', 'mermaid', '--yes', '--json']], 0, profileEnv, (out) => {
    const receipt = JSON.parse(out.trim())
    if (!receipt.added.includes('mermaid')) throw new Error('optional pack did not report mermaid add')
    for (const id of ['tui', 'base']) {
      if (!receipt.kept.includes(id)) throw new Error(`optional pack took down ${id}`)
    }
  })
  optionalPackFailure = runCheck('profile_setup_optional_pack_failure', [execPath, [tuiLauncher, 'setup', '--source', workspaceRoot, '--pack', 'browser', '--yes', '--json']], 7, failureProfileEnv, (_out, err) => {
    requireAll(err, ['add failed for browser', 'rollback=complete', 'fault injection: optional browser pack add failed'], 'optional pack failure')
  })
  optionalPackRollback = runCheck('profile_setup_optional_pack_rollback', [execPath, ['-e', `
    const { readFileSync } = await import('node:fs')
    const { spawnSync } = await import('node:child_process')
    const profilePath = process.argv[1]
    const dsh = spawnSync('dsh', ['plugin', '--profile', 'tui', 'list', '--json'], { encoding: 'utf8', env: process.env })
    if (dsh.status !== 0) process.exit(dsh.status ?? 1)
    const listed = JSON.parse(dsh.stdout)[0] ?? {}
    const manifest = JSON.parse(readFileSync(profilePath, 'utf8'))
    process.stdout.write(JSON.stringify({
      dependencies: Object.keys(listed.dependencies ?? {}),
      bundles: manifest.dsh?.profile?.bundles ?? [],
      inactive_cache_links: Object.keys(listed.unsavedDependencies ?? {}),
    }))
  `, join(failureDshHome, 'profiles', 'tui', 'package.json')]], 0, failureProfileEnv, (out) => {
    const state = JSON.parse(out.trim())
    const rolledBack = [
      '@yeisme/dsh-tui-app',
      '@yeisme/dsh-personal-coding-base',
      '@yeisme/dsh-command-experience',
      '@yeisme/dsh-workbench-core',
      '@yeisme/dsh-terminal',
      '@yeisme/dsh-ordo-agent-ops',
      '@yeisme/dsh-browser-pane',
    ]
    for (const packageName of rolledBack) {
      if (state.dependencies.includes(packageName)) throw new Error(`rollback retained active dependency ${packageName}`)
      if (state.bundles.includes(packageName)) throw new Error(`rollback retained active bundle ${packageName}`)
    }
  })
  unknownPack = runCheck('profile_setup_unknown_pack', [execPath, [tuiLauncher, 'setup', '--source', workspaceRoot, '--pack', 'unknown', '--yes', '--json']], 2, profileEnv, (_out, err) => {
    if (!err.includes('unknown pack: unknown')) throw new Error('unknown pack did not fail closed with pack id')
  })
  dump = runCheck('profile_dump_config', ['dsh', ['--profile', 'tui', '--dump-config']], 0, profileEnv, (out) => {
    if (out.trim() === '') throw new Error('dump-config was empty')
    requireAll(out, [
      '@yeisme/dsh-personal-coding-base',
      '@yeisme/dsh-command-experience',
      '@yeisme/dsh-terminal',
      '@yeisme/dsh-ordo-agent-ops',
      '@yeisme/dsh-mermaid-render',
    ], 'dump-config')
    const commandExperience = [...out.matchAll(/# == @yeisme\/dsh-command-experience/g)]
    if (commandExperience.length !== 1) throw new Error(`dump-config duplicate command-experience layers: ${commandExperience.length}`)
    forbidAll(out, ['@yeisme/dsh-desktop-workbench', '@yeisme/dsh-semantic-file-editor', '@yeisme/dsh-devtools'], 'dump-config')
  })
  help = runCheck('profile_boot_help', ['dsh', ['--profile', 'tui', '--help']], 0, profileEnv, (out) => {
    requireAll(out, ['Usage: dsh --profile tui', 'dsh'], 'help')
  })
  doctor = runCheck('profile_doctor', [execPath, [tuiLauncher, 'doctor', '--json']], 0, profileEnv, (out) => {
    const result = JSON.parse(out.trim())
    if (result.schema_version !== 'dsh.tui.doctor.v1') throw new Error('doctor is not a doctor receipt')
    const byId = Object.fromEntries(result.checks.map(check => [check.id, check]))
    if (byId.personal_coding_base?.status !== 'ready') throw new Error('doctor lost personal coding base')
    if (byId.ordo_run_launch?.required !== false) throw new Error('Ordo was treated as required')
    if (byId.ordo_run_launch?.status !== 'degraded' && byId.ordo_run_launch?.status !== 'ready') throw new Error('Ordo probe missing')
    forbidAll(out, ['token=', 'password=', 'cookie=', 'Authorization', '/home/', '/workspaces/', '/root/'], 'doctor')
  })
  const bootTranscript = join(artifactsDir, 'boot-transcript.txt')
  const reloadTranscript = join(artifactsDir, 'reload-transcript.txt')
  boot = runCheck('profile_hot_boot', [execPath, [join(import.meta.dirname, 'personal-coding-pty-boot.mjs'), dshHome, bootTranscript]], 0, profileEnv, (out) => {
    const result = JSON.parse(out.trim())
    if (result.ready !== true) throw new Error('first TUI boot did not show ready chrome')
    if (result.plugin_tree_failed === true) throw new Error('first TUI boot failed to activate the plugin tree')
    if (result.module_not_found === true) throw new Error('first TUI boot could not resolve personal-coding members')
    if (result.duplicate_loader === true) throw new Error('first TUI boot hit duplicate loader ids')
    if (result.clean_wait !== true) throw new Error(`first TUI boot wait_status=${result.wait_status} exitcode=${result.exitcode}`)
    if (typeof result.debug_log !== 'string' || result.debug_log.length === 0) throw new Error('first TUI boot did not emit a debug log fence')
  })
  reload = runCheck('profile_hot_reload', [execPath, [join(import.meta.dirname, 'personal-coding-pty-boot.mjs'), dshHome, reloadTranscript]], 0, profileEnv, (out) => {
    const result = JSON.parse(out.trim())
    if (result.ready !== true) throw new Error('reload TUI boot lost base chrome')
    if (result.plugin_tree_failed === true) throw new Error('reload TUI boot failed to activate the plugin tree')
    if (result.module_not_found === true) throw new Error('reload TUI boot could not resolve personal-coding members')
    if (result.duplicate_loader === true) throw new Error('reload TUI boot hit duplicate loader ids')
    if (result.clean_wait !== true) throw new Error(`reload TUI boot wait_status=${result.wait_status} exitcode=${result.exitcode}`)
    if (typeof result.debug_log !== 'string' || result.debug_log.length === 0) throw new Error('reload TUI boot did not emit a debug log fence')
  })
  dumpAfter = runCheck('profile_dump_config_after_reload', ['dsh', ['--profile', 'tui', '--dump-config']], 0, profileEnv, (out) => {
    requireAll(out, ['@yeisme/dsh-personal-coding-base', '@yeisme/dsh-command-experience', '@yeisme/dsh-mermaid-render'], 'dump-config after reload')
    forbidAll(out, ['@yeisme/dsh-desktop-workbench', '@yeisme/dsh-semantic-file-editor', '@yeisme/dsh-devtools'], 'dump-config after reload')
  })
  doctorAfter = runCheck('profile_doctor_after_reload', [execPath, [tuiLauncher, 'doctor', '--json']], 0, profileEnv, (out) => {
    const result = JSON.parse(out.trim())
    if (result.checks.find(check => check.id === 'personal_coding_base')?.status !== 'ready') throw new Error('doctor after reload lost base')
  })
  verifier = runCheck('web_tui_ordo_fixture_verifier', ['bun', [join(workspaceRoot, 'scripts/verify-dsh-personal-coding-contracts.ts')]], 0)

  writeFileSync(join(artifactsDir, 'profile.json'), `${JSON.stringify({
    schema_version: 'dsh.personal_coding.profile_probe.v1',
    profile_home: '[TEMP_DSH_HOME]',
    checks: [base, optionalPack, optionalPackFailure, optionalPackRollback, unknownPack, dump, help, doctor, boot, reload, dumpAfter, doctorAfter].map(({ stdout: _stdout, stderr: _stderr, ...check }) => check),
    doctor_output: doctor?.stdout ?? '',
    redaction: { enabled: true, policy: 'yeisme.integration-test-redaction.v1' },
  }, null, 2)}\n`)
  writeFileSync(join(artifactsDir, 'dump-config.yml'), dump?.stdout ?? '')
  writeFileSync(join(artifactsDir, 'doctor.json'), doctor?.stdout ?? '')
  writeFileSync(join(artifactsDir, 'boot.json'), boot?.stdout ?? '')
  writeFileSync(join(artifactsDir, 'reload.json'), reload?.stdout ?? '')
  writeFileSync(join(artifactsDir, 'boot-transcript.txt'), redact(readFileSync(bootTranscript, 'utf8')))
  writeFileSync(join(artifactsDir, 'reload-transcript.txt'), redact(readFileSync(reloadTranscript, 'utf8')))
  writeFileSync(join(artifactsDir, 'optional-pack-rollback.json'), optionalPackRollback?.stdout ?? '')
  writeFileSync(join(artifactsDir, 'fixture-contract.txt'), 'real DSH profile -> base members as sibling layers -> optional mermaid isolation -> injected optional browser failure with active dependency/bundle rollback -> unknown pack fail-closed -> PTY boot/dispose/reload -> Web/TUI/Ordo verifier\n')
} catch (error) {
  failCheck('runner', error instanceof Error ? error.message : String(error))
} finally {
  rmSync(dshHome, { recursive: true, force: true })
  rmSync(failureDshHome, { recursive: true, force: true })
}

const finishedAt = new Date()
const rel = path => relative(projectRoot, path).split('\\').join('/')
const commandText = [
  'dsh-tui setup --source <workspace> --yes --json',
  'dsh-tui setup --source <workspace> --pack mermaid --yes --json',
  'dsh-tui setup --source <workspace> --pack browser --yes --json # injected add failure; active profile rollback expected',
  'dsh-tui setup --source <workspace> --pack unknown --yes --json',
  'dsh --profile tui --dump-config',
  'dsh --profile tui --help',
  'dsh-tui doctor --json',
  'dsh --profile tui --debug-tui --viewport 80x24 --no-mouse',
  'bun scripts/verify-dsh-personal-coding-contracts.ts',
].join('\n')
const summary = {
  schema_version: 'yeisme.integration_test_evidence.v1',
  project: 'agent/harness-plugins',
  run_id: runId,
  layer: 'integration',
  scope: 'real disposable DSH profile setup/boot/doctor plus optional pack success and injected failure rollback, unknown pack fail-closed, PTY dispose/reload and cross-project fixtures',
  command: redact(commandText),
  status: exitCode === 0 ? 'passed' : 'failed',
  exit_code: exitCode,
  checks: checks.map(({ id, command, expected_exit, actual_exit, status }) => ({ id, command, expected_exit, actual_exit, status })),
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  evidence: {
    command: rel(join(evidenceDir, 'command.txt')),
    stdout: rel(join(evidenceDir, 'stdout.log')),
    stderr: rel(join(evidenceDir, 'stderr.log')),
    env: rel(join(evidenceDir, 'env.json')),
    artifacts: `${rel(artifactsDir)}/`,
  },
  redaction: { enabled: true, policy: 'yeisme.integration-test-redaction.v1' },
}

writeFileSync(join(evidenceDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
writeFileSync(join(evidenceDir, 'command.txt'), `${redact(commandText)}\n`)
writeFileSync(join(evidenceDir, 'stdout.log'), stdout)
writeFileSync(join(evidenceDir, 'stderr.log'), stderr)
writeFileSync(join(evidenceDir, 'env.json'), `${JSON.stringify({
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  dsh_home: '[TEMP_DSH_HOME]',
  ci: process.env.CI === 'true',
  timezone: 'UTC',
}, null, 2)}\n`)

process.stdout.write(`personal coding profile integration evidence: ${rel(evidenceDir)}\n`)
process.stdout.write(stdout)
process.stderr.write(stderr)
process.exitCode = exitCode
