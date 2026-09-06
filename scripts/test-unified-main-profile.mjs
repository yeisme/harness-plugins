#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { acquireVerificationLock } from './verification-lock.mjs'
import { discoverWorkspacePackages, workspaceBundles } from './dsh-dev.mjs'
const root = resolve(import.meta.dirname, '..')
const runId = `unified-main-${new Date().toISOString().replace(/[:.]/g, '-')}`
const dir = resolve(root, 'temp/integration-test-runs', runId)
await mkdir(resolve(dir, 'artifacts'), { recursive: true })
const bundles = workspaceBundles(await discoverWorkspacePackages(root)).map(p => ({ name: p.name, status: 'not_verified' }))
const results = [], errors = [], denied = []
let browser, failure, releaseVerification
try {
  releaseVerification = await acquireVerificationLock(root, { onWait: () => console.log('Waiting for plugin builds to finish before browser acceptance.') })
  const log = await readFile(resolve(root, 'temp/dsh-unified-main.log'), 'utf8')
  const url = log.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)?.[0]
  assert(url, 'Start the compatible main web profile first')
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.setDefaultTimeout(10000)
  page.on('pageerror', e => errors.push({ type: e.name, category: /module table|import|module/i.test(e.message) ? 'module-loader' : 'browser-runtime' }))
  page.on('response', r => { if (r.status() >= 400) denied.push({ path: new URL(r.url()).pathname.replace(/[a-f0-9-]{24,}/g, '[id]'), status: r.status() }) })
  await page.addLocatorHandler(page.getByRole('button', { name: 'Configure later', exact: true }), async b => { await b.click() })
  await page.addLocatorHandler(page.getByRole('button', { name: 'Continue', exact: true }), async b => { await b.click() })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.locator('[data-unified-workspace]').waitFor({ timeout: 30000 })
  await page.waitForTimeout(1200)
  assert.equal(await page.locator('.pwo-host').count(), 0)
  assert(!/Failed to load plugins|missed the module table/.test(await page.locator('body').innerText()))
  assert.equal(errors.length, 0)
  for (const bundle of bundles) bundle.status = 'main_web_profile_boot_passed'
  const show = async () => {
    await page.getByRole('button', { name: /^(Add pane|添加面板)$/ }).first().click()
    const dialog = page.getByRole('dialog', { name: /^(Add pane|添加面板)$/ })
    await dialog.getByRole('textbox').fill('')
    return dialog
  }
  let dialog = await show()
  const labels = await dialog.locator('button:not([data-workspace-command]):not([data-workspace-catalog-session])').allTextContents()
  await page.keyboard.press('Escape')
  for (const label of [...new Set(labels.map(s => s.trim()).filter(s => s && s !== 'Close' && s !== '关闭'))]) {
    dialog = await show()
    await dialog.getByRole('button', { name: label, exact: true }).and(dialog.locator('button:not([data-workspace-command]):not([data-workspace-catalog-session])')).first().click()
    const tab = page.locator('[data-workspace-tab^="tool:"][aria-selected="true"]').last()
    await tab.waitFor()
    const id = await tab.getAttribute('data-workspace-tab')
    const pane = page.locator(`[data-workspace-pane="${id}"]`)
    await pane.waitFor(); await page.waitForTimeout(350)
    const text = await pane.innerText()
    const box = await pane.boundingBox()
    const unavailable = /unavailable|not configured|not connected|not installed|missing|not enabled|无法|不可用|未配置|未连接|未启用|缺少|needs.contract|permission.denied/i.test(text)
    results.push({ name: label, kind: id.replace(/^tool:/, ''), opened: true, status: unavailable ? 'degraded_reason_visible' : 'rendered_function_not_verified', nonempty: text.trim().length > 0, bounds: box && { width: box.width, height: box.height } })
    assert(text.trim().length > 0, `${label}: empty pane`)
    await tab.press('Delete')
  }
  assert(results.length >= 20, 'All catalog providers must be registered')
  assert.equal(errors.length, 0, JSON.stringify(errors))
  await page.getByRole('button', { name: /^(Add pane|添加面板)$/ }).first().click()
  await page.getByRole('dialog', { name: /^(Add pane|添加面板)$/ }).getByRole('textbox').fill('Git')
  await page.getByRole('dialog', { name: /^(Add pane|添加面板)$/ }).getByRole('button', { name: 'Git', exact: true }).click()
  // Main-profile screenshots conceal business contents and session titles.
  await page.screenshot({ path: resolve(dir, 'artifacts/main-profile-redacted.png'), maskColor: '#242426', mask: [page.locator('[data-workspace-pane]'), page.locator('[role="tree"]'), page.locator('[data-workspace-tab]').filter({ hasNotText: 'Git' })] })
} catch (error) {
  failure = String(error.message).replace(/([?&]token=)[^\s&]+/g, '$1[REDACTED]').replaceAll(root, '[PROJECT_ROOT]')
} finally {
  await browser?.close()
  await releaseVerification?.()
  await Promise.all([
    writeFile(resolve(dir, 'summary.json'), JSON.stringify({ runId, profile: 'main web', status: failure ? 'failed' : 'passed', bundles, results, errors, denied, failure, redacted: true }, null, 2)),
    writeFile(resolve(dir, 'command.txt'), 'node scripts/test-unified-main-profile.mjs\n'),
    writeFile(resolve(dir, 'stdout.log'), results.map(r => `${r.name}: ${r.status}`).join('\n')),
    writeFile(resolve(dir, 'stderr.log'), failure ?? ''),
    writeFile(resolve(dir, 'env.json'), JSON.stringify({ node: process.version, profile: 'main web', runtime: 'staged DSH 0.1.2-rc.1', paidCalls: false, redacted: true })),
  ])
  console.log(`${failure ? 'FAIL' : 'PASS'}: ${results.length} catalog views; ${bundles.length} bundles. Evidence: temp/integration-test-runs/${runId}`)
  if (failure) console.error(failure)
}
process.exitCode = failure ? 1 : 0
