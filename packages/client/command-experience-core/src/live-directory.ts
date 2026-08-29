/**
 * Live slash directory: merge P0, pane, and host sources without
 * throwing. Reserved P0 names win. Later conflicts stay visible and
 * disabled. First discovery never issues RPC.
 */

import type {
  CommandDirectorySource,
  CommandExperienceEntryV1,
} from './types';
import { normalizeCommandEntry } from './directory';
import { buildP0Catalog, type OwnerCapabilitySnapshot } from './p0-catalog';

export interface LiveDirectoryConflict {
  readonly canonicalName: string;
  readonly keptSource: string;
  readonly rejectedSource: string;
  readonly reason: string;
}

export interface LiveDirectorySnapshot {
  readonly commands: readonly CommandExperienceEntryV1[];
  readonly conflicts: readonly LiveDirectoryConflict[];
  readonly rpcIssued: false;
}

export const P0_DIRECTORY_SOURCE = 'p0';
export const PANE_DIRECTORY_SOURCE = 'pane';
export const HOST_DIRECTORY_SOURCE = 'host';

export const P0_SOURCE_PRIORITY = 100;
export const PANE_SOURCE_PRIORITY = 50;
export const HOST_SOURCE_PRIORITY = 25;

const SLASH_NAME = /^[a-z][a-z0-9-]{1,31}$/;

export function reservedSlashNames(
  catalog: readonly CommandExperienceEntryV1[] = buildP0Catalog(),
): ReadonlySet<string> {
  const names = new Set<string>();
  for (const entry of catalog) {
    names.add(entry.canonicalName);
    for (const alias of entry.aliases) names.add(alias);
  }
  return names;
}

export function isReservedSlashName(
  name: string,
  reserved: ReadonlySet<string> = reservedSlashNames(),
): boolean {
  return reserved.has(name.replace(/^\s*\/+/, '').trim().toLowerCase());
}

export function isSafeSlashName(name: string): boolean {
  return SLASH_NAME.test(name);
}

function disableEntry(
  entry: CommandExperienceEntryV1,
  reason: string,
): CommandExperienceEntryV1 {
  return {
    ...entry,
    availability: { state: 'disabled', reason },
  };
}

/**
 * Fail-closed merge for hot-plug sources. Unlike mergeCommandSources,
 * this never throws: reserved and duplicate names stay in the menu as
 * disabled rows so a plugin cannot collapse `/`.
 */
export function mergeLiveDirectory(
  sources: readonly CommandDirectorySource[],
  reserved: ReadonlySet<string> = reservedSlashNames(),
): LiveDirectorySnapshot {
  const sorted = [...sources].sort((left, right) => right.priority - left.priority);
  const commandMap = new Map<string, { entry: CommandExperienceEntryV1; source: string }>();
  const aliasOwners = new Map<string, string>();
  const conflicts: LiveDirectoryConflict[] = [];
  const extras: CommandExperienceEntryV1[] = [];

  const claimAliases = (entry: CommandExperienceEntryV1, source: string): void => {
    aliasOwners.set(entry.canonicalName, source);
    for (const alias of entry.aliases) {
      if (!aliasOwners.has(alias)) aliasOwners.set(alias, source);
    }
  };

  for (const source of sorted) {
    for (const raw of source.commands) {
      const entry = normalizeCommandEntry(raw);
      const reservedHit = reserved.has(entry.canonicalName)
        && source.source !== P0_DIRECTORY_SOURCE;
      if (reservedHit) {
        conflicts.push({
          canonicalName: entry.canonicalName,
          keptSource: P0_DIRECTORY_SOURCE,
          rejectedSource: source.source,
          reason: `reserved command name ${entry.canonicalName}`,
        });
        extras.push(disableEntry(entry, `reserved command name ${entry.canonicalName}`));
        continue;
      }

      const existing = commandMap.get(entry.canonicalName);
      if (existing !== undefined) {
        conflicts.push({
          canonicalName: entry.canonicalName,
          keptSource: existing.source,
          rejectedSource: source.source,
          reason: `canonical name ${entry.canonicalName} already claimed by ${existing.source}`,
        });
        extras.push(disableEntry(entry, `name conflict with ${existing.source}`));
        continue;
      }

      const aliasClash = entry.aliases.find((alias) => {
        const owner = aliasOwners.get(alias);
        return owner !== undefined && owner !== source.source;
      });
      if (aliasClash !== undefined) {
        conflicts.push({
          canonicalName: entry.canonicalName,
          keptSource: aliasOwners.get(aliasClash) ?? P0_DIRECTORY_SOURCE,
          rejectedSource: source.source,
          reason: `alias ${aliasClash} already claimed`,
        });
        extras.push(disableEntry(entry, `alias conflict on ${aliasClash}`));
        continue;
      }

      commandMap.set(entry.canonicalName, { entry, source: source.source });
      claimAliases(entry, source.source);
    }
  }

  return {
    commands: [...commandMap.values()].map((item) => item.entry).concat(extras),
    conflicts,
    rpcIssued: false,
  };
}



export interface LiveSlashDirectory {
  setSource(source: CommandDirectorySource): void;
  removeSource(id: string): void;
  replaceP0(capabilities: OwnerCapabilitySnapshot): void;
  snapshot(): LiveDirectorySnapshot;
  subscribe(listener: () => void): () => void;
}

export function createLiveSlashDirectory(
  capabilities: OwnerCapabilitySnapshot = { availableActions: new Set() },
): LiveSlashDirectory {
  const sources = new Map<string, CommandDirectorySource>();
  const listeners = new Set<() => void>();
  let reserved = reservedSlashNames();
  const writeP0 = (next: OwnerCapabilitySnapshot): void => {
    const commands = buildP0Catalog(next);
    reserved = reservedSlashNames(commands);
    sources.set(P0_DIRECTORY_SOURCE, {
      source: P0_DIRECTORY_SOURCE,
      priority: P0_SOURCE_PRIORITY,
      commands,
    });
  };
  writeP0(capabilities);

  const emit = (): void => {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        /* a directory subscriber cannot block hot-unplug */
      }
    }
  };

  return {
    setSource(source) {
      sources.set(source.source, source);
      emit();
    },
    removeSource(id) {
      if (id === P0_DIRECTORY_SOURCE) return;
      if (sources.delete(id)) emit();
    },
    replaceP0(next) {
      writeP0(next);
      emit();
    },
    snapshot() {
      return mergeLiveDirectory([...sources.values()], reserved);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
