// @vitest-environment jsdom
/**
 * dsh-unified-panel-visual-system-v1 3.4 B 档守卫：
 * RetryButton / EditInlineEditor 内嵌于宿主 assistant 动作条，设计上不携带
 * 颜色（继承宿主主题）。本测试钉住：渲染输出零硬编码颜色字面量。
 */
import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createElement } from 'react'
import { RetryButton } from '../../src/client/retry.tsx'

function renderRetry(props: Partial<Parameters<typeof RetryButton>[0]> = {}): { container: HTMLElement; root: Root } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(createElement(RetryButton, {
      disabled: false,
      loading: false,
      error: null,
      label: 'Retry',
      loadingLabel: 'Retrying…',
      onRetry: () => {},
      ...props,
    }))
  })
  return { container, root }
}

describe('conversation rewrite visual divergence guard', () => {
  it('重试动作条零硬编码颜色', () => {
    const { container, root } = renderRetry({ error: 'boom', disabled: true, disabledReason: 'not available' })
    for (const el of container.querySelectorAll<HTMLElement>('[style]')) {
      expect(el.style.cssText).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(el.style.cssText).not.toMatch(/rgba?\(/)
    }
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('boom')
    expect(container.querySelector('[role="note"]')?.textContent).toBe('not available')
    act(() => { root.unmount() }); container.remove()
  })

  it('loading 语义保持（aria-busy + role=status）', () => {
    const { container, root } = renderRetry({ loading: true })
    expect((container.querySelector('button') as HTMLButtonElement).getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector('[role="status"]')).not.toBeNull()
    act(() => { root.unmount() }); container.remove()
  })
})
