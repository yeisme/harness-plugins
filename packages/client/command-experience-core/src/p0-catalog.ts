/**
 * P0 command catalog projection.
 *
 * Inspect commands do not mutate DSH state. Missing owner actions stay
 * visible with a disabled reason. Aliases share one action identity.
 */

import type {
  CommandActionKind,
  CommandCoverage,
  CommandDanger,
  CommandExperienceEntryV1,
  CommandOwner,
} from './types';
import { normalizeCommandEntry } from './directory';

export interface OwnerCapabilitySnapshot {
  readonly availableActions: ReadonlySet<string>;
  readonly surfaces?: ReadonlySet<string>;
}

interface P0Seed {
  readonly canonicalName: string;
  readonly aliases?: readonly string[];
  readonly description: string;
  readonly category: 'discovery' | 'session' | 'model' | 'work' | 'lifecycle';
  readonly actionKind: CommandActionKind;
  readonly owner: CommandOwner;
  readonly danger: CommandDanger;
  readonly coverage: CommandCoverage;
  readonly hint?: string;
  readonly selectorKey?: string;
  readonly schemaKey?: string;
  readonly requiredAction?: string;
  readonly requiredSurface?: string;
}

const P0_SEEDS: readonly P0Seed[] = [
  { canonicalName: 'help', aliases: ['h', '?'], description: 'Show command help', category: 'discovery', actionKind: 'local', owner: 'client', danger: 'safe', coverage: 'adapted' },
  { canonicalName: 'commands', description: 'List available commands', category: 'discovery', actionKind: 'inspect', owner: 'client', danger: 'safe', coverage: 'equivalent' },
  { canonicalName: 'status', description: 'Show runtime status', category: 'discovery', actionKind: 'inspect', owner: 'dsh', danger: 'safe', coverage: 'staged', requiredAction: 'status' },
  { canonicalName: 'plugins', description: 'Inspect installed plugins', category: 'discovery', actionKind: 'inspect', owner: 'host', danger: 'safe', coverage: 'equivalent', schemaKey: 'inspect:plugins' },
  { canonicalName: 'mcp', description: 'Inspect MCP servers', category: 'discovery', actionKind: 'inspect', owner: 'host', danger: 'safe', coverage: 'equivalent', schemaKey: 'inspect:mcp', requiredSurface: 'mcpInspector' },
  { canonicalName: 'skills', description: 'Inspect installed skills', category: 'discovery', actionKind: 'inspect', owner: 'host', danger: 'safe', coverage: 'equivalent', schemaKey: 'inspect:skills', requiredSurface: 'agentContext' },
  { canonicalName: 'pane', description: 'Open a workspace pane', category: 'discovery', actionKind: 'navigation', owner: 'host', danger: 'safe', coverage: 'adapted', hint: '[kind]', selectorKey: 'paneKind', schemaKey: 'inspect:pane', requiredSurface: 'paneWorkbench' },
  { canonicalName: 'explorer', aliases: ['files'], description: 'Open the file explorer pane', category: 'discovery', actionKind: 'navigation', owner: 'host', danger: 'safe', coverage: 'adapted', schemaKey: 'inspect:explorer', requiredSurface: 'explorer' },
  { canonicalName: 'git', description: 'Open the source control pane', category: 'discovery', actionKind: 'navigation', owner: 'host', danger: 'safe', coverage: 'adapted', schemaKey: 'inspect:git', requiredSurface: 'sourceControl' },
  { canonicalName: 'agent', aliases: ['agents', 'subagents'], description: 'Pick the main agent or a subagent thread', category: 'session', actionKind: 'owner-action', owner: 'dsh', danger: 'safe', coverage: 'equivalent', selectorKey: 'threadRef', requiredAction: 'open-thread' },
  { canonicalName: 'preset', description: 'Select an agent preset', category: 'model', actionKind: 'owner-action', owner: 'dsh', danger: 'safe', coverage: 'equivalent', selectorKey: 'presetRef', requiredAction: 'apply-preset' },
  { canonicalName: 'resume', aliases: ['r'], description: 'Resume a saved session', category: 'session', actionKind: 'owner-action', owner: 'dsh', danger: 'safe', coverage: 'equivalent', selectorKey: 'sessionId', requiredAction: 'open-session' },
  { canonicalName: 'session', aliases: ['sessions'], description: 'Manage sessions: switch, rename, archive, restore', category: 'session', actionKind: 'owner-action', owner: 'dsh', danger: 'safe', coverage: 'adapted', selectorKey: 'sessionId', requiredAction: 'open-session', hint: '[switch|rename|archive|restore] [args]' },
  { canonicalName: 'archive', description: 'Archive a session (owner preview required)', category: 'session', actionKind: 'owner-action', owner: 'dsh', danger: 'confirm', coverage: 'staged', selectorKey: 'sessionId', requiredAction: 'archive-session' },
  { canonicalName: 'delete', description: 'Delete a session (owner preview required)', category: 'session', actionKind: 'owner-action', owner: 'dsh', danger: 'destructive', coverage: 'staged', selectorKey: 'sessionId', requiredAction: 'delete-session' },
  { canonicalName: 'new', description: 'Start a new chat', category: 'session', actionKind: 'owner-action', owner: 'dsh', danger: 'safe', coverage: 'equivalent', requiredAction: 'new-chat' },
  { canonicalName: 'fork', description: 'Fork the current chat', category: 'session', actionKind: 'owner-action', owner: 'dsh', danger: 'confirm', coverage: 'equivalent', requiredAction: 'fork-chat' },
  { canonicalName: 'rename', description: 'Rename the current session', category: 'session', actionKind: 'owner-action', owner: 'dsh', danger: 'safe', coverage: 'equivalent', hint: '<title>', requiredAction: 'rename-session' },
  { canonicalName: 'compact', description: 'Compact conversation context', category: 'work', actionKind: 'owner-action', owner: 'dsh', danger: 'confirm', coverage: 'equivalent', requiredAction: 'compact-context' },
  { canonicalName: 'model', description: 'Select the active model', category: 'model', actionKind: 'owner-action', owner: 'dsh', danger: 'safe', coverage: 'equivalent', requiredAction: 'set-model' },
  { canonicalName: 'reasoning', description: 'Set reasoning policy', category: 'model', actionKind: 'owner-action', owner: 'dsh', danger: 'safe', coverage: 'staged', requiredAction: 'set-reasoning' },
  { canonicalName: 'permissions', description: 'Review permission policy', category: 'model', actionKind: 'owner-action', owner: 'dsh', danger: 'confirm', coverage: 'staged', requiredAction: 'set-permissions' },
  { canonicalName: 'plan', description: 'Open the current plan', category: 'work', actionKind: 'inspect', owner: 'dsh', danger: 'safe', coverage: 'staged', requiredAction: 'open-plan' },
  { canonicalName: 'goal', description: 'Open the current goal', category: 'work', actionKind: 'inspect', owner: 'dsh', danger: 'safe', coverage: 'staged', requiredAction: 'open-goal' },
  { canonicalName: 'diff', description: 'Show a workspace or conversation diff', category: 'work', actionKind: 'inspect', owner: 'client', danger: 'safe', coverage: 'adapted' },
  { canonicalName: 'review', description: 'Open review mode', category: 'work', actionKind: 'owner-action', owner: 'dsh', danger: 'safe', coverage: 'staged', requiredAction: 'open-review' },
  { canonicalName: 'mention', description: 'Insert an owner-safe mention', category: 'work', actionKind: 'owner-action', owner: 'dsh', danger: 'safe', coverage: 'staged', requiredAction: 'insert-mention' },
  { canonicalName: 'copy', description: 'Copy the current selection', category: 'lifecycle', actionKind: 'local', owner: 'client', danger: 'safe', coverage: 'equivalent' },
  { canonicalName: 'feedback', description: 'Send product feedback', category: 'lifecycle', actionKind: 'owner-action', owner: 'dsh', danger: 'safe', coverage: 'staged', requiredAction: 'send-feedback' },
  { canonicalName: 'init', description: 'Codex-specific initialization is not applicable', category: 'lifecycle', actionKind: 'local', owner: 'client', danger: 'safe', coverage: 'not-applicable' },
  { canonicalName: 'logout', description: 'Sign out of the current identity', category: 'lifecycle', actionKind: 'owner-action', owner: 'dsh', danger: 'confirm', coverage: 'staged', requiredAction: 'logout' },
  { canonicalName: 'quit', aliases: ['exit'], description: 'Quit the current client surface', category: 'lifecycle', actionKind: 'local', owner: 'client', danger: 'confirm', coverage: 'equivalent' },
];

const INSPECT_COMMANDS = new Set(['help', 'commands', 'status', 'plugins', 'mcp', 'skills', 'pane', 'explorer', 'git', 'diff', 'plan', 'goal']);

const SURFACE_REASONS: Record<string, string> = {
  mcpInspector: 'MCP inspector plugin not installed',
  agentContext: 'Agent Context pane not installed',
  paneWorkbench: 'Pane Workbench is not installed',
  explorer: 'Explorer pane is not installed',
  sourceControl: 'Source Control pane is not installed',
};

export function buildP0Catalog(capabilities: OwnerCapabilitySnapshot = { availableActions: new Set() }): CommandExperienceEntryV1[] {
  const surfaces = capabilities.surfaces ?? new Set<string>();
  return P0_SEEDS.map((seed) => {
    const missingAction = seed.requiredAction !== undefined && !capabilities.availableActions.has(seed.requiredAction)
    const missingSurface = seed.requiredSurface !== undefined && !surfaces.has(seed.requiredSurface)
    const notApplicable = seed.coverage === 'not-applicable'
    const entry: CommandExperienceEntryV1 = {
      canonicalName: seed.canonicalName,
      aliases: seed.aliases ?? [],
      description: seed.description,
      category: seed.category,
      input: {
        ...(seed.hint === undefined ? {} : { hint: seed.hint }),
        ...(seed.selectorKey === undefined ? {} : { selectorKey: seed.selectorKey }),
        ...(seed.schemaKey === undefined ? {} : { schemaKey: seed.schemaKey }),
      },
      surfaces: ['web', 'tui'],
      actionKind: seed.actionKind,
      owner: seed.owner,
      danger: seed.danger,
      availability: notApplicable
        ? { state: 'disabled', reason: 'not applicable on DSH' }
        : missingAction
          ? { state: 'disabled', reason: `missing owner action ${seed.requiredAction}` }
          : missingSurface
            ? { state: 'disabled', reason: SURFACE_REASONS[seed.requiredSurface!] ?? `missing surface ${seed.requiredSurface}` }
            : { state: 'available' },
      coverage: seed.coverage,
    }
    return normalizeCommandEntry(entry)
  })
}

export function inspectCommandsMutateState(canonicalName: string): boolean {
  return !INSPECT_COMMANDS.has(canonicalName.replace(/^\//, ''))
}

/**
 * Canonical names the official DSH runtime already owns (`dsh-command-goal`,
 * plan mode). The `/` directory still lists them, but the host projection
 * must never register them: the official registry is first-come with hard
 * duplicate failures, and a hot-plug bundle claiming these names first would
 * crash the official plugins' boot.
 */
export const OFFICIAL_OWNED_INSPECT_NAMES: ReadonlySet<string> = new Set(['goal', 'plan'])

export function sharedActionIdentity(left: string, right: string, catalog: readonly CommandExperienceEntryV1[]): boolean {
  const resolve = (name: string): string => {
    const needle = name.replace(/^\//, '')
    const hit = catalog.find((entry) => entry.canonicalName === needle || entry.aliases.includes(needle))
    return hit?.canonicalName ?? needle
  }
  return resolve(left) === resolve(right)
}

export interface CoverageLedgerRow {
  readonly command: string;
  readonly coverage: CommandCoverage;
  readonly owner: string;
  readonly seam: string;
  readonly verifyCommand: string;
}

export function auditCoverageLedger(rows: readonly CoverageLedgerRow[]): readonly string[] {
  const issues: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (seen.has(row.command)) issues.push(`duplicate ${row.command}`)
    seen.add(row.command)
    if (row.coverage.length === 0) issues.push(`${row.command} missing coverage`)
    if (row.owner.trim().length === 0) issues.push(`${row.command} missing owner`)
    if (row.seam.trim().length === 0) issues.push(`${row.command} missing seam`)
    if (row.verifyCommand.trim().length === 0) issues.push(`${row.command} missing verify command`)
  }
  return issues
}
