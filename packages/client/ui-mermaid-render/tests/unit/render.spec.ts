// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'

const renderMock = vi.fn()
vi.mock('mermaid', () => ({
  default: { initialize: vi.fn(), render: renderMock },
}))

import { createMermaidRenderer } from '../../src/client/render.ts'

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>'

describe('createMermaidRenderer', () => {
  beforeEach(() => {
    renderMock.mockReset()
    renderMock.mockResolvedValue({ svg: SVG })
  })

  it('lazily initializes mermaid only on first render', async () => {
    const renderer = createMermaidRenderer()
    expect(renderMock).not.toHaveBeenCalled()
    await expect(renderer.render('graph TD')).resolves.toContain('<path')
    expect(renderMock).toHaveBeenCalledTimes(1)
  })

  it('caches by source and dedupes concurrent renders', async () => {
    const renderer = createMermaidRenderer()
    const [a, b] = await Promise.all([renderer.render('A-->B'), renderer.render('A-->B')])
    expect(a).toBe(b)
    expect(renderMock).toHaveBeenCalledTimes(1)
    await renderer.render('A-->B')
    expect(renderMock).toHaveBeenCalledTimes(1)
  })

  it('clears cache on theme change', async () => {
    const renderer = createMermaidRenderer()
    await renderer.render('A-->B')
    renderer.setTheme('dark')
    await renderer.render('A-->B')
    expect(renderMock).toHaveBeenCalledTimes(2)
  })

  it('sanitize drops svg-hostile payload', async () => {
    renderMock.mockResolvedValue({ svg: '<svg><script>x</script><path d="M1 1"/></svg>' })
    const renderer = createMermaidRenderer()
    await expect(renderer.render('evil')).resolves.not.toContain('script')
  })
})
