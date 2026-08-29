/**
 * Local slash-command discovery.
 *
 * First `/` discovery is a pure directory projection. It must never
 * issue RPC or mutate owner state.
 */

import type { CommandExperienceEntryV1, CommandSurface } from './types';
import {
  filterCommands,
  findExactMatch,
  findPrefixMatches,
  findUniquePrefixMatch,
  groupByCategory,
  isCommandExecutable,
  sortCommands,
} from './directory';

export interface AssistResolution {
  readonly query: string;
  readonly token: string;
  readonly exact: CommandExperienceEntryV1 | null;
  readonly uniquePrefix: CommandExperienceEntryV1 | null;
  readonly selected: CommandExperienceEntryV1 | null;
  readonly candidates: readonly CommandExperienceEntryV1[];
  readonly categories: readonly string[];
  readonly disabledReasons: Readonly<Record<string, string>>;
  readonly rpcIssued: false;
}

const SLASH_PREFIX = /^\s*\/+/;

export function parseSlashToken(input: string): string {
  return input.replace(SLASH_PREFIX, '').trim().toLowerCase();
}

export function isSlashAssistInput(input: string): boolean {
  return /^\s*\//.test(input);
}

/**
 * Resolve `/`, exact command, and unique safe prefix against a local directory.
 * Unique prefix is safe only when it identifies exactly one executable command.
 */
export function resolveAssistQuery(
  commands: readonly CommandExperienceEntryV1[],
  input: string,
  options: { readonly surface?: CommandSurface } = {},
): AssistResolution {
  const token = parseSlashToken(input);
  const surface = options.surface ?? 'web';
  const surfaceCommands = sortCommands(
    filterCommands(commands, { surface, includeHidden: false }),
    'category',
  );

  const candidates = token.length === 0
    ? surfaceCommands
    : findPrefixMatches(surfaceCommands, token).length > 0
      ? sortCommands(findPrefixMatches(surfaceCommands, token), 'category')
      : sortCommands(filterCommands(surfaceCommands, { query: token }), 'category');

  const exact = token.length === 0 ? null : findExactMatch(surfaceCommands, token);
  const uniquePrefix = exact === null && token.length > 0
    ? findSafeUniquePrefix(surfaceCommands, token)
    : null;
  const selected = exact ?? uniquePrefix;

  const disabledReasons: Record<string, string> = {};
  for (const command of candidates) {
    if (!isCommandExecutable(command)) {
      disabledReasons[command.canonicalName] =
        command.availability.reason ?? 'Command is disabled';
    }
  }

  return {
    query: input,
    token,
    exact,
    uniquePrefix,
    selected,
    candidates,
    categories: Array.from(groupByCategory(candidates).keys()).sort(),
    disabledReasons,
    rpcIssued: false,
  };
}

/**
 * Unique prefix is safe only when it identifies exactly one executable
 * command. Exported so the shared keymap can complete Tab without issuing
 * RPC or mutating owner state.
 */
export function findSafeUniquePrefix(
  commands: readonly CommandExperienceEntryV1[],
  prefix: string,
): CommandExperienceEntryV1 | null {
  const executable = commands.filter(isCommandExecutable);
  const unique = findUniquePrefixMatch(executable, prefix);
  if (unique !== null) {
    return unique;
  }

  const prefixMatches = executable.filter((command) =>
    command.canonicalName.startsWith(prefix) ||
    command.aliases.some((alias) => alias.startsWith(prefix)),
  );
  return prefixMatches.length === 1 ? prefixMatches[0] ?? null : null;
}
