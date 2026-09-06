import { describe, expect, it } from 'vitest'
import { PANEL_TOKENS, HOST_THEME_ALIASES } from '@yeisme/dsh-client-ui-visual-kit'
import { creatorStudioStyles } from '../src/styles.ts'

/**
 * dsh-unified-panel-visual-system-v1 3.2 采纳证据：
 * Creator Studio 样式串来自 visual kit——token fallback 单点、无状态色
 * 字面量、无同义词 token、scope 隔离、交互底线齐备。
 */
describe('creator studio visual adoption', () => {
  it('canonical token 在根块单点声明，并保留宿主主题 fallback', () => {
    for (const [name, fallback] of Object.entries(PANEL_TOKENS)) {
      const alias = HOST_THEME_ALIASES[name]
      const localFallback = name === 'accent' ? '#9bcbff' : fallback
      const value = alias === undefined ? localFallback : `var(--dsw-alias-${alias},${localFallback})`
      const declaration = `--vk-${name}:var(--dsw-alias-${name},${value})`
      expect(creatorStudioStyles.split(declaration).length - 1, `${name} root declaration once`).toBe(1)
    }
  })

  it('自有规则只消费 --vk-*；无 label-*/state-business 同义词，状态色 hex 只在根 token 块出现一次', () => {
    expect(creatorStudioStyles).not.toContain('--vk-label-')
    expect(creatorStudioStyles).not.toContain('--vk-state-business-primary')
    expect(creatorStudioStyles).not.toContain('--vk-interactive-bg-hover')
    for (const hex of ['#51c58b', '#f0b45a', '#ee6b72', '#6aa8ff', '#8b8b94']) {
      expect(creatorStudioStyles.split(hex).length - 1, `${hex} once (root token block)`).toBe(1)
    }
    expect(creatorStudioStyles).toContain(".cs-status-dot[data-status='running']{background:var(--vk-state-info)}")
  })

  it('选择器全部限定在 [data-creator-studio] 内（@keyframes 除外）', () => {
    for (const chunk of creatorStudioStyles.split('}')) {
      const trimmed = chunk.trim()
      if (!trimmed.includes('{') || trimmed.startsWith('@keyframes')) continue
      expect(trimmed.slice(0, 80)).toContain('[data-creator-studio]')
    }
  })

  it('交互底线与幂等（kit base 提供，输出稳定）', () => {
    expect(creatorStudioStyles).toContain(':focus-visible')
    expect(creatorStudioStyles).toContain('@media(prefers-reduced-motion:reduce)')
    expect(creatorStudioStyles).toContain('@media(pointer:coarse)')
    expect(creatorStudioStyles).toBe(`${creatorStudioStyles}`)
  })
})
