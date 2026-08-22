#!/usr/bin/env node

import { access, mkdtemp, readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const bundleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(bundleRoot, '../../..')
const dshSourceRoot = process.env.DSH_SOURCE_ROOT ?? resolve(projectRoot, '../../client/deepseek-harness')
const startedAt = new Date()
const runId = `${startedAt.toISOString().replace(/[:.]/gu, '-')}-${process.pid}-pane-profile`
const evidenceRoot = resolve(projectRoot, 'temp/integration-test-runs', runId)
const artifactsRoot = resolve(evidenceRoot, 'artifacts')
// workspace seam peer floor: >=0.1.0-rc.9 <0.2.0（prerelease rc 按序数比较）
function satisfiesWorkspacePeer(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/u.exec(version)
  if (!match) return false
  const [major, minor, patch, rc] = [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? Infinity : Number(match[4])]
  const floor = { major: 0, minor: 1, patch: 0, rc: 9 }
  const ceiling = { major: 0, minor: 2, patch: 0 }
  const below = major < ceiling.major || (major === ceiling.major && (minor < ceiling.minor || (minor === ceiling.minor && patch < ceiling.patch)))
  const above = major > floor.major
    || (major === floor.major && (minor > floor.minor
      || (minor === floor.minor && (patch > floor.patch || (patch === floor.patch && rc >= floor.rc)))))
  return below && above
}

const commandLog = []
const structuralLog = []
let status = 'passed'
let failure
let dshHome
let packRoot
let layoutPackRoot

await mkdir(artifactsRoot, { recursive: true })

try {
  run('pnpm', ['--filter', '@yeisme/dsh-client-ui-pane-workbench', 'run', 'build'], projectRoot)
  run('pnpm', ['--filter', '@yeisme/dsh-pane-workbench', 'run', 'build'], projectRoot)

  const manifest = JSON.parse(await readFile(resolve(bundleRoot, 'package.json'), 'utf8'))
  const patch = await readFile(resolve(bundleRoot, 'cordis.patch.yml'), 'utf8')
  assert(manifest.dsh?.bundle?.patch === './cordis.patch.yml', 'bundle manifest does not declare its patch')
  assert(manifest.dsh?.client?.platform === 'web', 'bundle manifest does not declare the Web client face')
  assert(manifest.dependencies?.['@yeisme/dsh-client-ui-pane-workbench'] === '0.1.0-rc.1', 'client dependency is not direct and versioned')
  assert(manifest.peerDependencies?.['@deepseek-ai/dsh-client-ui-layout'] === '>=0.1.0-rc.9 <0.2.0', 'layout peer floor was not raised for the workspace seam')
  assert(countLines(patch, "id: pane-workbench") === 1, 'patch must contain one pane-workbench row')
  assert(countLines(patch, "name: '@yeisme/dsh-pane-workbench'") === 1, 'patch must mount the bundle node face')
  const patchNames = [...patch.matchAll(/^\s*name:\s*['"]([^'"]+)['"]\s*$/gmu)].map(match => match[1])
  assert(!patchNames.some(name => /sidebar|conversation|details/iu.test(name)), 'patch names a forbidden DSH single slot')

  packRoot = await mkdtemp('/tmp/pane-workbench-pack-')
  run('pnpm', ['pack', '--pack-destination', packRoot], bundleRoot)
  const tarballs = (await readdir(packRoot)).filter(name => name.endsWith('.tgz'))
  assert(tarballs.length === 1, 'expected exactly one Pane Workbench tarball')
  const tarball = resolve(packRoot, tarballs[0])
  const members = tarMembers(tarball)
  for (const member of ['package/index.mjs', 'package/lib/client.js', 'package/cordis.patch.yml', 'package/README.md', 'package/package.json']) {
    assert(members.includes(member), `packed bundle is missing ${member}`)
  }
  assert(!members.some(member => member.startsWith('package/src/')), 'source tree leaked into packed bundle')
  await writeJson(resolve(artifactsRoot, 'packed-manifest.json'), {
    package: manifest.name,
    version: manifest.version,
    member_count: members.length,
    required_members: ['package/index.mjs', 'package/lib/client.js', 'package/cordis.patch.yml', 'package/README.md'],
    source_tree_leaked: false,
  })

  const faceProbe = run('node', [
    '--input-type=module',
    '-e',
    "const fs = await import('node:fs'); const code = fs.readFileSync('./lib/client.js', 'utf8'); if (!code.startsWith('window.__ModuleLoader__.load({')) throw new Error('client bundle is not a __ModuleLoader__.load registration'); if (!code.includes('id: \"@yeisme/dsh-pane-workbench\"')) throw new Error('client bundle registers the wrong id'); if (!code.includes('factory: (require)')) throw new Error('client bundle is missing the factory face'); if (!code.includes('shell.workspace.right') || !code.includes('shell.workspace.bottom') || !code.includes('workspaceLayout')) throw new Error('client bundle is missing the V2 workspace seams'); if (/\\.inject\\(\\s*[\"\']shell\\.overlay/u.test(code)) throw new Error('client bundle still registers shell.overlay'); console.log('client-bundle-v2-ok')",
  ], bundleRoot)
  assert(faceProbe.stdout.includes('client-bundle-v2-ok'), 'client bundle is not a DSH V2 workspace face')
  structuralLog.push({ stage: 'client_bundle_face', loader_registration: true, id: '@yeisme/dsh-pane-workbench', workspace_slots: 2, overlay_registration: false })

  // fork 退役后 DSH_SOURCE_ROOT 通常不存在：优先本地 staging 源，否则回退
  // npm 发布版做 layout canary（与 upstream-canary 的发布版口径一致）。
  const hasLocalDshSource = await access(dshSourceRoot)
    .then(() => true, () => false)
  let layoutTarball
  let layoutFromLocalSource = hasLocalDshSource
  if (hasLocalDshSource) {
    layoutPackRoot = await mkdtemp('/tmp/dsh-layout-pack-')
    const layoutRoot = resolve(dshSourceRoot, 'packages/client/ui-layout')
    run('pnpm', ['--filter', '@deepseek-ai/dsh-client-ui-layout', 'run', 'bundle'], dshSourceRoot)
    run('pnpm', ['pack', '--pack-destination', layoutPackRoot], layoutRoot)
    const layoutTarballs = (await readdir(layoutPackRoot)).filter(name => name.endsWith('.tgz'))
    assert(layoutTarballs.length === 1, 'expected exactly one local DSH ui-layout tarball')
    layoutTarball = resolve(layoutPackRoot, layoutTarballs[0])
  }

  dshHome = await mkdtemp('/tmp/pane-workbench-dsh-home-')
  const env = { ...process.env, DSH_HOME: dshHome }
  run('dsh', ['plugin', '--profile', 'web', 'add', './packages/bundle/pane-workbench'], projectRoot, env)
  const profileDir = resolve(dshHome, 'profiles/web')
  const installed = JSON.parse(await readFile(resolve(profileDir, 'package.json'), 'utf8'))
  assert(installed.dependencies?.[manifest.name] !== undefined, 'profile dependency missing after install')
  assert(installed.dsh?.profile?.bundles?.includes(manifest.name), 'profile bundle row missing after install')
  if (layoutFromLocalSource) {
    run('pnpm', ['add', '--save-exact', layoutTarball], profileDir, env)
  } else {
    // npm 发布版 canary：解析 peer 范围内最高已发布版（fork 退役后 rc.9 只存在于
    // staging 源，发布线以 0.1.1-rc.x 延续）。
    const published = run('pnpm', ['view', '@deepseek-ai/dsh-client-ui-layout', 'versions', '--json'], projectRoot, env)
    const versions = JSON.parse(published.stdout).filter(satisfiesWorkspacePeer)
    assert(versions.length > 0, 'no published ui-layout satisfies the workspace peer range')
    const latest = versions[versions.length - 1]
    run('pnpm', ['add', '--save-exact', `@deepseek-ai/dsh-client-ui-layout@${latest}`], profileDir, env)
  }
  const installedLayout = JSON.parse(await readFile(resolve(profileDir, 'node_modules/@deepseek-ai/dsh-client-ui-layout/package.json'), 'utf8'))
  assert(satisfiesWorkspacePeer(installedLayout.version), `profile resolved incompatible ui-layout ${installedLayout.version}`)
  structuralLog.push({ stage: 'layout_canary', package: installedLayout.name, version: installedLayout.version, local_source: layoutFromLocalSource })

  const addedConfig = run('dsh', ['--profile', 'web', '--dump-config'], projectRoot, env)
  const addedRowCount = countLines(addedConfig.stdout, 'id: pane-workbench')
  assert(addedRowCount === 1, `profile dump contains ${addedRowCount} Pane Workbench rows after install`)
  assert(addedConfig.stdout.includes("name: '@yeisme/dsh-pane-workbench'"), 'profile dump misses the Pane bundle row')
  structuralLog.push({ stage: 'install_dump', row_count: addedRowCount, bundle_row: true })

  await assertWebBoot(env)

  run('dsh', ['plugin', '--profile', 'web', 'remove', manifest.name], projectRoot, env)
  const removed = JSON.parse(await readFile(resolve(profileDir, 'package.json'), 'utf8'))
  assert(removed.dependencies?.[manifest.name] === undefined, 'profile dependency remained after remove')
  assert(!removed.dsh?.profile?.bundles?.includes(manifest.name), 'profile bundle row remained after remove')
  const removedConfig = run('dsh', ['--profile', 'web', '--dump-config'], projectRoot, env)
  const removedRowCount = countLines(removedConfig.stdout, 'id: pane-workbench')
  assert(removedRowCount === 0, 'profile dump retained Pane Workbench after remove')
  structuralLog.push({ stage: 'remove_dump', row_count: removedRowCount, bundle_row: false })
} catch (error) {
  status = 'failed'
  failure = redact(error instanceof Error ? error.message : String(error))
}

const finishedAt = new Date()
const summary = {
  schema_version: 'yeisme.integration_test_evidence.v1',
  project: 'agent/harness-plugins',
  run_id: runId,
  layer: 'profile-conformance',
  command: 'pnpm --filter @yeisme/dsh-pane-workbench run test',
  status,
  exit_code: status === 'passed' ? 0 : 1,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  failure: failure ?? null,
  checks: structuralLog,
  redaction: {
    enabled: true,
    policy: 'yeisme.integration-test-redaction.v1',
    raw_profile_dump_persisted: false,
  },
  evidence: {
    summary: relative(projectRoot, resolve(evidenceRoot, 'summary.json')),
    command: relative(projectRoot, resolve(evidenceRoot, 'command.txt')),
    stdout: relative(projectRoot, resolve(evidenceRoot, 'stdout.log')),
    stderr: relative(projectRoot, resolve(evidenceRoot, 'stderr.log')),
    env: relative(projectRoot, resolve(evidenceRoot, 'env.json')),
    artifacts: relative(projectRoot, artifactsRoot),
  },
}

await Promise.all([
  writeJson(resolve(evidenceRoot, 'summary.json'), summary),
  writeFile(resolve(evidenceRoot, 'command.txt'), `${commandLog.join('\n')}\n`, 'utf8'),
  writeFile(resolve(evidenceRoot, 'stdout.log'), `${JSON.stringify(structuralLog, null, 2)}\n`, 'utf8'),
  writeFile(resolve(evidenceRoot, 'stderr.log'), failure === undefined ? '' : `${failure}\n`, 'utf8'),
  writeJson(resolve(evidenceRoot, 'env.json'), {
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    ci: process.env.CI === 'true',
  }),
])

process.stdout.write(`Pane profile conformance evidence: ${summary.evidence.summary}\n`)
if (failure !== undefined) process.stderr.write(`${failure}\n`)
process.exitCode = summary.exit_code

function run(command, args, cwd, env = process.env) {
  commandLog.push(`$ ${command} ${args.map((arg, index) => index === 0 && arg.startsWith('-') ? arg : '<arg>').join(' ')}`)
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 })
  if (result.error !== undefined) throw result.error
  if ((result.status ?? 1) !== 0) {
    throw new Error(`${command} exited with ${result.status ?? 1}: ${redact(result.stderr ?? result.stdout ?? '')}`)
  }
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

async function assertWebBoot(env) {
  const child = spawn('dsh', ['--profile', 'web', '--port', '0'], {
    cwd: projectRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  const booted = await new Promise((resolveBoot, rejectBoot) => {
    const timer = setTimeout(() => rejectBoot(new Error('Web profile boot timed out')), 12000)
    const onData = () => {
      if (!/dsh web: http:\/\/127\.0\.0\.1:\d+/u.test(output)) return
      clearTimeout(timer)
      resolveBoot(true)
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.once('error', error => { clearTimeout(timer); rejectBoot(error) })
    child.once('exit', (code, signal) => {
      if (/dsh web: http:\/\/127\.0\.0\.1:\d+/u.test(output)) return
      clearTimeout(timer)
      rejectBoot(new Error(`Web profile exited before boot (${code ?? 'null'}/${signal ?? 'none'}): ${redact(output)}`))
    })
  })
  if (!booted || /plugin tree failed to load|did not activate|ERR_MODULE_NOT_FOUND/iu.test(output)) {
    child.kill('SIGTERM')
    throw new Error(`Web profile did not activate Pane Workbench: ${redact(output)}`)
  }
  child.kill('SIGTERM')
  await new Promise(resolve => child.once('exit', resolve))
  structuralLog.push({ stage: 'web_boot', booted: true, loader_error: false, shutdown_requested: true })
}

function tarMembers(tarball) {
  const result = spawnSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
  if (result.error !== undefined || result.status !== 0) throw result.error ?? new Error('tar inspection failed')
  return result.stdout.trim().split('\n').filter(Boolean)
}

function countLines(input, value) {
  return input.split('\n').filter(line => line.includes(value)).length
}

function redact(value) {
  let redacted = String(value)
    .replaceAll(projectRoot, '<project>')
    .replaceAll(bundleRoot, '<bundle>')
    .replace(/https?:\/\/[^\s)]+/giu, '<url>')
    .replace(/\/(?:tmp|private)\/[^\s)]+/giu, '<temp>')
    .replace(/(api[-_]?key|authorization|password|secret|token)\s*[:=]\s*[^,\s]+/giu, '$1=<redacted>')
  if (dshHome !== undefined) redacted = redacted.replaceAll(dshHome, '<dsh-home>')
  return redacted
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
