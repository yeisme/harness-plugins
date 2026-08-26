// @vitest-environment jsdom
/**
 * dsh-unified-panel-visual-system-v1 3.4 B 档守卫：
 * chips/dock 是嵌入宿主对话流的微表面，设计上用 currentColor/opacity 继承
 * 宿主主题（零 token 分歧）。本测试钉住该合同：不得出现硬编码颜色字面量。
 */
import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createElement } from 'react'
import { SuggestionChip } from '../../src/client/SuggestionChip.tsx'

const t = ((key: string) => key) as unknown as (key: string, vars?: Record<string, unknown>) => string

function renderChip(props: Partial<Parameters<typeof SuggestionChip>[0]> = {}): { container: HTMLElement; root: Root } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(createElement(SuggestionChip, {
      suggestion: { id: 's1', label: 'Run tests', source: 'plan', prompt: 'run tests', parallelSafe: true } as never,
      selected: false,
      disabled: false,
      multiSelect: false,
      onActivate: () => {},
      t: t as never,
      ...props,
    }))
  })
  return { container, root }
}

describe('suggestion visual divergence guard', () => {
  it('chip 源码零硬编码颜色且以 currentColor 继承宿主主题', async () => {
    const source = await readFile(join(import.meta.dirname, '../../src/client/SuggestionChip.tsx'), 'utf8')
    // jsdom/React 会把 currentColor 从序列化输出里吞掉，currentColor 合同在源码层钉住
    expect(source).toContain('currentColor')
    expect(source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([])
    expect(source.match(/rgba?\(/g) ?? []).toEqual([])
  })

  it('渲染输出零硬编码颜色', () => {
    const { container, root } = renderChip({ selected: true })
    for (const el of container.querySelectorAll<HTMLElement>('[style]')) {
      expect(el.style.cssText).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(el.style.cssText).not.toMatch(/rgba?\(/)
    }
    const button = container.querySelector('button') as HTMLButtonElement
    expect(button.style.borderWidth).toBe('1px')
    act(() => { root.unmount() }); container.remove()
  })

  it('选中/禁用态仍不引入颜色字面量', () => {
    const disabled = renderChip({ selected: false, disabled: true, multiSelect: true })
    const button = disabled.container.querySelector('button') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-pressed')).toBe('false')
    for (const el of disabled.container.querySelectorAll<HTMLElement>('[style]')) {
      expect(el.style.cssText).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
    act(() => { disabled.root.unmount() }); disabled.container.remove()
  })
})
