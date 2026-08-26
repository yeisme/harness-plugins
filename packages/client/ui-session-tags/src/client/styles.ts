import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'

/**
 * 标签编辑器 overlay 样式（dsh-unified-panel-visual-system-v1 3.4 A 档采纳）。
 *
 * 历史上 `session-tags-*` 类名在仓库与宿主侧均无定义（无样式裸面）；
 * 现在由 visual kit 提供 token 单点 fallback + overlay 专属规则。
 * 既有类名/DOM 合同不变，测试只增不改。
 */
const S = '[data-session-tags]'

const sessionTagsExtra = `
${S} .session-tags-overlay-backdrop{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.52);backdrop-filter:blur(2px)}
${S} .session-tags-editor{display:grid;gap:12px;width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow:auto;padding:16px;background:var(--vk-bg-elevated);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-xl);box-shadow:0 18px 42px rgba(0,0,0,.42)}
${S} .session-tags-editor h2{margin:0;font-size:var(--vk-font-heading);font-weight:650;color:var(--vk-text-primary)}
${S} .session-tags-draft{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}
${S} .session-tags-chip{display:inline-flex;align-items:center;gap:4px;min-height:24px;padding:0 4px 0 10px;border:1px solid var(--vk-border-l2);border-radius:999px;background:var(--vk-bg-layer-2);color:var(--vk-text-secondary);font-size:var(--vk-font-small)}
${S} .session-tags-chip button{display:grid;place-items:center;width:20px;height:20px;padding:0;border:0;border-radius:999px;background:transparent;color:var(--vk-text-tertiary);cursor:pointer}
${S} .session-tags-chip button:hover:not(:disabled),${S} .session-tags-chip button:focus-visible{color:var(--vk-text-primary);background:var(--vk-fill-hover)}
${S} .session-tags-chip button:disabled{opacity:.46;cursor:not-allowed}
${S} .session-tags-empty{margin:0;color:var(--vk-text-tertiary)}
${S} .session-tags-entry{display:flex;gap:8px;min-width:0}
${S} .session-tags-entry input{flex:1;min-width:0;min-height:var(--vk-ctrl-input);padding:7px 9px;color:inherit;background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md)}
${S} .session-tags-entry button{min-height:var(--vk-ctrl-button);padding:0 10px;color:var(--vk-text-secondary);background:transparent;border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md);cursor:pointer}
${S} .session-tags-entry button:hover:not(:disabled){color:var(--vk-text-primary);background:var(--vk-fill-hover)}
${S} .session-tags-entry button:disabled{opacity:.46;cursor:not-allowed}
${S} .session-tags-suggestions{display:grid;gap:6px}
${S} .session-tags-suggestions>p{margin:0;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .session-tags-suggestions ul{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}
${S} .session-tags-suggestions button{min-height:24px;padding:0 10px;color:var(--vk-text-secondary);background:transparent;border:1px dashed var(--vk-border-l2);border-radius:999px;cursor:pointer}
${S} .session-tags-suggestions button:hover:not(:disabled),${S} .session-tags-suggestions button:focus-visible{color:var(--vk-text-primary);border-style:solid;border-color:color-mix(in srgb,var(--vk-accent) 45%,transparent)}
${S} .session-tags-suggestions button:disabled{opacity:.46;cursor:not-allowed}
${S} .session-tags-feedback{display:grid;gap:6px;min-height:0}
${S} .session-tags-feedback p{margin:0;padding:8px 10px;border-radius:var(--vk-radius-md);font-size:var(--vk-font-small)}
${S} .session-tags-conflict{color:color-mix(in srgb,var(--vk-state-warn) 80%,#fff);background:color-mix(in srgb,var(--vk-state-warn) 12%,transparent);border:1px solid color-mix(in srgb,var(--vk-state-warn) 28%,transparent)}
${S} .session-tags-error{color:color-mix(in srgb,var(--vk-state-error) 80%,#fff);background:color-mix(in srgb,var(--vk-state-error) 12%,transparent);border:1px solid color-mix(in srgb,var(--vk-state-error) 28%,transparent)}
${S} .session-tags-actions{display:flex;justify-content:flex-end;gap:8px}
${S} .session-tags-actions button{min-height:var(--vk-ctrl-button);padding:0 12px;color:var(--vk-text-secondary);background:transparent;border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md);cursor:pointer}
${S} .session-tags-actions button:hover:not(:disabled){color:var(--vk-text-primary);background:var(--vk-fill-hover)}
${S} .session-tags-actions button.primary{color:#eef7ff;background:color-mix(in srgb,var(--vk-accent) 28%,transparent);border-color:color-mix(in srgb,var(--vk-accent) 62%,transparent)}
${S} .session-tags-actions button:disabled{opacity:.46;cursor:not-allowed}
@media(max-width:600px){${S} .session-tags-overlay-backdrop{padding:8px;align-items:end}}
`

/** overlay 样式串：token fallback 单点来自 visual kit registry。 */
export const sessionTagsOverlayStyles = buildPanelStyles({
  scope: 'session-tags',
  extra: sessionTagsExtra,
})
