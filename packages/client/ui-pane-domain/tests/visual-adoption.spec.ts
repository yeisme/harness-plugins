// @vitest-environment jsdom
/**
 * dsh-unified-panel-visual-system-v1 3.1 采纳证据：
 * domain pane 样式串必须来自 visual kit（token 单点 fallback、scope 隔离），
 * 状态非仅颜色、empty/disabled/focus 底线齐备、既有投影属性不回退。
 */
import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createElement } from 'react'
import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'
import { DomainPaneView } from '../src/view.ts'
import type { DomainSnapshotV1 } from '../src/snapshot.ts'

function render(snapshot: DomainSnapshotV1): { container: HTMLElement; root: Root } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => { root.render(createElement(DomainPaneView, { snapshot })) })
  return { container, root }
}

function baseSnapshot(overrides: Partial<DomainSnapshotV1> = {}): DomainSnapshotV1 {
  return {
    owner: 'eikona',
    status: 'ready',
    freshness: 'fresh',
    items: [],
    allowedActions: [],
    ...overrides,
  }
}

describe('domain pane visual adoption', () => {
  it('注入样式串逐字节等于 buildPanelStyles({scope:"pane-domain"})，token fallback 单点', () => {
    const { container, root } = render(baseSnapshot())
    const style = container.querySelector('style')?.textContent ?? ''
    expect(style).toBe(buildPanelStyles({ scope: 'pane-domain' }))
    expect(style.split('--dsw-alias-bg-base').length - 1).toBe(1)
    expect(style).toContain('[data-pane-domain] .vk-header')
    expect(style).not.toContain('[data-creator-studio]')
    act(() => { root.unmount() }); container.remove()
  })

  it('状态 tone 有文本伴随（非仅颜色），词表内外都诚实', () => {
    const { container, root } = render(baseSnapshot({ status: 'running' }))
    const dot = container.querySelector('.vk-dot')
    expect(dot?.getAttribute('data-tone')).toBe('info')
    const statusText = container.querySelector('[role="status"]')?.textContent ?? ''
    expect(statusText).toContain('running')
    act(() => { root.unmount() }); container.remove()

    const unknown = render(baseSnapshot({ status: 'brand-new-state' }))
    expect(unknown.container.querySelector('.vk-dot')?.getAttribute('data-tone')).toBe('neutral')
    expect(unknown.container.querySelector('[role="status"]')?.textContent).toContain('brand-new-state')
    act(() => { unknown.root.unmount() }); unknown.container.remove()
  })

  it('empty 状态有解释文案，不出现空白区域或伪重试', () => {
    const { container, root } = render(baseSnapshot())
    expect(container.querySelector('.vk-empty')).not.toBeNull()
    expect(container.textContent).toContain('No owner projection.')
    expect(container.querySelectorAll('button')).toHaveLength(0)
    act(() => { root.unmount() }); container.remove()
  })

  it('reconcile 原因以 alert 呈现；禁用动作带原因', () => {
    const { container, root } = render(baseSnapshot({
      status: 'reconcile_required',
      reconcileReason: 'owner_unreachable',
      items: [{ ref: 'artifact:eikona:hero-a', title: 'Hero pose A', version: '4', kind: 'card', status: 'accepted' }],
      allowedActions: [{ id: 'generate.preview', gated: true }],
    }))
    expect(container.querySelector('[data-reconcile-reason]')?.getAttribute('class')).toContain('vk-alert')
    const action = container.querySelector('[aria-label="generate.preview"]') as HTMLButtonElement
    expect(action.disabled).toBe(true)
    expect(action.title.length).toBeGreaterThan(0)
    act(() => { root.unmount() }); container.remove()
  })

  it('item 投影属性保持，kind 以徽标呈现，状态不作为文本泄漏', () => {
    const { container, root } = render(baseSnapshot({
      items: [{ ref: 'artifact:eikona:hero-a', title: 'Hero pose A', version: '4', kind: 'card', status: 'complete', summary: 'accepted hero pose', partial: true }],
    }))
    const row = container.querySelector('[data-item-ref="artifact:eikona:hero-a"]')
    expect(row?.getAttribute('data-item-kind')).toBe('card')
    expect(row?.getAttribute('data-item-status')).toBe('complete')
    expect(row?.getAttribute('data-partial')).toBe('true')
    expect(row?.querySelector('.vk-badge')?.textContent).toBe('card')
    // item.status 只留在属性里，不作为文本渲染（partial 标记保留）
    expect(row?.textContent).toContain('Hero pose A')
    expect(row?.textContent).toContain('partial')
    expect(row?.textContent).not.toContain('complete')
    act(() => { root.unmount() }); container.remove()
  })
})
