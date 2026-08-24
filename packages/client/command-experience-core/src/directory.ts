/**
 * Command Directory Utilities
 *
 * Pure functions for command directory management:
 * - Normalization
 * - Source merging
 * - Conflict detection
 * - Filtering and sorting
 * - Exact match and unique prefix detection
 */

import type {
  CommandExperienceEntryV1,
  CommandDirectorySource,
  CommandFilterOptions,
  CommandSortOrder,
  AvailabilityState,
  CommandSurface,
} from './types';

/**
 * Normalize a command entry to ensure consistency
 */
export function normalizeCommandEntry(
  entry: CommandExperienceEntryV1
): CommandExperienceEntryV1 {
  return {
    ...entry,
    canonicalName: entry.canonicalName.toLowerCase().trim(),
    aliases: entry.aliases.map(a => a.toLowerCase().trim()),
    description: entry.description.trim(),
    category: entry.category.trim(),
  };
}

/**
 * Merge command directory from multiple sources
 * Throws on canonical name conflicts (non-alias)
 */
export function mergeCommandSources(
  sources: readonly CommandDirectorySource[]
): CommandExperienceEntryV1[] {
  // Sort by priority descending
  const sortedSources = [...sources].sort((a, b) => b.priority - a.priority);

  // Build command map and detect conflicts
  const commandMap = new Map<string, CommandExperienceEntryV1>();
  const conflicts: Map<string, Array<{ entry: CommandExperienceEntryV1; source: string }>> = new Map();

  for (const source of sortedSources) {
    for (const entry of source.commands) {
      const normalized = normalizeCommandEntry(entry);
      const { canonicalName } = normalized;

      const existing = commandMap.get(canonicalName);
      if (existing) {
        // Check if this is an alias match
        const isAliasMatch = normalized.aliases.includes(canonicalName) ||
                             existing.aliases.includes(canonicalName);

        if (!isAliasMatch) {
          // Real conflict
          if (!conflicts.has(canonicalName)) {
            conflicts.set(canonicalName, [
              { entry: existing, source: getSourceForCommand(existing, sortedSources) },
            ]);
          }
          conflicts.get(canonicalName)!.push({ entry: normalized, source: source.source });
        }
      } else {
        commandMap.set(canonicalName, normalized);
      }
    }
  }

  // Fail-loud on conflicts
  if (conflicts.size > 0) {
    const conflictList = Array.from(conflicts.entries()).map(([name, entries]) => ({
      canonicalName: name,
      entries: entries.map(e => ({
        command: e.entry,
        source: e.source,
      })),
    }));
    throw new Error(
      `Canonical name conflicts detected:\n` +
      conflictList.map(c =>
        `  - ${c.canonicalName}: ` +
        c.entries.map(e => `${e.source} (${e.command.canonicalName})`).join(', ')
      ).join('\n')
    );
  }

  return Array.from(commandMap.values());
}

function getSourceForCommand(
  command: CommandExperienceEntryV1,
  sources: readonly CommandDirectorySource[]
): string {
  for (const source of sources) {
    if (source.commands.some(c => c.canonicalName === command.canonicalName)) {
      return source.source;
    }
  }
  return 'unknown';
}

/**
 * Check if command matches availability criteria
 */
export function matchesAvailability(
  command: CommandExperienceEntryV1,
  minState?: AvailabilityState
): boolean {
  const stateOrder: AvailabilityState[] = ['hidden', 'disabled', 'available'];
  const commandLevel = stateOrder.indexOf(command.availability.state);
  const minLevel = minState ? stateOrder.indexOf(minState) : 0;

  return commandLevel >= minLevel;
}

/**
 * Check if command matches surface
 */
export function matchesSurface(
  command: CommandExperienceEntryV1,
  surface?: CommandSurface
): boolean {
  if (!surface) return true;
  return command.surfaces.includes(surface);
}

/**
 * Check if command matches category
 */
export function matchesCategory(
  command: CommandExperienceEntryV1,
  category?: string
): boolean {
  if (!category) return true;
  return command.category === category;
}

/**
 * Fuzzy match command name or description against query
 */
export function matchesQuery(
  command: CommandExperienceEntryV1,
  query: string
): boolean {
  if (!query) return true;

  // Strip leading slash for matching (users type /agent but command is agent)
  const lowerQuery = query.toLowerCase().replace(/^\//, '');

  // Check canonical name
  if (command.canonicalName.includes(lowerQuery)) {
    return true;
  }

  // Check aliases
  if (command.aliases.some(a => a.includes(lowerQuery))) {
    return true;
  }

  // Check description
  if (command.description.toLowerCase().includes(lowerQuery)) {
    return true;
  }

  return false;
}

/**
 * Filter commands based on options
 */
export function filterCommands(
  commands: readonly CommandExperienceEntryV1[],
  options: CommandFilterOptions = {}
): CommandExperienceEntryV1[] {
  return commands.filter(command => {
    if (!matchesAvailability(command, options.minAvailability)) {
      return false;
    }
    if (!matchesSurface(command, options.surface)) {
      return false;
    }
    if (!matchesCategory(command, options.category)) {
      return false;
    }
    if (options.query && !matchesQuery(command, options.query)) {
      return false;
    }
    if (!options.includeHidden && command.availability.state === 'hidden') {
      return false;
    }
    return true;
  });
}

/**
 * Sort commands by specified order
 */
export function sortCommands(
  commands: readonly CommandExperienceEntryV1[],
  order: CommandSortOrder = 'category'
): CommandExperienceEntryV1[] {
  const sorted = [...commands];

  switch (order) {
    case 'alphabetical':
      return sorted.sort((a, b) =>
        a.canonicalName.localeCompare(b.canonicalName)
      );

    case 'category':
      return sorted.sort((a, b) => {
        const categoryCompare = a.category.localeCompare(b.category);
        if (categoryCompare !== 0) return categoryCompare;
        return a.canonicalName.localeCompare(b.canonicalName);
      });

    case 'frequency':
    case 'recent':
      // TODO: Implement with usage tracking
      return sortCommands(commands, 'category');

    default:
      return sorted;
  }
}

/**
 * Get all unique categories from commands
 */
export function getCategories(
  commands: readonly CommandExperienceEntryV1[]
): string[] {
  const categories = new Set<string>();
  for (const command of commands) {
    categories.add(command.category);
  }
  return Array.from(categories).sort();
}

/**
 * Find exact command match (by canonical name or alias)
 */
export function findExactMatch(
  commands: readonly CommandExperienceEntryV1[],
  name: string
): CommandExperienceEntryV1 | null {
  const normalizedName = name.toLowerCase().trim();

  for (const command of commands) {
    if (command.canonicalName === normalizedName) {
      return command;
    }
    if (command.aliases.includes(normalizedName)) {
      return command;
    }
  }

  return null;
}

/**
 * Find commands matching a unique prefix
 * Returns commands where the canonical name starts with the prefix
 * Only returns if the prefix uniquely identifies one command
 */
export function findUniquePrefixMatch(
  commands: readonly CommandExperienceEntryV1[],
  prefix: string
): CommandExperienceEntryV1 | null {
  const normalizedPrefix = prefix.toLowerCase().trim();

  if (!normalizedPrefix) {
    return null;
  }

  const matches = commands.filter(command =>
    command.canonicalName.startsWith(normalizedPrefix) &&
    command.canonicalName !== normalizedPrefix // Exact match handled separately
  );

  if (matches.length === 1) {
    return matches[0] ?? null;
  }

  return null;
}

/**
 * Get all commands matching a prefix (for suggestions)
 */
export function findPrefixMatches(
  commands: readonly CommandExperienceEntryV1[],
  prefix: string
): CommandExperienceEntryV1[] {
  const normalizedPrefix = prefix.toLowerCase().trim();

  if (!normalizedPrefix) {
    return [];
  }

  return commands.filter(command =>
    command.canonicalName.startsWith(normalizedPrefix) ||
    command.aliases.some(alias => alias.startsWith(normalizedPrefix))
  );
}

/**
 * Calculate a stable sort key for commands
 * Used for maintaining consistent ordering in UI
 */
export function getCommandSortKey(
  command: CommandExperienceEntryV1,
  order: CommandSortOrder = 'category'
): string {
  switch (order) {
    case 'alphabetical':
      return command.canonicalName;

    case 'category':
      return `${command.category}:${command.canonicalName}`;

    case 'frequency':
    case 'recent':
      // TODO: Implement with usage tracking
      return getCommandSortKey(command, 'category');

    default:
      return command.canonicalName;
  }
}

/**
 * Group commands by category
 */
export function groupByCategory(
  commands: readonly CommandExperienceEntryV1[]
): Map<string, CommandExperienceEntryV1[]> {
  const groups = new Map<string, CommandExperienceEntryV1[]>();

  for (const command of commands) {
    const category = command.category;
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(command);
  }

  return groups;
}

/**
 * Check if a command is executable (available and not disabled/hidden)
 */
export function isCommandExecutable(command: CommandExperienceEntryV1): boolean {
  return command.availability.state === 'available';
}

/**
 * Check if a command requires confirmation
 */
export function requiresConfirmation(command: CommandExperienceEntryV1): boolean {
  return command.danger === 'confirm' || command.danger === 'destructive';
}

/**
 * Check if a command is destructive
 */
export function isCommandDestructive(command: CommandExperienceEntryV1): boolean {
  return command.danger === 'destructive';
}
