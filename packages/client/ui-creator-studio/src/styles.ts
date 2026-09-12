import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'

/**
 * Creator Studio 面板样式。
 *
 * 统一视觉系统（dsh-unified-panel-visual-system-v1）：token fallback 只由
 * visual kit 在面板根单点声明；下列自有规则只消费 `--vk-*`，不再携带
 * `--dsw-alias-*` 字面量 fallback 或状态色 hex，且每条选择器都限定在
 * `[data-creator-studio]` 之内。host 定义变量时仍优先。
 */
const S = '[data-creator-studio]'

const creatorStudioExtra = `
${S} .cs-scaena-table{max-width:100%;overflow:auto}
${S} .cs-scaena-table table{width:100%;border-collapse:collapse}
${S} .cs-scaena-table th,${S} .cs-scaena-table td{padding:var(--vk-gap-sm);border-bottom:1px solid var(--vk-border-l1);text-align:start;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}
${S} .cs-shot-sequence{display:flex;gap:var(--vk-gap-md);overflow:auto;padding:var(--vk-gap-md);margin:0;list-style:none}
${S} .cs-shot-sequence li{display:flex;flex-direction:column;gap:var(--vk-gap-sm);padding:var(--vk-gap-sm);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-sm);min-width:120px}

${S} .cs-image-viewport{min-width:0;width:100%}
${S} .cs-image-pan{overflow:auto;height:420px;max-height:65vh;min-height:200px;cursor:grab;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-sm)}
${S} .cs-image-pan:active{cursor:grabbing}
${S} .cs-image-plane{display:grid;place-items:center;width:100%;height:100%}
${S} .cs-image-plane img{display:block;max-width:none;max-height:none;object-fit:contain;user-select:none}

${S}.cs-domain-studio{container-type:inline-size}
${S} .cs-professional-grid,${S} .cs-scaena-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,320px);gap:var(--vk-gap-md);min-width:0;align-items:start}
${S} .cs-scaena-grid{grid-template-columns:minmax(140px,200px) minmax(0,1fr) minmax(240px,320px)}
${S} .cs-professional-stage{min-width:0;min-height:320px}
${S} .cs-professional-inspector{min-width:0;max-height:70vh;overflow:auto}
${S} .cs-professional-library{grid-column:1 / -1;min-width:0;border-top:1px solid var(--vk-border-l1);padding-top:var(--vk-gap-md)}
${S} .cs-scaena-tree{min-width:0;max-height:70vh;overflow:auto}
${S} .cs-shot-list>button[data-kind=shot]{padding-inline-start:var(--vk-gap-lg)}
${S} .cs-shot-list{display:flex;flex-direction:column;gap:var(--vk-gap-sm)}
${S} .cs-shot-list>button{justify-content:space-between;white-space:normal;text-align:start;gap:var(--vk-gap-sm)}
${S} .cs-shot-list>button[aria-pressed=true]{background:var(--vk-bg-layer-2);outline:1px solid var(--vk-accent)}
@container(max-width:900px){${S} .cs-scaena-grid{grid-template-columns:minmax(0,1fr) minmax(240px,300px)}${S} .cs-scaena-tree{grid-column:1 / -1;max-height:180px}}
@container(max-width:600px){${S} .cs-professional-grid,${S} .cs-scaena-grid{grid-template-columns:minmax(0,1fr)}${S} .cs-professional-inspector{max-height:none;overflow:visible}${S} .cs-professional-stage{min-height:200px}}

${S} .cs-wrapping-content{overflow-wrap:anywhere;min-width:0}
${S} .cs-eikona-image-preview{grid-column:1 / -1;min-width:0;max-width:100%}
${S} .cs-eikona-image-preview>img{display:block;max-width:100%;max-height:320px;object-fit:contain}
${S} .cs-capability-list{list-style:none;margin:0;padding:0;min-width:0}
${S} .cs-capability-list>li{padding:var(--vk-gap-md) 0;border-bottom:1px solid var(--vk-border-l1);overflow-wrap:anywhere}
${S} .cs-capability-details{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:var(--vk-gap-sm);font-size:var(--vk-font-small)}
${S} .cs-capability-details dt{color:var(--vk-text-tertiary)}${S} .cs-capability-details dd{min-width:0;margin:0;overflow-wrap:anywhere}
${S} .cs-subtitle-version{overflow-wrap:anywhere}
${S} .cs-subtitle-code{min-width:0;padding:var(--vk-gap-md);background:var(--vk-bg-layer-1);border-radius:var(--vk-radius-sm)}
${S} .cs-subtitle-code pre{margin:var(--vk-gap-md) 0 0;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--vk-text-primary);font-size:var(--vk-font-small)}
${S} .cs-subtitle-code button{min-height:var(--vk-ctrl-button);padding:0 var(--vk-gap-md);color:var(--vk-text-secondary);background:transparent;border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md);cursor:pointer}
${S} .cs-subtitle-code button:focus-visible{outline:2px solid var(--vk-accent);outline-offset:2px}
@media(pointer:coarse){${S} .cs-subtitle-code button{min-height:var(--vk-ctrl-touch)}}
${S}{min-height:100%}
${S}.cs-shell{display:flex;min-height:100%}
${S} .cs-header{backdrop-filter:blur(14px)}
${S} .cs-actions,${S} .cs-badges,${S} .cs-metrics{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
${S} .cs-artifact-panel{min-width:0}
${S} [data-auctra-recovery-loader],${S} [data-auctra-recovery-drafts],${S} .cs-recovery-preview{min-width:0;max-width:100%;overflow-wrap:anywhere}
${S} .cs-recovery-preview pre{max-width:100%;max-height:20rem;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}
${S} .cs-button{min-height:var(--vk-ctrl-button)}
${S} .cs-button:disabled{opacity:.46;cursor:not-allowed}
${S} .cs-lifecycle{display:flex;align-items:center;gap:8px;min-width:max-content}
${S} .cs-lifecycle-group{display:flex;align-items:center;gap:3px}${S} .cs-lifecycle-group>span{padding-right:1px;color:var(--vk-text-quaternary);font-size:var(--vk-font-small);font-weight:650}${S} .cs-lifecycle-items{display:flex;gap:2px}${S} .cs-lifecycle-items>span>button{min-height:26px;padding:0 8px;color:var(--vk-text-secondary);background:transparent;border:1px solid transparent;border-radius:var(--vk-radius-sm);box-shadow:none}${S} .cs-lifecycle-items>span>button:hover{color:var(--vk-text-primary);background:var(--vk-fill-hover)}${S} .cs-lifecycle-items>span[data-active='true']>button{color:var(--vk-accent);background:var(--vk-fill-selected);border-color:color-mix(in srgb,var(--vk-accent) 34%,transparent)}
${S} .cs-owner-status-panel{position:relative;min-width:138px}${S} .cs-owner-status-panel>summary{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:var(--vk-ctrl-icon);padding:0 8px;background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md);cursor:pointer;list-style:none}${S} .cs-owner-status-panel>summary:hover{background:var(--vk-fill-hover);border-color:var(--vk-border-l2)}${S} .cs-owner-status-panel>summary::-webkit-details-marker{display:none}${S} .cs-owner-status-panel>summary strong{color:var(--vk-text-primary);font-size:var(--vk-font-small)}${S} .cs-owner-status-panel>p{margin:8px 0;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}${S} .cs-owner-status-panel[open]{position:absolute;z-index:6;top:8px;right:78px;width:min(420px,calc(100cqi - 20px));padding:8px;background:var(--vk-bg-elevated);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-lg);box-shadow:0 12px 32px rgba(0,0,0,.28)}
${S} .cs-state-strip{min-height:0;margin:8px 12px 0;padding:8px 10px;place-items:start;text-align:left}
${S} .cs-body{display:grid;gap:var(--vk-gap-lg);padding:var(--vk-gap-lg);min-width:0}
${S} .cs-section{display:grid;gap:var(--vk-gap-md);min-width:0}${S} .cs-section>header{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--vk-gap-lg)}${S} .cs-section h2,${S} .cs-section h3{margin:0}${S} .cs-section h2{font-size:var(--vk-font-heading)}${S} .cs-section h3{font-size:var(--vk-font-strong)}${S} .cs-muted{margin:0;color:var(--vk-text-tertiary)}
${S} .cs-quick-grid{display:grid;grid-template-columns:repeat(4,minmax(128px,1fr));gap:8px}
${S} .cs-quick-card,${S} .cs-card,${S} .cs-composer,${S} .cs-pulse,${S} .cs-status-panel{display:grid;gap:8px;padding:12px;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-lg)}
${S} .cs-quick-card{min-height:104px;text-align:left;cursor:pointer}${S} .cs-quick-card:hover{background:var(--vk-bg-elevated);border-color:color-mix(in srgb,var(--vk-accent) 38%,transparent)}${S} .cs-quick-card strong{font-size:var(--vk-font-heading)}${S} .cs-quick-card span{color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}${S} .cs-quick-card b{display:grid;place-items:center;width:var(--vk-ctrl-icon);height:var(--vk-ctrl-icon);border-radius:var(--vk-radius-md);background:color-mix(in srgb,var(--vk-accent) 16%,transparent);color:var(--vk-accent)}
${S} .cs-owner-list{display:grid;gap:1px}${S} .cs-owner-row{background:transparent;border-bottom:1px solid var(--vk-border-l1);border-radius:0}${S} .cs-owner-row:last-child{border-bottom:0}${S} .cs-owner-row strong{font-size:var(--vk-font-body)}${S} .cs-owner-row small{display:block;overflow:hidden;color:var(--vk-text-tertiary);text-overflow:ellipsis;white-space:nowrap}
${S} .cs-status-dot{width:9px;height:9px;border-radius:50%;background:var(--vk-state-neutral)}${S} .cs-status-dot[data-status='ready'],${S} .cs-status-dot[data-status='completed']{background:var(--vk-state-positive)}${S} .cs-status-dot[data-status='running']{background:var(--vk-state-info)}${S} .cs-status-dot[data-status='partial'],${S} .cs-status-dot[data-status='stale'],${S} .cs-status-dot[data-status='approval_required']{background:var(--vk-state-warn)}${S} .cs-status-dot[data-status='offline'],${S} .cs-status-dot[data-status='failed'],${S} .cs-status-dot[data-status='contract_mismatch'],${S} .cs-status-dot[data-status='reconcile_required'],${S} .cs-status-dot[data-status='unknown']{background:var(--vk-state-error)}
${S} .cs-stage-track{display:grid;grid-template-columns:repeat(6,minmax(88px,1fr));gap:var(--vk-gap-sm)}${S} .cs-stage{position:relative;display:grid;gap:5px;padding:9px;border-radius:var(--vk-radius-md);background:var(--vk-bg-layer-2);border:1px solid transparent}${S} .cs-stage[data-current='true']{border-color:var(--vk-accent)}${S} .cs-stage small{color:var(--vk-text-tertiary)}
${S} .cs-progress{height:4px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.08)}${S} .cs-progress>i{display:block;height:100%;background:var(--vk-accent);border-radius:inherit}
${S} .cs-resource-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:var(--vk-gap-md)}${S} .cs-card{align-content:start;min-height:112px}${S} .cs-card[data-kind='image'],${S} .cs-card[data-kind='video'],${S} .cs-card[data-kind='shot']{min-height:152px}${S} .cs-card-preview{display:grid;place-items:center;min-height:64px;border-radius:var(--vk-radius-md);background:color-mix(in srgb,var(--vk-accent) 7%,var(--vk-bg-layer-2));color:var(--vk-text-tertiary);font-size:var(--vk-font-title)}${S} .cs-card h3{font-size:var(--vk-font-strong)}${S} .cs-card p{margin:0;color:var(--vk-text-secondary);font-size:var(--vk-font-small)}${S} .cs-badge,${S} .cs-metric{display:inline-flex;align-items:center;min-height:20px;padding:0 7px;border-radius:999px;background:rgba(255,255,255,.07);color:var(--vk-text-secondary);font-size:10px}${S} .cs-metric[data-tone='positive']{color:var(--vk-state-positive)}${S} .cs-metric[data-tone='warning']{color:var(--vk-state-warn)}${S} .cs-metric[data-tone='critical']{color:var(--vk-state-error)}
${S} .cs-waveform{height:52px;display:flex;align-items:center;gap:2px;padding:var(--vk-gap-sm);border-radius:var(--vk-radius-md);background:rgba(0,0,0,.16)}${S} .cs-waveform i{flex:1;min-width:2px;background:var(--vk-accent);border-radius:2px}
${S} .cs-diff{display:grid;grid-template-columns:1fr 1fr;gap:var(--vk-gap-sm)}${S} .cs-diff pre{min-height:70px;margin:0;padding:8px;overflow:auto;white-space:pre-wrap;border-radius:var(--vk-radius-sm);background:rgba(0,0,0,.16);color:var(--vk-text-secondary);font:var(--vk-font-small)/1.45 ui-monospace,SFMono-Regular,Consolas,monospace}${S} .cs-diff pre[data-side='after']{background:color-mix(in srgb,var(--vk-state-positive) 12%,transparent)}
${S} .cs-eikona-tabs{display:flex;flex-wrap:wrap;gap:var(--vk-gap-sm);margin-bottom:var(--vk-gap-md)}${S} .cs-eikona-tabs [aria-selected=true]{background:var(--vk-fill-selected);border-color:var(--vk-border-focus)}${S} [data-eikona-studio] .cs-composer{position:static}${S} [data-auctra-writing-studio] .cs-composer{position:static}
${S} .cs-workspace-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.36fr);gap:var(--vk-gap-lg);align-items:start}${S} .cs-composer{position:sticky;top:112px}${S} .cs-field{display:grid;gap:5px}${S} .cs-field>span{font-size:var(--vk-font-small);font-weight:650}${S} .cs-field input,${S} .cs-field textarea,${S} .cs-field select{width:100%;min-height:var(--vk-ctrl-input);padding:7px 9px;color:inherit;background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md)}${S} .cs-field textarea{min-height:84px;resize:vertical}${S} .cs-confirm{display:flex;gap:var(--vk-gap-md);align-items:flex-start;color:var(--vk-text-secondary);font-size:var(--vk-font-small)}${S} .cs-receipt{padding:9px;border-radius:var(--vk-radius-md);background:color-mix(in srgb,var(--vk-accent) 11%,transparent);border:1px solid color-mix(in srgb,var(--vk-accent) 20%,transparent)}${S} .cs-action-receipt{display:grid;gap:var(--vk-gap-sm);overflow-wrap:anywhere}${S} .cs-receipt[data-status='unknown'],${S} .cs-receipt[data-status='reconcile_required'],${S} .cs-receipt[data-status='failed']{background:color-mix(in srgb,var(--vk-state-error) 10%,transparent);border-color:color-mix(in srgb,var(--vk-state-error) 28%,transparent)}
${S} .cs-run-candidates .ys-list>.ys-row{display:flex;flex-direction:column;align-items:stretch;gap:var(--vk-gap-sm);min-width:0}${S} .cs-run-candidates .ys-list>.ys-row>*{min-width:0;max-width:100%}
${S} .cs-list{display:grid;gap:var(--vk-gap-sm);margin:0;padding:0;list-style:none}${S} .cs-list li{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:9px;align-items:center;padding:9px 10px;border-radius:var(--vk-radius-md);background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l1)}${S} .cs-list strong{font-size:var(--vk-font-body)}${S} .cs-list small{display:block;color:var(--vk-text-tertiary)}
@media(pointer:coarse){${S} .cs-button{min-height:var(--vk-ctrl-touch);min-width:var(--vk-ctrl-touch)}${S} .cs-auto-save .cs-confirm{min-height:var(--vk-ctrl-touch)}}
${S} .cs-auto-save{display:grid;gap:var(--vk-gap-sm)}${S} .cs-auto-save .cs-confirm{align-items:center;cursor:pointer}${S} .cs-auto-save input[type='checkbox']{flex:none;width:16px;height:16px;min-height:16px;padding:0;margin:0;accent-color:var(--vk-accent)}
${S} .cs-artifact-workspace{min-width:0;align-content:start}${S} .cs-artifact-preview{min-width:0;max-height:min(62vh,680px);overflow:auto;padding:var(--vk-gap-md);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md);background:var(--vk-bg-layer-1)}${S} .cs-artifact-preview:focus-within{border-color:var(--vk-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--vk-accent) 16%,transparent)}
${S} .cs-media-selection{padding:var(--vk-gap-md);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md)}${S} .cs-media-selection legend{padding:0 5px;color:var(--vk-text-secondary);font-size:var(--vk-font-small);font-weight:650}${S} .cs-media-timeline{position:relative;display:grid;gap:var(--vk-gap-sm);padding-top:12px}${S} [data-creator-artifact-range-preview]{position:relative;height:8px;overflow:hidden;border-radius:999px;background:var(--vk-bg-layer-2)}${S} [data-creator-artifact-range-preview]::after{content:'';position:absolute;left:var(--range-start);width:var(--range-width);inset-block:0;background:var(--vk-accent)}${S} .cs-media-timeline label{display:grid;grid-template-columns:minmax(72px,auto) minmax(0,1fr);align-items:center;gap:var(--vk-gap-sm);font-size:var(--vk-font-small)}${S} .cs-media-timeline input[type='range']{min-height:44px;padding:0;border:0;background:transparent}${S} .cs-media-timeline output,${S} .cs-media-selection>output{color:var(--vk-text-secondary);font-variant-numeric:tabular-nums}${S} [data-dsh-media-image-selection-stage]:focus-visible,${S} [data-dsh-media-play-selection]:focus-visible{outline:2px solid var(--vk-accent);outline-offset:2px}
${S} .cs-empty{display:grid;place-items:center;gap:6px;min-height:92px;padding:16px;text-align:center;color:var(--vk-text-tertiary)}
${S} .cs-alert{padding:10px;border-radius:var(--vk-radius-md);color:color-mix(in srgb,var(--vk-state-error) 80%,#fff);background:color-mix(in srgb,var(--vk-state-error) 12%,transparent);border:1px solid color-mix(in srgb,var(--vk-state-error) 25%,transparent)}${S} .cs-disabled-reason{margin:0;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
@container yeisme-surface (max-width:720px){${S} .cs-quick-grid{grid-template-columns:repeat(2,minmax(140px,1fr))}${S} .cs-stage-track{grid-template-columns:repeat(3,minmax(96px,1fr))}${S} .cs-workspace-grid{grid-template-columns:1fr}${S} .cs-composer{position:static}}
@container yeisme-surface (max-width:420px){${S} .cs-body{padding:10px}${S} .cs-quick-grid,${S} .cs-stage-track{grid-template-columns:1fr}${S} .cs-resource-grid{grid-template-columns:1fr}${S} .cs-diff{grid-template-columns:1fr}${S} .cs-owner-status-panel[open]{position:relative;top:auto;right:auto;width:100%}${S} .cs-lifecycle{gap:8px}${S} .cs-media-timeline label{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){${S} *,${S} *::before,${S} *::after{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important}}
`

/** 统一面板样式 + Creator Studio 自有扩展；同参数输出逐字节幂等。 */
export const creatorStudioStyles = buildPanelStyles({
  scope: 'creator-studio',
  accentFallback: '#9bcbff',
  extra: creatorStudioExtra,
})
