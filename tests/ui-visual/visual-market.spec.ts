import { expect, test } from '@playwright/test'

for (const width of [360, 560, 960]) test(`market reading ${width}px`, async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 900 })
  await page.goto(`/market?width=${width}&lang=zh`)
  await expect(page.locator('[data-radar-market]')).toBeVisible()
  await expect(page.getByText('判断更正 · 已撤回')).toBeVisible()
  await expect(page.getByText('来源身份待核验')).toBeVisible()
  await expect(page.locator('.ys-context-value')).toContainText('Asia/Shanghai')
  await expect(page.locator('time').first()).toContainText('08:00')
  expect(await page.locator('.ys-context-value').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  const summary = page.locator('summary').first()
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('证据引用: evidence-a')).toBeVisible()
  expect(await summary.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await page.screenshot({ path: info.outputPath('market.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('policy invalidation clears rendered signal content without another owner read', async ({ page }) => {
  await page.goto('/market?width=560&lang=en')
  await expect(page.getByText('Correction · Retracted')).toBeVisible()
  await page.evaluate(() => {
    const fixture = (window as unknown as { marketFixture: { policyListeners: (() => void)[] } }).marketFixture
    fixture.policyListeners.forEach(listener => listener())
  })
  await expect(page.getByText('Correction · Retracted')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { marketFixture: { reads: number } }).marketFixture.reads)).toBe(1)
})

test('catch-up follows the empty continuation page and stops at the last cursor', async ({ page }) => {
  await page.goto('/market?width=360&lang=zh')
  await page.getByRole('button', { name: '未读补看', exact: true }).click()
  await expect(page.getByText('本页没有可显示项目，仍有后续页')).toBeVisible()
  await page.getByRole('button', { name: '下一页', exact: true }).click()
  await expect(page.getByRole('heading', { name: '第二页未读测试信号' })).toBeVisible()
  await expect(page.getByRole('button', { name: '下一页', exact: true })).toBeDisabled()
  expect(await page.evaluate(() => (window as unknown as { marketFixture: { catchupCursors: unknown[] } }).marketFixture.catchupCursors)).toEqual([null, 'page_two'])
  await page.getByRole('button', { name: '变化简报', exact: true }).click()
  await expect(page.getByText('来源身份待核验')).toBeVisible()
})

test('detail navigation requests the selected revision and restores focus to its list button', async ({ page }) => {
  await page.goto('/market?width=360&lang=zh')
  const open = page.getByRole('button', { name: '打开详情', exact: true })
  await open.click()
  await expect(page.getByRole('heading', { name: '信号详情', exact: true })).toBeFocused()
  await expect(page.getByText('signal-a · 修订 2')).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { marketFixture: { detailSelections: unknown[] } }).marketFixture.detailSelections)).toEqual([{ signalRef: 'signal-a', revision: 2 }])
  await page.getByRole('button', { name: '返回列表', exact: true }).click()
  await expect(open).toBeFocused()
  await expect(page.getByRole('heading', { name: '信号详情', exact: true })).toHaveCount(0)
})

test('comparison requires two explicit revisions and keeps both sides side by side', async ({ page }) => {
  await page.goto('/market?width=960&lang=en')
  const buttons = page.getByRole('button', { name: 'Add comparison', exact: true })
  await buttons.nth(0).click(); await buttons.nth(1).click()
  await page.getByRole('button', { name: 'Open comparison', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Cross-market comparison', exact: true })).toBeVisible()
  await expect(page.getByText('Each side keeps its source scope; no shared numeric axis or causal conclusion.')).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { marketFixture: { compareSelections: unknown[] } }).marketFixture.compareSelections)).toEqual([{ left: { signalRef: 'signal-a', revision: 2 }, right: { signalRef: 'signal-b', revision: 2 } }])
  await page.getByRole('button', { name: 'Back to list', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Add comparison', exact: true }).first()).toBeVisible()
})
