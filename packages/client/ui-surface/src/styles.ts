import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'

const S = '[data-yeisme-surface]'

const surfaceExtra = `
${S}.ys-surface{container:yeisme-surface/inline-size;display:flex;flex-direction:column;width:100%;min-width:0;min-height:100%;overflow:hidden;background:var(--vk-bg-base);color:var(--vk-text-primary);font:inherit}
${S} .ys-context-bar{position:sticky;top:0;z-index:3;display:grid;grid-template-columns:minmax(0,1fr) auto auto;grid-template-areas:'copy status actions' 'nav nav nav';align-items:center;gap:8px 10px;min-width:0;padding:10px 12px;background:color-mix(in srgb,var(--vk-bg-layer-1) 96%,transparent);border-bottom:1px solid var(--vk-border-l2);backdrop-filter:blur(12px)}
${S} .ys-context-copy{grid-area:copy;display:grid;gap:2px;min-width:0}
${S} .ys-context-title{margin:0;overflow:hidden;color:var(--vk-text-primary);font-size:var(--vk-font-heading);font-weight:650;text-overflow:ellipsis;white-space:nowrap}
${S} .ys-context-value{overflow:hidden;color:var(--vk-text-secondary);font-size:var(--vk-font-body);text-overflow:ellipsis;white-space:nowrap}
${S} .ys-context-description{overflow:hidden;color:var(--vk-text-tertiary);font-size:var(--vk-font-small);text-overflow:ellipsis;white-space:nowrap}
${S} .ys-context-status{grid-area:status;display:flex;align-items:center;gap:6px;min-width:0;color:var(--vk-text-secondary);font-size:var(--vk-font-small)}
${S} .ys-context-actions{grid-area:actions;display:flex;align-items:center;justify-content:flex-end;gap:6px;min-width:0}
${S} .ys-context-nav{grid-area:nav;display:flex;align-items:center;gap:6px;min-width:0;overflow-x:auto;scrollbar-width:thin}
${S} .ys-body{display:grid;align-content:start;gap:14px;min-width:0;min-height:0;padding:14px;overflow:auto}
${S} .ys-section{display:grid;gap:10px;min-width:0}
${S} .ys-section-header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;min-width:0}
${S} .ys-section-copy{display:grid;gap:2px;min-width:0}
${S} .ys-section-title{margin:0;color:var(--vk-text-primary);font-size:var(--vk-font-strong);font-weight:650}
${S} .ys-section-description{margin:0;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .ys-section-meta{display:flex;align-items:center;gap:6px;min-width:0;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .ys-state{display:grid;place-items:center;gap:8px;min-width:0;min-height:116px;padding:20px;text-align:center;color:var(--vk-text-tertiary);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-lg);background:var(--vk-bg-layer-1)}
${S} .ys-state[data-phase='stale'],${S} .ys-state[data-phase='partial']{color:var(--vk-text-secondary);border-color:color-mix(in srgb,var(--vk-tone-warn) 32%,var(--vk-border-l1));background:color-mix(in srgb,var(--vk-tone-warn) 7%,var(--vk-bg-layer-1))}
${S} .ys-state[data-phase='error']{color:var(--vk-text-secondary);border-color:color-mix(in srgb,var(--vk-tone-critical) 34%,var(--vk-border-l1));background:color-mix(in srgb,var(--vk-tone-critical) 7%,var(--vk-bg-layer-1))}
${S} .ys-state[data-phase='success']{color:var(--vk-text-secondary);border-color:color-mix(in srgb,var(--vk-tone-positive) 30%,var(--vk-border-l1));background:color-mix(in srgb,var(--vk-tone-positive) 6%,var(--vk-bg-layer-1))}
${S} .ys-state-title{margin:0;color:var(--vk-text-primary);font-size:var(--vk-font-strong);font-weight:650}
${S} .ys-state-description{max-width:58ch;margin:0;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .ys-state-action{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:2px}
${S} .ys-action-bar{display:flex;align-items:center;justify-content:flex-end;gap:6px;min-width:0;padding:9px 12px;border-top:1px solid var(--vk-border-l1);background:var(--vk-bg-layer-1)}
${S} .ys-action-bar[data-sticky='true']{position:sticky;bottom:0;z-index:2}
${S} .ys-field{display:grid;gap:5px;min-width:0;color:var(--vk-text-secondary);font-size:var(--vk-font-small)}
${S} .ys-field>span,${S} .ys-field>legend{font-weight:650}
${S} .ys-field>select,${S} .ys-field>textarea{box-sizing:border-box;width:100%;min-height:var(--vk-ctrl-input);padding:7px 9px;color:var(--vk-text-primary);background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md);font:inherit}
${S} .ys-field>textarea{min-height:78px;resize:vertical}
${S} .ys-list{display:grid;gap:4px;min-width:0;margin:0;padding:0;list-style:none}
${S} .ys-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px;min-width:0;min-height:38px;padding:7px 9px;border-radius:var(--vk-radius-md)}
${S} .ys-row:hover{background:var(--vk-fill-hover)}
${S} .ys-row-main{display:grid;gap:2px;min-width:0}
${S} .ys-row-main>strong,${S} .ys-row-main>span,${S} .ys-row-main>small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${S} .ys-row-main>small{color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .ys-row-actions{display:flex;align-items:center;justify-content:flex-end;gap:4px;min-width:0}
${S} .ys-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;min-width:0}
${S}[data-surface-kind='navigator'] .ys-body{gap:10px;padding:10px}
${S}[data-surface-kind='navigator'] .ys-section{gap:6px}
${S}[data-surface-kind='micro']{display:inline-flex;width:auto;min-height:0;overflow:visible;background:transparent}
${S}[data-surface-kind='micro'] .ys-body{display:flex;gap:6px;padding:0;overflow:visible}
@container yeisme-surface (max-width:720px){
  ${S} .ys-context-bar{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:'copy actions' 'status status' 'nav nav'}
  ${S} .ys-grid{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
}
@container yeisme-surface (max-width:420px){
  ${S} .ys-context-bar{position:relative;grid-template-columns:minmax(0,1fr);grid-template-areas:'copy' 'status' 'actions' 'nav';padding:9px 10px}
  ${S} .ys-context-actions{justify-content:flex-start;overflow-x:auto}
  ${S} .ys-body{gap:10px;padding:10px}
  ${S} .ys-section-header{display:grid;gap:5px}
  ${S} .ys-section-meta{justify-content:flex-start}
  ${S} .ys-grid{grid-template-columns:1fr}
  ${S} .ys-action-bar{flex-wrap:wrap;justify-content:stretch}
  ${S} .ys-action-bar>*{flex:1 1 auto}
}
@media(pointer:coarse){${S} .ys-context-actions button,${S} .ys-context-nav button,${S} .ys-action-bar button,${S} .ys-field>select{min-height:44px}}
`

export const surfaceStyles = buildPanelStyles({
  scope: 'yeisme-surface',
  extra: surfaceExtra,
})
