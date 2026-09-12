import { test, expect } from '@playwright/test'

for (const owner of ['eikona', 'scaena']) for (const width of [360, 960]) test(`independent ${owner} ${width}px`, async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: Math.max(1000, width), height: 1000 })
  await page.goto(`/domain-studio?owner=${owner}&width=${width}`)
  await expect(page.locator(`[data-domain-studio=${owner}]`)).toBeVisible()
  await expect(page.locator('[data-lifecycle]')).toHaveCount(0)
  if (owner === 'eikona') {
    await page.getByRole('button', { name: '加载资产', exact: true }).click()
    await page.getByRole('button', { name: '预览图片', exact: true }).click()
    await page.getByRole('button', { name: '确认读取图片', exact: true }).click()
    await expect(page.getByRole('img', { name: 'Élégance · Editorial cover' })).toBeVisible()
    await page.getByRole('button', { name: '原始尺寸', exact: true }).click()
    await page.getByRole('button', { name: '放大', exact: true }).click()
    await page.getByRole('button', { name: '适应窗口', exact: true }).click()
    expect(await page.evaluate(() => (window as unknown as { studioMediaReads: number }).studioMediaReads)).toBe(1)
  } else {
    await page.getByRole('button', { name: /Opening/ }).click()
    await expect(page.getByText('镜头编排与交付')).toBeVisible()
  }
  expect(await page.evaluate(() => (window as unknown as { studioDispatches: number }).studioDispatches)).toBe(0)
  const overflow = await page.locator('#fixture').evaluate(element => element.scrollWidth > element.clientWidth + 1)
  expect(overflow).toBe(false)
  expect(errors).toEqual([])
  await page.locator('#fixture').screenshot({ path: testInfo.outputPath(`${owner}-${width}.png`) })
})
