import { expect, test } from '@playwright/test'

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
