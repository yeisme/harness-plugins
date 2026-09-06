import { describe, expect, it } from 'vitest'
import { HOST_THEME_ALIASES, PANEL_TOKENS } from '@yeisme/dsh-client-ui-visual-kit'
import { sessionTagsOverlayStyles } from '../src/client/styles.ts'

/**
 * dsh-unified-panel-visual-system-v1 3.4 A 档采纳证据：
 * overlay 样式串来自 visual kit（token fallback 单点、scope 隔离），
 * 历史"类名定义在无处"的裸面获得统一 chrome，交互底线齐备。
 */
describe('session tags overlay visual adoption', () => {
  it('每个 canonical token 在根块单点声明，并保留 canonical → official host → fallback 顺序', () => {
    for (const [canonical, fallback] of Object.entries(PANEL_TOKENS)) {
      const host = HOST_THEME_ALIASES[canonical]
      const declaration = host === undefined
        ? `--vk-${canonical}:var(--dsw-alias-${canonical},${fallback})`
        : `--vk-${canonical}:var(--dsw-alias-${canonical},var(--dsw-alias-${host},${fallback}))`
      expect(sessionTagsOverlayStyles.split(declaration).length - 1, `${canonical} root declaration once`).toBe(1)
    }
  })

  it('既有 session-tags-* 类全部获得样式且限定 scope', () => {
    for (const cls of ['session-tags-overlay-backdrop', 'session-tags-draft', 'session-tags-chip', 'session-tags-entry', 'session-tags-suggestions', 'session-tags-feedback', 'session-tags-conflict', 'session-tags-error', 'session-tags-actions']) {
      expect(sessionTagsOverlayStyles).toContain(`[data-session-tags] .${cls}{`)
    }
    expect(sessionTagsOverlayStyles).toContain('[data-session-tags].session-tags-editor{')
    for (const chunk of sessionTagsOverlayStyles.split('}')) {
      const trimmed = chunk.trim()
      if (!trimmed.includes('{') || trimmed.startsWith('@keyframes')) continue
      if (trimmed.startsWith('@container')) {
        expect(trimmed).toContain('[data-session-tags]')
        continue
      }
      expect(trimmed.slice(0, 60)).toContain('[data-session-tags]')
    }
  })

  it('不声明同义词 token；官方 host alias 仅作为 fallback，tone 变量承载状态色', () => {
    expect(sessionTagsOverlayStyles).not.toContain('--vk-label-')
    expect(sessionTagsOverlayStyles).not.toContain('--vk-state-business-primary')
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
