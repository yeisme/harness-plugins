import './primitives.js'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createTemplateCatalogController } from '../src/catalog-controller.js'
import { TemplateCatalogView } from '../src/catalog-view.js'
import { createFakeHost, fakeInspection, fakeTemplate } from './fake-host.js'

async function renderCatalog(host: ReturnType<typeof createFakeHost>, locale: 'zh' | 'en' | 'pseudo' = 'zh'): Promise<string> {
  const controller = createTemplateCatalogController(host)
  await controller.refresh()
  return renderToStaticMarkup(createElement(TemplateCatalogView, { controller, locale }))
}

describe('template catalog pane (task 3.1 state matrix)', () => {
  it('adopts the shared navigator Surface with a single context bar', async () => {
    const html = await renderCatalog(createFakeHost())
    expect(html).toContain('data-yeisme-surface')
    expect(html).toContain('data-surface-kind="navigator"')
    expect((html.match(/class="ys-context-bar"/g) ?? []).length).toBe(1)
    expect(html).toContain('模板目录')
  })

  it('renders the results list with solution facts and roving listbox semantics', async () => {
    const html = await renderCatalog(createFakeHost({
      templates: [
        fakeTemplate(),
        fakeTemplate({ ref: 'solution/second/templates/main@en', digest: 'sha256:template-2', title: 'Second template' }),
      ],
      inspection: fakeInspection(),
    }))
    expect(html).toContain('role="listbox"')
    expect(html).toContain('role="option"')
    expect(html).toContain('Demo guided template')
    expect(html).toContain('exploratory')
    // Roving tabindex: exactly the first option is tabbable before selection.
    expect((html.match(/tabindex="0"/g) ?? []).length).toBe(1)
    expect(html).toContain('tabindex="-1"')
  })

  it('loading state shows a bounded skeleton instead of fabricated rows', async () => {
    const controller = createTemplateCatalogController(createFakeHost())
    const html = renderToStaticMarkup(createElement(TemplateCatalogView, { controller, locale: 'zh' }))
    expect(html).toContain('正在读取模板目录')
    expect(html).toContain('vk-skeleton')
    expect(html).not.toContain('role="option"')
  })

  it('offline state shows the honest error plus the retry action, never fake content', async () => {
    const html = await renderCatalog(createFakeHost({ browseFailure: { kind: 'offline' } }))
    expect(html).toContain('模板仓库暂不可用')
    expect(html).toContain('MCP 未连接')
    expect(html).toContain('重试连接')
    expect(html).not.toContain('role="option"')
  })

  it('owner errors surface the stable code without raw payloads', async () => {
    const html = await renderCatalog(createFakeHost({ browseFailure: { kind: 'registry_error', code: 'INPUT_INVALID', retryable: false } }))
    expect(html).toContain('目录读取失败')
    expect(html).toContain('INPUT_INVALID')
  })

  it('degraded catalog keeps the snapshot with a partial strip and refresh', async () => {
    const html = await renderCatalog(createFakeHost({ browseOrigin: 'catalog' }))
    expect(html).toContain('目录降级快照')
    expect(html).toContain('编译、导出与会话动作已禁用')
    expect(html).toContain('role="option"')
    expect(html).toContain('刷新')
  })

  it('empty filter result shows 无匹配模板 with the clear-filters action', async () => {
    const controller = createTemplateCatalogController(createFakeHost({ templates: [fakeTemplate()] }))
    await controller.refresh()
    controller.setFilters({ query: 'nothing-matches-this' })
    await Promise.resolve()
    await Promise.resolve()
    const html = renderToStaticMarkup(createElement(TemplateCatalogView, { controller, locale: 'zh' }))
    expect(html).toContain('无匹配模板')
    expect(html).toContain('清除过滤')
  })

  it('rights-denied preview renders a disabled button with the reason, not a dead button', async () => {
    const denied = fakeInspection({
      template: fakeTemplate({ rights: { preview: false, export: true }, permissions: ['export'] }),
    })
    const controller = createTemplateCatalogController(createFakeHost({ templates: [fakeTemplate()], inspection: denied }))
    await controller.refresh()
    await controller.select(fakeTemplate().ref)
    await Promise.resolve()
    const html = renderToStaticMarkup(createElement(TemplateCatalogView, { controller, locale: 'zh' }))
    expect(html).toContain('disabled')
    expect(html).toContain('该模板未授予预览权限')
    expect(html).toContain('role="status"')
  })

  it('english locale renders without inline Chinese fallback', async () => {
    const html = await renderCatalog(createFakeHost(), 'en')
    expect(html).toContain('Template catalog')
    expect(html).toContain('Search templates')
    expect(html).not.toContain('模板目录')
  })

  it('pseudo locale wraps English strings for overflow testing', async () => {
    const html = await renderCatalog(createFakeHost(), 'pseudo')
    expect(html).toContain('[!! Template catalog Template catalog !!]')
  })

  it('keeps every control labeled and free of unscoped inline styles', async () => {
    const html = await renderCatalog(createFakeHost({ templates: [fakeTemplate()], inspection: fakeInspection() }))
    expect(html).toContain('for="tr-catalog-search"')
    expect(html).toContain('搜索模板')
    expect(html).toContain('aria-label="类别与能力"')
    expect(html).toContain('aria-pressed')
    expect(html).not.toMatch(/style="[^"]*display:/)
  })
})
