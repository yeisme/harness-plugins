import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Browser acceptance for dsh-selection-conversation-actions-v1 (design
 * Verification Plan S1–S9 + tasks 4.2/4.3). Component-fixture coverage only:
 * the fixture bridge stands in for host-owned draft/target authority; real
 * pointer input is used for the pin/drag handle (no `.click()` for drags).
 */

interface FixtureTarget {
  readonly workspaceId: string
  readonly conversationId: string
  readonly draftRevision?: number
  readonly title?: string
}

interface FixtureAdd {
  readonly requestId: string
  readonly target: FixtureTarget
  readonly activation?: { readonly focus: string }
  readonly reference?: unknown
}

async function openReferenceFixture(page: Page, params: string, viewport?: { width: number; height: number }): Promise<Locator> {
  if (viewport !== undefined) await page.setViewportSize(viewport)
  await page.goto(`/selection?reference=true&${params}`)
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true')
  await page.locator('#sample').evaluate(element => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
  const overlay = page.locator('[data-dsh-selection-actions]')
  await expect(overlay).toBeVisible()
  return overlay
}

function toolbarAction(overlay: Locator, actionId: string): Locator {
  return overlay.locator('.sa-toolbar').locator(`button[data-action-id="${actionId}"]`)
}

async function expectWithinViewport(locator: Locator, width: number, height: number): Promise<void> {
  const box = await locator.boundingBox()
  expect(box, 'visible control has a layout box').not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(width)
  expect(box!.y + box!.height).toBeLessThanOrEqual(height)
}

const referenceAdds = (page: Page): Promise<FixtureAdd[]> =>
  page.evaluate(() => (window as unknown as { __referenceAdds: FixtureAdd[] }).__referenceAdds)
const submits = (page: Page): Promise<Array<Record<string, unknown>>> =>
  page.evaluate(() => (window as unknown as { __submits: Array<Record<string, unknown>> }).__submits)
const chooseCalls = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __chooseCalls?: number }).__chooseCalls ?? 0)
const resolutionCount = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __resolutions?: number }).__resolutions ?? 0)
const focusInsideOverlay = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const active = document.activeElement
    return active !== null && active.closest('[data-dsh-selection-actions]') !== null
  })

async function openMorePanel(overlay: Locator): Promise<Locator> {
  await overlay.locator('.sa-toolbar [data-role="more-toggle"]').click()
  return overlay.locator('.sa-more')
}

test('S1 add to chat inserts into the explicit target, keeps source focus, never sends', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const overlay = await openReferenceFixture(page, 'theme=light')
  const add = toolbarAction(overlay, 'dsh:reference')
  await expect(add).toHaveText('Add to chat')
  await expect(add).toBeEnabled()
  await add.click()
  await expect(overlay.locator('.sa-feedback')).toContainText('Added to Visual fixture chat')
  const adds = await referenceAdds(page)
  expect(adds).toHaveLength(1)
  expect(adds[0]!.target).toEqual({
    workspaceId: 'visual-workspace',
    conversationId: 'visual-conversation',
    draftRevision: 3,
    title: 'Visual fixture chat',
  })
  expect(adds[0]!.activation).toBeUndefined()
  // no send/submit channel fired; source focus is preserved outside the overlay
  expect(await submits(page)).toHaveLength(0)
  expect(await focusInsideOverlay(page)).toBe(false)
  expect(errors).toEqual([])
})

test('S2 ask with reference carries activation and reports the confirmed focus', async ({ page }) => {
  const overlay = await openReferenceFixture(page, 'theme=light&act=1')
  const ask = toolbarAction(overlay, 'dsh:ask-with-reference')
  await expect(ask).toHaveText('Ask with reference')
  await expect(ask).toBeEnabled()
  await ask.click()
  await expect(overlay.locator('.sa-feedback')).toContainText('Added to Visual fixture chat; continue your question there')
  const adds = await referenceAdds(page)
  expect(adds).toHaveLength(1)
  expect(adds[0]!.activation).toEqual({ focus: 'composer' })
  // the draft channel stays silent: no submit, no auto-send
  expect(await submits(page)).toHaveLength(0)
})

test('S2 ask entry is disabled with a reason when the host lacks activation', async ({ page }) => {
  const overlay = await openReferenceFixture(page, 'theme=light')
  await expect(toolbarAction(overlay, 'dsh:reference')).toBeEnabled()
  await expect(toolbarAction(overlay, 'dsh:ask-with-reference')).toHaveCount(0)
  const more = await openMorePanel(overlay)
  const ask = more.locator('button[data-action-id="dsh:ask-with-reference"]')
  await expect(ask).toBeVisible()
  await expect(ask).toBeDisabled()
  await expect(ask).toHaveAttribute('title', 'Host cannot focus the composer after insert')
  await expect(more.locator('button[data-action-id="dsh:ask-with-reference"] + .sa-reason'))
    .toContainText('Host cannot focus the composer after insert')
  // 添加到对话 stays available while 引用并询问 degrades honestly
  await expect(toolbarAction(overlay, 'dsh:reference')).toBeEnabled()
})

test('S3 add uses the captured fixture target; a selected choose switches the next insert', async ({ page }) => {
  const overlay = await openReferenceFixture(page, 'theme=light&choose=1&chooseResult=selected')
  const add = toolbarAction(overlay, 'dsh:reference')
  await expect(add).toBeEnabled()
  await add.click()
  await expect(overlay.locator('.sa-feedback')).toContainText('Added to Visual fixture chat')
  let adds = await referenceAdds(page)
  expect(adds).toHaveLength(1)
  expect(adds[0]!.target).toMatchObject({ workspaceId: 'visual-workspace', conversationId: 'visual-conversation', draftRevision: 3 })
  const resolvedBefore = await resolutionCount(page)

  const more = await openMorePanel(overlay)
  const choose = more.locator('button[data-action-id="dsh:choose-conversation"]')
  await expect(choose).toBeEnabled()
  await choose.click()
  await expect(overlay.locator('.sa-feedback')).toContainText('Selected conversation Second fixture chat')
  expect(await chooseCalls(page)).toBe(1)
  // the plugin re-resolves the selection against the new target before the next insert
  await expect.poll(() => resolutionCount(page)).toBe(resolvedBefore + 1)

  await expect(add).toBeEnabled()
  await add.click()
  await expect(overlay.locator('.sa-feedback')).toContainText('Added to Second fixture chat')
  adds = await referenceAdds(page)
  expect(adds).toHaveLength(2)
  expect(adds[1]!.target).toEqual({
    workspaceId: 'visual-workspace',
    conversationId: 'visual-conversation-2',
    draftRevision: 1,
    title: 'Second fixture chat',
  })
})

test('S3/S4 a cancelled choose keeps the target and creates nothing', async ({ page }) => {
  const overlay = await openReferenceFixture(page, 'theme=light&choose=1&chooseResult=cancelled')
  const add = toolbarAction(overlay, 'dsh:reference')
  await expect(add).toBeEnabled()
  const more = await openMorePanel(overlay)
  await more.locator('button[data-action-id="dsh:choose-conversation"]').click()
  await expect.poll(() => chooseCalls(page)).toBe(1)
  // cancelled: no new conversation, no fake receipt, no feedback claimed
  await expect(overlay.locator('.sa-feedback')).toBeHidden()
  await expect(add).toBeEnabled()
  await add.click()
  await expect(overlay.locator('.sa-feedback')).toContainText('Added to Visual fixture chat')
  const adds = await referenceAdds(page)
  expect(adds).toHaveLength(1)
  expect(adds[0]!.target.conversationId).toBe('visual-conversation')
})

test('S3/S4 an unavailable choose reports the reason without inserting', async ({ page }) => {
  const overlay = await openReferenceFixture(page, 'theme=light&choose=1&chooseResult=unavailable')
  await expect(toolbarAction(overlay, 'dsh:reference')).toBeEnabled()
  const more = await openMorePanel(overlay)
  await more.locator('button[data-action-id="dsh:choose-conversation"]').click()
  await expect(overlay.locator('.sa-feedback')).toContainText('fixture chooser unavailable')
  expect(await chooseCalls(page)).toBe(1)
  expect(await referenceAdds(page)).toHaveLength(0)
})

test('S3 choose entry is disabled with a reason when the host capability is absent', async ({ page }) => {
  const overlay = await openReferenceFixture(page, 'theme=light')
  await expect(toolbarAction(overlay, 'dsh:reference')).toBeEnabled()
  const more = await openMorePanel(overlay)
  const choose = more.locator('button[data-action-id="dsh:choose-conversation"]')
  await expect(choose).toBeVisible()
  await expect(choose).toBeDisabled()
  await expect(choose).toHaveAttribute('title', 'Host cannot pick or create a conversation')
})

test('S4 a pending insert dedupes repeated confirmed clicks', async ({ page }) => {
  const overlay = await openReferenceFixture(page, 'theme=light&delay=600')
  const add = toolbarAction(overlay, 'dsh:reference')
  await expect(add).toBeEnabled()
  await add.click()
  await add.click()
  await expect(overlay.locator('.sa-feedback')).toContainText('Added to Visual fixture chat')
  // exactly one insert per confirmed action, even after the receipt settles
  expect(await referenceAdds(page)).toHaveLength(1)
})

test('S5 source details shows the owner proof, disables locate, and closes on Escape', async ({ page }) => {
  const overlay = await openReferenceFixture(page, 'theme=light')
  await expect(toolbarAction(overlay, 'dsh:reference')).toBeEnabled()
  const more = await openMorePanel(overlay)
  const details = more.locator('button[data-action-id="dsh:reference-details"]')
  await expect(details).toBeEnabled()
  await details.click()
  const popover = page.locator('.dsh-selection-reference-details')
  await expect(popover).toBeVisible()
  await expect(popover).toContainText('visual-fixture')
  await expect(popover).toContainText('fixture:selection-sample')
  await expect(popover).toContainText('fixture-v1')
  await expect(popover).toContainText('raw-text')
  await expect(popover).toContainText('Visual fixture chat')
  const locate = popover.locator('button[data-action="locate"]')
  await expect(locate).toBeDisabled()
  await expect(locate).toHaveAttribute('title', 'Locating the source is not available')
  await expect(popover.locator('button[data-action="close"]')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(popover).toBeHidden()
  // focus is not stranded inside the closed popover and the toolbar is back
  await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true)
  await expect(overlay.locator('.sa-toolbar')).toBeVisible()
  expect(await referenceAdds(page)).toHaveLength(0)
})

test('S5 without a structured source the explicit text-quote fallback opens an editable draft, never a silent send', async ({ page }) => {
  const overlay = await openReferenceFixture(page, 'theme=light&nosource=1')
  await expect(overlay.locator('.sa-toolbar')).toBeVisible()
  const more = await openMorePanel(overlay)
  const reference = more.locator('button[data-action-id="dsh:reference"]')
  await expect(reference).toBeDisabled()
  await expect(more.locator('button[data-action-id="dsh:reference-details"]')).toBeDisabled()
  const textQuote = more.locator('button[data-action-id="dsh:add-text-quote"]')
  await expect(textQuote).toHaveText('Add as text quote')
  await expect(textQuote).toBeEnabled()
  await textQuote.click()
  // 显式文字引用 = 打开带标注的可编辑草稿；点击本身不派发 submit、不写主草稿。
  const composer = page.locator('.dsh-selection-composer')
  await expect(composer).toBeVisible()
  await expect(composer.locator('textarea')).toHaveValue(/Failed to load plugins/)
  await expect(composer.locator('.dsh-selection-composer__card')).toHaveText('Selected text draft (no linked source)')
  expect(await submits(page)).toHaveLength(0)
  expect(await referenceAdds(page)).toHaveLength(0)
  await page.keyboard.press('Escape')
  await expect(composer).toBeHidden()
})

test('S6 real pointer: click pins, sub-threshold release clicks, drag moves and pins once', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const overlay = await openReferenceFixture(page, 'theme=light')
  const toolbar = overlay.locator('.sa-toolbar')
  await expect(toolbarAction(overlay, 'dsh:reference')).toBeEnabled()
  const handle = toolbar.locator('button.sa-pin')
  await expect(handle).toHaveAttribute('aria-pressed', 'false')
  const handleCenter = async (): Promise<{ x: number; y: number }> => {
    const box = await handle.boundingBox()
    expect(box, 'pin handle has a layout box').not.toBeNull()
    return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
  }

  // real click (down+up, no move) toggles the pin on; the toolbar stays visible
  let point = await handleCenter()
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.up()
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  await expect(toolbar).toBeVisible()
  await expect(overlay.locator('.sa-feedback')).toContainText('Toolbar position pinned')

  // a second real click unpins
  await page.mouse.down()
  await page.mouse.up()
  await expect(handle).toHaveAttribute('aria-pressed', 'false')

  // sub-threshold move (3px) + release is a click: pins, no geometry change
  const before = await toolbar.boundingBox()
  point = await handleCenter()
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.move(point.x + 3, point.y, { steps: 2 })
  await page.mouse.up()
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  const afterTap = await toolbar.boundingBox()
  expect(Math.abs(afterTap!.x - before!.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(afterTap!.y - before!.y)).toBeLessThanOrEqual(1)

  // a real drag (60px/40px, stepped) moves the toolbar to actual coordinates and pins it
  point = await handleCenter()
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.move(point.x + 60, point.y + 40, { steps: 8 })
  await page.mouse.up()
  const afterDrag = await toolbar.boundingBox()
  expect(Math.abs(afterDrag!.x - (before!.x + 60))).toBeLessThanOrEqual(2)
  expect(Math.abs(afterDrag!.y - (before!.y + 40))).toBeLessThanOrEqual(2)
  // the trailing click after the drop is swallowed: still pinned, no second toggle
  await page.waitForTimeout(150)
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  await expect(overlay.locator('.sa-feedback')).toContainText('Toolbar moved and pinned')

  // a fresh real click unpins again
  point = await handleCenter()
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.up()
  await expect(handle).toHaveAttribute('aria-pressed', 'false')
  expect(errors).toEqual([])
})

test('S7 Escape mid-drag restores geometry and pin state; the handle keeps working', async ({ page }) => {
  const overlay = await openReferenceFixture(page, 'theme=light')
  const toolbar = overlay.locator('.sa-toolbar')
  await expect(toolbarAction(overlay, 'dsh:reference')).toBeEnabled()
  const handle = toolbar.locator('button.sa-pin')
  const before = await toolbar.boundingBox()
  const handleBox = await handle.boundingBox()
  const point = { x: handleBox!.x + handleBox!.width / 2, y: handleBox!.y + handleBox!.height / 2 }
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.move(point.x + 50, point.y + 30, { steps: 6 })
  const during = await toolbar.boundingBox()
  expect(Math.abs(during!.x - (before!.x + 50))).toBeLessThanOrEqual(2)
  expect(Math.abs(during!.y - (before!.y + 30))).toBeLessThanOrEqual(2)
  // cancel while the pointer is still down, then release
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await page.waitForTimeout(150)
  const restored = await toolbar.boundingBox()
  expect(Math.abs(restored!.x - before!.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(restored!.y - before!.y)).toBeLessThanOrEqual(1)
  await expect(handle).toHaveAttribute('aria-pressed', 'false')
  await expect(overlay.locator('.sa-feedback')).toContainText('Move cancelled; position restored')
  // the cancelled gesture leaves no stuck suppression: a fresh click pins
  const handleBoxAfter = await handle.boundingBox()
  await page.mouse.move(handleBoxAfter!.x + handleBoxAfter!.width / 2, handleBoxAfter!.y + handleBoxAfter!.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
})

test('S7 a pinned toolbar ignores scroll while an unpinned one dismisses', async ({ page }) => {
  const overlay = await openReferenceFixture(page, 'theme=light&tall=1')
  const toolbar = overlay.locator('.sa-toolbar')
  await expect(toolbarAction(overlay, 'dsh:reference')).toBeEnabled()
  const handle = toolbar.locator('button.sa-pin')
  const handleBox = await handle.boundingBox()
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  const pinnedBox = await toolbar.boundingBox()
  await page.evaluate(() => window.scrollTo(0, 600))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(600)
  await page.waitForTimeout(100)
  await expect(toolbar).toBeVisible()
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  const afterScroll = await toolbar.boundingBox()
  expect(Math.abs(afterScroll!.x - pinnedBox!.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(afterScroll!.y - pinnedBox!.y)).toBeLessThanOrEqual(1)

  // unpinned arm: the same scroll dismisses the floating toolbar (existing behavior)
  const unpinned = await openReferenceFixture(page, 'theme=light&tall=1')
  await expect(toolbarAction(unpinned, 'dsh:reference')).toBeEnabled()
  await expect(unpinned.locator('.sa-toolbar')).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 600))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(600)
  await expect(unpinned).toBeHidden()
})

const s8Themes = [
  { name: 'light', theme: 'light', colorScheme: 'light', background: 'rgb(255, 255, 255)' },
  { name: 'dark', theme: 'dark', colorScheme: 'dark', background: 'rgb(42, 42, 47)' },
  { name: 'system-dark', theme: 'system', colorScheme: 'dark', background: 'rgb(42, 42, 47)' },
  { name: 'system-light', theme: 'system', colorScheme: 'light', background: 'rgb(255, 255, 255)' },
] as const

for (const themeCase of s8Themes) {
  test(`S8 ${themeCase.name}: transparent overlay root, host-alias toolbar, no motion`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: themeCase.colorScheme, reducedMotion: 'reduce' })
    const overlay = await openReferenceFixture(page, `theme=${themeCase.theme}`)
    const toolbar = overlay.locator('.sa-toolbar')
    await expect(toolbar).toBeVisible()
    await expect(toolbar).toHaveCSS('background-color', themeCase.background)
    // gray-veil regression guard: the overlay root itself stays transparent
    await expect(overlay).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(toolbar).toHaveCSS('animation-name', 'none')
    await expect(toolbar).toHaveCSS('transition-duration', '0s')
  })
}

test('S8 keyboard-only: Tab to the handle, Enter pins, arrows move, Escape closes', async ({ page }) => {
  const overlay = await openReferenceFixture(page, 'theme=light')
  const toolbar = overlay.locator('.sa-toolbar')
  await expect(toolbarAction(overlay, 'dsh:reference')).toBeEnabled()
  const handle = toolbar.locator('button.sa-pin')
  const tabToHandle = async (): Promise<void> => {
    for (let index = 0; index < 12; index += 1) {
      if (await handle.evaluate(element => document.activeElement === element)) return
      await page.keyboard.press('Tab')
    }
  }
  await tabToHandle()
  await expect(handle).toBeFocused()
  await expect(handle).toHaveCSS('outline-width', '2px')
  await expect(handle).toHaveAttribute('aria-label', 'Pin position (click to pin, drag to move)')
  await page.keyboard.press('Enter')
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  await expect(handle).toHaveAttribute('aria-label', 'Unpin position')
  // pinning re-renders the toolbar; re-focus the handle by keyboard before moving
  await tabToHandle()
  await expect(handle).toBeFocused()
  const before = await toolbar.boundingBox()
  await page.keyboard.press('ArrowRight')
  const moved = await toolbar.boundingBox()
  expect(Math.abs(moved!.x - (before!.x + 8))).toBeLessThanOrEqual(1)
  expect(Math.abs(moved!.y - before!.y)).toBeLessThanOrEqual(1)
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(overlay).toBeHidden()
})

for (const width of [360, 560, 960] as const) {
  test(`4.2/4.3 primary reference action stays reachable and unclipped at ${width}px`, async ({ page }) => {
    const overlay = await openReferenceFixture(page, 'theme=light', { width, height: 900 })
    if (width < 560) {
      const entry = overlay.locator('[data-role="sheet-entry"]')
      await expect(entry).toBeVisible()
      await expectWithinViewport(entry, width, 900)
      await entry.click()
      const sheet = overlay.locator('.sa-sheet')
      const reference = sheet.locator('button[data-action-id="dsh:reference"]')
      await expect(reference).toBeVisible()
      await expect(reference).toBeEnabled()
      await expectWithinViewport(sheet, width, 900)
      await expectWithinViewport(reference, width, 900)
    } else {
      const reference = toolbarAction(overlay, 'dsh:reference')
      await expect(reference).toBeVisible()
      await expect(reference).toBeEnabled()
      await expectWithinViewport(reference, width, 900)
      await expectWithinViewport(overlay.locator('.sa-toolbar'), width, 900)
    }
  })
}

test('4.3 200% zoom keeps the handle and primary action actionable', async ({ page }) => {
  const overlay = await openReferenceFixture(page, 'theme=light')
  const reference = toolbarAction(overlay, 'dsh:reference')
  await expect(reference).toBeEnabled()
  const handle = overlay.locator('.sa-toolbar button.sa-pin')
  await page.evaluate(() => { document.body.style.zoom = '2' })
  await expect(reference).toBeVisible()
  await expect(reference).toBeEnabled()
  await expect(handle).toBeVisible()
  await handle.click()
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
})

test('4.3 a pinned toolbar re-clamps into a 360px viewport instead of clipping', async ({ page }) => {
  const overlay = await openReferenceFixture(page, 'theme=light', { width: 560, height: 900 })
  const toolbar = overlay.locator('.sa-toolbar')
  const handle = toolbar.locator('button.sa-pin')
  await expect(toolbarAction(overlay, 'dsh:reference')).toBeEnabled()
  await handle.click()
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  await page.setViewportSize({ width: 360, height: 900 })
  await expect(toolbar).toBeVisible()
  // resize 事件异步派发：轮询直到重新约束生效，再断言几何。
  await expect.poll(async () => {
    const box = await toolbar.boundingBox()
    return box === null ? Number.POSITIVE_INFINITY : box.x + box.width
  }).toBeLessThanOrEqual(360)
  await expectWithinViewport(toolbar, 360, 900)
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
})

test('4.2 zh labels render and a pseudo locale falls back without crashing', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const zhOverlay = await openReferenceFixture(page, 'theme=light&locale=zh&act=1')
  await expect(toolbarAction(zhOverlay, 'dsh:reference')).toHaveText('添加到对话')
  await expect(toolbarAction(zhOverlay, 'dsh:ask-with-reference')).toHaveText('引用并询问')
  const pseudoOverlay = await openReferenceFixture(page, 'theme=light&locale=ps')
  await expect(toolbarAction(pseudoOverlay, 'dsh:reference')).toHaveText('Add to chat')
  expect(errors).toEqual([])
})

test('4.2/4.3 a 47-char target title stays bounded in the receipt at 360px', async ({ page }) => {
  const overlay = await openReferenceFixture(page, 'theme=light&longtitle=1', { width: 360, height: 900 })
  await expect(overlay.locator('.sa-toolbar')).toBeVisible()
  await overlay.locator('[data-role="sheet-entry"]').click()
  const sheet = overlay.locator('.sa-sheet')
  const add = sheet.locator('button[data-action-id="dsh:reference"]')
  await expect(add).toBeEnabled()
  await add.click()
  const feedback = overlay.locator('.sa-feedback')
  await expect(feedback).toContainText('Northern Lights production review session')
  await expectWithinViewport(feedback, 360, 900)
})

test('4.3 coarse-pointer sheet actions meet the 44px touch target', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 360, height: 900 },
    reducedMotion: 'reduce',
    baseURL: 'http://127.0.0.1:4178',
  })
  try {
    const page = await context.newPage()
    const overlay = await openReferenceFixture(page, 'theme=light')
    await overlay.locator('[data-role="sheet-entry"]').click()
    const sheet = overlay.locator('.sa-sheet')
    await expect(sheet.locator('button[data-action-id="dsh:reference"]')).toBeEnabled()
    for (const button of await sheet.locator('button:visible').all()) {
      const box = await button.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(44)
      expect(box!.width).toBeGreaterThanOrEqual(44)
    }
  } finally {
    await context.close()
  }
})

test('S9 a host failure keeps the selection, shows the reason, and never auto-retries', async ({ page }) => {
  const overlay = await openReferenceFixture(page, 'theme=light&fail=1')
  const toolbar = overlay.locator('.sa-toolbar')
  const add = toolbarAction(overlay, 'dsh:reference')
  await expect(add).toBeEnabled()
  await add.click()
  // unknown host reason codes map to the honest fail-closed message
  await expect(overlay.locator('.sa-feedback')).toContainText('Could not reference this selection')
  expect(await referenceAdds(page)).toHaveLength(1)
  await page.waitForTimeout(200)
  expect(await referenceAdds(page)).toHaveLength(1)
  expect(await submits(page)).toHaveLength(0)
  // selection and toolbar content survive the failure; no silent resend
  await expect(toolbar).toBeVisible()
  await expect(toolbarAction(overlay, 'dsh:reference')).toBeEnabled()
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toContain('Failed to load plugins')
})
