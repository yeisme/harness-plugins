import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'

/**
 * 渠道市场样式（dsh-unified-panel-visual-system adopted 档）。
 * token fallback 单点来自 visual kit registry；全部选择器限定
 * `[data-provider-presets]` scope；容器宽度自适应用 auto-fill 网格而非媒体查询
 * （嵌在官方 Settings 页内，不拥有 viewport）。
 */
const S = '[data-provider-presets]'

const providerPresetsExtra = `
${S} .pp-section{display:grid;gap:10px}
${S} .pp-heading{display:grid;gap:2px}
${S} .pp-title{margin:0;font-size:var(--vk-font-heading);font-weight:650;color:var(--vk-text-primary)}
${S} .pp-description{margin:0;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .pp-overview{display:grid;gap:4px;margin:0;padding:0;list-style:none}
${S} .pp-row{display:flex;align-items:center;gap:8px;min-height:34px;padding:4px 10px;border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-sm);background:var(--vk-bg-layer-1)}
${S} .pp-row-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--vk-text-primary);font-size:var(--vk-font-body)}
${S} .pp-row-route{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--vk-text-tertiary);font-size:var(--vk-font-micro)}
${S} .pp-row-main{flex:1;min-width:0;display:grid;gap:1px}
${S} .pp-badge{display:inline-flex;align-items:center;min-height:20px;padding:0 8px;border-radius:999px;border:1px solid var(--vk-border-l2);color:var(--vk-text-secondary);font-size:var(--vk-font-micro);background:var(--vk-bg-layer-2);white-space:nowrap}
${S} .pp-badge[data-tone="positive"]{color:color-mix(in srgb,var(--vk-state-positive) 85%,#fff);border-color:color-mix(in srgb,var(--vk-state-positive) 32%,transparent)}
${S} .pp-badge[data-tone="warn"]{color:color-mix(in srgb,var(--vk-state-warn) 85%,#fff);border-color:color-mix(in srgb,var(--vk-state-warn) 32%,transparent)}
${S} .pp-badge[data-tone="accent"]{color:color-mix(in srgb,var(--vk-accent) 88%,#fff);border-color:color-mix(in srgb,var(--vk-accent) 40%,transparent)}
${S} .pp-row-actions{display:flex;gap:6px;flex-shrink:0}
${S} .pp-action{min-height:var(--vk-ctrl-button);padding:0 10px;font-size:var(--vk-font-small);color:var(--vk-text-secondary);background:transparent;border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md);cursor:pointer}
${S} .pp-action:hover:not(:disabled),${S} .pp-action:focus-visible{color:var(--vk-text-primary);background:var(--vk-fill-hover)}
${S} .pp-action:disabled{opacity:.46;cursor:not-allowed}
${S} .pp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;margin:0;padding:0;list-style:none}
${S} .pp-card{display:grid;gap:6px;align-content:start;text-align:left;padding:12px;min-height:96px;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-lg);color:inherit;font:inherit;cursor:pointer}
${S} .pp-card:hover:not(:disabled),${S} .pp-card:focus-visible{background:var(--vk-fill-hover);border-color:var(--vk-border-l2)}
${S} .pp-card:focus-visible{outline:2px solid var(--vk-border-focus);outline-offset:1px}
${S} .pp-card:disabled{opacity:.46;cursor:not-allowed}
${S} .pp-card-name{margin:0;font-size:var(--vk-font-strong);font-weight:600;color:var(--vk-text-primary)}
${S} .pp-card-meta{display:flex;flex-wrap:wrap;gap:4px}
${S} .pp-card-note{margin:0;color:var(--vk-text-tertiary);font-size:var(--vk-font-micro);line-height:1.5}
${S} .pp-strip{margin:0;padding:8px 10px;border-radius:var(--vk-radius-md);font-size:var(--vk-font-small)}
${S} .pp-strip[data-tone="error"]{color:color-mix(in srgb,var(--vk-state-error) 85%,#fff);background:color-mix(in srgb,var(--vk-state-error) 12%,transparent);border:1px solid color-mix(in srgb,var(--vk-state-error) 28%,transparent)}
${S} .pp-strip[data-tone="success"]{color:color-mix(in srgb,var(--vk-state-positive) 85%,#fff);background:color-mix(in srgb,var(--vk-state-positive) 12%,transparent);border:1px solid color-mix(in srgb,var(--vk-state-positive) 28%,transparent)}
${S} .pp-strip[data-tone="warn"]{color:color-mix(in srgb,var(--vk-state-warn) 85%,#fff);background:color-mix(in srgb,var(--vk-state-warn) 12%,transparent);border:1px solid color-mix(in srgb,var(--vk-state-warn) 28%,transparent)}
${S} .pp-dialog-body{display:grid;gap:12px;padding:14px 16px;overflow-y:auto;max-height:calc(100vh - 200px)}
${S} .pp-form{display:grid;gap:10px}
${S} .pp-field{display:grid;gap:4px}
${S} .pp-field>label{color:var(--vk-text-secondary);font-size:var(--vk-font-small)}
${S} .pp-field>input,${S} .pp-field>select{min-height:var(--vk-ctrl-input);padding:6px 9px;color:var(--vk-text-primary);background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md);font:inherit;font-size:var(--vk-font-body)}
${S} .pp-hint{margin:0;color:var(--vk-text-tertiary);font-size:var(--vk-font-micro)}
${S} .pp-models{display:grid;gap:6px}
${S} .pp-models-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
${S} .pp-models-head>strong{color:var(--vk-text-secondary);font-size:var(--vk-font-small);font-weight:600}
${S} .pp-models-meta{color:var(--vk-text-tertiary);font-size:var(--vk-font-micro)}
${S} .pp-model-list{display:grid;gap:4px;margin:0;padding:0;list-style:none;max-height:220px;overflow-y:auto;border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md);padding:6px}
${S} .pp-model-item{display:flex;align-items:center;gap:8px;min-height:30px;padding:2px 6px;border-radius:var(--vk-radius-sm);color:var(--vk-text-primary);font-size:var(--vk-font-small)}
${S} .pp-model-item:hover{background:var(--vk-fill-hover)}
${S} .pp-model-item label{flex:1;min-width:0;display:flex;align-items:center;gap:8px;cursor:pointer}
${S} .pp-model-id{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${S} .pp-model-cap{color:var(--vk-text-quaternary);font-size:var(--vk-font-micro);flex-shrink:0}
${S} .pp-manual-entry{display:flex;gap:6px}
${S} .pp-manual-entry input{flex:1;min-width:0;min-height:var(--vk-ctrl-input);padding:6px 9px;color:var(--vk-text-primary);background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md);font:inherit;font-size:var(--vk-font-small)}
${S} .pp-check{display:flex;align-items:center;gap:8px;min-height:30px;color:var(--vk-text-secondary);font-size:var(--vk-font-small);cursor:pointer}
${S} .pp-default-model{display:grid;gap:4px}
${S} .pp-default-model select{min-height:var(--vk-ctrl-input);padding:6px 9px;color:var(--vk-text-primary);background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md);font:inherit;font-size:var(--vk-font-small)}
${S} .pp-dialog-actions{display:flex;justify-content:flex-end;gap:8px}
${S} .pp-dialog-actions button{min-height:var(--vk-ctrl-button);padding:0 12px;font-size:var(--vk-font-small);color:var(--vk-text-secondary);background:transparent;border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md);cursor:pointer}
${S} .pp-dialog-actions button:hover:not(:disabled){color:var(--vk-text-primary);background:var(--vk-fill-hover)}
${S} .pp-dialog-actions button.primary{color:#eef7ff;background:color-mix(in srgb,var(--vk-accent) 28%,transparent);border-color:color-mix(in srgb,var(--vk-accent) 62%,transparent)}
${S} .pp-dialog-actions button:disabled{opacity:.46;cursor:not-allowed}
`

/** 渠道市场样式串：token fallback 单点来自 visual kit registry。 */
export const providerPresetsStyles = buildPanelStyles({
  scope: 'provider-presets',
  extra: providerPresetsExtra,
})
