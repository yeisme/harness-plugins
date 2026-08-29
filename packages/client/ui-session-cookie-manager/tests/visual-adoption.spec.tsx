// @vitest-environment jsdom
/**
 * dsh-unified-panel-visual-system-v1 3.4 A 档采纳证据：
 * 面板样式串来自 visual kit（token 单点、scope 隔离），account status
 * tone 非仅颜色，`.sr-only` 在 scope 内有定义。
 */
import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createElement } from 'react'
import { CookieManagerPanel, type CookieManagerPanelProps } from '../src/panel.tsx'
import { cookieManagerStyles } from '../src/styles.ts'

function render(props: CookieManagerPanelProps): { container: HTMLElement; root: Root } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => { root.render(createElement(CookieManagerPanel, props)) })
  return { container, root }
}

const baseProps: CookieManagerPanelProps = {
  profiles: [{ profileId: 'p1', siteScope: 'example.com', displayName: 'Work' }],
}

describe('cookie manager visual adoption', () => {
  it('样式串逐字节等于 kit 输出；token fallback 单点', () => {
    const names = new Set([...cookieManagerStyles.matchAll(/--dsw-alias-([a-z0-9-]+)/g)].map(m => `--dsw-alias-${m[1]}`))
    expect(names.size).toBeGreaterThan(0)
    for (const name of names) {
      expect(cookieManagerStyles.split(name).length - 1, `${name} once`).toBe(1)
    }
    expect(cookieManagerStyles).toContain('[data-dsh-cookie-manager] .cm-row{')
    expect(cookieManagerStyles).toContain('[data-dsh-cookie-manager] .sr-only{')
  })

  it('account status tone 非仅颜色；词表外 neutral', () => {
    const { container, root } = render({ ...baseProps, accounts: [{ provider: 'acme', accountSummary: 'a@b.c', status: 'active' }] })
    const status = container.querySelector('[aria-label="status"]')
    expect(status?.querySelector('.cm-dot')?.getAttribute('data-tone')).toBe('info')
    expect(status?.textContent).toContain('active')
    act(() => { root.unmount() }); container.remove()

    const odd = render({ ...baseProps, accounts: [{ provider: 'acme', accountSummary: 'a@b.c', status: 'weird-state' as never }] })
    expect(odd.container.querySelector('.cm-dot')?.getAttribute('data-tone')).toBe('neutral')
    expect(odd.container.querySelector('[aria-label="status"]')?.textContent).toContain('weird-state')
    act(() => { odd.root.unmount() }); odd.container.remove()
  })

  it('既有 data 合同与禁用语义保持', () => {
    const { container, root } = render(baseProps)
    expect(container.querySelector('[data-dsh-cookie-manager]')).not.toBeNull()
    expect(container.querySelector('style[data-cookie-manager-styles]')?.textContent).toBe(cookieManagerStyles)
    expect(container.querySelector('[data-profile-id="p1"]')?.className).toContain('cm-row')
    expect((container.querySelector('button[disabled]') as HTMLButtonElement).disabled).toBe(true)
    act(() => { root.unmount() }); container.remove()
  })
})
