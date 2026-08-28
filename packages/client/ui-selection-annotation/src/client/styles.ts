/**
 * 选区批注注入样式。只用语义化 CSS 变量（宿主未提供时回落到工程工具
 * 默认值）；无渐变、无 glass、无装饰阴影。
 *
 * @module @yeisme/dsh-client-ui-selection-annotation/client
 */

export const SELECTION_ANNOTATION_STYLE_ID = 'dsh-selection-annotation-styles'

export function injectSelectionAnnotationStyles(target: Document): void {
  if (target.getElementById(SELECTION_ANNOTATION_STYLE_ID) !== null) return
  const style = target.createElement('style')
  style.id = SELECTION_ANNOTATION_STYLE_ID
  style.textContent = `
.dsh-selection-toolbar {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 4px 6px;
  border: 1px solid var(--dsh-border, #d0d7de);
  border-radius: 8px;
  background: var(--dsh-background, #ffffff);
  color: var(--dsh-foreground, #1f2328);
  font: 12px/1.4 system-ui, sans-serif;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}
.dsh-selection-toolbar button {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.dsh-selection-toolbar button:hover, .dsh-selection-toolbar button:focus-visible {
  background: var(--dsh-accent-soft, rgba(9, 105, 218, 0.12));
  outline: none;
}
.dsh-selection-toolbar--narrow button { padding: 4px 6px; }
.dsh-selection-toolbar--edge { opacity: 0.85; }
.dsh-selection-composer {
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: min(360px, calc(100vw - 32px));
  border: 1px solid var(--dsh-border, #d0d7de);
  border-radius: 10px;
  background: var(--dsh-background, #ffffff);
  color: var(--dsh-foreground, #1f2328);
  font: 13px/1.5 system-ui, sans-serif;
  padding: 8px;
  z-index: 2147483001;
}
.dsh-selection-composer__header { display: flex; justify-content: space-between; font-weight: 600; }
.dsh-selection-composer__intents { display: flex; gap: 4px; margin: 6px 0; }
.dsh-selection-composer__intents button[aria-pressed="true"] { border-color: var(--dsh-accent, #0969da); }
.dsh-selection-composer textarea {
  width: 100%;
  resize: none;
  border: 1px solid var(--dsh-border, #d0d7de);
  border-radius: 6px;
  font: inherit;
  padding: 6px;
  box-sizing: border-box;
}
.dsh-selection-composer__footer { display: flex; gap: 8px; align-items: center; margin-top: 6px; color: var(--dsh-muted, #57606a); }
.dsh-selection-composer__card {
  border: 1px solid var(--dsh-border, #d0d7de);
  border-radius: 6px;
  padding: 1px 6px;
  font-size: 12px;
}
.dsh-annotation-canvas__surface { border: 1px solid var(--dsh-border, #d0d7de); background: var(--dsh-canvas, #f6f8fa); touch-action: none; }
.dsh-annotation-canvas__marker {
  border: 2px solid var(--dsh-accent, #0969da);
  border-radius: 4px;
  background: rgba(9, 105, 218, 0.12);
}
.dsh-annotation-canvas__marker-label {
  position: absolute;
  top: -10px;
  left: -10px;
  border-radius: 8px;
  background: var(--dsh-accent, #0969da);
  color: #fff;
  font-size: 11px;
  line-height: 16px;
  padding: 0 4px;
}
.dsh-annotation-canvas__unmapped {
  position: absolute;
  bottom: -18px;
  left: 0;
  font-size: 10px;
  color: var(--dsh-warning, #9a6700);
  white-space: nowrap;
}
`
  target.head.append(style)
}
