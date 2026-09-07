#!/usr/bin/env node
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

const run = `pane-interactions-${new Date().toISOString().replace(/[:.]/g, '-')}`
const dir = new URL(`../temp/integration-test-runs/${run}/`, import.meta.url)
await mkdir(new URL('artifacts/', dir), { recursive: true })
const checks = []
let browser, failure, stage = 'startup'
try {
  const url = new URL(process.env.DSH_PREVIEW_URL)
  assert(['127.0.0.1', 'localhost'].includes(url.hostname))
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', () => errors.push('browser-error'))
  await page.goto(url.href)
  const workspace = page.locator('[data-unified-workspace]')
  await workspace.waitFor()
  const row = page.locator('[data-workspace-session-id]').first()
  await row.click()
  await page.locator('[data-workspace-tab]').first().dblclick()
  const open = async label => {
    await page.getByRole('button', { name: /^(Add pane|添加面板)$/ }).first().click()
    const dialog = page.getByRole('dialog', { name: /^(Add pane|添加面板)$/ })
    await dialog.getByRole('textbox').fill(label)
    await dialog.getByRole('button', { name: label, exact: true }).click()
  }
  stage = 'explorer-style'
  await open('Explorer')
  const explorer = page.locator('[data-explorer-tree]')
  await explorer.getByRole('tree').waitFor()
  const metrics = await explorer.evaluate(element => ({
    height: element.clientHeight,
    treeHeight: element.querySelector('[role=tree]').clientHeight,
    inputHeight: element.querySelector('input:not([type=checkbox])').getBoundingClientRect().height,
    color: getComputedStyle(element).color,
  }))
  await writeFile(new URL('artifacts/explorer-metrics.json', dir), JSON.stringify(metrics))
  assert(metrics.treeHeight > 100 && metrics.treeHeight < metrics.height)
  assert(metrics.inputHeight <= 34)
  assert.equal(await explorer.locator('[data-explorer-resource-actions][open]').count(), 0)
  await explorer.screenshot({ path: new URL('artifacts/explorer-redacted.png', dir).pathname, mask: [explorer.locator('.pwr-explorer-name'), explorer.locator('.pwr-explorer-metadata-card')] })
  checks.push('Explorer uses compact standalone pane styles and a bounded scroll region')
  stage = 'file-open'
  await explorer.getByRole('textbox').fill('README.md')
  const file = explorer.locator('[data-explorer-kind=file]').filter({ hasText: 'README.md' }).first()
  await file.waitFor()
  await file.dblclick()
  const opened = page.locator('[data-workspace-pane][data-workspace-pane*="desktop.file"]:visible')
  await opened.waitFor()
  assert.equal(await opened.getByText('文件不可用。', { exact: true }).count(), 0)
  checks.push('Explorer opens a real workspace README into a file pane')
  stage = 'layout-shortcuts'
  await page.locator('[data-workspace-tab][aria-selected=true]').last().focus()
  await page.keyboard.press('Control+Alt+2')
  await page.waitForTimeout(200)
  assert.equal(await page.locator('[data-workspace-split][aria-orientation=vertical]').count(), 1)
  await page.keyboard.press('Control+Alt+3')
  await page.waitForTimeout(200)
  assert.equal(await page.locator('[data-workspace-split][aria-orientation=horizontal]').count(), 1)
  const before = await workspace.boundingBox()
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(250)
  const after = await workspace.boundingBox()
  assert(after.width > before.width)
  await page.keyboard.press('Control+b')
  checks.push('layout shortcuts switch orientation and Ctrl+B toggles the sidebar')
  stage = 'mcp-command'
  const conversation = page.locator('[data-workspace-tab^="conversation:"]').first()
  await conversation.click()
  const input = page.locator('[data-workspace-pane]:visible [contenteditable=true]').first()
  await input.fill('/mcp')
  await page.keyboard.press('Enter')
  const option = page.getByRole('option').filter({ hasText: /Tools|工具/ }).first()
  await option.waitFor()
  await option.click()
  await page.locator('[data-workspace-tab]').filter({ hasText: /Tools|工具/ }).last().waitFor()
  await page.locator('[data-mcp-inspector]:visible').waitFor()
  assert.equal(await page.locator('[data-workspace-pane]:visible > [role=alert]').count(), 0)
  assert.equal(await page.getByText('Pane Workbench is not installed', { exact: true }).count(), 0)
  checks.push('bare /mcp opens the installed Tools pane through the browser command chooser')
  assert.equal(errors.length, 0)
} catch (error) {
  failure = `${stage}: ${error instanceof assert.AssertionError ? 'assertion failed' : 'browser operation did not complete'}`
} finally {
  await browser?.close()
  await Promise.all([
    writeFile(new URL('summary.json', dir), JSON.stringify({ status: failure ? 'failed' : 'passed', checks, failure, redacted: true })),
    writeFile(new URL('command.txt', dir), 'node scripts/test-pane-interactions.mjs\n'),
    writeFile(new URL('stdout.log', dir), checks.join('\n')),
    writeFile(new URL('stderr.log', dir), failure ?? ''),
    writeFile(new URL('env.json', dir), JSON.stringify({ node: process.version, paidCalls: false, redacted: true })),
  ])
  console.log(JSON.stringify({ status: failure ? 'failed' : 'passed', checks, failure, evidence: `temp/integration-test-runs/${run}` }))
  process.exitCode = failure ? 1 : 0
}
