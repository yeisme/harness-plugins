import { describe, expect, it } from 'vitest'
import { sessionTagsOverlayStyles } from '../src/client/styles.ts'

/**
 * dsh-unified-panel-visual-system-v1 3.4 A 档采纳证据：
 * overlay 样式串来自 visual kit（token fallback 单点、scope 隔离），
 * 历史"类名定义在无处"的裸面获得统一 chrome，交互底线齐备。
 */
describe('session tags overlay visual adoption', () => {
  it('每个 --dsw-alias-* token 只出现一次（kit 根块单点声明）', () => {
    const names = new Set([...sessionTagsOverlayStyles.matchAll(/--dsw-alias-([a-z0-9-]+)/g)].map(m => `--dsw-alias-${m[1]}`))
    expect(names.size).toBeGreaterThan(0)
    for (const name of names) {
      expect(sessionTagsOverlayStyles.split(name).length - 1, `${name} once`).toBe(1)
    }
  })

  it('既有 session-tags-* 类全部获得样式且限定 scope', () => {
    for (const cls of ['session-tags-overlay-backdrop', 'session-tags-editor', 'session-tags-draft', 'session-tags-chip', 'session-tags-entry', 'session-tags-suggestions', 'session-tags-feedback', 'session-tags-conflict', 'session-tags-error', 'session-tags-actions']) {
      expect(sessionTagsOverlayStyles).toContain(`[data-session-tags] .${cls}{`)
    }
    for (const chunk of sessionTagsOverlayStyles.split('}')) {
      const trimmed = chunk.trim()
      if (!trimmed.includes('{') || trimmed.startsWith('@keyframes')) continue
      expect(trimmed.slice(0, 60)).toContain('[data-session-tags]')
    }
  })

  it('无同义词 token、无状态色 hex 字面量（tone 变量承载）', () => {
    expect(sessionTagsOverlayStyles).not.toContain('--dsw-alias-label-')
    expect(sessionTagsOverlayStyles).not.toContain('--dsw-alias-state-business-primary')
    expect(sessionTagsOverlayStyles).not.toContain('--dsw-alias-state-error-secondary')
    for (const hex of ['#51c58b', '#f0b45a', '#ee6b72', '#6aa8ff']) {
      expect(sessionTagsOverlayStyles.split(hex).length - 1, `${hex} once (root block only)`).toBe(1)
    }
  })

  it('交互底线：focus-visible、reduced-motion、busy 禁用语义', () => {
    expect(sessionTagsOverlayStyles).toContain(':focus-visible')
    expect(sessionTagsOverlayStyles).toContain('@media(prefers-reduced-motion:reduce)')
    expect(sessionTagsOverlayStyles).toContain('.session-tags-actions button:disabled')
    expect(sessionTagsOverlayStyles).toBe(`${sessionTagsOverlayStyles}`)
  })
})
