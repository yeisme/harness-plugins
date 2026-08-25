import { describe, expect, it } from 'vitest'
import { creatorStudioStyles } from '../src/styles.ts'

/**
 * dsh-unified-panel-visual-system-v1 3.2 采纳证据：
 * Creator Studio 样式串来自 visual kit——token fallback 单点、无状态色
 * 字面量、无同义词 token、scope 隔离、交互底线齐备。
 */
describe('creator studio visual adoption', () => {
  it('每个 --dsw-alias-* token 只出现一次（kit 根块单点 fallback）', () => {
    const names = new Set([...creatorStudioStyles.matchAll(/--dsw-alias-([a-z0-9-]+)/g)].map(m => `--dsw-alias-${m[1]}`))
    expect(names.size).toBeGreaterThan(0)
    for (const name of names) {
      expect(creatorStudioStyles.split(name).length - 1, `${name} once`).toBe(1)
    }
  })

  it('自有规则只消费 --vk-*；无 label-*/state-business 同义词，状态色 hex 只在根 token 块出现一次', () => {
    expect(creatorStudioStyles).not.toContain('--dsw-alias-label-')
    expect(creatorStudioStyles).not.toContain('--dsw-alias-state-business-primary')
    expect(creatorStudioStyles).not.toContain('--dsw-alias-interactive-bg-hover')
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
