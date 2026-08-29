/**
 * TUI console assist over the shared directory/reducer.
 *
 * Canonical prefix is `/`. The `:` prefix is a legacy alias and always
 * carries a migration hint. Discovery stays local: no RPC.
 */

import type {
  AssistResolution,
  CommandExperienceEntryV1,
  CommandReducerAction,
  CommandReducerState,
  SessionSubcommand,
} from '@yeisme/dsh-client-ui-command-experience-core';
import {
  isCommandExecutable,
  parseSessionSubcommand,
  resolveAssistQuery,
} from '@yeisme/dsh-client-ui-command-experience-core';

export const COLON_MIGRATION_HINT =
  'The : prefix is a legacy alias; use / instead';

export type TuiAssistPrefix = '/' | ':';
export type TuiSelectorKind = 'thread' | 'session';

export interface TuiAssistResolution extends AssistResolution {
  readonly prefix: TuiAssistPrefix;
  readonly migrationHint: string | null;
  readonly selector: TuiSelectorKind | null;
  readonly disabled: boolean;
  readonly disabledReason: string | null;
}

export interface TuiAssistController {
  getState(): CommandReducerState;
  dispatch(action: CommandReducerAction): CommandReducerState;
}

const COLON_PREFIX = /^\s*:/;

export function isColonAssistInput(input: string): boolean {
  return COLON_PREFIX.test(input);
}

export function normalizeTuiAssistInput(input: string): {
  readonly query: string;
  readonly prefix: TuiAssistPrefix;
  readonly migrationHint: string | null;
} {
  if (isColonAssistInput(input)) {
    return {
      query: `/${input.replace(COLON_PREFIX, '')}`,
      prefix: ':',
      migrationHint: COLON_MIGRATION_HINT,
    };
  }

  return {
    query: input,
    prefix: '/',
    migrationHint: null,
  };
}

export function selectorKindFor(
  command: CommandExperienceEntryV1 | null,
): TuiSelectorKind | null {
  if (command === null) {
    return null;
  }
  if (command.input.selectorKey === 'threadRef') {
    return 'thread';
  }
  if (command.input.selectorKey === 'sessionId') {
    return 'session';
  }
  return null;
}

export function getCommandDisabledReason(
  command: CommandExperienceEntryV1,
): string | null {
  if (isCommandExecutable(command)) {
    return null;
  }
  return command.availability.reason ?? 'Command is disabled';
}

/**
 * Resolve `/` and `:` assist, plus exact `/agent` and `/resume`, against
 * the shared TUI catalog. Disabled owner actions stay visible with a reason.
 */
export function resolveTuiAssistQuery(
  commands: readonly CommandExperienceEntryV1[],
  input: string,
): TuiAssistResolution {
  const normalized = normalizeTuiAssistInput(input);
  const resolution = resolveAssistQuery(commands, normalized.query, { surface: 'tui' });
  const selected = resolution.selected;
  const disabled = selected !== null && !isCommandExecutable(selected);
  const disabledReason = selected === null ? null : getCommandDisabledReason(selected);

  return {
    ...resolution,
    query: normalized.query,
    prefix: normalized.prefix,
    migrationHint: normalized.migrationHint,
    selector: selectorKindFor(selected),
    disabled,
    disabledReason,
  };
}

/**
 * Split `/session <subcommand> [args]` (and the `:` alias) into the hub
 * assist input and the parsed subcommand. Argument text keeps its case.
 * Returns null for other commands so callers keep their existing
 * discovery path untouched.
 */
export function splitSessionHubInput(input: string): {
  readonly assistInput: string;
  readonly subcommand: SessionSubcommand;
} | null {
  const stripped = input.trim().replace(/^[/:]\s*/, '');
  const [rawHead, ...rest] = stripped.split(/\s+/);
  const head = rawHead?.toLowerCase();
  if (head !== 'session' && head !== 'sessions') {
    return null;
  }
  return {
    assistInput: `/${head}`,
    subcommand: parseSessionSubcommand(rest.join(' ')),
  };
}

export function applyTuiAssist(
  controller: TuiAssistController,
  commands: readonly CommandExperienceEntryV1[],
  input: string,
): { readonly state: CommandReducerState; readonly resolution: TuiAssistResolution } {
  const resolution = resolveTuiAssistQuery(commands, input);
  let state = controller.dispatch({
    type: 'START_ASSIST',
    query: resolution.query,
    draft: input,
  });

  if (resolution.selected === null || resolution.disabled) {
    return { state, resolution };
  }

  state = controller.dispatch({
    type: 'SELECT_COMMAND',
    command: resolution.selected,
  });

  if (resolution.selector !== null) {
    state = controller.dispatch({ type: 'OPEN_SELECTOR' });
  }

  return { state, resolution };
}
