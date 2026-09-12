import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const browserMode = process.argv.includes('--browser')
if (process.argv.slice(2).some(arg => arg !== '--browser')) throw Error('Supported option: --browser')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ownerRoot = resolve(root, '../../cli/auctra')
const startedAt = new Date()
const runId = `auctra-owner-http-${startedAt.toISOString().replace(/[-:.]/g, '')}-${process.pid}`
const directory = resolve(root, 'temp/integration-test-runs', runId)
mkdirSync(resolve(directory, 'artifacts'), { recursive: true })
const binary = resolve(directory, 'artifacts', 'working-copy-fixture')
const require = createRequire(resolve(root, 'packages/host/creator-studio/package.json'))
const checks = []
let visualOrigin
let stdout = '', stderr = '', exitCode = 0, fixture, fixtureExited, ctx, visualServer, visualExited, browser, zoomContext, zoomDirectory
const focusedTests = ['tests/auctra-editor-recovery.spec.ts', 'tests/operation-recovery-store.spec.ts', 'tests/operation-recovery-storage.integration.spec.ts', 'tests/candidate-history.spec.ts', 'tests/auctra-candidate-page.spec.ts', 'tests/auctra-candidate-content.spec.ts', 'tests/gateway.spec.ts', 'tests/auctra-working-copy.spec.ts', 'tests/auctra-working-copy-client.spec.ts', 'tests/auctra-working-copy-receipt.spec.ts', 'tests/auctra-working-copy-save.spec.ts', 'tests/auctra-screenplay-draft-save.spec.ts', 'tests/auctra-working-copy-structure.spec.ts', 'tests/auctra-working-copy-candidate.spec.ts', 'tests/auctra-working-copy-adapter.spec.ts']
const commands = [`pnpm --filter @yeisme/dsh-creator-studio-host exec vitest run ${focusedTests.join(' ')}`, 'pnpm --filter @yeisme/dsh-creator-studio-host build', 'CGO_ENABLED=0 go build -o <evidence>/artifacts/working-copy-fixture ./internal/integrationtest/workingcopyfixture', 'AUCTRA_WORKING_COPY_FIXTURE=1 <evidence>/artifacts/working-copy-fixture']
const redact = value => String(value ?? '').replaceAll(ownerRoot, '[OWNER_ROOT]').replaceAll(root, '[PROJECT_ROOT]')
  .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/((?:token|password|cookie|secret)\s*[:=]\s*)\S+/gi, '$1[REDACTED]')
function build(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: 120_000 })
  stdout += result.stdout ?? ''; stderr += result.stderr ?? ''
  assert.equal(result.status, 0, 'fixture dependency build failed')
}
try {
  commands.unshift('pnpm --filter @yeisme/dsh-pane-protocol build', 'pnpm --filter @yeisme/dsh-pane-protocol test')
  build('pnpm', ['--filter', '@yeisme/dsh-pane-protocol', 'build'], root)
  build('pnpm', ['--filter', '@yeisme/dsh-pane-protocol', 'test'], root)
  const { encodePaneActionValues } = await import(pathToFileURL(resolve(root, 'packages/host/pane-protocol/lib/index.mjs')).href)
  build('pnpm', ['--filter', '@yeisme/dsh-creator-studio-host', 'exec', 'vitest', 'run', ...focusedTests], root)
  build('pnpm', ['--filter', '@yeisme/dsh-creator-studio-host', 'build'], root)
  build('go', ['build', '-o', binary, './internal/integrationtest/workingcopyfixture'], ownerRoot, { ...process.env, CGO_ENABLED: '0' })
  fixture = spawn(binary, [], { cwd: ownerRoot, env: { ...process.env, AUCTRA_WORKING_COPY_FIXTURE: '1' }, stdio: ['pipe', 'pipe', 'pipe'] })
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
  assert.equal(ready.source, 'fixture_text')
  const { AuctraWorkingCopyClient, AUCTRA_WORKING_COPY_SCHEMA_DIGEST, AUCTRA_EDITOR_RECOVERY_SCHEMA_DIGEST, createAuctraWorkingCopyAdapter, normalizeAuctraWorkingCopyReceipt,
    CreatorStudioGateway, CreatorStudioOwnerDirectory, CREATOR_STUDIO_EXPECTED_CONTEXT, CREATOR_STUDIO_OWNER_DIRECTORY } = await import(pathToFileURL(resolve(root, 'packages/host/creator-studio/lib/index.js')).href)
  const scope = { tenantRef: 'tenant:fixture', workspaceRef: 'workspace:fixture', projectRef: 'project:fixture', sessionRef: 'session:fixture',
    principalRef: 'principal:fixture', membershipRevision: '1', installationRef: 'installation:fixture', pluginDigest: 'digest:fixture', policyRevision: '1', runtimeGeneration: '1', revision: '1' }
  const binding = { context: scope, baseURL: ready.base_url, ownerProjectRef: ready.project_ref, headers: { Authorization: 'Bearer fixture-only' },
    admission: { consumer: 'dsh', schemaDigest: AUCTRA_WORKING_COPY_SCHEMA_DIGEST, approved: true, editorRecoveryDigest: AUCTRA_EDITOR_RECOVERY_SCHEMA_DIGEST } }
  const client = new AuctraWorkingCopyClient(async () => binding)
  const opened = await client.open(scope, ready.unit_ref)
  assert.equal(opened.status, 'ready')
  assert.equal(opened.value.content, '第一段正文。😀\r\n第二段正文。')
  assert.equal(JSON.stringify(opened.value).includes(ready.project_ref), false)
  checks.push('actual owner HTTP open preserves Unicode/CRLF and strips private project binding')
  const recoveryBinding = { ...binding, admission: { ...binding.admission, writeApproved: true, editorRecoveryDigest: AUCTRA_EDITOR_RECOVERY_SCHEMA_DIGEST } }
  let recoveryPosts = 0, loseRecovery = false
  const recoveryClient = new AuctraWorkingCopyClient(async () => recoveryBinding, async (url, options) => {
    if (options.method === 'POST' && String(url).includes('/editor-recovery-drafts/save')) recoveryPosts++
    const response = await fetch(url, options)
    if (loseRecovery && options.method === 'POST') { loseRecovery = false; await response.body?.cancel(); throw Error('fixture recovery response lost') }
    return response
  })
  const recoveryInput = { unitRef: ready.unit_ref, base: opened.value, content: 'Unsubmitted recovery 😀\r\n' }
  const recoverySaved = await recoveryClient.saveRecoveryDraft(scope, recoveryInput)
  assert.equal(recoverySaved.status, 'ready')
  assert.equal(JSON.stringify(recoverySaved.value).includes(recoveryInput.content), false)
  assert.equal(JSON.stringify(recoverySaved.value).includes(ready.project_ref), false)
  const recoveryFound = await recoveryClient.listRecoveryDrafts(scope, { unitRef: ready.unit_ref })
  assert.equal(recoveryFound.status, 'ready')
  assert.equal(recoveryFound.value.drafts.length, 1)
  const recoveryRead = await recoveryClient.readRecoveryDraft(scope, recoveryFound.value.drafts[0])
  assert.equal(recoveryRead.status, 'ready')
  assert.equal(recoveryRead.value.content, recoveryInput.content)
  loseRecovery = true
  assert.equal((await recoveryClient.saveRecoveryDraft(scope, { ...recoveryInput, content: 'Next unsubmitted buffer', previous: recoverySaved.value.draft })).status, 'unconfirmed')
  const recoveredPage = await new AuctraWorkingCopyClient(async () => recoveryBinding).listRecoveryDrafts(scope)
  assert.equal(recoveredPage.status, 'ready')
  assert.equal(recoveredPage.value.drafts[0].revision, 2)
  assert.equal((await recoveryClient.saveRecoveryDraft(scope, { ...recoveryInput, previous: recoverySaved.value.draft })).status, 'conflict')
  assert.equal(recoveryPosts, 3)
  const resumedScope = { ...scope, sessionRef: 'session:recovery-resumed' }
  const resumedClient = new AuctraWorkingCopyClient(async () => ({ ...recoveryBinding, context: resumedScope }))
  const resumedDraft = await resumedClient.readRecoveryDraft(resumedScope, recoveredPage.value.drafts[0])
  assert.equal(resumedDraft.status, 'ready')
  assert.equal(resumedDraft.value.content, 'Next unsubmitted buffer')
  let recoverySelection = { unitRef: ready.unit_ref, artifact: opened.value.artifact, canSave: true }
  const recoveryAdapter = createAuctraWorkingCopyAdapter(recoveryClient, async () => recoverySelection)
  const adapterDrafts = await recoveryAdapter.listAuctraRecoveryDrafts({}, scope)
  assert.equal(adapterDrafts.status, 'ready')
  assert.equal(adapterDrafts.value.drafts.length, 1)
  const adapterRead = await recoveryAdapter.readAuctraRecoveryDraft(adapterDrafts.value.drafts[0], scope)
  assert.equal(adapterRead.status, 'ready')
  assert.equal(adapterRead.value.content, 'Next unsubmitted buffer')
  recoverySelection = undefined
  assert.equal((await recoveryAdapter.readAuctraRecoveryDraft(adapterDrafts.value.drafts[0], scope)).status, 'permission_denied')
  assert.equal((await recoveryAdapter.listAuctraRecoveryDrafts({}, scope)).status, 'permission_denied')
  checks.push('actual recovery owner adapter scopes discovery to the selected unit and rejects reads after selection removal')

  assert.deepEqual(await client.open(scope, ready.unit_ref), opened)
  checks.push('actual owner recovery create/list/read, lost update response discovery in a fresh client, stale CAS conflict, cross-session recovery and unchanged Working Copy; no automatic retry')

  assert.deepEqual(await client.open(scope, ready.unit_ref, opened.value.contentRevision), opened)
  assert.equal((await client.open(scope, ready.unit_ref, 'outdated')).status, 'unconfirmed')
  checks.push('fixed-version read and stale-version rejection')
  const wrongProject = new AuctraWorkingCopyClient(async () => ({ ...binding, ownerProjectRef: 'other-project' }))
  assert.equal((await wrongProject.open(scope, ready.unit_ref)).status, 'unconfirmed')
  const unauthorized = new AuctraWorkingCopyClient(async () => ({ ...binding, headers: {} }))
  assert.equal((await unauthorized.open(scope, ready.unit_ref)).status, 'permission_denied')
  checks.push('actual owner authorization and private project mismatch reject body release')
  let requested = false
  const unadmitted = new AuctraWorkingCopyClient(async () => ({ ...binding, admission: undefined }), async () => { requested = true; throw Error('unexpected request') })
  assert.equal((await unadmitted.open(scope, ready.unit_ref)).status, 'needs_contract')
  assert.equal(requested, false)
  checks.push('default unadmitted consumer performs no owner IO')
  const { Context } = await import(pathToFileURL(require.resolve('@deepseek-ai/cordis')).href)
  ctx = new Context()
  const hostStorageRoot = resolve(directory, 'artifacts', 'host-storage')
  const loadStorageModule = path => import(pathToFileURL(resolve(root, 'temp/dsh-unified-host-source', path)).href)
  const storageModule = await loadStorageModule('packages/storage/storage/lib/index.js')
  const jsonStorageModule = await loadStorageModule('packages/storage/storage-json/lib/index.js')
  const domainStorageModule = await loadStorageModule('packages/storage/storage-domain/lib/index.js')
  await ctx.plugin(storageModule.default)
  await ctx.plugin({ name: 'owner-http-host-json', inject: ['storage'], apply: context => jsonStorageModule.apply(context, { root: hostStorageRoot }) })
  await ctx.plugin({ name: 'owner-http-host-domain', inject: ['storage'], apply: context => domainStorageModule.apply(context, { backend: 'json', routes: {} }) })
  let selected = true
  const owners = new CreatorStudioOwnerDirectory()
  owners.register(createAuctraWorkingCopyAdapter(client, async () => selected ? { unitRef: ready.unit_ref, artifact: opened.value.artifact } : undefined))
  ctx.provide(CREATOR_STUDIO_EXPECTED_CONTEXT, scope)
  ctx.provide(CREATOR_STUDIO_OWNER_DIRECTORY, owners)
  await ctx.plugin(CreatorStudioGateway)
  const gateway = ctx.get('creatorStudio')
  const gatewayRecovery = await gateway.listAuctraRecoveryDrafts({ limit: 1, artifact: opened.value.artifact })
  assert.equal(gatewayRecovery.status, 'ready')
  assert.equal(gatewayRecovery.value.drafts.length, 1)
  assert.equal((await gateway.listAuctraRecoveryDrafts({ artifact: { ...opened.value.artifact, ref: opened.value.artifact.ref + '-other' } })).status, 'permission_denied')
  assert.equal((await gateway.listAuctraRecoveryDrafts({ artifact: { ...opened.value.artifact, version: 'wrong-version' } })).status, 'permission_denied')
  const gatewayBody = await gateway.readAuctraRecoveryDraft(gatewayRecovery.value.drafts[0])
  assert.equal(gatewayBody.status, 'ready')
  assert.equal(gatewayBody.value.content, 'Next unsubmitted buffer')
  assert.equal((await gateway.listAuctraRecoveryDrafts({ client_ref: 'browser-forged' })).status, 'invalid_input')
  assert.equal((await gateway.readAuctraRecoveryDraft({ ...gatewayRecovery.value.drafts[0], revision: 99 })).status, 'unconfirmed')
  checks.push('actual Gateway recovery metadata/body boundary, strict query rejection and fixed draft revision check')

  const snapshot = await gateway.snapshot()
  const projection = snapshot.owners.find(owner => owner.owner === 'auctra')
  assert.equal(projection.artifactWorkspace.status, 'partial')
  assert.equal(projection.artifactWorkspace.artifacts[0].artifact.ref, opened.value.artifact.ref)
  assert.equal(projection.actions.length, 0)
  assert.equal(JSON.stringify(snapshot).includes(opened.value.content), false)
  assert.equal(JSON.stringify(snapshot).includes(ready.project_ref), false)
  assert.deepEqual(await gateway.readArtifactContent(opened.value.artifact), opened.value)
  assert.equal(await gateway.readArtifactContent({ ...opened.value.artifact, ref: 'auctra:working-copy:forged' }), null)
  assert.equal(await gateway.readArtifactContent({ ...opened.value.artifact, mediaType: 'text/html' }), null)
  selected = false
  assert.equal(await gateway.readArtifactContent(opened.value.artifact), null)
  checks.push('actual Gateway/adapter fixed selection: metadata-only snapshot, explicit body read, forged or removed selection rejected')
  let putCount = 0, loseResponse = false, adoptCount = 0, loseAdoptResponse = false
  const writable = { ...binding, admission: { ...binding.admission, writeApproved: true, candidateRequestRecovery: 'v1alpha1' } }
  const writer = new AuctraWorkingCopyClient(async () => writable, async (url, options) => {
    if (options.method === 'PUT') putCount++
    const isAdopt = options.method === 'POST' && /\/candidates\/[^/]+\/apply\?/.test(String(url))
    if (isAdopt) adoptCount++
    const response = await fetch(url, options)
    if (isAdopt && loseAdoptResponse) { loseAdoptResponse = false; await response.body?.cancel(); throw Error('fixture adoption response lost after commit') }
    if (options.method === 'PUT' && loseResponse) { loseResponse = false; await response.body?.cancel(); throw Error('fixture response lost after commit') }
    return response
  })
  const save = { unitRef: ready.unit_ref, base: opened.value, content: `First 😀\r\n${opened.value.content}`, idempotencyKey: 'receipt-original' }
  assert.equal((await client.save(scope, save)).status, 'needs_contract')
  const first = await writer.save(scope, save)
  assert.equal(first.status, 'ready')
  assert.equal(first.value.outcome, 'applied')
  const firstRead = await writer.open(scope, ready.unit_ref, first.value.contentRevision)
  assert.equal(firstRead.status, 'ready')
  assert.equal(firstRead.value.content, save.content)
  loseResponse = true
  const second = { ...save, base: firstRead.value, content: `Later edit ${save.content}`, idempotencyKey: 'receipt-later' }
  assert.equal((await writer.save(scope, second)).status, 'unconfirmed')
  assert.equal(putCount, 2)
  const lookup = key => writer.reconcileSave(scope, { unitRef: ready.unit_ref, artifact: opened.value.artifact, idempotencyKey: key })
  const recovered = await lookup('receipt-later')
  assert.equal(recovered.status, 'ready')
  assert.equal(recovered.value.outcome, 'replayed')
  const latest = await writer.open(scope, ready.unit_ref, recovered.value.contentRevision)
  assert.equal(latest.status, 'ready')
  assert.equal(latest.value.content, second.content)
  const original = await lookup('receipt-original')
  assert.equal(original.status, 'ready')
  assert.equal(original.value.contentRevision, first.value.contentRevision)
  assert.equal(original.value.byteLength, first.value.byteLength)
  assert.equal((await lookup('never-submitted')).status, 'unconfirmed')
  assert.equal(putCount, 2)
  checks.push('actual DSH client saves Unicode, reconciles lost response by original key without extra PUT, and retains both original receipt versions')
  assert.equal((await writer.save(scope, { ...save, idempotencyKey: 'stale-base' })).status, 'conflict')
  assert.equal(putCount, 3)
  assert.equal((await writer.open(scope, ready.unit_ref)).value.contentRevision, recovered.value.contentRevision)
  checks.push('typed stale-base conflict performs no mutation and preserves the newer document')
  await ctx.fiber.dispose()
  ctx = new Context()
  await ctx.plugin(storageModule.default)
  await ctx.plugin({ name: 'owner-http-write-json', inject: ['storage'], apply: context => jsonStorageModule.apply(context, { root: hostStorageRoot }) })
  await ctx.plugin({ name: 'owner-http-write-domain', inject: ['storage'], apply: context => domainStorageModule.apply(context, { backend: 'json', routes: {} }) })
  const writeOwners = new CreatorStudioOwnerDirectory()
  let selection = { unitRef: ready.unit_ref, artifact: latest.value.artifact, canSave: true }
  selected = true
  let disposeWriteAdapter = writeOwners.register(createAuctraWorkingCopyAdapter(writer, async () => selected ? selection : undefined,
    async ref => ref === selection.artifact.ref ? selection : undefined))
  ctx.provide(CREATOR_STUDIO_EXPECTED_CONTEXT, scope)
  ctx.provide(CREATOR_STUDIO_OWNER_DIRECTORY, writeOwners)
  await ctx.plugin(CreatorStudioGateway)
  const writeGateway = ctx.get('creatorStudio')
  const gatewayBuffer = await writeGateway.saveAuctraRecoveryDraft({ base: latest.value, content: 'Gateway unsubmitted buffer' })
  assert.equal(gatewayBuffer.status, 'ready')
  assert.equal(JSON.stringify(gatewayBuffer).includes('Gateway unsubmitted buffer'), false)
  assert.equal((await writer.open(scope, ready.unit_ref)).value.content, latest.value.content)
  const changedBuffer = await writeGateway.saveAuctraRecoveryDraft({ base: latest.value, content: 'Updated gateway buffer', previous: gatewayBuffer.value.draft })
  assert.equal(changedBuffer.status, 'ready')
  assert.equal(changedBuffer.value.draft.revision, 2)
  assert.equal((await writeGateway.saveAuctraRecoveryDraft({ base: latest.value, content: 'stale buffer', previous: gatewayBuffer.value.draft })).status, 'conflict')
  selected = false
  assert.equal((await writeGateway.saveAuctraRecoveryDraft({ base: latest.value, content: 'removed selection' })).status, 'permission_denied')
  selected = true
  checks.push('actual Gateway recovery save/update/CAS conflict and removed-selection rejection; no document mutation or body in receipts')

  const writeSnapshot = await writeGateway.snapshot()
  const writeProjection = writeSnapshot.owners.find(owner => owner.owner === 'auctra')
  const action = writeProjection.actions.find(item => item.actionId === 'working-copy.save')
  assert.ok(action)
  assert.equal(writeProjection.artifactWorkspace.artifacts[0].actions.saveDraft.descriptorRef, action.descriptorRef)
  const actionRequest = { schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: action.actionId, descriptorRef: action.descriptorRef,
    expectedTargetRef: action.targetRef, expectedTargetVersion: action.targetVersion, context: scope, idempotencyKey: 'gateway-save-key',
    values: { body: 'Gateway draft 😀', content_revision: latest.value.contentRevision } }
  for (const invalid of [
    { ...actionRequest, context: { ...scope, projectRef: 'project:other' } },
    { ...actionRequest, values: { ...actionRequest.values, content_revision: 'stale-version' } },
    { ...actionRequest, values: { ...actionRequest.values, body: 'x'.repeat(16_385) } },
  ]) assert.notEqual((await writeGateway.dispatch(invalid)).status, 'completed')
  assert.equal(putCount, 3)
  const saved = await writeGateway.dispatch(actionRequest)
  assert.equal(saved.status, 'completed')
  const output = saved.outputArtifacts[0]
  assert.notEqual(output.version, action.targetVersion)
  assert.equal((await writeGateway.readArtifactContent(output)).content, actionRequest.values.body)
  const afterSave = (await writeGateway.snapshot()).owners.find(owner => owner.owner === 'auctra')
  assert.equal(afterSave.artifactWorkspace.artifacts[0].artifact.version, action.targetVersion)
  assert.equal(afterSave.actions.length, 0)
  selected = false
  const lookedUp = await writeGateway.reconcile({ schema: 'pane.action-reconcile-request.v1alpha1', owner: 'auctra', actionId: action.actionId,
    expectedTargetRef: action.targetRef, context: scope, idempotencyKey: actionRequest.idempotencyKey })
  assert.equal(lookedUp.status, 'completed')
  assert.equal(lookedUp.outputArtifacts[0].version, output.version)
  assert.equal(putCount, 4)
  checks.push('Gateway save action publishes the new fixed version, preserves old selection, and reconciles after selection closes without another PUT')
  // Compatibility screenplay draft leg: mutations ride text.draft.save while the
  // generic working-copy PUT stays owner-rejected for drafts.
  const spRef = ready.screenplay_ref
  assert.ok(spRef, 'fixture must report a compatibility screenplay draft ref')
  const spOpened = await writer.open(scope, spRef)
  assert.equal(spOpened.status, 'ready')
  assert.equal(spOpened.value.content, 'INT. 房间 - 夜\r\n\r\n第一场对白。\r\n')
  assert.equal(JSON.stringify(spOpened.value).includes(ready.project_ref), false)
  assert.equal((await writer.save(scope, { unitRef: spRef, base: spOpened.value, content: 'x', idempotencyKey: 'sp-generic' })).status, 'invalid_input')
  let spPut = 0, spLoseResponse = false
  const spWriter = new AuctraWorkingCopyClient(async () => writable, async (url, options) => {
    if (options.method === 'PUT' && String(url).includes('/text-units/')) spPut++
    const response = await fetch(url, options)
    if (options.method === 'PUT' && String(url).includes('/text-units/') && spLoseResponse) {
      spLoseResponse = false
      await response.body?.cancel()
      throw Error('draft save response lost after commit')
    }
    return response
  })
  const spRequest = { draftRef: spRef.slice('screenplay-draft:'.length), base: spOpened.value, content: 'INT. 房间 - 日\r\n\r\n改写后的对白。\r\n', idempotencyKey: 'sp-receipt-original' }
  const spFirst = await spWriter.saveScreenplayDraft(scope, spRequest)
  assert.equal(spFirst.status, 'ready')
  assert.equal(spFirst.value.outcome, 'applied')
  const spReplay = await spWriter.saveScreenplayDraft(scope, spRequest)
  assert.equal(spReplay.status, 'ready')
  assert.equal(spReplay.value.outcome, 'replayed')
  assert.equal(spReplay.value.contentRevision, spFirst.value.contentRevision)
  const spAdvanced = await spWriter.open(scope, spRef)
  assert.equal(spAdvanced.status, 'ready')
  spLoseResponse = true
  const spLater = { ...spRequest, base: spAdvanced.value, content: '更深一层的剧本改写。\r\n', idempotencyKey: 'sp-receipt-later' }
  assert.equal((await spWriter.saveScreenplayDraft(scope, spLater)).status, 'unconfirmed')
  const spRecovered = await spWriter.saveScreenplayDraft(scope, spLater)
  assert.equal(spRecovered.status, 'ready')
  assert.equal(spRecovered.value.outcome, 'replayed')
  assert.equal((await spWriter.saveScreenplayDraft(scope, { ...spRequest, idempotencyKey: 'sp-stale' })).status, 'conflict')
  // The text unit keeps its generic-leg head: draft saves never touch other units.
  assert.equal((await spWriter.open(scope, ready.unit_ref)).value.contentRevision, output.version)
  checks.push('screenplay draft: text.draft.save applies, replays by original key, recovers a lost response without a second mutation, and stale bases conflict closed')
  const spContext = new Context()
  const spOwners = new CreatorStudioOwnerDirectory()
  let spSelected = true
  const spSelection = { unitRef: spRef, artifact: (await spWriter.open(scope, spRef)).value.artifact, canSave: true }
  spOwners.register(createAuctraWorkingCopyAdapter(spWriter, async () => spSelected ? spSelection : undefined))
  spContext.provide(CREATOR_STUDIO_EXPECTED_CONTEXT, scope)
  spContext.provide(CREATOR_STUDIO_OWNER_DIRECTORY, spOwners)
  await spContext.plugin(CreatorStudioGateway)
  const spGateway = spContext.get('creatorStudio')
  const spSnapshot = await spGateway.snapshot()
  const spProjection = spSnapshot.owners.find(owner => owner.owner === 'auctra')
  const spAction = spProjection.actions.find(item => item.actionId === 'working-copy.save')
  assert.ok(spAction)
  const spActionRequest = { schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: spAction.actionId, descriptorRef: spAction.descriptorRef,
    expectedTargetRef: spAction.targetRef, expectedTargetVersion: spAction.targetVersion, context: scope, idempotencyKey: 'sp-gateway-save',
    values: { body: '网关剧本改写。', content_revision: spSelection.artifact.version } }
  const spSaved = await spGateway.dispatch(spActionRequest)
  assert.equal(spSaved.status, 'completed')
  assert.notEqual(spSaved.outputArtifacts[0].version, spAction.targetVersion)
  assert.equal((await spGateway.readArtifactContent(spSaved.outputArtifacts[0])).content, '网关剧本改写。')
  spSelected = false
  const spLookedUp = await spGateway.reconcile({ schema: 'pane.action-reconcile-request.v1alpha1', owner: 'auctra', actionId: spAction.actionId,
    expectedTargetRef: spAction.targetRef, context: scope, idempotencyKey: spActionRequest.idempotencyKey })
  // Draft saves keep no body-free owner receipt query: reconcile stays fail-closed
  // instead of guessing; recovery rides the idempotent re-save (spRecovered above).
  assert.equal(spLookedUp.status, 'unknown')
  assert.equal(spLookedUp.receiptRef, 'auctra:working-copy.save:unsettled')
  checks.push('Gateway screenplay selection dispatches through the text.draft.save adapter; body-free reconcile stays fail-closed for drafts')
  await spContext.fiber.dispose()
  if (browserMode) {
    const probe = createServer()
    await new Promise((done, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', done) })
    const visualPort = probe.address().port
    visualOrigin = `http://127.0.0.1:${visualPort}`
    await new Promise(done => probe.close(done))
    commands.push('pnpm --filter @yeisme/dsh-client-ui-visual-kit build', 'pnpm --filter @yeisme/dsh-client-ui-surface build', 'node tests/ui-visual/server.mjs', 'Playwright: browser -> scoped test Host -> actual Auctra HTTP save')
    build('pnpm', ['--filter', '@yeisme/dsh-client-ui-visual-kit', 'build'], root)
    build('pnpm', ['--filter', '@yeisme/dsh-client-ui-surface', 'build'], root)
    visualServer = spawn(process.execPath, ['tests/ui-visual/server.mjs'], { cwd: root, env: { ...process.env, UI_VISUAL_PORT: String(visualPort) }, stdio: ['ignore', 'pipe', 'pipe'] })
    visualExited = new Promise(done => { visualServer.once('exit', code => done(code)); visualServer.once('error', () => done(-1)) })
    visualServer.stdout.on('data', chunk => { stdout += chunk })
    visualServer.stderr.on('data', chunk => { stderr += chunk })
    let healthy = false
    for (let attempt = 0; attempt < 100 && visualServer.exitCode === null; attempt++) {
      try { healthy = (await fetch(`${visualOrigin}/health`, { signal: AbortSignal.timeout(500) })).ok } catch {}
      if (healthy) break
      await new Promise(done => setTimeout(done, 100))
    }
    assert.ok(healthy, 'visual fixture server did not become ready')
    const { chromium } = await import('@playwright/test')
    browser = await chromium.launch({ headless: true })
    let page = await browser.newPage({ viewport: { width: 560, height: 1000 }, reducedMotion: 'reduce' })
    page.setDefaultTimeout(10_000)
    page.setDefaultNavigationTimeout(15_000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    selection = { ...selection, artifact: output }
    selected = true
    let browserReceipt, browserRequest
    await page.exposeFunction('ownerSnapshot', async acknowledge => {
      if (acknowledge && browserReceipt?.status === 'completed' && browserReceipt.outputArtifacts?.[0]) selection = { ...selection, artifact: browserReceipt.outputArtifacts[0] }
      return writeGateway.snapshot()
    })
    await page.exposeFunction('ownerRead', artifact => writeGateway.readArtifactContent(artifact))
    await page.exposeFunction('ownerRecoveries', () => writeGateway.listOperationRecoveries())
    await page.exposeFunction('ownerStoredReconcile', async request => { browserReceipt = await writeGateway.reconcile(request); return browserReceipt })
    let failNextHistoryPage = false
    await page.exposeFunction('ownerCandidatePage', query => {
      if (failNextHistoryPage) { failNextHistoryPage = false; return { schemaVersion: 'creator.candidate-page.v1alpha1', status: 'unconfirmed' } }
      return writeGateway.readCandidatePage(query)
    })
    await page.exposeFunction('ownerDispatch', async (descriptor, values) => {
      browserRequest = { schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: descriptor.actionId,
        descriptorRef: descriptor.descriptorRef, expectedTargetRef: descriptor.targetRef, expectedTargetVersion: descriptor.targetVersion,
        context: scope, idempotencyKey: randomUUID(), ...encodePaneActionValues(descriptor, values) }
      browserReceipt = await writeGateway.dispatch(browserRequest)
      return browserReceipt
    })
    await page.exposeFunction('ownerReconcile', async descriptor => {
      assert.equal(descriptor.descriptorRef, browserRequest?.descriptorRef, 'reconcile must use the original descriptor')
      browserReceipt = await writeGateway.reconcile({ schema: 'pane.action-reconcile-request.v1alpha1', owner: 'auctra',
        actionId: browserRequest.actionId, expectedTargetRef: browserRequest.expectedTargetRef, context: scope, idempotencyKey: browserRequest.idempotencyKey })
      return browserReceipt
    })
    await page.goto(`${visualOrigin}/owner-save`)
    await page.locator('[data-creator-artifact-tab="source"]').click({ timeout: 10_000 })
    const editor = page.locator('[data-creator-artifact-editor] textarea')
    await page.waitForFunction(() => document.querySelector('[data-creator-artifact-editor] textarea')?.value === 'Gateway draft 😀')
    const browserBody = '浏览器真实 owner 保存😀\n第二行\n' + 'LargeWorkingCopyText'.repeat(1000)
    await editor.fill(browserBody)
    await page.getByRole('button', { name: '保存草稿', exact: true }).click()
    await page.getByRole('button', { name: '执行操作', exact: true }).click()
    await page.waitForFunction(() => window.ownerLastReceipt?.status === 'completed' && window.ownerBodyReads.length === 2 && window.ownerDirty === false)
    assert.equal(await editor.inputValue(), browserBody)
    assert.equal(putCount, 5)
    const persisted = await writer.open(scope, ready.unit_ref, browserReceipt.outputArtifacts[0].version)
    assert.equal(persisted.status, 'ready')
    assert.equal(persisted.value.content, browserBody)
    assert.ok(browserBody.length > 16_384)
    assert.equal(browserRequest.textBody.content, browserBody)
    assert.equal(Object.hasOwn(browserRequest.values, 'body'), false)
    checks.push('actual browser saves over 16384 characters via advertised textBody, preserving exact UTF-8 content, original request identity and owner-confirmed revision')
    assert.equal(await page.getByRole('button', { name: '保存草稿', exact: true }).isDisabled(), true)
    await page.evaluate(() => window.refreshOwnerView())
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === '保存草稿' && !button.disabled))
    assert.equal(await editor.inputValue(), browserBody)
    const secondBrowserBody = `${browserBody}\n继续修改后的第二次保存`
    await editor.fill(secondBrowserBody)
    await page.getByRole('button', { name: '保存草稿', exact: true }).click()
    await page.getByRole('button', { name: '执行操作', exact: true }).click()
    await page.waitForFunction(() => window.ownerBodyReads.length === 3 && window.ownerDirty === false)
    assert.equal(await editor.inputValue(), secondBrowserBody)
    assert.equal(putCount, 6)
    const persistedAgain = await writer.open(scope, ready.unit_ref, browserReceipt.outputArtifacts[0].version)
    assert.equal(persistedAgain.status, 'ready')
    assert.equal(persistedAgain.value.content, secondBrowserBody)
    await page.evaluate(() => window.refreshOwnerView())
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === '保存草稿' && !button.disabled))
    loseResponse = true
    const lostBody = `${secondBrowserBody}\n断线提交`
    await editor.fill(lostBody)
    await page.getByRole('button', { name: '保存草稿', exact: true }).click()
    await page.getByRole('button', { name: '执行操作', exact: true }).click()
    await page.waitForFunction(() => window.ownerLastReceipt?.status === 'unknown')
    assert.equal(await page.getByRole('button', { name: '执行操作', exact: true }).isDisabled(), true)
    assert.equal(putCount, 7)
    const interimBody = `${lostBody}\n对账期间新增草稿`
    await editor.fill(interimBody)
    await page.getByRole('button', { name: '核对原操作', exact: true }).click()
    await page.waitForFunction(() => window.ownerLastReceipt?.status === 'completed' && window.ownerBodyReads.length === 4)
    assert.equal(await editor.inputValue(), interimBody)
    assert.equal(await page.evaluate(() => window.ownerDirty), true)
    assert.equal(putCount, 7)
    const recoveredBrowserSave = await writer.open(scope, ready.unit_ref, browserReceipt.outputArtifacts[0].version)
    assert.equal(recoveredBrowserSave.status, 'ready')
    assert.equal(recoveredBrowserSave.value.content, lostBody)
    checks.push('browser unknown save disables execution; original-key reconciliation keeps interim draft and adds no PUT')
    await page.evaluate(() => window.refreshOwnerView())
    writable.admission.candidateContentDigest = '1780a2fa0ee082cbd3d61ce9b363e115b859e6f529b44842e10d917beec1b0e9'
    const comparisonText = '浏览器候选对比😀'
    await editor.fill(comparisonText)
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === '创建候选' && !button.disabled))
    await page.getByRole('button', { name: '创建候选', exact: true }).click()
    await page.getByRole('button', { name: '执行操作', exact: true }).click()
    await page.waitForFunction(() => window.ownerLastReceipt?.actionId === 'working-copy.candidate.create' && window.ownerLastReceipt.status === 'completed')
    assert.equal(await page.evaluate(() => window.ownerDirty), true)
    await page.evaluate(() => window.refreshOwnerView())
    await page.locator('[data-creator-artifact-tab="compare"]').click()
    const comparison = page.locator('[data-creator-artifact-text-compare]')
    await comparison.waitFor()
    assert.equal(await comparison.locator('[data-side="before"]').textContent(), lostBody)
    assert.equal(await comparison.locator('[data-side="after"]').textContent(), comparisonText)
    const afterCompare = await writer.open(scope, ready.unit_ref)
    assert.equal(afterCompare.value.content, lostBody)
    assert.equal(putCount, 7)
    await page.screenshot({ path: resolve(directory, 'artifacts', 'auctra-browser-candidate-compare.png'), fullPage: true })
    checks.push('actual browser candidate comparison reads owner source and candidate bodies; candidate creation retains dirty draft and does not adopt')
    const versionCounts = async () => {
      const response = await fetch(new URL('/__fixture/version-counts', ready.base_url), { headers: binding.headers, signal: AbortSignal.timeout(15_000) })
      assert.equal(response.status, 200)
      return response.json()
    }
    const beforeAdoptionCounts = await versionCounts()
    const beforeAdoptCalls = adoptCount
    loseAdoptResponse = true
    await page.getByRole('button', { name: '采纳候选', exact: true }).click()
    await page.getByRole('button', { name: '执行操作', exact: true }).click()
    await page.waitForFunction(() => window.ownerLastReceipt?.actionId === 'working-copy.candidate.adopt' && window.ownerLastReceipt.status === 'unknown')
    assert.equal(await page.getByRole('button', { name: '执行操作', exact: true }).isDisabled(), true)
    assert.equal(adoptCount, beforeAdoptCalls + 1)
    disposeWriteAdapter()
    disposeWriteAdapter = writeOwners.register(createAuctraWorkingCopyAdapter(writer, async () => selected ? selection : undefined))
    await page.getByRole('button', { name: '核对原操作', exact: true }).click()
    await page.waitForFunction(() => window.ownerLastReceipt?.actionId === 'working-copy.candidate.adopt' && window.ownerLastReceipt.status === 'completed')
    assert.equal(adoptCount, beforeAdoptCalls + 1)
    const adoptedContent = await writer.open(scope, ready.unit_ref, browserReceipt.outputArtifacts[0].version)
    assert.equal(adoptedContent.status, 'ready')
    assert.equal(adoptedContent.value.content, comparisonText)
    assert.deepEqual(await versionCounts(), beforeAdoptionCounts)
    assert.equal(await page.evaluate(() => window.ownerDirty), true)
    assert.equal(putCount, 7)
    checks.push('browser adoption loses committed response; fresh Host adapter reconciles original request key without another apply, preserving formal version counts and unsaved draft')
    await page.evaluate(() => window.refreshOwnerView())
    await page.locator('[data-creator-artifact-tab="source"]').click()
    const staleCandidateText = '此候选不能覆盖后来正文😀'
    await editor.fill(staleCandidateText)
    await page.getByRole('button', { name: '创建候选', exact: true }).click()
    await page.getByRole('button', { name: '执行操作', exact: true }).click()
    await page.waitForFunction(() => window.ownerLastReceipt?.actionId === 'working-copy.candidate.create' && window.ownerLastReceipt.status === 'completed')
    await page.evaluate(() => window.refreshOwnerView())
    const competingBody = '另一编辑器已保存的新正文😀'
    const competingSave = await writer.save(scope, { unitRef: ready.unit_ref, base: adoptedContent.value, content: competingBody, idempotencyKey: 'competing-after-candidate' })
    assert.equal(competingSave.status, 'ready')
    await page.getByRole('button', { name: '采纳候选', exact: true }).click()
    await page.getByRole('button', { name: '执行操作', exact: true }).click()
    await page.waitForFunction(() => window.ownerLastReceipt?.actionId === 'working-copy.candidate.adopt' && window.ownerLastReceipt.status !== 'completed')
    const afterStaleAdopt = await writer.open(scope, ready.unit_ref)
    assert.equal(afterStaleAdopt.status, 'ready')
    assert.equal(afterStaleAdopt.value.content, competingBody)
    assert.equal(afterStaleAdopt.value.contentRevision, competingSave.value.contentRevision)
    assert.equal(await editor.inputValue(), staleCandidateText)
    assert.equal(await page.evaluate(() => window.ownerDirty), true)
    assert.deepEqual(await versionCounts(), beforeAdoptionCounts)
    checks.push('browser stale candidate adoption is rejected after a competing save; newer owner version and unsaved candidate draft remain intact')
    const reopenBase = await writer.open(scope, ready.unit_ref)
    assert.equal(reopenBase.status, 'ready')
    const reopenCandidates = []
    for (const content of Array.from({ length: 52 }, (_, index) => `重开后的第${index + 1}份候选😀`)) {
      const created = await writer.createCandidate(scope, { unitRef: ready.unit_ref, base: reopenBase.value, content })
      assert.equal(created.status, 'ready')
      reopenCandidates.push({ ...created.value, content })
    }
    selection = { ...selection, artifact: reopenBase.value.artifact }
    writable.admission.candidateListDigest = '9ed42760be771c1b81070cac1cf0eece686edba2e11e3c8ff8e0b7d82e93509d'
    disposeWriteAdapter()
    disposeWriteAdapter = writeOwners.register(createAuctraWorkingCopyAdapter(writer, async () => selected ? selection : undefined))
    browserReceipt = undefined
    await page.reload()
    await page.locator('[data-creator-artifact-tab="compare"]').click()
    const historyQuery = { schemaVersion: 'creator.candidate-query.v1alpha1', artifact: selection.artifact, limit: 50 }
    const firstHistoryPage = await writeGateway.readCandidatePage(historyQuery)
    assert.equal(firstHistoryPage.status, 'ready')
    assert.ok(firstHistoryPage.nextCursor)
    const secondHistoryPage = await writeGateway.readCandidatePage({ ...historyQuery, cursor: firstHistoryPage.nextCursor })
    assert.equal(secondHistoryPage.status, 'ready')
    const selectedHistory = reopenCandidates.find(item => secondHistoryPage.candidates.some(candidate => candidate.ref === item.ref))
    assert.ok(selectedHistory)
    await page.getByRole('button', { name: '加载历史', exact: true }).click()
    await page.getByText('当前页 50 项', { exact: true }).waitFor()
    const historicalSelect = page.locator('select').filter({ has: page.locator(`option[value="${firstHistoryPage.candidates[0].ref}"]`) })
    await historicalSelect.waitFor()
    const retainedSelection = await historicalSelect.inputValue()
    failNextHistoryPage = true
    await page.getByRole('button', { name: '下一页', exact: true }).click()
    await page.getByText(/历史加载失败；当前内容已保留/).waitFor()
    assert.equal(await historicalSelect.inputValue(), retainedSelection)
    await page.getByRole('button', { name: '下一页', exact: true }).click()
    const secondSelect = page.locator('select').filter({ has: page.locator(`option[value="${selectedHistory.ref}"]`) })
    await secondSelect.waitFor()
    await secondSelect.selectOption(selectedHistory.ref)
    await page.waitForFunction(expected => document.querySelector('[data-creator-artifact-text-compare] [data-side="after"]')?.textContent === expected, selectedHistory.content)
    assert.equal(await page.locator('[data-creator-artifact-text-compare] [data-side="before"]').textContent(), reopenBase.value.content)
    const beforeHistoryCounts = await versionCounts()
    await page.getByRole('button', { name: '采纳候选', exact: true }).click()
    await page.getByRole('button', { name: '执行操作', exact: true }).click()
    await page.waitForFunction(() => window.ownerLastReceipt?.actionId === 'working-copy.candidate.adopt' && window.ownerLastReceipt.status === 'completed')
    assert.equal(browserRequest.values.candidate_ref, selectedHistory.ref)
    const reopenedAdopted = await writer.open(scope, ready.unit_ref)
    assert.equal(reopenedAdopted.status, 'ready')
    assert.equal(reopenedAdopted.value.content, selectedHistory.content)
    assert.deepEqual(await versionCounts(), beforeHistoryCounts)
    await page.screenshot({ path: resolve(directory, 'artifacts', 'auctra-browser-historical-adoption.png'), fullPage: true })
    selection = { ...selection, artifact: reopenedAdopted.value.artifact }
    browserReceipt = undefined
    for (const width of [360, 560, 960]) {
      for (const locale of ['zh', 'en']) {
        await page.setViewportSize({ width, height: 1000 })
        await page.goto(`${visualOrigin}/owner-save?locale=${locale}`)
        await page.locator('[data-creator-artifact-tab="compare"]').click()
        const pager = page.locator('[data-creator-candidate-history]')
        const load = pager.getByRole('button', { name: locale === 'zh' ? '加载历史' : 'Load history', exact: true })
        const next = pager.getByRole('button', { name: locale === 'zh' ? '下一页' : 'Next page', exact: true })
        await load.focus()
        await page.keyboard.press('Enter')
        await pager.getByText(locale === 'zh' ? '当前页 50 项' : '50 items on this page', { exact: true }).waitFor()
        await page.keyboard.press('Tab')
        assert.equal(await next.evaluate(element => document.activeElement === element), true)
        await page.keyboard.press('Enter')
        await pager.getByText(locale === 'zh' ? `当前页 ${secondHistoryPage.candidates.length} 项` : `${secondHistoryPage.candidates.length} items on this page`, { exact: true }).waitFor()
        assert.equal(await next.isDisabled(), true)
        const bounds = await pager.boundingBox()
        const paneBounds = await page.locator('#fixture').boundingBox()
        assert.ok(paneBounds && Math.abs(paneBounds.width - width) <= 1)
        assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true)
        await page.screenshot({ path: resolve(directory, 'artifacts', `auctra-history-${width}-${locale}.png`), fullPage: true })
        checks.push(`actual owner history keyboard Enter/Tab pagination and no horizontal overflow: ${width}px ${locale}`)
      }
    }
    const reopenSaveBase = await writer.open(scope, ready.unit_ref)
    assert.equal(reopenSaveBase.status, 'ready')
    selection = { ...selection, artifact: reopenSaveBase.value.artifact }
    browserReceipt = undefined
    await page.goto(`${visualOrigin}/owner-save`)
    await page.locator('[data-creator-artifact-tab="source"]').click()
    await page.locator('[data-creator-artifact-editor] textarea').fill('Saved before closing the entire browser 😀')
    const putsBeforeClose = putCount
    loseResponse = true
    await page.getByRole('button', { name: '保存草稿', exact: true }).click()
    await page.getByRole('button', { name: '执行操作', exact: true }).click()
    await page.waitForFunction(() => window.ownerLastReceipt?.status === 'unknown')
    assert.equal(putCount, putsBeforeClose + 1)
    const pendingRecovery = await writeGateway.listOperationRecoveries()
    assert.equal(pendingRecovery.status, 'ready')
    assert.ok(pendingRecovery.operations.some(item => item.request.idempotencyKey === browserRequest.idempotencyKey))
    const persistedRecovery = readFileSync(resolve(hostStorageRoot, 'yeisme_creator_recovery_v1.json'), 'utf8')
    assert.ok(persistedRecovery.includes(browserRequest.idempotencyKey))
    assert.equal(persistedRecovery.includes('Saved before closing the entire browser'), false)
    await browser.close()
    browserRequest = undefined; browserReceipt = undefined
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage({ viewport: { width: 560, height: 1000 }, reducedMotion: 'reduce' })
    page.setDefaultTimeout(10_000)
    let unexpectedDispatches = 0, reopenedQueries = 0
    await page.exposeFunction('ownerSnapshot', async acknowledge => {
      if (acknowledge && browserReceipt?.outputArtifacts?.[0]) selection = { ...selection, artifact: browserReceipt.outputArtifacts[0] }
      return writeGateway.snapshot()
    })
    await page.exposeFunction('ownerRead', artifact => writeGateway.readArtifactContent(artifact))
    await page.exposeFunction('ownerCandidatePage', query => writeGateway.readCandidatePage(query))
    await page.exposeFunction('ownerRecoveries', () => writeGateway.listOperationRecoveries())
    await page.exposeFunction('ownerStoredReconcile', async request => { reopenedQueries++; browserReceipt = await writeGateway.reconcile(request); return browserReceipt })
    await page.exposeFunction('ownerDispatch', () => { unexpectedDispatches++; throw Error('reopened browser must not execute') })
    await page.exposeFunction('ownerReconcile', () => { throw Error('reopened browser must use stored identity') })
    for (const width of [360, 560, 960]) {
      for (const locale of ['zh', 'en']) {
        await page.setViewportSize({ width, height: 1000 })
        await page.goto(`${visualOrigin}/owner-save?locale=${locale}`)
        const recovery = page.locator('[data-creator-operation-recovery]')
        const query = recovery.getByRole('button', { name: locale === 'zh' ? '查询上次结果' : 'Check previous result', exact: true })
        await query.waitFor()
        await query.focus()
        await page.keyboard.press('Tab')
        const refresh = recovery.getByRole('button', { name: locale === 'zh' ? '刷新恢复记录' : 'Refresh recovery records', exact: true })
        assert.equal(await refresh.evaluate(element => document.activeElement === element), true)
        await page.keyboard.press('Shift+Tab')
        assert.equal(await query.evaluate(element => document.activeElement === element), true)
        const bounds = await page.locator('#fixture').boundingBox()
        assert.ok(bounds && Math.abs(bounds.width - width) <= 1)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true)
        assert.equal(unexpectedDispatches, 0)
        assert.equal(reopenedQueries, 0)
        await page.screenshot({ path: resolve(directory, 'artifacts', `auctra-recovery-${width}-${locale}.png`), fullPage: true })
        checks.push(`reopened recovery notice is visible and keyboard reachable without automatic owner query or dispatch: ${width}px ${locale}`)
      }
    }
    await page.setViewportSize({ width: 560, height: 1000 })
    await page.goto(`${visualOrigin}/owner-save`)
    await page.getByRole('button', { name: '查询上次结果', exact: true }).waitFor()
    assert.equal(putCount, putsBeforeClose + 1)
    assert.equal(unexpectedDispatches, 0)
    await page.getByRole('button', { name: '查询上次结果', exact: true }).focus()
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => window.ownerLastReceipt?.status === 'completed')
    assert.equal(putCount, putsBeforeClose + 1)
    assert.equal(unexpectedDispatches, 0)
    assert.equal(reopenedQueries, 1)
    await page.evaluate(() => window.refreshOwnerView())
    await page.locator('[data-creator-artifact-tab="source"]').click()
    await page.waitForFunction(() => document.querySelector('[data-creator-artifact-editor] textarea')?.value === 'Saved before closing the entire browser 😀')
    await page.screenshot({ path: resolve(directory, 'artifacts', 'auctra-browser-reopened-recovery.png'), fullPage: true })
    checks.push('entire browser closes after committed save response loss; new browser and cleared test request memory discover Host recovery list, explicitly reconcile once and restore confirmed body with zero dispatch')
    delete writable.admission.candidateListDigest
    checks.push('browser reload and fresh Host adapter restore more than 50 owner candidates; failed next page retains selection, explicit retry loads page two and adoption preserves formal versions')
    assert.deepEqual(errors, [])
    await page.screenshot({ path: resolve(directory, 'artifacts', 'auctra-browser-save.png'), fullPage: true })
    checks.push('real browser editor -> Gateway -> actual Auctra: two consecutive persisted saves, verified versions, clean drafts and scoped Host selection acknowledgment')
    let savedRecoveryRef, recoverySaveCalls = 0
    await page.exposeFunction('ownerDraftSave', async input => {
      recoverySaveCalls++
      const result = await writeGateway.saveAuctraRecoveryDraft(input)
      if (result.status === 'ready') savedRecoveryRef = result.value.draft.ref
      return result
    })
    await page.exposeFunction('ownerDraftList', input => writeGateway.listAuctraRecoveryDrafts(input))
    await page.exposeFunction('ownerDraftRead', input => writeGateway.readAuctraRecoveryDraft(input))
    await page.reload()
    await page.locator('[data-creator-artifact-tab="source"]').click()
    const recoveryBaseline = await writer.open(scope, ready.unit_ref)
    const recoveryText = 'Unsubmitted browser-close buffer 😀\n' + 'LongUnbrokenRecoveryText'.repeat(1000)
    assert.ok(recoveryText.length > 16_384)
    const recoveryEditor = page.locator('[data-creator-artifact-editor] textarea')
    await recoveryEditor.fill('')
    await recoveryEditor.focus()
    const ime = await page.context().newCDPSession(page)
    await ime.send('Input.imeSetComposition', { text: '输入法候选', selectionStart: 5, selectionEnd: 5 })
    assert.equal(await recoveryEditor.inputValue(), '输入法候选')
    assert.equal(await page.getByRole('button', { name: '保存恢复副本', exact: true }).isDisabled(), true)
    assert.equal(recoverySaveCalls, 0)
    await ime.send('Input.insertText', { text: '已完成😀' })
    assert.equal(await recoveryEditor.inputValue(), '已完成😀')
    await recoveryEditor.fill(recoveryText)
    await ime.detach()
    await page.getByRole('button', { name: '保存恢复副本', exact: true }).click()
    await page.getByText('恢复副本已保存，正文尚未提交。', { exact: true }).waitFor()
    assert.equal(recoverySaveCalls, 1)
    assert.equal((await writer.open(scope, ready.unit_ref)).value.content, recoveryBaseline.value.content)
    const setRecoveryWriteFailure = async enabled => {
      const response = await fetch(new URL('/__fixture/recovery-write-failure', ready.base_url), {
        method: 'POST', headers: { ...binding.headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }),
      })
      assert.equal(response.status, 204)
    }
    const failedRecoveryBody = recoveryText + 'PRIVATE_FAILED_RECOVERY_SENTINEL'
    await setRecoveryWriteFailure(true)
    try {
      await recoveryEditor.fill(failedRecoveryBody)
      await page.getByRole('button', { name: '保存恢复副本', exact: true }).click()
      await page.getByText('恢复副本保存未确认，请先查询并读取已有草稿。', { exact: true }).waitFor()
      assert.equal(recoverySaveCalls, 2)
      assert.equal(await recoveryEditor.inputValue(), failedRecoveryBody)
      assert.equal(await page.getByRole('button', { name: '保存恢复副本', exact: true }).isDisabled(), true)
      assert.equal((await writer.open(scope, ready.unit_ref)).value.content, recoveryBaseline.value.content)
      await page.getByRole('button', { name: '查找恢复草稿', exact: true }).click()
      const oldRecovery = page.locator(`[data-recovery-ref="${savedRecoveryRef}"]`)
      await oldRecovery.getByRole('button', { name: '读取草稿', exact: true }).click()
      await page.locator('.cs-recovery-preview pre').waitFor()
      assert.equal(await page.locator('.cs-recovery-preview pre').textContent(), recoveryText)
      assert.equal(await recoveryEditor.inputValue(), failedRecoveryBody)
      assert.equal(recoverySaveCalls, 2)
      assert.equal(stderr.includes('PRIVATE_FAILED_RECOVERY_SENTINEL'), false, 'storage failure diagnostics must not leak the attempted body')
    } finally { await setRecoveryWriteFailure(false) }
    await recoveryEditor.fill(recoveryText)
    await page.getByRole('button', { name: '保存恢复副本', exact: true }).click()
    await page.getByText('恢复副本已保存，正文尚未提交。', { exact: true }).waitFor()
    assert.equal(recoverySaveCalls, 3)
    checks.push('actual SQLite recovery UPDATE failure reaches browser as unconfirmed; input and prior stored draft remain intact, no automatic retry, body-free diagnostics, explicit read then save succeeds after fault removal')
    await browser.close()
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage({ viewport: { width: 560, height: 1000 }, reducedMotion: 'reduce' })
    page.setDefaultTimeout(10000)
    await page.exposeFunction('ownerSnapshot', () => writeGateway.snapshot())
    await page.exposeFunction('ownerRead', artifact => writeGateway.readArtifactContent(artifact))
    await page.exposeFunction('ownerRecoveries', () => writeGateway.listOperationRecoveries())
    await page.exposeFunction('ownerCandidatePage', query => writeGateway.readCandidatePage(query))
    await page.exposeFunction('ownerDraftSave', () => { throw Error('recovery must not auto-save') })
    await page.exposeFunction('ownerDraftList', input => writeGateway.listAuctraRecoveryDrafts(input))
    await page.exposeFunction('ownerDraftRead', input => writeGateway.readAuctraRecoveryDraft(input))
    await page.exposeFunction('ownerDispatch', () => { throw Error('recovery must not submit') })
    await page.goto(`${visualOrigin}/owner-save`)
    await page.locator('[data-creator-artifact-tab="source"]').click()
    await page.waitForFunction(body => document.querySelector('[data-creator-artifact-editor] textarea')?.value === body, recoveryBaseline.value.content)
    await page.getByRole('button', { name: '查找恢复草稿', exact: true }).click()
    const selectedRecoveryRow = page.locator(`[data-recovery-ref="${savedRecoveryRef}"]`)
    await selectedRecoveryRow.getByRole('button', { name: '读取草稿', exact: true }).click()
    await page.getByRole('button', { name: '恢复为未提交输入', exact: true }).click()
    await page.waitForFunction(body => document.querySelector('[data-creator-artifact-editor] textarea')?.value === body, recoveryText)
    assert.equal((await writer.open(scope, ready.unit_ref)).value.content, recoveryBaseline.value.content)
    assert.equal(recoverySaveCalls, 3)
    await page.screenshot({ path: resolve(directory, 'artifacts', 'auctra-unsubmitted-browser-recovery.png'), fullPage: true })
    checks.push('Chromium native CDP IME composition disables recovery save and commits exact CJK/emoji text; independent owner recovery saves over 16384 characters and explicitly restores exact text after browser close without Working Copy submission')
    for (const recoveryWidth of [360, 560, 960]) {
      await page.setViewportSize({ width: recoveryWidth, height: 1000 })
      const layout = await page.locator('[data-auctra-recovery-loader]').evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }))
      assert.ok(layout.scrollWidth <= layout.width + 1, 'recovery preview must not overflow the Pane')
      const preview = await page.locator('.cs-recovery-preview pre').evaluate(element => ({ height: element.clientHeight, scrollHeight: element.scrollHeight }))
      assert.ok(preview.height <= 320, 'long recovery preview must remain bounded')
      await page.screenshot({ path: resolve(directory, 'artifacts', `auctra-recovery-long-${recoveryWidth}.png`), fullPage: true })
    }
    checks.push('long unbroken recovery text stays inside the 360/560/960px Pane with bounded scrollable preview')

    zoomDirectory = mkdtempSync(resolve(tmpdir(), 'auctra-native-zoom-'))
    const extension = resolve(zoomDirectory, 'extension')
    mkdirSync(extension)
    writeFileSync(resolve(extension, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Auctra fixture zoom verification', version: '1.0', permissions: ['tabs'], background: { service_worker: 'background.js' } }))
    writeFileSync(resolve(extension, 'background.js'), 'chrome.runtime.onInstalled.addListener(() => {});')
    zoomContext = await chromium.launchPersistentContext(resolve(zoomDirectory, 'profile'), { channel: 'chromium', headless: true,
      viewport: { width: 1120, height: 1600 }, reducedMotion: 'reduce', ignoreDefaultArgs: ['--disable-extensions'],
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] })
    const zoomWorker = zoomContext.serviceWorkers()[0] ?? await zoomContext.waitForEvent('serviceworker', { timeout: 10000 })
    const zoomPage = await zoomContext.newPage()
    await zoomPage.exposeFunction('ownerSnapshot', () => writeGateway.snapshot())
    await zoomPage.exposeFunction('ownerRead', artifact => writeGateway.readArtifactContent(artifact))
    await zoomPage.exposeFunction('ownerRecoveries', () => writeGateway.listOperationRecoveries())
    await zoomPage.exposeFunction('ownerCandidatePage', query => writeGateway.readCandidatePage(query))
    await zoomPage.exposeFunction('ownerDraftSave', () => { throw Error('zoom verification must not save') })
    await zoomPage.exposeFunction('ownerDraftList', input => writeGateway.listAuctraRecoveryDrafts(input))
    await zoomPage.exposeFunction('ownerDraftRead', input => writeGateway.readAuctraRecoveryDraft(input))
    await zoomPage.exposeFunction('ownerDispatch', () => { throw Error('zoom verification must not submit') })
    await zoomPage.goto(`${visualOrigin}/owner-save`)
    await zoomPage.locator('[data-creator-artifact-tab="source"]').click()
    const beforeZoomWidth = await zoomPage.evaluate(() => innerWidth)
    const zoomFactor = await zoomWorker.evaluate(async url => {
      const tab = (await chrome.tabs.query({})).find(tab => tab.url === url)
      if (!tab?.id) throw Error('fixture zoom tab missing')
      await chrome.tabs.setZoom(tab.id, 2)
      return chrome.tabs.getZoom(tab.id)
    }, zoomPage.url())
    assert.equal(zoomFactor, 2)
    await zoomPage.waitForFunction(() => devicePixelRatio === 2)
    assert.equal(await zoomPage.evaluate(() => innerWidth), beforeZoomWidth / 2)
    await zoomPage.getByRole('button', { name: '查找恢复草稿', exact: true }).click()
    await zoomPage.locator(`[data-recovery-ref="${savedRecoveryRef}"]`).getByRole('button', { name: '读取草稿', exact: true }).click()
    const zoomRestore = zoomPage.getByRole('button', { name: '恢复为未提交输入', exact: true })
    await zoomRestore.focus()
    await zoomRestore.press('Enter')
    await zoomPage.waitForFunction(body => document.querySelector('[data-creator-artifact-editor] textarea')?.value === body, recoveryText)
    assert.ok(await zoomPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    assert.equal(recoverySaveCalls, 3)
    await zoomPage.evaluate(() => scrollTo(0, 0))
    const zoomCapture = await zoomPage.context().newCDPSession(zoomPage)
    const zoomScreenshot = await zoomCapture.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })
    writeFileSync(resolve(directory, 'artifacts', 'auctra-native-200-percent.png'), Buffer.from(zoomScreenshot.data, 'base64'))
    await zoomCapture.detach()
    checks.push('native chrome.tabs 200% zoom verified by getZoom, doubled DPR and halved CSS viewport; actual owner draft can be found, read and restored with keyboard, no horizontal overflow or mutation')
    await zoomContext.close()
    zoomContext = undefined
    rmSync(zoomDirectory, { recursive: true, force: true })
    zoomDirectory = undefined

    const competingRecoveryEdit = await writer.save(scope, { unitRef: ready.unit_ref, base: recoveryBaseline.value,
      content: 'Newer owner text while recovery preview remains open', idempotencyKey: 'recovery-source-changed' })
    assert.equal(competingRecoveryEdit.status, 'ready')
    await selectedRecoveryRow.getByRole('button', { name: '读取草稿', exact: true }).click()
    await page.locator('.cs-recovery-preview[data-source-changed="true"]').waitFor()
    await page.getByRole('button', { name: '恢复为未提交输入', exact: true }).click()
    assert.equal(await page.locator('[data-creator-artifact-editor] textarea').inputValue(), recoveryText)
    assert.equal((await writer.open(scope, ready.unit_ref)).value.content, 'Newer owner text while recovery preview remains open')
    checks.push('actual owner source update is reported by rereading recovery; explicit restore does not overwrite the existing dirty editor or newer Working Copy')

    selected = false
    await page.getByRole('button', { name: '查找恢复草稿', exact: true }).click()
    await page.getByText('恢复草稿暂不可用', { exact: true }).waitFor()
    assert.equal(await page.locator('.cs-recovery-preview').count(), 0)
    assert.equal(await page.locator('[data-recovery-ref]').count(), 0)
    assert.equal(await page.locator('[data-creator-artifact-editor] textarea').inputValue(), recoveryText)
    assert.equal(await page.getByRole('button', { name: '保存恢复副本', exact: true }).isDisabled(), true)
    assert.equal(recoverySaveCalls, 3)
    selected = true
    checks.push('revoked Host selection rejects actual recovery discovery, clears previously loaded preview/metadata, disables recovery save and retains unsaved editor input without retry')


  }
  const candidateBase = await writer.open(scope, ready.unit_ref)
  assert.equal(candidateBase.status, 'ready')
  const candidateWorkingRef = candidateBase.value.artifact.ref.split(':').at(-1)
  const candidateURL = new URL(`/api/v1/projects/current/text-working-copies/${candidateWorkingRef}/candidates?major=1`, ready.base_url)
  const candidateText = '固定候选正文😀\r\nReference candidate.'
  const candidateResponse = await fetch(candidateURL, { method: 'POST', headers: { ...binding.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ form: 'document', body: candidateText, expected_base_revision: Number(candidateBase.value.contentRevision.split(':')[0]),
      expected_base_digest: candidateBase.value.contentRevision.split(':')[1] }), redirect: 'error', signal: AbortSignal.timeout(15_000) })
  assert.equal(candidateResponse.status, 200)
  const candidateMetadata = (await candidateResponse.json()).data
  assert.equal(JSON.stringify(candidateMetadata).includes(candidateText), false)
  const contentURL = new URL(`/api/v1/projects/current/text-working-copies/${candidateWorkingRef}/candidates/${candidateMetadata.candidate_ref}/content?major=1&expected_digest=${candidateMetadata.result_digest}`, ready.base_url)
  const contentResponse = await fetch(contentURL, { headers: binding.headers, signal: AbortSignal.timeout(15_000) })
  assert.equal(contentResponse.status, 200)
  assert.equal(contentResponse.headers.get('cache-control'), 'no-store')
  assert.equal((await contentResponse.json()).data.body, candidateText)
  const readInput = { artifact: candidateBase.value.artifact, candidateRef: candidateMetadata.candidate_ref, version: `${candidateMetadata.base_revision}:${candidateMetadata.result_digest}` }
  delete writable.admission.candidateContentDigest
  assert.equal((await writer.readCandidateContent(scope, readInput)).status, 'needs_contract')
  const candidateReader = new AuctraWorkingCopyClient(async () => ({ ...binding, admission: { ...binding.admission,
    candidateContentDigest: '1780a2fa0ee082cbd3d61ce9b363e115b859e6f529b44842e10d917beec1b0e9' } }))
  const candidateRead = await candidateReader.readCandidateContent(scope, readInput)
  assert.equal(candidateRead.status, 'ready')
  assert.equal(candidateRead.value.content, candidateText)
  assert.equal(candidateRead.value.artifact.version, readInput.version)
  assert.equal(JSON.stringify(candidateRead.value.artifact).includes(ready.project_ref), false)
  checks.push('DSH candidate content client requires separate read admission and verifies actual owner body/ref/version')

  const denied = await fetch(contentURL, { signal: AbortSignal.timeout(15_000) })
  assert.equal(denied.status, 401)
  assert.equal((await denied.text()).includes(candidateText), false)
  contentURL.searchParams.set('expected_digest', 'wrong')
  const wrongDigest = await fetch(contentURL, { headers: binding.headers, signal: AbortSignal.timeout(15_000) })
  assert.equal(wrongDigest.status, 409)
  await wrongDigest.body?.cancel()
  const afterCandidate = await writer.open(scope, ready.unit_ref)
  assert.equal(afterCandidate.status, 'ready')
  assert.equal(afterCandidate.value.contentRevision, candidateBase.value.contentRevision)
  assert.equal(afterCandidate.value.content, candidateBase.value.content)
  checks.push('actual candidate create/content HTTP: fixed base, body-free metadata, authorized exact body, no-store, denied identity/digest and unchanged Working Copy')
  selected = true
  selection = { ...selection, artifact: candidateBase.value.artifact }
  const candidateAction = (await writeGateway.snapshot()).owners.find(owner => owner.owner === 'auctra').actions.find(action => action.actionId === 'working-copy.candidate.create')
  assert.ok(candidateAction)
  const createdThroughGateway = await writeGateway.dispatch({ schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: candidateAction.actionId,
    descriptorRef: candidateAction.descriptorRef, expectedTargetRef: candidateAction.targetRef, expectedTargetVersion: candidateAction.targetVersion,
    context: scope, idempotencyKey: 'candidate-gateway-read', values: { body: 'Gateway candidate compare 😀', content_revision: candidateBase.value.contentRevision } })
  assert.equal(createdThroughGateway.status, 'completed')
  const scopedAdapter = writeOwners.selected('auctra')
  const otherScopeProjection = await scopedAdapter.snapshot({ ...scope, sessionRef: 'session:other', membershipRevision: 'other' })
  assert.equal(otherScopeProjection.actions.some(action => ['working-copy.candidate.adopt', 'working-copy.candidate.undo'].includes(action.actionId)), false)
  assert.equal(otherScopeProjection.artifactWorkspace.artifacts[0].candidates.length, 0)
  assert.ok((await scopedAdapter.snapshot(scope)).actions.some(action => action.actionId === 'working-copy.candidate.adopt'))
  checks.push('pending candidate actions stay scoped to original session/membership; another scope cannot reuse or erase their binding')
  const candidateProjection = (await writeGateway.snapshot()).owners.find(owner => owner.owner === 'auctra').artifactWorkspace.artifacts[0].candidates[0]
  assert.ok(candidateProjection?.artifact)
  assert.equal(await writeGateway.readArtifactContent(candidateProjection.artifact), null)
  writable.admission.candidateContentDigest = '1780a2fa0ee082cbd3d61ce9b363e115b859e6f529b44842e10d917beec1b0e9'
  const gatewayCandidateBody = await writeGateway.readArtifactContent(candidateProjection.artifact)
  assert.equal(gatewayCandidateBody.content, 'Gateway candidate compare 😀')
  assert.equal(gatewayCandidateBody.artifact.ref, candidateProjection.artifact.ref)
  assert.equal(gatewayCandidateBody.artifact.version, candidateProjection.version)
  assert.equal(await writeGateway.readArtifactContent({ ...candidateProjection.artifact, version: 'wrong' }), null)
  selected = false
  assert.equal(await writeGateway.readArtifactContent(candidateProjection.artifact), null)
  checks.push('Gateway candidate ArtifactRef routes to real fixed-version owner content; independent admission, wrong version and removed selection reject reads')
  const pageURL = new URL(`/api/v1/projects/current/text-working-copies/${candidateWorkingRef}/candidates?major=1&limit=1`, ready.base_url)
  const seenCandidates = new Set()
  let ended = false
  for (let i = 0; i < 128; i++) {
    const response = await fetch(pageURL, { headers: binding.headers, signal: AbortSignal.timeout(15_000) })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const page = (await response.json()).data
    assert.ok(page.candidates.length <= 1)
    for (const candidate of page.candidates) {
      assert.equal(seenCandidates.has(candidate.candidate_ref), false)
      assert.equal(Object.hasOwn(candidate, 'body'), false)
      seenCandidates.add(candidate.candidate_ref)
    }
    if (!page.next_cursor) { ended = true; break }
    pageURL.searchParams.set('cursor', page.next_cursor)
  }
  assert.equal(ended, true)
  assert.ok(seenCandidates.has(candidateMetadata.candidate_ref))
  assert.ok(seenCandidates.has(candidateProjection.ref))
  const unauthorizedPage = await fetch(pageURL, { signal: AbortSignal.timeout(15_000) })
  assert.equal(unauthorizedPage.status, 401)
  await unauthorizedPage.body?.cancel()
  pageURL.searchParams.set('cursor', 'invalid')
  const invalidPage = await fetch(pageURL, { headers: binding.headers, signal: AbortSignal.timeout(15_000) })
  assert.equal(invalidPage.status, 400)
  assert.equal((await invalidPage.json()).error.code, 'patch_invalid')
  checks.push('actual owner bounded candidate pages terminate without duplicates, include known persisted candidates and reject unauthenticated listing')
  assert.equal((await writer.listCandidates(scope, { artifact: candidateBase.value.artifact, limit: 1 })).status, 'needs_contract')
  writable.admission.candidateListDigest = '9ed42760be771c1b81070cac1cf0eece686edba2e11e3c8ff8e0b7d82e93509d'
  assert.equal((await writer.listCandidates(scope, { artifact: candidateBase.value.artifact, cursor: 'invalid', limit: 1 })).status, 'invalid_input')
  const firstCandidatePage = await writer.listCandidates(scope, { artifact: candidateBase.value.artifact, limit: 1 })
  assert.equal(firstCandidatePage.status, 'ready')
  assert.equal(firstCandidatePage.value.candidates.length, 1)
  assert.ok(firstCandidatePage.value.nextCursor)
  const secondCandidatePage = await writer.listCandidates(scope, { artifact: candidateBase.value.artifact, limit: 1, cursor: firstCandidatePage.value.nextCursor })
  assert.equal(secondCandidatePage.status, 'ready')
  assert.notEqual(secondCandidatePage.value.candidates[0].ref, firstCandidatePage.value.candidates[0].ref)
  checks.push('DSH candidate page client uses independent list admission and continues actual owner pages without duplicate first item')
  selected = true
  selection = { ...selection, artifact: candidateBase.value.artifact }
  const freshAdapter = createAuctraWorkingCopyAdapter(writer, async () => selection)
  const restored = await freshAdapter.snapshot(scope)
  const restoredPage = await freshAdapter.readCandidatePage({ schemaVersion: 'creator.candidate-query.v1alpha1', artifact: selection.artifact, limit: 100 }, scope)
  assert.equal(restoredPage.status, 'ready')
  const restoredCandidate = restoredPage.candidates.find(item => item.ref === candidateMetadata.candidate_ref)
  assert.ok(restoredCandidate?.artifact)
  const restoredBody = await freshAdapter.readArtifactContent(restoredCandidate.artifact, scope)
  assert.equal(restoredBody.content, candidateText)
  assert.equal(restoredBody.artifact.version, restoredCandidate.version)
  assert.equal(JSON.stringify(restored).includes(candidateText), false)
  checks.push('fresh adapter with no pending memory restores persisted candidate metadata and exact owner content')

  const historicalBase = await writer.open(scope, ready.unit_ref)
  assert.equal(historicalBase.status, 'ready')
  const historicalBodies = ['Historical option one 字幕', 'Historical option two 旁白']
  const historicalRefs = []
  for (const content of historicalBodies) {
    const created = await writer.createCandidate(scope, { unitRef: ready.unit_ref, base: historicalBase.value, content })
    assert.equal(created.status, 'ready')
    historicalRefs.push(created.value.ref)
  }
  selection = { ...selection, artifact: historicalBase.value.artifact }
  const restartedAdapter = createAuctraWorkingCopyAdapter(writer, async () => selection)
  const historicalSnapshot = await restartedAdapter.snapshot(scope)
  const historicalPage = await restartedAdapter.readCandidatePage({ schemaVersion: 'creator.candidate-query.v1alpha1', artifact: selection.artifact, limit: 100 }, scope)
  assert.equal(historicalPage.status, 'ready')
  const historicalCandidates = historicalPage.candidates.filter(item => historicalRefs.includes(item.ref))
  assert.equal(historicalCandidates.length, 2)
  const targetHistorical = historicalCandidates[1]
  const historicalAction = historicalSnapshot.actions.find(item => item.actionId === 'working-copy.candidate.adopt')
  assert.ok(historicalAction)
  const historicalRequest = { schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: historicalAction.actionId,
    descriptorRef: historicalAction.descriptorRef, expectedTargetRef: historicalAction.targetRef, expectedTargetVersion: historicalAction.targetVersion,
    context: scope, idempotencyKey: 'historical-selected-second', values: { candidate_ref: targetHistorical.ref,
      candidate_version: targetHistorical.version, source_version: targetHistorical.sourceVersion } }
  const wrongVersion = await restartedAdapter.dispatch({ ...historicalRequest, values: { ...historicalRequest.values, candidate_version: '0:wrong' } }, scope)
  assert.equal(wrongVersion.status, 'rejected')
  assert.equal((await writer.open(scope, ready.unit_ref)).value.artifact.version, historicalBase.value.artifact.version)
  const historicalAdoption = await restartedAdapter.dispatch(historicalRequest, scope)
  assert.equal(historicalAdoption.status, 'completed')
  const adoptedHistory = await writer.open(scope, ready.unit_ref)
  assert.equal(adoptedHistory.status, 'ready')
  assert.equal(adoptedHistory.value.content, historicalBodies[historicalRefs.indexOf(targetHistorical.ref)])
  assert.equal(adoptedHistory.value.artifact.version, historicalAdoption.outputArtifacts[0].version)
  checks.push('fresh adapter adopts a non-first historical candidate via shared descriptor; mismatched candidate version rejects without changing Working Copy')
  selection = { ...selection, artifact: adoptedHistory.value.artifact }
  const historyQuery = { schemaVersion: 'creator.candidate-query.v1alpha1', artifact: selection.artifact, limit: 1 }
  const gatewayPage = await writeGateway.readCandidatePage(historyQuery)
  assert.equal(gatewayPage.status, 'ready')
  assert.equal(gatewayPage.candidates.length, 1)
  assert.ok(gatewayPage.nextCursor)
  const gatewayNextPage = await writeGateway.readCandidatePage({ ...historyQuery, cursor: gatewayPage.nextCursor })
  assert.equal(gatewayNextPage.status, 'ready')
  assert.notEqual(gatewayNextPage.candidates[0].ref, gatewayPage.candidates[0].ref)
  assert.equal(JSON.stringify(gatewayPage).includes(ready.project_ref), false)
  assert.equal((await writeGateway.readCandidatePage({ ...historyQuery, cursor: 'invalid' })).status, 'invalid_input')
  assert.equal((await writeGateway.readCandidatePage({ ...historyQuery, limit: 101 })).status, 'invalid_input')
  assert.equal((await writeGateway.readCandidatePage({ ...historyQuery, artifact: { ...selection.artifact, version: 'stale' } })).status, 'permission_denied')
  selected = false
  assert.equal((await writeGateway.readCandidatePage(historyQuery)).status, 'permission_denied')
  selected = true
  checks.push('versioned candidate pagination Remote traverses real owner pages with bounded metadata; malformed cursor, oversized limit, stale or removed selection reject')
  const afterAdoptionEdit = await writer.save(scope, { unitRef: ready.unit_ref, base: adoptedHistory.value,
    content: `Later human edit after adoption ${adoptedHistory.value.content}`, idempotencyKey: 'after-historical-adoption' })
  assert.equal(afterAdoptionEdit.status, 'ready')
  const replayURL = new URL(`/api/v1/projects/current/text-working-copies/${candidateWorkingRef}/candidates/${targetHistorical.ref}/apply?major=1`, ready.base_url)
  const replayResponse = await fetch(replayURL, { method: 'POST', headers: { ...binding.headers, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15_000) })
  assert.equal(replayResponse.status, 200)
  const replayReceipt = (await replayResponse.json()).data.receipt
  assert.equal(replayReceipt.replayed, true)
  assert.equal(`${replayReceipt.working_copy.working_revision}:${replayReceipt.result_digest}`, adoptedHistory.value.artifact.version)
  assert.equal(replayReceipt.result_length, Buffer.byteLength(adoptedHistory.value.content))
  assert.equal(replayReceipt.working_copy.content_digest, replayReceipt.result_digest)
  const adoptionLookup = await writer.reconcileSave(scope, { unitRef: ready.unit_ref, artifact: adoptedHistory.value.artifact,
    idempotencyKey: `candidate:${targetHistorical.ref}` })
  assert.equal(adoptionLookup.status, 'ready')
  assert.equal(adoptionLookup.value.artifact.version, adoptedHistory.value.artifact.version)
  assert.equal((await writer.open(scope, ready.unit_ref)).value.artifact.version, afterAdoptionEdit.value.artifact.version)
  checks.push('actual owner candidate replay and canonical-key lookup retain original adoption revision/digest/length after later human edit; current Working Copy stays newer')
  const externalKeyBase = await writer.open(scope, ready.unit_ref)
  assert.equal(externalKeyBase.status, 'ready')
  const externalKeyCandidate = await writer.createCandidate(scope, { unitRef: ready.unit_ref, base: externalKeyBase.value, content: 'External request key adoption 😀' })
  assert.equal(externalKeyCandidate.status, 'ready')
  const externalKeyURL = new URL(`/api/v1/projects/current/text-working-copies/${candidateWorkingRef}/candidates/${externalKeyCandidate.value.ref}/apply?major=1`, ready.base_url)
  const externalApply = await fetch(externalKeyURL, { method: 'POST', headers: { ...binding.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_key: 'external-http-original' }), signal: AbortSignal.timeout(15_000) })
  assert.equal(externalApply.status, 200)
  await externalApply.body?.cancel()
  const externalLookup = await writer.reconcileSave(scope, { unitRef: ready.unit_ref, artifact: externalKeyBase.value.artifact, idempotencyKey: 'external-http-original' })
  assert.equal(externalLookup.status, 'ready')
  const externalRead = await writer.open(scope, ready.unit_ref)
  assert.equal(externalRead.status, 'ready')
  assert.equal(externalRead.value.content, 'External request key adoption 😀')
  assert.equal(externalRead.value.artifact.version, externalLookup.value.artifact.version)
  checks.push('new actual HTTP request_key adoption response is discarded; DSH existing reconcile client recovers its original receipt without a second apply')
  const noopCreatedResponse = await fetch(candidateURL, { method: 'POST', headers: { ...binding.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ form: 'inline_patch', edits: [] }), signal: AbortSignal.timeout(15_000) })
  assert.equal(noopCreatedResponse.status, 200)
  const noopCandidate = (await noopCreatedResponse.json()).data
  const noopAdopted = await writer.adoptCandidate(scope, { unitRef: ready.unit_ref, base: externalRead.value,
    candidateRef: noopCandidate.candidate_ref, sourceVersion: externalRead.value.contentRevision, requestKey: 'external-noop-original' })
  assert.equal(noopAdopted.status, 'ready')
  assert.equal(noopAdopted.value.receipt.outcome, 'unchanged')
  assert.equal(noopAdopted.value.receipt.artifact.version, externalRead.value.artifact.version)
  const afterNoopEdit = await writer.save(scope, { unitRef: ready.unit_ref, base: externalRead.value, content: 'Human edit after no-op adoption', idempotencyKey: 'after-noop-adopt' })
  assert.equal(afterNoopEdit.status, 'ready')
  const noopLookup = await writer.reconcileSave(scope, { unitRef: ready.unit_ref, artifact: externalRead.value.artifact, idempotencyKey: 'external-noop-original', candidateRecovery: true })
  assert.equal(noopLookup.status, 'ready')
  assert.equal(noopLookup.value.outcome, 'unchanged')
  assert.equal(noopLookup.value.artifact.version, externalRead.value.artifact.version)
  assert.equal((await writer.open(scope, ready.unit_ref)).value.artifact.version, afterNoopEdit.value.artifact.version)
  checks.push('actual owner no-op candidate adoption creates no document version; DSH original-key lookup returns its original unchanged receipt after later edits')

  const boundaryBase = await writer.open(scope, ready.unit_ref)
  assert.equal(boundaryBase.status, 'ready')
  selected = true
  selection = { ...selection, artifact: boundaryBase.value.artifact }
  const boundaryAction = (await writeGateway.snapshot()).owners.find(owner => owner.owner === 'auctra').actions.find(action => action.actionId === 'working-copy.save')
  assert.equal(boundaryAction.textBody.maxBytes, 2 * 1024 * 1024)
  const boundaryText = '😀'.repeat(512 * 1024)
  const boundaryRequest = { schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: boundaryAction.actionId,
    descriptorRef: boundaryAction.descriptorRef, expectedTargetRef: boundaryAction.targetRef, expectedTargetVersion: boundaryAction.targetVersion,
    context: scope, idempotencyKey: 'two-mib-save', ...encodePaneActionValues(boundaryAction, { body: boundaryText, content_revision: boundaryBase.value.contentRevision }) }
  const beforeBoundaryPuts = putCount
  const tooLarge = await writeGateway.dispatch({ ...boundaryRequest, textBody: { field: 'body', content: boundaryText + 'a' } })
  assert.notEqual(tooLarge.status, 'completed')
  assert.equal(putCount, beforeBoundaryPuts)
  const boundaryReceipt = await writeGateway.dispatch(boundaryRequest)
  assert.equal(boundaryReceipt.status, 'completed')
  assert.equal(putCount, beforeBoundaryPuts + 1)
  const boundaryRead = await writer.open(scope, ready.unit_ref)
  assert.equal(boundaryRead.status, 'ready')
  assert.ok(boundaryRead.value.content === boundaryText, '2 MiB owner body must round-trip exactly')
  assert.equal(boundaryRead.value.artifact.version, boundaryReceipt.outputArtifacts[0].version)
  checks.push('actual Gateway saves exactly 2 MiB of emoji UTF-8 to owner with confirmed fixed version; one extra byte rejects before owner PUT')
  const screenplayBoundaryBase = await spWriter.open(scope, spRef)
  assert.equal(screenplayBoundaryBase.status, 'ready')
  const screenplayBoundaryAdapter = createAuctraWorkingCopyAdapter(spWriter, async () => ({ unitRef: spRef, artifact: screenplayBoundaryBase.value.artifact, canSave: true }))
  const screenplayBoundaryAction = (await screenplayBoundaryAdapter.snapshot(scope)).actions.find(action => action.actionId === 'working-copy.save')
  const screenplayBoundaryRequest = { schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: screenplayBoundaryAction.actionId,
    descriptorRef: screenplayBoundaryAction.descriptorRef, expectedTargetRef: screenplayBoundaryAction.targetRef, expectedTargetVersion: screenplayBoundaryAction.targetVersion,
    context: scope, idempotencyKey: 'screenplay-two-mib', ...encodePaneActionValues(screenplayBoundaryAction, { body: boundaryText, content_revision: screenplayBoundaryBase.value.contentRevision }) }
  const screenplayBoundaryReceipt = await screenplayBoundaryAdapter.dispatch(screenplayBoundaryRequest, scope)
  assert.equal(screenplayBoundaryReceipt.status, 'completed')
  const screenplayBoundaryRead = await spWriter.open(scope, spRef)
  assert.equal(screenplayBoundaryRead.status, 'ready')
  assert.ok(screenplayBoundaryRead.value.content === boundaryText, 'screenplay 2 MiB body must round-trip exactly')
  checks.push('actual screenplay adapter saves an exact 2 MiB body through text.draft.save; generic Working Copy PUT remains prohibited')
  const screenplayRecovery = await spWriter.saveRecoveryDraft(scope, { unitRef: spRef, base: screenplayBoundaryRead.value, content: 'Unsubmitted screenplay recovery 😀' })
  assert.equal(screenplayRecovery.status, 'ready', 'screenplay recovery must accept the canonical screenplay version anchor')
  const screenplayRecoveryRead = await spWriter.readRecoveryDraft(scope, screenplayRecovery.value.draft)
  assert.equal(screenplayRecoveryRead.status, 'ready')
  assert.equal(screenplayRecoveryRead.value.content, 'Unsubmitted screenplay recovery 😀')
  assert.equal(screenplayRecoveryRead.value.sourceChanged, false)
  assert.equal(screenplayRecoveryRead.value.draft.baseVersion, screenplayBoundaryRead.value.artifact.version)
  assert.ok((await spWriter.open(scope, spRef)).value.content === boundaryText)
  checks.push('actual screenplay recovery preserves its canonical version anchor and exact draft without changing screenplay Working Copy')
  if (browserMode) {
    selection = { ...selection, unitRef: spRef, artifact: screenplayBoundaryRead.value.artifact }
    const screenplayPage = await browser.newPage({ viewport: { width: 560, height: 1000 } })
    await screenplayPage.exposeFunction('ownerSnapshot', () => writeGateway.snapshot())
    await screenplayPage.exposeFunction('ownerRead', artifact => writeGateway.readArtifactContent(artifact))
    await screenplayPage.exposeFunction('ownerRecoveries', () => writeGateway.listOperationRecoveries())
    await screenplayPage.exposeFunction('ownerCandidatePage', query => writeGateway.readCandidatePage(query))
    await screenplayPage.exposeFunction('ownerDraftSave', () => { throw Error('restoring screenplay must not save') })
    await screenplayPage.exposeFunction('ownerDraftList', input => writeGateway.listAuctraRecoveryDrafts(input))
    await screenplayPage.exposeFunction('ownerDraftRead', input => writeGateway.readAuctraRecoveryDraft(input))
    await screenplayPage.exposeFunction('ownerDispatch', () => { throw Error('restoring screenplay must not submit') })
    await screenplayPage.goto(`${visualOrigin}/owner-save`)
    await screenplayPage.locator('[data-creator-artifact-tab="source"]').click()
    await screenplayPage.getByRole('button', { name: '查找恢复草稿', exact: true }).click()
    await screenplayPage.locator(`[data-recovery-ref="${screenplayRecovery.value.draft.ref}"]`).getByRole('button', { name: '读取草稿', exact: true }).click()
    await screenplayPage.getByRole('button', { name: '恢复为未提交输入', exact: true }).click()
    await screenplayPage.waitForFunction(() => document.querySelector('[data-creator-artifact-editor] textarea')?.value === 'Unsubmitted screenplay recovery 😀')
    assert.ok((await spWriter.open(scope, spRef)).value.content === boundaryText)
    await screenplayPage.screenshot({ path: resolve(directory, 'artifacts', 'auctra-screenplay-recovery.png'), fullPage: true })
    checks.push('fresh browser editor discovers and explicitly restores the screenplay recovery draft with sha256-prefixed source anchor, preserving canonical screenplay and zero dispatch')
    await screenplayPage.close()
  }

  stdout += `Verified ${checks.length} owner HTTP checkpoints.\n`
} catch (error) {
  exitCode = 1
  stderr += `${error.stack ?? error}\n`
} finally {
  try { await zoomContext?.close() } catch { exitCode = 1; stderr += 'Zoom browser cleanup failed\n' }
  if (zoomDirectory) rmSync(zoomDirectory, { recursive: true, force: true })
  try { await browser?.close() } catch { exitCode = 1; stderr += 'Browser cleanup failed\n' }
  if (visualServer) {
    visualServer.kill('SIGTERM')
    const timer = setTimeout(() => visualServer.kill('SIGKILL'), 5000)
    await visualExited
    clearTimeout(timer)
  }
  try { await ctx?.fiber.dispose() } catch { exitCode = 1; stderr += 'DSH fixture disposal failed\n' }
  if (fixture) {
    fixture.stdin.end()
    const timer = setTimeout(() => fixture.kill('SIGTERM'), 5000)
    const code = await fixtureExited
    clearTimeout(timer)
    if (code !== 0) { exitCode = 1; stderr += 'Auctra fixture did not exit cleanly\n' }
  }
  writeFileSync(resolve(directory, 'command.txt'), `${commands.join('\n')}\n`)
  writeFileSync(resolve(directory, 'stdout.log'), redact(stdout))
  writeFileSync(resolve(directory, 'stderr.log'), redact(stderr))
  writeFileSync(resolve(directory, 'env.json'), JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, cgo: 'disabled', provider_calls: 'disabled' }, null, 2))
  writeFileSync(resolve(directory, 'summary.json'), JSON.stringify({ runId, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(),
    status: exitCode === 0 ? 'passed' : 'failed', exitCode, layer: 'system', checks,
    notes: ['Actual DSH client and Auctra HTTP/application/storage; fixture text and fixture-only consumer admission; compatibility screenplay draft exercises text.draft.save (owner rejects the generic PUT for drafts).', browserMode ? 'Actual browser editor with test Host RPC/selection bridge; no production DSH installation or full writing journey acceptance.' : 'No browser or full writing acceptance.', 'No provider calls or production admission; temporary owner project removed on exit.'],
  }, null, 2))
  console.log(`Auctra owner HTTP evidence: ${relative(root, directory)}`)
  process.exitCode = exitCode
}
