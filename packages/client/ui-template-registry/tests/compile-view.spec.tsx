import './primitives.js'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createTemplateCompileController } from '../src/compile-controller.js'
import { TemplateCompileView } from '../src/compile-view.js'
import { createFakeHost, fakeInspection } from './fake-host.js'

const REF = 'solution/demo-template/templates/main@en'

async function armedController() {
  const controller = createTemplateCompileController(createFakeHost({ inspection: fakeInspection() }))
  await controller.pinTemplate(REF)
  controller.setGoal('demo goal')
  await controller.startSession()
  controller.setField('subject', 'a castle')
  controller.setField('audience', 'children')
  await controller.submitFields()
  return controller
}

function render(controller: ReturnType<typeof createTemplateCompileController>, locale: 'zh' | 'en' | 'pseudo' = 'zh'): string {
  return renderToStaticMarkup(createElement(TemplateCompileView, { controller, locale, onOpenCatalog: () => {} }))
}

describe('guided compile pane (task 3.2 state matrix)', () => {
  it('adopts the shared workspace Surface and shows the empty state before a template is pinned', () => {
    const html = render(createTemplateCompileController(createFakeHost({ inspection: fakeInspection() })))
    expect(html).toContain('data-yeisme-surface')
    expect(html).toContain('data-surface-kind="workspace"')
    expect(html).toContain('尚未选择模板')
    expect(html).toContain('本面板不产生模型调用')
    expect(html).toContain('打开模板目录')
  })

  it('renders the contract form with zh labels, required marks and i18n descriptions', async () => {
    const controller = await armedController()
    const html = render(controller)
    expect(html).toContain('合同表单')
    expect(html).toContain('编译目标')
    expect(html).toContain('主题')
    expect(html).toContain('受众')
    expect(html).toContain('必填')
    expect(html).toContain('选填')
    expect(html).toContain('提示词的主题。')
    expect(html).toContain('for="')
  })

  it('lists missing required fields one by one before they are filled', async () => {
    const controller = createTemplateCompileController(createFakeHost({ inspection: fakeInspection() }))
    await controller.pinTemplate(REF)
    const html = render(controller)
    expect(html).toContain('待补字段')
    expect(html).toContain('主题')
    expect(html).toContain('受众')
    // Optional tone field is never listed as missing.
    expect(html).not.toContain('<li>语气</li>')
  })

  it('confirmation gate shows the decision ref and stays explicit', async () => {
    const controller = await armedController()
    const html = render(controller)
    expect(html).toContain('确认门')
    expect(html).toContain('dsh.template-registry.confirm.v1.')
    expect(html).toContain('确认本次编译选择')
    expect(html).not.toContain('已确认')
  })

  it('compile button stays disabled with a visible reason until the gate passes', async () => {
    const controller = await armedController()
    const html = render(controller)
    const compileButton = html.match(/<button[^>]*>[^<]*编译（零模型调用）[^<]*<\/button>/)
    expect(compileButton).not.toBeNull()
    expect(compileButton![0]).toContain('disabled')
    expect(html).toContain('id="tr-compile-gate-reason"')
  })

  it('result card carries exact ref, digest and the provider_calls=0 badge with a focus target', async () => {
    const controller = await armedController()
    await controller.confirm()
    await controller.compile()
    const html = render(controller)
    expect(html).toContain('编译结果')
    expect(html).toContain(REF)
    expect(html).toContain('sha256:compile-demo-1')
    expect(html).toContain('provider_calls = 0')
    // Focus owner: the result heading is the focus target for arrival.
    expect(html).toMatch(/<h3 tabindex="-1">编译结果<\/h3>/)
  })

  it('digest drift disables export with the stale strip and the re-pin path', async () => {
    const controller = await armedController()
    await controller.confirm()
    await controller.compile()
    // Drift arrives through the freshness fold; simulate by folding the guard.
    await controller.checkFreshness()
    const before = render(controller)
    expect(before).toContain('导出提示包')

    const staleHost = createFakeHost({ inspection: fakeInspection(), exportGuard: 'stale_digest' })
    const stale = createTemplateCompileController(staleHost)
    await stale.pinTemplate(REF)
    stale.setGoal('g')
    await stale.startSession()
    stale.setField('subject', 'a')
    stale.setField('audience', 'b')
    await stale.submitFields()
    await stale.confirm()
    await stale.compile()
    await stale.export('demo')
    const html = render(stale)
    expect(html).toContain('模板摘要已变化')
    expect(html).toContain('导出已禁用')
    expect(html).toContain('重新固定模板')
    const exportButton = html.match(/<button[^>]*>[^<]*导出提示包[^<]*<\/button>/)
    expect(exportButton).not.toBeNull()
    expect(exportButton![0]).toContain('disabled')
  })

  it('export receipt shows the bounded owner-relative output ref and provider_calls=0', async () => {
    const controller = await armedController()
    await controller.confirm()
    await controller.compile()
    await controller.export('demo package')
    const html = render(controller)
    expect(html).toContain('导出完成')
    expect(html).toContain('exports/demo package.md')
    expect(html).toContain('provider_calls = 0')
  })

  it('guard failures render a readable strip with the missing field list', async () => {
    const controller = createTemplateCompileController(createFakeHost({ inspection: fakeInspection(), compileGuard: 'missing_fields' }))
    await controller.pinTemplate(REF)
    controller.setGoal('g')
    await controller.startSession()
    await controller.compile()
    const html = render(controller)
    expect(html).toContain('操作被拒绝')
    expect(html).toContain('missing_fields')
    expect(html).toContain('subject')
  })

  it('english and pseudo locales render without inline Chinese fallback', async () => {
    const controller = await armedController()
    expect(render(controller, 'en')).toContain('Confirmation gate')
    expect(render(controller, 'en')).not.toContain('确认门')
    expect(render(controller, 'pseudo')).toContain('[!! Confirmation gate Confirmation gate !!]')
  })
})
