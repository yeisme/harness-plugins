import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'

/**
 * 登录态 profile 面板样式（dsh-unified-panel-visual-system-v1 3.4 A 档采纳）。
 *
 * 历史上根节点只有一条内联 grid 样式、`.sr-only` 无定义；现在由 visual kit
 * 提供 token 单点 fallback + 面板规则。data 属性/DOM 合同不变。
 */
const S = '[data-dsh-cookie-manager]'

const cookieManagerExtra = `
${S} .cm-title{margin:0;font-size:var(--vk-font-heading);font-weight:650;color:var(--vk-text-primary)}
${S} .cm-alert{margin:0;padding:10px;border-radius:var(--vk-radius-md);color:color-mix(in srgb,var(--vk-state-error) 80%,#fff);background:color-mix(in srgb,var(--vk-state-error) 12%,transparent);border:1px solid color-mix(in srgb,var(--vk-state-error) 28%,transparent);font-size:var(--vk-font-small)}
${S} .cm-card{display:grid;gap:var(--vk-gap-md);min-width:0;padding:12px;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-lg)}
${S} .cm-card h4{margin:0;font-size:var(--vk-font-strong);color:var(--vk-text-primary)}
${S} .cm-form{display:grid;gap:var(--vk-gap-sm)}
${S} .cm-form label{display:grid;gap:4px;font-size:var(--vk-font-small);color:var(--vk-text-secondary)}
${S} .cm-form input{min-height:var(--vk-ctrl-input);padding:7px 9px;color:inherit;background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md)}
${S} .cm-btn{min-height:var(--vk-ctrl-button);padding:0 10px;color:var(--vk-text-secondary);background:transparent;border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md);cursor:pointer}
${S} .cm-btn:hover:not(:disabled){color:var(--vk-text-primary);background:var(--vk-fill-hover)}
${S} .cm-btn:disabled{opacity:.46;cursor:not-allowed}
${S} .cm-list{display:grid;gap:6px;margin:0;padding:0;list-style:none}
${S} .cm-row{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;min-width:0;padding:9px 10px;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md)}
${S} .cm-row>.cm-rename{margin-left:auto}
${S} .cm-row .cm-rename{display:grid;gap:2px}
${S} .cm-row .cm-rename input{min-height:var(--vk-ctrl-button);padding:4px 8px;color:inherit;background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md)}
${S} .cm-note{margin:0;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .cm-empty{margin:0;color:var(--vk-text-tertiary)}
${S} .cm-account{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;min-width:0;padding:8px 10px;background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md);font-size:var(--vk-font-small)}
${S} .cm-account .cm-account-summary{color:var(--vk-text-secondary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${S} .cm-name{color:var(--vk-text-primary);font-weight:650;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${S} .cm-site{color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .cm-account .cm-account-status{display:inline-flex;align-items:center;gap:6px;color:var(--vk-text-tertiary)}
${S} .cm-dot{width:9px;height:9px;border-radius:50%;background:var(--vk-tone-neutral)}
${S} .cm-dot[data-tone='positive']{background:var(--vk-tone-positive)}
${S} .cm-dot[data-tone='info']{background:var(--vk-tone-info)}
${S} .cm-dot[data-tone='warn']{background:var(--vk-tone-warn)}
${S} .cm-dot[data-tone='critical']{background:var(--vk-tone-critical)}
${S} .cm-quota{display:grid;gap:6px}
${S} .cm-quota dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;margin:0}
${S} form{display:grid;gap:var(--vk-gap-sm)}
${S} form label{display:grid;gap:4px;font-size:var(--vk-font-small);color:var(--vk-text-secondary)}
${S} form input{min-height:var(--vk-ctrl-input);padding:7px 9px;color:inherit;background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md)}
${S} ul{display:grid;gap:6px;margin:0;padding:0;list-style:none}
${S} .cm-quota dt{color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .cm-quota dd{margin:0;color:var(--vk-text-secondary);font-size:var(--vk-font-small)}
${S} .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:600px){${S} .cm-row{padding:8px}${S} .cm-card{padding:10px}}
`

/** 面板样式串：token fallback 单点来自 visual kit registry。 */
export const cookieManagerStyles = buildPanelStyles({
  scope: 'dsh-cookie-manager',
  extra: cookieManagerExtra,
})
