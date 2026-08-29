/**
 * TUI terminal key parsing over the shared keymap.
 *
 * Pure mapping from terminal key sequences to logical key events. This
 * module never reads stdin and never toggles rawMode: the official host
 * feeds key sequences through the console contribution seam. Until that
 * seam ships, tests drive synthetic sequences and the adapter stays
 * fail-closed.
 */

import type {
  CommandExperienceEntryV1,
  CommandKeyEvent,
  CommandKeymapConfig,
  CommandKeyResolution,
  CommandReducerState,
} from '@yeisme/dsh-client-ui-command-experience-core';
import { createInitialState, resolveKeyAction } from '@yeisme/dsh-client-ui-command-experience-core';
import type { TuiAssistController } from './assist';

const SEQUENCE_KEYS: Readonly<Record<string, string>> = {
  '\x1b[A': 'arrowup',
  '\x1b[B': 'arrowdown',
  '\x1b[C': 'arrowright',
  '\x1b[D': 'arrowleft',
  '\x1b[H': 'home',
  '\x1b[F': 'end',
  '\x1bOH': 'home',
  '\x1bOF': 'end',
  '\x1b[1~': 'home',
  '\x1b[4~': 'end',
  '\x1b[5~': 'pageup',
  '\x1b[6~': 'pagedown',
};

const CONTROL_KEYS: Readonly<Record<string, { key: string; ctrl: boolean }>> = {
  '\r': { key: 'enter', ctrl: false },
  '\n': { key: 'enter', ctrl: false },
  '\t': { key: 'tab', ctrl: false },
  '\x1b': { key: 'escape', ctrl: false },
  '\x7f': { key: 'backspace', ctrl: false },
  '\x04': { key: 'd', ctrl: true },
  '\x0b': { key: 'k', ctrl: true },
  '\x0e': { key: 'n', ctrl: true },
  '\x10': { key: 'p', ctrl: true },
};

/** Parse one terminal key sequence into a logical key event. */
export function parseTerminalKey(sequence: string): CommandKeyEvent | null {
  if (sequence.length === 0) {
    return null;
  }

  const named = SEQUENCE_KEYS[sequence];
  if (named !== undefined) {
    return { key: named, ctrl: false, meta: false, alt: false, shift: false };
  }

  const control = CONTROL_KEYS[sequence];
  if (control !== undefined) {
    return {
      key: control.key,
      ctrl: control.ctrl,
      meta: false,
      alt: false,
      shift: false,
    };
  }

  // Alt-prefixed escape sequence (ESC + key).
  if (sequence.length === 2 && sequence[0] === '\x1b') {
    return { key: sequence[1]!.toLowerCase(), ctrl: false, meta: false, alt: true, shift: false };
  }

  if (sequence.length === 1) {
    return { key: sequence.toLowerCase(), ctrl: false, meta: false, alt: false, shift: false };
  }

  return null;
}

export interface TuiConsoleKeyInput {
  readonly controller: TuiAssistController;
  readonly sequence: string;
  /** Surface-filtered executable command directory */
  readonly commands: readonly CommandExperienceEntryV1[];
  /** Stable keys of the visible candidates, in render order */
  readonly candidateKeys?: readonly string[];
  readonly config?: CommandKeymapConfig;
}

/**
 * Apply one terminal key sequence to the console controller through the
 * shared keymap. Reducer actions are dispatched immediately; intents that
 * need host cooperation (toggle, execute-cursor, close-receipt) are
 * returned to the caller. Pure with respect to the controller state:
 * dispatches go through the controller, never the DOM or stdin.
 */
export function applyTuiConsoleKey(input: TuiConsoleKeyInput): CommandKeyResolution {
  const event = parseTerminalKey(input.sequence);
  if (event === null) {
    return { kind: 'unhandled' };
  }

  const state: CommandReducerState = input.controller.getState();
  const resolution = resolveKeyAction({
    event,
    state,
    config: input.config,
    context: {
      candidateKeys: input.candidateKeys ?? [],
      commands: input.commands,
    },
  });

  if (resolution.kind === 'action') {
    input.controller.dispatch(resolution.action);
    return resolution;
  }

  if (resolution.kind === 'toggle' && state.state !== 'idle') {
    // The palette is open: toggle closes it and restores the draft.
    input.controller.dispatch({ type: 'CANCEL' });
    return resolution;
  }

  return resolution;
}

/** Convenience helper for hosts that only need the parsed event. */
export function isToggleFromIdle(
  sequence: string,
  commands: readonly CommandExperienceEntryV1[] = [],
  config?: CommandKeymapConfig,
): boolean {
  const event = parseTerminalKey(sequence);
  if (event === null) {
    return false;
  }
  const idleState = createInitialState();
  return resolveKeyAction({
    event,
    state: idleState,
    config,
    context: { candidateKeys: [], commands },
  }).kind === 'toggle';
}
