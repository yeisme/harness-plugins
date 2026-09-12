import { test, expect } from '@playwright/test'

for (const width of [360, 560, 960]) for (const short of [false, true]) {
  test(`tools discovery ${width}px ${short ? 'short' : 'normal'} supports purpose, scope, details and draft`, async ({ page }, info) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`/tools-discovery?width=${width}&short=${short}&lang=zh`)
    const tools = page.locator('[data-mcp-inspector]')
    await expect(tools).toHaveAttribute('data-catalog-state', 'ready')
    await expect(tools).toHaveAttribute('data-tools-session-target', 'a')
    await expect(tools.locator('[data-tools-toolbar]')).toContainText('Fixture A')
    const search = tools.getByRole('searchbox')
    await search.fill('读取')
    await expect(tools.locator('.tools-row-main')).toHaveCount(1)
    await expect(tools.locator('.tools-row-main')).toContainText('read')
    await expect(tools.locator('.tools-row-description')).toContainText('读取')
    const rowHeight = await tools.locator('.tools-row').first().evaluate(el => el.getBoundingClientRect().height)
    expect(rowHeight).toBeLessThanOrEqual(100)
    for (let i = 0; i < 2; i++) {
      await tools.locator('[data-tools-scope-switch="installed"]').click()
      await expect(tools.locator('[data-tools-scope]')).toHaveAttribute('data-tools-scope', 'installed')
      await tools.locator('[data-tools-scope-switch="session"]').click()
      await expect(tools.locator('[data-tools-scope]')).toHaveAttribute('data-tools-scope', 'session')
      await expect(search).toHaveValue('读取')
      await expect(tools.locator('.tools-row-main')).toHaveCount(1)
    }
    const row = tools.locator('.tools-row-main').first()
    await row.click()
    const details = tools.locator('.tools-details-pane')
    await expect(details).toBeVisible()
    if (width > 720) {
      await expect(tools.locator('.tools-catalog-pane')).toBeVisible()
      const left = await tools.locator('.tools-catalog-pane').boundingBox(), right = await details.boundingBox()
      expect(left!.x + left!.width).toBeLessThanOrEqual(right!.x + 1)
      const filterOverlap = await tools.evaluate(el => {
        const family = el.querySelector('.tools-family-tabs')?.getBoundingClientRect()
        if (!family) return false
        return [...el.querySelectorAll('.tools-state-filter')].some(node => {
          const box = node.getBoundingClientRect()
          return box.width > 0 && family.left < box.right - 1 && family.right > box.left + 1 && family.top < box.bottom - 1 && family.bottom > box.top + 1
        })
      })
      expect(filterOverlap).toBe(false)
    } else await expect(tools.locator('.tools-catalog-pane')).toBeHidden()
    const add = tools.locator('[data-tools-add-draft]')
    await expect(add).toContainText('Fixture A')
    await add.click()
    await expect(tools.locator('[data-tools-draft-status]')).toContainText('已加入')
    await add.click()
    await expect(tools.locator('[data-tools-draft-status]')).toContainText('已在')
    expect(await page.evaluate(() => {
      const fixture = (window as any).toolsFixture
      return { inserts: fixture.inserts.length, target: fixture.inserts[0].target.conversationId, draft: fixture.draft, navigations: fixture.navigation.length }
    })).toEqual({ inserts: 1, target: 'a', draft: 'KEEP_EXISTING_DRAFT', navigations: 0 })
    await page.screenshot({ path: info.outputPath(`tools-discovery-${width}-${short ? 'short' : 'normal'}-details.png`) })
    await tools.getByRole('button', { name: /返回目录|Back to catalog/ }).click()
    await expect(row).toBeFocused()
    await row.click()
    await page.keyboard.press('Escape')
    await expect(row).toBeFocused()
    expect(await tools.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: info.outputPath(`tools-discovery-${width}-${short ? 'short' : 'normal'}.png`) })
    expect(errors).toEqual([])
  })
}

test('tools discovery installed-only reason and stale recovery', async ({ page }) => {
  await page.goto('/tools-discovery?width=960&lang=en')
  const tools = page.locator('[data-mcp-inspector]')
  await expect(tools).toHaveAttribute('data-catalog-state', 'ready')
  await tools.locator('[data-tools-scope-switch="installed"]').click()
  await tools.getByRole('searchbox').fill('installed_only')
  await tools.locator('.tools-row-main').click()
  await expect(tools.locator('[data-tools-add-draft]')).toBeDisabled()
  await expect(tools.locator('.tools-details-pane')).toContainText(/not available|unavailable|not exposed/i)
  await tools.getByRole('button', { name: /Back to catalog/ }).click()
  await tools.locator('[data-tools-scope-switch="session"]').click()
  await tools.getByRole('searchbox').fill('read')
  await page.evaluate(() => { (window as any).toolsFixture.fail = true })
  await tools.getByRole('button', { name: /Recheck|Check again/ }).click()
  await expect(tools).toContainText(/stale|outdated|last known|last successful catalog/i)
  await page.evaluate(() => { (window as any).toolsFixture.fail = false })
  await tools.getByRole('button', { name: /Recheck|Check again/ }).first().click()
  await expect(tools).toHaveAttribute('data-catalog-state', 'ready')
  await expect(tools.locator('.tools-row-main')).toHaveCount(1)
})

test('return focus stays in the originating inspector when A has two views', async ({ page }) => {
  await page.goto('/tools-discovery?width=960&lang=en&twins=true')
  const inspectors = page.locator('[data-mcp-inspector]')
  await expect(inspectors).toHaveCount(2)
  await expect(inspectors.nth(1)).toHaveAttribute('data-catalog-state', 'ready')
  const row = inspectors.nth(1).locator('.tools-row-main').first()
  await row.click()
  await inspectors.nth(1).getByRole('button', { name: /Back to catalog/ }).click()
  await expect(row).toBeFocused()
  await expect(inspectors.nth(0).locator('.tools-row-main').first()).not.toBeFocused()
})
