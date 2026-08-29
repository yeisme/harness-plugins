/**
 * Plan local inspect / navigation slash commands.
 * Plans are data only: adapters open panes, conversation tabs, or list
 * plugins. This module never issues RPC or mutates owner state.
 */

import { findSafeUniquePrefix, parseSlashToken } from './discovery';
import type { CommandExperienceEntryV1 } from './types';
import { pickerVisiblePaneViews, type PaneSlashViewSnapshot } from './pane-projection';

export interface InspectSurfaceSnapshot {
  readonly mcpInspector: boolean;
  readonly agentContext: boolean;
  readonly paneWorkbench: boolean;
  readonly explorer: boolean;
  readonly sourceControl: boolean;
  readonly conversationViewSwitcher: boolean;
}

export type InspectPlan =
  | { readonly kind: 'open-conversation-view'; readonly viewId: string }
  | { readonly kind: 'open-pane'; readonly viewKind: string; readonly tab?: string }
  | { readonly kind: 'pane-picker' }
  | { readonly kind: 'plugin-list' }
  | { readonly kind: 'pane-command'; readonly commandId: string }
  | { readonly kind: 'host-command'; readonly name: string }
  | { readonly kind: 'unavailable'; readonly reason: string };

export const MCP_INSPECTOR_VIEW_ID = 'mcp-inspector';
export const AGENT_CONTEXT_VIEW_KIND = 'workspace.agent-context';
export const EXPLORER_VIEW_KIND = 'dsh.explorer';
export const SOURCE_CONTROL_VIEW_KIND = 'dsh.source-control';

export const DEFAULT_INSPECT_SURFACES: InspectSurfaceSnapshot = {
  mcpInspector: false,
  agentContext: false,
  paneWorkbench: false,
  explorer: false,
  sourceControl: false,
  conversationViewSwitcher: false,
};

function schemaKey(command: CommandExperienceEntryV1): string {
  return command.input.schemaKey ?? `inspect:${command.canonicalName}`;
}

function paneCommandId(command: CommandExperienceEntryV1): string | null {
  const key = schemaKey(command);
  return key.startsWith('pane-command:') ? key.slice('pane-command:'.length) : null;
}

function hostCommandName(command: CommandExperienceEntryV1): string | null {
  const key = schemaKey(command);
  return key.startsWith('host-command:') ? key.slice('host-command:'.length) : null;
}

export function splitSlashRest(input: string): { readonly token: string; readonly rest: string } {
  const stripped = input.trim().replace(/^[/:]\s*/, '');
  const [rawHead, ...tail] = stripped.split(/\s+/);
  return {
    token: (rawHead ?? '').toLowerCase(),
    rest: tail.join(' ').trim(),
  };
}

export function matchPaneKind(
  views: readonly PaneSlashViewSnapshot[],
  query: string,
): PaneSlashViewSnapshot | null {
  const visible = pickerVisiblePaneViews(views);
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return null;
  const exact = visible.find((view) => {
    const kind = view.kind.toLowerCase();
    const short = kind.includes('.') ? kind.slice(kind.lastIndexOf('.') + 1) : kind;
    return kind === needle || short === needle || view.label.toLowerCase() === needle;
  });
  if (exact !== undefined) return exact;
  const asCommands: CommandExperienceEntryV1[] = visible.map((view) => ({
    canonicalName: view.kind.toLowerCase(),
    aliases: view.kind.includes('.') ? [view.kind.slice(view.kind.lastIndexOf('.') + 1).toLowerCase()] : [],
    description: view.label,
    category: 'pane',
    input: {},
    surfaces: ['web'],
    actionKind: 'navigation',
    owner: 'host',
    danger: 'safe',
    availability: { state: 'available' },
    coverage: 'adapted',
  }));
  const unique = findSafeUniquePrefix(asCommands, needle);
  if (unique === null) return null;
  return visible.find((view) => view.kind.toLowerCase() === unique.canonicalName) ?? null;
}

export function planInspectCommand(input: {
  readonly command: CommandExperienceEntryV1;
  readonly query?: string;
  readonly surfaces?: InspectSurfaceSnapshot;
  readonly views?: readonly PaneSlashViewSnapshot[];
}): InspectPlan {
  const surfaces = input.surfaces ?? DEFAULT_INSPECT_SURFACES;
  const paneId = paneCommandId(input.command);
  if (paneId !== null) {
    if (!surfaces.paneWorkbench) {
      return { kind: 'unavailable', reason: 'Pane Workbench is not installed' };
    }
    return { kind: 'pane-command', commandId: paneId };
  }
  const hostName = hostCommandName(input.command);
  if (hostName !== null) {
    return { kind: 'host-command', name: hostName };
  }

  const name = input.command.canonicalName;
  switch (name) {
    case 'mcp':
      if (!surfaces.mcpInspector) {
        return { kind: 'unavailable', reason: 'MCP inspector plugin not installed' };
      }
      if (!surfaces.conversationViewSwitcher) {
        return { kind: 'unavailable', reason: 'conversation view switcher is unavailable' };
      }
      return { kind: 'open-conversation-view', viewId: MCP_INSPECTOR_VIEW_ID };
    case 'skills':
      if (!surfaces.agentContext) {
        return { kind: 'unavailable', reason: 'Agent Context pane not installed' };
      }
      return { kind: 'open-pane', viewKind: AGENT_CONTEXT_VIEW_KIND, tab: 'skills' };
    case 'plugins':
      return { kind: 'plugin-list' };
    case 'explorer':
      if (!surfaces.explorer) {
        return { kind: 'unavailable', reason: 'Explorer pane is not installed' };
      }
      return { kind: 'open-pane', viewKind: EXPLORER_VIEW_KIND };
    case 'git':
      if (!surfaces.sourceControl) {
        return { kind: 'unavailable', reason: 'Source Control pane is not installed' };
      }
      return { kind: 'open-pane', viewKind: SOURCE_CONTROL_VIEW_KIND };
    case 'pane': {
      if (!surfaces.paneWorkbench) {
        return { kind: 'unavailable', reason: 'Pane Workbench is not installed' };
      }
      const rest = splitSlashRest(input.query ?? '').rest;
      if (rest.length === 0) return { kind: 'pane-picker' };
      const match = matchPaneKind(input.views ?? [], rest);
      if (match === null) {
        return { kind: 'unavailable', reason: `no unique pane match for ${parseSlashToken(rest)}` };
      }
      return { kind: 'open-pane', viewKind: match.kind };
    }
    default:
      return { kind: 'unavailable', reason: `no inspect resolver for ${name}` };
  }
}

export interface HostCommandProjection {
  readonly name: string;
  readonly description: string;
  readonly inputHint?: string;
}

export function projectHostCommands(
  commands: readonly HostCommandProjection[],
  reserved: ReadonlySet<string>,
): CommandExperienceEntryV1[] {
  const entries: CommandExperienceEntryV1[] = [];
  for (const command of commands) {
    const name = command.name.trim().toLowerCase();
    if (name.length === 0 || reserved.has(name)) continue;
    entries.push({
      canonicalName: name,
      aliases: [],
      description: command.description.trim() || name,
      category: 'discovery',
      input: {
        ...(command.inputHint === undefined || command.inputHint.length === 0
          ? {}
          : { hint: command.inputHint }),
        schemaKey: `host-command:${command.name}`,
      },
      surfaces: ['web', 'tui'],
      actionKind: 'inspect',
      owner: 'host',
      danger: 'safe',
      availability: { state: 'available' },
      coverage: 'adapted',
    });
  }
  return entries;
}
