import { describe, expect, it } from 'vitest'
import { buildPanelStyles } from './panel-styles.ts'
import { TOKEN_SYNONYMS } from './tokens.ts'

const SCOPE = 'pane-domain'

function build(): string {
  return buildPanelStyles({ scope: SCOPE })
}

describe('buildPanelStyles', () => {
  it('同一 host token 的 fallback 在输出中只出现一次（根变量块单点声明）', () => {
    const css = build()
    const names = new Set([...css.matchAll(/--dsw-alias-([a-z0-9-]+)/g)].map(m => `--dsw-alias-${m[1]}`))
    for (const name of names) {
      const count = css.split(name).length - 1
      expect(count, `${name} should appear exactly once`).toBe(1)
    }
    // 同义词不得混入输出
    for (const synonym of Object.keys(TOKEN_SYNONYMS)) {
      expect(css).not.toContain(`--dsw-alias-${synonym}`)
    }
  })

  it('所有选择器都限定在 [data-<scope>] 内', () => {
    const css = build()
    const scopeAttr = `[data-${SCOPE}]`
    for (const chunk of css.split('}')) {
      const trimmed = chunk.trim()
      if (!trimmed.includes('{')) continue
      if (trimmed.startsWith('@keyframes')) {
        expect(trimmed).toContain(`vk-shimmer-${SCOPE}`)
        continue
      }
      expect(trimmed, `unscoped rule: ${trimmed.slice(0, 80)}`).toContain(scopeAttr)
    }
  })

  it('交互底线齐备：focus-visible、reduced-motion、coarse pointer 44px', () => {
    const css = build()
    expect(css).toContain(':focus-visible')
    expect(css).toContain('@media(prefers-reduced-motion:reduce)')
    expect(css).toContain('@media(pointer:coarse)')
    expect(css).toMatch(/44px/)
    expect(css).toContain('.vk-empty')
    expect(css).toContain('.vk-alert')
    expect(css).toContain('.vk-skeleton')
    expect(css).toContain('.vk-btn:disabled')
  })

  it('纯函数幂等：同参数输出逐字节相同', () => {
    expect(build()).toBe(build())
  })

  it('accent fallback 可覆盖，host 变量仍优先', () => {
    const css = buildPanelStyles({ scope: SCOPE, accentFallback: '#9bcbff' })
    expect(css).toContain('var(--dsw-alias-accent,#9bcbff)')
  })

  it('extra 原样追加且不同 scope 输出互不混淆', () => {
    const extra = `[data-${SCOPE}] .vk-extra{color:var(--vk-text-primary)}`
    const css = buildPanelStyles({ scope: SCOPE, extra })
    expect(css).toContain(extra)
    expect(buildPanelStyles({ scope: 'creator-studio' })).toContain('[data-creator-studio]')
    expect(buildPanelStyles({ scope: 'creator-studio' })).not.toContain(`[data-${SCOPE}]`)
  })
})
