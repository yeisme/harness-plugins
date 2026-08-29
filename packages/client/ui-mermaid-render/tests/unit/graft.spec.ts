// @vitest-environment jsdom
import { hydrateMermaidFences, MermaidGraftController } from '../../src/client/observer.ts'
import { labelsFor } from '../../src/client/locales.ts'
import type { MermaidRenderer } from '../../src/client/render.ts'
import { afterEach, describe, expect, it, vi } from 'vitest'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function stubRenderer(svg = '<svg><path d="M0 0"/></svg>'): MermaidRenderer {
  return {
    render: vi.fn(async () => svg),
    setTheme: vi.fn(),
    dispose: vi.fn(),
  }
}

function addFence(text: string): { pre: HTMLElement; code: HTMLElement } {
  const pre = document.createElement('pre')
  const code = document.createElement('code')
  code.className = 'language-mermaid'
  code.textContent = text
  pre.append(code)
  document.body.append(pre)
  return { pre, code }
}

function makeController(renderer: MermaidRenderer, stableMs = 20): MermaidGraftController {
  return new MermaidGraftController({ labels: labelsFor('zh'), renderer, stableMs })
}

afterEach(() => {
  document.body.innerHTML = ''
  document.head.querySelectorAll('style').forEach((s) => s.remove())
})

describe('MermaidGraftController', () => {
  it('grafts a stable fence and hides the source pre', async () => {
    const renderer = stubRenderer()
    const controller = makeController(renderer)
    controller.start(document.documentElement)
    const { pre } = addFence('graph TD\nA-->B')
    await sleep(60)
    const figure = document.querySelector('figure[data-dsh-mermaid-figure]')
    expect(figure).not.toBeNull()
    expect(figure?.querySelector('.dsh-mermaid-stage svg')).not.toBeNull()
    expect(pre.style.display).toBe('none')
    controller.stop()
  })

  it('never grafts while the fence text keeps changing (streaming)', async () => {
    const renderer = stubRenderer()
    const controller = makeController(renderer, 40)
    controller.start(document.documentElement)
    const { code } = addFence('graph TD')
    for (let i = 0; i < 6; i += 1) {
      code.textContent = `graph TD\nA-->B${i}`
      await sleep(20)
    }
    expect(renderer.render).not.toHaveBeenCalled()
    controller.stop()
  })

  it('reveals and hides the source via the toggle button', async () => {
    const controller = makeController(stubRenderer())
    controller.start(document.documentElement)
    const { pre } = addFence('A-->B')
    await sleep(60)
    const figure = document.querySelector('figure[data-dsh-mermaid-figure]')
    const btn = figure?.querySelector<HTMLButtonElement>('button')
    expect(btn?.textContent).toContain('查看源码')
    btn?.click()
    await sleep(0)
    expect(pre.style.display).toBe('')
    expect(btn?.textContent).toContain('收起源码')
    btn?.click()
    await sleep(0)
    expect(pre.style.display).toBe('none')
    controller.stop()
  })

  it('degrades to the visible source block on render failure', async () => {
    const renderer: MermaidRenderer = {
      render: vi.fn(async () => { throw new Error('parse boom') }),
      setTheme: vi.fn(),
      dispose: vi.fn(),
    }
    const controller = makeController(renderer)
    controller.start(document.documentElement)
    const { pre, code } = addFence('not valid mermaid')
    await sleep(60)
    const figure = document.querySelector('figure[data-dsh-mermaid-figure]')
    expect(figure?.classList.contains('is-failed')).toBe(true)
    expect(figure?.textContent).toContain('mermaid 渲染失败')
    expect(pre.style.display).toBe('')
    expect(code.textContent).toBe('not valid mermaid')
    controller.stop()
  })

  it('stop() fully restores the DOM', async () => {
    const controller = makeController(stubRenderer())
    controller.start(document.documentElement)
    const { pre, code } = addFence('A-->B')
    await sleep(60)
    const before = document.body.innerHTML
    expect(before).toContain('figure')
    controller.stop()
    expect(document.querySelector('figure[data-dsh-mermaid-figure]')).toBeNull()
    expect(code.classList.contains('dsh-mermaid-on')).toBe(false)
    expect(pre.style.display).toBe('')
    expect(code.isConnected).toBe(true)
    expect(document.head.querySelector('style')).toBeNull()
  })

  it('self-heals after a simulated React remount of the fence', async () => {
    const renderer = stubRenderer()
    const controller = makeController(renderer)
    controller.start(document.documentElement)
    const { pre, code } = addFence('A-->B')
    await sleep(60)
    expect(document.querySelectorAll('figure[data-dsh-mermaid-figure]')).toHaveLength(1)
    // 模拟 React 重挂载：同结构新节点替换旧节点。
    const fresh = pre.cloneNode(true) as HTMLElement
    pre.replaceWith(fresh)
    await sleep(80)
    const figures = document.querySelectorAll('figure[data-dsh-mermaid-figure]')
    expect(figures).toHaveLength(1)
    expect(renderer.render).toHaveBeenCalledTimes(2)
    expect(fresh.querySelector('code')?.isConnected).toBe(true)
    expect(code.isConnected).toBe(false)
    controller.stop()
  })

  it('grafts the settled md-code-block card shape and hides the whole card', async () => {
    const renderer = stubRenderer()
    const controller = makeController(renderer)
    controller.start(document.documentElement)
    const card = document.createElement('div')
    card.className = 'md-code-block'
    const head = document.createElement('div')
    const row = document.createElement('div')
    const langCell = document.createElement('div')
    langCell.textContent = 'mermaid'
    const btnCell = document.createElement('div')
    const btn = document.createElement('button')
    btn.textContent = '复制'
    btnCell.append(btn)
    row.append(langCell, btnCell)
    head.append(row)
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    code.textContent = 'sequenceDiagram\nA->>B: hi'
    pre.append(code)
    card.append(head, pre)
    document.body.append(card)
    await sleep(60)
    const figure = document.querySelector('figure[data-dsh-mermaid-figure]')
    expect(figure).not.toBeNull()
    expect(card.style.display).toBe('none')
    expect(figure?.previousElementSibling).toBe(card)
    expect(figure?.querySelector('.dsh-mermaid-stage svg')).not.toBeNull()
    controller.stop()
    expect(card.style.display).toBe('')
  })

  it('hydrateMermaidFences grafts a settled root without a document observer', async () => {
    const renderer = stubRenderer()
    const root = document.createElement('div')
    document.body.append(root)
    const { pre } = (() => {
      const preEl = document.createElement('pre')
      const code = document.createElement('code')
      code.className = 'language-mermaid'
      code.textContent = 'graph TD\nA-->B'
      preEl.append(code)
      root.append(preEl)
      return { pre: preEl }
    })()
    const stop = hydrateMermaidFences(root, { labels: labelsFor('zh'), renderer, stableMs: 0 })
    await sleep(20)
    expect(root.querySelector('figure[data-dsh-mermaid-figure]')).not.toBeNull()
    expect(pre.style.display).toBe('none')
    stop()
    expect(root.querySelector('figure[data-dsh-mermaid-figure]')).toBeNull()
  })

  it('ignores oversized sources and non-mermaid fences', async () => {
    const renderer = stubRenderer()
    const controller = makeController(renderer)
    controller.start(document.documentElement)
    addFence('x'.repeat(70_000))
    const plain = document.createElement('pre')
    const plainCode = document.createElement('code')
    plainCode.className = 'language-ts'
    plainCode.textContent = 'const a = 1'
    plain.append(plainCode)
    document.body.append(plain)
    await sleep(60)
    expect(renderer.render).not.toHaveBeenCalled()
    controller.stop()
  })
})
