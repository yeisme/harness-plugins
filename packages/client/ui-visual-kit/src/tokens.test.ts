import { describe, expect, it } from 'vitest'
import { PANEL_TOKENS, TOKEN_SYNONYMS, panelVar, type PanelTokenName } from './tokens.ts'

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

  it('host 变量优先：引用是 var(--dsw-alias-…, fallback) 形式', () => {
    expect(panelVar('bg-base')).toBe(`var(--dsw-alias-bg-base,${PANEL_TOKENS['bg-base']})`)
  })
})
