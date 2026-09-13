import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'

export const DIRECTOR_3D_SCOPE = '3d-director' as const

const S = '[data-3d-director]'

export const director3DStyles = buildPanelStyles({
  scope: DIRECTOR_3D_SCOPE,
  extra: `${S}{display:grid;min-height:0;min-width:0;height:100%}
${S} .d3d-body{display:grid;gap:var(--vk-gap-lg);min-width:0;min-height:0;padding:var(--vk-gap-lg)}
${S} .d3d-viewport{display:grid;min-height:220px;min-width:0;overflow:hidden;background:var(--vk-bg-base);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md)}
${S} .d3d-canvas{display:block;width:100%;min-height:220px;background:var(--vk-bg-base);outline:none}
${S} .d3d-canvas[hidden]{display:none}
${S} .d3d-canvas:focus-visible{outline:2px solid var(--vk-border-focus);outline-offset:-2px}
${S} .d3d-tree{display:grid;gap:2px;margin:0;padding:var(--vk-gap-sm);list-style:none;overflow:auto;max-height:320px}
${S} .d3d-tree-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:baseline;gap:var(--vk-gap-md);width:100%;min-height:var(--vk-ctrl-button);padding:4px 8px;text-align:start;background:transparent;border:0;border-radius:var(--vk-radius-sm);cursor:pointer}
${S} .d3d-tree-row[data-depth='1']{padding-inline-start:20px}
${S} .d3d-tree-row[data-depth='2']{padding-inline-start:32px}
${S} .d3d-tree-row[data-depth='3']{padding-inline-start:44px}
${S} .d3d-tree-row:hover{background:var(--vk-fill-hover)}
${S} .d3d-tree-row[aria-selected='true']{background:var(--vk-fill-selected)}
${S} .d3d-tree-row[data-shot-bound='true']{box-shadow:inset 2px 0 0 var(--vk-accent)}
${S} .d3d-shot-nav{display:grid;gap:2px;margin:0;padding:0;list-style:none}
${S} .d3d-shot-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:baseline;gap:var(--vk-gap-md);width:100%;min-height:var(--vk-ctrl-button);padding:4px 8px;text-align:start;background:transparent;border:0;border-radius:var(--vk-radius-sm);cursor:pointer}
${S} .d3d-shot-row:hover{background:var(--vk-fill-hover)}
${S} .d3d-shot-row[aria-selected='true']{background:var(--vk-fill-selected)}
${S} .d3d-shot-row[data-bound='true']{box-shadow:inset 2px 0 0 var(--vk-accent)}
${S} .d3d-shot-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${S} .d3d-shot-meta{color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .d3d-tree-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${S} .d3d-tree-meta{color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .d3d-timeline{display:grid;gap:var(--vk-gap-sm);min-width:0;padding:var(--vk-gap-md);background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md)}
${S} .d3d-timeline-head{display:flex;align-items:baseline;justify-content:space-between;gap:var(--vk-gap-md);color:var(--vk-text-secondary);font-size:var(--vk-font-small)}
${S} .d3d-track{position:relative;min-height:44px;padding:18px 0 6px;border-block:1px solid var(--vk-border-l1)}
${S} .d3d-keyframe{position:absolute;top:14px;width:12px;height:12px;margin-inline-start:-6px;padding:0;background:var(--vk-accent);border:1px solid var(--vk-bg-base);border-radius:50%;transform:rotate(45deg);cursor:pointer}
${S} .d3d-keyframe[data-selected='true']{background:var(--vk-text-primary);outline:2px solid var(--vk-border-focus)}
${S} .d3d-playhead-marker{position:absolute;top:0;bottom:0;width:2px;margin-inline-start:-1px;background:var(--vk-state-warn);pointer-events:none}
${S} .d3d-track-empty{color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .d3d-scrub input[type='range']{width:100%}
${S} .d3d-keyframe-detail{display:grid;gap:var(--vk-gap-sm)}
${S} .d3d-gaps{display:grid;gap:4px;margin:0;padding:0;list-style:none}
${S} .d3d-gaps li{color:var(--vk-text-secondary);font-size:var(--vk-font-small)}
${S} .d3d-node-editor{display:grid;gap:var(--vk-gap-md);min-width:0}
${S} .d3d-node-head{display:flex;align-items:baseline;gap:var(--vk-gap-md);min-width:0}
${S} .d3d-node-title{font-size:var(--vk-font-strong);color:var(--vk-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${S} .d3d-vec{display:grid;gap:4px}
${S} .d3d-vec-legend{color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .d3d-vec-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(72px,1fr));gap:var(--vk-gap-sm)}
${S} .d3d-component input{width:100%}
${S} .d3d-visibility{display:flex;align-items:center;gap:var(--vk-gap-sm)}
${S} .d3d-reason{margin:0;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
${S} .d3d-rejection{margin:0;color:var(--vk-state-error);font-size:var(--vk-font-small)}
${S} .d3d-changesets{display:grid;gap:var(--vk-gap-md);margin:0;padding:0;list-style:none}
${S} .d3d-changeset{display:grid;gap:var(--vk-gap-sm);padding-block-end:var(--vk-gap-md);border-block-end:1px solid var(--vk-border-l1)}
${S} .d3d-changeset:last-child{padding-block-end:0;border-block-end:0}
${S} .d3d-changeset-head{display:flex;align-items:baseline;gap:var(--vk-gap-md);min-width:0}
${S} .d3d-changeset-status{display:inline-flex;align-items:center;gap:6px;color:var(--vk-text-secondary);font-size:var(--vk-font-small)}
${S} .d3d-changeset-summary{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--vk-text-primary)}
${S} .d3d-changeset-actions{display:flex;flex-wrap:wrap;gap:var(--vk-gap-sm)}
${S} .d3d-preview{display:grid;gap:4px;padding:var(--vk-gap-sm) var(--vk-gap-md);background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md)}
${S} .d3d-preview-row{display:flex;min-width:0;gap:var(--vk-gap-md);align-items:baseline;font-size:var(--vk-font-small);color:var(--vk-text-secondary)}
${S} .d3d-preview-key{flex:none;width:80px;color:var(--vk-text-quaternary)}
${S} .d3d-draft-bar{display:flex;align-items:center;justify-content:space-between;gap:var(--vk-gap-md);padding:var(--vk-gap-sm) var(--vk-gap-md);background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md);color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
@container yeisme-surface (max-width:420px){${S} .d3d-body{padding:var(--vk-gap-md)}${S} .d3d-viewport{min-height:180px}}
@media (prefers-reduced-motion:reduce){${S} .d3d-keyframe{transition:none!important}}`,
})
