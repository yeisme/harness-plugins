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
  // The fixture brief lists two signals; the first signal's details carry evidence-a.
  await expect(page.locator('article').first().getByText('证据引用: evidence-a')).toBeVisible()
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
  // The fixture brief lists two signals; detail navigation exercises the first row (signal-a).
  const open = page.getByRole('button', { name: '打开详情', exact: true }).first()
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

test('weekly review keeps original and follow-up side by side with a separate inconclusive section', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 560, height: 900 })
  await page.goto('/market?width=560&lang=zh')
  // The brief's corrections carry an explicit entry into the frozen review.
  await expect(page.getByText('本窗口包含 1 处更正')).toBeVisible()
  await page.getByRole('button', { name: '回顾', exact: true }).click()
  await expect(page.getByRole('heading', { name: '判断回顾', exact: true })).toBeVisible()
  // Cutoff, frozen identity and the owner limitation stay visible.
  await expect(page.locator('[data-radar-market-review]').getByText('截止:')).toBeVisible()
  await expect(page.getByText('market-review-fixture · market-review-builder.v1')).toBeVisible()
  await page.locator('[data-radar-market-review] summary').first().click()
  await expect(page.getByText('No later evidence is inconclusive, never a failed prediction.')).toBeVisible()
  // Judged entries keep the original and follow-up revisions side by side.
  expect(await page.locator('[data-review-outcome="sustained"] .ys-row').count()).toBe(2)
  expect(await page.locator('[data-review-outcome="retracted"] .ys-row').count()).toBe(2)
  // Inconclusive lives in its own section with the non-scoring copy.
  await expect(page.getByRole('heading', { name: '暂无法判断', exact: true })).toBeVisible()
  await expect(page.getByText('截止前无后续证据，不计成败')).toBeVisible()
  // The correction entry opens the follow-up correction revision in the shared detail view.
  await page.locator('[data-review-outcome="retracted"]').getByRole('button', { name: '查看更正', exact: true }).click()
  await expect(page.getByRole('heading', { name: '信号详情', exact: true })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { marketFixture: { reviewReads: unknown[]; detailSelections: unknown[] } }).marketFixture.reviewReads)).toEqual(['market-review-fixture'])
  expect(await page.evaluate(() => (window as unknown as { marketFixture: { detailSelections: unknown[] } }).marketFixture.detailSelections)).toEqual([{ signalRef: 'signal-a', revision: 4 }])
  await page.getByRole('button', { name: '返回列表', exact: true }).click()
  await expect(page.getByRole('heading', { name: '信号详情', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(560)
  expect(errors).toEqual([])
})
