import { test, expect } from '@playwright/test'

for (const lang of ['zh', 'en']) for (const scenario of ['empty', 'unknown', 'error']) {
  test(`Transcription capability boundary ${scenario} ${lang}`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`/transcription-capabilities?width=360&lang=${lang}&case=${scenario}`)
    if (scenario === 'error') {
      await expect(page.getByText(lang === 'zh' ? '无法读取转写能力，请检查 Sonora 连接与项目权限。' : 'Cannot read transcription capabilities. Check Sonora connectivity and project permissions.', { exact: true })).toBeVisible()
    } else {
      await expect(page.getByText(lang === 'zh' ? '当前未返回可用的转写能力。' : 'No available transcription capabilities were returned.', { exact: true })).toBeVisible()
    }
    const diagnostics = page.getByText(lang === 'zh' ? '未提供完整失败诊断，缺失项不代表已删除或无故障。' : 'Complete failure diagnostics are unavailable. Missing entries do not prove removal or health.', { exact: true })
    if (scenario === 'unknown') await expect(diagnostics).toBeVisible()
    else await expect(diagnostics).toHaveCount(0)
    await expect(page.getByText('fixture', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button')).toHaveCount(1)
    expect(await page.locator('#fixture').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`capabilities-${scenario}-${lang}.png`), fullPage: true })
    if (scenario === 'error') {
      await page.evaluate(() => { (window as any).failCatalog = false })
      await page.getByRole('button', { name: lang === 'zh' ? '刷新' : 'Refresh', exact: true }).click()
      await expect(page.getByText('fixture', { exact: true })).toBeVisible()
      expect(await page.evaluate(() => (window as any).catalogReads)).toBe(2)
    }
    expect(errors).toEqual([])
  })
}

for (const width of [360, 560, 960]) for (const lang of ['zh', 'en']) {
  test(`Transcription capabilities ${width}px ${lang}`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`/transcription-capabilities?width=${width}&lang=${lang}`)
    await expect(page.getByText(lang === 'zh' ? '测试 provider' : 'Fixture provider', { exact: true })).toBeVisible()
    await expect(page.getByText('external_runtime', { exact: false })).toBeVisible()
    await expect(page.getByText(lang === 'zh' ? '此目录未提供执行报价。' : 'This catalog does not provide an execution quote.', { exact: true })).toBeVisible()
    await expect(page.getByText('command-asr', { exact: true })).toBeVisible()
    expect(await page.locator('#fixture').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`capabilities-${width}-${lang}.png`), fullPage: true })
    await page.evaluate(() => { (window as any).failCatalog = true })
    const refresh = page.getByRole('button', { name: lang === 'zh' ? '刷新' : 'Refresh', exact: true })
    await refresh.focus(); await page.keyboard.press('Enter')
    await expect(page.getByText(lang === 'zh' ? '刷新失败，以下为上次获取的目录，可能已过期。' : 'Refresh failed. The previous catalog below may be stale.', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => (window as any).catalogReads)).toBe(2)
    expect(errors).toEqual([])
  })
}
