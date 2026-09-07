import { expect, test, type Locator, type Page } from '@playwright/test'

const cases = [
  ['navigator', 360],
  ['navigator', 560],
  ['navigator', 960],
  ['workspace', 360],
  ['workspace', 560],
  ['workspace', 960],
  ['inspector', 560],
  ['dialog', 560],
  ['micro', 360],
] as const

const namedCases = ['creator', 'source-control', 'desktop-git', 'command-dialog', 'session-tags', 'rich-media'] as const

const referenceThemeCases = [
  { name: 'light', theme: 'light', colorScheme: 'light', toolbarBackground: 'rgb(255, 255, 255)' },
  { name: 'dark', theme: 'dark', colorScheme: 'dark', toolbarBackground: 'rgb(30, 30, 33)' },
  { name: 'system-light', theme: 'system', colorScheme: 'light', toolbarBackground: 'rgb(255, 255, 255)' },
] as const

async function selectReferenceFixture(page: Page, theme: string, colorScheme: 'light' | 'dark'): Promise<Locator> {
  await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
  await page.goto(`/selection?reference=true&theme=${theme}`)
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true')
  await page.locator('#sample').evaluate(element => {
    const range = document.createRange()
    range.selectNodeContents(element)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
  return page.locator('[data-dsh-selection-actions]')
}

async function expectWithinViewport(locator: Locator, width: number, height: number): Promise<void> {
  const box = await locator.boundingBox()
  expect(box, 'visible control has a layout box').not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(width)
  expect(box!.y + box!.height).toBeLessThanOrEqual(height)
}

for (const width of [360, 560, 960]) {
  for (const locale of ['en', 'zh']) {
    test(`selection artifact ${width}px ${locale}`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/selection?locale=${locale}`)
      await expect(page.locator('body')).toHaveAttribute('data-ready', 'true')
      await page.locator('#sample').evaluate(element => {
        const range = document.createRange()
        range.selectNodeContents(element)
        window.getSelection()?.removeAllRanges()
        window.getSelection()?.addRange(range)
        document.dispatchEvent(new Event('selectionchange'))
      })
      const actions = page.locator('[data-dsh-selection-actions]')
      await expect(actions).toBeVisible()
      if (width < 560) await actions.locator('[data-role="sheet-entry"]').click()
      const comment = actions.locator('[data-action-id="dsh:comment"]:visible')
      if (!await comment.count()) await actions.locator('[data-role="more-toggle"]').click()
      await comment.click()
      const composer = page.locator('.dsh-selection-composer[data-dsh-selection-composer]')
      await expect(composer).toBeVisible()
      await expect(composer.locator('textarea')).toBeFocused()
      await composer.locator('textarea').fill('Local annotation — no model call')
      await expect(composer.locator('[data-action="send"]')).toBeEnabled()
      const box = await composer.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      await expect(composer).toHaveScreenshot(`selection-${locale}-${width}.png`)
      await page.keyboard.press('Escape')
      await expect(composer).not.toBeVisible()
      expect(errors).toEqual([])
    })
  }
}

test('reference action follows real host aliases through light, dark, system, fallback, and canonical override', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/selection?reference=true&theme=system')
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true')
  await page.locator('#sample').evaluate(element => {
    const range = document.createRange()
    range.selectNodeContents(element)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
  const actions = page.locator('[data-dsh-selection-actions]')
  await expect(actions.locator('button[data-action-id="dsh:reference"]')).toHaveText('Add to chat')
  await expect(actions.locator('.sa-toolbar')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(actions.locator('.sa-toolbar')).toHaveCSS('background-color', 'rgb(30, 30, 33)')

  await page.goto('/selection?reference=true&theme=fallback')
  await page.locator('#sample').evaluate(element => {
    const range = document.createRange()
    range.selectNodeContents(element)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
  await expect(page.locator('[data-dsh-selection-actions] .sa-toolbar')).toHaveCSS('background-color', 'rgb(30, 30, 33)')
  await page.locator('[data-dsh-selection-actions]').evaluate(element => element.style.setProperty('--dsw-alias-bg-layer-1', 'rgb(1, 2, 3)'))
  await expect(page.locator('[data-dsh-selection-actions] .sa-toolbar')).toHaveCSS('background-color', 'rgb(1, 2, 3)')
})

/** Component-fixture coverage only; the production host owns composer rendering and target authority. */
for (const width of [360, 560, 960, 1440] as const) {
  for (const themeCase of referenceThemeCases) {
    test(`reference toolbar ${width}px ${themeCase.name} is reachable, focused, motion-safe, and on screen`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.setViewportSize({ width, height: 900 })
      const actions = await selectReferenceFixture(page, themeCase.theme, themeCase.colorScheme)
      const toolbar = actions.locator('.sa-toolbar')
      await expect(toolbar).toBeVisible()
      await expect(toolbar).toHaveCSS('background-color', themeCase.toolbarBackground)
      await expect(actions).toHaveCSS('animation-name', 'none')
      await expect(actions).toHaveCSS('transition-duration', '0s')

      let reference: Locator
      if (width < 560) {
        const entry = toolbar.locator('button[data-role="sheet-entry"]')
        await expect(entry).toBeVisible()
        await expectWithinViewport(entry, width, 900)
        await page.keyboard.press('Tab')
        await expect(entry).toBeFocused()
        await expect(entry).toHaveCSS('outline-width', '2px')
        await page.keyboard.press('Enter')
        const sheet = actions.locator('.sa-sheet')
        reference = sheet.locator('button[data-action-id="dsh:reference"]')
        await expect(sheet).toBeVisible()
        await expect(reference).toBeVisible()
        await expect(reference).toBeEnabled()
        await expect(reference).toHaveClass(/sa-btn--primary/)
        await page.keyboard.press('Tab')
        await expect(reference).toBeFocused()
        await expectWithinViewport(sheet, width, 900)
      } else {
        reference = toolbar.locator('button[data-action-id="dsh:reference"]')
        await expect(reference).toBeVisible()
        await expect(reference).toBeEnabled()
        await expect(reference).toHaveClass(/sa-btn--primary/)
        await page.keyboard.press('Tab')
        await expect(reference).toBeFocused()
        await expectWithinViewport(toolbar, width, 900)
      }
      await expect(reference).toHaveCSS('outline-width', '2px')
      await expectWithinViewport(reference, width, 900)
      expect(errors).toEqual([])
    })
  }
}

test('surface preserves host font, compact controls and scoped colors', async ({ page }) => {
  await page.goto('/?fixture=creator&width=360')
  const root = page.locator('[data-yeisme-surface]').first()
  await expect(root).toHaveCSS('font-size', '12px')
  await expect(root.locator('button').first()).toHaveCSS('font-size', '12px')
  await root.evaluate(element => (element as HTMLElement).style.setProperty('--dsw-alias-bg-base', 'rgb(20, 30, 40)'))
  await expect(root).toHaveCSS('background-color', 'rgb(20, 30, 40)')
  await expect(page.locator('body')).not.toHaveCSS('background-color', 'rgb(20, 30, 40)')
  await page.evaluate(() => { document.body.style.zoom = '2' })
  await expect(root.locator('button').first()).toBeVisible()
  await page.goto('/?fixture=command-dialog&width=360')
  await expect(page.locator('.ys-field input')).toHaveCSS('min-height', '34px')
  await expect(page.locator('.ys-field input')).toHaveCSS('background-color', 'rgb(36, 36, 41)')
})

test.describe('touch annotation', () => {
  test('keeps every visible control reachable at touch size', async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, viewport: { width: 360, height: 900 }, reducedMotion: 'reduce', baseURL: 'http://127.0.0.1:4178' })
    try {
      const page = await context.newPage()
      await page.goto('/selection?locale=zh')
      await expect(page.locator('body')).toHaveAttribute('data-ready', 'true')
      await page.locator('#sample').evaluate(element => {
        const range = document.createRange()
        range.selectNodeContents(element)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        document.dispatchEvent(new Event('selectionchange'))
      })
      await page.locator('[data-role="sheet-entry"]').click()
      await page.locator('[data-action-id="dsh:comment"]:visible').click()
      const composer = page.locator('.dsh-selection-composer[data-dsh-selection-composer]')
      await expect(composer).toHaveCSS('animation-name', 'none')
      for (const button of await composer.locator('button:visible').all()) {
        const box = await button.boundingBox()
        expect(box!.height).toBeGreaterThanOrEqual(44)
        expect(box!.width).toBeGreaterThanOrEqual(44)
      }
    } finally { await context.close() }
  })
})

for (const [kind, width] of cases) {
  test(`${kind} ${width}px`, async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    await page.goto(`/?kind=${kind}&width=${width}`)
    const frame = page.locator('.fixture-frame')
    await expect(frame).toBeVisible()
    await expect(frame).toHaveScreenshot(`${kind}-${width}.png`)
    expect(consoleErrors).toEqual([])
  })
}

for (const fixture of namedCases) {
  for (const width of [360, 560, 960] as const) {
    test(`${fixture} ${width}px`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
      await page.goto(`/?fixture=${fixture}&width=${width}`)
      const frame = page.locator('.fixture-frame')
      await expect(frame).toBeVisible()
      await expect(frame).toHaveScreenshot(`${fixture}-${width}.png`)
      expect(consoleErrors).toEqual([])
    })
  }
}
