#!/usr/bin/env node
/** Local staged host launcher; uses official profile reconciliation and leaves installed DSH intact. */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'
import { discoverWorkspacePackages, workspaceBundles } from './dsh-dev.mjs'
import { checkWorkbenchRuntime, WORKBENCH_BASE } from './workbench-runtime.mjs'

const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'temp/dsh-unified-host-source')
const args = process.argv.slice(2).filter(arg => arg !== '--')
const take = flag => { const at = args.indexOf(flag); if (at < 0) return false; args.splice(at, 1); return true }
const isolated = take('--isolated'), prepareOnly = take('--prepare-only'), rebuild = take('--rebuild')
const rollback = take('--rollback')
const check = take('--check')
if (take('--help') || take('-h')) {
  console.log('Usage: pnpm dsh:workbench -- [--check] [--isolated] [--prepare-only] [--rebuild] [--rollback] [DSH web options]\n\nUses the compatible staged DSH host and all local bundles.\n--check         validate the release and browser artifacts without writes\n--isolated      use the disposable acceptance home\n--prepare-only  reconcile bundles and exit\n--rebuild       rebuild the staged runtime before launching\n--rollback      restore recorded profile dependencies; never launch another runtime')
  process.exit(0)
}
const env = { ...process.env, ...(isolated ? { DSH_HOME: resolve(root, 'temp/dsh-unified-home') } : {}), DSH_TELEMETRY_DISABLED: '1' }
function run(command, argv, cwd = root) {
  return new Promise((accept, reject) => {
    const child = spawn(command, argv, { cwd, env, stdio: 'inherit' })
    const stop = signal => child.kill(signal)
    const term = () => stop('SIGTERM'), interrupt = () => stop('SIGINT')
    process.once('SIGTERM', term); process.once('SIGINT', interrupt)
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      process.removeListener('SIGTERM', term); process.removeListener('SIGINT', interrupt)
      if (code === 0 && signal === null) accept()
      else reject(new Error(`${command} exited with ${code ?? signal}`))
    })
  })
}
try {
  if (check) {
    checkWorkbenchRuntime(root)
    console.log('Compatible workbench runtime verified; no profile or session data changed.')
    process.exit(0)
  }
  if (!existsSync(resolve(source, '.git'))) {
    await run('git', ['clone', '--depth', '1', '--branch', 'dsh-v0.1.2-rc.1', 'https://github.com/deepseek-ai/deepseek-harness.git', source])
    await run('bash', ['upstream-prs/unified-multi-pane-workbench/apply.sh', source])
  }
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim()
  if (base !== WORKBENCH_BASE) throw new Error('The staging checkout does not match the supported DSH release. Keep it intact and prepare a matching checkout.')
  if (!existsSync(resolve(source, 'packages/client/ui-layout/src/client/Workbench.tsx'))) {
    await run('bash', ['upstream-prs/unified-multi-pane-workbench/apply.sh', source])
  }
  if (!existsSync(resolve(source, 'packages/client/ui-conversation/src/client/reference-target-chooser.tsx'))) {
    await run('bash', ['upstream-prs/composer-multi-reference-v1/apply.sh', source])
  }
  if (readFileSync(resolve(source, 'packages/client/ui-conversation/src/client/apply.ts'), 'utf8').includes('createReferenceTargetControl')) {
    await run('bash', ['upstream-prs/workbench-runtime-cleanup/apply.sh', source])
  }
  if (!existsSync(resolve(source, 'packages/client/ui-layout/src/client/keyboard.ts'))) {
    await run('bash', ['upstream-prs/pane-interaction-completion/apply.sh', source])
  }
  if (!readFileSync(resolve(source, 'packages/client/ui-layout/src/client/keyboard.ts'), 'utf8').includes('cyclePane')) {
    await run('bash', ['upstream-prs/pane-keyboard-cycle/apply.sh', source])
  }
  if (!readFileSync(resolve(source, 'packages/client/ui-layout/src/client/keyboard.ts'), 'utf8').includes('Direct editor-style shortcuts')) {
    await run('bash', ['upstream-prs/pane-editor-shortcuts/apply.sh', source])
  }
  if (!existsSync(resolve(source, 'packages/client/ui-conversation/src/client/conversation/navigation.ts'))) {
    await run('bash', ['upstream-prs/session-tools-workspace/apply.sh', source])
  }
  if (!readFileSync(resolve(source, 'packages/host/frontend-static/src/index.ts'), 'utf8').includes('historyFallback')) {
    await run('bash', ['upstream-prs/frontend-static-history-fallback/apply.sh', source])
  }
  await run('bash', ['upstream-prs/tools-pane-layout-v1/apply.sh', source])
  await run('bash', ['upstream-prs/tools-draft-target-v1/apply.sh', source])
  let compatibleBundle = false
  try { checkWorkbenchRuntime(root); compatibleBundle = true } catch { /* Rebuild incomplete or stale local artifacts below. */ }
  if (rebuild || !compatibleBundle || !existsSync(resolve(source, 'apps/cli/lib/bin.js')) || !existsSync(resolve(source, 'apps/web/dist/index.html'))) {
    await run('pnpm', ['install', '--frozen-lockfile'], source)
    for (const script of ['build:lib:host', 'build:lib:client', 'build:web']) await run('pnpm', ['run', script], source)
  }
  checkWorkbenchRuntime(root)
  const cli = resolve(source, 'apps/cli/lib/bin.js')
  const profile = resolve(env.DSH_HOME ?? resolve(homedir(), '.dsh'), 'profiles/web')
  const manifestPath = resolve(profile, 'package.json')
  const backupPath = resolve(profile, 'unified-host-rollback.json')
  const dependencies = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')).dependencies ?? {} : {}
  if (rollback) {
    if (!existsSync(backupPath)) throw new Error('No replaced profile dependencies to restore.')
    const entries = JSON.parse(readFileSync(backupPath, 'utf8')).entries
    const restore = entries.filter(entry => dependencies[entry.name] === entry.staged).map(entry => `${entry.name}@${entry.original}`)
    if (restore.length) await run(process.execPath, [cli, 'plugin', '--profile', 'web', 'add', ...restore])
    // pnpm may prune node_modules inside a removed link target. Restore the
    // staging workspace dependencies so other profiles and development remain usable.
    if (restore.length) await run('pnpm', ['install', '--frozen-lockfile'], source)
    console.log(`Restored ${restore.length} official profile dependencies. Later user changes were preserved. Start dsh web to use the installed runtime.`)
    process.exit(0)
  }
  // Explicit profile dependencies shadow the CLI's built-in packages. Resolve
  // those to the matching staging source, retaining their original specs for rollback.
  const upstream = [...(await discoverWorkspacePackages(source)).values()]
  const overrides = Object.entries(dependencies).flatMap(([name, original]) => {
    if (!name.startsWith('@deepseek-ai/')) return []
    const pkg = upstream.find(candidate => candidate.name === name)
    return pkg ? [{ name, original, staged: `link:${pkg.dir}` }] : []
  })
  const replacements = overrides.filter(entry => {
    if (/^(link:|file:)/.test(entry.original)) {
      return resolve(profile, entry.original.replace(/^(link:|file:)/, '')) !== entry.staged.slice(5)
    }
    return entry.original !== entry.staged
  })
  if (replacements.length) {
    const previous = existsSync(backupPath) ? JSON.parse(readFileSync(backupPath, 'utf8')).entries : []
    const entries = [...previous.filter(entry => !replacements.some(next => next.name === entry.name)), ...replacements]
    writeFileSync(backupPath, JSON.stringify({ version: 1, entries }, null, 2), { mode: 0o600 })
    await run(process.execPath, [cli, 'plugin', '--profile', 'web', 'add', ...replacements.map(entry => entry.staged)])
  }
  const packages = await discoverWorkspacePackages(root)
  const bundles = workspaceBundles(packages)
  await run(process.execPath, [cli, 'plugin', '--profile', 'web', 'add', ...bundles.map(bundle => `link:${bundle.dir}`)])
  if (!prepareOnly) await run(process.execPath, [cli, '--profile', 'web', ...args])
} catch (error) { console.error(error.message); process.exitCode = 1 }
