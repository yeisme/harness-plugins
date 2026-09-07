#!/usr/bin/env node
/** Real browser smoke with a fresh context; no prompts, credentials or conversation contents in evidence. */
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

const run = `workbench-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}`
const dir = new URL(`../temp/integration-test-runs/${run}/`, import.meta.url)
await mkdir(new URL('artifacts/', dir), { recursive: true })
const checks = []
let browser, failure, stage = 'startup'
try {
  assert(process.env.DSH_PREVIEW_URL, 'Set DSH_PREVIEW_URL to the local preview login URL; it is never recorded.')
  const url = new URL(process.env.DSH_PREVIEW_URL)
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Only a loopback preview is allowed')
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', () => errors.push('browser-runtime'))
  await page.goto(url.href)
  await page.locator('[data-unified-workspace]').waitFor()
  const rows = page.locator('[data-workspace-session-id]')
  await rows.first().waitFor()
  const firstId = await rows.nth(0).getAttribute('data-workspace-session-id')
  const secondId = await rows.nth(1).getAttribute('data-workspace-session-id')
  assert.notEqual(firstId, secondId)
  await rows.nth(0).click()
  await page.locator(`[data-workspace-tab="conversation:${firstId}"]`).dblclick()
  stage = 'sidebar-drag'
  const area = await page.locator('[data-unified-workspace]').boundingBox()
  const row = await rows.nth(1).boundingBox()
  await page.mouse.move(row.x + row.width / 2, row.y + row.height / 2)
  await page.mouse.down()
  await page.mouse.move(area.x + area.width - 15, area.y + 220, { steps: 24 })
  await page.mouse.up()
  await page.waitForTimeout(400)
  assert.equal(await page.locator('[data-workspace-group]').count(), 2)
  checks.push('sidebar session drag creates a split')
  const a = page.locator(`[data-workspace-pane="conversation:${firstId}"]`)
  const b = page.locator(`[data-workspace-pane="conversation:${secondId}"]`)
  await a.waitFor(); await b.waitFor()
  stage = 'independent-drafts'
  const inputA = a.locator('[contenteditable="true"]').first()
  const inputB = b.locator('[contenteditable="true"]').first()
  const originalA = await inputA.innerText(), originalB = await inputB.innerText()
  // This fresh browser owns the transient drafts; restore them before disposal.
  try {
    await inputA.fill('pane regression A')
    await inputB.fill('pane regression B')
    assert.equal(await inputA.innerText(), 'pane regression A')
    assert.equal(await inputB.innerText(), 'pane regression B')
    await page.locator(`[data-workspace-tab="conversation:${secondId}"]`).click()
    await rows.nth(0).click()
    assert.equal(await inputA.innerText(), 'pane regression A')
    assert.equal(await inputB.innerText(), 'pane regression B')
    checks.push('two visible composers preserve independent drafts across selection')
  } finally {
    await inputA.fill(originalA)
    await inputB.fill(originalB)
  }
  stage = 'target-toolbar-absent'
  assert.equal(await page.locator('[data-composer-reference-target]').count(), 0)
  assert.equal(await page.getByRole('dialog', { name: /Choose reference target|选择引用目标/ }).count(), 0)
  checks.push('no permanent Target control or unsolicited target modal')
  assert.equal(errors.length, 0)
  checks.push('no browser runtime errors')
} catch {
  failure = `Verification failed at ${stage}; no private browser content recorded.`
} finally {
  await browser?.close()
  await Promise.all([
    writeFile(new URL('summary.json', dir), JSON.stringify({ status: failure ? 'failed' : 'passed', checks, failure, redacted: true })),
    writeFile(new URL('command.txt', dir), 'node scripts/test-workbench-cleanup.mjs\n'),
    writeFile(new URL('stdout.log', dir), checks.join('\n')),
    writeFile(new URL('stderr.log', dir), failure ?? ''),
    writeFile(new URL('env.json', dir), JSON.stringify({ node: process.version, browser: 'chromium', paidCalls: false, redacted: true })),
  ])
  console.log(JSON.stringify({ status: failure ? 'failed' : 'passed', checks, failure, evidence: `temp/integration-test-runs/${run}` }))
  process.exitCode = failure ? 1 : 0
}
