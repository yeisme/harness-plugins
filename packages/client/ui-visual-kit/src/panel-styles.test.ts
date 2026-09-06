import { describe, expect, it } from 'vitest'
import { buildPanelStyles } from './panel-styles.ts'
import { HOST_THEME_ALIASES, PANEL_TOKENS } from './tokens.ts'

const SCOPE = 'pane-domain'

function build(): string {
  return buildPanelStyles({ scope: SCOPE })
}

describe('buildPanelStyles', () => {
  it('publishes the documented spacing and touch scale without replacing the host font family', () => {
    const css = build()
    expect(css).toContain('--vk-ctrl-touch:44px')
    expect(css).toContain('--vk-gap-xs:4px')
    expect(css).toContain('--vk-gap-xl:14px')
    expect(css).toContain('font-family:inherit;font-size:var(--vk-font-body)')
    expect(css).not.toContain('system-ui')
  })
  it('同一 host token 的 fallback 在输出中只出现一次（根变量块单点声明）', () => {
    const css = build()
    for (const canonical of Object.keys(PANEL_TOKENS)) {
      const name = `--dsw-alias-${canonical}`
      const count = [...css.matchAll(new RegExp(`${name}(?=[,)])`, 'g'))].length
      expect(count, `${name} should appear exactly once`).toBe(1)
    }
    // Host aliases are only consumed as nested fallbacks, never as root vars.
    for (const alias of Object.values(HOST_THEME_ALIASES)) {
      if (alias === undefined) continue
      expect(css).toContain(`--dsw-alias-${alias}`)
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

  it('空状态使用与 SurfaceState 一致的紧凑容器', () => {
    const css = build()
    expect(css).toContain('.vk-empty{display:grid;place-items:center;align-content:center')
    expect(css).toContain('min-height:92px;padding:16px')
    expect(css).toContain('border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md)')
  })

  it('纯函数幂等：同参数输出逐字节相同', () => {
    expect(build()).toBe(build())
  })

  it('accent fallback preserves canonical and official host precedence', () => {
    const css = buildPanelStyles({ scope: SCOPE, accentFallback: '#9bcbff' })
    expect(css).toContain('var(--dsw-alias-accent,var(--dsw-alias-state-business-primary,#9bcbff))')
  })

  it('extra 原样追加且不同 scope 输出互不混淆', () => {
    const extra = `[data-${SCOPE}] .vk-extra{color:var(--vk-text-primary)}`
    const css = buildPanelStyles({ scope: SCOPE, extra })
    expect(css).toContain(extra)
    expect(buildPanelStyles({ scope: 'creator-studio' })).toContain('[data-creator-studio]')
    expect(buildPanelStyles({ scope: 'creator-studio' })).not.toContain(`[data-${SCOPE}]`)
  })
})
