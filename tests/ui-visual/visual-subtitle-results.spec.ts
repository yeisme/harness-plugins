import { readFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'

for (const width of [360, 560, 960]) for (const lang of ['zh', 'en']) for (const format of ['srt', 'vtt']) {
  test(`Subtitle results ${width}px ${lang} ${format}`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`/subtitle-results?width=${width}&lang=${lang}&format=${format}`)
    const open = page.getByRole('button', { name: lang === 'zh' ? '查看 Fixture subtitle' : 'View Fixture subtitle' })
    await expect(open).toBeVisible()
    expect(await page.evaluate(() => (window as any).subtitleReadCount)).toBe(0)
    await open.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText('完整字幕内容', { exact: false })).toBeVisible()
    await expect(page.getByText('a'.repeat(64), { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: lang === 'zh' ? '复制字幕' : 'Copy subtitles', exact: true })).toBeVisible()
    const downloadEvent = page.waitForEvent('download')
    await page.getByRole('button', { name: lang === 'zh' ? '下载字幕文件' : 'Download subtitles' }).click()
    const download = await downloadEvent
    expect(download.suggestedFilename()).toBe(`subtitles.${format}`)
    const path = testInfo.outputPath(`subtitles.${format}`)
    await download.saveAs(path)
    expect(await readFile(path, 'utf8')).toBe(await page.evaluate(() => (window as any).subtitleFixtureContent))
    expect(await page.evaluate(() => (window as any).subtitleReadCount)).toBe(2)
    expect(await page.locator('#fixture').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`subtitle-${width}-${lang}-${format}.png`), fullPage: true })
    expect(errors).toEqual([])
  })
}
