import { describe, expect, it } from 'vitest'
import { REGION_STYLES } from '../src/region-chrome.js'

/**
 * dsh-unified-panel-visual-system-v1 3.3 采纳证据：
 * chrome 样式的 token fallback 只来自 visual kit registry，且只在
 * `.pwr-root` 单点声明；规则只消费 `--vk-*`，单文件多 fallback 清零。
 */
describe('pane workbench chrome token adoption', () => {
  it('每个 --dsw-alias-* token 只出现一次（.pwr-root 单点声明）', () => {
    const names = new Set([...REGION_STYLES.matchAll(/--dsw-alias-([a-z0-9-]+)/g)].map(m => `--dsw-alias-${m[1]}`))
    expect(names.size).toBeGreaterThan(0)
    for (const name of names) {
      expect(REGION_STYLES.split(name).length - 1, `${name} once`).toBe(1)
    }
  })

  it('root 声明链到 registry canonical fallback', () => {
    expect(REGION_STYLES).toContain('--vk-bg-elevated:var(--dsw-alias-bg-elevated,#2a2a2f)')
    expect(REGION_STYLES).toContain('--vk-text-secondary:var(--dsw-alias-text-secondary,#c6c6cb)')
    expect(REGION_STYLES).toContain('--vk-border-focus:var(--dsw-alias-border-focus,#79b8ff)')
  })

  it('旧分歧 fallback 字面量清零；规则消费 --vk-*', () => {
    for (const stale of ['#202024', '#222226', '#242429', '#b8b8c0', '#aaaab2']) {
      expect(REGION_STYLES).not.toContain(stale)
    }
    // host 变量优先语义仍在：sidebar 专用 host 变量保持直读
    expect(REGION_STYLES).toContain('var(--dsw-specific-sidebar-fill,#1c1c1f)')
    expect(REGION_STYLES.match(/var\(--vk-[a-z0-9-]+\)/g)?.length ?? 0).toBeGreaterThanOrEqual(30)
  })

  it('CSS 括号配平（含 color-mix/calc 合法嵌套）', () => {
    // 旧启发式按 `var(--vk-x))` 字面计数，把 color-mix() 内合法的嵌套 var() 误报为残留。
    // 残留双右括号的真实特征是不成对的 ')'，改用括号深度扫描配平。
    let depth = 0
    for (const char of REGION_STYLES) {
      if (char === '(') depth += 1
      if (char === ')') depth -= 1
      expect(depth, 'REGION_STYLES 出现不成对的 )').toBeGreaterThanOrEqual(0)
    }
    expect(depth).toBe(0)
    const open = (REGION_STYLES.match(/\{/g) ?? []).length
    const close = (REGION_STYLES.match(/\}/g) ?? []).length
    expect(open).toBe(close)
  })
})

describe('responsive + a11y token layer (V3 2.8)', () => {
  const styles = REGION_STYLES
  it('coarse pointers get 44px hit targets and a wider rail', () => {
    const coarse = styles.slice(styles.indexOf('@media(pointer:coarse)'))
    expect(coarse).toContain('min-width:44px')
    expect(coarse).toContain('min-height:44px')
    expect(coarse).toContain('width:52px')
  })
  it('390px keeps controls at 28px-class and menus inside the viewport', () => {
    const narrow = styles.slice(styles.indexOf('@media(max-width:390px)'))
    expect(narrow).toContain('--pwr-control-size:28px')
    expect(narrow).toContain('max-width:min(92vw,280px)')
  })
  it('high-contrast strengthens borders and outlines active/critical states non-color-only', () => {
    const contrast = styles.slice(styles.indexOf('@media(prefers-contrast:more)'))
    expect(contrast).toContain('rgba(255,255,255,.7)')
    expect(contrast).toContain("data-status='active'")
    expect(contrast).toContain("data-status='critical'")
  })
  it('reduced motion disables all transitions and animations globally', () => {
    const motion = styles.slice(styles.indexOf('@media(prefers-reduced-motion:reduce)'))
    expect(motion).toContain('transition:none')
    expect(motion).toContain('animation:none')
  })
  it('no horizontal overflow: root and layout rows stay overflow-hidden with min-width:0', () => {
    expect(styles).toMatch(/\.pwr-root\{[^}]*overflow:hidden/)
    expect(styles).toMatch(/\.pwr-tree\{[^}]*min-width:0/)
  })
})
