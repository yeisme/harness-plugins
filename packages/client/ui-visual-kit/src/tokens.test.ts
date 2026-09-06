import { describe, expect, it } from 'vitest'
import { HOST_THEME_ALIASES, PANEL_TOKENS, TOKEN_SYNONYMS, panelVar, type PanelTokenName } from './tokens.ts'

describe('token registry', () => {
  it('每个 canonical token 只有唯一 fallback 且格式合法', () => {
    for (const [name, value] of Object.entries(PANEL_TOKENS)) {
      expect(value.length, name).toBeGreaterThan(0)
      expect(value.startsWith('#') || value.startsWith('rgba('), name).toBe(true)
    }
  })

  it('同义词解析到与 canonical 相同的 host 变量引用', () => {
    for (const [synonym, canonical] of Object.entries(TOKEN_SYNONYMS)) {
      expect(panelVar(synonym)).toBe(panelVar(canonical))
      // 同义词不得引入第二个 fallback 字面量：引用串与 canonical 完全一致
      expect(panelVar(synonym)).toContain(`--dsw-alias-${canonical},`)
    }
  })

  it('未知 token 抛错而不是静默兜底', () => {
    expect(() => panelVar('not-a-token' as PanelTokenName)).toThrow(/unknown panel token/)
  })

  it('canonical override keeps priority over the official host alias and fallback', () => {
    expect(panelVar('text-primary')).toBe(`var(--dsw-alias-text-primary,var(--dsw-alias-label-primary,${PANEL_TOKENS['text-primary']}))`)
    expect(panelVar('bg-elevated')).toBe(`var(--dsw-alias-bg-elevated,var(--dsw-alias-bg-overlay,${PANEL_TOKENS['bg-elevated']}))`)
    expect(panelVar('border-focus')).toBe(`var(--dsw-alias-border-focus,var(--dsw-alias-state-business-primary,${PANEL_TOKENS['border-focus']}))`)
    expect(panelVar('text-link')).toBe(`var(--dsw-alias-text-link,var(--dsw-alias-state-business-primary,${PANEL_TOKENS['text-link']}))`)
  })

  it('keeps exact-match host aliases single-layered', () => {
    expect(panelVar('bg-base')).toBe(`var(--dsw-alias-bg-base,${PANEL_TOKENS['bg-base']})`)
  })

  it('documents only known official aliases', () => {
    expect(HOST_THEME_ALIASES['fill-selected']).toBe('interactive-bg-hover-accent')
    expect(HOST_THEME_ALIASES['state-positive']).toBe('state-success-primary')
  })
})
