// @vitest-environment jsdom
/**
 * 真实 mermaid 冒烟：不 mock，走 createMermaidRenderer 全链路
 * （懒加载 → initialize(strict) → render → 白名单净化）。
 * jsdom 缺 SVG 布局 API，按需 stub getBBox/getScreenCTM/getTotalLength。
 */
import { createMermaidRenderer } from '../../src/client/render.ts'
import { describe, expect, it, beforeAll } from 'vitest'

beforeAll(() => {
  const zero = () => ({ x: 0, y: 0, width: 10, height: 10 })
  // @ts-expect-error jsdom 缺失布局 API 的最小 stub
  SVGElement.prototype.getBBox = zero
  // @ts-expect-error jsdom 缺失
  SVGElement.prototype.getScreenCTM = () => null
  // @ts-expect-error jsdom 缺失
  SVGGraphicsElement?.prototype
  if (typeof (SVGElement.prototype as { getTotalLength?: unknown }).getTotalLength !== 'function') {
    // @ts-expect-error jsdom 缺失
    SVGElement.prototype.getTotalLength = () => 100
  }
})

describe('real mermaid smoke', () => {
  it('renders a flowchart through the full renderer pipeline', { timeout: 30_000 }, async () => {
    const renderer = createMermaidRenderer()
    const svg = await renderer.render('graph TD\n  A[需求] --> B{探查}\n  B -->|slot| C[渲染]\n  B -->|DOM| D[嫁接]\n  C --> E[图]\n  D --> E')
    expect(svg).toMatch(/^<svg/)
    expect(svg).toContain('<path')
    expect(svg.toLowerCase()).not.toContain('<script')
    expect(svg).toContain('max-width:100%')
  })

  it('renders a sequence diagram and rejects hostile input safely', { timeout: 30_000 }, async () => {
    const renderer = createMermaidRenderer()
    const svg = await renderer.render('sequenceDiagram\n  participant U as 用户\n  participant D as DSH\n  U->>D: ```mermaid``` 图\n  D-->>U: SVG')
    expect(svg).toMatch(/^<svg/)
    await expect(renderer.render('this is not a diagram at all [[[(')).rejects.toThrow()
  })
})
