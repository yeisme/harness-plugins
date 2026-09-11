import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'

/** Explorer remains styled when rendered without the legacy region chrome. */
export const EXPLORER_STYLES = buildPanelStyles({ scope: 'explorer-tree', extra: `
[data-explorer-tree].pwr-explorer{position:relative;display:flex;flex-direction:column;min-height:0;height:100%;overflow:hidden;background:var(--vk-bg-base);color:var(--vk-text-secondary)}
[data-explorer-tree] .pwr-explorer-header{padding:var(--vk-gap-md);gap:var(--vk-gap-md);border-bottom:1px solid var(--vk-border-l1)}
[data-explorer-tree] .ys-context-title{font-size:var(--vk-font-small);font-weight:500;color:var(--vk-text-tertiary)}
[data-explorer-tree] .ys-context-actions{flex:1;min-width:0}
[data-explorer-tree] .pwr-explorer-header-actions{display:flex;flex:1 1 auto;min-width:0;align-items:center;gap:var(--vk-gap-sm)}
[data-explorer-tree] .pwr-explorer-watch-pill{flex:none;padding:0 8px;height:var(--vk-ctrl-button);display:inline-flex;align-items:center;border:1px solid var(--vk-border-l1);border-radius:999px;color:var(--vk-text-tertiary);background:var(--vk-bg-layer-1);font-size:var(--vk-font-micro);font-weight:600;white-space:nowrap}
[data-explorer-tree] .pwr-explorer-watch-pill[data-file-watch='live']{color:var(--vk-state-success,var(--vk-text-link));border-color:color-mix(in srgb,var(--vk-state-success,var(--vk-text-link)) 45%,var(--vk-border-l1))}
[data-explorer-tree] .pwr-explorer-watch-pill[data-freshness='stale'],[data-explorer-tree] .pwr-explorer-watch-pill[data-freshness='reconcile_required'],[data-explorer-tree] .pwr-explorer-watch-pill[data-freshness='contract_mismatch']{color:var(--vk-state-warn,var(--vk-text-secondary))}
[data-explorer-tree] .pwr-explorer-refresh{flex:none}
[data-explorer-tree] .pwr-explorer-filter{width:100%;min-width:0;height:var(--vk-ctrl-button);min-height:var(--vk-ctrl-button);font-size:var(--vk-font-small);border-radius:var(--vk-radius-sm)}
[data-explorer-tree] .pwr-explorer-filter input{height:100%;min-height:0;font-size:var(--vk-font-small);padding:0 var(--vk-gap-md);border-radius:var(--vk-radius-sm)}
[data-explorer-tree] .pwr-explorer-resource-actions{flex:none;padding:var(--vk-gap-xs) var(--vk-gap-md);border-bottom:1px solid var(--vk-border-l1);background:var(--vk-bg-layer-1)}
[data-explorer-tree] .pwr-explorer-resource-actions>summary{cursor:pointer;font-size:var(--vk-font-small);padding:var(--vk-gap-xs);color:var(--vk-text-secondary)}
[data-explorer-tree] .pwr-explorer-resource-actions[open]{display:block}
[data-explorer-tree] .pwr-explorer-resource-actions button,[data-explorer-tree] .pwr-explorer-import{font-size:var(--vk-font-small);min-height:var(--vk-ctrl-icon);border-radius:var(--vk-radius-sm);background:transparent;padding:var(--vk-gap-xs) var(--vk-gap-md)}
[data-explorer-tree] .pwr-explorer-resource-actions button:hover:not(:disabled){background:var(--vk-fill-hover)}
[data-explorer-tree].pwr-explorer .pwr-explorer-tree{flex:1;min-height:0;display:block;padding:var(--vk-gap-xs);overflow:auto;scrollbar-width:thin;outline-offset:-2px}
[data-explorer-tree] .pwr-explorer-row{padding-block:0;border-radius:var(--vk-radius-sm);color:var(--vk-text-secondary);font-size:var(--vk-font-body)}
[data-explorer-tree] .pwr-explorer-row:hover,[data-explorer-tree] .pwr-explorer-row[aria-selected=true]{background:var(--vk-fill-hover)}
[data-explorer-tree] .pwr-explorer-row:focus-within{outline:1px solid var(--vk-border-focus);outline-offset:-1px}
[data-explorer-tree] .pwr-explorer-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
[data-explorer-tree] .pwr-explorer-twistie{width:12px;flex:none;color:var(--vk-text-tertiary)}
[data-explorer-tree] .pwr-explorer-row button{flex:none;min-height:0;height:var(--vk-ctrl-icon);padding:0 var(--vk-gap-sm);font-size:var(--vk-font-small);border-radius:var(--vk-radius-sm);background:transparent}
[data-explorer-tree] .pwr-explorer-row input[type=checkbox]{width:14px;height:14px;flex:none;margin:0;accent-color:var(--vk-accent)}
[data-explorer-tree] .pwr-explorer-row:not(:hover):not(:focus-within):not([aria-selected=true]):not([aria-checked=true]) :is(input[type=checkbox],.pwr-explorer-reference){opacity:0}
[data-explorer-tree] .pwr-explorer-action-status,[data-explorer-tree] .pwr-explorer-metadata-card{position:static;flex:none;display:flex;gap:var(--vk-gap-md);width:auto;margin:0;padding:var(--vk-gap-xs) var(--vk-gap-md);font-size:var(--vk-font-small);border:0;border-top:1px solid var(--vk-border-l1);border-radius:0;box-shadow:none;background:var(--vk-bg-layer-1)}
[data-explorer-tree] .pwr-explorer-metadata-card strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
[data-explorer-tree] .pwr-explorer-metadata-card span{color:var(--vk-text-tertiary)}
[data-explorer-tree] .pwr-explorer-context-menu{position:absolute;inset-inline:var(--vk-gap-md);top:var(--vk-ctrl-touch);bottom:var(--vk-gap-md);overflow:auto;z-index:20;max-width:calc(100% - 2 * var(--vk-gap-md))}
[data-explorer-tree] .pwr-explorer-context-menu>span{display:block}
[data-explorer-tree] .pwr-explorer-context-menu [role=menu]{position:relative;inset:auto;width:100%;min-width:0;max-width:100%;max-height:calc(100dvh - 120px);overflow:auto}
[data-explorer-tree] .pwr-explorer-context-menu small{display:block;white-space:normal;overflow-wrap:anywhere;font-size:var(--vk-font-small)}
@media(pointer:coarse){[data-explorer-tree] .pwr-explorer-context-menu [role=menuitem]{min-height:var(--vk-ctrl-touch)}[data-explorer-tree] .pwr-explorer-row input[type=checkbox],[data-explorer-tree] .pwr-explorer-row .pwr-explorer-reference{opacity:1!important}[data-explorer-tree] .pwr-explorer-row button{height:var(--vk-ctrl-touch)}}
` })
