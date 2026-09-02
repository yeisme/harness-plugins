/**
 * Presentation scope, context ranking, and command-detail projection.
 *
 * Slash Assist and Palette/Command Center consume the same live directory.
 * Ranking and detail are pure descriptor/capability derivatives: no handler,
 * URL, credential, or owner payload may appear in the projection.
 */

import type {
  CommandActionKind,
  CommandCoverage,
  CommandDanger,
  CommandExperienceEntryV1,
  CommandOwner,
  CommandSurface,
} from './types';
import {
  findExactMatch,
  isCommandExecutable,
  normalizeCommandEntry,
} from './directory';
import { parseSlashToken } from './discovery';

export type CommandPresentationScope = 'slash-assist' | 'palette' | 'command-center';

export type CommandExpectedPresentation =
  | 'inline'
  | 'selector'
  | 'popover'
  | 'pane-preview'
  | 'dialog';

export interface CommandDetailProjectionV1 {
  readonly canonicalName: string;
  readonly aliases: readonly string[];
  readonly description: string;
  readonly category: string;
  readonly inputHint?: string;
  readonly actionKind: CommandActionKind;
  readonly owner: CommandOwner;
  readonly danger: CommandDanger;
  readonly availability: {
    readonly state: 'available' | 'disabled' | 'hidden';
    readonly reason?: string;
  };
  readonly coverage: CommandCoverage;
  readonly expectedPresentation: CommandExpectedPresentation;
}

export interface RankContext {
  readonly query?: string;
  readonly surface?: CommandSurface;
  readonly recentCanonicalNames?: readonly string[];
  readonly activeCategories?: readonly string[];
}

export interface RankedCommand {
  readonly command: CommandExperienceEntryV1;
  readonly score: number;
  readonly exact: boolean;
  readonly recentIndex: number;
}

const CATEGORY_ORDER = ['discovery', 'session', 'model', 'work', 'lifecycle'] as const;

/** P1 candidates that must not appear as executable rows without a live handler. */
export const P1_CANDIDATE_NAMES: readonly string[] = [
  'clear',
  'side',
  'btw',
  'usage',
  'debug-config',
  'theme',
  'statusline',
];

const SLASH_ASSIST_DEFAULT_LIMIT = 8;

export function expectedPresentationFor(
  command: CommandExperienceEntryV1,
): CommandExpectedPresentation {
  if (command.input.selectorKey) {
    return 'selector';
  }
  if (command.danger === 'destructive') {
    return 'dialog';
  }
  if (command.danger === 'confirm') {
    return 'popover';
  }
  if (command.actionKind === 'inspect' || command.actionKind === 'navigation') {
    return 'pane-preview';
  }
  return 'inline';
}

/**
 * Derive command detail from a descriptor. Rejects any attempt to smuggle
 * handler/private data by only copying the allowlisted fields.
 */
export function projectCommandDetail(
  command: CommandExperienceEntryV1,
): CommandDetailProjectionV1 {
  const normalized = normalizeCommandEntry(command);
  const availability: CommandDetailProjectionV1['availability'] = {
    state: normalized.availability.state,
    ...(normalized.availability.reason === undefined
      ? {}
      : { reason: normalized.availability.reason }),
  };
  const detail: CommandDetailProjectionV1 = {
    canonicalName: normalized.canonicalName,
    aliases: normalized.aliases,
    description: normalized.description,
    category: normalized.category,
    ...(normalized.input.hint === undefined ? {} : { inputHint: normalized.input.hint }),
    actionKind: normalized.actionKind,
    owner: normalized.owner,
    danger: normalized.danger,
    availability,
    coverage: normalized.coverage,
    expectedPresentation: expectedPresentationFor(normalized),
  };
  return detail;
}

function categoryRank(category: string): number {
  const index = CATEGORY_ORDER.indexOf(category as (typeof CATEGORY_ORDER)[number]);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

function recentIndexOf(
  canonicalName: string,
  recent: readonly string[] | undefined,
): number {
  if (recent === undefined || recent.length === 0) {
    return -1;
  }
  const capped = recent.slice(0, 5);
  return capped.indexOf(canonicalName);
}

function queryLooksLikeCategory(token: string, category: string): boolean {
  if (token.length === 0) {
    return false;
  }
  if (category.startsWith(token) || token.startsWith(category.slice(0, token.length))) {
    return true;
  }
  if (category === 'session' && (token.startsWith('s') || token.startsWith('r') || token.startsWith('n') || token.startsWith('f'))) {
    return true;
  }
  return false;
}

function scoreCommand(
  command: CommandExperienceEntryV1,
  token: string,
  context: RankContext,
): RankedCommand {
  const exact = token.length > 0 && (
    command.canonicalName === token || command.aliases.includes(token)
  );
  const prefix = token.length > 0 && (
    command.canonicalName.startsWith(token) ||
    command.aliases.some((alias) => alias.startsWith(token))
  );
  const described = token.length > 0 && command.description.toLowerCase().includes(token);
  let score = 0;
  if (exact) score += 1000;
  else if (prefix) score += 800;
  else if (described) score += 100;

  if (isCommandExecutable(command)) {
    score += 200;
  }

  const active = context.activeCategories ?? [];
  if (active.includes(command.category)) {
    score += 150;
  } else if (queryLooksLikeCategory(token, command.category) && isCommandExecutable(command)) {
    score += 120;
  }

  const recentIndex = recentIndexOf(command.canonicalName, context.recentCanonicalNames);
  if (recentIndex >= 0) {
    score += 50 - recentIndex;
  }

  score -= categoryRank(command.category);
  return { command, score, exact, recentIndex };
}

function compareRanked(left: RankedCommand, right: RankedCommand): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }
  if (left.exact !== right.exact) {
    return left.exact ? -1 : 1;
  }
  const category = categoryRank(left.command.category) - categoryRank(right.command.category);
  if (category !== 0) {
    return category;
  }
  return left.command.canonicalName.localeCompare(right.command.canonicalName);
}

/**
 * Rank a live directory for a presentation scope. Disabled rows stay visible.
 * Hidden rows stay out. Tie-break is category then canonical name.
 */
export function rankCommandsForScope(
  commands: readonly CommandExperienceEntryV1[],
  context: RankContext = {},
): RankedCommand[] {
  const surface = context.surface;
  const token = parseSlashToken(context.query ?? '');
  const visible = commands.filter((command) => {
    if (command.availability.state === 'hidden') {
      return false;
    }
    if (surface !== undefined && !command.surfaces.includes(surface)) {
      return false;
    }
    return true;
  });

  return visible
    .map((command) => scoreCommand(command, token, context))
    .sort(compareRanked);
}

export function slashAssistLimitForViewport(height: number): 8 | 6 | 4 | 3 {
  if (height >= 36) return 8;
  if (height >= 24) return 6;
  if (height >= 20) return 4;
  return 3;
}

/**
 * Slash Assist projection: context-ranked, viewport-capped, disabled kept.
 */
export function projectSlashAssistRows(
  commands: readonly CommandExperienceEntryV1[],
  context: RankContext & { readonly limit?: number; readonly viewportHeight?: number } = {},
): RankedCommand[] {
  const ranked = rankCommandsForScope(commands, context);
  const token = parseSlashToken(context.query ?? '');
  const filtered = token.length === 0
    ? ranked
    : ranked.filter((row) =>
      row.command.canonicalName.includes(token) ||
      row.command.aliases.some((alias) => alias.includes(token)) ||
      row.command.description.toLowerCase().includes(token) ||
      row.exact,
    );
  const limit = context.limit
    ?? (context.viewportHeight === undefined
      ? SLASH_ASSIST_DEFAULT_LIMIT
      : slashAssistLimitForViewport(context.viewportHeight));
  return filtered.slice(0, limit);
}

export function projectPaletteGroups(
  commands: readonly CommandExperienceEntryV1[],
  context: RankContext = {},
): ReadonlyMap<string, RankedCommand[]> {
  const ranked = rankCommandsForScope(commands, context);
  const groups = new Map<string, RankedCommand[]>();
  const token = parseSlashToken(context.query ?? '');
  const filtered = token.length === 0
    ? ranked
    : ranked.filter((row) =>
      row.command.canonicalName.includes(token) ||
      row.command.aliases.some((alias) => alias.includes(token)) ||
      row.command.description.toLowerCase().includes(token) ||
      row.exact,
    );
  for (const row of filtered) {
    const category = row.command.category;
    const bucket = groups.get(category);
    if (bucket === undefined) {
      groups.set(category, [row]);
    } else {
      bucket.push(row);
    }
  }
  return groups;
}

/**
 * Resolve an alias or canonical token to the live catalog identity.
 * Missing live handlers never invent a clickable P1 placeholder.
 */
export function resolveCanonicalIdentity(
  commands: readonly CommandExperienceEntryV1[],
  name: string,
): CommandExperienceEntryV1 | null {
  return findExactMatch(commands, name);
}

export function isP1CandidateWithoutHandler(
  name: string,
  commands: readonly CommandExperienceEntryV1[],
): boolean {
  const token = parseSlashToken(name);
  if (!P1_CANDIDATE_NAMES.includes(token)) {
    return false;
  }
  return findExactMatch(commands, token) === null;
}

export function executableResults(
  commands: readonly CommandExperienceEntryV1[],
  context: RankContext = {},
): CommandExperienceEntryV1[] {
  return rankCommandsForScope(commands, context)
    .map((row) => row.command)
    .filter((command) => isCommandExecutable(command) && !isP1CandidateWithoutHandler(command.canonicalName, commands));
}
