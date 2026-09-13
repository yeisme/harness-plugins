import { describe, expect, it } from 'vitest'
import { HOST_THEME_ALIASES, PANEL_TOKENS } from '@yeisme/dsh-client-ui-visual-kit'
import { providerPresetsStyles } from '../src/client/styles.ts'

/**
 * dsh-unified-panel-visual-system adopted 档采纳证据：样式串来自 visual kit
 * （token fallback 单点、scope 隔离），交互底线齐备（focus-visible、
 * reduced-motion、busy 禁用语义）。
 */
describe('provider presets visual adoption', () => {
  it('每个 canonical token 在根块单点声明，并保留 canonical → official host → fallback 顺序', () => {
    for (const [canonical, fallback] of Object.entries(PANEL_TOKENS)) {
      const host = HOST_THEME_ALIASES[canonical]
      const declaration = host === undefined
        ? `--vk-${canonical}:var(--dsw-alias-${canonical},${fallback})`
        : `--vk-${canonical}:var(--dsw-alias-${canonical},var(--dsw-alias-${host},${fallback}))`
      expect(providerPresetsStyles.split(declaration).length - 1, `${canonical} root declaration once`).toBe(1)
    }
  })

  it('渠道市场类全部限定 [data-provider-presets] scope', () => {
    for (const cls of ['pp-section', 'pp-grid', 'pp-card', 'pp-overview', 'pp-row', 'pp-dialog-body', 'pp-model-list', 'pp-dialog-actions']) {
      expect(providerPresetsStyles).toContain(`[data-provider-presets] .${cls}{`)
    }
    for (const chunk of providerPresetsStyles.split('}')) {
      const trimmed = chunk.trim()
      if (!trimmed.includes('{') || trimmed.startsWith('@keyframes')) continue
      if (trimmed.startsWith('@container')) {
        expect(trimmed).toContain('[data-provider-presets]')
        continue
      }
      expect(trimmed.slice(0, 80)).toContain('[data-provider-presets]')
    }
  })

  it('不声明同义词 token；状态色只经 tone 变量承载', () => {
    expect(providerPresetsStyles).not.toContain('--vk-label-')
    expect(providerPresetsStyles).not.toContain('--vk-state-business-primary')
    expect(providerPresetsStyles).not.toContain('--dsw-alias-state-error-secondary')
    for (const hex of ['#51c58b', '#f0b45a', '#ee6b72', '#6aa8ff']) {
      expect(providerPresetsStyles.split(hex).length - 1, `${hex} once (root block only)`).toBe(1)
    }
  })

  it('交互底线：focus-visible、reduced-motion、busy 禁用语义', () => {
    expect(providerPresetsStyles).toContain(':focus-visible')
    expect(providerPresetsStyles).toContain('@media(prefers-reduced-motion:reduce)')
    expect(providerPresetsStyles).toContain('.pp-dialog-actions button:disabled')
  })
})
