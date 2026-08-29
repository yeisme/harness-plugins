#!/usr/bin/env node

import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { installProfileRow, PROFILE_ROW, uninstallProfileRow } from './bundle-metadata-source.mjs'

const bundleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(bundleRoot, '../../..')
const startedAt = new Date()
const runId = `${startedAt.toISOString().replace(/[:.]/gu, '-')}-${process.pid}-drama-director-profile`
const evidenceRoot = resolve(projectRoot, 'temp/integration-test-runs', runId)
const artifactsRoot = resolve(evidenceRoot, 'artifacts')
const commandLog = []
const checks = []
let status = 'passed'
let failure

await mkdir(artifactsRoot, { recursive: true })

try {
  run('node', ['scripts/generate-bundle-metadata.mjs', '--check'], bundleRoot)
  run('pnpm', ['run', 'build'], bundleRoot)
  run('node', ['scripts/smoke-bundle.mjs'], bundleRoot)

  const manifest = JSON.parse(await readFile(resolve(bundleRoot, 'package.json'), 'utf8'))
  const compatibility = JSON.parse(await readFile(resolve(bundleRoot, 'dsh.compatibility.json'), 'utf8'))
  const patch = await readFile(resolve(bundleRoot, 'cordis.patch.yml'), 'utf8')
  assert(manifest.dsh?.bundle?.patch === './cordis.patch.yml', 'manifest patch path mismatch')
  assert(manifest.exports?.['./dsh.compatibility.json'] === './dsh.compatibility.json', 'compatibility export missing')
  assert(compatibility.profile?.rowId === PROFILE_ROW.id, 'compatibility row id mismatch')
  assert(/^[0-9a-f]{64}$/u.test(compatibility.contractDigest), 'contract digest is invalid')
  assert(/^[0-9a-f]{64}$/u.test(compatibility.pluginReleaseDigest), 'release digest is invalid')
  assert(countLines(patch, `id: ${PROFILE_ROW.id}`) === 1, 'profile patch row must appear exactly once')

  let profile = []
  profile = installProfileRow(profile)
  profile = installProfileRow(profile)
  assert(profile.length === 1, 'repeat install duplicated the profile row')
  profile = uninstallProfileRow(profile)
  assert(profile.length === 0, 'uninstall left the profile row behind')
  profile = installProfileRow(profile)
  assert(profile.length === 1 && profile[0].name === PROFILE_ROW.name, 'reinstall did not restore exactly one row')
  checks.push({ stage: 'profile_lifecycle', install_count: 1, uninstall_count: 0, reinstall_count: 1 })

  const packRoot = await mkdtemp(join(tmpdir(), 'dsh-ai-drama-director-pack-'))
  run('pnpm', ['pack', '--pack-destination', packRoot], bundleRoot)
  const tarballs = (await readdir(packRoot)).filter(name => name.endsWith('.tgz'))
  assert(tarballs.length === 1, 'expected exactly one packed bundle')
  const members = tarMembers(resolve(packRoot, tarballs[0]))
  const requiredMembers = [
    'package/lib/index.mjs',
    'package/lib/client.js',
    'package/cordis.patch.yml',
    'package/dsh.compatibility.json',
    'package/README.md',
    'package/package.json',
  ]
  for (const member of requiredMembers) assert(members.includes(member), `packed bundle is missing ${member}`)
  assert(!members.some(member => member.startsWith('package/src/')), 'source tree leaked into packed bundle')
  checks.push({ stage: 'packed_bundle', required_members: requiredMembers, member_count: members.length, source_tree_leaked: false })
  await writeJson(resolve(artifactsRoot, 'packed-manifest.json'), {
    package: manifest.name,
    version: manifest.version,
    contract_digest: compatibility.contractDigest,
    plugin_release_digest: compatibility.pluginReleaseDigest,
    required_members: requiredMembers,
    member_count: members.length,
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
  command: 'pnpm --dir packages/bundle/dsh-ai-drama-director run test:profile',
  status,
  exit_code: status === 'passed' ? 0 : 1,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  failure: failure ?? null,
  checks,
  redaction: { enabled: true, policy: 'yeisme.integration-test-redaction.v1' },
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
  writeFile(resolve(evidenceRoot, 'stdout.log'), `${JSON.stringify(checks, null, 2)}\n`, 'utf8'),
  writeFile(resolve(evidenceRoot, 'stderr.log'), failure === undefined ? '' : `${failure}\n`, 'utf8'),
  writeJson(resolve(evidenceRoot, 'env.json'), {
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    ci: process.env.CI === 'true',
  }),
])

process.stdout.write(`Drama Director profile conformance evidence: ${summary.evidence.summary}\n`)
if (failure !== undefined) process.stderr.write(`${failure}\n`)
process.exitCode = summary.exit_code

function run(command, args, cwd) {
  commandLog.push(`$ ${command} ${args.map(() => '<arg>').join(' ')}`)
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 300_000 })
  if (result.error !== undefined) throw result.error
  if (result.signal === 'SIGTERM' && result.status === null) throw new Error(`${command} timed out after 300s`)
  if ((result.status ?? 1) !== 0) throw new Error(`${command} exited with ${result.status ?? 1}: ${redact(result.stderr || result.stdout)}`)
  return result
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
  return String(value)
    .replaceAll(projectRoot, '<project>')
    .replaceAll(bundleRoot, '<bundle>')
    .replace(/https?:\/\/[^\s)]+/giu, '<url>')
    .replace(/\/(?:tmp|private)\/[^\s)]+/giu, '<temp>')
    .replace(/(api[-_]?key|authorization|password|secret|token)\s*[:=]\s*[^,\s]+/giu, '$1=<redacted>')
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

