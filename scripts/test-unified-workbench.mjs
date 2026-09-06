#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { homedir } from 'node:os'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { acquireVerificationLock } from './verification-lock.mjs'

const root = resolve(import.meta.dirname, '..')
const runId = `unified-workbench-${new Date().toISOString().replace(/[:.]/g, '-')}`
const dir = resolve(root, 'temp/integration-test-runs', runId)
await mkdir(resolve(dir, 'artifacts'), { recursive: true })
const redact = value => String(value).replace(/([?&]token=)[^\s&"']+/g, '$1[REDACTED]').replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replaceAll(root, '[PROJECT_ROOT]').replaceAll(homedir(), '[USER_HOME]')
const hostLog = await readFile(resolve(root, 'temp/dsh-unified-live.log'), 'utf8')
const url = hostLog.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)?.[0]
const errors = [], checks = [], inputEvents = [], unavailable = []
let browser, page, failure, releaseVerification
const check = async (name, action) => {
  try { const evidence = await action(); checks.push({ name, status: 'passed', evidence }); console.log(`PASS ${name}`) }
  catch (error) { checks.push({ name, status: 'failed', reason: redact(error.message) }); throw error }
}
try {
  releaseVerification = await acquireVerificationLock(root, { onWait: () => console.log('Waiting for plugin builds to finish before browser acceptance.') })
  assert(url, 'Start the isolated staged DSH runtime first')
  browser = await chromium.launchPersistentContext(resolve(root, 'temp/unified-browser/profile'), { viewport: { width: 1440, height: 960 } })
  page = browser.pages()[0]
  page.setDefaultTimeout(7000)
  await page.addLocatorHandler(page.getByRole('button', { name: 'Configure later', exact: true }), async button => { await button.click() })
  page.on('pageerror', e => errors.push(redact(e.message)))
  page.on('response', r => {
    const path = new URL(r.url()).pathname
    if (r.status() === 403 && path.startsWith('/yeisme-files/api/')) unavailable.push({ path, status: 403, reason: 'The file-owner API denied this request. This capability is not accepted by the layout test.' })
    else if (r.status() >= 400) errors.push(`${r.status()} ${path}`)
  })
  await page.exposeFunction('recordWorkbenchPointer', entry => inputEvents.push(entry))
  await page.addInitScript(() => {
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture']) window.addEventListener(type, e => {
      window.recordWorkbenchPointer({ type, x: e.clientX, y: e.clientY, pointerId: e.pointerId, pointerType: e.pointerType })
    }, true)
  })
  const dismiss = async () => {
    for (let i = 0; i < 8; i++) {
      for (const name of ['Continue']) { const button = page.getByRole('button', { name, exact: true }); if (await button.isVisible()) await button.click() }
      await page.waitForTimeout(200)
    }
  }
  await page.goto(url); await dismiss()
  const workspace = page.locator('[data-unified-workspace]')
  const snapshot = () => page.evaluate(() => {
    const project = document.querySelector('[data-unified-workspace]').getAttribute('data-unified-workspace')
    const raw = localStorage.getItem(`dsh.workspace.unified.v1:${encodeURIComponent(project)}`)
    return raw ? JSON.parse(raw) : null
  })
  const open = async name => {
    await page.getByRole('button', { name: 'Add pane', exact: true }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Add pane' })
    await dialog.getByRole('textbox').fill('')
    const blankSession = dialog.locator('[data-workspace-catalog-session^="session-"]').filter({ hasText: name })
    if (await blankSession.count()) await blankSession.first().click()
    else await dialog.getByRole('button', { name, exact: true }).first().click()
    await page.waitForTimeout(180)
  }
  const drag = async (locator, target, cancel = false, floating = false) => {
    if (floating) await page.keyboard.down('Alt')
    await locator.scrollIntoViewIfNeeded()
    const b = await locator.boundingBox()
    assert(b, 'drag handle is visible')
    await page.mouse.move(b.x + b.width / 2, b.y + Math.min(b.height / 2, 16))
    await page.mouse.down()
    await page.mouse.move(target.x, target.y, { steps: 18 })
    await page.waitForTimeout(80)
    if (cancel) await page.keyboard.press('Escape')
    await page.mouse.up()
    if (floating) await page.keyboard.up('Alt')
    await page.waitForTimeout(180)
  }
  const tab = id => page.locator(`[data-workspace-tab="${CSSescape(id)}"]`)
  function CSSescape(value) { return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"') }
  await check('boot: unified owner and no legacy overlay', async () => {
    assert.equal(await workspace.count(), 1)
    assert.equal(await page.locator('.pwo-host').count(), 0)
    assert.equal(errors.length, 0)
  })
  // Reset only the isolated browser's current layout through the actual host UI.
  await page.getByRole('button', { name: 'Layout', exact: true }).click()
  await page.getByRole('button', { name: 'Restore default layout', exact: true }).last().click()
  await page.locator('[data-workspace-group]').getByRole('button', { name: /^Close / }).first().click()
  await open('project-b')
  await page.locator('[data-workspace-tab]').first().dblclick()
  await open('project-a')
  let state = await snapshot()
  if (Object.keys(state.panes).length < 2) await open('project-b')
  state = await snapshot()
  const conversations = Object.values(state.panes).filter(p => p.kind === 'conversation')
  assert.equal(conversations.length, 2, 'two real isolated sessions are available')
  const [a, b] = conversations
  await check('real tab drag creates right split and preserves session refs', async () => {
    const area = await workspace.boundingBox()
    await drag(tab(b.id), { x: area.x + area.width - 15, y: area.y + 220 })
    state = await snapshot()
    assert.equal(Object.keys(state.groups).length, 2)
    assert.equal(state.root.type, 'split')
    assert.equal(state.root.axis, 'horizontal')
    assert.equal(state.panes[a.id].sessionId, a.sessionId)
    assert.equal(state.panes[b.id].sessionId, b.sessionId)
    assert.notEqual(state.panes[a.id].workspaceId, state.panes[b.id].workspaceId)
    return { groups: state.groups, root: state.root }
  })
  await check('two native composers keep separate drafts and DOM identity during movement', async () => {
    const paneA = page.locator(`[data-workspace-pane="${CSSescape(a.id)}"]`)
    const paneB = page.locator(`[data-workspace-pane="${CSSescape(b.id)}"]`)
    await paneA.locator('[contenteditable="true"]').fill('acceptance draft A')
    await paneB.locator('[contenteditable="true"]').fill('acceptance draft B')
    await paneA.locator('[contenteditable="true"]').evaluate(e => { e.dataset.acceptanceIdentity = 'A' })
    const area = await workspace.boundingBox()
    await drag(tab(a.id), { x: area.x + area.width * .65, y: area.y + 360 }, false, true)
    state = await snapshot()
    assert.equal(state.floating.length, 1)
    assert.equal(await paneA.locator('[contenteditable="true"]').innerText(), 'acceptance draft A')
    assert.equal(await paneB.locator('[contenteditable="true"]').innerText(), 'acceptance draft B')
    assert.equal(await paneA.locator('[contenteditable="true"]').getAttribute('data-acceptance-identity'), 'A')
    await page.screenshot({ path: resolve(dir, 'artifacts/two-sessions-floating.png') })
    return { a: a.sessionId, b: b.sessionId, separateDrafts: true, retainedComposer: true }
  })
  await check('floating group moves, resizes, and docks into the other tab group', async () => {
    state = await snapshot()
    const float = state.floating[0]
    const group = page.locator(`[data-workspace-group="${float.groupId}"]`)
    const header = group.locator('div').first()
    const box = await group.boundingBox()
    // Blank titlebar region, not a Pane tab.
    await page.keyboard.down('Alt')
    await page.mouse.move(box.x + box.width - 35, box.y + 18); await page.mouse.down()
    await page.mouse.move(box.x + box.width - 105, box.y + 68, { steps: 12 }); await page.mouse.up(); await page.keyboard.up('Alt'); await page.waitForTimeout(180)
    let next = await snapshot()
    assert.notEqual(next.floating[0].x, float.x)
    const resizedBefore = { ...next.floating[0] }
    const grip = page.locator(`[data-workspace-handles="${float.groupId}"] [data-edge="se"]`)
    const g = await grip.boundingBox()
    await drag(grip, { x: g.x + 55, y: g.y + 45 })
    next = await snapshot()
    assert(next.floating[0].width > resizedBefore.width)
    const other = await tab(b.id).boundingBox()
    await drag(tab(a.id), { x: other.x + 8, y: other.y + 10 })
    next = await snapshot()
    assert.equal(next.floating.length, 0)
    assert.equal(Object.keys(next.groups).length, 1)
    assert(Object.values(next.groups)[0].panes.includes(a.id))
    return { moved: true, resized: true, docked: true }
  })
  await check('Escape cancels a real pointer drag without changing saved layout', async () => {
    const before = await snapshot(), area = await workspace.boundingBox()
    await drag(tab(a.id), { x: area.x + 420, y: area.y + 360 }, true)
    assert.deepEqual(await snapshot(), before)
  })
  await check('sidebar drag of an already open conversation moves without duplicating', async () => {
    const row = page.locator(`[data-workspace-session-id="${a.sessionId}"]`)
    if (!await row.isVisible()) {
      const project = page.getByRole('treeitem').filter({ hasText: a.workspaceTitle }).first()
      await project.click()
    }
    const area = await workspace.boundingBox()
    await drag(row, { x: area.x + area.width - 15, y: area.y + 220 })
    const next = await snapshot()
    assert.equal(Object.keys(next.panes).length, 2)
    assert.equal(Object.keys(next.groups).length, 2)
    assert.equal(Object.values(next.panes).filter(p => p.sessionId === a.sessionId).length, 1)
  })
  await check('named preset and browser refresh restore the validated layout', async () => {
    await page.getByRole('button', { name: 'Layout', exact: true }).click()
    await page.getByRole('textbox', { name: 'Layout name', exact: true }).fill('acceptance-layout')
    await page.getByRole('button', { name: 'Save layout', exact: true }).click()
    await page.keyboard.press('Escape')
    const before = await snapshot()
    await page.reload(); await dismiss()
    assert.deepEqual(await snapshot(), before)
    await page.getByRole('button', { name: 'Layout', exact: true }).click()
    await page.getByRole('button', { name: 'Restore default layout', exact: true }).last().click()
    await page.getByRole('button', { name: 'Layout', exact: true }).click()
    await page.getByRole('button', { name: 'acceptance-layout', exact: true }).click()
    assert.deepEqual(await snapshot(), before)
  })
  await check('registered tool opens inside the host workspace', async () => {
    await open('Git')
    const next = await snapshot()
    assert(Object.values(next.panes).some(p => /git/i.test(p.kind)))
    assert.equal(await page.locator('.pwo-host').count(), 0)
    await page.screenshot({ path: resolve(dir, 'artifacts/workspace-tools.png') })
  })
  await check('trajectory stays inside its session pane across split, float, and refresh', async () => {
    const fixtureLog = await readFile(resolve(root, 'temp/dsh-unified-fixtures.log'), 'utf8')
    const ids = ['a', 'b'].map(letter => fixtureLog.match(new RegExp(`acceptance-trace-${letter}-[\\w-]+`))?.[0])
    assert(ids.every(Boolean), 'Create offline fixture histories first')
    for (const id of ids) {
      await page.getByRole('button', { name: 'Add pane', exact: true }).first().click()
      const dialog = page.getByRole('dialog', { name: 'Add pane' })
      await dialog.getByRole('textbox').fill(id)
      await page.locator(`[data-workspace-catalog-session="${id}"]`).click()
      await tab(`conversation:${id}`).dblclick()
    }
    const [idA, idB] = ids
    const aPane = page.locator(`[data-workspace-pane="conversation:${idA}"]`)
    const bPane = page.locator(`[data-workspace-pane="conversation:${idB}"]`)
    const area = await workspace.boundingBox()
    await drag(tab(`conversation:${idA}`), { x: area.x + 300, y: area.y + 400 }, false, true)
    await aPane.getByRole('tab', { name: 'Trajectory', exact: true }).click()
    assert.equal(await aPane.getByRole('tab', { name: 'Trajectory', exact: true }).getAttribute('aria-selected'), 'true')
    assert.equal(await bPane.getByRole('tab', { name: 'Chat', exact: true }).getAttribute('aria-selected'), 'true')
    assert((await aPane.innerText()).includes('Offline acceptance conversation A'))
    assert(!(await aPane.innerText()).includes('Offline acceptance conversation B'))
    assert((await bPane.innerText()).includes('Offline recorded response B'))
    const before = await snapshot()
    await page.screenshot({ path: resolve(dir, 'artifacts/session-trajectory-together.png') })
    await page.reload(); await dismiss()
    assert.deepEqual(await snapshot(), before)
    assert.equal(await aPane.getByRole('tab', { name: 'Trajectory', exact: true }).getAttribute('aria-selected'), 'true')
    assert.equal(await bPane.getByRole('tab', { name: 'Chat', exact: true }).getAttribute('aria-selected'), 'true')
    assert.equal(Object.values((await snapshot()).panes).filter(p => /trajectory/i.test(p.kind)).length, 0)
    return { sessionA: idA, sessionB: idB, trajectoryBelongsToSession: true, isolatedViewSelection: true, offlineFixture: true }
  })
  await check('left, top and bottom edge drops produce the expected tree and ordering', async () => {
    for (const edge of ['left', 'top', 'bottom']) {
      await page.getByRole('button', { name: 'Layout', exact: true }).click()
      await page.getByRole('button', { name: 'acceptance-layout', exact: true }).click()
      const target = await tab(b.id).boundingBox()
      await drag(tab(a.id), { x: target.x + 8, y: target.y + 10 })
      const merged = await snapshot()
      assert.equal(Object.keys(merged.groups).length, 1)
      const area = await workspace.boundingBox()
      const point = edge === 'left' ? { x: area.x + 12, y: area.y + 220 }
        : edge === 'top' ? { x: area.x + area.width / 2, y: area.y + 50 }
        : { x: area.x + area.width / 2, y: area.y + area.height - 12 }
      await drag(tab(a.id), point)
      const next = await snapshot()
      assert.equal(Object.keys(next.groups).length, 2)
      assert.equal(next.root.axis, edge === 'left' ? 'horizontal' : 'vertical')
      const moved = Object.values(next.groups).find(g => g.panes.includes(a.id))
      assert.equal((edge === 'bottom' ? next.root.second : next.root.first).id, moved.id)
    }
  })
  await check('tab sorting and separator resize work with the keyboard', async () => {
    const before = await snapshot(), separator = page.locator('[data-workspace-split]').first()
    await separator.focus(); await page.keyboard.press('ArrowUp')
    assert((await snapshot()).root.ratio < before.root.ratio)
    const other = await tab(b.id).boundingBox()
    await drag(tab(a.id), { x: other.x + 5, y: other.y + 10 })
    const merged = await snapshot(), group = Object.values(merged.groups)[0]
    await tab(group.panes[0]).focus(); await page.keyboard.press('Alt+ArrowRight')
    assert.deepEqual(Object.values((await snapshot()).groups)[0].panes, [...group.panes].reverse())
  })
  await check('catalog traps focus and Escape returns to its trigger', async () => {
    const trigger = page.getByRole('button', { name: 'Add pane', exact: true }).first()
    await trigger.click()
    await page.getByRole('dialog', { name: 'Add pane' }).getByRole('textbox').fill('no-match-acceptance')
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      assert(await page.evaluate(() => document.activeElement?.closest('dialog') !== null))
    }
    await page.keyboard.press('Escape')
    assert(await trigger.evaluate(e => e === document.activeElement))
  })
  await check('360, 560 and 960px viewports retain panes and clamp floating geometry', async () => {
    const original = await snapshot(), area = await workspace.boundingBox()
    await drag(tab(a.id), { x: area.x + 400, y: area.y + 360 }, false, true)
    const count = Object.keys((await snapshot()).panes).length
    for (const width of [360, 560, 960]) {
      await page.setViewportSize({ width, height: 800 })
      await page.waitForTimeout(180)
      await page.waitForFunction(() => {
        const frame = document.querySelector('[data-unified-workspace]').getBoundingClientRect()
        return [...document.querySelectorAll('[data-workspace-group][data-floating]')].every(e => {
          const r = e.getBoundingClientRect()
          return r.x >= frame.x - 1 && r.right <= frame.right + 1 && r.bottom <= frame.bottom + 1
        })
      }, undefined, { timeout: 3000 })
      assert.equal(Object.keys((await snapshot()).panes).length, count)
      await page.screenshot({ path: resolve(dir, `artifacts/width-${width}.png`) })
    }
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.evaluate(() => { document.documentElement.style.zoom = '2' })
    await page.waitForTimeout(200)
    assert.equal(Object.keys((await snapshot()).panes).length, count)
    await page.screenshot({ path: resolve(dir, 'artifacts/zoom-200-reduced-motion.png') })
    await page.evaluate(() => { document.documentElement.style.zoom = '' })
    return { widths: [360, 560, 960], zoom: '200%', reducedMotion: true, preservedPaneCount: count }
  })
  await check('real touch events can drag a pane into a floating group', async () => {
    const cdp = await browser.newCDPSession(page)
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
    const before = await snapshot(), bounds = await tab(b.id).boundingBox(), area = await workspace.boundingBox()
    const from = { x: bounds.x + bounds.width / 2, y: bounds.y + 16 }
    const to = { x: area.x + 220, y: area.y + 280 }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] })
    for (let i = 1; i <= 15; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * i / 15, y: from.y + (to.y - from.y) * i / 15, id: 1 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(200)
    const after = await snapshot()
    assert.equal(Object.keys(after.panes).length, Object.keys(before.panes).length)
    assert(after.floating.some(f => after.groups[f.groupId].panes.includes(b.id)))
    assert(inputEvents.some(event => event.pointerType === 'touch'))
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false })
    await cdp.detach()
    return { nativeTouchInput: true, sessionIdentityPreserved: true }
  })
  await check('HMR serves changed plugin bytes without changing the saved layout', async () => {
    const artifact = resolve(root, 'packages/example/dsh-plugin-example/lib/client.js')
    const original = await readFile(artifact)
    const marker = `unified-workbench-hmr-${process.pid}`
    const marked = Buffer.concat([original, Buffer.from(`\n// ${marker}\n`)])
    const before = await snapshot()
    let delivered = false
    const observe = async response => {
      if (!response.headers()['content-type']?.includes('javascript')) return
      try { if ((await response.text()).includes(marker)) delivered = true } catch { /* Superseded responses may be cancelled. */ }
    }
    page.on('response', observe)
    try {
      await writeFile(artifact, marked)
      const deadline = Date.now() + 20000
      while (!delivered && Date.now() < deadline) await page.waitForTimeout(200)
      assert(delivered, 'The running host must deliver HMR bytes without page.reload()')
      await page.waitForTimeout(250)
      assert.deepEqual(await snapshot(), before)
    } finally {
      page.off('response', observe)
      // Preserve a concurrent builder's newer artifact, if one arrived during the probe.
      if ((await readFile(artifact)).equals(marked)) await writeFile(artifact, original)
    }
    return { changedArtifactDelivered: true, layoutRetained: true }
  })
  await check('dark theme uses the host tokens without losing the workspace', async () => {
    const before = await snapshot()
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForTimeout(200)
    assert.equal(await workspace.count(), 1)
    assert.deepEqual(await snapshot(), before)
    await page.screenshot({ path: resolve(dir, 'artifacts/dark-workspace.png') })
    return { hostTheme: await page.evaluate(() => document.documentElement.style.colorScheme), layoutRetained: true }
  })
  const previewFixtureLog = await readFile(resolve(root, 'temp/dsh-unified-fixtures.log'), 'utf8')
  const previewRefs = ['a', 'b'].map(letter => { const sessionId = previewFixtureLog.match(new RegExp(`acceptance-trace-${letter}-[\\w-]+`))[0]; return { id: `conversation:${sessionId}`, sessionId } })
  const [previewA, previewB] = previewRefs
  await check('sidebar previews replace only temporary tabs; pinning and repeated clicks retain identity', async () => {
    await page.setViewportSize({ width: 1440, height: 960 })
    for (let i = 0; i < 30 && await page.locator('[data-workspace-tab]').count(); i++) {
      await page.locator('[data-workspace-tab]').first().press('Delete')
      await page.waitForTimeout(30)
    }
    assert.equal(Object.keys((await snapshot()).panes).length, 0)
    assert(await workspace.getByRole('button', { name: 'Open conversation', exact: true }).isVisible())
    const select = async ref => {
      const row = page.locator(`[data-workspace-session-id="${ref.sessionId}"]`)
      if (!await row.isVisible()) await page.getByRole('treeitem').filter({ hasText: 'Ungrouped' }).first().click()
      await row.click(); await page.waitForTimeout(120)
    }
    await select(previewA)
    assert.equal(Object.keys((await snapshot()).panes).length, 1)
    await select(previewB)
    let next = await snapshot()
    assert.deepEqual(Object.keys(next.panes), [previewB.id])
    assert.equal(next.panes[previewB.id].pinned, false)
    await tab(previewB.id).dblclick()
    await select(previewA)
    next = await snapshot()
    assert.equal(Object.keys(next.panes).length, 2)
    assert.equal(next.panes[previewB.id].pinned, true)
    await select(previewB)
    assert.equal(Object.keys((await snapshot()).panes).length, 2)
    await open('Git')
    next = await snapshot()
    assert.equal(next.root.type, 'split')
    assert.equal(next.root.ratio, .6)
    return { previewReplaced: true, pinnedRetained: true, firstToolRatio: .6 }
  })
  await check('maximize and project switching preserve project-owned layouts', async () => {
    await tab(previewA.id).click()
    const before = await snapshot()
    const groupId = Object.values(before.groups).find(g => g.panes.includes(previewA.id)).id
    const group = page.locator(`[data-workspace-group="${groupId}"]`)
    await group.getByRole('button', { name: 'Maximize / restore', exact: true }).click()
    assert.equal((await snapshot()).maximized, groupId)
    assert.equal(await page.locator('[data-workspace-group]:visible').count(), 1)
    await group.getByRole('button', { name: 'Maximize / restore', exact: true }).click()
    assert.deepEqual(await snapshot(), before)
    await group.getByRole('button', { name: 'Maximize / restore', exact: true }).click()
    await open('Git')
    assert.equal((await snapshot()).maximized, null)
    assert(await page.locator('[data-workspace-pane="tool:desktop.git"]').isVisible())
    await tab(previewA.id).click()
    assert.deepEqual(await snapshot(), before)
    const other = [a.workspaceId, b.workspaceId].find(id => id !== before.workspaceId)
    await page.getByRole('button', { name: 'Layout', exact: true }).click()
    await page.getByRole('combobox', { name: 'Layout project', exact: true }).selectOption(other)
    assert.equal(await workspace.getAttribute('data-unified-workspace'), other)
    await page.getByRole('button', { name: 'Layout', exact: true }).click()
    await page.getByRole('combobox', { name: 'Layout project', exact: true }).selectOption(before.workspaceId)
    assert.deepEqual(await snapshot(), before)
    return { originalProject: before.workspaceId, otherProject: other, restored: true }
  })
  await check('blur, outside drops and insufficient space cancel without partial layouts', async () => {
    let before = await snapshot()
    const box = await tab(previewA.id).boundingBox()
    await page.mouse.move(box.x + 15, box.y + 12); await page.mouse.down()
    await page.mouse.move(box.x + 100, box.y + 180, { steps: 8 })
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await page.mouse.up()
    assert.deepEqual(await snapshot(), before)
    await drag(tab(previewA.id), { x: 0, y: 0 })
    assert.deepEqual(await snapshot(), before)
    await page.setViewportSize({ width: 560, height: 960 }); await page.waitForTimeout(250)
    before = await snapshot()
    const target = await page.locator('[data-workspace-group]').last().boundingBox()
    await drag(tab(previewA.id), { x: target.x + target.width - 8, y: target.y + 180 })
    assert.deepEqual(await snapshot(), before)
    await page.setViewportSize({ width: 1440, height: 960 })
    return { blur: true, outside: true, insufficientSpace: true }
  })
  await check('floating groups redock as a contiguous ordered set and retain their active tab', async () => {
    const area = await workspace.boundingBox()
    await drag(tab(previewA.id), { x: area.x + 340, y: area.y + 400 }, false, true)
    const into = await tab(previewA.id).boundingBox()
    await drag(tab(previewB.id), { x: into.x + into.width - 4, y: into.y + 14 })
    const before = await snapshot()
    const float = before.floating[0]
    const group = before.groups[float.groupId]
    assert.equal(group.panes.length, 2)
    const targetId = Object.values(before.panes).find(p => /git/i.test(p.kind)).id
    const target = await tab(targetId).boundingBox()
    const box = await page.locator(`[data-workspace-group="${float.groupId}"]`).boundingBox()
    await page.mouse.move(box.x + box.width - 35, box.y + 16); await page.mouse.down()
    await page.mouse.move(target.x + 5, target.y + 14, { steps: 18 }); await page.mouse.up(); await page.waitForTimeout(180)
    const after = await snapshot()
    assert.equal(after.floating.length, 0)
    const joined = Object.values(after.groups).find(g => g.panes.includes(previewA.id))
    const index = joined.panes.indexOf(group.panes[0])
    assert.deepEqual(joined.panes.slice(index, index + 2), group.panes)
    assert.equal(joined.active, group.active)
    await page.screenshot({ path: resolve(dir, 'artifacts/group-redocked.png') })
    return { before: group.panes, after: joined.panes, active: joined.active }
  })
  await check('restored missing providers and inaccessible sessions retain explainable placeholders and long bilingual titles', async () => {
    const before = await snapshot()
    const fixture = structuredClone(before)
    const group = fixture.groups[fixture.focused]
    const title = '不可用插件 · Missing provider with a long title — '.repeat(12)
    const missing = { id: 'acceptance:missing-provider', kind: 'acceptance.provider-missing', title, pinned: true }
    const inaccessible = { id: 'conversation:acceptance-inaccessible', kind: 'conversation', sessionId: 'acceptance-inaccessible', title: '不可访问的会话 · Inaccessible conversation', pinned: true }
    for (const pane of [missing, inaccessible]) { fixture.panes[pane.id] = pane; group.panes.push(pane.id) }
    group.active = missing.id
    // A disposable storage fixture exercises the real restore boundary. No
    // installed provider is disabled and no business state is created.
    await page.evaluate(state => localStorage.setItem(`dsh.workspace.unified.v1:${encodeURIComponent(state.workspaceId)}`, JSON.stringify(state)), fixture)
    await page.reload(); await dismiss()
    assert.deepEqual(await snapshot(), fixture)
    const pane = page.locator(`[data-workspace-pane="${missing.id}"]`)
    assert(await pane.getByRole('status').isVisible())
    assert((await pane.innerText()).includes('Plugin unavailable or conversation inaccessible'))
    const titleBox = await tab(missing.id).boundingBox()
    assert(titleBox.width <= 240)
    await tab(inaccessible.id).click()
    assert((await page.locator(`[data-workspace-pane="${inaccessible.id}"]`).innerText()).includes('Plugin unavailable or conversation inaccessible'))
    await page.screenshot({ path: resolve(dir, 'artifacts/missing-provider-long-title.png') })
    await tab(inaccessible.id).press('Delete'); await tab(missing.id).press('Delete')
    assert.deepEqual(Object.keys((await snapshot()).panes).sort(), Object.keys(before.panes).sort())
    return { providerPlaceholder: true, sessionPlaceholder: true, longTitleClipped: true, businessActions: false }
  })
  assert.equal(errors.length, 0, JSON.stringify(errors))
} catch (error) {
  failure = redact(error.stack ?? error.message)
  console.error(redact(error.message))
  if (page) await page.screenshot({ path: resolve(dir, 'artifacts/failure.png') }).catch(() => {})
} finally {
  await browser?.close()
  await releaseVerification?.()
  await Promise.all([
    writeFile(resolve(dir, 'summary.json'), JSON.stringify({ runId, status: failure ? 'failed' : 'passed', checks, errors, unavailable, failure }, null, 2)),
    writeFile(resolve(dir, 'command.txt'), 'node scripts/test-unified-workbench.mjs\n'),
    writeFile(resolve(dir, 'stdout.log'), checks.map(c => `${c.status} ${c.name}`).join('\n') + '\n'),
    writeFile(resolve(dir, 'stderr.log'), [failure ?? '', ...errors].join('\n')),
    writeFile(resolve(dir, 'env.json'), JSON.stringify({ node: process.version, profile: 'isolated web', viewport: '1440x960', redacted: true }, null, 2)),
    writeFile(resolve(dir, 'artifacts/pointer-events.json'), JSON.stringify(inputEvents, null, 2)),
  ])
  console.log(`Evidence: temp/integration-test-runs/${runId}`)
}
process.exitCode = failure ? 1 : 0
