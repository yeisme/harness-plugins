#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { acquireVerificationLock } from './verification-lock.mjs'
const root = resolve(import.meta.dirname, '..')
const baseline = process.argv.includes('--baseline')
const runId = `adaptive-panes-${baseline ? 'before-' : ''}${new Date().toISOString().replace(/[:.]/g, '-')}`
const dir = resolve(root, 'temp/integration-test-runs', runId)
await mkdir(resolve(dir, 'artifacts'), { recursive: true })
const checks = [], errors = []
let browser, page, release, failure
const check = async (name, fn) => { await fn(); checks.push(name); console.log(`PASS ${name}`) }
try {
  release = await acquireVerificationLock(root)
  const log = await readFile(resolve(root, 'temp/dsh-unified-live.log'), 'utf8')
  const url = log.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)[0]
  const fixtureLog = await readFile(resolve(root, 'temp/dsh-unified-fixtures.log'), 'utf8')
  const ids = ['a', 'b'].map(letter => fixtureLog.match(new RegExp(`acceptance-trace-${letter}-[\\w-]+`))[0])
  browser = await chromium.launchPersistentContext(resolve(root, 'temp/unified-browser/profile'), { viewport: { width: 1440, height: 960 } })
  page = browser.pages()[0]
  page.setDefaultTimeout(15000)
  await page.addLocatorHandler(page.getByRole('button', { name: 'Configure later', exact: true }), async b => b.click())
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const work = page.locator('[data-unified-workspace]')
  await work.waitFor()
  await page.waitForTimeout(800)
  const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem(`dsh.workspace.unified.v1:${encodeURIComponent(document.querySelector('[data-unified-workspace]').getAttribute('data-unified-workspace'))}`)))
  const tab = id => page.locator(`[data-workspace-tab="conversation:${id}"]`)
  const pane = id => page.locator(`[data-workspace-pane="conversation:${id}"]`)
  const dragStart = async (handle, x, y) => {
    const b = await handle.boundingBox()
    await page.mouse.move(b.x + Math.min(35, b.width / 2), b.y + b.height / 2); await page.mouse.down()
    await page.mouse.move(x, y, { steps: 18 }); await page.waitForTimeout(250)
  }
  await page.getByRole('button', { name: 'Layout', exact: true }).click()
  await page.getByRole('button', { name: 'Restore default layout', exact: true }).last().click()
  for (let i = 0; i < 20 && await page.locator('[data-workspace-tab]').count(); i++) await page.locator('[data-workspace-tab]').first().press('Delete')
  for (const id of ids) {
    await page.getByRole('button', { name: 'Add pane', exact: true }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Add pane' })
    await dialog.getByRole('textbox').fill(id)
    await dialog.locator(`[data-workspace-catalog-session="${id}"]`).click()
    await tab(id).dblclick()
  }
  const [a, b] = ids
  let box = await work.boundingBox()
  await dragStart(tab(b), box.x + box.width - 12, box.y + box.height / 2)
  await page.mouse.up(); await page.waitForTimeout(200)
  const before = await snapshot()
  const initialBox = await pane(a).boundingBox()
  await dragStart(tab(b), initialBox.x + initialBox.width / 2, initialBox.y + 80)
  if (baseline) {
    const measured = { dropKind: await work.getAttribute('data-drop-kind'), before: initialBox, during: await pane(a).boundingBox(), unchangedStorage: JSON.stringify(await snapshot()) === JSON.stringify(before) }
    await writeFile(resolve(dir, 'artifacts/baseline.json'), JSON.stringify(measured, null, 2))
    await page.screenshot({ path: resolve(dir, 'artifacts/before.png') })
    await page.keyboard.press('Escape'); await page.mouse.up()
    checks.push('recorded the original narrow docking zone and missing live reflow')
  } else {
    await check('broad magnetic zone reflows real neighboring panes without saving a draft layout', async () => {
      assert.equal(await work.getAttribute('data-drop-kind'), 'split')
      assert.equal(await page.locator('[data-drop-edge]').getAttribute('data-drop-edge'), 'top')
      const during = await pane(a).boundingBox()
      assert(during.width > initialBox.width + 200)
      assert(during.height < initialBox.height - 150)
      assert.deepEqual(await snapshot(), before)
      await page.screenshot({ path: resolve(dir, 'artifacts/magnetic-preview.png') })
      await page.mouse.move(initialBox.x + 5, initialBox.y + 80, { steps: 8 }); await page.waitForTimeout(180)
      assert.equal(await page.locator('[data-drop-edge]').getAttribute('data-drop-edge'), 'left')
      await page.mouse.move(initialBox.x + initialBox.width / 2, initialBox.y + 80, { steps: 8 }); await page.waitForTimeout(180)
      assert.equal(await page.locator('[data-drop-edge]').getAttribute('data-drop-edge'), 'top')
    })
    await check('magnetic boundary is stable; drop matches the preview', async () => {
      // Original header starts 37px above the Pane content. The 132px top zone
      // retains its target through an additional 18px exit tolerance.
      await page.mouse.move(initialBox.x + initialBox.width / 2, initialBox.y + 141, { steps: 8 }); await page.waitForTimeout(180)
      assert.equal(await page.locator('[data-drop-edge]').getAttribute('data-drop-edge'), 'top')
      const preview = await pane(a).boundingBox()
      await page.mouse.up(); await page.waitForTimeout(180)
      const after = await pane(a).boundingBox()
      assert(Math.abs(after.width - preview.width) < 2 && Math.abs(after.height - preview.height) < 2)
      assert.equal((await snapshot()).root.axis, 'vertical')
    })
    await check('dropping into a group body joins its tabs instead of spawning a window', async () => {
      const target = await pane(a).boundingBox()
      await dragStart(tab(b), target.x + target.width / 2, target.y + target.height / 2)
      await page.mouse.up(); await page.waitForTimeout(180)
      const state = await snapshot()
      assert.equal(Object.keys(state.groups).length, 1); assert.equal(state.floating.length, 0)
    })
    await check('Alt preserves deliberate floating; nearby edges dock a floating group', async () => {
      box = await work.boundingBox()
      await page.keyboard.down('Alt')
      await dragStart(tab(b), box.x + box.width - 110, box.y + 300)
      await page.mouse.up(); await page.keyboard.up('Alt'); await page.waitForTimeout(150)
      const state = await snapshot(); assert.equal(state.floating.length, 1)
      const f = state.floating[0], group = page.locator(`[data-workspace-group="${f.groupId}"]`)
      const g = await group.boundingBox()
      await page.mouse.move(g.x + g.width - 35, g.y + 17); await page.mouse.down()
      await page.mouse.move(box.x + box.width - 110, box.y + box.height / 2, { steps: 18 }); await page.waitForTimeout(180)
      assert.equal(await work.getAttribute('data-drop-kind'), 'split')
      await page.mouse.up(); await page.waitForTimeout(180)
      assert.equal((await snapshot()).floating.length, 0)
    })
    await check('narrow viewports stack panes and widening restores the preferred split', async () => {
      const saved = await snapshot()
      assert.equal(saved.root.axis, 'horizontal')
      await page.setViewportSize({ width: 700, height: 960 }); await page.waitForTimeout(300)
      const wa = await work.boundingBox(), aa = await pane(a).boundingBox(), bb = await pane(b).boundingBox()
      assert(Math.abs(aa.width - (wa.width - 2)) < 3)
      assert(Math.abs(bb.width - aa.width) < 3)
      assert(Math.abs(aa.y - bb.y) > 180)
      assert.equal(await page.locator('[data-workspace-split]').getAttribute('aria-orientation'), 'horizontal')
      assert.deepEqual(await snapshot(), saved)
      await page.screenshot({ path: resolve(dir, 'artifacts/responsive-stack.png') })
      await page.setViewportSize({ width: 1440, height: 960 }); await page.waitForTimeout(300)
      assert.equal(await page.locator('[data-workspace-split]').getAttribute('aria-orientation'), 'vertical')
      assert.deepEqual(await snapshot(), saved)
    })
    await check('separator has a generous hit target and double click balances panes', async () => {
      const separator = page.locator('[data-workspace-split]')
      await separator.focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft')
      assert.notEqual((await snapshot()).root.ratio, .5)
      await separator.dblclick(); await page.waitForTimeout(180)
      assert(Math.abs((await snapshot()).root.ratio - .5) < .01)
      await page.screenshot({ path: resolve(dir, 'artifacts/after.png') })
    })
    assert.equal(errors.length, 0, JSON.stringify(errors))
  }
} catch (e) {
  failure = String(e.stack ?? e.message).replace(/([?&]token=)[^\s&]+/g, '$1[REDACTED]').replaceAll(root, '[PROJECT_ROOT]')
  await page?.screenshot({ path: resolve(dir, 'artifacts/failure.png') }).catch(() => {})
} finally {
  await browser?.close(); await release?.()
  await Promise.all([
    writeFile(resolve(dir, 'summary.json'), JSON.stringify({ runId, status: failure ? 'failed' : 'passed', baseline, checks, errors, failure, redacted: true }, null, 2)),
    writeFile(resolve(dir, 'command.txt'), `node scripts/test-adaptive-pane-docking.mjs${baseline ? ' --baseline' : ''}\n`),
    writeFile(resolve(dir, 'stdout.log'), checks.join('\n')), writeFile(resolve(dir, 'stderr.log'), failure ?? ''),
    writeFile(resolve(dir, 'env.json'), JSON.stringify({ node: process.version, profile: 'isolated web', paidCalls: false, redacted: true })),
  ])
  console.log(`${failure ? 'FAIL' : 'PASS'} Evidence: temp/integration-test-runs/${runId}`)
  if (failure) console.error(failure)
}
process.exitCode = failure ? 1 : 0
