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
${S}{min-height:100%}
${S}.cs-shell{display:flex;min-height:100%}
${S} .cs-header{backdrop-filter:blur(14px)}
${S} .cs-actions,${S} .cs-badges,${S} .cs-metrics{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
${S} .cs-button{min-height:30px}
${S} .cs-button:disabled{opacity:.46;cursor:not-allowed}
${S} .cs-lifecycle{display:flex;align-items:flex-end;gap:12px;min-width:max-content}
${S} .cs-lifecycle-group{display:grid;gap:3px}${S} .cs-lifecycle-group>span{padding-left:2px;color:var(--vk-text-tertiary);font-size:9px;font-weight:650;letter-spacing:.04em;text-transform:uppercase}${S} .cs-lifecycle-items{display:flex;gap:4px}${S} .cs-lifecycle-items>span[data-active='true']{color:var(--vk-accent)}
${S} .cs-owner-status-panel{position:relative;min-width:150px}${S} .cs-owner-status-panel>summary{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:30px;padding:0 8px;border:1px solid var(--vk-border-l2);border-radius:8px;cursor:pointer;list-style:none}${S} .cs-owner-status-panel>summary::-webkit-details-marker{display:none}${S} .cs-owner-status-panel>summary strong{color:var(--vk-text-primary);font-size:10px}${S} .cs-owner-status-panel>p{margin:8px 0;color:var(--vk-text-tertiary);font-size:10px}${S} .cs-owner-status-panel[open]{position:absolute;z-index:6;top:8px;right:78px;width:min(420px,calc(100cqi - 20px));padding:8px;background:var(--vk-bg-elevated);border:1px solid var(--vk-border-l2);border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.28)}
${S} .cs-state-strip{min-height:0;margin:8px 12px 0;padding:8px 10px;place-items:start;text-align:left}
${S} .cs-body{display:grid;gap:14px;padding:14px;min-width:0}
${S} .cs-section{display:grid;gap:10px;min-width:0}${S} .cs-section>header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}${S} .cs-section h2,${S} .cs-section h3{margin:0}${S} .cs-section h2{font-size:16px}${S} .cs-section h3{font-size:13px}${S} .cs-muted{margin:0;color:var(--vk-text-tertiary)}
${S} .cs-quick-grid{display:grid;grid-template-columns:repeat(4,minmax(128px,1fr));gap:8px}
${S} .cs-quick-card,${S} .cs-card,${S} .cs-composer,${S} .cs-pulse,${S} .cs-status-panel{display:grid;gap:8px;padding:12px;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l2);border-radius:11px}
${S} .cs-quick-card{min-height:116px;text-align:left;cursor:pointer}${S} .cs-quick-card:hover{background:var(--vk-bg-elevated);border-color:color-mix(in srgb,var(--vk-accent) 45%,transparent)}${S} .cs-quick-card strong{font-size:14px}${S} .cs-quick-card span{color:var(--vk-text-tertiary);font-size:11px}${S} .cs-quick-card b{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:color-mix(in srgb,var(--vk-accent) 20%,transparent);color:var(--vk-accent)}
${S} .cs-owner-list{display:grid;gap:1px}${S} .cs-owner-row{background:transparent;border-bottom:1px solid var(--vk-border-l1);border-radius:0}${S} .cs-owner-row:last-child{border-bottom:0}${S} .cs-owner-row strong{font-size:12px}${S} .cs-owner-row small{display:block;overflow:hidden;color:var(--vk-text-tertiary);text-overflow:ellipsis;white-space:nowrap}
${S} .cs-status-dot{width:9px;height:9px;border-radius:50%;background:var(--vk-state-neutral)}${S} .cs-status-dot[data-status='ready'],${S} .cs-status-dot[data-status='completed']{background:var(--vk-state-positive)}${S} .cs-status-dot[data-status='running']{background:var(--vk-state-info)}${S} .cs-status-dot[data-status='partial'],${S} .cs-status-dot[data-status='stale'],${S} .cs-status-dot[data-status='approval_required']{background:var(--vk-state-warn)}${S} .cs-status-dot[data-status='offline'],${S} .cs-status-dot[data-status='failed'],${S} .cs-status-dot[data-status='contract_mismatch'],${S} .cs-status-dot[data-status='reconcile_required'],${S} .cs-status-dot[data-status='unknown']{background:var(--vk-state-error)}
${S} .cs-stage-track{display:grid;grid-template-columns:repeat(6,minmax(88px,1fr));gap:6px}${S} .cs-stage{position:relative;display:grid;gap:5px;padding:9px;border-radius:9px;background:var(--vk-bg-layer-2);border:1px solid transparent}${S} .cs-stage[data-current='true']{border-color:var(--vk-accent)}${S} .cs-stage small{color:var(--vk-text-tertiary)}
${S} .cs-progress{height:4px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.08)}${S} .cs-progress>i{display:block;height:100%;background:var(--vk-accent);border-radius:inherit}
${S} .cs-resource-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}${S} .cs-card{align-content:start;min-height:128px}${S} .cs-card[data-kind='image'],${S} .cs-card[data-kind='video'],${S} .cs-card[data-kind='shot']{min-height:164px}${S} .cs-card-preview{display:grid;place-items:center;min-height:70px;border-radius:8px;background:color-mix(in srgb,var(--vk-accent) 9%,var(--vk-bg-layer-2));color:var(--vk-text-tertiary);font-size:22px}${S} .cs-card h3{font-size:13px}${S} .cs-card p{margin:0;color:var(--vk-text-secondary);font-size:11px}${S} .cs-badge,${S} .cs-metric{display:inline-flex;align-items:center;min-height:20px;padding:0 7px;border-radius:999px;background:rgba(255,255,255,.07);color:var(--vk-text-secondary);font-size:10px}${S} .cs-metric[data-tone='positive']{color:var(--vk-state-positive)}${S} .cs-metric[data-tone='warning']{color:var(--vk-state-warn)}${S} .cs-metric[data-tone='critical']{color:var(--vk-state-error)}
${S} .cs-waveform{height:52px;display:flex;align-items:center;gap:2px;padding:6px;border-radius:8px;background:rgba(0,0,0,.16)}${S} .cs-waveform i{flex:1;min-width:2px;background:var(--vk-accent);border-radius:2px}
${S} .cs-diff{display:grid;grid-template-columns:1fr 1fr;gap:6px}${S} .cs-diff pre{min-height:70px;margin:0;padding:8px;overflow:auto;white-space:pre-wrap;border-radius:7px;background:rgba(0,0,0,.16);color:var(--vk-text-secondary);font:11px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace}${S} .cs-diff pre[data-side='after']{background:color-mix(in srgb,var(--vk-state-positive) 12%,transparent)}
${S} .cs-workspace-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.36fr);gap:12px;align-items:start}${S} .cs-composer{position:sticky;top:112px}${S} .cs-field{display:grid;gap:5px}${S} .cs-field>span{font-size:11px;font-weight:650}${S} .cs-field input,${S} .cs-field textarea,${S} .cs-field select{width:100%;min-height:34px;padding:7px 9px;color:inherit;background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:8px}${S} .cs-field textarea{min-height:84px;resize:vertical}${S} .cs-confirm{display:flex;gap:8px;align-items:flex-start;color:var(--vk-text-secondary);font-size:11px}${S} .cs-receipt{padding:9px;border-radius:8px;background:color-mix(in srgb,var(--vk-accent) 11%,transparent);border:1px solid color-mix(in srgb,var(--vk-accent) 20%,transparent)}${S} .cs-receipt[data-status='unknown'],${S} .cs-receipt[data-status='reconcile_required'],${S} .cs-receipt[data-status='failed']{background:color-mix(in srgb,var(--vk-state-error) 10%,transparent);border-color:color-mix(in srgb,var(--vk-state-error) 28%,transparent)}
${S} .cs-list{display:grid;gap:6px;margin:0;padding:0;list-style:none}${S} .cs-list li{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:9px;align-items:center;padding:9px 10px;border-radius:8px;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l1)}${S} .cs-list strong{font-size:12px}${S} .cs-list small{display:block;color:var(--vk-text-tertiary)}
${S} .cs-empty{display:grid;place-items:center;gap:8px;min-height:150px;padding:24px;text-align:center;color:var(--vk-text-tertiary)}
${S} .cs-alert{padding:10px;border-radius:8px;color:color-mix(in srgb,var(--vk-state-error) 80%,#fff);background:color-mix(in srgb,var(--vk-state-error) 12%,transparent);border:1px solid color-mix(in srgb,var(--vk-state-error) 25%,transparent)}${S} .cs-disabled-reason{margin:0;color:var(--vk-text-tertiary);font-size:11px}
@container yeisme-surface (max-width:720px){${S} .cs-quick-grid{grid-template-columns:repeat(2,minmax(140px,1fr))}${S} .cs-stage-track{grid-template-columns:repeat(3,minmax(96px,1fr))}${S} .cs-workspace-grid{grid-template-columns:1fr}${S} .cs-composer{position:static}}
@container yeisme-surface (max-width:420px){${S} .cs-body{padding:10px}${S} .cs-quick-grid,${S} .cs-stage-track{grid-template-columns:1fr}${S} .cs-resource-grid{grid-template-columns:1fr}${S} .cs-diff{grid-template-columns:1fr}${S} .cs-owner-status-panel[open]{position:relative;top:auto;right:auto;width:100%}${S} .cs-lifecycle{gap:8px}}
`

/** 统一面板样式 + Creator Studio 自有扩展；同参数输出逐字节幂等。 */
export const creatorStudioStyles = buildPanelStyles({
  scope: 'creator-studio',
  accentFallback: '#9bcbff',
  extra: creatorStudioExtra,
})
