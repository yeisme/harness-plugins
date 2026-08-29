import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'

const S = '[data-mcp-inspector]'

const mcpInspectorExtra = `
${S}{display:flex;flex-direction:column;align-content:flex-start;container-type:inline-size;min-height:100%;height:auto;overflow:visible;--vk-font-small:12px;--vk-font-body:13px;--vk-font-strong:14px;--vk-font-heading:15px;--vk-ctrl-button:32px;--vk-ctrl-input:36px}
${S} .visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
${S} .tools-header{display:grid;grid-template-columns:minmax(180px,auto) minmax(0,1fr) auto;gap:12px;padding:10px 14px}
${S} .tools-title{display:flex;align-items:center;gap:10px;min-width:0}
${S} .tools-title .vk-sub{display:flex;align-items:center;gap:6px;margin:0}
${S} .tools-summary{display:flex;align-items:center;justify-content:flex-end;gap:7px;min-width:0;overflow:hidden;color:var(--vk-text-tertiary);font-size:var(--vk-font-small);font-variant-numeric:tabular-nums;white-space:nowrap}
${S} .tools-summary span{padding-left:7px;border-left:1px solid var(--vk-border-l1)}
${S} .tools-summary span[data-tone='critical']{color:var(--vk-state-error)}
${S} .tools-summary span[data-tone='info']{color:var(--vk-state-info)}
${S} .tools-recheck{white-space:nowrap}
${S} .tools-notice{margin:0;padding:7px 14px;border-bottom:1px solid var(--vk-border-l1);font-size:var(--vk-font-small)}
${S} .tools-notice[data-tone='positive']{color:var(--vk-state-positive)}
${S} .tools-notice[data-tone='warn']{color:var(--vk-state-warn)}
${S} .tools-notice[data-tone='critical']{color:var(--vk-state-error)}
${S} .tools-coverage{display:flex;min-height:32px;margin:10px 10px 0;overflow:hidden;border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md);background:var(--vk-bg-layer-1)}
${S} .tools-coverage button{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:88px;padding:0 10px;border:0;border-right:1px solid var(--vk-border-l1);color:var(--vk-text-secondary);background:transparent;cursor:pointer;font-size:var(--vk-font-small)}
${S} .tools-coverage button:last-child{border-right:0}
${S} .tools-coverage button:hover,${S} .tools-coverage button[aria-pressed='true']{color:var(--vk-text-primary);background:var(--vk-fill-hover)}
${S} .tools-coverage button[data-state='enabled'] strong{color:var(--vk-state-positive)}
${S} .tools-coverage button[data-state='disabled'] strong{color:var(--vk-state-neutral)}
${S} .tools-coverage button[data-state='unavailable'] strong{color:var(--vk-state-error)}
${S} .tools-mobile-tabs{display:none}
${S} .tools-workspace{display:grid;grid-template-columns:minmax(0,58fr) minmax(320px,42fr);align-items:start;gap:10px;padding:10px}
${S} .tools-pane,${S} .tools-right-column{min-width:0;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-lg)}
${S} .tools-pane{display:grid;align-content:start;gap:10px;padding:10px}
${S} .tools-right-column{overflow:hidden}
${S} .tools-right-column>.tools-pane{border:0;border-radius:0;background:transparent}
${S} .tools-pane-header{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0}
${S} .tools-pane-header>div{min-width:0}
${S} .tools-pane-header h2{margin:0;color:var(--vk-text-primary);font-size:var(--vk-font-heading);font-weight:650}
${S} .tools-pane-header p{margin:2px 0 0;color:var(--vk-text-tertiary);font-size:var(--vk-font-small);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${S} .tools-search{width:min(320px,48%);min-width:180px}
${S} .tools-filter-row{display:flex;align-items:end;justify-content:space-between;gap:10px}
${S} .tools-family-tabs,${S} .tools-compact-controls,${S} .tools-right-tabs{display:flex;align-items:center;gap:4px;min-width:0}
${S} .tools-chip,${S} .tools-mobile-tabs button,${S} .tools-right-tabs button{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:var(--vk-ctrl-button);padding:0 9px;color:var(--vk-text-secondary);background:transparent;border:1px solid transparent;border-radius:var(--vk-radius-md);cursor:pointer;font-size:var(--vk-font-small);white-space:nowrap}
${S} .tools-chip span{color:var(--vk-text-quaternary);font-variant-numeric:tabular-nums}
${S} .tools-chip:hover,${S} .tools-chip[aria-pressed='true'],${S} .tools-mobile-tabs button[aria-pressed='true'],${S} .tools-right-tabs button[aria-pressed='true']{color:var(--vk-text-primary);background:var(--vk-fill-selected);border-color:var(--vk-border-l1)}
${S} .tools-chip:disabled,${S} .tools-mobile-tabs button:disabled,${S} .tools-right-tabs button:disabled{cursor:not-allowed;color:var(--vk-text-quaternary)}
${S} .tools-state-filter{display:grid;gap:4px;min-width:118px;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .tools-state-filter select{min-height:var(--vk-ctrl-input);padding:5px 8px;color:var(--vk-text-primary);background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md)}
${S} .tools-skeleton-list{display:grid;gap:6px}
${S} .tools-skeleton-list .vk-skeleton{min-height:58px}
${S} .tools-catalog-alert p{margin:0;color:var(--vk-text-secondary)}
${S} .tools-catalog-alert>div{display:flex;align-items:center;gap:10px}
${S} .tools-catalog-alert details{color:var(--vk-text-tertiary)}
${S} .tools-catalog-alert summary{cursor:pointer}
${S} .tools-catalog-alert code{display:block;margin-top:6px;color:var(--vk-text-secondary)}
${S} .tools-catalog-list{display:grid;border-top:1px solid var(--vk-border-l1)}
${S} .tools-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:9px;min-width:0;padding:8px 4px;border-bottom:1px solid var(--vk-border-l1)}
${S} .tools-row[data-selected='true']{background:var(--vk-fill-selected)}
${S} .tools-row-main{display:grid;gap:2px;min-width:0;padding:2px 4px;text-align:left;background:transparent;border:0;border-radius:var(--vk-radius-sm);cursor:pointer}
${S} .tools-row-main:hover .tools-row-title strong{text-decoration:underline;text-decoration-color:var(--vk-text-quaternary);text-underline-offset:3px}
${S} .tools-row-title{display:flex;align-items:center;gap:7px;min-width:0}
${S} .tools-row-title strong{overflow:hidden;color:var(--vk-text-primary);font-size:var(--vk-font-body);text-overflow:ellipsis;white-space:nowrap}
${S} .tools-availability{color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .tools-row-description,${S} .tools-row-meta{overflow:hidden;color:var(--vk-text-tertiary);font-size:var(--vk-font-small);text-overflow:ellipsis;white-space:nowrap}
${S} .tools-row-meta{color:var(--vk-text-quaternary)}
${S} .tools-toggle{min-width:58px}
${S} .tools-health{display:inline-flex;align-items:center;gap:6px;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .tools-health .vk-dot{width:7px;height:7px}
${S} .tools-right-tabs{padding:6px 8px;border-bottom:1px solid var(--vk-border-l1)}
${S} .tools-activity-filter{justify-content:flex-start}
${S} .tools-activity-list,${S} .tools-timeline{display:grid;gap:0;margin:0;padding:0;list-style:none}
${S} .tools-activity-row{display:grid;grid-template-columns:auto minmax(0,1fr) 60px auto;align-items:center;gap:8px;min-width:0;padding:8px 4px;border-bottom:1px solid var(--vk-border-l1);font-size:var(--vk-font-small)}
${S} .tools-record-name{min-width:0;overflow:hidden;color:var(--vk-text-primary);text-overflow:ellipsis;white-space:nowrap}
${S} .tools-activity-row time{color:var(--vk-text-quaternary);font-variant-numeric:tabular-nums}
${S} .tools-record-status{color:var(--vk-text-tertiary);white-space:nowrap}
${S} .tools-timeline-row{display:grid;grid-template-columns:minmax(100px,34%) minmax(100px,1fr) auto;align-items:center;gap:8px;padding:8px 4px;border-bottom:1px solid var(--vk-border-l1);font-size:var(--vk-font-small)}
${S} .tools-timeline-track{position:relative;height:12px;overflow:hidden;background:var(--vk-bg-layer-2);border-radius:999px}
${S} .tools-timeline-track>i{position:absolute;top:2px;bottom:2px;left:var(--tool-left);width:var(--tool-width);min-width:3px;border-radius:999px;background:var(--vk-state-neutral)}
${S} .tools-timeline-track>i[data-tone='positive']{background:var(--vk-state-positive)}
${S} .tools-timeline-track>i[data-tone='info']{background:var(--vk-state-info)}
${S} .tools-timeline-track>i[data-tone='critical']{background:var(--vk-state-error)}
${S} .tools-details-body{display:grid;gap:10px}
${S} .tools-details-body>p{margin:0;color:var(--vk-text-tertiary)}
${S} .tools-detail-title{display:flex;align-items:center;gap:8px}
${S} .tools-detail-title strong{font-size:var(--vk-font-heading)}
${S} .tools-details-body dl{display:grid;gap:0;margin:0;border-top:1px solid var(--vk-border-l1)}
${S} .tools-details-body dl>div{display:grid;grid-template-columns:130px minmax(0,1fr);gap:8px;padding:8px 0;border-bottom:1px solid var(--vk-border-l1)}
${S} .tools-details-body dt{color:var(--vk-text-tertiary)}
${S} .tools-details-body dd{min-width:0;margin:0;color:var(--vk-text-primary);overflow-wrap:anywhere}
${S} .tools-reason{padding:8px;color:var(--vk-state-warn)!important;background:color-mix(in srgb,var(--vk-state-warn) 10%,transparent);border-radius:var(--vk-radius-md)}
${S} .tools-scope-note{padding-top:8px;border-top:1px solid var(--vk-border-l1);font-size:var(--vk-font-small)}
${S} .tools-empty{min-height:120px;padding:20px}
${S} .tools-empty p,${S} .tools-empty small{margin:0}

@container(max-width:1099px){
${S} .tools-header{grid-template-columns:minmax(0,1fr) auto}
${S} .tools-summary{grid-column:1/-1;grid-row:2;justify-content:flex-start;overflow:auto}
${S} .tools-mobile-tabs{display:flex;gap:4px;margin:10px 10px 0;padding:4px;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md)}
${S} .tools-mobile-tabs button{flex:1}
${S} .tools-workspace{display:block}
${S} .tools-catalog-pane,${S} .tools-right-column{display:none}
${S} .tools-workspace[data-active-section='catalog'] .tools-catalog-pane{display:grid}
${S} .tools-workspace[data-active-section='activity'] .tools-right-column,${S} .tools-workspace[data-active-section='details'] .tools-right-column{display:block}
${S} .tools-right-tabs{display:none}
}

@container(max-width:699px){
${S} .tools-header{position:static;grid-template-columns:minmax(0,1fr);padding:10px}
${S} .tools-recheck{grid-row:1;grid-column:1;justify-self:end}
${S} .tools-title{grid-row:1;grid-column:1;padding-right:90px}
${S} .tools-summary{grid-row:2;grid-column:1;flex-wrap:wrap;overflow:visible;white-space:normal}
${S} .tools-coverage{overflow:auto}
${S} .tools-coverage button{min-width:104px}
${S} .tools-workspace{padding:8px}
${S} .tools-pane{padding:9px}
${S} .tools-pane-header{align-items:stretch;flex-direction:column}
${S} .tools-search{width:100%;min-width:0}
${S} .tools-filter-row{align-items:stretch;flex-direction:column}
${S} .tools-family-tabs{overflow:auto;padding-bottom:2px}
${S} .tools-state-filter{grid-template-columns:auto minmax(0,1fr);align-items:center}
${S} .tools-row{grid-template-columns:auto minmax(0,1fr)}
${S} .tools-toggle{grid-column:2;justify-self:start}
${S} .tools-activity-row{grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"dot name time" ". status status"}
${S} .tools-activity-row>.vk-dot{grid-area:dot}
${S} .tools-activity-row>.tools-record-name{grid-area:name}
${S} .tools-activity-row>time{grid-area:time}
${S} .tools-activity-row>.tools-record-status{grid-area:status}
${S} .tools-timeline-row{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"name status" "track track"}
${S} .tools-timeline-row>.tools-record-name{grid-area:name}
${S} .tools-timeline-row>.tools-record-status{grid-area:status}
${S} .tools-timeline-track{grid-area:track}
${S} .tools-details-body dl>div{grid-template-columns:1fr}
}

@media(pointer:coarse){
${S} .tools-chip,${S} .tools-mobile-tabs button,${S} .tools-right-tabs button,${S} .tools-row-main,${S} .tools-state-filter select{min-height:44px}
}

@media(prefers-reduced-motion:reduce){
${S} .tools-timeline-track>i{transition:none}
}
`

export const mcpInspectorStyles = buildPanelStyles({ scope: 'mcp-inspector', extra: mcpInspectorExtra })
