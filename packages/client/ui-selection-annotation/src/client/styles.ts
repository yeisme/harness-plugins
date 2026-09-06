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
[data-dsh-selection-composer].dsh-selection-composer{position:fixed;width:min(420px,calc(100vw - 24px));max-height:min(620px,calc(100vh - 24px));overflow:auto;color:var(--vk-text-primary);font-size:var(--vk-font-body);background:var(--vk-bg-elevated);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-lg);box-shadow:0 16px 44px color-mix(in srgb,var(--vk-bg-base) 72%,transparent);z-index:2147483001;animation:dsh-selection-composer-in 160ms cubic-bezier(.16,1,.3,1)}
[data-dsh-selection-composer] .dsh-selection-composer__header{display:flex;align-items:center;justify-content:space-between;gap:var(--vk-gap-lg);padding:var(--vk-gap-lg);border-bottom:1px solid var(--vk-border-l1)}
[data-dsh-selection-composer] .dsh-selection-composer__heading{display:grid;gap:1px;min-width:0}
[data-dsh-selection-composer] .dsh-selection-composer__eyebrow{color:var(--vk-text-tertiary);font-size:var(--vk-font-small);font-weight:550}
[data-dsh-selection-composer] .dsh-selection-composer__title{overflow:hidden;font-size:var(--vk-font-strong);font-weight:650;text-overflow:ellipsis;white-space:nowrap}
[data-dsh-selection-composer] .dsh-selection-composer__context{display:grid;gap:var(--vk-gap-sm);margin:var(--vk-gap-lg) var(--vk-gap-lg) 0;padding:var(--vk-gap-md) 0;background:transparent;border-bottom:1px solid var(--vk-border-l1)}
[data-dsh-selection-composer] .dsh-selection-composer__context-head{display:flex;align-items:center;justify-content:space-between;gap:var(--vk-gap-md);color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
[data-dsh-selection-composer] .dsh-selection-composer__quote{display:-webkit-box;margin:0;overflow:hidden;color:var(--vk-text-secondary);font-size:var(--vk-font-small);line-height:1.5;-webkit-box-orient:vertical;-webkit-line-clamp:2;word-break:break-word}
[data-dsh-selection-composer] .dsh-selection-composer__intents{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--vk-gap-xs);padding:var(--vk-gap-lg) var(--vk-gap-lg) 0}
[data-dsh-selection-composer] .dsh-selection-composer__intents .vk-btn{min-height:var(--vk-ctrl-button);padding:0 8px;border-color:transparent}
[data-dsh-selection-composer] .dsh-selection-composer__intents .vk-btn[aria-pressed='true']{color:var(--vk-text-primary);background:var(--vk-fill-active);border-color:var(--vk-border-l2)}
[data-dsh-selection-composer] .dsh-selection-composer__presets{display:flex;gap:var(--vk-gap-sm);overflow-x:auto;padding:var(--vk-gap-md) var(--vk-gap-lg) 0;scrollbar-width:none}
[data-dsh-selection-composer] .dsh-selection-composer__presets::-webkit-scrollbar{display:none}
[data-dsh-selection-composer] .dsh-selection-composer__preset{flex:0 0 auto;min-height:var(--vk-ctrl-icon);padding:0 9px;color:var(--vk-text-secondary);font-size:var(--vk-font-small);background:transparent;border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md);cursor:pointer}
[data-dsh-selection-composer] .dsh-selection-composer__preset:hover{color:var(--vk-text-primary);background:var(--vk-fill-hover);border-color:var(--vk-border-l2)}
[data-dsh-selection-composer] .dsh-selection-composer__field{padding:var(--vk-gap-lg) var(--vk-gap-lg) 0}
[data-dsh-selection-composer] .dsh-selection-composer__field textarea{min-height:76px;max-height:180px;resize:vertical;line-height:1.5}
[data-dsh-selection-composer] .dsh-selection-composer__option{display:flex;align-items:center;gap:var(--vk-gap-md);padding:var(--vk-gap-md) var(--vk-gap-lg) 0;color:var(--vk-text-secondary);font-size:var(--vk-font-small);cursor:pointer}
[data-dsh-selection-composer] .dsh-selection-composer__option input{margin:0;accent-color:var(--vk-accent)}
[data-dsh-selection-composer] .dsh-selection-composer__status{display:flex;align-items:center;min-height:24px;margin:7px 12px 0;padding:2px 0;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
[data-dsh-selection-composer] .dsh-selection-composer__status[data-tone='error']{color:var(--vk-tone-critical);background:color-mix(in srgb,var(--vk-tone-critical) 10%,transparent)}
[data-dsh-selection-composer] .dsh-selection-composer__status[data-tone='success']{color:var(--vk-tone-positive);background:color-mix(in srgb,var(--vk-tone-positive) 10%,transparent)}
[data-dsh-selection-composer] .dsh-selection-composer__footer{display:flex;align-items:center;justify-content:flex-end;gap:var(--vk-gap-md);padding:var(--vk-gap-lg)}
[data-dsh-selection-composer] .dsh-selection-composer__footer .vk-btn{min-height:var(--vk-ctrl-button)}
[data-dsh-selection-composer] .dsh-selection-composer__cards{display:flex;gap:var(--vk-gap-xs);margin-right:auto;min-width:0;overflow:hidden}
[data-dsh-selection-composer] .dsh-selection-composer__card{flex:0 1 auto;max-width:120px;overflow:hidden;padding:2px 6px;color:var(--vk-text-tertiary);font-size:var(--vk-font-small);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-sm);text-overflow:ellipsis;white-space:nowrap}
[data-dsh-selection-composer] .dsh-selection-composer__primary{min-width:112px}
[data-dsh-selection-composer] .dsh-annotation-canvas__surface{touch-action:none;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l1)}
[data-dsh-selection-composer] .dsh-annotation-canvas__marker{border:2px solid var(--vk-accent);border-radius:var(--vk-radius-sm);background:color-mix(in srgb,var(--vk-accent) 12%,transparent)}
[data-dsh-selection-composer] .dsh-annotation-canvas__marker-label{position:absolute;top:-10px;left:-10px;padding:0 4px;color:var(--vk-bg-base);font-size:var(--vk-font-small);line-height:16px;border-radius:var(--vk-radius-md);background:var(--vk-accent)}
[data-dsh-selection-composer] .dsh-annotation-canvas__unmapped{position:absolute;bottom:-18px;left:0;color:var(--vk-tone-warn);font-size:var(--vk-font-small);white-space:nowrap}
[data-dsh-selection-composer].dsh-selection-reference-details{position:fixed;width:min(380px,calc(100vw - 24px));max-height:min(480px,calc(100vh - 24px));overflow:auto;color:var(--vk-text-primary);font-size:var(--vk-font-body);background:var(--vk-bg-elevated);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-lg);box-shadow:0 16px 44px color-mix(in srgb,var(--vk-bg-base) 72%,transparent);z-index:2147483001}
[data-dsh-selection-composer] .dsh-selection-reference-details__header{display:flex;align-items:center;justify-content:space-between;gap:var(--vk-gap-lg);padding:var(--vk-gap-md) var(--vk-gap-lg);border-bottom:1px solid var(--vk-border-l1)}
[data-dsh-selection-composer] .dsh-selection-reference-details__title{overflow:hidden;font-size:var(--vk-font-strong);font-weight:650;text-overflow:ellipsis;white-space:nowrap}
[data-dsh-selection-composer] .dsh-selection-reference-details__rows{display:grid;gap:var(--vk-gap-xs);margin:0;padding:var(--vk-gap-md) var(--vk-gap-lg)}
[data-dsh-selection-composer] .dsh-selection-reference-details__row{display:flex;gap:var(--vk-gap-md);min-width:0;font-size:var(--vk-font-small)}
[data-dsh-selection-composer] .dsh-selection-reference-details__row dt{flex:0 0 72px;color:var(--vk-text-tertiary)}
[data-dsh-selection-composer] .dsh-selection-reference-details__row dd{margin:0;overflow:hidden;color:var(--vk-text-secondary);text-overflow:ellipsis;white-space:nowrap}
[data-dsh-selection-composer] .dsh-selection-reference-details__quote{display:-webkit-box;margin:0 var(--vk-gap-lg);overflow:hidden;color:var(--vk-text-secondary);font-size:var(--vk-font-small);line-height:1.5;-webkit-box-orient:vertical;-webkit-line-clamp:3;word-break:break-word}
[data-dsh-selection-composer] .dsh-selection-reference-details__technical{padding:var(--vk-gap-md) var(--vk-gap-lg) 0;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
[data-dsh-selection-composer] .dsh-selection-reference-details__technical code{display:block;margin-top:var(--vk-gap-xs);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-dsh-selection-composer] .dsh-selection-reference-details__footer{display:flex;align-items:center;gap:var(--vk-gap-md);padding:var(--vk-gap-md) var(--vk-gap-lg) var(--vk-gap-lg)}
[data-dsh-selection-composer] .dsh-selection-reference-details__reason{min-width:0;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
@keyframes dsh-selection-composer-in{from{opacity:0;transform:translateY(6px) scale(.985)}to{opacity:1;transform:none}}
@media(max-width:559px){[data-dsh-selection-composer].dsh-selection-composer{left:8px!important;right:8px!important;top:auto!important;bottom:8px!important;width:auto;max-height:min(72vh,620px);border-radius:var(--vk-radius-lg)}[data-dsh-selection-composer] .dsh-selection-composer__footer{position:sticky;bottom:0;background:var(--vk-bg-elevated);border-top:1px solid var(--vk-border-l1)}[data-dsh-selection-composer] .dsh-selection-composer__footer .vk-btn{min-height:var(--vk-ctrl-touch)}}
@media (pointer:coarse){[data-dsh-selection-composer].dsh-selection-composer button:is(.vk-btn,.vk-icon-btn,.dsh-selection-composer__preset),[data-dsh-selection-composer] .dsh-selection-composer__option{min-height:var(--vk-ctrl-touch)}[data-dsh-selection-composer].dsh-selection-composer button:is(.vk-btn,.vk-icon-btn,.dsh-selection-composer__preset){min-width:var(--vk-ctrl-touch)}}
@media (prefers-reduced-motion: reduce){[data-dsh-selection-composer].dsh-selection-composer,[data-dsh-selection-composer] *{transition:none!important;animation:none!important}}
`,
  })
  target.head.append(style)
}
