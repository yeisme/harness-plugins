import { PANEL_SCALE, PANEL_TOKENS, panelVar, type PanelTokenName } from './tokens.ts'
import type { StatusTone } from './status.ts'

export interface BuildPanelStylesOptions {
  /** 面板根 data 属性名（如 `pane-domain` → `[data-pane-domain]`）。 */
  readonly scope: string
  /** accent 的面板级 fallback 字面量；host `--dsw-alias-accent` 仍优先。 */
  readonly accentFallback?: string
  /** 面板自有扩展规则；调用方必须自带 `[data-<scope>]` 作用域。 */
  readonly extra?: string
}

const TOKEN_ORDER: readonly PanelTokenName[] = [
  'bg-base', 'bg-layer-1', 'bg-layer-2', 'bg-elevated',
  'text-primary', 'text-secondary', 'text-tertiary', 'text-quaternary', 'text-link',
  'border-l1', 'border-l2', 'border-focus',
  'fill-hover', 'fill-selected', 'fill-active', 'accent',
  'state-error', 'state-positive', 'state-info', 'state-warn', 'state-neutral',
]

const TONE_VARS: Record<StatusTone, string> = {
  positive: 'var(--vk-state-positive)',
  info: 'var(--vk-state-info)',
  warn: 'var(--vk-state-warn)',
  critical: 'var(--vk-state-error)',
  neutral: 'var(--vk-state-neutral)',
}

/** tone → CSS 值（状态点/徽标消费；只作颜色，不单独承载语义）。 */
export function toneColorVar(tone: StatusTone): string {
  return TONE_VARS[tone]
}

/**
 * 构建一个面板的完整 scoped 样式串：
 * - token fallback 只在面板根声明一次（`--vk-*` 链到 host `--dsw-alias-*`）；
 * - base/chrome/state 三层规则全部限定在 `[data-<scope>]` 内；
 * - 纯函数：同参数输出逐字节相同，重复注入幂等。
 */
export function buildPanelStyles(options: BuildPanelStylesOptions): string {
  const scope = options.scope
  const root = `[data-${scope}]`
  const accent = options.accentFallback === undefined
    ? panelVar('accent')
    : `var(--dsw-alias-accent,${options.accentFallback})`
  const s = PANEL_SCALE

  const tokenBlock = TOKEN_ORDER.map(name =>
    name === 'accent'
      ? `--vk-accent:${accent}`
      : `--vk-${name}:${panelVar(name)}`,
  ).join(';')

  const css = `${root} *,${root} *::before,${root} *::after{box-sizing:border-box}
${root}{${tokenBlock};--vk-radius-sm:${s.radius.sm};--vk-radius-md:${s.radius.md};--vk-radius-lg:${s.radius.lg};--vk-radius-xl:${s.radius.xl};--vk-ctrl-icon:${s.control.icon};--vk-ctrl-button:${s.control.button};--vk-ctrl-input:${s.control.input};--vk-font-small:${s.font.small};--vk-font-body:${s.font.body};--vk-font-strong:${s.font.strong};--vk-font-heading:${s.font.heading};--vk-font-title:${s.font.title};--vk-gap-sm:${s.gap.sm};--vk-gap-md:${s.gap.md};--vk-gap-lg:${s.gap.lg};min-width:0;color:var(--vk-text-primary);background:var(--vk-bg-base);font:${s.font.strong}/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
${root} button{font:inherit;color:inherit}
${root} button:focus-visible,${root} input:focus-visible,${root} textarea:focus-visible,${root} select:focus-visible,${root} a:focus-visible,${root} [tabindex]:focus-visible{outline:2px solid var(--vk-border-focus);outline-offset:2px}
${root}{--vk-tone-positive:var(--vk-state-positive);--vk-tone-info:var(--vk-state-info);--vk-tone-warn:var(--vk-state-warn);--vk-tone-critical:var(--vk-state-error);--vk-tone-neutral:var(--vk-state-neutral)}
${root} .vk-header{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:var(--vk-gap-md);min-width:0;padding:var(--vk-gap-lg) 12px;background:color-mix(in srgb,var(--vk-bg-layer-1) 94%,transparent);border-bottom:1px solid var(--vk-border-l2);backdrop-filter:blur(14px)}
${root} .vk-heading{margin:0;font-size:var(--vk-font-heading);font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${root} .vk-sub{min-width:0;color:var(--vk-text-tertiary);font-size:var(--vk-font-small);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${root} .vk-toolbar{display:flex;align-items:center;gap:var(--vk-gap-sm);flex-wrap:wrap;margin-left:auto}
${root} .vk-body{display:grid;gap:var(--vk-gap-lg);min-width:0;padding:var(--vk-gap-lg)}
${root} .vk-section{display:grid;gap:var(--vk-gap-md);min-width:0}
${root} .vk-section>header{display:flex;align-items:baseline;justify-content:space-between;gap:var(--vk-gap-md)}
${root} .vk-section h2,${root} .vk-section h3{margin:0;color:var(--vk-text-primary);font-size:var(--vk-font-strong)}
${root} .vk-muted{margin:0;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${root} .vk-card{display:grid;gap:var(--vk-gap-sm);min-width:0;padding:12px;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-lg)}
${root} .vk-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:var(--vk-gap-md);align-items:center;min-width:0;padding:9px 10px;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md)}
${root} .vk-row strong{font-size:var(--vk-font-body)}
${root} .vk-row small{display:block;color:var(--vk-text-tertiary);font-size:var(--vk-font-small);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${root} .vk-btn{display:inline-flex;align-items:center;justify-content:center;min-height:var(--vk-ctrl-button);padding:0 10px;color:var(--vk-text-secondary);background:transparent;border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md);cursor:pointer}
${root} .vk-btn:hover:not(:disabled){color:var(--vk-text-primary);background:var(--vk-fill-hover)}
${root} .vk-btn[data-primary='true']{color:#eef7ff;background:color-mix(in srgb,var(--vk-accent) 28%,transparent);border-color:color-mix(in srgb,var(--vk-accent) 62%,transparent)}
${root} .vk-btn:disabled{opacity:.46;cursor:not-allowed}
${root} .vk-icon-btn{display:grid;place-items:center;width:var(--vk-ctrl-icon);height:var(--vk-ctrl-icon);padding:0;color:var(--vk-text-secondary);background:transparent;border:0;border-radius:var(--vk-radius-md);cursor:pointer}
${root} .vk-icon-btn:hover:not(:disabled),${root} .vk-icon-btn:focus-visible{color:var(--vk-text-primary);background:var(--vk-fill-hover)}
${root} .vk-field{display:grid;gap:5px;min-width:0}
${root} .vk-field>span{font-size:var(--vk-font-small);font-weight:650;color:var(--vk-text-secondary)}
${root} .vk-field input,${root} .vk-field textarea,${root} .vk-field select{width:100%;min-height:var(--vk-ctrl-input);padding:7px 9px;color:inherit;background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md)}
${root} .vk-badge{display:inline-flex;align-items:center;min-height:20px;padding:0 7px;border-radius:999px;background:rgba(255,255,255,.07);color:var(--vk-text-secondary);font-size:${s.font.micro}}
${root} .vk-dot{width:9px;height:9px;border-radius:50%;background:var(--vk-tone-neutral)}
${root} .vk-dot[data-tone='positive']{background:var(--vk-tone-positive)}
${root} .vk-dot[data-tone='info']{background:var(--vk-tone-info)}
${root} .vk-dot[data-tone='warn']{background:var(--vk-tone-warn)}
${root} .vk-dot[data-tone='critical']{background:var(--vk-tone-critical)}
${root} .vk-progress{height:4px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.08)}
${root} .vk-progress>i{display:block;height:100%;background:var(--vk-accent);border-radius:inherit}
${root} .vk-empty{display:grid;place-items:center;gap:var(--vk-gap-md);min-width:0;padding:24px;text-align:center;color:var(--vk-text-tertiary)}
${root} .vk-alert{display:grid;gap:var(--vk-gap-sm);padding:10px;border-radius:var(--vk-radius-md);color:var(--vk-text-primary);background:color-mix(in srgb,var(--vk-tone-critical) 12%,transparent);border:1px solid color-mix(in srgb,var(--vk-tone-critical) 32%,transparent);font-size:var(--vk-font-small)}
${root} .vk-alert[data-tone='warn']{background:color-mix(in srgb,var(--vk-tone-warn) 12%,transparent);border-color:color-mix(in srgb,var(--vk-tone-warn) 32%,transparent)}
${root} .vk-alert[data-tone='info']{background:color-mix(in srgb,var(--vk-tone-info) 12%,transparent);border-color:color-mix(in srgb,var(--vk-tone-info) 32%,transparent)}
${root} .vk-skeleton{position:relative;overflow:hidden;background:var(--vk-bg-layer-2);border-radius:var(--vk-radius-md)}
${root} .vk-skeleton::after{position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);transform:translateX(-100%);animation:vk-shimmer-${scope} 1.4s ease-in-out infinite;content:''}
@keyframes vk-shimmer-${scope}{to{transform:translateX(100%)}}
${root} .vk-skeleton,${root} .vk-skeleton::after{min-height:14px}
@media(pointer:coarse){${root} .vk-btn,${root} .vk-icon-btn{min-height:${s.control.touch};min-width:${s.control.touch}}}
@media(prefers-reduced-motion:reduce){${root} *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
${options.extra ?? ''}
`
  return css
}

/** 供测试/工具核对：canonical fallback 集合。 */
export const CANONICAL_FALLBACKS: Readonly<Record<PanelTokenName, string>> = PANEL_TOKENS
