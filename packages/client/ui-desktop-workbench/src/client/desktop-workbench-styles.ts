/** Scoped visual system for the Desktop Workbench overlay. */
export const desktopWorkbenchStyles = `
[data-dsh-desktop-workbench],
[data-dsh-desktop-workbench] * {
  box-sizing: border-box;
}

[data-dsh-desktop-workbench] {
  position: absolute;
  inset: 0;
  z-index: 40;
  isolation: isolate;
  display: grid;
  grid-template-columns: minmax(232px, 272px) minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary, #f2f2f4);
  background: var(--dsw-alias-bg-base, #151517);
  font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: 14px;
}

[data-dsh-desktop-workbench][data-sidebar-visible="false"] {
  grid-template-columns: 0 minmax(0, 1fr);
}

[data-dsh-desktop-workbench] button,
[data-dsh-desktop-workbench] input {
  font: inherit;
}

[data-dsh-desktop-workbench] button:focus-visible,
[data-dsh-desktop-workbench] input:focus-visible,
[data-dsh-desktop-workbench] [role="tab"]:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #79a8ff);
  outline-offset: 2px;
}

[data-dsh-desktop-shell-sidebar] {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--dsw-alias-bg-layer-1, #232324);
  border-right: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12));
  transition:
    opacity var(--ds-transition-duration, 0.2s) var(--ds-ease-in-out, ease),
    transform var(--ds-transition-duration, 0.2s) var(--ds-ease-in-out, ease);
}

[data-sidebar-visible="false"] > [data-dsh-desktop-shell-sidebar] {
  opacity: 0;
  pointer-events: none;
  transform: translateX(-18px);
}

[data-dsh-desktop-main] {
  display: grid;
  grid-template-rows: 56px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--dsw-alias-bg-base, #151517);
}

[data-dsh-desktop-toolbar] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
  padding: 0 16px;
  background: var(--dsw-alias-bg-layer-1, #232324);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1, #232324) 92%, transparent);
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12));
}

[data-dsh-desktop-toolbar-group],
[data-dsh-desktop-toolbar-actions] {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

[data-dsh-desktop-toolbar-actions] {
  justify-content: flex-end;
}

[data-dsh-desktop-product] {
  display: grid;
  min-width: 0;
  line-height: 1.15;
}

[data-dsh-desktop-product] small {
  color: var(--dsw-alias-label-tertiary, #8d8d96);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

[data-dsh-desktop-product] strong {
  overflow: hidden;
  font-size: 15px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-desktop-toolbar-button] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 40px;
  min-height: 36px;
  padding: 0 11px;
  color: var(--dsw-alias-label-secondary, #c6c6cb);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition:
    color var(--ds-transition-duration-fast, 0.1s) ease,
    background var(--ds-transition-duration-fast, 0.1s) ease,
    border-color var(--ds-transition-duration-fast, 0.1s) ease;
}

[data-dsh-desktop-toolbar-button]:hover {
  color: var(--dsw-alias-label-primary, #f2f2f4);
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));
  border-color: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12));
}

[data-dsh-desktop-toolbar-button="close"] {
  background: var(--dsw-alias-bg-layer-2, #2c2c2e);
  border-color: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12));
}

[data-dsh-desktop-status] {
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary, #92929b);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-desktop-content] {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

[data-dsh-desktop-workbench] [data-dsh-workbench-tab] {
  transition:
    color var(--ds-transition-duration-fast, 0.1s) ease,
    background var(--ds-transition-duration-fast, 0.1s) ease,
    border-color var(--ds-transition-duration-fast, 0.1s) ease;
}

[data-dsh-desktop-workbench] [data-dsh-workbench-tab]:hover {
  color: var(--dsw-alias-label-primary, #f2f2f4) !important;
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08)) !important;
}

[data-dsh-desktop-workbench] [data-dsh-workbench-tab][data-active] {
  background: var(--dsw-alias-button-ghost-active-fill, #343438) !important;
}

[data-dsh-desktop-workbench] [data-dsh-workbench-tab] button:hover {
  color: var(--dsw-alias-label-primary, #f2f2f4) !important;
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08)) !important;
}

[data-dsh-session-sidebar] {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 14px;
  height: 100%;
  min-height: 0;
  padding: 18px 14px 14px;
}

[data-dsh-session-sidebar-header] {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

[data-dsh-session-sidebar-header] h2 {
  margin: 0;
  font-size: 19px;
  font-weight: 680;
  letter-spacing: -0.015em;
}

[data-dsh-session-sidebar-header] p {
  margin: 4px 0 0;
  color: var(--dsw-alias-label-tertiary, #92929b);
  font-size: 12px;
}

[data-dsh-session-count] {
  display: inline-grid;
  place-items: center;
  min-width: 28px;
  height: 24px;
  padding: 0 8px;
  color: var(--dsw-alias-label-secondary, #c6c6cb);
  background: var(--dsw-alias-bg-layer-2, #2c2c2e);
  border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12));
  border-radius: 999px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

[data-dsh-session-search],
[data-dsh-search-field] {
  display: grid;
  gap: 6px;
}

[data-dsh-session-search] > span,
[data-dsh-search-field] > span {
  color: var(--dsw-alias-label-tertiary, #92929b);
  font-size: 11px;
  font-weight: 600;
}

[data-dsh-session-search] input,
[data-dsh-search-field] input,
[data-dsh-global-search] input,
[data-dsh-terminal-pane] input {
  width: 100%;
  min-height: 40px;
  padding: 0 12px;
  color: var(--dsw-alias-label-primary, #f2f2f4);
  caret-color: var(--dsw-alias-state-business-primary, #79a8ff);
  background: var(--dsw-alias-bg-layer-2, #2c2c2e);
  border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12));
  border-radius: 9px;
}

[data-dsh-session-search] input::placeholder,
[data-dsh-search-field] input::placeholder,
[data-dsh-global-search] input::placeholder,
[data-dsh-terminal-pane] input::placeholder {
  color: var(--dsw-alias-label-tertiary, #92929b);
}

[data-dsh-session-scroll] {
  min-height: 0;
  overflow: auto;
  padding-right: 2px;
}

[data-dsh-session-group] {
  margin: 0 0 16px;
}

[data-dsh-session-group] h4 {
  margin: 0 0 7px;
  color: var(--dsw-alias-label-tertiary, #92929b);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.035em;
  text-transform: uppercase;
}

[data-dsh-session-group] ul,
[data-dsh-global-search] ul,
[data-dsh-notification-center] ul,
[data-dsh-terminal-list] {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

[data-dsh-session-row] {
  display: grid;
  gap: 6px;
  padding: 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  transition:
    background var(--ds-transition-duration-fast, 0.1s) ease,
    border-color var(--ds-transition-duration-fast, 0.1s) ease;
}

[data-dsh-session-row]:hover,
[data-dsh-session-row]:focus-within {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));
  border-color: var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.06));
}

[data-dsh-session-primary] {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 28px;
  padding: 0;
  color: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
}

[data-dsh-session-title] {
  overflow: hidden;
  font-size: 13px;
  font-weight: 620;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-session-state] {
  color: var(--dsw-alias-label-tertiary, #92929b);
  font-size: 10px;
  white-space: nowrap;
}

[data-dsh-session-state="running"],
[data-dsh-session-state="attention"] {
  color: var(--dsw-alias-state-business-primary, #79a8ff);
}

[data-dsh-session-labels] {
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary, #92929b);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-session-actions] {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

[data-dsh-session-actions] button,
[data-dsh-notification-actions] button,
[data-dsh-notification-center] li button,
[data-dsh-terminal-pane] button,
[data-dsh-global-search] li button {
  min-height: 30px;
  padding: 0 8px;
  color: var(--dsw-alias-label-secondary, #c6c6cb);
  background: transparent;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12));
  border-radius: 7px;
  cursor: pointer;
}

[data-dsh-session-actions] button:hover,
[data-dsh-notification-actions] button:hover,
[data-dsh-notification-center] li button:hover,
[data-dsh-terminal-pane] button:hover,
[data-dsh-global-search] li button:hover {
  color: var(--dsw-alias-label-primary, #f2f2f4);
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));
}

[data-dsh-session-action="danger"] {
  color: var(--dsw-alias-state-error-secondary, #f25a5a) !important;
}

[data-dsh-archived-sessions] {
  margin-top: 10px;
  color: var(--dsw-alias-label-secondary, #c6c6cb);
}

[data-dsh-archived-sessions] summary {
  min-height: 36px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
}

[data-dsh-panel-empty] {
  display: grid;
  place-items: center;
  gap: 6px;
  min-height: 148px;
  padding: 24px;
  color: var(--dsw-alias-label-tertiary, #92929b);
  text-align: center;
  background: var(--dsw-alias-bg-layer-1, #232324);
  border: 1px dashed var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12));
  border-radius: 12px;
}

[data-dsh-panel-empty] strong {
  color: var(--dsw-alias-label-primary, #f2f2f4);
  font-size: 14px;
}

[data-dsh-global-search],
[data-dsh-notification-center],
[data-dsh-terminal-pane],
[data-dsh-media-panel] {
  display: grid;
  align-content: start;
  gap: 16px;
  max-width: 1040px;
  min-height: 100%;
  margin: 0 auto;
}

[data-dsh-panel-heading] {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

[data-dsh-panel-heading] h2,
[data-dsh-panel-heading] h3 {
  margin: 0;
  font-size: 22px;
  font-weight: 680;
  letter-spacing: -0.02em;
}

[data-dsh-panel-heading] p {
  margin: 5px 0 0;
  color: var(--dsw-alias-label-tertiary, #92929b);
  font-size: 13px;
}

[data-dsh-global-search] ul,
[data-dsh-notification-center] ul {
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}

[data-dsh-global-search] li,
[data-dsh-notification-center] li {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 112px;
  padding: 14px;
  background: var(--dsw-alias-bg-layer-1, #232324);
  border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12));
  border-radius: 12px;
}

[data-dsh-global-search] li > span,
[data-dsh-notification-center] li > span {
  color: var(--dsw-alias-label-tertiary, #92929b);
  font-size: 12px;
}

[data-dsh-notification-actions] {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

@media (max-width: 820px) {
  [data-dsh-desktop-workbench],
  [data-dsh-desktop-workbench][data-sidebar-visible="false"] {
    grid-template-columns: minmax(0, 1fr);
  }

  [data-dsh-desktop-shell-sidebar] {
    position: absolute;
    z-index: 4;
    inset: 56px auto 0 0;
    width: min(86vw, 320px);
    box-shadow: 18px 0 42px rgba(0, 0, 0, 0.32);
  }

  [data-sidebar-visible="false"] > [data-dsh-desktop-shell-sidebar] {
    transform: translateX(-100%);
  }

  [data-dsh-desktop-main] {
    grid-column: 1;
  }

  [data-dsh-desktop-status] {
    display: none;
  }

  [data-dsh-desktop-toolbar] {
    gap: 8px;
    padding: 0 10px;
  }
}

@media (max-width: 560px) {
  [data-dsh-desktop-product] small,
  [data-dsh-desktop-toolbar-button] span[data-label] {
    display: none;
  }

  [data-dsh-global-search] ul,
  [data-dsh-notification-center] ul {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-dsh-desktop-workbench] *,
  [data-dsh-desktop-workbench] *::before,
  [data-dsh-desktop-workbench] *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
`
