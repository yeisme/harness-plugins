#!/usr/bin/env node

/**
 * Protocol conformance for @yeisme/dsh-pane-workbench.
 *
 * Plugin completion is host-independent: pack the bundle, check the
 * ModuleLoader face, and prove the client only binds workspace slots.
 * Official `dsh plugin add` / Web boot is optional host integration and
 * MUST NOT gate this script.
 */

import { mkdtemp, readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const bundleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(bundleRoot, '../../..')
const startedAt = new Date()
const runId = `${startedAt.toISOString().replace(/[:.]/gu, '-')}-${process.pid}-pane-protocol`
const evidenceRoot = resolve(projectRoot, 'temp/integration-test-runs', runId)
const artifactsRoot = resolve(evidenceRoot, 'artifacts')
const commandLog = []
const structuralLog = []
let status = 'passed'
let failure
let packRoot

await mkdir(artifactsRoot, { recursive: true })

try {
  run('pnpm', ['--filter', '@yeisme/dsh-client-ui-pane-workbench', 'run', 'build'], projectRoot)
  run('pnpm', ['--filter', '@yeisme/dsh-pane-workbench', 'run', 'build'], projectRoot)

  const manifest = JSON.parse(await readFile(resolve(bundleRoot, 'package.json'), 'utf8'))
  const patch = await readFile(resolve(bundleRoot, 'cordis.patch.yml'), 'utf8')
  assert(manifest.dsh?.bundle?.patch === './cordis.patch.yml', 'bundle manifest does not declare its patch')
  assert(manifest.dsh?.client?.platform === 'web', 'bundle manifest does not declare the Web client face')
  assert(manifest.dependencies?.['@yeisme/dsh-client-ui-pane-workbench'] === '0.1.0-rc.1', 'client dependency is not direct and versioned')
  assert(countLines(patch, 'id: pane-workbench') === 1, 'patch must contain one pane-workbench row')
  assert(countLines(patch, "name: '@yeisme/dsh-pane-workbench'") === 1, 'patch must mount the bundle node face')
  const patchNames = [...patch.matchAll(/^\s*name:\s*['"]([^'"]+)['"]\s*$/gmu)].map(match => match[1])
  assert(!patchNames.some(name => /sidebar|conversation|details/iu.test(name)), 'patch names a forbidden DSH single slot')
  structuralLog.push({ stage: 'bundle_contract', patch_rows: 1, forbidden_slots: false })

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
    "const fs = await import('node:fs'); const code = fs.readFileSync('./lib/client.js', 'utf8'); if (!code.startsWith('window.__ModuleLoader__.load({')) throw new Error('client bundle is not a __ModuleLoader__.load registration'); if (!code.includes('id: \"@yeisme/dsh-pane-workbench\"')) throw new Error('client bundle registers the wrong id'); if (!code.includes('factory: (require)')) throw new Error('client bundle is missing the factory face'); if (!code.includes('shell.workspace.right') || !code.includes('shell.workspace.bottom') || !code.includes('workspaceLayout')) throw new Error('client bundle is missing the V2 workspace seams'); if (/\\.inject\\(\\s*[\"']shell\\.overlay/u.test(code)) throw new Error('client bundle still registers shell.overlay'); console.log('client-bundle-v2-ok')",
  ], bundleRoot)
  assert(faceProbe.stdout.includes('client-bundle-v2-ok'), 'client bundle is not a DSH V2 workspace face')
  structuralLog.push({
    stage: 'client_bundle_face',
    loader_registration: true,
    id: '@yeisme/dsh-pane-workbench',
    workspace_slots: 2,
    overlay_registration: false,
    host_cli: 'not_required',
  })
} catch (error) {
  status = 'failed'
  failure = redact(error instanceof Error ? error.message : String(error))
}

const finishedAt = new Date()
const summary = {
  schema_version: 'yeisme.integration_test_evidence.v1',
  project: 'agent/harness-plugins',
  run_id: runId,
  layer: 'protocol-conformance',
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

process.stdout.write(`Pane protocol conformance evidence: ${summary.evidence.summary}\n`)
if (failure !== undefined) process.stderr.write(`${failure}\n`)
process.exitCode = summary.exit_code

function run(command, args, cwd, env = process.env) {
  commandLog.push(`$ ${command} ${args.map((arg, index) => index === 0 && arg.startsWith('-') ? arg : '<arg>').join(' ')}`)
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
    timeout: 300_000,
  })
  if (result.error !== undefined) throw result.error
  if (result.signal === 'SIGTERM' && result.status === null) {
    throw new Error(`${command} timed out after 300s`)
  }
  if ((result.status ?? 1) !== 0) {
    throw new Error(`${command} exited with ${result.status ?? 1}: ${redact(result.stderr ?? result.stdout ?? '')}`)
  }
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
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
  return redacted
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
