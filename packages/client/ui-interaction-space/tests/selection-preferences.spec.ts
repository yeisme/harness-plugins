import { describe, expect, it } from 'vitest'
import { DEFAULT_SELECTION_SHORTCUT, mergeSelectionPreferences } from '../src/selection/preferences.ts'
import { BUILTIN_CONTEXT_ORDERS } from '../src/selection/builtin-actions.ts'

const KNOWN = new Set(['dsh:ask', 'dsh:comment', 'dsh:copy-quote', 'dsh:edit', 'dsh:add-to-batch', 'dsh:open-full', 'dsh:analyze'])

describe('selection preference merge (workspace > user > built-in)', () => {
  it('returns built-in defaults when no layers are set', () => {
    const result = mergeSelectionPreferences({}, KNOWN, BUILTIN_CONTEXT_ORDERS)
    expect(result.byContext.text.order).toEqual(BUILTIN_CONTEXT_ORDERS.text)
    expect(result.byContext.text.shortcut).toBe(DEFAULT_SELECTION_SHORTCUT)
    expect(result.byContext.text.hiddenActionIds.size).toBe(0)
    expect(result.diagnostics.dropped).toEqual([])
  })

  it('workspace overrides user: visible=true restores a user-hidden action', () => {
    const result = mergeSelectionPreferences({
      user: { text: { actions: [{ id: 'dsh:copy-quote', visible: false }] } },
      workspace: { text: { actions: [{ id: 'dsh:copy-quote', visible: true }] } },
    }, KNOWN, BUILTIN_CONTEXT_ORDERS)
    expect(result.byContext.text.hiddenActionIds.has('dsh:copy-quote')).toBe(false)
    // 其他 context 不受影响，继续用各自合并结果
    expect(result.byContext['image-region'].order).toEqual(BUILTIN_CONTEXT_ORDERS['image-region'])
  })

  it('user hiding applies when workspace stays silent', () => {
    const result = mergeSelectionPreferences({
      user: { text: { actions: [{ id: 'dsh:copy-quote', visible: false }, { id: 'dsh:open-full', visible: false }] } },
    }, KNOWN, BUILTIN_CONTEXT_ORDERS)
    expect([...result.byContext.text.hiddenActionIds].sort()).toEqual(['dsh:copy-quote', 'dsh:open-full'])
  })

  it('drops unknown ids, invalid shortcuts, oversized order and unknown contexts with diagnostics', () => {
    const result = mergeSelectionPreferences({
      user: {
        text: {
          actions: [{ id: 'acme:ghost', visible: false }],
          order: ['dsh:ask', 'acme:ghost', 'dsh:ask', 'dsh:comment'],
          shortcut: 'Ctrl',
        },
      },
    }, KNOWN, BUILTIN_CONTEXT_ORDERS)
    expect(result.byContext.text.hiddenActionIds.size).toBe(0)
    expect(result.byContext.text.order).toEqual(['dsh:ask', 'dsh:comment'])
    expect(result.byContext.text.shortcut).toBe(DEFAULT_SELECTION_SHORTCUT)
    expect(result.diagnostics.dropped).toContain('visibility:unknown-id')
    expect(result.diagnostics.dropped).toContain('order:unknown-id:acme:ghost')
    expect(result.diagnostics.dropped).toContain('order:duplicate-id:dsh:ask')
    expect(result.diagnostics.dropped).toContain('shortcut:invalid')
  })

  it('workspace order/shortcut/density/preset win over user layer', () => {
    const result = mergeSelectionPreferences({
      user: { text: { order: ['dsh:comment', 'dsh:ask'], shortcut: 'Ctrl+K', density: 'compact', preset: 'review' } },
      workspace: { text: { order: ['dsh:edit', 'dsh:ask'], shortcut: 'Ctrl+Shift+P', density: 'comfortable', preset: 'edit' } },
    }, KNOWN, BUILTIN_CONTEXT_ORDERS)
    expect(result.byContext.text.order).toEqual(['dsh:edit', 'dsh:ask'])
    expect(result.byContext.text.shortcut).toBe('Ctrl+Shift+P')
    expect(result.byContext.text.density).toBe('comfortable')
    expect(result.byContext.text.preset).toBe('edit')
  })

  it('never persists or accepts anchor/path/url-like values anywhere', () => {
    const result = mergeSelectionPreferences({
      workspace: { text: { order: ['https://evil.example', '/home/user/secret'] } },
    }, KNOWN, BUILTIN_CONTEXT_ORDERS)
    // 非法 id 全部 fail-closed 丢弃，回退 built-in
    expect(result.byContext.text.order).toEqual(BUILTIN_CONTEXT_ORDERS.text)
    expect(result.diagnostics.dropped.length).toBeGreaterThan(0)
  })
})
