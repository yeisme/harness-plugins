#!/usr/bin/env node

import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { installProfileRow, uninstallProfileRow, PROFILE_ROW, RADAR_HANDOFF_CONTRACT } from './bundle-metadata-source.mjs'

const bundleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(bundleRoot, '../../..')
const startedAt = new Date()
const runId = `${startedAt.toISOString().replace(/[:.]/gu, '-')}-${process.pid}-personal-radar-profile`
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
  assert(compatibility.contracts?.[0]?.id === RADAR_HANDOFF_CONTRACT, 'handoff contract id mismatch')
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

  const hostRoot = resolve(bundleRoot, '../../host/dsh-personal-radar')
  run('pnpm', ['run', 'build'], hostRoot)
  const radar = await import(pathToFileURL(resolve(hostRoot, 'lib/index.mjs')).href)

  // Fixture-based conformance: the real Radar server is unavailable in this
  // environment, so the checks run against the fake Radar provider, which
  // implements the radar.mcp.handoff.v1 lane surface from the owner fixtures.
  const fake = radar.createFakeRadarProvider()
  const probe = await radar.probeRadarCapability({
    binary: 'radar',
    checkBinary: async () => true,
    handoffSpec: fake.handoffSpec,
    capabilities: fake.capabilitiesOutput,
    paneSlotAvailable: true,
  })
  assert(probe.ready === true, 'fake provider probe must report ready')
  checks.push({ stage: 'fixture_probe', ready: probe.ready })

  const saveParsed = radar.parseRadarCommand('/drama radar save opp:demo-1')
  assert(saveParsed.ok === true, 'save intent parse failed')
  const save = await radar.dispatchRadarIntent({ binary: 'radar' }, saveParsed.intent, fake.runner)
  assert(save.ok === true && save.receipt.outcome === 'submitted', 'save must submit through the curator lane')
  const refreshParsed = radar.parseRadarCommand('/drama radar refresh')
  assert(refreshParsed.ok === true, 'refresh intent parse failed')
  const intersection = radar.validateRadarIntersection(
    { ...refreshParsed.intent, confirmed: true },
    { spec: fake.handoffSpec, capabilities: fake.capabilitiesOutput.capabilities },
  )
  assert(intersection.ok === true, 'confirmed refresh must pass the intersection')
  const refresh = await radar.dispatchRadarIntent({ binary: 'radar' }, { ...refreshParsed.intent, confirmed: true }, fake.runner)
  assert(refresh.ok === true && refresh.receipt.outcome === 'submitted', 'refresh must submit edition_build only')
  const negative = await radar.dispatchRadarIntent(
    { binary: 'radar' },
    { schema: 'dsh.radar.intent.v1', kind: 'daily_run', opportunityRefs: [], idempotencyKey: 'radar-daily_run-x', confirmed: true },
    fake.runner,
  )
  assert(negative.ok === false, 'daily_run must fail closed as an unregistered method')
  assert(fake.requests.every(request => JSON.stringify(request.args).match(/collect|daily_run/) === null), 'no collect/daily_run ever dispatched')
  checks.push({
    stage: 'fixture_conformance',
    save_outcome: save.receipt.outcome,
    refresh_outcome: refresh.receipt.outcome,
    daily_run_rejected: negative.ok === false,
    dispatch_count: fake.requests.length,
  })

  const packRoot = await mkdtemp(join(tmpdir(), 'dsh-personal-radar-pack-'))
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
  checks.push({ stage: 'acceptance_mode', fixture_based: true, real_radar_server: 'unavailable in this environment' })
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
  command: 'pnpm --dir packages/bundle/dsh-personal-radar run test:profile',
  status,
  exit_code: status === 'passed' ? 0 : 1,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  fixture_based: true,
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

process.stdout.write(`Personal Radar profile conformance evidence: ${summary.evidence.summary}\n`)
if (failure !== undefined) process.stderr.write(`${failure}\n`)
process.exitCode = summary.exit_code

function run(command, args, cwd) {
  commandLog.push(`$ ${command} ${args.map(() => '<arg>').join(' ')}`)
  const result = spawnSync(command, args, { cwd, stdio: 'pipe', encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`${command} exited ${String(result.status)}: ${redact(`${result.stdout ?? ''}${result.stderr ?? ''}`.slice(0, 800))}`)
  }
}

function countLines(text, needle) {
  return text.split('\n').filter(line => line.includes(needle)).length
}

function tarMembers(tarball) {
  const listing = spawnSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
  if (listing.status !== 0) throw new Error('tar listing failed')
  return listing.stdout.split('\n').filter(line => line.length > 0)
}

function redact(value) {
  return value
    .replace(/\/[^\s'"]+/gu, '<path>')
    .replace(/(token|secret|password|authorization)=?\S+/giu, '<redacted>')
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
