/**
 * 选区批注注入样式（Selection Interaction V2 视觉统一）。
 *
 * Composer overlay 与 AnnotationCanvas 全部走 `buildPanelStyles` 的 vk token
 * canonical fallback；不再保留白色/GitHub 风格 `--dsh-*` 字面量 fallback，
 * 不新增第二套颜色/圆角/焦点环。V1 adapter 与 V2 共用同一份样式。
 *
 * @module @yeisme/dsh-client-ui-selection-annotation/client
 */

import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'

export const SELECTION_ANNOTATION_STYLE_ID = 'dsh-selection-annotation-styles'

export function injectSelectionAnnotationStyles(target: Document): void {
  if (target.getElementById(SELECTION_ANNOTATION_STYLE_ID) !== null) return
  const style = target.createElement('style')
  style.id = SELECTION_ANNOTATION_STYLE_ID
  style.textContent = buildPanelStyles({
    scope: 'dsh-selection-composer',
    extra: `
[data-dsh-selection-composer] .dsh-selection-composer{position:fixed;right:16px;bottom:16px;width:min(360px,calc(100vw - 32px));padding:8px;background:var(--vk-bg-elevated);color:var(--vk-text-primary);font-size:var(--vk-font-body);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-lg);z-index:2147483001}
[data-dsh-selection-composer] .dsh-selection-composer__header{display:flex;justify-content:space-between;font-weight:650}
[data-dsh-selection-composer] .dsh-selection-composer__intents{display:flex;gap:4px;margin:6px 0}
[data-dsh-selection-composer] .dsh-selection-composer__intents button[aria-pressed='true']{border-color:var(--vk-accent)}
[data-dsh-selection-composer] .dsh-selection-composer textarea{width:100%;resize:none;box-sizing:border-box;padding:6px;color:inherit;font:inherit;background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md)}
[data-dsh-selection-composer] .dsh-selection-composer__footer{display:flex;gap:8px;align-items:center;margin-top:6px;color:var(--vk-text-secondary)}
[data-dsh-selection-composer] .dsh-selection-composer__card{padding:1px 6px;font-size:var(--vk-font-small);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-sm)}
[data-dsh-selection-composer] .dsh-annotation-canvas__surface{touch-action:none;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l1)}
[data-dsh-selection-composer] .dsh-annotation-canvas__marker{border:2px solid var(--vk-accent);border-radius:var(--vk-radius-sm);background:color-mix(in srgb,var(--vk-accent) 12%,transparent)}
[data-dsh-selection-composer] .dsh-annotation-canvas__marker-label{position:absolute;top:-10px;left:-10px;padding:0 4px;color:var(--vk-bg-base);font-size:var(--vk-font-small);line-height:16px;border-radius:var(--vk-radius-md);background:var(--vk-accent)}
[data-dsh-selection-composer] .dsh-annotation-canvas__unmapped{position:absolute;bottom:-18px;left:0;color:var(--vk-tone-warn);font-size:var(--vk-font-small);white-space:nowrap}
@media (prefers-reduced-motion: reduce){[data-dsh-selection-composer] *{transition:none!important;animation:none!important}}
`,
  })
  target.head.append(style)
}
