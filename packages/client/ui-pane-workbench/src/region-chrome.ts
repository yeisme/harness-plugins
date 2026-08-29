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
} from './artifacts.js'
import { ArtifactRefSchema } from '@yeisme/dsh-pane-protocol'
import { PaneArtifactHandoffMenu, type ArtifactHandoffTargetV1 } from './handoff-menu.js'
import {
  resolvePaneManagementShortcut,
  type PaneConversationSearchHostV1,
  type PaneManagementKeymapV1,
  type PaneWorkspaceContextProviderV1,
} from './management.js'
import type { PaneDragTargetV1 } from './interactions.js'
import { PaneResizeSession } from './interactions.js'
import type { PaneWorkbenchController } from './controller.js'
import { isPaneCoreViewId, openPaneWorkbenchCoreView, DSH_WORKSPACE_DESIGNER_VIEW_KIND, type PaneCoreViewId } from './core-pane.js'
import { DSH_EXPLORER_VIEW_KIND, openExplorerNavigator } from './explorer/provider.js'
import { openSourceControlNavigator } from './git/provider.js'
import { DSH_SOURCE_CONTROL_VIEW_KIND } from './git/source-control.js'
import { PaneTabActions, PaneTabStrip } from './tabs.js'
import { PaneCloseUndoToast, PaneManagementCenter } from './management-center.js'
import type { PaneManagementMode } from './management.js'
import type { PaneViewRegistry, PaneViewRegistrationV1 } from './view-registry.js'
import { WorkbenchIcon } from './icon.js'
import type { WorkbenchIconName } from './icon.js'
import { formatT, getLocaleRevision, subscribeLocale, t, tWithFallback } from './i18n/locale.js'
import {
  applyWorkbenchFontSizeTo,
  getWorkbenchFontSize,
  stepWorkbenchFontSize,
  subscribeWorkbenchFontSize,
  WORKBENCH_FONT_SIZE_MAX,
  WORKBENCH_FONT_SIZE_MIN,
} from './font-scale.js'
import type {
  PaneGroupV1,
  PaneBulkCloseProtectedViewV1,
  PaneRegionId,
  PaneSplitNodeV1,
  PaneViewInstanceV1,
  PaneWorkspaceV1,
} from './workspace.js'

export type PaneWorkspaceRegionMode = 'hidden' | 'rail' | 'dock' | 'sheet' | 'maximized'

export interface PaneRegionChromeProps {
  readonly region: PaneRegionId
  readonly mode: PaneWorkspaceRegionMode
  readonly width: number
  readonly height: number
  readonly visible: boolean
  readonly maximized: boolean
  readonly registry: PaneViewRegistry
  readonly controller: PaneWorkbenchController
  /** Resolves DSH-owned React content for an allowlisted built-in Core Pane view. */
  readonly renderCoreView?: (id: PaneCoreViewId) => ReactNode
  /** Session artifact handoff wiring; the view More menu gains the handoff section when present. */
  readonly handoff?: PaneArtifactHandoffContextV1
  /** Optional owner-authored conversation search. Never used by the default local search path. */
  readonly conversationSearch?: PaneConversationSearchHostV1
  /** Additive shared keymap override. */
  readonly keymap?: Partial<PaneManagementKeymapV1>
  readonly workspaceContext?: PaneWorkspaceContextProviderV1
}

/**
 * Session-scoped artifact handoff wiring shared by the Core host and the Tier 0
 * overlay chrome. `onDispatch` routes through the probed channel
 * (`dispatchArtifactHandoff` with the local intent dispatcher as fallback).
 */
export interface PaneArtifactHandoffContextV1 {
  readonly channel: ArtifactHandoffChannelV1
  readonly listTargets: () => readonly ArtifactHandoffTargetV1[]
  readonly getContext: () => PaneContextV1
  /** ArtifactRefV1 candidate exposed by a view; invalid refs fail closed inside the menu. */
  readonly sourceFor: (view: PaneViewInstanceV1) => unknown
  readonly hasAdmission?: (idempotencyKey: string) => boolean
  readonly onDispatch: (intent: ArtifactIntentV1) => unknown
  readonly onEvidence?: (record: ArtifactHandoffEvidenceV1) => void
}

/** Default view → artifact source convention: a provider-approved `metadata.artifactRef` projection. */
export function paneViewArtifactSource(view: PaneViewInstanceV1): unknown {
  return view.metadata?.['artifactRef']
}

interface ViewBoundaryProps {
  readonly view: PaneViewInstanceV1
  readonly onClose: () => void
  readonly children?: ReactNode
}

interface ViewBoundaryState { readonly error?: Error; readonly generation: number }
const PANE_MIN_WIDTH = 280
const PANE_MIN_HEIGHT = 180
const SPLITTER_SIZE = 5
const RIGHT_RAIL_WIDTH = 44
const DSH_SUBAGENT_MONITOR_VIEW_KIND = 'subagent.monitor' as const

function splitFits(edge: PaneDragTargetV1['edge'], width: number, height: number): boolean {
  return edge === 'left' || edge === 'right'
    ? width >= PANE_MIN_WIDTH * 2 + SPLITTER_SIZE
    : edge === 'top' || edge === 'bottom'
      ? height >= PANE_MIN_HEIGHT * 2 + SPLITTER_SIZE
      : true
}

/** chrome 消费的 canonical token（fallback 由 visual kit registry 单点提供）。 */
const CHROME_TOKENS: readonly PanelTokenName[] = ['bg-base','bg-elevated','text-primary','text-secondary','text-tertiary','text-link','border-l1','border-l2','border-focus','fill-hover','fill-selected','accent']
const CHROME_TOKEN_DECL = `${CHROME_TOKENS.map(name => `--vk-${name}:${panelVar(name)}`).join(';')};--vk-bg-layer-1:var(--vk-bg-base);--vk-bg-layer-2:var(--vk-bg-elevated)`

const REGION_STYLES = `.pwr-root{position:relative;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;color:var(--vk-text-primary);background:var(--vk-bg-base);font:var(--dsh-wb-font-size,14px)/1.4 var(--dsw-font-family,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);--pwr-tab-width:136px;--pwr-tab-height:34px;--pwr-chrome-height:42px;--pwr-control-size:30px;${CHROME_TOKEN_DECL}}
.pwr-rail{position:absolute;inset:0 auto 0 0;width:43px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 5px;box-sizing:border-box;background:var(--dsw-specific-sidebar-fill,#1c1c1f);z-index:3}
.pwr-rail-fonts{margin-top:auto;display:flex;flex-direction:column;gap:4px}
.pwr-rail button,.pwr-icon{width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:var(--vk-text-secondary);display:grid;place-items:center;cursor:pointer}
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
.pwr-management-center{width:min(720px,calc(100vw - 32px));max-height:min(78vh,760px);border-color:color-mix(in srgb,var(--vk-border-l2) 78%,transparent);border-radius:18px;background:color-mix(in srgb,var(--vk-bg-elevated) 98%,transparent);box-shadow:0 30px 96px color-mix(in srgb,var(--vk-bg-base) 78%,transparent);backdrop-filter:blur(20px)}
.pwr-management-header{height:56px;padding:0 12px 0 16px;border-bottom-color:var(--vk-border-l1);background:color-mix(in srgb,var(--vk-bg-layer-1) 72%,transparent)}
.pwr-management-modes{gap:3px;padding:3px;border:1px solid var(--vk-border-l1);border-radius:11px;background:var(--vk-bg-base)}
.pwr-management-modes button{height:32px;padding:0 13px;border-radius:8px;font-weight:620;transition:background-color 130ms ease-out,color 130ms ease-out,box-shadow 130ms ease-out}
.pwr-management-modes button[aria-selected='true']{background:var(--vk-bg-elevated);box-shadow:inset 0 0 0 1px var(--vk-border-l2),0 3px 10px color-mix(in srgb,var(--vk-bg-base) 46%,transparent)}
.pwr-management-search{height:48px;margin:12px 14px 8px;gap:10px;padding:0 14px;border-color:var(--vk-border-l1);border-radius:12px;background:var(--vk-bg-layer-1);color:var(--vk-text-tertiary);transition:border-color 150ms ease-out,box-shadow 150ms ease-out,background-color 150ms ease-out}
.pwr-management-search:focus-within{border-color:color-mix(in srgb,var(--vk-accent) 68%,var(--vk-border-l2));background:var(--vk-bg-base);color:var(--vk-text-secondary);box-shadow:0 0 0 3px color-mix(in srgb,var(--vk-accent) 14%,transparent),0 8px 24px color-mix(in srgb,var(--vk-bg-base) 32%,transparent)}
.pwr-management-search input{height:100%;font-size:14px;line-height:1.4}.pwr-management-search input::placeholder{color:var(--vk-text-tertiary);opacity:.86}
.pwr-management-filters{flex-wrap:wrap;gap:5px;padding:0 14px 9px;overflow:visible}
.pwr-management-filters button{height:30px;padding:0 10px;border:1px solid transparent;border-radius:8px;font-size:12px;transition:background-color 120ms ease-out,border-color 120ms ease-out,color 120ms ease-out}
.pwr-management-filters button:hover:not(:disabled){border-color:var(--vk-border-l1);background:var(--vk-fill-hover);color:var(--vk-text-primary)}
.pwr-management-filters button[aria-pressed='true']{border-color:var(--vk-border-l2);background:var(--vk-bg-layer-2);box-shadow:inset 0 1px color-mix(in srgb,var(--vk-text-primary) 5%,transparent)}
.pwr-management-advanced-filters.ys-field{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:center;gap:6px;padding:0 14px 10px;overflow:visible}
.pwr-management-advanced-filters select{box-sizing:border-box;width:100%;max-width:none;height:34px;padding:0 28px 0 10px;border-color:var(--vk-border-l1);border-radius:9px;background-color:var(--vk-bg-layer-1);color:var(--vk-text-secondary);font-size:12px;transition:border-color 120ms ease-out,background-color 120ms ease-out,box-shadow 120ms ease-out}
.pwr-management-advanced-filters select:hover{border-color:var(--vk-border-l2);background-color:var(--vk-bg-base)}.pwr-management-advanced-filters select:focus-visible{outline:0;border-color:var(--vk-border-focus);box-shadow:0 0 0 3px color-mix(in srgb,var(--vk-accent) 12%,transparent)}
.pwr-management-list{padding:5px 12px 10px;scrollbar-gutter:stable}.pwr-management-group h3{margin:11px 9px 5px;font-size:10.5px;letter-spacing:.08em}
.pwr-management-row{min-height:48px;padding:3px 5px;border-radius:10px;transition:background-color 120ms ease-out,box-shadow 120ms ease-out}.pwr-management-row:hover,.pwr-management-row-selected{background:var(--vk-bg-layer-1);box-shadow:inset 0 0 0 1px var(--vk-border-l1)}
.pwr-management-row:focus-within{background:var(--vk-bg-layer-1)}
.pwr-management-row-main{min-height:42px;gap:11px;padding:0 8px}.pwr-management-row-copy{gap:1px}.pwr-management-row-copy strong{font-size:13.5px;font-weight:640}.pwr-management-row-copy small{font-size:11.5px}
.pwr-management-info,.pwr-management-star{width:30px;height:30px;border-radius:8px;transition:background-color 120ms ease-out,color 120ms ease-out}.pwr-management-info:hover,.pwr-management-star:hover{background:var(--vk-fill-hover);color:var(--vk-text-primary)}
.pwr-management-footer{min-height:54px;padding:9px 14px;background:color-mix(in srgb,var(--vk-bg-layer-1) 84%,transparent)}
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
@media(max-width:760px){.pwr-management-advanced-filters.ys-field{grid-template-columns:repeat(2,minmax(0,1fr))}.pwr-management-center{max-height:calc(100vh - 20px)}}
@media(max-width:600px){.pwr-root[data-region='right'] .pwr-picker{position:fixed;top:56px;right:12px;width:min(340px,calc(100vw - 80px));max-height:min(520px,calc(100vh - 72px))}.pwr-menu{right:4px;width:min(232px,calc(100vw - 16px))}.pwr-management-center{width:calc(100vw - 16px);max-height:calc(100vh - 16px)}.pwr-management-scope{display:none}.pwr-management-footer{flex-wrap:wrap}}
@media(pointer:coarse){.pwr-tabs{min-height:48px;height:48px}.pwr-tab-item,.pwr-tab{height:44px}.pwr-tab-actions button,.pwr-management-row{min-height:44px}}
`

/** 供 conformance 测试断言 chrome 样式串来自 token registry。 */
export { REGION_STYLES }

export type HiddenBottomDropPhase = 'hidden' | 'preview' | 'ready'

export function resolveHiddenBottomDropPhase(clientY: number, viewportHeight: number, coarse = false): HiddenBottomDropPhase {
  const height = Math.max(0, viewportHeight)
  const distance = height - clientY
  const ready = coarse ? Math.max(88, Math.min(136, height * 0.12)) : Math.max(64, Math.min(112, height * 0.09))
  const preview = coarse ? Math.max(136, Math.min(208, height * 0.18)) : Math.max(104, Math.min(176, height * 0.14))
  return distance <= ready ? 'ready' : distance <= preview ? 'preview' : 'hidden'
}

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


class ViewBoundary extends Component<ViewBoundaryProps, ViewBoundaryState> {
  state: ViewBoundaryState = { generation: 0 }
  static getDerivedStateFromError(error: Error): Partial<ViewBoundaryState> { return { error } }
  render(): ReactNode {
    if (this.state.error === undefined) return createElement('div', { key: this.state.generation, 'data-pane-view-generation': this.state.generation }, this.props.children)
    return createElement('section', { role: 'alert', className: 'pwr-empty' },
      createElement('p', null, formatT('error.viewFailed', { title: this.props.view.title })),
      createElement('button', { type: 'button', onClick: () => this.setState({ error: undefined }) }, t('error.retry')),
      createElement('button', { type: 'button', onClick: () => this.setState(state => ({ error: undefined, generation: state.generation + 1 })) }, t('error.reloadView')),
      createElement('button', { type: 'button', onClick: this.props.onClose }, t('tab.close')),
    )
  }
}

/** Render-error boundary shared by the Core host groups and the Tier 0 overlay panel. */
export { ViewBoundary as PaneViewBoundary }

export interface PaneViewContentProps {
  readonly view: PaneViewInstanceV1
  readonly registration: PaneViewRegistrationV1 | undefined
  readonly registry: PaneViewRegistry
  readonly controller: PaneWorkbenchController
  readonly renderCoreView?: (id: PaneCoreViewId) => ReactNode
  readonly onClose: (viewId: string) => void
}

/** Active-view content: orphaned fallback, or the registered component inside the shared boundary. */
export function PaneViewContent(props: PaneViewContentProps): ReactNode {
  const { view, registration } = props
  const restore = props.controller.getRestoreState(view.id)
  if (view.status === 'orphaned' || registration === undefined) {
    let cachedRendition: ReactNode
    if (restore?.renditionRef !== undefined && props.controller.renditionRenderer !== undefined) {
      try {
        cachedRendition = props.controller.renditionRenderer.render({
          renditionRef: restore.renditionRef,
          kind: view.kind,
          resourceKey: view.resourceKey,
          ...(view.resourceVersion === undefined ? {} : { resourceVersion: view.resourceVersion }),
        })
      } catch {
        cachedRendition = undefined
      }
    }
    return createElement('section', { className: 'pwr-empty', role: 'status' },
      createElement('p', null, formatT('error.unavailable', { title: view.title })),
      restore?.renditionRef === undefined ? null : createElement('p', { className: 'pwr-recovery-note' }, t('recovery.cachedRenditionAvailable')),
      cachedRendition === undefined ? null : createElement('div', { className: 'pwr-recovery-rendition', 'data-pane-safe-rendition': true }, cachedRendition),
      createElement('button', { type: 'button', onClick: () => props.onClose(view.id) }, formatT('tab.closeWithName', { name: view.title })),
    )
  }
  return createElement(ViewBoundary, { view, onClose: () => props.onClose(view.id) },
    createElement(registration.component as never, {
      view,
      projection: view.metadata,
      registry: props.registry,
      ...(registration.restore?.state === true && restore?.state !== undefined ? { restoreState: restore.state } : {}),
      ...(registration.restore?.rendition === true && restore?.renditionRef !== undefined ? { renditionRef: restore.renditionRef } : {}),
      ...(registration.restore === undefined ? {} : {
        onRestoreStateChange: (state?: unknown, renditionRef?: unknown) => props.controller.updateRestoreState(view.id, state, renditionRef),
      }),
      hostContent: isPaneCoreViewId(view.kind) ? props.renderCoreView?.(view.kind) : undefined,
      retry: () => props.controller.dispatch({ type: 'activate_view', viewId: view.id }),
    }))
}

function groupIds(node: PaneSplitNodeV1, output: string[] = []): string[] {
  if (node.type === 'group') output.push(node.groupId)
  else { groupIds(node.first, output); groupIds(node.second, output) }
  return output
}

function targetGroup(state: PaneWorkspaceV1, view: PaneViewInstanceV1, region: PaneRegionId): PaneGroupV1 | undefined {
  return Object.values(state.groups)
    .filter(group => group.region === region && (!group.locked || group.role === view.role))
    .sort((left, right) => Number(left.role !== view.role && left.role !== 'general') - Number(right.role !== view.role && right.role !== 'general') || Number(left.locked) - Number(right.locked) || left.id.localeCompare(right.id))[0]
}

function iconForView(view: PaneViewInstanceV1): WorkbenchIconName {
  if (view.kind.includes('git')) return 'git'
  if (view.kind.includes('subagent') || view.kind.includes('agent')) return 'agents'
  if (view.role === 'utility' || view.kind.includes('terminal')) return 'terminal'
  if (view.role === 'navigator' || view.kind.includes('file')) return 'file'
  if (view.kind.includes('media')) return 'media'
  return 'document'
}

function splitIcon(edge: 'left' | 'right' | 'top' | 'bottom'): WorkbenchIconName {
  return edge === 'left' ? 'split-left'
    : edge === 'right' ? 'split-right'
      : edge === 'top' ? 'split-up'
        : 'split-down'
}

function menuItem(icon: WorkbenchIconName, label: string): readonly [ReactNode, ReactNode] {
  return [createElement(WorkbenchIcon, { name: icon, size: 16 }), createElement('span', null, label)]
}

export interface PaneViewQuickPickProps {
  readonly registry: PaneViewRegistry
  readonly controller: PaneWorkbenchController
  readonly onClose: () => void
  /** Deterministic focus restore target (the anchoring trigger) for Esc/close. */
  readonly restoreFocus?: () => void
}

/**
 * Anchored Quick Pick shared by the Core host and the Tier 0 overlay: search,
 * Open/Available grouping, Arrow/Home/End selection, Enter to open, Esc closes
 * with focus restore. Opening a view moves focus to its tab.
 */
export function PaneViewQuickPick(props: PaneViewQuickPickProps): ReactNode {
  const [, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => props.registry.subscribe(() => setRevision(value => value + 1)), [props.registry])
  useEffect(() => { searchRef.current?.focus() }, [])
  const state = props.controller.getSnapshot()
  const openKinds = new Set(Object.values(state.views).map(view => view.kind))
  const needle = query.trim().toLowerCase()
  const matches = props.registry.snapshot()
    .filter(registration => registration.showInPicker !== false)
    .filter(({ descriptor }) => needle.length === 0
      || descriptor.label.toLowerCase().includes(needle)
      || descriptor.kind.toLowerCase().includes(needle)
      || (descriptor.presentation?.keywords ?? []).some(keyword => keyword.toLowerCase().includes(needle)))
  const groups: ReadonlyArray<{ readonly id: 'open' | 'available'; readonly label: string; readonly items: typeof matches }> = [
    { id: 'open', label: t('picker.group.open'), items: matches.filter(registration => openKinds.has(registration.descriptor.kind)) },
    { id: 'available', label: t('picker.group.available'), items: matches.filter(registration => !openKinds.has(registration.descriptor.kind)) },
  ]

  const closeWithRestore = (): void => {
    props.onClose()
    props.restoreFocus?.()
  }

  const openDescriptor = (descriptor: PaneViewRegistrationV1['descriptor']): void => {
    props.controller.openView({
      kind: descriptor.kind,
      resourceKey: `view:${descriptor.kind}`,
      role: descriptor.role,
      preferredRegion: descriptor.preferredRegion,
      retention: descriptor.retention,
      singleton: descriptor.singleton,
      pinned: true,
      title: descriptor.label,
    })
    props.onClose()
    const opened = Object.values(props.controller.getSnapshot().views)
      .find(view => view.kind === descriptor.kind && view.resourceKey === `view:${descriptor.kind}`)
    if (opened !== undefined) queueMicrotask(() => document.getElementById(`pane-tab-${opened.id}`)?.focus())
  }

  const itemElements = (): HTMLElement[] => [...(rootRef.current?.querySelectorAll<HTMLElement>('[data-pane-picker-item]') ?? [])]

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeWithRestore()
      return
    }
    const items = itemElements()
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      if (items.length === 0) return
      event.preventDefault()
      const current = items.indexOf(document.activeElement as HTMLElement)
      const next = event.key === 'Home' ? 0
        : event.key === 'End' ? items.length - 1
          : current === -1 ? (event.key === 'ArrowDown' ? 0 : items.length - 1)
            : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[next]?.focus()
      return
    }
    if (event.key === 'Enter' && (document.activeElement === searchRef.current || document.activeElement === rootRef.current)) {
      const first = groups.flatMap(group => group.items)[0]
      if (first !== undefined) {
        event.preventDefault()
        openDescriptor(first.descriptor)
      }
    }
  }

  return createElement('section', { ref: rootRef, className: 'pwr-picker', role: 'dialog', 'aria-modal': false, 'aria-label': t('chrome.openView'), onKeyDown },
    createElement('header', null,
      createElement('strong', null, t('chrome.openViewTitle')),
      createElement('button', { type: 'button', className: 'pwr-icon', onClick: closeWithRestore, 'aria-label': t('chrome.closeViewSelector') }, createElement(WorkbenchIcon, { name: 'close' })),
    ),
    createElement('input', {
      ref: searchRef,
      type: 'search',
      role: 'searchbox',
      value: query,
      'aria-label': t('picker.title'),
      placeholder: t('picker.search.placeholder'),
      'data-pane-picker-search': true,
      onChange: (event: { currentTarget: { value: string } }) => setQuery(event.currentTarget.value),
    }),
    createElement('div', { className: 'pwr-picker-list' },
      matches.length === 0 ? createElement('p', { className: 'pwr-empty' }, t('error.noViewOpen')) : null,
      ...groups.flatMap(group => group.items.length === 0 ? [] : [
        createElement('div', { key: group.id, className: 'pwr-picker-group', role: 'group', 'aria-label': group.label },
          createElement('p', { className: 'pwr-picker-group-title' }, group.label),
          ...group.items.map(({ descriptor }) => createElement('button', {
            key: descriptor.kind,
            type: 'button',
            'data-pane-picker-item': descriptor.kind,
            onClick: () => openDescriptor(descriptor),
          }, createElement(WorkbenchIcon, { name: descriptor.kind.includes('git') ? 'git' : descriptor.kind.includes('subagent') || descriptor.kind.includes('agent') ? 'agents' : descriptor.role === 'utility' ? 'terminal' : descriptor.role === 'navigator' ? 'file' : descriptor.kind.includes('media') ? 'media' : 'document' }), createElement('span', null, descriptor.label))),
        ),
      ]),
    ),
  )
}

/**
 * Deterministic focus restore after a tab close: when the strip element that
 * last held focus disappears, focus moves to the group's new active tab, or to
 * the Open View trigger when no tab remains. Focus owned outside the chrome is
 * never stolen.
 */
export function usePaneTabFocusRestore(
  controller: PaneWorkbenchController,
  rootRef: RefObject<HTMLElement | null>,
  selectActiveTabId: (state: PaneWorkspaceV1) => string | undefined,
  fallbackSelector: string,
): void {
  const lastStripFocus = useRef<string | undefined>(undefined)
  useEffect(() => {
    const root = rootRef.current
    if (root === null || root === undefined) return
    const onFocusIn = (event: Event): void => {
      const item = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-pane-renderer-id]') : null
      lastStripFocus.current = item?.dataset.paneRendererId
    }
    const onDocumentFocus = (event: Event): void => {
      if (event.target instanceof HTMLElement && !root.contains(event.target)) lastStripFocus.current = undefined
    }
    root.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusin', onDocumentFocus)
    return () => {
      root.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusin', onDocumentFocus)
    }
  }, [controller, rootRef])
  useEffect(() => controller.subscribeWorkspace(() => {
    const focusedViewId = lastStripFocus.current
    if (focusedViewId === undefined) return
    const state = controller.getSnapshot()
    if (state.views[focusedViewId] !== undefined) return
    lastStripFocus.current = undefined
    queueMicrotask(() => {
      const root = rootRef.current
      if (root === null || root === undefined) return
      const activeElement = document.activeElement
      if (activeElement !== null && activeElement !== document.body && root.contains(activeElement)) return
      const nextActive = selectActiveTabId(state)
      const target = (nextActive === undefined ? null : root.querySelector(`#pane-tab-${CSS.escape(nextActive)}`))
        ?? root.querySelector(fallbackSelector)
      if (target instanceof HTMLElement) target.focus()
    })
  }), [controller, rootRef, selectActiveTabId, fallbackSelector])
}

/** Localized labels for the shared artifact handoff menu. */
function handoffMenuLabels(): Parameters<typeof PaneArtifactHandoffMenu>[0]['labels'] {
  return {
    menuLabel: t('handoff.menu'),
    open: t('handoff.open'),
    compare: t('handoff.compare'),
    attach_context: t('handoff.attachContext'),
    transform: t('handoff.transform'),
    handoff: t('handoff.handoff'),
    link: t('handoff.link'),
    unsupportedIntent: t('handoff.unsupportedIntent'),
    invalidSource: t('handoff.invalidSource'),
  }
}

/**
 * View-menu handoff section: the shared menu plus the HTML5 drag payload
 * binding. One gesture produces the exact same intent shape for click and
 * drag; disabled items never emit a payload.
 */
export function PaneViewHandoffSection(props: {
  readonly view: PaneViewInstanceV1
  readonly handoff: PaneArtifactHandoffContextV1
  readonly onHandled?: () => void
}): ReactNode {
  const { handoff } = props
  const sourceCandidate = handoff.sourceFor(props.view)
  const gestureRef = useRef<string | undefined>(undefined)
  if (gestureRef.current === undefined) gestureRef.current = beginArtifactGesture()
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    for (const item of rootRef.current?.querySelectorAll<HTMLElement>('[data-pane-handoff-intent]') ?? []) {
      if (item.getAttribute('draggable') !== 'true') item.setAttribute('draggable', 'true')
    }
  })
  if (sourceCandidate === undefined || sourceCandidate === null) return null
  const onDragStart = (event: DragEvent<HTMLElement>): void => {
    const item = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-pane-handoff-intent]') : null
    if (item === null || item.getAttribute('aria-disabled') === 'true') return
    const intentKind = item.getAttribute('data-pane-handoff-intent')
    const targetOwner = item.closest('[data-pane-handoff-target]')?.getAttribute('data-pane-handoff-target') ?? undefined
    const source = ArtifactRefSchema.safeParse(sourceCandidate)
    if (!isArtifactIntentKind(intentKind) || !source.success || event.dataTransfer === null) return
    try {
      const intent = buildArtifactGestureIntent({
        gesture: gestureRef.current ?? beginArtifactGesture(),
        intent: intentKind,
        source: source.data,
        ...(targetOwner === undefined ? {} : { targetOwner }),
        context: handoff.getContext(),
      })
      event.dataTransfer.setData(ARTIFACT_INTENT_DRAG_MIME, createArtifactDragPayload(intent))
      event.dataTransfer.effectAllowed = 'copy'
    } catch {
      // an intent that fails contract validation never reaches the data transfer
    }
  }
  return createElement('div', {
    ref: rootRef,
    role: 'group',
    'aria-label': t('handoff.menu'),
    'data-pane-handoff-section': props.view.id,
    onDragStart,
  },
    createElement(PaneArtifactHandoffMenu, {
      source: sourceCandidate,
      context: handoff.getContext(),
      targets: handoff.listTargets(),
      channel: handoff.channel,
      gesture: gestureRef.current,
      labels: handoffMenuLabels(),
      ...(handoff.hasAdmission === undefined ? {} : { hasAdmission: handoff.hasAdmission }),
      onDispatch: intent => {
        handoff.onDispatch(intent)
        props.onHandled?.()
      },
      ...(handoff.onEvidence === undefined ? {} : { onEvidence: handoff.onEvidence }),
    }),
  )
}

/**
 * Drop-side DOM binding for artifact payloads: dragover admits only the
 * handoff MIME; drop parses through the contract gate before dispatch, so an
 * invalid payload never produces a state change or a dispatch.
 */
export function paneArtifactDropHandlers(handoff: PaneArtifactHandoffContextV1): {
  readonly onDragOver: (event: DragEvent<HTMLElement>) => void
  readonly onDrop: (event: DragEvent<HTMLElement>) => void
} {
  return {
    onDragOver: event => {
      if (event.dataTransfer?.types.includes(ARTIFACT_INTENT_DRAG_MIME) === true) {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }
    },
    onDrop: event => {
      const raw = event.dataTransfer?.getData(ARTIFACT_INTENT_DRAG_MIME)
      if (typeof raw !== 'string' || raw.length === 0) return
      event.preventDefault()
      const parsed = parseArtifactDragPayload(raw)
      if (!parsed.ok) return
      handoff.onDispatch(parsed.intent)
    },
  }
}

function SplitTree(props: {
  node: PaneSplitNodeV1
  state: PaneWorkspaceV1
  registry: PaneViewRegistry
  controller: PaneWorkbenchController
  regionWidth: number
  regionHeight: number
  onOpenPicker: () => void
  onOpenManager: () => void
  onReviewProtected: (items: readonly PaneBulkCloseProtectedViewV1[]) => void
  renderCoreView?: (id: PaneCoreViewId) => ReactNode
  handoff?: PaneArtifactHandoffContextV1
}): ReactNode {
  if (props.node.type === 'group') {
    const group = props.state.groups[props.node.groupId]
    if (group === undefined || group.tabs.length === 0) return null
    return createElement(GroupChrome, { ...props, group })
  }
  const firstHasViews = groupIds(props.node.first).some(id => (props.state.groups[id]?.tabs.length ?? 0) > 0)
  const secondHasViews = groupIds(props.node.second).some(id => (props.state.groups[id]?.tabs.length ?? 0) > 0)
  if (!firstHasViews) return secondHasViews ? createElement(SplitTree, { ...props, node: props.node.second }) : null
  if (!secondHasViews) return createElement(SplitTree, { ...props, node: props.node.first })
  return createElement(SplitBranch, { ...props, node: props.node })
}

function SplitBranch(props: {
  node: Extract<PaneSplitNodeV1, { type: 'split' }>
  state: PaneWorkspaceV1
  registry: PaneViewRegistry
  controller: PaneWorkbenchController
  regionWidth: number
  regionHeight: number
  onOpenPicker: () => void
  onOpenManager: () => void
  onReviewProtected: (items: readonly PaneBulkCloseProtectedViewV1[]) => void
  renderCoreView?: (id: PaneCoreViewId) => ReactNode
  handoff?: PaneArtifactHandoffContextV1
}): ReactNode {
  const [preview, setPreview] = useState<number>()
  const container = useRef<HTMLDivElement>(null)
  const orientation = props.node.orientation
  const resize = useMemo(() => new PaneResizeSession(
    ratio => setPreview(ratio),
    ratio => props.controller.dispatch({ type: 'resize_split', region: props.state.groups[groupIds(props.node)[0]!]?.region ?? 'right', splitId: props.node.id, ratio }),
  ), [props.controller, props.node.id, props.state])
  useEffect(() => () => resize.cancel(), [resize])
  const ratio = preview ?? props.node.ratio
  const measure = (event: PointerEvent<HTMLDivElement>): number => {
    const rect = container.current?.getBoundingClientRect()
    if (rect === undefined) return ratio
    const raw = orientation === 'horizontal'
      ? (event.clientX - rect.left) / Math.max(1, rect.width)
      : (event.clientY - rect.top) / Math.max(1, rect.height)
    const minimum = orientation === 'horizontal' ? 280 / Math.max(1, rect.width) : 180 / Math.max(1, rect.height)
    return Math.max(minimum, Math.min(1 - minimum, raw))
  }
  return createElement('div', { ref: container, className: 'pwr-split', 'data-orientation': orientation, 'data-pane-split': props.node.id },
    createElement('div', { className: 'pwr-branch', style: { flex: `${ratio} 1 0` } }, createElement(SplitTree, { ...props, node: props.node.first })),
    createElement('div', {
      className: 'pwr-splitter', role: 'separator', tabIndex: 0,
      'aria-orientation': orientation === 'horizontal' ? 'vertical' : 'horizontal',
      'aria-valuemin': 15, 'aria-valuemax': 85, 'aria-valuenow': Math.round(ratio * 100),
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => { event.currentTarget.setPointerCapture(event.pointerId); resize.begin() },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resize.move(measure(event)) },
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); resize.end(measure(event)) },
      onPointerCancel: () => resize.cancel(),
      onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
        const delta = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -0.05 : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 0.05 : 0
        if (delta === 0) return
        event.preventDefault()
        props.controller.dispatch({ type: 'resize_split', region: props.state.groups[groupIds(props.node)[0]!]?.region ?? 'right', splitId: props.node.id, ratio: props.node.ratio + delta })
      },
    }),
    createElement('div', { className: 'pwr-branch', style: { flex: `${1 - ratio} 1 0` } }, createElement(SplitTree, { ...props, node: props.node.second })),
  )
}

function GroupChrome(props: {
  group: PaneGroupV1
  state: PaneWorkspaceV1
  registry: PaneViewRegistry
  controller: PaneWorkbenchController
  regionWidth: number
  regionHeight: number
  onOpenPicker: () => void
  onOpenManager: () => void
  onReviewProtected: (items: readonly PaneBulkCloseProtectedViewV1[]) => void
  renderCoreView?: (id: PaneCoreViewId) => ReactNode
  handoff?: PaneArtifactHandoffContextV1
}): ReactNode {
  const [menuViewId, setMenuViewId] = useState<string>()
  const groupElement = useRef<HTMLElement>(null)
  const drag = useSyncExternalStore(props.controller.drag.subscribe, props.controller.drag.getSnapshot, props.controller.drag.getSnapshot)
  const active = props.group.activeTabId === undefined ? undefined : props.state.views[props.group.activeTabId]
  const maximized = props.state.maximizedGroupId === props.group.id
  const registration = active === undefined ? undefined : props.registry.get(active.kind)
  const target = drag.target?.groupId === props.group.id ? drag.target : undefined
  const reorder = target?.enabled === true && target.edge === 'center' && target.index !== undefined
  const selectActiveTabId = useMemo(() => (state: PaneWorkspaceV1) => state.groups[props.group.id]?.activeTabId, [props.group.id])
  usePaneTabFocusRestore(props.controller, groupElement, selectActiveTabId, '[data-pane-open-view-trigger]')
  const close = (viewId: string): void => {
    const view = props.state.views[viewId]
    if (view === undefined) return
    const result = props.controller.dispatch({ type: 'bulk_close_safe', groupId: view.groupId, mode: 'group', viewIds: [viewId] })
    const protectedViews = result.details?.bulkCloseSafe?.protectedViews ?? []
    if (protectedViews.length > 0) props.onReviewProtected(protectedViews)
  }
  const dropTarget = (event: PointerEvent<HTMLElement>): PaneDragTargetV1 | undefined => {
    const sourceId = drag.drag.status === 'dragging' ? drag.drag.viewId : drag.drag.status === 'pending' ? drag.drag.viewId : undefined
    const source = sourceId === undefined ? undefined : props.state.views[sourceId]
    if (source === undefined) return undefined
    const rect = event.currentTarget.getBoundingClientRect()
    const tab = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-pane-tab-index]') : null
    let edge: PaneDragTargetV1['edge'] = 'center'
    let index: number | undefined
    if (tab !== null) {
      const rawIndex = Number(tab.dataset.paneTabIndex)
      index = Number.isSafeInteger(rawIndex) ? rawIndex + Number(event.clientX >= tab.getBoundingClientRect().left + tab.getBoundingClientRect().width / 2) : props.group.tabs.length
    } else if (rect.width > 0 && rect.height > 0) {
      const x = (event.clientX - rect.left) / rect.width
      const y = (event.clientY - rect.top) / rect.height
      edge = x <= 0.2 ? 'left' : x >= 0.8 ? 'right' : y <= 0.2 ? 'top' : y >= 0.8 ? 'bottom' : 'center'
    }
    const locked = props.group.locked && props.group.role !== source.role
    const tooSmall = !splitFits(edge, rect.width, rect.height)
    const noOp = source.groupId === props.group.id && edge === 'center' && index === undefined
    return { groupId: props.group.id, edge, index, enabled: !locked && !tooSmall && !noOp, reason: locked ? 'locked' : tooSmall ? 'minimum_size' : noOp ? 'already_in_group' : undefined }
  }
  const menuView = menuViewId === undefined ? undefined : props.state.views[menuViewId]
  const measured = groupElement.current?.getBoundingClientRect()
  const menuWidth = measured !== undefined && measured.width > 0
    ? measured.width
    : Math.max(0, props.regionWidth - (props.group.region === 'right' ? RIGHT_RAIL_WIDTH : 0))
  const menuHeight = measured !== undefined && measured.height > 0
    ? measured.height
    : Math.max(0, props.regionHeight)
  const content = active === undefined
    ? null
    : createElement(PaneViewContent, {
      view: active,
      registration,
      registry: props.registry,
      controller: props.controller,
      renderCoreView: props.renderCoreView,
      onClose: close,
    })

  return createElement('section', {
    ref: groupElement,
    className: 'pwr-group',
    'data-pane-group': props.group.id,
    'data-pane-region': props.group.region,
    'data-pane-drop-edge': target?.edge,
    'data-pane-drop-enabled': target?.enabled,
    onPointerMove: (event: PointerEvent<HTMLElement>) => { props.controller.drag.move(event.clientX, event.clientY, dropTarget(event)) },
    onPointerUp: () => { props.controller.drag.drop() },
    onPointerCancel: () => props.controller.drag.cancel(),
    ...(props.handoff === undefined ? {} : paneArtifactDropHandlers(props.handoff)),
  },
  target === undefined || reorder ? null : (() => {
    const label = paneDropTargetLabel(target)
    return createElement('div', { className: 'pwr-drop', role: 'status', 'aria-label': label },
      createElement('span', { className: 'pwr-drop-label' }, label),
    )
  })(),
  !reorder ? null : createElement('div', {
    className: 'pwr-reorder-marker',
    role: 'status',
    'aria-label': paneDropTargetLabel(target),
    style: { left: `${Math.max(8, Math.min(menuWidth - 8, (drag.visuals.ghost?.x ?? 0) - (measured?.left ?? 0)))}px` },
  }, createElement('span', { className: 'pwr-drop-label pwr-reorder-label' }, paneDropTargetLabel(target))),
  createElement('div', { className: 'pwr-tabs', role: 'tablist', 'aria-label': formatT('chrome.tabListForRole', { role: tWithFallback(`role.${props.group.role}`, props.group.role) }) },
    createElement(PaneTabStrip, {
      group: props.group,
      state: props.state,
      controller: props.controller,
      availableWidth: Math.max(136, menuWidth - 176),
      onContextMenu: viewId => setMenuViewId(viewId),
      onClose: close,
      showOverflow: false,
    }),
    createElement(PaneTabActions, {
      group: props.group,
      activeView: active,
      maximized,
      controller: props.controller,
      onOpenPicker: props.onOpenPicker,
      onOpenManager: props.onOpenManager,
      tabCount: Object.keys(props.state.views).length,
      onContextMenu: viewId => setMenuViewId(viewId),
      onHidePane: () => props.controller.dispatch({ type: 'set_region_visibility', region: props.group.region, visible: false }),
    }),
  ),
  menuView === undefined ? null : createElement('div', { className: 'pwr-menu', role: 'menu', 'aria-label': formatT('chrome.viewActions', { name: menuView.title }) },
    createElement('button', { className: 'pwr-menu-item', role: 'menuitem', type: 'button', onClick: () => { openPaneWorkbenchCoreView(props.controller, DSH_WORKSPACE_DESIGNER_VIEW_KIND); setMenuViewId(undefined) } }, ...menuItem('workspace', t('rail.customize'))),
    createElement('button', { className: 'pwr-menu-item', role: 'menuitem', type: 'button', onClick: () => { props.controller.dispatch({ type: 'pin_view', viewId: menuView.id }); setMenuViewId(undefined) } }, ...menuItem(menuView.pinned ? 'unpin' : 'pin', menuView.pinned ? t('tab.unpin') : t('tab.pin'))),
    createElement('button', { className: 'pwr-menu-item', role: 'menuitem', type: 'button', onClick: () => { close(menuView.id); setMenuViewId(undefined) } }, ...menuItem('close', formatT('tab.closeWithName', { name: menuView.title }))),
    createElement('div', { className: 'pwr-menu-separator', role: 'separator' }),
    createElement('button', { className: 'pwr-menu-item', role: 'menuitem', type: 'button', onClick: () => {
      props.controller.dispatch({ type: 'set_region_visibility', region: props.group.region, visible: false })
      setMenuViewId(undefined)
    } }, ...menuItem('collapse', props.group.region === 'right' ? t('chrome.hideRight') : t('chrome.hideBottom'))),
    ...(['right', 'bottom'] as const).map(region => createElement('button', { className: 'pwr-menu-item', key: `move-${region}`, role: 'menuitem', type: 'button', onClick: () => {
      const group = targetGroup(props.state, menuView, region)
      if (group !== undefined) props.controller.dispatch({ type: 'move_view', viewId: menuView.id, targetGroupId: group.id })
      setMenuViewId(undefined)
    } }, ...menuItem(region === 'right' ? 'move-right' : 'move-down', region === 'right' ? t('tab.moveToRight') : t('tab.moveToBottom')))),
    createElement('div', { className: 'pwr-menu-separator', role: 'separator' }),
    ...(['left', 'right', 'top', 'bottom'] as const).map((edge) => {
      const enabled = splitFits(edge, menuWidth, menuHeight)
      return createElement('button', {
        className: 'pwr-menu-item',
        key: `split-${edge}`,
        role: 'menuitem',
        type: 'button',
        disabled: !enabled,
        'aria-disabled': !enabled,
        title: enabled ? undefined : formatT('tab.minimumSize', { width: PANE_MIN_WIDTH, height: PANE_MIN_HEIGHT }),
        onClick: () => {
          if (!enabled) return
          props.controller.dispatch({ type: 'split_with_view', viewId: menuView.id, targetGroupId: props.group.id, edge })
          setMenuViewId(undefined)
        },
      }, ...menuItem(splitIcon(edge), formatT('tab.splitEdge', { edge: t(`drag.edge.${edge}`) })))
    }),
    props.handoff === undefined ? null : createElement(PaneViewHandoffSection, {
      view: menuView,
      handoff: props.handoff,
      onHandled: () => setMenuViewId(undefined),
    }),
  ),
  active === undefined ? null : createElement('div', { id: `pane-panel-${active.id}`, className: 'pwr-panel', role: 'tabpanel', 'aria-labelledby': `pane-tab-${active.id}` }, content),
  )
}

function FontScaleControls(): ReactNode {
  const [size, setSize] = useState(getWorkbenchFontSize)
  useEffect(() => subscribeWorkbenchFontSize(setSize), [])
  return createElement('div', { className: 'pwr-rail-fonts', role: 'group', 'aria-label': t('chrome.fontSize') },
    createElement('button', {
      type: 'button', title: t('chrome.decreaseFontSize'), 'aria-label': t('chrome.decreaseFontSize'),
      disabled: size <= WORKBENCH_FONT_SIZE_MIN,
      onClick: () => setSize(stepWorkbenchFontSize(-1)),
    }, createElement(WorkbenchIcon, { name: 'font-decrease' })),
    createElement('button', {
      type: 'button', title: t('chrome.increaseFontSize'), 'aria-label': t('chrome.increaseFontSize'),
      disabled: size >= WORKBENCH_FONT_SIZE_MAX,
      onClick: () => setSize(stepWorkbenchFontSize(1)),
    }, createElement(WorkbenchIcon, { name: 'font-increase' })),
  )
}

function openAgentsMonitor(controller: PaneWorkbenchController): void {
  controller.openView({
    kind: DSH_SUBAGENT_MONITOR_VIEW_KIND,
    resourceKey: 'subagent:monitor',
    role: 'navigator',
    preferredRegion: 'right',
    retention: 'keep-alive',
    singleton: true,
    preview: false,
    pinned: true,
    title: t('rail.agents'),
  })
}

export interface PaneActivityRailProps {
  readonly registry: PaneViewRegistry
  readonly controller: PaneWorkbenchController
  readonly state: PaneWorkspaceV1
  /** When the body is hidden the rail shows its own Open View trigger. */
  readonly bodyVisible: boolean
  readonly onOpenPicker: () => void
}

/** Activity rail shared by the Core host right region and the Tier 0 overlay host. */
export function PaneActivityRail(props: PaneActivityRailProps): ReactNode {
  const { registry, controller, state } = props
  const openedViews = Object.values(state.views)
  const agentsRegistered = registry.has(DSH_SUBAGENT_MONITOR_VIEW_KIND)
  const agentsActive = openedViews.some(view => view.kind === DSH_SUBAGENT_MONITOR_VIEW_KIND && state.groups[view.groupId]?.activeTabId === view.id)
  return createElement('nav', { className: 'pwr-rail', 'aria-label': t('chrome.workspaceActivity') },
    props.bodyVisible ? null : createElement('button', { type: 'button', title: t('chrome.openView'), 'aria-label': t('chrome.openView'), 'data-pane-open-view-trigger': 'rail', onClick: props.onOpenPicker }, createElement(WorkbenchIcon, { name: 'add' })),
    createElement('button', {
      type: 'button', title: t('rail.explorer'), 'aria-label': t('rail.explorer'),
      className: openedViews.some(view => view.kind === DSH_EXPLORER_VIEW_KIND && state.groups[view.groupId]?.activeTabId === view.id) ? 'pwr-active' : undefined,
      onClick: () => openExplorerNavigator(controller),
    }, createElement(WorkbenchIcon, { name: 'folder' })),
    createElement('button', {
      type: 'button', title: t('rail.sourceControl'), 'aria-label': t('rail.sourceControl'),
      className: openedViews.some(view => view.kind === DSH_SOURCE_CONTROL_VIEW_KIND && state.groups[view.groupId]?.activeTabId === view.id) ? 'pwr-active' : undefined,
      onClick: () => openSourceControlNavigator(controller),
    }, createElement(WorkbenchIcon, { name: 'git' })),
    agentsRegistered ? createElement('button', {
      type: 'button', title: t('rail.agents'), 'aria-label': t('rail.agents'),
      className: agentsActive ? 'pwr-active' : undefined,
      'data-pane-rail-agents': true,
      onClick: () => openAgentsMonitor(controller),
    }, createElement(WorkbenchIcon, { name: 'agents' })) : null,
    ...openedViews.filter(view => view.kind !== DSH_EXPLORER_VIEW_KIND && view.kind !== DSH_SOURCE_CONTROL_VIEW_KIND && view.kind !== DSH_SUBAGENT_MONITOR_VIEW_KIND).map(view => createElement('button', {
      key: view.id, type: 'button', title: view.title, 'aria-label': formatT('chrome.openNamedView', { name: view.title }),
      className: state.activeGroupId === view.groupId && state.groups[view.groupId]?.activeTabId === view.id ? 'pwr-active' : undefined,
      onClick: () => controller.dispatch({ type: 'activate_view', viewId: view.id }),
    }, createElement(WorkbenchIcon, { name: iconForView(view) }))),
    createElement('button', {
      type: 'button', title: t('rail.customize'), 'aria-label': t('rail.customize'),
      onClick: () => openPaneWorkbenchCoreView(controller, DSH_WORKSPACE_DESIGNER_VIEW_KIND),
    }, createElement(WorkbenchIcon, { name: 'workspace' })),
    createElement(FontScaleControls),
  )
}

export function PaneRegionChrome(props: PaneRegionChromeProps): ReactNode {
  useSyncExternalStore(subscribeLocale, getLocaleRevision, getLocaleRevision)
  const state = useSyncExternalStore(props.controller.subscribeWorkspace, props.controller.getSnapshot, props.controller.getSnapshot)
  const drag = useSyncExternalStore(props.controller.drag.subscribe, props.controller.drag.getSnapshot, props.controller.drag.getSnapshot)
  const [managementMode, setManagementMode] = useState<PaneManagementMode>()
  const [reviewProtected, setReviewProtected] = useState<readonly PaneBulkCloseProtectedViewV1[]>([])
  const [fontSize, setFontSize] = useState(getWorkbenchFontSize)
  const [hiddenBottomPhase, setHiddenBottomPhase] = useState<HiddenBottomDropPhase>('hidden')
  const [, setRegistryRevision] = useState(0)
  const rootRef = useRef<HTMLElement>(null)
  const region = state.regions[props.region]
  const regionGroupIds = groupIds(region.root)
  const bodyVisible = props.mode === 'dock' || props.mode === 'sheet' || props.mode === 'maximized'
  const hasViews = regionGroupIds.some(id => (state.groups[id]?.tabs.length ?? 0) > 0)
  const emptyGroupId = !hasViews ? regionGroupIds[0] : undefined
  const emptyTarget = emptyGroupId !== undefined && drag.target?.groupId === emptyGroupId ? drag.target : undefined
  const emptyDropTarget = (): PaneDragTargetV1 | undefined => {
    if (emptyGroupId === undefined) return undefined
    const sourceId = drag.drag.status === 'dragging' || drag.drag.status === 'pending' ? drag.drag.viewId : undefined
    const source = sourceId === undefined ? undefined : state.views[sourceId]
    const group = state.groups[emptyGroupId]
    if (source === undefined || group === undefined) return undefined
    const locked = group.locked && group.role !== source.role
    return { groupId: emptyGroupId, edge: 'center', enabled: !locked, reason: locked ? 'locked' : undefined }
  }
  const hiddenBottomGroupId = props.region === 'right' && !state.regions.bottom.visible && drag.drag.status !== 'idle'
    ? groupIds(state.regions.bottom.root)[0]
    : undefined
  const hiddenBottomTarget = hiddenBottomGroupId !== undefined && drag.target?.groupId === hiddenBottomGroupId ? drag.target : undefined
  const hiddenBottomDropTarget = (): PaneDragTargetV1 | undefined => {
    if (hiddenBottomGroupId === undefined) return undefined
    const sourceId = drag.drag.status === 'dragging' || drag.drag.status === 'pending' ? drag.drag.viewId : undefined
    const source = sourceId === undefined ? undefined : state.views[sourceId]
    const group = state.groups[hiddenBottomGroupId]
    if (source === undefined || group === undefined) return undefined
    const locked = group.locked && group.role !== source.role
    return { groupId: hiddenBottomGroupId, edge: 'center', enabled: !locked, reason: locked ? 'locked' : undefined }
  }

  useEffect(() => subscribeWorkbenchFontSize(setFontSize), [])
  useEffect(() => props.registry.subscribe(() => setRegistryRevision(value => value + 1)), [props.registry])
  useEffect(() => { applyWorkbenchFontSizeTo(rootRef.current, fontSize) }, [fontSize])
  useEffect(() => {
    if (props.region !== 'bottom' || !region.visible || hasViews) return
    props.controller.dispatch({ type: 'set_region_visibility', region: 'bottom', visible: false })
  }, [hasViews, props.controller, props.region, region.visible])
  useEffect(() => {
    const cancel = (): void => props.controller.drag.cancel(t('drag.windowBlurred'))
    window.addEventListener('blur', cancel)
    return () => window.removeEventListener('blur', cancel)
  }, [props.controller])
  useEffect(() => {
    if (hiddenBottomGroupId === undefined) { setHiddenBottomPhase('hidden'); return }
    const target = (): PaneDragTargetV1 | undefined => {
      const workspace = props.controller.getSnapshot()
      const snapshot = props.controller.drag.getSnapshot()
      const sourceId = snapshot.drag.status === 'dragging' || snapshot.drag.status === 'pending' ? snapshot.drag.viewId : undefined
      const source = sourceId === undefined ? undefined : workspace.views[sourceId]
      const group = workspace.groups[hiddenBottomGroupId]
      if (source === undefined || group === undefined) return undefined
      const locked = group.locked && group.role !== source.role
      return { groupId: hiddenBottomGroupId, edge: 'center', enabled: !locked, reason: locked ? 'locked' : undefined }
    }
    const move = (event: globalThis.PointerEvent): void => {
      const phase = resolveHiddenBottomDropPhase(event.clientY, window.innerHeight, event.pointerType === 'touch' || event.pointerType === 'pen')
      setHiddenBottomPhase(phase)
      if (phase === 'ready') props.controller.drag.move(event.clientX, event.clientY, target())
    }
    const drop = (event: globalThis.PointerEvent): void => {
      const phase = resolveHiddenBottomDropPhase(event.clientY, window.innerHeight, event.pointerType === 'touch' || event.pointerType === 'pen')
      if (phase === 'ready') props.controller.drag.drop(target())
      else if (props.controller.drag.getSnapshot().drag.status !== 'idle') props.controller.drag.cancel()
    }
    const cancel = (): void => props.controller.drag.cancel()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', drop)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', drop)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [hiddenBottomGroupId, props.controller])

  const restorePickerFocus = (): void => {
    const trigger = rootRef.current?.querySelector('[data-pane-open-view-trigger]')
    if (trigger instanceof HTMLElement) trigger.focus()
  }

  return createElement('aside', {
    ref: rootRef,
    className: 'pwr-root',
    'aria-label': t(props.region === 'right' ? 'chrome.rightWorkspace' : 'chrome.bottomWorkspace'),
    'data-region': props.region,
    'data-mode': props.mode,
    'data-font-size': fontSize,
    'data-picker-open': managementMode !== undefined || undefined,
    'data-pane-workbench-visible': bodyVisible,
    'data-pane-has-views': hasViews,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const shortcut = resolvePaneManagementShortcut(event, props.keymap)
      if (shortcut === 'open_center') {
        event.preventDefault()
        setManagementMode('open')
        return
      }
      if (shortcut === 'close_active' || shortcut === 'close_unpinned') {
        event.preventDefault()
        const activeGroup = state.activeGroupId === undefined ? undefined : state.groups[state.activeGroupId]
        if (shortcut === 'close_unpinned') {
          const viewIds = Object.values(state.views).filter(view => !view.pinned).map(view => view.id)
          if (activeGroup !== undefined) {
            const result = props.controller.dispatch({ type: 'bulk_close_safe', groupId: activeGroup.id, mode: 'unpinned', viewIds })
            const protectedViews = result.details?.bulkCloseSafe?.protectedViews ?? []
            if (protectedViews.length > 0) { setReviewProtected(protectedViews); setManagementMode('manage') }
          }
        } else if (activeGroup?.activeTabId !== undefined) {
          const activeView = state.views[activeGroup.activeTabId]
          if (activeView !== undefined) {
            const result = props.controller.dispatch({ type: 'bulk_close_safe', groupId: activeView.groupId, mode: 'group', viewIds: [activeView.id] })
            const protectedViews = result.details?.bulkCloseSafe?.protectedViews ?? []
            if (protectedViews.length > 0) { setReviewProtected(protectedViews); setManagementMode('manage') }
          }
        }
        return
      }
      if (shortcut === 'restore_closed') {
        event.preventDefault()
        props.controller.restoreClosedBatch()
        return
      }
      if (event.key !== 'Escape') return
      if (state.maximizedGroupId !== undefined) { event.preventDefault(); props.controller.dispatch({ type: 'restore_layout' }) }
      else if (drag.drag.status !== 'idle') { event.preventDefault(); props.controller.drag.cancel() }
      else if (managementMode !== undefined) { event.preventDefault(); setManagementMode(undefined); restorePickerFocus() }
    },
  },
  createElement('style', { 'data-pane-workbench-region-styles': true }, REGION_STYLES),
  props.region !== 'right' || drag.visuals.ghost === undefined ? null : createElement('div', {
    className: 'pwr-drag-ghost',
    'data-pane-drag-ghost': true,
    style: { left: `${drag.visuals.ghost.x}px`, top: `${drag.visuals.ghost.y}px` },
  }, createElement('span', null, drag.visuals.ghost.title)),
  hiddenBottomGroupId === undefined || hiddenBottomPhase === 'hidden' ? null : createElement('div', {
    className: 'pwr-hidden-bottom-drop',
    'data-pane-hidden-bottom-drop': true,
    'data-pane-drop-phase': hiddenBottomPhase,
    role: 'status',
    'aria-label': hiddenBottomPhase === 'ready' ? t('drag.openBottom') : t('drag.approachBottom'),
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => { props.controller.drag.move(event.clientX, event.clientY, hiddenBottomDropTarget()) },
    onPointerUp: () => { props.controller.drag.drop(hiddenBottomDropTarget()) },
    onPointerCancel: () => props.controller.drag.cancel(),
  }, createElement('span', { className: 'pwr-drop-label' }, t(hiddenBottomPhase === 'ready' ? 'drag.openBottom' : 'drag.approachBottom'))),
  createElement('div', { className: 'pwr-status', role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, drag.announcement || props.controller.announcement),
  props.region === 'right' ? createElement(PaneActivityRail, {
    registry: props.registry,
    controller: props.controller,
    state,
    bodyVisible,
    onOpenPicker: () => setManagementMode('open'),
  }) : null,
  createElement('div', { className: 'pwr-body', 'data-body-visible': bodyVisible },
    createElement('div', {
      className: 'pwr-tree',
      'data-pane-empty-drop-region': !hasViews ? props.region : undefined,
      'data-pane-drop-edge': emptyTarget?.edge,
      'data-pane-drop-enabled': emptyTarget?.enabled,
      onPointerMove: !hasViews ? (event: PointerEvent<HTMLElement>) => { props.controller.drag.move(event.clientX, event.clientY, emptyDropTarget()) } : undefined,
      onPointerUp: !hasViews ? () => { props.controller.drag.drop() } : undefined,
      onPointerCancel: !hasViews ? () => props.controller.drag.cancel() : undefined,
    },
      emptyTarget === undefined ? null : createElement('div', { className: 'pwr-drop pwr-empty-drop', role: 'status', 'aria-label': paneDropTargetLabel(emptyTarget) },
        createElement('span', { className: 'pwr-drop-label' }, paneDropTargetLabel(emptyTarget))),
      hasViews
        ? createElement(SplitTree, { node: region.root, state, registry: props.registry, controller: props.controller, regionWidth: props.width, regionHeight: props.height, onOpenPicker: () => setManagementMode('open'), onOpenManager: () => setManagementMode('manage'), onReviewProtected: items => { setReviewProtected(items); setManagementMode('manage') }, renderCoreView: props.renderCoreView, handoff: props.handoff })
        : createElement('section', { className: 'pwr-empty' },
          createElement('p', null, t('state.empty')),
          createElement('button', { type: 'button', 'data-pane-open-view-trigger': 'empty', onClick: () => setManagementMode('open') }, t('chrome.openAView')),
          createElement('button', { type: 'button', onClick: () => props.controller.dispatch({ type: 'set_region_visibility', region: props.region, visible: false }) }, t(props.region === 'right' ? 'chrome.hideRight' : 'chrome.hideBottom'))),
    ),
  ),
  managementMode === undefined ? null : createElement(PaneManagementCenter, {
    mode: managementMode,
    registry: props.registry,
    controller: props.controller,
    conversationSearch: props.conversationSearch,
    workspaceContext: props.workspaceContext,
    initialProtectedViews: reviewProtected,
    onClose: () => { setManagementMode(undefined); setReviewProtected([]) },
    restoreFocus: restorePickerFocus,
  }),
  createElement(PaneCloseUndoToast, { controller: props.controller }),
  )
}
