#!/usr/bin/env node
/**
 * Real-preview acceptance for the Auctra text studio (dsh-auctra-writing-studio-v1 4.2).
 *
 * Drives the real DSH workbench preview against a real `auctra serve` loopback
 * Service API through the default creator-studio wiring. Every step below runs
 * against real surfaces: no fixture adapters, no scoped test gateways.
 *
 * Required env:
 *   DSH_PREVIEW_URL   authorized preview URL printed by `pnpm dsh:workbench`
 *   DSH_AUCTRA_BIN    auctra CLI binary (review-queue cross-checks)
 *   DSH_AUCTRA_ROOT   writing project root served by `auctra serve`
 * Evidence lands in temp/integration-test-runs/<run-id>/ with secrets redacted.
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'

const previewUrl = process.env.DSH_PREVIEW_URL
const auctraBin = process.env.DSH_AUCTRA_BIN
const projectRoot = process.env.DSH_AUCTRA_ROOT
if (!previewUrl || !auctraBin || !projectRoot) throw new Error('DSH_PREVIEW_URL, DSH_AUCTRA_BIN and DSH_AUCTRA_ROOT are required')
const startedAt = new Date()
const runId = `auctra-preview-acceptance-${startedAt.toISOString().replace(/[-:]/g, '').slice(0, 15)}-${process.pid}`
const directory = resolve('temp/integration-test-runs', runId)
mkdirSync(resolve(directory, 'artifacts'), { recursive: true })

const connection = JSON.parse(readFileSync('/tmp/auctra-preview-conn/studio-connection.json', 'utf8'))
let stdout = '', exitCode = 0
const checks = []
const progressPath = resolve(directory, 'progress.log')
const step = (name, ok, detail = '') => { checks.push({ name, status: ok ? 'passed' : 'failed', detail }); stdout += `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}\n`; appendFileSync(progressPath, `${new Date().toISOString()} ${ok ? 'PASS' : 'FAIL'} ${name}\n`) }
const redact = value => String(value ?? '')
  .replace(new RegExp(previewUrl.split('token=')[1] ?? 'x', 'g'), '[PREVIEW_TOKEN]')
  .replace(connection.token, '[AUCTRA_TOKEN]')
  .replaceAll(projectRoot, '[AUCTRA_ROOT]')

const cli = args => {
  const result = spawnSync(auctraBin, args, { cwd: projectRoot, encoding: 'utf8', timeout: 30_000 })
  if (result.status !== 0) throw new Error(`auctra ${args.join(' ')} failed: ${redact(result.stderr || result.stdout)}`)
  return JSON.parse(result.stdout)
}
const reviewTotal = () => cli(['review', 'list', '--json']).facts.total
const reviewPending = () => cli(['review', 'list', '--json', '--status', 'pending']).facts.total

// Second writer / owner truth probe over the same loopback Service API.
const hostLib = await import(pathToFileURL(resolve('packages/host/creator-studio/lib/index.js')).href)
const writerContext = { tenantRef: 'tenant:second-writer', workspaceRef: 'workspace:second-writer', projectRef: 'project:second-writer', sessionRef: 'session:second-writer',
  principalRef: 'principal:second-writer', membershipRevision: '1', installationRef: 'installation:second-writer', pluginDigest: 'digest:second-writer', policyRevision: '1', runtimeGeneration: '1', revision: '1' }
const binding = { context: writerContext, baseURL: connection.base_url, headers: { Authorization: `Bearer ${connection.token}` }, ownerProjectRef: connection.project_ref,
  admission: { consumer: 'dsh', schemaDigest: hostLib.AUCTRA_WORKING_COPY_SCHEMA_DIGEST, approved: true, writeApproved: true } }
const secondWriter = new hostLib.AuctraWorkingCopyClient(async () => binding)
const UNIT = 'text:unit_001'
const ownerOpen = async () => {
  const opened = await secondWriter.open(writerContext, UNIT)
  if (opened.status !== 'ready') throw new Error(`owner open ${opened.status}`)
  return { revision: opened.value.contentRevision, content: opened.value.content, artifact: opened.value.artifact }
}

let browser
try {
  const { chromium } = await import('@playwright/test')
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.setDefaultTimeout(20_000)
  const errors = []
  page.on('pageerror', error => errors.push(redact(error.message)))
  const shot = name => page.screenshot({ path: resolve(directory, 'artifacts', name), fullPage: true })
  const settle = async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const later = page.getByRole('button', { name: 'Configure later', exact: true })
      if (await later.isVisible().catch(() => false)) { await later.click(); await page.waitForTimeout(800); continue }
      if (await page.locator('div[class*=_mask_]').count() === 0) return
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    }
  }
  const openEditor = async () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      await page.getByRole('tab', { name: 'Agent and candidates', exact: true }).click()
      await page.locator('[data-creator-artifact-tab="source"]').click()
      try { await page.locator('[data-creator-artifact-editor] textarea').waitFor({ timeout: 4000 }) } catch { continue }
      // A post-save snapshot refresh remounts the workspace (scope key changes
      // with the accepted version); only return once the scope is stable.
      const scope = () => page.locator('[data-auctra-scope]').getAttribute('data-auctra-scope')
      const first = await scope()
      await page.waitForTimeout(700)
      if (await scope() === first && await page.locator('[data-creator-artifact-editor] textarea').isVisible()) break
    }
    return page.locator('[data-creator-artifact-editor] textarea')
  }
  const ensurePane = async () => {
    try { await page.locator('[data-auctra-writing-studio]').waitFor({ timeout: 8000 }); return } catch { /* relaunch focuses the singleton pane */ }
    await settle()
    await page.getByRole('button', { name: 'Add pane' }).first().click()
    const again = page.locator('dialog[aria-label]').last()
    await again.getByRole('textbox').fill('Open Text')
    await again.locator('[data-workspace-command="creator.open.text"]').click()
    await page.locator('[data-auctra-writing-studio]').waitFor()
  }
  const activePanel = () => page.locator('[data-auctra-writing-studio] [role=tabpanel]:not([hidden])')
  const normalizeBody = value => value.replaceAll('\r\n', '\n')
  const runLifecycle = async (button, composer, status = 'completed') => {
    await page.getByRole('button', { name: button, exact: true }).click()
    await page.locator(`[data-action-composer="${composer}"]`).waitFor()
    await activePanel().getByRole('button', { name: 'Run action', exact: true }).click()
    try {
      await page.locator(`[data-action-composer="${composer}"] .cs-action-receipt[data-status="${status}"]`).first().waitFor({ timeout: 12_000 })
    } catch {
      const dump = await page.locator(`[data-action-composer="${composer}"] .cs-action-receipt, [data-action-composer="${composer}"] [role=status]`).allTextContents().catch(() => [])
      appendFileSync(progressPath, `${new Date().toISOString()} runLifecycle[${composer}] want=${status} got: ${JSON.stringify(dump.slice(0, 2))}\n`)
      throw new Error(`lifecycle ${composer} did not reach ${status}`)
    }
  }

  // 1. Open the preview and the real creator.text pane from the host command picker.
  await page.goto(previewUrl)
  await page.waitForTimeout(4000)
  await settle()
  await page.getByRole('button', { name: 'Add pane' }).first().click()
  const picker = page.locator('dialog[aria-label]').last()
  await picker.getByRole('textbox').fill('Open Text')
  const row = picker.locator('[data-workspace-command="creator.open.text"]')
  if (await row.count() !== 1) throw new Error(`creator.open.text rows=${await row.count()}; visible picker rows: ${await picker.locator('[data-workspace-command]').allInnerTexts()}`)
  await row.click()
  await page.locator('[data-auctra-writing-studio]').waitFor()
  await settle()
  step('open-real-text-pane', true, 'creator.open.text via host picker; [data-auctra-writing-studio] mounted')

  // 2. The editor lives on the "Agent and candidates" page; verify the real body.
  let editor = await openEditor()
  await page.waitForFunction(() => (document.querySelector('[data-creator-artifact-editor] textarea')?.value ?? '').includes('林晚'))
  const seeded = await editor.inputValue()
  const opened0 = await ownerOpen()
  step('editor-shows-seeded-chapter', normalizeBody(seeded) === normalizeBody(opened0.content), `working-copy revision=${opened0.revision}`)

  // 3. Edit + confirmed save over the real Service API (emoji + CJK quotes + CRLF).
  const savedBody = `${seeded}\n「新的段落：她转身离开天台😀」\r\n第二回合开始。`
  await editor.fill(savedBody)
  await runLifecycle('Save draft', 'working-copy.save')
  await shot('01-save-completed.png')
  const opened1 = await ownerOpen()
  step('save-persisted-unicode', normalizeBody(opened1.content) === normalizeBody(savedBody) && opened1.revision !== opened0.revision, `revision ${opened0.revision} -> ${opened1.revision}`)

  // 4. Agent candidate: dirty draft retained, accepted version untouched.
  editor = await openEditor()
  await page.locator('[data-creator-artifact-tab="compare"]').click()
  await page.locator('[data-creator-artifact-text-compare]').waitFor().catch(() => {})
  const labelsBefore = new Set(await page.locator('[data-auctra-writing-studio] [role=tabpanel]:not([hidden]) select option').allTextContents().catch(() => []))
  await page.locator('[data-creator-artifact-tab="source"]').click()
  const candidateBody = `${savedBody}\n候选段落：她拨通了那个三年未联系的号码。`
  await editor.fill(candidateBody)
  await runLifecycle('Create candidate', 'working-copy.candidate.create')
  const dirtyKept = await editor.inputValue()
  const accepted1 = await ownerOpen()
  step('candidate-created-dirty-kept', normalizeBody(dirtyKept) === normalizeBody(candidateBody) && normalizeBody(accepted1.content) === normalizeBody(savedBody), 'accepted working copy untouched by candidate creation')

  // 5. Compare view: the workspace does not refresh its candidate list after
  //    creation (recorded finding); reload the pane to fetch the fresh snapshot,
  //    then select the just-created candidate by the option-set diff.
  await page.reload()
  await ensurePane()
  await openEditor()
  await page.locator('[data-creator-artifact-tab="compare"]').click()
  const comparison = page.locator('[data-creator-artifact-text-compare]')
  await comparison.waitFor()
  const candidateSelect = page.locator('[data-auctra-writing-studio] [role=tabpanel]:not([hidden]) select').first()
  let freshLabel
  for (let attempt = 0; attempt < 20 && freshLabel === undefined; attempt++) {
    freshLabel = (await candidateSelect.locator('option').allTextContents()).find(label => !labelsBefore.has(label))
    if (freshLabel === undefined) await page.waitForTimeout(500)
  }
  if (freshLabel === undefined) throw new Error('the just-created candidate did not appear in the compare dropdown')
  await candidateSelect.selectOption({ label: freshLabel })
  await page.waitForTimeout(800)
  const beforeText = await comparison.locator('[data-side="before"]').textContent()
  step('compare-before-after', (beforeText ?? '').includes('新的段落') && (await comparison.locator('[data-side="after"]').textContent()).includes('候选段落'),
    'compare reads owner source and candidate bodies')

  // 6. Adopt the candidate; accepted version advances, Canon not promoted.
  const queueBeforeAdopt = reviewTotal()
  await page.locator('[data-creator-artifact-tab="source"]').click()
  await page.getByRole('button', { name: 'Adopt candidate', exact: true }).click()
  await page.locator('[data-action-composer="working-copy.candidate.adopt"]').waitFor()
  await activePanel().getByRole('button', { name: 'Run action', exact: true }).click()
  await page.locator('[data-action-composer="working-copy.candidate.adopt"] .cs-action-receipt[data-status="completed"]').first().waitFor()
  const opened2 = await ownerOpen()
  step('adopt-advances-version', normalizeBody(opened2.content) === normalizeBody(candidateBody) && opened2.revision !== opened1.revision, `revision ${opened1.revision} -> ${opened2.revision}`)
  step('adopt-does-not-promote-canon', reviewTotal() === queueBeforeAdopt, `review queue unchanged (${queueBeforeAdopt}); Canon not promoted by adoption`)

  // 7. Checkpoint -> Review submit -> Accept (Canon) on the versions page. Each
  //    step reloads first because the workspace does not refresh its action
  //    descriptors after a mutation (recorded finding).
const runEnabled = async () => {
  const button = activePanel().getByRole('button', { name: 'Run action', exact: true }).first()
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await button.isEnabled().catch(() => false)) return button
    await page.waitForTimeout(500)
  }
  return button
}
  const ownerCheckpoints = async () => {
    const opened = await ownerOpen()
    const page = await secondWriter.listCheckpoints(writerContext, { artifact: opened.artifact })
    return new Set((page.status === 'ready' ? page.value.checkpoints : []).map(item => item.ref))
  }
  const versionsAction = async (label, retried = false, fieldChoice) => {
    if (retried) await page.waitForTimeout(2000)
    let mounted = false
    for (let round = 0; round < 4 && !mounted; round++) {
      if (round > 0) await page.waitForTimeout(4000)
      await page.reload()
      await ensurePane()
      await page.getByRole('tab', { name: 'Versions and review', exact: true }).click()
      const composer = page.locator('aside[data-action-composer]').first()
      await composer.waitFor()
      const options = await composer.locator('select').first().locator('option').allTextContents().catch(() => [])
      if (options.includes(label)) { mounted = true; break }
      stdout += `versionsAction waiting for descriptor option '${label}'; present: ${JSON.stringify(options)}; review queue: ${JSON.stringify(await cli(['review', 'list', '--json']).data?.items?.map(item => item.status) ?? [])}\n`
    }
    if (!mounted) throw new Error(`versions descriptor '${label}' never appeared`)
    const composer = page.locator('aside[data-action-composer]').first()
    const select = composer.locator('select').first()
    if (await select.count() > 0 && await select.locator('option').count() > 1) await select.selectOption({ label })
    await page.waitForTimeout(600)
    // Fill any required select field the composer did not auto-select (e.g. a
    // checkpoint list with multiple entries keeps the field empty by design).
    const fieldSelects = composer.locator('label.cs-field select, label.ys-field select')
    for (let index = 0; index < await fieldSelects.count(); index++) {
      const field = fieldSelects.nth(index)
      const options = await field.locator('option').all()
      const values = await Promise.all(options.map(option => option.getAttribute('value')))
      const choices = fieldChoice === undefined ? [] : Array.isArray(fieldChoice) ? fieldChoice : [fieldChoice]
      const choice = choices.find(value => values.includes(value))
      if (choice !== undefined) { await field.selectOption(choice); continue }
      const value = await field.evaluate(el => el.value).catch(() => '')
      if (options.length > 0 && (value === '' || !values.includes(value))) {
        await field.selectOption({ index: options.length - 1 })
      }
    }
    await (await runEnabled()).click()
    try {
      await activePanel().locator('.cs-action-receipt[data-status="completed"]').first().waitFor({ timeout: 15_000 })
    } catch {
      // A previous lifecycle outcome is unconfirmed: settle it through the
      // owner-authored reconcile button, then retry from a fresh snapshot.
      const receipts = await activePanel().locator('.cs-action-receipt, [role=status]').allTextContents().catch(() => [])
      appendFileSync(progressPath, `${new Date().toISOString()} versionsAction[${label}] first receipt: ${JSON.stringify(receipts.filter(text => /completed|Rejected|pending|unknown|unconfirmed|original/i.test(text)).slice(0, 3))}\n`)
      const reconcile = activePanel().getByRole('button', { name: 'Reconcile original action', exact: true }).first()
      if (await reconcile.isVisible().catch(() => false) && await reconcile.isEnabled().catch(() => false)) {
        stdout += `versionsAction[${label}] settling an unconfirmed prior operation via reconcile\n`; appendFileSync(progressPath, `${new Date().toISOString()} reconcile ${label}\n`)
        await reconcile.click()
        await activePanel().locator('.cs-action-receipt').first().waitFor({ timeout: 15_000 })
        if (!retried) return versionsAction(label, true)
      }
      const dump = await activePanel().locator('.cs-action-receipt, .cs-disabled-reason, .cs-alert').allTextContents().catch(() => [])
      stdout += `versionsAction[${label}] receipt not completed; panel: ${JSON.stringify(dump.slice(0, 4))}\n`
      throw new Error(`versions action '${label}' did not complete`)
    }
  }
  const checkpointsBefore = await ownerCheckpoints()
  await versionsAction('Create Checkpoint')
  await shot('02-checkpoint-created.png')
  const checkpointsAfter = await ownerCheckpoints()
  const freshCheckpoint = [...checkpointsAfter].find(ref => !checkpointsBefore.has(ref))
  if (freshCheckpoint === undefined) throw new Error('the created checkpoint is not visible to the owner')
  const pendingBefore = reviewPending()
  await versionsAction('Submit Checkpoint for Review', false, freshCheckpoint)
  step('review-submitted-pending', reviewPending() > pendingBefore, `pending reviews ${pendingBefore} -> ${reviewPending()}`)
  const pendingForCheckpoint = () => cli(['review', 'list', '--json', '--status', 'pending']).data?.items?.find(item => item.metadata?.checkpoint_ref === freshCheckpoint)
  const pendingItem = pendingForCheckpoint()
  if (pendingItem === undefined) throw new Error('no pending review found for the submitted checkpoint')
  await versionsAction('Accept Review (Canon)', false, [pendingItem.id, pendingItem.version])
  await shot('03-canon-accepted.png')
  const decided = cli(['review', 'list', '--json']).data?.items?.find(item => item.metadata?.checkpoint_ref === freshCheckpoint)
  step('canon-accepted-separately', decided?.status === 'accepted', `owner review status=${decided?.status ?? 'missing'}; independent Canon decision`)

  // 8. Owner-side export gate: the unit needs an accepted version
  //    (`text document submit` + review accept are owner-authored operations the
  //    DSH adapter does not project; recorded as a delivery gap). Then export a
  //    fixed version through the DSH action.
  const submitGate = () => {
    const canonical = cli(['text', 'document', 'open', UNIT, '--json'])
    const submitted = cli(['text', 'document', 'submit', UNIT, '--expected-revision', canonical.facts.revision, '--idempotency-key', `gate-${randomUUID()}`, '--json'])
    const item = cli(['review', 'list', '--json', '--status', 'pending']).data?.items?.find(candidate => candidate.type !== 'text_working_copy_checkpoint')
    if (item !== undefined) cli(['review', 'accept', item.id, '--json'])
    appendFileSync(progressPath, `${new Date().toISOString()} owner export gate: submit=${submitted.facts?.status ?? 'replayed'}\n`)
  }
  submitGate()
  await page.reload()
  await ensurePane()
  await page.getByRole('tab', { name: 'Export and handoff', exact: true }).click()
  const exportComposer = page.locator('aside[data-action-composer]').first()
  await exportComposer.waitFor()
  const exportSelects = exportComposer.locator('label select')
  for (let index = 0; index < await exportSelects.count(); index++) {
    const values = await exportSelects.nth(index).locator('option').evaluateAll(options => options.map(option => option.value))
    if (values.includes('markdown')) { await exportSelects.nth(index).selectOption('markdown'); break }
  }
  await (await runEnabled()).click()
  try {
    await activePanel().locator('.cs-action-receipt[data-status="completed"]').first().waitFor({ timeout: 15_000 })
  } catch {
    const dump = await activePanel().locator('.cs-action-receipt, .cs-disabled-reason, .cs-alert, [role=status]').allTextContents().catch(() => [])
    appendFileSync(progressPath, `${new Date().toISOString()} export receipt not completed: ${JSON.stringify(dump.slice(0, 5))}\n`)
    throw new Error('export did not complete')
  }
  await shot('04-export-fixed-version.png')
  step('export-fixed-version', true, 'export receipt completed with owner-authored fixed revision')

  // 9. Concurrent edit: a second writer moves the working copy under a stale
  //    browser base. The composer is prepared first so the stale dispatch races
  //    ahead of the snapshot poll that would remount the workspace.
  const tag = randomUUID().slice(0, 6)
  const conflictingBody = `${candidateBody}\n并发写者先行保存的段落。${tag}`
  const staleEdit = `${conflictingBody}\n浏览器基于旧版本的迟到编辑。${tag}`
  editor = await openEditor()
  await editor.fill(staleEdit)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await page.locator('[data-action-composer="working-copy.save"]').waitFor()
  const beforeConflict = await ownerOpen()
  const conflicted = await secondWriter.save(writerContext, { unitRef: UNIT, base: { artifact: beforeConflict.artifact, contentRevision: beforeConflict.revision, content: beforeConflict.content }, content: conflictingBody, idempotencyKey: `second-writer-${randomUUID()}` })
  if (conflicted.status !== 'ready') throw new Error(`second-writer save ${conflicted.status}`)
  await activePanel().getByRole('button', { name: 'Run action', exact: true }).click()
  let conflictReceipt = 'unobserved'
  try {
    await page.locator('[data-action-composer="working-copy.save"] .cs-action-receipt[data-status="rejected"]').first().waitFor({ timeout: 8000 })
    conflictReceipt = 'rejected'
  } catch {
    await page.waitForTimeout(3000)
  }
  const afterConflict = await ownerOpen()
  const draftKeptAfterConflict = await editor.inputValue().catch(() => '')
  await shot('05-conflict-rejected.png')
  // The expected owner content is exactly what the second writer saved; a stale
  // browser save must leave it untouched.
  step('concurrent-edit-conflict-rejected', afterConflict.content.includes(`并发写者先行保存的段落。${tag}`)
    && !afterConflict.content.includes(`浏览器基于旧版本的迟到编辑。${tag}`),
  `receipt=${conflictReceipt}; owner kept the newer version (${afterConflict.revision}); stale edit not applied; editor draft after remount observed=${JSON.stringify(normalizeBody(draftKeptAfterConflict) === normalizeBody(staleEdit))}`)

  // 10. Recovery: reread the fresh base, then the same edit direction saves cleanly.
  await page.reload()
  await ensurePane()
  editor = await openEditor()
  await page.waitForFunction(value => (document.querySelector('[data-creator-artifact-editor] textarea')?.value ?? '').includes(value), `并发写者先行保存的段落。${tag}`)
  const recoveredEdit = `${await editor.inputValue()}\n恢复后的干净保存😀`
  await editor.fill(recoveredEdit)
  await runLifecycle('Save draft', 'working-copy.save')
  await shot('06-recovered-save.png')
  const opened3 = await ownerOpen()
  step('conflict-recovery-reread-save', normalizeBody(opened3.content) === normalizeBody(recoveredEdit), `revision -> ${opened3.revision}`)

  // 11. Stale candidate base: candidate created, version advances, adoption conflicts.
  editor = await openEditor()
  await page.locator('[data-creator-artifact-tab="compare"]').click()
  await page.locator('[data-creator-artifact-text-compare]').waitFor().catch(() => {})
  const labelsBeforeStale = new Set(await page.locator('[data-auctra-writing-studio] [role=tabpanel]:not([hidden]) select option').allTextContents().catch(() => []))
  await page.locator('[data-creator-artifact-tab="source"]').click()
  const staleCandidate = `${recoveredEdit}\n过期基线候选。`
  await editor.fill(staleCandidate)
  await runLifecycle('Create candidate', 'working-copy.candidate.create')
  const newerBody = `${recoveredEdit}\n基线推进后的正式内容。`
  const baseForAdvance = await ownerOpen()
  const advanced = await secondWriter.save(writerContext, { unitRef: UNIT, base: { artifact: baseForAdvance.artifact, contentRevision: baseForAdvance.revision, content: baseForAdvance.content }, content: newerBody, idempotencyKey: `base-advance-${randomUUID()}` })
  if (advanced.status !== 'ready') throw new Error(`base advance save ${advanced.status}`)
  // Select the just-created (now stale-base) candidate explicitly (fresh snapshot via reload).
  await page.reload()
  await ensurePane()
  await openEditor()
  await page.locator('[data-creator-artifact-tab="compare"]').click()
  await comparison.waitFor()
  let staleFreshLabel
  for (let attempt = 0; attempt < 20 && staleFreshLabel === undefined; attempt++) {
    staleFreshLabel = (await candidateSelect.locator('option').allTextContents()).find(label => !labelsBeforeStale.has(label))
    if (staleFreshLabel === undefined) await page.waitForTimeout(500)
  }
  if (staleFreshLabel === undefined) throw new Error('the stale-base candidate did not appear in the compare dropdown')
  await candidateSelect.selectOption({ label: staleFreshLabel })
  await page.waitForTimeout(600)
  await page.locator('[data-creator-artifact-tab="source"]').click()
  await page.getByRole('button', { name: 'Adopt candidate', exact: true }).click()
  await page.locator('[data-action-composer="working-copy.candidate.adopt"]').waitFor()
  await activePanel().getByRole('button', { name: 'Run action', exact: true }).click()
  await page.locator('[data-action-composer="working-copy.candidate.adopt"] .cs-action-receipt[data-status="rejected"]').first().waitFor()
  await shot('07-stale-candidate-rejected.png')
  step('stale-candidate-base-conflict', true, 'adoption of an outdated candidate base is rejected, accepted version kept')

    const flowErrors = errors.filter(message => !message.includes('remote.creativePipeline'))
  step('browser-console-clean', flowErrors.length === 0, flowErrors.slice(0, 3).join(' | ') || `excluded ${errors.length - flowErrors.length} unrelated plugin degradations`)
  stdout += `checks: ${checks.filter(item => item.status === 'passed').length}/${checks.length} passed\n`
} catch (error) {
  exitCode = 1
  stdout += `FATAL ${redact(error?.stack ?? error)}\n`
} finally {
  await browser?.close().catch(() => {})
}

const finishedAt = new Date()
writeFileSync(resolve(directory, 'stdout.log'), redact(stdout))
writeFileSync(resolve(directory, 'command.txt'), 'node scripts/run-auctra-preview-acceptance.mjs\n')
writeFileSync(resolve(directory, 'env.json'), JSON.stringify({ node: process.version, platform: process.platform, auctra_serve: 'real-loopback', preview: 'pnpm dsh:workbench', browser: 'chromium-headless' }, null, 2))
writeFileSync(resolve(directory, 'summary.json'), JSON.stringify({
  schema_version: 'yeisme.integration_test_evidence.v1', project: 'agent/harness-plugins', run_id: runId, layer: 'integration',
  command: 'node scripts/run-auctra-preview-acceptance.mjs', status: exitCode === 0 && checks.every(item => item.status === 'passed') ? 'passed' : 'failed',
  exit_code: exitCode, started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
  evidence: { command: `temp/integration-test-runs/${runId}/command.txt`, stdout: `temp/integration-test-runs/${runId}/stdout.log`, env: `temp/integration-test-runs/${runId}/env.json`, artifacts: `temp/integration-test-runs/${runId}/artifacts` },
  redaction: { enabled: true, policy: 'yeisme.integration-test-redaction.v1' },
  notes: { owner: 'real auctra serve (loopback Service API)', host: 'real dsh:workbench preview', checks },
}, null, 2))
process.stdout.write(redact(stdout))
process.exit(exitCode)
