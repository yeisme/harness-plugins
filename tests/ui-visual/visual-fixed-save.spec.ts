import { expect, test } from '@playwright/test'

for (const width of [360, 560, 960]) for (const lang of ['zh', 'en']) {
  test(`fixed version save ${width}px ${lang}`, async ({ page }, info) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`/fixed-save?width=${width}&lang=${lang}`)
    await expect.poll(async () => errors.length + await page.locator('[data-creator-artifact-tab="source"]').count()).toBeGreaterThan(0)
    expect(errors).toEqual([])
    await page.locator('[data-creator-artifact-tab="source"]').click()
    const editor = page.locator('[data-creator-artifact-editor] textarea')
    await expect(editor).toHaveValue('Original fixture')
    await editor.fill('保存正文😀')
    const save = page.getByRole('button', { name: lang === 'zh' ? '保存草稿' : 'Save draft', exact: true })
    await save.click()
    await page.getByRole('complementary').getByRole('checkbox').check()
    await page.getByRole('button', { name: lang === 'zh' ? '执行操作' : 'Run action', exact: true }).click()
    await expect.poll(() => page.evaluate(() => typeof (window as any).finishFixedSave)).toBe('function')
    await editor.fill('保存期间新增编辑😀')
    await page.evaluate(() => (window as any).finishFixedSave())
    await expect.poll(() => page.evaluate(() => (window as any).fixedSaveReads)).toEqual(['1', '2'])
    await expect(editor).toHaveValue('保存期间新增编辑😀')
    await expect(save).toBeDisabled()
    await expect.poll(() => page.evaluate(() => (window as any).fixedSaveDirty)).toBe(true)
    await page.evaluate(() => (window as any).ackFixedSave())
    await expect(save).toBeEnabled()
    await expect(editor).toHaveValue('保存期间新增编辑😀')
    expect(await page.evaluate(() => (window as any).fixedSaveReads)).toEqual(['1', '2'])
    expect(errors).toEqual([])
    await page.screenshot({ path: info.outputPath('fixed-save.png'), fullPage: true })
  })
}
