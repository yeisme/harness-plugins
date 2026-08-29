// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarkdownTableEnhancer } from './table-enhancer.ts'

afterEach(() => {
  document.body.innerHTML = ''
  document.head.querySelectorAll('style').forEach(node => { node.remove() })
})

describe('MarkdownTableEnhancer', () => {
  it('decorates semantic tables and restores the host DOM', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    document.body.innerHTML = '<main data-conversation-scroll><div class="table-scroll"><table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table></div></main>'
    const enhancer = new MarkdownTableEnhancer()
    enhancer.start(document.documentElement)
    const wrapper = document.querySelector<HTMLElement>('.table-scroll')!
    expect(wrapper.hasAttribute('data-dsh-structured-markdown-table')).toBe(true)
    expect(wrapper.getAttribute('role')).toBe('region')
    ;(wrapper.querySelector('button') as HTMLButtonElement).click()
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledWith('A\tB\n1\t2')
    enhancer.stop()
    expect(wrapper.hasAttribute('data-dsh-structured-markdown-table')).toBe(false)
    expect(wrapper.querySelector('.sc-toolbar')).toBeNull()
  })

  it('does not decorate the owned CSV/TSV renderer', () => {
    document.body.innerHTML = '<div data-dsh-preview-table><div><table><tr><td>x</td></tr></table></div></div>'
    const enhancer = new MarkdownTableEnhancer()
    enhancer.start(document.documentElement)
    expect(document.querySelector('[data-dsh-structured-markdown-table]')).toBeNull()
    enhancer.stop()
  })

  it('ignores unrelated application tables outside Markdown surfaces', () => {
    document.body.innerHTML = '<div><table><tr><td>x</td></tr></table></div>'
    const enhancer = new MarkdownTableEnhancer()
    enhancer.start(document.documentElement)
    expect(document.querySelector('[data-dsh-structured-markdown-table]')).toBeNull()
    enhancer.stop()
  })
})
