// @vitest-environment jsdom
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  SELECTION_DESIGNER_BUILTIN_IDS,
  SELECTION_DESIGNER_CONTEXTS,
  SelectionInteractionDesignerSection,
  type SelectionDesignerPreferences,
} from '../src/selection-interaction-designer.js'

afterEach(cleanup)

describe('Workspace Designer · Selection & Interaction section (5.3)', () => {
  it('renders five context tabs and per-context visibility/order/shortcut/density/preset controls', () => {
    mountSection()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(tab => tab.getAttribute('data-selection-context-tab') ?? tab.textContent)).toHaveLength(5)
    for (const kind of SELECTION_DESIGNER_CONTEXTS) {
      expect(document.querySelector(`[data-selection-context-tab="${kind}"]`)).not.toBeNull()
    }
    expect(document.querySelectorAll('[data-selection-pref="visibility"] [data-selection-action]').length).toBe(SELECTION_DESIGNER_BUILTIN_IDS.length)
    expect(document.querySelector('[data-selection-pref="order"]')).not.toBeNull()
    expect(document.querySelector('[data-selection-pref="shortcut"] input')).not.toBeNull()
    expect(document.querySelector('[data-selection-pref="density"] select')).not.toBeNull()
    expect(document.querySelector('[data-selection-pref="preset"] select')).not.toBeNull()
  })

  it('records bounded canonical-id preferences on interaction (visibility/order/preset)', () => {
    const onChange = vi.fn()
    const preferences: SelectionDesignerPreferences = {}
    mountSection({ preferences, onChange })
    // 隐藏 copy-quote
    // 直接点击让 DOM 自然翻转 checked（不预置 target，避免二次翻转）。
    fireEvent.click(document.querySelector('[data-selection-action="dsh:copy-quote"] input') as HTMLInputElement)
    expect(onChange).toHaveBeenCalled()
    const first = onChange.mock.calls[0]![0] as SelectionDesignerPreferences
    expect(first.text?.actions?.find(action => action.id === 'dsh:copy-quote')?.visible).toBe(false)
    // 只包含 canonical id 与布尔值
    const ids = (first.text?.actions ?? []).map(action => action.id)
    expect(ids.every(id => id.startsWith('dsh:'))).toBe(true)
    // preset 切换
    fireEvent.change(document.querySelector('[data-selection-pref="preset"] select') as HTMLSelectElement, { target: { value: 'review' } })
    const second = onChange.mock.calls.at(-1)![0] as SelectionDesignerPreferences
    expect(second.text?.preset).toBe('review')
  })

  it('reorders via move-up and keeps order canonical-only', () => {
    const onChange = vi.fn()
    const preferences: SelectionDesignerPreferences = {}
    mountSection({ preferences, onChange })
    const order = document.querySelector('[data-selection-order]') as HTMLOListElement
    expect(order.getAttribute('data-selection-order')).toBe(SELECTION_DESIGNER_BUILTIN_IDS.join(','))
    const up = order.querySelectorAll('button[aria-label^="move up"]')
    fireEvent.click(up[2] as HTMLButtonElement)
    const next = onChange.mock.calls[0]![0] as SelectionDesignerPreferences
    expect(next.text?.order?.[1]).toBe('dsh:copy-quote')
    expect(next.text?.order?.[2]).toBe('dsh:comment')
  })

  it('rejects malformed shortcuts (no invalid value enters preferences)', () => {
    const onChange = vi.fn()
    const preferences: SelectionDesignerPreferences = {}
    mountSection({ preferences, onChange })
    const input = document.querySelector('[data-selection-pref="shortcut"] input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'not-a-shortcut' } })
    fireEvent.blur(input)
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'Ctrl+K' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect((onChange.mock.calls[0]![0] as SelectionDesignerPreferences).text?.shortcut).toBe('Ctrl+K')
  })
})

function mountSection(overrides: { preferences?: SelectionDesignerPreferences; onChange?: ReturnType<typeof vi.fn> } = {}): ReturnType<typeof render> {
  return render(createElement(SelectionInteractionDesignerSection, {
    preferences: overrides.preferences ?? {},
    onChange: overrides.onChange ?? (() => {}),
  }))
}
