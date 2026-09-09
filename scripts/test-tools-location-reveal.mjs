#!/usr/bin/env node
/** Real-boat reveal acceptance: reference-based history paging and located marking in the staged chat renderer. */
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { homedir } from 'node:os'
import { chromium } from '@playwright/test'
import { acquireVerificationLock } from './verification-lock.mjs'

const root = resolve(import.meta.dirname, '..')
const runId = `tools-location-reveal-${new Date().toISOString().replace(/[:.]/g, '-')}`
const dir = resolve(root, 'temp/integration-test-runs', runId)
await mkdir(resolve(dir, 'artifacts'), { recursive: true })
const redact = value => String(value).replace(/([?&]token=)[^\s&"']+/g, '$1[REDACTED]').replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replaceAll(root, '[PROJECT_ROOT]').replaceAll(homedir(), '[USER_HOME]')
const previewFromEnv = process.env.DSH_PREVIEW_URL
const hostLog = previewFromEnv ? '' : await readFile(resolve(root, 'temp/dsh-unified-live.log'), 'utf8')
const url = previewFromEnv ?? hostLog.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)?.[0]
const checks = []
let browser, page, failure, releaseVerification
const quote = value => JSON.stringify(value)
const paneOf = id => page.locator(`[data-workspace-pane=${quote(`conversation:${id}`)}]`)
const tabOf = id => page.locator(`[data-workspace-tab=${quote(`conversation:${id}`)}]`)

async function openConversation(id) {
  await page.getByRole('button', { name: /^(Add pane|添加面板)$/ }).first().click()
  const dialog = page.getByRole('dialog', { name: /^(Add pane|添加面板)$/ })
  const entry = dialog.locator(`[data-workspace-catalog-session=${quote(id)}]`)
  await entry.waitFor()
  await entry.click()
  await paneOf(id).waitFor()
}

async function openToolsTab(id) {
  await tabOf(id).click()
  await paneOf(id).getByRole('tab', { name: /^(Tools|工具)$/ }).click()
  await paneOf(id).locator('[data-mcp-inspector]').waitFor()
}

try {
  releaseVerification = await acquireVerificationLock(root, { onWait: () => console.log('Waiting for plugin builds to finish before reveal acceptance.') })
  assert(url, 'Start the isolated staged DSH runtime first')
  browser = await chromium.launchPersistentContext(resolve(root, 'temp/tools-location-browser-profile'), { viewport: { width: 1500, height: 1000 } })
  page = browser.pages()[0]
  page.setDefaultTimeout(15000)
  await page.addLocatorHandler(page.getByRole('button', { name: 'Configure later', exact: true }), async button => { await button.click() })
  const errors = []
  page.on('pageerror', error => { errors.push(redact(error.message)) })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  const workspace = page.locator('[data-unified-workspace]')
  await workspace.waitFor({ timeout: 30000 })
  for (let i = 0; i < 8; i++) { for (const name of ['Continue']) { const button = page.getByRole('button', { name, exact: true }); if (await button.isVisible()) await button.click() } await page.waitForTimeout(150) }

  const seeded = JSON.parse(await readFile(resolve(root, 'temp/tools-location-sessions.json'), 'utf8'))
  const { sessionA, sessionB } = seeded

  // B: one early tool call buried under 48 offline filler turns; page history first,
  // then reveal by reference must land on the original call row.
  await openConversation(sessionB)
  const bPane = paneOf(sessionB)
  await bPane.getByRole('tab', { name: 'Chat', exact: true }).click()
  await page.waitForTimeout(1500)
  const bRowsBefore = await bPane.locator('[data-chat-anchor-key]').count()
  let reachedTop = false
  for (let i = 0; i < 6 && !reachedTop; i++) {
    const earlier = bPane.getByRole('button', { name: /^(Load earlier|加载更早|Load older)$/ })
    if (await earlier.count() === 0) break
    await earlier.first().click()
    await page.waitForTimeout(1800)
    reachedTop = (await bPane.innerText()).includes('Tools location history B')
  }
  assert(reachedTop, 'history paging must reach the turn-1 region before reveal')
  const bRowsLoaded = await bPane.locator('[data-chat-anchor-key]').count()
  assert(bRowsLoaded > bRowsBefore, `Load earlier must commit rows (${bRowsBefore} -> ${bRowsLoaded})`)
  await openToolsTab(sessionB)
  const bTools = paneOf(sessionB).locator('[data-mcp-inspector]')
  const bList = bTools.locator('.tools-activity-list')
  await bList.waitFor()
  await bTools.locator('.tools-activity-row .tools-record-name').first().click()
  await bTools.locator('.tools-call-details').waitFor()
  checks.push('B Tools activity lists the offline mcp__demo__echo call with details')

  await bTools.getByRole('button', { name: /^(Reveal original message|定位原消息)$/ }).click()
  await paneOf(sessionB).locator('[data-call-location="located"]').waitFor()
  await paneOf(sessionB).locator('[data-chat-anchor-key]:focus').waitFor()
  const bRowsAfter = await paneOf(sessionB).locator('[data-chat-anchor-key]').count()
  assert(bRowsAfter >= bRowsLoaded, 'landing must keep the paged history materialized')
  // Reveal switches the conversation to Chat; the shared view state keeps the located mark for the Tools tab.
  await paneOf(sessionB).getByRole('tab', { name: /^(Tools|工具)$/ }).click()
  await bTools.waitFor()
  await page.waitForTimeout(600)
  const bLocatedRow = bTools.locator('.tools-activity-row[data-located="true"]')
  await bLocatedRow.waitFor()
  assert.equal(await bLocatedRow.count(), 1)
  await bTools.locator('.tools-located-badge').first().waitFor()
  const bFocusPane = await page.evaluate(() => document.activeElement?.closest('[data-workspace-pane]')?.getAttribute('data-workspace-pane'))
  assert.equal(bFocusPane, `conversation:${sessionB}`, 'focus must land inside session B pane')
  await paneOf(sessionB).screenshot({ path: resolve(dir, 'artifacts/chat-landing-redacted.png'), mask: [paneOf(sessionB).locator('[data-chat-anchor-key]')] })
  await bTools.screenshot({ path: resolve(dir, 'artifacts/tools-located-redacted.png'), mask: [bTools.locator('.tools-record-name'), bTools.locator('.tools-call-details')] })
  checks.push(`B pages history by Load earlier (${bRowsBefore} -> ${bRowsLoaded} anchor rows), then reveal lands on the original call by reference inside session B and marks exactly one located row`)

  // A: same-name pair — only the revealed row keeps the located mark.
  await openConversation(sessionA)
  await openToolsTab(sessionA)
  const aTools = paneOf(sessionA).locator('[data-mcp-inspector]')
  await aTools.waitFor()
  const aNames = aTools.locator('.tools-activity-row .tools-record-name')
  await aNames.first().waitFor()
  assert.equal(await aNames.count(), 3, 'session A must expose three offline calls')
  await aNames.nth(1).click()
  await aTools.locator('.tools-call-details').waitFor()
  await aTools.getByRole('button', { name: /^(Reveal original message|定位原消息)$/ }).click()
  await paneOf(sessionA).locator('[data-call-location="located"]').waitFor()
  await paneOf(sessionA).locator('[data-chat-anchor-key]:focus').waitFor()
  await paneOf(sessionA).getByRole('tab', { name: /^(Tools|工具)$/ }).click()
  await aTools.waitFor()
  await page.waitForTimeout(600)
  const aRows = aTools.locator('.tools-activity-row')
  const locatedIndexes = []
  for (let i = 0; i < await aRows.count(); i++) if (await aRows.nth(i).getAttribute('data-located') === 'true') locatedIndexes.push(i)
  assert.deepEqual(locatedIndexes, [1], 'only the selected same-name row is marked located')
  const aFocusPane = await page.evaluate(() => document.activeElement?.closest('[data-workspace-pane]')?.getAttribute('data-workspace-pane'))
  assert.equal(aFocusPane, `conversation:${sessionA}`, 'focus must stay inside session A pane')
  checks.push('A reveal marks only the selected same-name row and lands inside session A')

  assert.equal(errors.length, 0, `no page errors: ${errors.join(' | ')}`)
  checks.push('no page errors during navigation, paging or marking')
} catch (error) {
  failure = `${error instanceof assert.AssertionError ? 'assertion failed' : 'browser operation did not complete'}: ${redact(error.message)}`
} finally {
  await browser?.close()
  await releaseVerification?.()
  await writeFile(resolve(dir, 'summary.json'), JSON.stringify({ status: failure ? 'failed' : 'passed', checks, failure, paidCalls: false, modelCalls: false, redacted: true }, null, 2))
  await writeFile(resolve(dir, 'command.txt'), 'node scripts/seed-tools-location-fixtures.mjs\nnode scripts/test-tools-location-reveal.mjs\n')
  await writeFile(resolve(dir, 'stdout.log'), checks.map((line, at) => `PASS ${at + 1}. ${line}`).join('\n'))
  await writeFile(resolve(dir, 'stderr.log'), failure ?? '')
  await writeFile(resolve(dir, 'env.json'), JSON.stringify({ node: process.version, browser: 'chromium persistent context', paidCalls: false, modelCalls: false, redacted: true }))
  console.log(JSON.stringify({ status: failure ? 'failed' : 'passed', checks, failure, evidence: `temp/integration-test-runs/${runId}` }))
  process.exitCode = failure ? 1 : 0
}
