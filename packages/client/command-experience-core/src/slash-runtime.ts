/**
 * Live slash runtime shared by Web/TUI adapters.
 *
 * Watches pane and host command snapshots, rebuilds the directory, and
 * plans inspect execution. It never issues RPC on discovery and never
 * owns pane handlers.
 */

import {
  HOST_DIRECTORY_SOURCE,
  HOST_SOURCE_PRIORITY,
  PANE_DIRECTORY_SOURCE,
  PANE_SOURCE_PRIORITY,
  createLiveSlashDirectory,
  reservedSlashNames,
  type LiveDirectorySnapshot,
  type LiveSlashDirectory,
} from './live-directory';
import {
  planInspectCommand,
  projectHostCommands,
  type HostCommandProjection,
  type InspectPlan,
  type InspectSurfaceSnapshot,
} from './inspect-resolve';
import {
  projectPaneSlashSource,
  type PaneSlashCommandSnapshot,
  type PaneSlashViewSnapshot,
} from './pane-projection';
import { buildP0Catalog, OFFICIAL_OWNED_INSPECT_NAMES, type OwnerCapabilitySnapshot } from './p0-catalog';
import type { CommandExperienceEntryV1 } from './types';

export interface SlashPaneViewRecord extends PaneSlashViewSnapshot {
  readonly resourceKey?: string;
}

export interface SlashPaneWorkbench {
  readonly views: {
    snapshot(): readonly SlashPaneViewRecord[];
    subscribe(listener: () => void): () => void;
  };
  readonly commands: {
    snapshot(): readonly { readonly descriptor: PaneCommandLike; readonly execute?: () => unknown }[];
    subscribe(listener: () => void): () => void;
    execute(id: string): Promise<unknown> | unknown;
  };
  openView(request: SlashOpenViewRequest): void;
}

export interface PaneCommandLike {
  readonly id: string;
  readonly label: string;
  readonly presentation?: { readonly launcher?: boolean };
  readonly slash?: PaneSlashCommandSnapshot['slash'];
}

export interface SlashOpenViewRequest {
  readonly kind: string;
  readonly resourceKey: string;
  readonly role: string;
  readonly preferredRegion: string;
  readonly retention: string;
  readonly singleton: boolean;
  readonly title?: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface SlashHostCommands {
  snapshot(): readonly HostCommandProjection[];
  subscribe?(listener: () => void): () => void;
  execute?(name: string, input: string): Promise<unknown> | unknown;
  register?(definition: {
    readonly name: string;
    readonly description: string;
    readonly inputHint?: string;
    readonly handler: (input: string) => unknown;
  }): () => void;
}

export interface SlashConversationViews {
  has(id: string): boolean;
  activate?(id: string): boolean;
}

export interface SlashPluginRecord {
  readonly id: string;
  readonly status?: string;
}

export interface SlashRuntimeHost {
  readonly paneWorkbench?: SlashPaneWorkbench;
  readonly hostCommands?: SlashHostCommands;
  readonly conversationViews?: SlashConversationViews;
  readonly plugins?: () => readonly SlashPluginRecord[];
  readonly ownerActions?: ReadonlySet<string>;
}

export interface SlashInspectResult {
  readonly plan: InspectPlan;
  readonly message: string;
}

export interface SlashHostRegistration {
  readonly name: string;
  readonly description: string;
  readonly inputHint?: string;
  readonly recordInput: false;
  readonly handler: (rawInput: string) => { readonly kind: 'success' | 'error'; readonly text: string };
}

export interface SlashRuntime {
  snapshot(): LiveDirectorySnapshot;
  subscribe(listener: () => void): () => void;
  surfaces(): InspectSurfaceSnapshot;
  execute(command: CommandExperienceEntryV1, query?: string): SlashInspectResult;
  dispose(): void;
}

function surfacesFrom(host: SlashRuntimeHost): InspectSurfaceSnapshot {
  const views = host.paneWorkbench?.views.snapshot() ?? [];
  const kinds = new Set(views.map((view) => view.kind));
  return {
    mcpInspector: host.conversationViews?.has('mcp-inspector') === true,
    agentContext: kinds.has('workspace.agent-context'),
    paneWorkbench: host.paneWorkbench !== undefined,
    explorer: kinds.has('dsh.explorer'),
    sourceControl: kinds.has('dsh.source-control'),
    conversationViewSwitcher: host.conversationViews?.activate !== undefined
      || host.conversationViews?.has('mcp-inspector') === true,
  };
}

function paneCommands(host: SlashRuntimeHost): PaneSlashCommandSnapshot[] {
  return (host.paneWorkbench?.commands.snapshot() ?? []).map((row) => ({
    id: row.descriptor.id,
    label: row.descriptor.label,
    ...(row.descriptor.presentation?.launcher === undefined ? {} : { launcher: row.descriptor.presentation.launcher }),
    ...(row.descriptor.slash === undefined ? {} : { slash: row.descriptor.slash }),
  }));
}

function capabilitiesOf(host: SlashRuntimeHost): OwnerCapabilitySnapshot {
  const surfaces = surfacesFrom(host);
  const surfaceSet = new Set<string>();
  if (surfaces.mcpInspector) surfaceSet.add('mcpInspector');
  if (surfaces.agentContext) surfaceSet.add('agentContext');
  if (surfaces.paneWorkbench) surfaceSet.add('paneWorkbench');
  if (surfaces.explorer) surfaceSet.add('explorer');
  if (surfaces.sourceControl) surfaceSet.add('sourceControl');
  return {
    availableActions: host.ownerActions ?? new Set(),
    surfaces: surfaceSet,
  };
}

function openRequestFor(
  views: readonly SlashPaneViewRecord[],
  kind: string,
  tab?: string,
): SlashOpenViewRequest {
  const view = views.find((item) => item.kind === kind);
  return {
    kind,
    resourceKey: view?.resourceKey ?? `slash:${kind}`,
    role: view?.role ?? 'inspector',
    preferredRegion: view?.preferredRegion ?? 'right',
    retention: view?.retention ?? 'keep-alive',
    singleton: view?.singleton ?? true,
    ...(view?.label === undefined ? {} : { title: view.label }),
    ...(tab === undefined ? {} : { metadata: { tab } }),
  };
}

export function createSlashRuntime(host: SlashRuntimeHost = {}): SlashRuntime {
  const directory: LiveSlashDirectory = createLiveSlashDirectory(capabilitiesOf(host));
  const disposers: Array<() => void> = [];
  let disposed = false;

  const rebuild = (): void => {
    if (disposed) return;
    const capabilities = capabilitiesOf(host);
    directory.replaceP0(capabilities);
    const reserved = reservedSlashNames(buildP0Catalog(capabilities));
    const paneEntries = host.paneWorkbench === undefined
      ? []
      : [...projectPaneSlashSource({
        views: host.paneWorkbench.views.snapshot(),
        commands: paneCommands(host),
        reserved,
      })];
    if (host.paneWorkbench !== undefined) {
      directory.setSource({
        source: PANE_DIRECTORY_SOURCE,
        priority: PANE_SOURCE_PRIORITY,
        commands: paneEntries,
      });
    } else {
      directory.removeSource(PANE_DIRECTORY_SOURCE);
    }
    const occupied = new Set(reserved);
    for (const entry of paneEntries) occupied.add(entry.canonicalName);
    if (host.hostCommands !== undefined) {
      directory.setSource({
        source: HOST_DIRECTORY_SOURCE,
        priority: HOST_SOURCE_PRIORITY,
        commands: projectHostCommands(host.hostCommands.snapshot(), occupied),
      });
    } else {
      directory.removeSource(HOST_DIRECTORY_SOURCE);
    }
  };

  rebuild();
  if (host.paneWorkbench !== undefined) {
    disposers.push(host.paneWorkbench.views.subscribe(rebuild));
    disposers.push(host.paneWorkbench.commands.subscribe(rebuild));
  }
  if (host.hostCommands?.subscribe !== undefined) {
    disposers.push(host.hostCommands.subscribe(rebuild));
  }

  return {
    snapshot: () => directory.snapshot(),
    subscribe: (listener) => directory.subscribe(listener),
    surfaces: () => surfacesFrom(host),
    execute(command, query) {
      const plan = planInspectCommand({
        command,
        ...(query === undefined ? {} : { query }),
        surfaces: surfacesFrom(host),
        views: host.paneWorkbench?.views.snapshot() ?? [],
      });
      switch (plan.kind) {
        case 'open-conversation-view': {
          const activated = host.conversationViews?.activate?.(plan.viewId) === true;
          if (activated) {
            return { plan, message: `Opened ${plan.viewId}.` };
          }
          if (host.conversationViews?.has(plan.viewId) === true) {
            return {
              plan,
              message: `The ${plan.viewId} view is installed. Open it from the conversation view tabs.`,
            };
          }
          return { plan, message: `Could not activate ${plan.viewId}.` };
        }
        case 'open-pane': {
          host.paneWorkbench?.openView(
            openRequestFor(host.paneWorkbench.views.snapshot(), plan.viewKind, plan.tab),
          );
          return { plan, message: `Opened pane ${plan.viewKind}.` };
        }
        case 'pane-picker':
          return { plan, message: 'Open a workspace pane from the picker.' };
        case 'plugin-list': {
          const plugins = host.plugins?.() ?? [];
          const text = plugins.length === 0
            ? 'No plugin inventory is available in this session.'
            : plugins.map((plugin) => plugin.status === undefined ? plugin.id : `${plugin.id} (${plugin.status})`).join('\n');
          return { plan, message: text };
        }
        case 'pane-command': {
          void host.paneWorkbench?.commands.execute(plan.commandId);
          return { plan, message: `Ran pane command ${plan.commandId}.` };
        }
        case 'host-command': {
          void host.hostCommands?.execute?.(plan.name, query ?? '');
          return { plan, message: `Ran host command ${plan.name}.` };
        }
        case 'unavailable':
          return { plan, message: plan.reason };
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const dispose of disposers.reverse()) dispose();
    },
  };
}

export function inspectRegistrationsFrom(
  runtime: SlashRuntime,
): readonly SlashHostRegistration[] {
  const seen = new Set<string>();
  const registrations: SlashHostRegistration[] = [];
  for (const command of runtime.snapshot().commands) {
    if (command.actionKind !== 'inspect' && command.actionKind !== 'navigation') continue;
    if (command.input.schemaKey?.startsWith('host-command:') === true) continue;
    // Official-owned names stay with the official plugins; claiming them from
    // a hot-plug bundle would fail the official boot with a duplicate error.
    if (OFFICIAL_OWNED_INSPECT_NAMES.has(command.canonicalName)) continue;
    if (seen.has(command.canonicalName)) continue;
    seen.add(command.canonicalName);
    const name = command.canonicalName;
    registrations.push({
      name,
      description: command.description,
      ...(command.input.hint === undefined ? {} : { inputHint: command.input.hint }),
      recordInput: false,
      handler: (rawInput: string) => {
        const current = runtime.snapshot().commands.find((item) => item.canonicalName === name) ?? command;
        const query = rawInput.trim().length === 0 ? `/${name}` : `/${name} ${rawInput.trim()}`;
        const result = runtime.execute(current, query);
        return {
          kind: result.plan.kind === 'unavailable' ? 'error' : 'success',
          text: result.message,
        };
      },
    });
  }
  return registrations;
}

export function syncInspectRegistrations(
  runtime: SlashRuntime,
  register: (definition: SlashHostRegistration) => () => void,
): () => void {
  const active = new Map<string, () => void>();
  const applySnapshot = (): void => {
    const next = inspectRegistrationsFrom(runtime);
    const keep = new Set(next.map((item) => item.name));
    for (const [name, dispose] of active) {
      if (!keep.has(name)) {
        dispose();
        active.delete(name);
      }
    }
    for (const definition of next) {
      if (active.has(definition.name)) continue;
      active.set(definition.name, register(definition));
    }
  };
  applySnapshot();
  const unsubscribe = runtime.subscribe(applySnapshot);
  return () => {
    unsubscribe();
    for (const dispose of active.values()) dispose();
    active.clear();
  };
}
