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
