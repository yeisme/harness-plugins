/**
 * Canonical token registry.
 *
 * 官方 `dsh web` host 仍是主题 owner：面板运行时若定义了 `--dsw-alias-*`
 * 变量则一律优先；本 registry 只提供缺失时的唯一 canonical fallback，
 * 以及历史同义词到 canonical 名的归一。采纳面板不得另写字面量 fallback。
 */

/** Canonical `--dsw-alias-*` token 名。 */
export type PanelTokenName =
  | 'bg-base'
  | 'bg-layer-1'
  | 'bg-layer-2'
  | 'bg-elevated'
  | 'text-primary'
  | 'text-secondary'
  | 'text-tertiary'
  | 'text-quaternary'
  | 'text-link'
  | 'border-l1'
  | 'border-l2'
  | 'border-focus'
  | 'fill-hover'
  | 'fill-selected'
  | 'fill-active'
  | 'accent'
  | 'state-error'
  | 'state-positive'
  | 'state-info'
  | 'state-warn'
  | 'state-neutral'

/** 历史同义词 → canonical 名。迁移期旧名经此映射取同一 fallback。 */
export const TOKEN_SYNONYMS: Readonly<Record<string, PanelTokenName>> = {
  'label-primary': 'text-primary',
  'label-secondary': 'text-secondary',
  'label-tertiary': 'text-tertiary',
  'label-quaternary': 'text-quaternary',
  'interactive-bg-hover': 'fill-hover',
  'button-ghost-active-fill': 'fill-active',
  'state-business-primary': 'accent',
  'state-error-secondary': 'state-error',
}

/**
 * Official DSH theme variables for concepts whose historical plugin names do
 * not match the host vocabulary.  `panelVar` keeps the canonical plugin alias
 * first so an existing custom panel theme remains authoritative, then falls
 * through to the host variable and finally to the documented static fallback.
 */
export const HOST_THEME_ALIASES: Readonly<Partial<Record<PanelTokenName, string>>> = {
  'bg-elevated': 'bg-overlay',
  'text-primary': 'label-primary',
  'text-secondary': 'label-secondary',
  'text-tertiary': 'label-tertiary',
  'text-quaternary': 'label-caption',
  'text-link': 'state-business-primary',
  'border-focus': 'state-business-primary',
  'fill-hover': 'interactive-bg-hover',
  'fill-selected': 'interactive-bg-hover-accent',
  'fill-active': 'interactive-bg-active',
  accent: 'state-business-primary',
  'state-error': 'state-error-primary',
  'state-positive': 'state-success-primary',
  'state-info': 'state-business-primary',
  'state-warn': 'state-warn-primary',
  'state-neutral': 'label-tertiary',
}

/** 每个 canonical token 的唯一 fallback。bg/text 保持单调色阶。 */
export const PANEL_TOKENS: Readonly<Record<PanelTokenName, string>> = {
  'bg-base': '#171719',
  'bg-layer-1': '#1e1e21',
  'bg-layer-2': '#242429',
  'bg-elevated': '#2a2a2f',
  'text-primary': '#ececf1',
  'text-secondary': '#c6c6cb',
  'text-tertiary': '#92929b',
  'text-quaternary': '#6f6f78',
  'text-link': '#8fc5ff',
  'border-l1': 'rgba(255,255,255,.06)',
  'border-l2': 'rgba(255,255,255,.12)',
  'border-focus': '#79b8ff',
  'fill-hover': 'rgba(255,255,255,.08)',
  'fill-selected': 'rgba(101,166,255,.18)',
  'fill-active': '#343438',
  accent: '#79b8ff',
  'state-error': '#ee6b72',
  'state-positive': '#51c58b',
  'state-info': '#6aa8ff',
  'state-warn': '#f0b45a',
  'state-neutral': '#8b8b94',
}

/** 尺寸/排版刻度：面板 chrome 只允许从这里取值。 */
export const PANEL_SCALE = {
  radius: { sm: '6px', md: '8px', lg: '10px', xl: '12px' },
  control: { icon: '28px', button: '30px', input: '34px', touch: '44px' },
  font: { micro: '10px', small: '11px', body: '12px', strong: '13px', heading: '14px', title: '16px' },
  gap: { xs: '4px', sm: '6px', md: '8px', lg: '10px', xl: '14px' },
} as const

/**
 * Resolve a token (including a historical synonym) through the host theme.
 *
 * The first alias is our stable override seam.  The optional second alias is
 * the official host token, so light/dark/system changes continue to flow from
 * ThemeRuntime without a plugin-owned preference store.
 */
export function panelVar(name: PanelTokenName | (string & {})): string {
  const canonical = TOKEN_SYNONYMS[name] ?? name
  const fallback = PANEL_TOKENS[canonical as PanelTokenName]
  if (fallback === undefined) throw new Error(`unknown panel token: ${name}`)
  const hostAlias = HOST_THEME_ALIASES[canonical as PanelTokenName]
  const hostValue = hostAlias === undefined
    ? fallback
    : `var(--dsw-alias-${hostAlias},${fallback})`
  return `var(--dsw-alias-${canonical},${hostValue})`
}
