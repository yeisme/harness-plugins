import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ownerRoot = resolve(root, '../../cli/sonora')
const startedAt = new Date()
const runId = `sonora-owner-http-${startedAt.toISOString().replace(/[-:.]/g, '')}-${process.pid}`
const directory = resolve(root, 'temp/integration-test-runs', runId)
mkdirSync(resolve(directory, 'artifacts'), { recursive: true })
const binary = resolve(directory, 'artifacts', 'subtitle-fixture')
const require = createRequire(resolve(root, 'packages/host/creator-studio/package.json'))
const checks = []
let stdout = '', stderr = '', exitCode = 0, fixture, fixtureExited, ctx
const commands = ['pnpm --filter @yeisme/dsh-creator-studio-host build', 'CGO_ENABLED=0 go build -o <evidence>/artifacts/subtitle-fixture ./internal/integrationtest/subtitlefixture', 'SONORA_SUBTITLE_FIXTURE=1 <evidence>/artifacts/subtitle-fixture']
const redact = value => String(value ?? '').replaceAll(ownerRoot, '[OWNER_ROOT]').replaceAll(root, '[PROJECT_ROOT]')
  .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/((?:token|password|cookie|secret)\s*[:=]\s*)\S+/gi, '$1[REDACTED]')
function build(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: 120_000 })
  stdout += result.stdout ?? ''; stderr += result.stderr ?? ''
  assert.equal(result.status, 0, 'fixture dependency build failed')
}
try {
  build('pnpm', ['--filter', '@yeisme/dsh-creator-studio-host', 'build'], root)
  build('go', ['build', '-o', binary, './internal/integrationtest/subtitlefixture'], ownerRoot, { ...process.env, CGO_ENABLED: '0' })
  fixture = spawn(binary, [], { cwd: ownerRoot, env: { ...process.env, SONORA_SUBTITLE_FIXTURE: '1' }, stdio: ['pipe', 'pipe', 'pipe'] })
  fixtureExited = new Promise(done => { fixture.once('exit', code => done(code)); fixture.once('error', () => done(-1)) })
  fixture.stderr.on('data', chunk => { stderr += chunk })
  const ready = await new Promise((done, reject) => {
    let text = ''
    const timer = setTimeout(() => reject(new Error('fixture readiness timeout')), 15_000)
    fixture.once('error', error => { clearTimeout(timer); reject(error) })
    fixture.once('exit', () => { clearTimeout(timer); reject(new Error('fixture exited before readiness')) })
    fixture.stdout.on('data', chunk => {
      text += chunk
      if (!text.includes('\n')) return
      clearTimeout(timer)
      try { done(JSON.parse(text.split('\n')[0])) } catch { reject(new Error('fixture readiness contract mismatch')) }
    })
  })
  assert.equal(ready.source, 'fixture_transcription')
  assert.equal(new URL(ready.base_url).hostname, '127.0.0.1')
  const { Context } = await import(pathToFileURL(require.resolve('@deepseek-ai/cordis')).href)
  const { CreatorStudioGateway, CreatorStudioOwnerDirectory, CREATOR_STUDIO_EXPECTED_CONTEXT, CREATOR_STUDIO_OWNER_DIRECTORY,
    SonoraSubtitleExportClient, createSonoraSubtitleExportAdapter } = await import(pathToFileURL(resolve(root, 'packages/host/creator-studio/lib/index.js')).href)
  const scope = { tenantRef: 'tenant:fixture', workspaceRef: 'workspace:fixture', projectRef: 'project:fixture', sessionRef: 'session:fixture',
    principalRef: 'principal:fixture', membershipRevision: '1', installationRef: 'installation:fixture', pluginDigest: 'digest:fixture', policyRevision: '1', runtimeGeneration: '1', revision: '1' }
  const connection = identity => async context => ({ context, baseURL: ready.base_url, headers: {
    Authorization: `Bearer ${identity}`, 'X-Sonora-Session': 'fixture-session', 'X-Sonora-Timestamp': String(Date.now()), 'X-Sonora-Nonce': randomUUID(),
  } })
  let dropNextPost = false, selected = true
  const client = new SonoraSubtitleExportClient(connection('fixture-workload'), async (url, options) => {
    const response = await fetch(url, options)
    if (options.method === 'POST' && dropNextPost) { dropNextPost = false; await response.body?.cancel(); throw new Error('fixture lost response after owner commit') }
    return response
  })
  const adapter = createSonoraSubtitleExportAdapter(client, async () => selected ? ready.track_ref : undefined)
  const catalog = await client.readTranscriptionCatalog(scope)
  assert.equal(catalog.status, 'ready')
  assert.equal(catalog.resource.validation_level, 'capability_probe')
  assert.equal(catalog.resource.diagnostics_available, true)
  assert.equal(catalog.resource.profiles.length, 1)
  assert.equal(catalog.resource.profiles[0].fixture, true)
  assert.deepEqual(catalog.resource.profiles[0].timestamp_modes, ['segment'])
  checks.push('actual capability discovery retains fixture, probe and timestamp precision facts')
  ctx = new Context()
  const owners = new CreatorStudioOwnerDirectory()
  owners.register(adapter)
  ctx.provide(CREATOR_STUDIO_EXPECTED_CONTEXT, scope)
  ctx.provide(CREATOR_STUDIO_OWNER_DIRECTORY, owners)
  await ctx.plugin(CreatorStudioGateway)
  const gateway = ctx.get('creatorStudio')
  assert.deepEqual(await gateway.readTranscriptionCatalog(scope), catalog.resource)
  checks.push('independent Gateway capability read matches the actual owner catalog')
  const snapshot = await gateway.snapshot()
  const projection = snapshot.owners.find(owner => owner.owner === 'sonora')
  assert.equal(projection.status, 'ready')
  assert.equal(projection.actions.length, 1)
  assert.ok(!JSON.stringify(snapshot).includes('Fixture subtitle.'))
  checks.push('actual owner track/review projected without cue text')
  const descriptor = projection.actions[0]
  const request = { schema: 'pane.action-request.v1alpha1', owner: 'sonora', actionId: descriptor.actionId, descriptorRef: descriptor.descriptorRef,
    expectedTargetRef: descriptor.targetRef, expectedTargetVersion: descriptor.targetVersion, context: scope, idempotencyKey: 'owner-http-srt-key', values: { format: 'srt' } }
  const first = await gateway.dispatch(request)
  assert.equal(first.status, 'completed', `SRT export did not complete: ${first.reconcileReason ?? first.summary}`)
  const content = await gateway.readArtifactContent(first.outputArtifacts[0])
  assert.equal(content.content, '1\n00:00:00,000 --> 00:00:03,000\nFixture subtitle.\n\n')
  checks.push('DSH gateway -> Sonora HTTP -> actual SQLite export -> verified SRT read')
  dropNextPost = true
  const lost = { ...request, idempotencyKey: 'owner-http-vtt-key', values: { format: 'vtt' } }
  assert.equal((await gateway.dispatch(lost)).status, 'unknown')
  selected = false
  const reconciliation = { schema: 'pane.action-reconcile-request.v1alpha1', owner: 'sonora', actionId: descriptor.actionId,
    expectedTargetRef: descriptor.targetRef, context: scope, idempotencyKey: lost.idempotencyKey }
  const recovered = await gateway.reconcile(reconciliation)
  assert.equal(recovered.status, 'completed')
  const vtt = await gateway.readArtifactContent(recovered.outputArtifacts[0])
  assert.equal(vtt.content, 'WEBVTT\n\n1\n00:00:00.000 --> 00:00:03.000\nFixture subtitle.\n\n')
  checks.push('lost POST response recovered from original key without current selection')
  assert.equal((await gateway.reconcile({ ...reconciliation, idempotencyKey: 'unobserved-original-key' })).status, 'unknown')
  assert.equal((await gateway.dispatch({ ...request, context: { ...scope, projectRef: 'project:other' } })).status, 'reconcile_required')
  const otherActor = new SonoraSubtitleExportClient(connection('fixture-other-actor'))
  assert.equal((await otherActor.lookupOriginal(scope, request.idempotencyKey)).status, 'unknown')
  const stats = await (await fetch(new URL('/__fixture/stats', ready.base_url))).json()
  assert.equal(stats.export_posts, 2)
  checks.push('cross-project/actor and missing-key checks; owner observed exactly two export POSTs')
  stdout += `Verified ${checks.length} owner HTTP checkpoints.\n`
} catch (error) {
  exitCode = 1
  stderr += `${error.stack ?? error}\n`
} finally {
  try { await ctx?.fiber.dispose() } catch { exitCode = 1; stderr += 'DSH fixture disposal failed\n' }
  if (fixture) {
    fixture.stdin.end()
    const timer = setTimeout(() => fixture.kill('SIGTERM'), 5000)
    const code = await fixtureExited
    clearTimeout(timer)
    if (code !== 0) { exitCode = 1; stderr += 'Sonora fixture did not exit cleanly\n' }
  }
  writeFileSync(resolve(directory, 'command.txt'), `${commands.join('\n')}\n`)
  writeFileSync(resolve(directory, 'stdout.log'), redact(stdout))
  writeFileSync(resolve(directory, 'stderr.log'), redact(stderr))
  writeFileSync(resolve(directory, 'env.json'), JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, cgo: 'disabled', provider_calls: 'disabled' }, null, 2))
  writeFileSync(resolve(directory, 'summary.json'), JSON.stringify({ runId, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(),
    status: exitCode === 0 ? 'passed' : 'failed', exitCode, layer: 'system', checks,
    notes: ['Actual DSH host and Sonora HTTP/application/SQLite; fixture transcription and fixture identity.', 'No real ASR/audio provider or browser; temporary owner project removed when helper exits.'],
  }, null, 2))
  console.log(`Sonora owner HTTP evidence: ${relative(root, directory)}`)
  process.exitCode = exitCode
}
