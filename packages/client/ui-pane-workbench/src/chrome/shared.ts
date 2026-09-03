import {
  Component,
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { panelVar, type PanelTokenName } from '@yeisme/dsh-client-ui-visual-kit'
import type { ArtifactIntentV1, PaneContextV1 } from '@yeisme/dsh-pane-protocol'
import {
  ARTIFACT_INTENT_DRAG_MIME,
  beginArtifactGesture,
  buildArtifactGestureIntent,
  createArtifactDragPayload,
  isArtifactIntentKind,
  parseArtifactDragPayload,
  type ArtifactHandoffChannelV1,
  type ArtifactHandoffEvidenceV1,
} from '../artifacts.js'
import { ArtifactRefSchema } from '@yeisme/dsh-pane-protocol'
import { PaneArtifactHandoffMenu, type ArtifactHandoffTargetV1 } from '../handoff-menu.js'
import {
  resolvePaneManagementShortcut,
  type PaneConversationSearchHostV1,
  type PaneManagementKeymapV1,
  type PaneWorkspaceContextProviderV1,
} from '../management.js'
import type { PaneDragTargetV1 } from '../interactions.js'
import { PaneResizeSession } from '../interactions.js'
import type { PaneWorkbenchController } from '../controller.js'
import { isPaneCoreViewId, openPaneWorkbenchCoreView, DSH_WORKSPACE_DESIGNER_VIEW_KIND, type PaneCoreViewId } from '../core-pane.js'
import { DSH_EXPLORER_VIEW_KIND, openExplorerNavigator } from '../explorer/provider.js'
import { openSourceControlNavigator } from '../git/provider.js'
import { DSH_SOURCE_CONTROL_VIEW_KIND } from '../git/source-control.js'
import { PaneTabActions, PaneTabStrip } from '../tabs.js'
import { PaneCloseUndoToast, PaneManagementCenter } from '../management-center.js'
import type { PaneManagementMode } from '../management.js'
import type { PaneViewRegistry, PaneViewRegistrationV1 } from '../view-registry.js'
import { WorkbenchIcon } from '../icon.js'
import type { WorkbenchIconName } from '../icon.js'
import { formatT, getLocaleRevision, subscribeLocale, t, tWithFallback } from '../i18n/locale.js'
import {
  applyWorkbenchFontSizeTo,
  getWorkbenchFontSize,
  stepWorkbenchFontSize,
  subscribeWorkbenchFontSize,
  WORKBENCH_FONT_SIZE_MAX,
  WORKBENCH_FONT_SIZE_MIN,
} from '../font-scale.js'
import type {
  PaneGroupV1,
  PaneBulkCloseProtectedViewV1,
  PaneRegionId,
  PaneSplitNodeV1,
  PaneViewInstanceV1,
  PaneWorkspaceV1,
} from '../workspace.js'
export const PANE_MIN_WIDTH = 280

export const PANE_MIN_HEIGHT = 180

export const SPLITTER_SIZE = 5

export const RIGHT_RAIL_WIDTH = 44

export const CHROME_TOKENS: readonly PanelTokenName[] = ['bg-base','bg-elevated','text-primary','text-secondary','text-tertiary','text-link','border-l1','border-l2','border-focus','fill-hover','fill-selected','accent']

export const CHROME_TOKEN_DECL = `${CHROME_TOKENS.map(name => `--vk-${name}:${panelVar(name)}`).join(';')};--vk-bg-layer-1:var(--vk-bg-base);--vk-bg-layer-2:var(--vk-bg-elevated)`

export const REGION_STYLES = `.pwr-root{position:relative;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;color:var(--vk-text-primary);background:var(--vk-bg-base);font:var(--dsh-wb-font-size,14px)/1.4 var(--dsw-font-family,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);--pwr-tab-width:136px;--pwr-tab-height:34px;--pwr-chrome-height:42px;--pwr-control-size:30px;${CHROME_TOKEN_DECL}}
.pwr-rail{position:absolute;inset:0 auto 0 0;width:44px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 5px;box-sizing:border-box;background:var(--dsw-specific-sidebar-fill,#1c1c1f);z-index:3}
.pwr-rail-fonts{margin-top:auto;display:flex;flex-direction:column;gap:4px}
.pwr-rail button,.pwr-icon{width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:var(--vk-text-secondary);display:grid;place-items:center;cursor:pointer}
.pwr-tip{position:relative;display:inline-flex}
.pwr-tip::after{content:attr(data-tip);position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%) translateY(2px);z-index:60;max-width:240px;padding:4px 8px;border-radius:7px;background:var(--vk-bg-elevated,#2a2a2f);border:1px solid var(--vk-border-l2,rgba(255,255,255,.12));color:var(--vk-text-primary,#ececf1);font-size:11px;line-height:1.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0;visibility:hidden;pointer-events:none;transition:opacity 120ms ease-out,transform 120ms ease-out}
.pwr-tip:hover::after,.pwr-tip:focus-within::after{opacity:1;visibility:visible;transform:translateX(-50%) translateY(0)}
.pwr-tip [data-status='active']{color:var(--vk-state-positive)}
.pwr-tip [data-status='critical']:not(:disabled){color:var(--vk-state-error)}
.pwr-icon-badge{font-size:10px;font-variant-numeric:tabular-nums;color:var(--vk-text-tertiary)}
@media(prefers-reduced-motion:reduce){.pwr-tip::after{transition:none}}
.pwr-rail button:hover,.pwr-rail button:focus-visible,.pwr-icon:hover,.pwr-icon:focus-visible{background:var(--vk-fill-hover);color:var(--vk-text-primary);outline:2px solid var(--vk-border-focus);outline-offset:-2px}
.pwr-rail .pwr-active{background:var(--vk-fill-selected);color:var(--vk-text-link);box-shadow:inset 2px 0 0 var(--vk-accent)}
.pwr-body{position:absolute;inset:0;display:flex;flex-direction:column;min-width:0;min-height:0;background:inherit}
.pwr-root[data-region='right'] .pwr-body{left:44px;width:calc(100% - 44px)}
.pwr-body[data-body-visible='false']{visibility:hidden;pointer-events:none;opacity:0}
.pwr-tab-actions svg,.pwr-rail svg,.pwr-picker svg,.pwr-menu svg{flex:none}
.pwr-tree{position:relative;flex:1;min-width:0;min-height:0;display:flex;overflow:hidden}
.pwr-split{display:flex;flex:1;min-width:0;min-height:0;overflow:hidden}
.pwr-split[data-orientation='horizontal']{flex-direction:row}.pwr-split[data-orientation='vertical']{flex-direction:column}
.pwr-branch{display:flex;min-width:0;min-height:0;overflow:hidden}
.pwr-splitter{flex:0 0 5px;position:relative;background:transparent;z-index:2;outline:none}
.pwr-split[data-orientation='horizontal']>.pwr-splitter{cursor:col-resize;border-left:1px solid var(--vk-border-l2)}
.pwr-split[data-orientation='vertical']>.pwr-splitter{cursor:row-resize;border-top:1px solid var(--vk-border-l2)}
.pwr-splitter:hover,.pwr-splitter:focus-visible{background:var(--vk-border-focus)}
.pwr-group{position:relative;display:flex;flex:1;flex-direction:column;min-width:0;min-height:0;overflow:hidden;background:var(--vk-bg-base)}
.pwr-tabs{box-sizing:border-box;height:var(--pwr-chrome-height);min-height:var(--pwr-chrome-height);display:flex;align-items:center;gap:6px;padding:4px 6px;overflow:hidden;border-bottom:1px solid var(--vk-border-l2);background:var(--vk-bg-layer-1)}
.pwr-tab-strip{display:flex;align-items:center;min-width:0;flex:1;overflow:hidden;gap:4px}.pwr-tab-segment{display:flex;align-items:center;min-width:0;gap:4px}.pwr-tab-item{position:relative;display:flex;align-items:center;flex:0 0 var(--pwr-tab-width);width:var(--pwr-tab-width);min-width:var(--pwr-tab-width);max-width:var(--pwr-tab-width);height:var(--pwr-tab-height);transition:opacity 120ms ease,transform 120ms ease}.pwr-tab-item[data-pane-drag-source='true']{opacity:.42;transform:scale(.97)}
.pwr-tab{position:relative;display:flex;align-items:center;gap:7px;box-sizing:border-box;width:100%;height:100%;min-width:0;max-width:none;padding:0 28px 0 10px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--vk-text-secondary);overflow:hidden;white-space:nowrap;cursor:pointer;font-size:12.5px}
.pwr-tab:hover{border-color:color-mix(in srgb,var(--vk-border-l2) 70%,transparent);background:var(--vk-fill-hover);color:var(--vk-text-primary)}
.pwr-tab[aria-selected='true']{background:var(--vk-bg-elevated);border-color:var(--vk-border-l2);color:var(--vk-text-primary);box-shadow:0 1px 2px color-mix(in srgb,var(--vk-bg-base) 58%,transparent)}
.pwr-tab[aria-selected='true']::after{content:'';position:absolute;left:10px;right:10px;bottom:0;height:2px;border-radius:2px 2px 0 0;background:var(--vk-accent)}
.pwr-tab-title{min-width:0;overflow:hidden;text-overflow:ellipsis}.pwr-tab[aria-selected='true'] .pwr-tab-title{font-weight:650}.pwr-tab-instance{flex:none;color:var(--vk-text-tertiary);font-size:11px}.pwr-tab-preview .pwr-tab-title{font-style:italic}.pwr-tab-pinned{width:100%;min-width:0;max-width:none}
.pwr-tab-close{position:absolute;right:5px;top:6px;width:22px;height:22px;padding:0;border:0;border-radius:6px;display:grid;place-items:center;background:transparent;color:var(--vk-text-tertiary);opacity:0;cursor:pointer}.pwr-tab-item:hover .pwr-tab-close,.pwr-tab-item:focus-within .pwr-tab-close,.pwr-tab-active+.pwr-tab-close{opacity:1}.pwr-tab-close:hover{background:var(--vk-fill-hover);color:var(--vk-text-primary)}
.pwr-tab-status{display:flex;align-items:center;gap:3px;min-width:0}.pwr-status-token{width:7px;height:7px;border-radius:50%;overflow:hidden;text-indent:-999px;background:var(--vk-text-tertiary)}.pwr-status-dirty{background:var(--vk-accent)}.pwr-status-attention,.pwr-status-conflict{background:var(--vk-state-warn,#f0b45a)}.pwr-status-orphaned,.pwr-status-offline{background:var(--vk-state-error,#ee6b72)}
.pwr-tab:focus-visible{outline:2px solid var(--vk-border-focus);outline-offset:-2px}
.pwr-tab-actions{position:sticky;right:0;z-index:2;display:flex;align-items:center;gap:2px;height:var(--pwr-tab-height);margin-left:auto;padding:0 2px 0 7px;border-left:1px solid var(--vk-border-l1);background:var(--vk-bg-layer-1);box-shadow:-8px 0 12px var(--vk-bg-layer-1)}
.pwr-tab-actions button{display:grid;place-items:center;width:var(--pwr-control-size);height:var(--pwr-control-size);padding:0;border:0;border-radius:8px;background:transparent;color:var(--vk-text-secondary);cursor:pointer}.pwr-tab-actions .pwr-tab-manager-trigger{width:auto;min-width:42px;padding:0 7px;grid-auto-flow:column;gap:5px;font-size:11px;font-variant-numeric:tabular-nums}
.pwr-tab-actions button:hover,.pwr-tab-actions button:focus-visible{background:var(--vk-fill-hover);color:var(--vk-text-primary);outline:2px solid var(--vk-border-focus);outline-offset:-2px}
.pwr-panel{flex:1;min-width:0;min-height:0;overflow:auto}
.pwr-panel>*{min-width:0;min-height:100%;box-sizing:border-box}
.pwr-empty{box-sizing:border-box;width:100%;height:100%;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;color:var(--vk-text-tertiary)}
.pwr-empty p{margin:0 0 2px;color:var(--vk-text-secondary);font-size:13px;font-weight:600}.pwr-empty button{margin-top:10px;height:34px;padding:0 13px;border:1px solid var(--vk-border-l2);border-radius:8px;background:var(--vk-bg-elevated);color:var(--vk-text-secondary);cursor:pointer}.pwr-empty button:hover,.pwr-empty button:focus-visible{background:var(--vk-fill-hover);color:var(--vk-text-primary);outline:2px solid var(--vk-border-focus);outline-offset:-2px}.pwr-empty button+button{margin-top:5px;border-color:transparent;background:transparent;color:var(--vk-text-tertiary)}
.pwr-drop{position:absolute;inset:8px;z-index:5;display:grid;place-items:center;border:1px solid var(--vk-border-focus);border-radius:10px;background:color-mix(in srgb,var(--vk-accent) 18%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--vk-accent) 28%,transparent),0 8px 28px rgba(0,0,0,.2);pointer-events:none;transition:inset 120ms ease,border-radius 120ms ease;animation:pwr-drop-enter 120ms cubic-bezier(.2,.8,.2,1)}
.pwr-group[data-pane-drop-edge='left']>.pwr-drop{inset:8px 52% 8px 8px}.pwr-group[data-pane-drop-edge='right']>.pwr-drop{inset:8px 8px 8px 52%}.pwr-group[data-pane-drop-edge='top']>.pwr-drop{inset:8px 8px 52%}.pwr-group[data-pane-drop-edge='bottom']>.pwr-drop{inset:52% 8px 8px}
.pwr-drop-label{display:flex;align-items:center;gap:7px;padding:7px 11px;border:1px solid color-mix(in srgb,var(--vk-border-focus) 70%,transparent);border-radius:999px;background:color-mix(in srgb,var(--vk-bg-elevated) 88%,transparent);color:var(--vk-text-primary);font-size:12px;font-weight:600;box-shadow:0 5px 18px rgba(0,0,0,.28);backdrop-filter:blur(8px)}
.pwr-drop-label::before{content:'';width:7px;height:7px;border-radius:2px;background:var(--vk-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--vk-accent) 22%,transparent)}
.pwr-group[data-pane-drop-enabled='false']>.pwr-drop{border-color:var(--vk-text-tertiary);background:color-mix(in srgb,var(--vk-bg-elevated) 82%,transparent);box-shadow:none}.pwr-group[data-pane-drop-enabled='false'] .pwr-drop-label::before{background:var(--vk-text-tertiary);box-shadow:none}
.pwr-empty-drop{position:absolute;inset:8px;z-index:5}.pwr-reorder-marker{position:absolute;top:4px;bottom:4px;z-index:7;width:3px;border-radius:3px;background:var(--vk-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--vk-accent) 18%,transparent);pointer-events:none}.pwr-reorder-label{position:absolute;top:42px;z-index:7;transform:translateX(-50%);white-space:nowrap;pointer-events:none}
.pwr-drag-ghost{position:fixed;z-index:10000;display:flex;align-items:center;gap:7px;max-width:240px;height:34px;padding:0 11px;border:1px solid var(--vk-border-focus);border-radius:8px;background:color-mix(in srgb,var(--vk-bg-elevated) 92%,transparent);color:var(--vk-text-primary);box-shadow:0 10px 30px rgba(0,0,0,.38);font-size:12px;font-weight:600;pointer-events:none;transform:translate(12px,12px);backdrop-filter:blur(10px)}.pwr-drag-ghost::before{content:'';width:8px;height:8px;border-radius:2px;background:var(--vk-accent)}.pwr-drag-ghost span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pwr-hidden-bottom-drop{position:fixed;inset:auto 0 0;height:68px;z-index:9998;display:grid;place-items:center;border-top:1px solid color-mix(in srgb,var(--vk-border-focus) 45%,transparent);background:linear-gradient(0deg,color-mix(in srgb,var(--vk-accent) 16%,var(--vk-bg-base,#171719)),color-mix(in srgb,var(--vk-accent) 3%,transparent));color:var(--vk-text-primary);pointer-events:auto;opacity:.78;box-shadow:0 -10px 28px rgba(0,0,0,.16);animation:pwr-bottom-approach 140ms cubic-bezier(.2,.8,.2,1);transition:height 140ms cubic-bezier(.2,.8,.2,1),opacity 140ms ease,background 140ms ease}.pwr-hidden-bottom-drop[data-pane-drop-phase='ready']{height:112px;opacity:1;border-top-color:var(--vk-border-focus);background:linear-gradient(0deg,color-mix(in srgb,var(--vk-accent) 34%,var(--vk-bg-base,#171719)),color-mix(in srgb,var(--vk-accent) 10%,transparent));box-shadow:0 -16px 38px rgba(0,0,0,.26)}.pwr-hidden-bottom-drop .pwr-drop-label{transform:translateY(-3px)}.pwr-hidden-bottom-drop[data-pane-drop-phase='ready'] .pwr-drop-label::before{animation:pwr-drop-pulse 760ms ease-in-out infinite alternate}
@keyframes pwr-drop-enter{from{opacity:0;transform:scale(.985)}to{opacity:1;transform:scale(1)}}@keyframes pwr-bottom-approach{from{opacity:0;transform:translateY(24px)}to{opacity:.78;transform:translateY(0)}}@keyframes pwr-drop-pulse{from{transform:scale(.8);opacity:.7}to{transform:scale(1.25);opacity:1}}
@media (prefers-reduced-motion:reduce){.pwr-drop,.pwr-hidden-bottom-drop,.pwr-hidden-bottom-drop .pwr-drop-label::before{transition:none;animation:none}}
.pwr-menu{position:absolute;top:40px;right:8px;z-index:7;box-sizing:border-box;width:min(232px,calc(100vw - 24px));padding:7px;display:grid;gap:2px;border:1px solid var(--vk-border-l2);border-radius:12px;background:color-mix(in srgb,var(--vk-bg-elevated) 96%,transparent);box-shadow:0 18px 48px rgba(0,0,0,.46);backdrop-filter:blur(14px)}
.pwr-menu button{width:100%;min-height:34px;padding:0 10px;border:0;border-radius:7px;text-align:left;background:transparent;color:inherit;font:inherit;font-size:13px;cursor:pointer}.pwr-menu .pwr-menu-item{display:grid;grid-template-columns:18px minmax(0,1fr);align-items:center;gap:9px}.pwr-menu .pwr-menu-item svg{color:var(--vk-text-tertiary)}.pwr-menu .pwr-menu-item>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pwr-menu button:hover,.pwr-menu button:focus-visible{background:var(--vk-fill-hover);color:var(--vk-text-primary);outline:2px solid var(--vk-border-focus);outline-offset:-2px}.pwr-menu button:hover svg,.pwr-menu button:focus-visible svg{color:currentColor}.pwr-menu button:disabled{opacity:.42;cursor:not-allowed}.pwr-menu-separator{height:1px;margin:4px 7px;background:var(--vk-border-l1)}
.pwr-root[data-region='right'][data-picker-open='true']{overflow:visible;z-index:30}
.pwr-picker{position:absolute;top:48px;right:8px;z-index:8;box-sizing:border-box;width:min(340px,calc(100vw - 24px));max-height:min(520px,calc(100vh - 56px));display:flex;flex-direction:column;padding:10px;border:1px solid var(--vk-border-l2);border-radius:12px;background:var(--vk-bg-elevated);color:var(--vk-text-primary);box-shadow:0 18px 42px rgba(0,0,0,.42)}
@media(max-width:390px){.pwr-picker{top:auto;bottom:0;right:0;left:0;width:100vw;max-height:72vh;border-radius:16px 16px 0 0;padding:12px}}
.pwr-picker header{display:flex;align-items:center;padding:4px 6px 10px}.pwr-picker header strong{font-size:14px}.pwr-picker header button{margin-left:auto}
.pwr-picker input[type='search']{box-sizing:border-box;width:calc(100% - 12px);margin:0 6px 8px;height:30px;padding:0 9px;border:1px solid var(--vk-border-l2);border-radius:8px;background:var(--vk-bg-base);color:inherit;font:inherit}
.pwr-picker input[type='search']:focus-visible{outline:2px solid var(--vk-border-focus);outline-offset:-2px}
.pwr-picker-group-title{margin:6px 8px 2px;font-size:11px;color:var(--vk-text-tertiary);text-transform:uppercase;letter-spacing:.4px}
.pwr-picker-list{display:grid;gap:4px;overflow:auto}.pwr-picker-list button{display:flex;align-items:center;gap:10px;min-height:42px;padding:8px 10px;border:0;border-radius:9px;background:transparent;color:inherit;text-align:left}.pwr-picker-list button:hover,.pwr-picker-list button:focus-visible{background:var(--vk-fill-hover);outline:2px solid var(--vk-border-focus);outline-offset:-2px}
.pwr-management-center{position:fixed;inset:0;z-index:70;margin:auto;width:min(640px,calc(100vw - 32px));height:max-content;max-height:min(70vh,720px);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--vk-border-l2);border-radius:14px;background:var(--vk-bg-elevated);color:var(--vk-text-primary);box-shadow:0 24px 80px rgba(0,0,0,.56)}
.pwr-management-header{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 10px 0 14px;border-bottom:1px solid var(--vk-border-l1)}.pwr-management-modes{display:flex;align-items:center;gap:4px}.pwr-management-modes button,.pwr-management-filters button,.pwr-management-footer button,.pwr-management-target button{height:30px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--vk-text-secondary);font:inherit;cursor:pointer}.pwr-management-modes button[aria-selected='true'],.pwr-management-filters button[aria-pressed='true']{background:var(--vk-fill-selected);color:var(--vk-text-primary)}
.pwr-management-search{height:44px;margin:10px 12px 6px;display:flex;align-items:center;gap:8px;padding:0 11px;border:1px solid var(--vk-border-l2);border-radius:10px;background:var(--vk-bg-base)}.pwr-management-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:inherit;font:inherit}
.pwr-management-filters{display:flex;align-items:center;gap:4px;padding:0 12px 8px;overflow-x:auto}.pwr-management-filters button:disabled{opacity:.45;cursor:not-allowed}.pwr-management-scope{margin-left:auto;color:var(--vk-text-tertiary);font-size:11px;white-space:nowrap}
.pwr-management-advanced-filters{display:flex;align-items:center;gap:5px;padding:0 12px 8px;overflow-x:auto}.pwr-management-advanced-filters select{height:28px;max-width:150px;padding:0 24px 0 7px;border:1px solid var(--vk-border-l2);border-radius:7px;background:var(--vk-bg-base);color:var(--vk-text-secondary);font:inherit;font-size:11px}
.pwr-management-notice{margin:0 12px 8px;padding:7px 9px;border-radius:8px;background:var(--vk-fill-hover);color:var(--vk-text-secondary);font-size:12px}
.pwr-management-protected{margin:0 12px 8px;display:grid;gap:5px;padding:9px;border:1px solid var(--vk-border-l2);border-radius:9px;background:var(--vk-bg-layer-1)}.pwr-management-protected>strong{font-size:12px}.pwr-management-protected-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;min-height:32px}.pwr-management-protected-row>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pwr-management-protected-row>small{color:var(--vk-text-tertiary)}.pwr-management-protected-row>button{height:27px;padding:0 8px;border:1px solid var(--vk-border-l2);border-radius:7px;background:var(--vk-bg-elevated);color:inherit}
.pwr-management-list{min-height:120px;max-height:420px;overflow:auto;padding:4px 10px 8px}.pwr-management-group h3{margin:9px 8px 4px;color:var(--vk-text-tertiary);font-size:11px;font-weight:650;text-transform:uppercase;letter-spacing:.04em}
.pwr-management-row{display:flex;align-items:center;gap:7px;min-height:42px;padding:2px 4px;border-radius:9px}.pwr-management-row:hover,.pwr-management-row-selected{background:var(--vk-fill-hover)}.pwr-management-row>input{flex:none}.pwr-management-row-main{flex:1;min-width:0;min-height:38px;display:flex;align-items:center;gap:10px;padding:0 7px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.pwr-management-row-main:focus-visible{outline:2px solid var(--vk-border-focus);outline-offset:-2px;border-radius:8px}.pwr-management-row-copy{display:grid;min-width:0;flex:1}.pwr-management-row-copy strong,.pwr-management-row-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pwr-management-row-copy strong{font-size:13px}.pwr-management-row-copy small{color:var(--vk-text-tertiary);font-size:11px}.pwr-management-status{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--vk-text-tertiary);font-size:10px}.pwr-management-star{width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:7px;background:transparent;color:var(--vk-text-tertiary);cursor:pointer}
.pwr-management-info{width:28px;height:28px;flex:none;display:grid;place-items:center;border:0;border-radius:7px;background:transparent;color:var(--vk-text-tertiary);cursor:pointer}.pwr-management-info[aria-expanded="true"]{color:var(--vk-text-primary);background:var(--vk-fill-hover)}
.pwr-management-row-desc{color:var(--vk-text-tertiary);font-size:11px;opacity:.92}
.pwr-management-detail{margin:0 12px 8px;display:grid;gap:7px;padding:10px 11px;border:1px solid var(--vk-border-l2);border-radius:10px;background:var(--vk-bg-layer-1)}.pwr-management-detail-header{display:flex;align-items:center;justify-content:space-between;gap:8px}.pwr-management-detail-header strong{font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pwr-management-detail-header .pwr-icon{width:26px;height:26px;display:grid;place-items:center;border:0;border-radius:7px;background:transparent;color:var(--vk-text-tertiary);cursor:pointer}.pwr-management-detail-desc{margin:0;font-size:11.5px;line-height:1.5;color:var(--vk-text-secondary);white-space:pre-line;overflow-wrap:anywhere}.pwr-management-detail-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:5px 12px}.pwr-management-detail-field{display:grid;gap:1px;min-width:0}.pwr-management-detail-field span{color:var(--vk-text-tertiary);font-size:10px;text-transform:uppercase;letter-spacing:.04em}.pwr-management-detail-field small{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pwr-management-footer{min-height:48px;display:flex;align-items:center;gap:6px;padding:8px 12px;border-top:1px solid var(--vk-border-l1);background:var(--vk-bg-layer-1)}.pwr-management-footer input,.pwr-management-footer select{height:30px;min-width:0;padding:0 8px;border:1px solid var(--vk-border-l2);border-radius:8px;background:var(--vk-bg-base);color:inherit}.pwr-management-footer button{border:1px solid var(--vk-border-l2);background:var(--vk-bg-layer-2)}.pwr-management-footer button:disabled{opacity:.45;cursor:not-allowed}
.pwr-management-target{position:absolute;inset:auto 14px 14px auto;z-index:2;min-width:230px;max-height:300px;display:grid;gap:4px;padding:10px;border:1px solid var(--vk-border-l2);border-radius:11px;background:var(--vk-bg-elevated);box-shadow:0 16px 42px rgba(0,0,0,.4)}.pwr-management-target strong{padding:5px 8px}.pwr-management-target button{text-align:left;background:var(--vk-bg-layer-1)}
.pwr-undo-toast{position:absolute;right:14px;bottom:14px;z-index:65;display:flex;align-items:center;gap:12px;padding:9px 10px 9px 13px;border:1px solid var(--vk-border-l2);border-radius:10px;background:var(--vk-bg-elevated);box-shadow:0 12px 34px rgba(0,0,0,.4);color:var(--vk-text-primary)}.pwr-undo-toast button{height:28px;padding:0 9px;border:0;border-radius:7px;background:var(--vk-fill-selected);color:inherit;cursor:pointer}
.pwr-recovery-note{color:var(--vk-text-tertiary);font-size:12px}.pwr-recovery-rendition{margin:12px 0;padding:10px;border:1px solid var(--vk-border-l2);border-radius:9px;background:var(--vk-bg-layer-1);text-align:left}
.pwr-status{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.pwr-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
/* Unified sidebar and pane-search polish. Keep host geometry unchanged. */
.pwr-rail{gap:8px;padding:10px 5px;border-right:1px solid var(--vk-border-l1);background:color-mix(in srgb,var(--vk-bg-layer-1) 88%,var(--vk-bg-base));box-shadow:inset -1px 0 color-mix(in srgb,var(--vk-border-l2) 42%,transparent)}
.pwr-rail button,.pwr-icon{width:34px;height:34px;border-radius:10px;transition:background-color 140ms ease-out,color 140ms ease-out,box-shadow 140ms ease-out,transform 140ms ease-out}
.pwr-rail svg{width:18px;height:18px}
.pwr-rail button:hover,.pwr-rail button:focus-visible,.pwr-icon:hover,.pwr-icon:focus-visible{background:color-mix(in srgb,var(--vk-fill-hover) 82%,var(--vk-bg-layer-2));outline:0;box-shadow:inset 0 0 0 1px var(--vk-border-l2)}
.pwr-rail button:active,.pwr-icon:active{transform:scale(.96)}
.pwr-rail .pwr-active{color:var(--vk-text-primary);background:color-mix(in srgb,var(--vk-fill-selected) 78%,var(--vk-bg-elevated));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--vk-accent) 42%,var(--vk-border-l2)),0 4px 12px color-mix(in srgb,var(--vk-bg-base) 55%,transparent)}
.pwr-rail-fonts{gap:5px;padding-top:9px;border-top:1px solid var(--vk-border-l1)}
.pwr-picker{width:min(380px,calc(100vw - 24px));padding:12px;border-color:color-mix(in srgb,var(--vk-border-l2) 82%,transparent);border-radius:16px;background:color-mix(in srgb,var(--vk-bg-elevated) 96%,transparent);box-shadow:0 22px 64px color-mix(in srgb,var(--vk-bg-base) 72%,transparent);backdrop-filter:blur(18px)}
.pwr-picker header{padding:2px 4px 11px}.pwr-picker header strong{font-size:15px;letter-spacing:-.01em}
.pwr-picker input[type='search']{width:100%;height:38px;margin:0 0 10px;padding:0 12px;border-color:var(--vk-border-l1);border-radius:10px;background:var(--vk-bg-layer-1);transition:border-color 140ms ease-out,box-shadow 140ms ease-out,background-color 140ms ease-out}
.pwr-picker input[type='search']:focus-visible{outline:0;border-color:color-mix(in srgb,var(--vk-accent) 62%,var(--vk-border-l2));background:var(--vk-bg-base);box-shadow:0 0 0 3px color-mix(in srgb,var(--vk-accent) 14%,transparent)}
.pwr-picker-list{gap:3px}.pwr-picker-list button{min-height:44px;border-radius:10px;transition:background-color 120ms ease-out,color 120ms ease-out}.pwr-picker-list button:hover,.pwr-picker-list button:focus-visible{outline:0;background:var(--vk-fill-hover);box-shadow:inset 0 0 0 1px var(--vk-border-l1)}
.pwr-management-center{width:min(640px,calc(100vw - 32px));max-height:min(70vh,720px);border-color:color-mix(in srgb,var(--vk-border-l2) 78%,transparent);border-radius:16px;background:var(--vk-bg-elevated);box-shadow:0 28px 88px color-mix(in srgb,var(--vk-bg-base) 78%,transparent)}
.pwr-management-header{height:54px;flex:none;padding:0 10px 0 16px;border-bottom-color:var(--vk-border-l1);background:var(--vk-bg-layer-1)}
.pwr-management-title,.pwr-management-header-actions,.pwr-management-scope{display:flex;align-items:center}.pwr-management-title{gap:9px}.pwr-management-title>svg{color:var(--vk-text-secondary)}.pwr-management-title strong{font-size:15px;font-weight:680}.pwr-management-header-actions{gap:8px}.pwr-management-scope{gap:6px;margin:0;padding:5px 8px;border:1px solid var(--vk-border-l1);border-radius:999px;background:var(--vk-bg-base);font-size:11px}
.pwr-management-modes{flex:none;gap:3px;margin:10px 14px 0;padding:3px;border:1px solid var(--vk-border-l1);border-radius:11px;background:var(--vk-bg-base)}
.pwr-management-modes button{height:32px;display:flex;align-items:center;justify-content:center;gap:7px;padding:0 13px;border-radius:8px;font-weight:620;transition:background-color 130ms ease-out,color 130ms ease-out,box-shadow 130ms ease-out}
.pwr-management-modes button[aria-selected='true']{background:var(--vk-bg-elevated);box-shadow:inset 0 0 0 1px var(--vk-border-l2),0 3px 10px color-mix(in srgb,var(--vk-bg-base) 46%,transparent)}
.pwr-management-search{height:48px;flex:none;margin:10px 14px 8px;gap:10px;padding:0 10px 0 14px;border-color:var(--vk-border-l1);border-radius:12px;background:var(--vk-bg-layer-1);color:var(--vk-text-tertiary);transition:border-color 150ms ease-out,box-shadow 150ms ease-out,background-color 150ms ease-out}
.pwr-management-search:focus-within{border-color:color-mix(in srgb,var(--vk-accent) 68%,var(--vk-border-l2));background:var(--vk-bg-base);color:var(--vk-text-secondary);box-shadow:0 0 0 3px color-mix(in srgb,var(--vk-accent) 14%,transparent),0 8px 24px color-mix(in srgb,var(--vk-bg-base) 32%,transparent)}
.pwr-management-search input{height:100%;font-size:14px;line-height:1.4}.pwr-management-search input::placeholder{color:var(--vk-text-tertiary);opacity:.86}.pwr-management-search kbd{flex:none;padding:3px 6px;border:1px solid var(--vk-border-l1);border-radius:6px;background:var(--vk-bg-base);color:var(--vk-text-tertiary);font:inherit;font-size:10px}.pwr-management-search-clear{width:28px;height:28px;flex:none;display:grid;place-items:center;border:0;border-radius:7px;background:transparent;color:var(--vk-text-tertiary);cursor:pointer}.pwr-management-search-clear:hover{background:var(--vk-fill-hover);color:var(--vk-text-primary)}
.pwr-management-filters{flex:none;flex-wrap:wrap;gap:5px;padding:0 14px 9px;overflow:visible}
.pwr-management-filters button{height:30px;display:flex;align-items:center;gap:6px;padding:0 9px;border:1px solid transparent;border-radius:8px;font-size:12px;white-space:nowrap;transition:background-color 120ms ease-out,border-color 120ms ease-out,color 120ms ease-out}.pwr-management-filters button small{min-width:15px;color:var(--vk-text-tertiary);font-size:10px;font-variant-numeric:tabular-nums;text-align:right}.pwr-management-filters button svg{color:var(--vk-text-tertiary)}
.pwr-management-filters button:hover:not(:disabled){border-color:var(--vk-border-l1);background:var(--vk-fill-hover);color:var(--vk-text-primary)}
.pwr-management-filters button[aria-pressed='true']{border-color:var(--vk-border-l2);background:var(--vk-bg-layer-2);color:var(--vk-text-primary);box-shadow:inset 0 1px color-mix(in srgb,var(--vk-text-primary) 5%,transparent)}.pwr-management-filters button[aria-pressed='true'] svg{color:currentColor}.pwr-management-filter-toggle{margin-left:auto}.pwr-management-filter-toggle[aria-expanded='true']>svg:last-child{transform:rotate(180deg)}.pwr-management-filter-toggle>svg:last-child{transition:transform 130ms ease-out}
.pwr-management-advanced-filters.ys-field{display:grid;gap:8px;margin:0 14px 10px;padding:10px 11px;border:1px solid var(--vk-border-l1);border-radius:11px;background:var(--vk-bg-layer-1);overflow:visible}.pwr-management-advanced-filters>header{display:flex;align-items:center;justify-content:space-between;gap:10px}.pwr-management-advanced-filters>header strong{font-size:12px}.pwr-management-advanced-filters>header button{height:28px;padding:0 8px;border:0;border-radius:7px;background:transparent;color:var(--vk-text-secondary);cursor:pointer}.pwr-management-advanced-filters>header button:hover:not(:disabled){background:var(--vk-fill-hover);color:var(--vk-text-primary)}.pwr-management-advanced-filters>header button:disabled{opacity:.42}.pwr-management-filter-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 10px}.pwr-management-filter-grid label{display:grid;gap:4px;min-width:0}.pwr-management-filter-grid label>span{color:var(--vk-text-tertiary);font-size:10.5px}
.pwr-management-advanced-filters select{box-sizing:border-box;width:100%;max-width:none;height:34px;padding:0 28px 0 10px;border-color:var(--vk-border-l1);border-radius:9px;background-color:var(--vk-bg-layer-1);color:var(--vk-text-secondary);font-size:12px;transition:border-color 120ms ease-out,background-color 120ms ease-out,box-shadow 120ms ease-out}
.pwr-management-advanced-filters select:hover{border-color:var(--vk-border-l2);background-color:var(--vk-bg-base)}.pwr-management-advanced-filters select:focus-visible{outline:0;border-color:var(--vk-border-focus);box-shadow:0 0 0 3px color-mix(in srgb,var(--vk-accent) 12%,transparent)}
.pwr-management-utility-actions{display:flex;align-items:center;gap:6px;padding:0 14px 8px}.pwr-management-utility-actions button{height:30px;display:flex;align-items:center;gap:6px;padding:0 9px;border:1px solid var(--vk-border-l1);border-radius:8px;background:transparent;color:var(--vk-text-secondary);cursor:pointer}.pwr-management-utility-actions button:hover:not(:disabled){background:var(--vk-fill-hover);color:var(--vk-text-primary)}.pwr-management-utility-actions button:disabled{opacity:.42}
.pwr-management-search-state{min-height:34px;display:flex;align-items:center;gap:8px;margin:0 14px 8px;padding:7px 9px;border:1px solid var(--vk-border-l1);border-radius:9px;background:var(--vk-bg-layer-1);color:var(--vk-text-secondary);font-size:12px}.pwr-management-search-state-partial{color:var(--vk-state-warn,#f0b45a)}.pwr-management-search-state-error{color:var(--vk-state-error,#ee6b72)}.pwr-management-search-state button{margin-left:auto;height:26px;padding:0 8px;border:1px solid var(--vk-border-l2);border-radius:7px;background:var(--vk-bg-elevated);color:var(--vk-text-primary);cursor:pointer}.pwr-management-spinner{width:13px;height:13px;flex:none;border:2px solid var(--vk-border-l2);border-top-color:var(--vk-accent);border-radius:50%;animation:pwr-management-spin 700ms linear infinite}@keyframes pwr-management-spin{to{transform:rotate(360deg)}}
.pwr-management-list{flex:1;min-height:120px;max-height:none;padding:5px 12px 10px;overflow:auto;scrollbar-gutter:stable}.pwr-management-group h3,.pwr-management-similar-title{display:flex;align-items:center;gap:7px;margin:11px 9px 5px;color:var(--vk-text-tertiary);font-size:10.5px;font-weight:650;text-transform:none;letter-spacing:.02em}.pwr-management-group h3 small{font-size:10px;font-weight:500;font-variant-numeric:tabular-nums}
.pwr-management-row{min-height:48px;padding:3px 5px;border-radius:10px;transition:background-color 120ms ease-out,box-shadow 120ms ease-out}.pwr-management-row:hover,.pwr-management-row-selected{background:var(--vk-bg-layer-1);box-shadow:inset 0 0 0 1px var(--vk-border-l1)}
.pwr-management-row:focus-within{background:var(--vk-bg-layer-1)}
.pwr-management-row-main{min-height:42px;gap:11px;padding:0 8px}.pwr-management-row-copy{gap:1px}.pwr-management-row-copy strong{font-size:14px;font-weight:640}.pwr-management-row-copy small{font-size:11.5px}
.pwr-management-info,.pwr-management-star,.pwr-management-target-trigger{width:30px;height:30px;flex:none;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:var(--vk-text-tertiary);cursor:pointer;transition:background-color 120ms ease-out,color 120ms ease-out}.pwr-management-info:hover,.pwr-management-star:hover,.pwr-management-target-trigger:hover{background:var(--vk-fill-hover);color:var(--vk-text-primary)}
.pwr-management-create-area{flex:none;padding:7px 14px 10px;border-top:1px solid var(--vk-border-l1)}.pwr-management-create-trigger{height:32px;display:flex;align-items:center;gap:7px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--vk-text-secondary);cursor:pointer}.pwr-management-create-trigger:hover{background:var(--vk-fill-hover);color:var(--vk-text-primary)}.pwr-management-create-editor{max-height:180px;display:grid;gap:6px;overflow:auto}.pwr-management-custom-group,.pwr-management-new-group{display:flex;align-items:center;gap:5px}.pwr-management-custom-group input,.pwr-management-new-group input{height:32px;min-width:0;flex:1;padding:0 9px;border:1px solid var(--vk-border-l1);border-radius:8px;background:var(--vk-bg-base);color:var(--vk-text-primary)}.pwr-management-custom-group button,.pwr-management-new-group button{height:30px;min-width:30px;padding:0 8px;border:1px solid var(--vk-border-l1);border-radius:8px;background:var(--vk-bg-layer-2);color:var(--vk-text-secondary);cursor:pointer}
.pwr-management-footer{min-height:54px;flex:none;flex-wrap:wrap;padding:9px 14px calc(9px + env(safe-area-inset-bottom));background:var(--vk-bg-layer-1)}.pwr-management-footer>strong{margin-right:4px;font-size:12px}.pwr-management-footer select{max-width:140px}
/* Official DSH collapsed sidebar: scope through our public footer launchers, not a build hash. */
[class*='_root']:is(:has([data-subagent-monitor-sidebar]),:has([data-creator-studio-launcher])){border-right:1px solid var(--vk-border-l1,rgba(255,255,255,.08));background:color-mix(in srgb,var(--vk-bg-layer-1,#1b1b1e) 90%,var(--vk-bg-base,#151517))}
[class*='_root'][class*='_collapsed']:is(:has([data-subagent-monitor-sidebar]),:has([data-creator-studio-launcher])){padding:12px 10px 8px}
[class*='_root'][class*='_collapsed']:is(:has([data-subagent-monitor-sidebar]),:has([data-creator-studio-launcher])) [class*='_logoRow']{height:42px;margin-bottom:10px}
[class*='_root'][class*='_collapsed']:is(:has([data-subagent-monitor-sidebar]),:has([data-creator-studio-launcher])) :is([class*='_iconButton'],[class*='_newSession']){width:36px;height:36px;border-radius:10px;transition:background-color 140ms ease-out,color 140ms ease-out,box-shadow 140ms ease-out,transform 140ms ease-out}
[class*='_root'][class*='_collapsed']:is(:has([data-subagent-monitor-sidebar]),:has([data-creator-studio-launcher])) :is([class*='_iconButton'],[class*='_newSession']):hover{background:var(--vk-fill-hover,rgba(255,255,255,.08));box-shadow:inset 0 0 0 1px var(--vk-border-l1,rgba(255,255,255,.08))}
[class*='_root'][class*='_collapsed']:is(:has([data-subagent-monitor-sidebar]),:has([data-creator-studio-launcher])) :is([class*='_iconButton'],[class*='_newSession'])[class*='_active']{background:var(--vk-fill-selected,rgba(89,139,255,.18));color:var(--vk-text-primary,#f5f7fb);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--vk-accent,#5b8cff) 42%,transparent)}
[class*='_root'][class*='_collapsed']:is(:has([data-subagent-monitor-sidebar]),:has([data-creator-studio-launcher])) :is([class*='_iconButton'],[class*='_newSession']):active{transform:scale(.96)}
[class*='_root'][class*='_collapsed']:is(:has([data-subagent-monitor-sidebar]),:has([data-creator-studio-launcher])) [class*='_footArea']{gap:4px;padding-top:9px;border-top:1px solid var(--vk-border-l1,rgba(255,255,255,.08))}
[class*='_root'][class*='_collapsed']:is(:has([data-subagent-monitor-sidebar]),:has([data-creator-studio-launcher])) [class*='_footerActions']{gap:2px}
@media(max-width:760px){.pwr-management-center{max-height:calc(100vh - 20px)}.pwr-management-scope{max-width:180px;overflow:hidden;text-overflow:ellipsis}}
@media(max-width:600px){.pwr-root[data-region='right'] .pwr-picker{top:52px;right:6px;width:min(340px,calc(100vw - 48px))}.pwr-menu{right:4px;width:min(232px,calc(100vw - 16px))}.pwr-management-center{inset:0;width:100vw;height:100vh;height:100dvh;max-height:none;margin:0;border:0;border-radius:0}.pwr-management-header{height:52px;padding-left:12px}.pwr-management-title strong{font-size:14px}.pwr-management-scope{max-width:132px;padding:4px 6px}.pwr-management-modes{margin:8px 10px 0}.pwr-management-modes button{flex:1}.pwr-management-search{margin:8px 10px}.pwr-management-filters{gap:4px;padding:0 10px 8px}.pwr-management-filters button{flex:1 1 auto;justify-content:center}.pwr-management-filter-toggle{margin-left:0}.pwr-management-advanced-filters.ys-field{margin:0 10px 8px}.pwr-management-filter-grid{grid-template-columns:1fr}.pwr-management-utility-actions{padding:0 10px 8px}.pwr-management-list{padding:4px 8px 8px}.pwr-management-create-area{padding-inline:10px}.pwr-management-footer{flex-wrap:wrap;padding-inline:10px}.pwr-management-target{position:fixed;inset:auto 8px 8px;max-height:55vh;overflow:auto}}
@media(pointer:coarse){.pwr-tabs{min-height:48px;height:48px}.pwr-tab-item,.pwr-tab{height:44px}.pwr-tab-actions button,.pwr-management-row,.pwr-management-filters button,.pwr-management-target-trigger,.pwr-management-info,.pwr-management-star,.pwr-management-create-trigger{min-height:44px}}
@media(prefers-reduced-motion:reduce){.pwr-management-spinner{animation:none}.pwr-management-filter-toggle>svg:last-child,.pwr-management-row,.pwr-management-modes button,.pwr-management-search,.pwr-management-filters button{transition:none}}

/* V3 2.8 responsive + a11y layer */
.pwr-root *,.pwr-root *::before,.pwr-root *::after{box-sizing:border-box}
.pwr-root :focus-visible{outline:2px solid var(--vk-border-focus);outline-offset:1px}
@media(pointer:coarse){
  .pwr-rail button,.pwr-icon,.pwr-tab,.pwr-menu-item,.pwr-tip button{min-width:44px;min-height:44px}
  .pwr-rail{width:52px}
  .pwr-root[data-region='right'] .pwr-body{left:52px;width:calc(100% - 52px)}
  .pwr-tabs{--pwr-chrome-height:48px;height:48px}
  .pwr-tip::after{font-size:13px}
}
@media(max-width:390px){
  .pwr-root{--pwr-tab-width:min(30vw,120px);--pwr-control-size:28px;--pwr-chrome-height:38px}
  .pwr-tabs{gap:2px;padding:4px}
  .pwr-menu{max-width:min(92vw,280px)}
  .pwr-root *{scrollbar-width:thin}
}
@media(prefers-contrast:more){
  .pwr-root{--vk-border-l1:rgba(255,255,255,.55);--vk-border-l2:rgba(255,255,255,.7)}
  .pwr-tab[data-active='true']{outline:1px solid var(--vk-text-primary)}
  .pwr-icon[data-status='active']{outline:1px solid var(--vk-state-positive)}
  .pwr-icon[data-status='critical']{outline:1px solid var(--vk-state-error)}
}
@media(prefers-reduced-motion:reduce){
  .pwr-root *{transition:none!important;animation:none!important;scroll-behavior:auto!important}
}
.pwr-explorer{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;background:var(--vk-bg-base)}
.pwr-explorer-resource-actions{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:6px 8px;border-bottom:1px solid var(--vk-border-l1);background:var(--vk-bg-layer-1)}
.pwr-explorer-resource-actions button,.pwr-explorer-import{min-height:28px;padding:3px 7px;border-radius:7px;font-size:11px}.pwr-explorer-import{display:inline-flex;align-items:center;cursor:pointer;color:var(--vk-text-secondary);background:var(--vk-fill-hover)}
.pwr-explorer-action-draft{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:5px}.pwr-explorer-action-draft input{min-width:0}
.pwr-explorer-proposal{display:grid;gap:7px;margin:7px;padding:9px;border:1px solid var(--vk-border-l2);border-radius:10px;background:var(--vk-bg-elevated);box-shadow:0 10px 28px rgba(0,0,0,.24)}
.pwr-explorer-tree{flex:1;min-height:0}.pwr-explorer-row{border-radius:6px;color:var(--vk-text-secondary)}.pwr-explorer-row:hover,.pwr-explorer-row[aria-selected='true']{background:var(--vk-fill-hover);color:var(--vk-text-primary)}.pwr-explorer-row[aria-checked='true']{box-shadow:inset 2px 0 0 var(--vk-accent)}
.pwr-explorer-name{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis}.pwr-explorer-primary{color:var(--vk-accent)}.pwr-explorer-checked{color:var(--vk-state-positive)}
.pwr-explorer-metadata-card{position:absolute;z-index:12;right:8px;top:88px;width:min(280px,calc(100% - 16px));display:grid;gap:4px;padding:10px;border:1px solid var(--vk-border-l2);border-radius:10px;background:var(--vk-bg-elevated);box-shadow:0 12px 34px rgba(0,0,0,.36);pointer-events:none}.pwr-explorer-metadata-card span{color:var(--vk-text-tertiary);font-size:11px;overflow-wrap:anywhere}
.pwr-composer-reference-dock{display:flex;flex-wrap:wrap;align-items:center;gap:5px;padding:5px 8px}.pwr-reference-chip{display:inline-flex;align-items:center;gap:4px;max-width:280px;padding:4px 6px;border:1px solid var(--vk-border-l1);border-radius:999px;background:var(--vk-bg-layer-1);font-size:11px}.pwr-reference-stale{border-color:var(--vk-state-warn)}.pwr-reference-send-blocked{color:var(--vk-text-tertiary);font-size:11px}
@media(max-width:600px){.pwr-explorer-resource-actions{overflow-x:auto;flex-wrap:nowrap}.pwr-explorer-proposal{position:absolute;z-index:20;inset:auto 6px 6px}.pwr-explorer-metadata-card{position:absolute;top:auto;bottom:8px}}
`

/** 供 conformance 测试断言 chrome 样式串来自 token registry。 */

export const DSH_SUBAGENT_MONITOR_VIEW_KIND = 'subagent.monitor' as const

export function groupIds(node: PaneSplitNodeV1, output: string[] = []): string[] {
  if (node.type === 'group') output.push(node.groupId)
  else { groupIds(node.first, output); groupIds(node.second, output) }
  return output
}

export function targetGroup(state: PaneWorkspaceV1, view: PaneViewInstanceV1, region: PaneRegionId): PaneGroupV1 | undefined {
  return Object.values(state.groups)
    .filter(group => group.region === region && (!group.locked || group.role === view.role))
    .sort((left, right) => Number(left.role !== view.role && left.role !== 'general') - Number(right.role !== view.role && right.role !== 'general') || Number(left.locked) - Number(right.locked) || left.id.localeCompare(right.id))[0]
}

export function iconForView(view: PaneViewInstanceV1): WorkbenchIconName {
  if (view.kind.includes('git')) return 'git'
  if (view.kind.includes('subagent') || view.kind.includes('agent')) return 'agents'
  if (view.role === 'utility' || view.kind.includes('terminal')) return 'terminal'
  if (view.role === 'navigator' || view.kind.includes('file')) return 'file'
  if (view.kind.includes('media')) return 'media'
  return 'document'
}

export function splitIcon(edge: 'left' | 'right' | 'top' | 'bottom'): WorkbenchIconName {
  return edge === 'left' ? 'split-left'
    : edge === 'right' ? 'split-right'
      : edge === 'top' ? 'split-up'
        : 'split-down'
}

export function menuItem(icon: WorkbenchIconName, label: string): readonly [ReactNode, ReactNode] {
  return [createElement(WorkbenchIcon, { name: icon, size: 16 }), createElement('span', null, label)]
}

export function splitFits(edge: PaneDragTargetV1['edge'], width: number, height: number): boolean {
  return edge === 'left' || edge === 'right'
    ? width >= PANE_MIN_WIDTH * 2 + SPLITTER_SIZE
    : edge === 'top' || edge === 'bottom'
      ? height >= PANE_MIN_HEIGHT * 2 + SPLITTER_SIZE
      : true
}

/** chrome 消费的 canonical token（fallback 由 visual kit registry 单点提供）。 */

export function paneDropTargetLabel(target: PaneDragTargetV1): string {
  if (!target.enabled) {
    const reason = target.reason === undefined ? formatT('drag.notAllowed', {}) : t(`drag.reason.${target.reason}`)
    return formatT('drag.dropUnavailable', { reason })
  }
  if (target.edge === 'center' && target.index !== undefined) return t('drag.reorderHere')
  return target.edge === 'center'
    ? t('drag.moveHere')
    : formatT('drag.splitEdge', { edge: t(`drag.edge.${target.edge}`) })
}
