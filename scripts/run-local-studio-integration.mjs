import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, relative } from 'node:path'
import assert from 'node:assert/strict'
import { LocalStudioCLI, saveLocalStudioConfig } from '../packages/host/creator-studio/lib/index.js'

const root = resolve(import.meta.dirname, '..'), ownerRoot = resolve(root, '../../cli/eikona')
const binary = resolve(ownerRoot, 'temp/dsh-local-cli/eikona')
const started = new Date(), runID = `local-studio-${started.toISOString().replaceAll(':', '-').replaceAll('.', '-')}-${process.pid}`
const evidence = resolve(root, 'temp/integration-test-runs', runID), artifacts = resolve(evidence, 'artifacts')
await mkdir(artifacts, { recursive: true })
const scratch = await mkdtemp(resolve(tmpdir(), 'dsh-local-studio-'))
const execute = promisify(execFile), steps = []
let providerCalls = 0, exitCode = 1, failure = ''
const image = await readFile(resolve(ownerRoot, 'prompts/generic/precision-candid/french-vintage-editorial/french-vintage-editorial.png'))
const server = createServer((request, response) => {
  request.resume()
  if (request.method !== 'POST' || !request.url?.endsWith('/images/generations')) { response.writeHead(404).end(); return }
  providerCalls++
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ data: [{ b64_json: image.toString('base64') }] }))
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
const previous = new Map()
for (const name of Object.keys(process.env).filter(name => name.startsWith('EIKONA_'))) { previous.set(name, process.env[name]); delete process.env[name] }
const fixtureEnv = { EIKONA_OPENAI_BASE_URL: `http://127.0.0.1:${server.address().port}`, EIKONA_OPENAI_API_KEY: 'fixture-local-only', EIKONA_DEFAULTS_OUTPUT_ROOT: resolve(scratch, '.eikona') }
for (const [name, value] of Object.entries(fixtureEnv)) { if (!previous.has(name)) previous.set(name, undefined); process.env[name] = value }
const run = async args => {
  try { const result = await execute(binary, [...args, '--json', '--output-root', resolve(scratch, '.eikona')], { cwd: scratch, timeout: 120000, maxBuffer: 24 * 1024 * 1024 }); return JSON.parse(result.stdout) }
  catch { throw new Error(`CLI ${args.slice(0, 2).join(' ')} failed`) }
}
try {
  await run(['init', '--project'])
  const configuration = resolve(scratch, '.eikona/config.yaml')
  const registered = await run(['projects', 'register', scratch, '--config', configuration])
  const project = registered.data.project.project_id
  const created = await run(['prompts', 'create', '--project', project, '--title', 'Local studio fixture', '--template', 'Editorial cover test input', '--config', configuration])
  const prompt = created.data.prompt_id
  if (!prompt) throw new Error('Prompt response keys: ' + Object.keys(created.data ?? {}).join(',') + '; facts=' + Object.keys(created.facts ?? {}).join(','))
  assert.ok(prompt)
  const localConfig = resolve(scratch, 'studio.json')
  await saveLocalStudioConfig({ version: 1, workingDirectory: scratch, eikona: { executable: binary, config: configuration, project, outputRoot: resolve(scratch, '.eikona') } }, localConfig)
  const local = await LocalStudioCLI.open(scratch, localConfig), adapter = local.adapter('eikona'), context = local.context
  const prepared = await adapter.prepareEikonaGeneration({ prompt_id: prompt, prompt_version: 1, controls: { model_ref: 'openai/gpt-5.4-image-2', candidate_count: 1, size: '1024x1536' } }, context)
  assert.equal(prepared.status, 'ready', 'local preparation')
  assert.equal(providerCalls, 0)
  steps.push('fixed preparation, zero provider calls')
  const approved = await adapter.approveEikonaPreparation({ preparation_ref: prepared.preparationRef, expected_digest: prepared.digest, max_cost_usd: 1, max_images: 1, allow_unknown_cost: true, expires_in_seconds: 3600, confirmed: true }, context)
  assert.equal(approved.status, 'approved', 'local approval')
  assert.equal(providerCalls, 0)
  const snapshot = await adapter.snapshot(context), descriptor = snapshot.actions.find(item => item.actionId === 'eikona.generation.submit')
  assert.ok(descriptor, 'generation descriptor')
  const key = 'local-studio-integration-one'
  const request = { schema: 'pane.action-request.v1alpha1', owner: 'eikona', actionId: descriptor.actionId, descriptorRef: descriptor.descriptorRef,
    expectedTargetRef: descriptor.targetRef, expectedTargetVersion: descriptor.targetVersion, context, idempotencyKey: key,
    values: Object.fromEntries(descriptor.fields.map(field => [field.key, field.options[0].value])) }
  const receipt = await adapter.dispatch(request, context)
  assert.equal(receipt.status, 'completed', 'CLI generation receipt')
  assert.equal(providerCalls, 1)
  steps.push('explicit CLI generation, one loopback fixture call')
  const recovered = await adapter.reconcile({ schema: 'pane.action-reconcile-request.v1alpha1', owner: 'eikona', actionId: descriptor.actionId, expectedTargetRef: descriptor.targetRef, context, idempotencyKey: key }, context)
  assert.equal(recovered.receiptRef, receipt.receiptRef)
  assert.equal(providerCalls, 1)
  const runId = receipt.evidenceRefs[0]
  const review = await adapter.readEikonaReview({ runId }, context)
  assert.equal(review.status, 'ready', 'canonical local review')
  steps.push('canonical review read')
  const assets = await adapter.readEikonaAssetPage({ limit: 50 }, context)
  assert.equal(assets.status, 'ready', 'project asset history')
  assert.ok(assets.items.some(item => item.ref.startsWith(`eikona://artifacts/${runId}/`)))
  steps.push('project-scoped CLI asset history')
  const candidate = review.candidates[0]
  assert.ok(candidate?.artifactRef)
  const read = await adapter.readEikonaCandidateImage({ artifactRef: candidate.artifactRef, contentDigest: candidate.contentDigest, confirmed: true, idempotencyKey: 'local-preview-one' }, context)
  assert.equal(read.status, 'ready', 'original media read')
  assert.ok(read.value.bytes.length > 0)
  steps.push('canonical candidate review and verified original image')
  const selection = await adapter.selectEikonaCandidate({ selection: { artifactRef: candidate.artifactRef, contentDigest: candidate.contentDigest } }, context)
  assert.equal(selection.status, 'selected')
  assert.equal(providerCalls, 1)
  const selected = await adapter.snapshot(context), adoption = selected.actions.find(item => item.actionId === 'candidate.adopt')
  assert.ok(adoption, 'candidate adoption descriptor')
  const adopted = await adapter.dispatch({ ...request, actionId: adoption.actionId, descriptorRef: adoption.descriptorRef, expectedTargetRef: adoption.targetRef,
    expectedTargetVersion: adoption.targetVersion, idempotencyKey: 'local-adoption-one', values: Object.fromEntries(adoption.fields.map(field => [field.key, field.kind === 'number' ? field.min : field.options[0].value])) }, context)
  assert.equal(adopted.status, 'completed', 'explicit candidate adoption')
  assert.equal(providerCalls, 1)
  steps.push('explicit adoption, no additional generation')
  exitCode = 0
} catch (error) {
  failure = error instanceof assert.AssertionError ? `${error.message}; expected=${String(error.expected)}, actual=${String(error.actual)}` : String(error.message ?? 'Integration failed')
} finally {
  for (const [name, value] of previous) { if (value === undefined) delete process.env[name]; else process.env[name] = value }
  await new Promise(done => server.close(done))
  await rm(scratch, { recursive: true, force: true })
}
await Promise.all([
  writeFile(resolve(evidence, 'command.txt'), 'node scripts/run-local-studio-integration.mjs\n'),
  writeFile(resolve(evidence, 'stdout.log'), steps.join('\n')+'\n'),
  writeFile(resolve(evidence, 'stderr.log'), failure+'\n'),
  writeFile(resolve(evidence, 'env.json'), JSON.stringify({ node: process.version, platform: process.platform, provider: 'loopback fixture', scope: 'real CLI process and Host adapter; no paid provider', redacted: true }, null, 2)),
  writeFile(resolve(evidence, 'summary.json'), JSON.stringify({ schema_version: 'yeisme.integration_test_evidence.v1', run_id: runID, exit_code: exitCode, provider_calls: providerCalls, steps, duration_ms: Date.now()-started.getTime(), redacted: true }, null, 2)),
])
console.log(`Local studio integration: ${exitCode === 0 ? 'PASS' : 'FAIL'}; evidence: ${relative(root,evidence)}`)
if (failure) console.log(failure)
process.exitCode = exitCode
