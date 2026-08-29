import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'

const S = '[data-next-step-suggestions]'

const extra = `
${S}{display:flex;flex-direction:column;gap:var(--vk-gap-sm);padding:4px 0;min-width:0;background:transparent}
${S} .ns-chips{display:flex;flex-wrap:wrap;gap:var(--vk-gap-sm);align-items:center}
${S} .ns-chip{display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:0 10px;border:1px solid var(--vk-border-l2);border-radius:999px;background:transparent;color:var(--vk-text-secondary);cursor:pointer;font:inherit}
${S} .ns-chip:hover:not(:disabled){color:var(--vk-text-primary);background:var(--vk-fill-hover)}
${S} .ns-chip[aria-pressed='true']{color:var(--vk-text-primary);background:var(--vk-fill-selected);border-color:color-mix(in srgb,var(--vk-accent) 42%,transparent)}
${S} .ns-chip:disabled{opacity:.46;cursor:not-allowed}
${S} .ns-chip-rec{color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .ns-controls{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .ns-controls label{display:inline-flex;align-items:center;gap:6px;cursor:pointer}
${S} .ns-actions{display:inline-flex;gap:8px}
${S} .ns-hint{color:var(--vk-text-quaternary)}
`

export const nextStepSuggestionStyles = buildPanelStyles({
  scope: 'next-step-suggestions',
  extra,
})
