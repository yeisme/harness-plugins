/**
 * Project pane views and launcher commands into slash catalog entries.
 * Command-experience never lists pane plugins by name; it reads a live
 * snapshot. Execution stays on the pane plugin that registered the command.
 */

import type { CommandExperienceEntryV1 } from './types';
import { sanitizeCommandDescriptor } from './sanitize';
import { isReservedSlashName, isSafeSlashName } from './live-directory';
import { normalizeCommandEntry } from './directory';

export interface PaneSlashViewSnapshot {
  readonly kind: string;
  readonly label: string;
  readonly showInPicker?: boolean;
  readonly role?: string;
  readonly preferredRegion?: string;
  readonly retention?: string;
  readonly singleton?: boolean;
  readonly componentKey?: string;
}

export interface PaneSlashBindingSnapshot {
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly hint?: string;
  readonly category?: string;
}

export interface PaneSlashCommandSnapshot {
  readonly id: string;
  readonly label: string;
  readonly launcher?: boolean;
  readonly slash?: PaneSlashBindingSnapshot;
}

export const PANE_HUB_NAME = 'pane';

const SAFE_ID = /^[a-z0-9][a-z0-9._:/-]*$/i;

export function paneCommandSlashName(id: string): string | null {
  const name = id
    .toLowerCase()
    .replace(/[._]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return isSafeSlashName(name) ? name : null;
}

export function pickerVisiblePaneViews(
  views: readonly PaneSlashViewSnapshot[],
): readonly PaneSlashViewSnapshot[] {
  return views.filter((view) => view.showInPicker !== false && SAFE_ID.test(view.kind));
}

function sanitizedEntry(input: {
  readonly canonicalName: string;
  readonly aliases: readonly string[];
  readonly description: string;
  readonly category: string;
  readonly hint?: string;
  readonly selectorKey?: string;
  readonly schemaKey: string;
  readonly actionKind: CommandExperienceEntryV1['actionKind'];
}): CommandExperienceEntryV1 | null {
  const sanitized = sanitizeCommandDescriptor({
    description: input.description,
    category: input.category,
  });
  if (sanitized.rejected.length > 0) return null;
  if (!isSafeSlashName(input.canonicalName)) return null;
  return normalizeCommandEntry({
    canonicalName: input.canonicalName,
    aliases: input.aliases.filter(isSafeSlashName),
    description: sanitized.description || input.description,
    category: sanitized.category === 'other' ? input.category : sanitized.category,
    input: {
      ...(input.hint === undefined ? {} : { hint: input.hint }),
      ...(input.selectorKey === undefined ? {} : { selectorKey: input.selectorKey }),
      schemaKey: input.schemaKey,
    },
    surfaces: ['web', 'tui'],
    actionKind: input.actionKind,
    owner: 'host',
    danger: 'safe',
    availability: { state: 'available' },
    coverage: 'adapted',
  });
}

export function projectPaneHub(
  views: readonly PaneSlashViewSnapshot[],
  reserved: ReadonlySet<string>,
): CommandExperienceEntryV1 | null {
  const visible = pickerVisiblePaneViews(views);
  const available = visible.length > 0;
  // Current catalogs seed `/pane` as a reserved P0 hub; the pane source only
  // provides the hub itself on catalogs that predate the seed, so a reserved
  // name never yields a second (conflicting) entry.
  if (isReservedSlashName(PANE_HUB_NAME, reserved)) {
    return null;
  }
  const entry = sanitizedEntry({
    canonicalName: PANE_HUB_NAME,
    aliases: [],
    description: 'Open a workspace pane',
    category: 'pane',
    hint: '[kind]',
    selectorKey: 'paneKind',
    schemaKey: 'inspect:pane',
    actionKind: 'navigation',
  });
  if (entry === null) return null;
  return {
    ...entry,
    availability: available
      ? { state: 'available' }
      : { state: 'disabled', reason: 'Pane Workbench is not installed' },
  };
}

export function projectPaneLauncherCommands(
  commands: readonly PaneSlashCommandSnapshot[],
  reserved: ReadonlySet<string>,
): CommandExperienceEntryV1[] {
  const entries: CommandExperienceEntryV1[] = [];
  for (const command of commands) {
    const wantsSlash = command.slash?.name !== undefined || command.launcher === true;
    if (!wantsSlash) continue;
    const defaultName = paneCommandSlashName(command.id);
    const requested = command.slash?.name?.trim().toLowerCase() ?? defaultName;
    if (requested === null || !isSafeSlashName(requested)) continue;
    const aliases = (command.slash?.aliases ?? []).map((alias) => alias.trim().toLowerCase());
    const reservedHit = isReservedSlashName(requested, reserved)
      || aliases.some((alias) => isReservedSlashName(alias, reserved));
    const entry = sanitizedEntry({
      canonicalName: requested,
      aliases,
      description: command.label,
      category: command.slash?.category ?? 'pane',
      ...(command.slash?.hint === undefined ? {} : { hint: command.slash.hint }),
      schemaKey: `pane-command:${command.id}`,
      actionKind: 'navigation',
    });
    if (entry === null) continue;
    entries.push(
      reservedHit
        ? {
            ...entry,
            availability: {
              state: 'disabled',
              reason: `reserved command name ${requested}`,
            },
          }
        : entry,
    );
  }
  return entries;
}

export function projectPaneSlashSource(input: {
  readonly views: readonly PaneSlashViewSnapshot[];
  readonly commands: readonly PaneSlashCommandSnapshot[];
  readonly reserved: ReadonlySet<string>;
}): readonly CommandExperienceEntryV1[] {
  // `/pane` stays a P0 reserved hub. Pane plugins only contribute launcher
  // or explicit slash short names; they never replace reserved commands.
  return projectPaneLauncherCommands(input.commands, input.reserved);
}
