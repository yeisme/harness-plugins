/**
 * Shared command keymap.
 *
 * Pure logical-key resolution for mouse-free command interaction. The keymap
 * layer maps a normalized key event plus reducer state to a reducer action
 * or an adapter intent. It never touches the DOM, stdin, or command
 * metadata: shortcut bindings live in adapter configuration, not in
 * catalog entries (see sanitize.ts).
 */

import type {
  CommandExperienceEntryV1,
  CommandReducerAction,
  CommandReducerState,
} from './types';
import { parseSlashToken, findSafeUniquePrefix } from './discovery';

/** Normalized logical key event. `key` is lowercased (e.g. 'arrowdown'). */
export interface CommandKeyEvent {
  readonly key: string;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
}

/** Binding strings use 'ctrl+k' / 'meta+enter' / 'escape' notation. */
export interface CommandKeymapConfig {
  /** Open or close the command palette from idle */
  readonly toggle: readonly string[];
  /** Move the candidate cursor up */
  readonly navigateUp: readonly string[];
  /** Move the candidate cursor down */
  readonly navigateDown: readonly string[];
  /** Jump to the first candidate */
  readonly moveFirst: readonly string[];
  /** Jump to the last candidate */
  readonly moveLast: readonly string[];
  /** Execute the current selection */
  readonly execute: readonly string[];
  /** Cancel and restore the draft */
  readonly cancel: readonly string[];
  /** Confirm a danger gate (bare Enter must NOT confirm) */
  readonly confirmExecute: readonly string[];
  /** Close a receipt and recover */
  readonly closeReceipt: readonly string[];
  /** Complete the query to the safe unique prefix */
  readonly tabComplete: readonly string[];
}

export const DEFAULT_COMMAND_KEYMAP: CommandKeymapConfig = {
  toggle: ['ctrl+k', 'meta+k'],
  navigateUp: ['arrowup', 'ctrl+p'],
  navigateDown: ['arrowdown', 'ctrl+n'],
  moveFirst: ['home'],
  moveLast: ['end'],
  execute: ['enter'],
  cancel: ['escape'],
  confirmExecute: ['ctrl+enter', 'meta+enter'],
  closeReceipt: ['escape', 'ctrl+d', 'meta+d'],
  tabComplete: ['tab'],
};

/**
 * Merge partial overrides onto the defaults. Bare j/k stay opt-in: they
 * would swallow query letters like the 'j' in "project" while assist or a
 * selector is open.
 */
export function resolveKeymap(
  overrides?: Partial<CommandKeymapConfig>,
): CommandKeymapConfig {
  if (overrides === undefined) {
    return DEFAULT_COMMAND_KEYMAP;
  }
  return {
    toggle: overrides.toggle ?? DEFAULT_COMMAND_KEYMAP.toggle,
    navigateUp: overrides.navigateUp ?? DEFAULT_COMMAND_KEYMAP.navigateUp,
    navigateDown: overrides.navigateDown ?? DEFAULT_COMMAND_KEYMAP.navigateDown,
    moveFirst: overrides.moveFirst ?? DEFAULT_COMMAND_KEYMAP.moveFirst,
    moveLast: overrides.moveLast ?? DEFAULT_COMMAND_KEYMAP.moveLast,
    execute: overrides.execute ?? DEFAULT_COMMAND_KEYMAP.execute,
    cancel: overrides.cancel ?? DEFAULT_COMMAND_KEYMAP.cancel,
    confirmExecute: overrides.confirmExecute ?? DEFAULT_COMMAND_KEYMAP.confirmExecute,
    closeReceipt: overrides.closeReceipt ?? DEFAULT_COMMAND_KEYMAP.closeReceipt,
    tabComplete: overrides.tabComplete ?? DEFAULT_COMMAND_KEYMAP.tabComplete,
  };
}

/** Format a key event as a binding string, e.g. 'ctrl+k'. */
export function formatKeyEvent(event: CommandKeyEvent): string {
  const parts: string[] = [];
  if (event.ctrl) parts.push('ctrl');
  if (event.meta) parts.push('meta');
  if (event.alt) parts.push('alt');
  if (event.shift) parts.push('shift');
  parts.push(event.key.toLowerCase());
  return parts.join('+');
}

function matchesBinding(event: CommandKeyEvent, binding: string): boolean {
  return formatKeyEvent(event) === binding.toLowerCase();
}

function matchesAny(event: CommandKeyEvent, bindings: readonly string[]): boolean {
  return bindings.some((binding) => matchesBinding(event, binding));
}

export type CommandKeyResolution =
  | { readonly kind: 'action'; readonly action: CommandReducerAction }
  | { readonly kind: 'toggle' }
  | { readonly kind: 'execute-cursor' }
  | { readonly kind: 'close-receipt' }
  | { readonly kind: 'unhandled' };

export interface CommandKeyContext {
  /** Stable keys of the visible candidates, in render order */
  readonly candidateKeys: readonly string[];
  /** Surface-filtered executable command directory (for Tab completion) */
  readonly commands: readonly CommandExperienceEntryV1[];
}

/**
 * Resolve a key event against the state machine. Pure: no DOM, no RPC.
 *
 * - idle → toggle intent (adapter dispatches START_ASSIST with its draft)
 * - assist/selected/argument/selector → cursor movement, Tab completion
 *   (assist-context query completion only), execute, cancel
 * - confirmation → only explicit confirm bindings confirm; bare Enter is unhandled
 * - receipt → close-receipt intent (adapter recovers via getRecoveryState)
 */
export function resolveKeyAction(input: {
  readonly event: CommandKeyEvent;
  readonly state: CommandReducerState;
  readonly config?: CommandKeymapConfig;
  readonly context: CommandKeyContext;
}): CommandKeyResolution {
  const config = input.config ?? DEFAULT_COMMAND_KEYMAP;
  const event = input.event;
  const state = input.state;

  const moveAction = (delta?: number, index?: number): CommandKeyResolution => ({
    kind: 'action',
    action: {
      type: 'MOVE_SELECTION',
      ...(delta === undefined ? {} : { delta }),
      ...(index === undefined ? {} : { index }),
      candidateKeys: input.context.candidateKeys,
    },
  });

  const navigate = (): CommandKeyResolution | null => {
    if (matchesAny(event, config.navigateUp)) {
      return moveAction(-1);
    }
    if (matchesAny(event, config.navigateDown)) {
      return moveAction(1);
    }
    if (matchesAny(event, config.moveFirst)) {
      return moveAction(undefined, 0);
    }
    if (matchesAny(event, config.moveLast)) {
      return moveAction(undefined, input.context.candidateKeys.length - 1);
    }
    return null;
  };

  // The toggle binding opens the palette from idle and closes it anywhere
  // else. Modal states (confirmation, dispatching) are excluded so the
  // toggle cannot blow through a danger gate or an in-flight dispatch.
  const toggleable = state.state !== 'confirmation' && state.state !== 'dispatching';
  if (toggleable && matchesAny(event, config.toggle)) {
    return { kind: 'toggle' };
  }

  switch (state.state) {
    case 'idle':
      return { kind: 'unhandled' };

    case 'assist':
    case 'selected':
    case 'argument':
    case 'selector': {
      const moved = navigate();
      if (moved !== null) {
        return moved;
      }
      if ((state.state === 'assist' || state.state === 'selected') && matchesAny(event, config.tabComplete)) {
        // Complete what the user typed: SELECT_COMMAND rewrites query to the
        // bare canonical name, so the draft is the completion source.
        const token = parseSlashToken(state.draft || state.query);
        const completion = findSafeUniquePrefix(input.context.commands, token);
        if (completion === null) {
          return { kind: 'unhandled' };
        }
        return {
          kind: 'action',
          action: { type: 'UPDATE_QUERY', query: `/${completion.canonicalName}` },
        };
      }
      if (matchesAny(event, config.execute)) {
        return { kind: 'execute-cursor' };
      }
      if (matchesAny(event, config.cancel)) {
        return { kind: 'action', action: { type: 'CANCEL' } };
      }
      return { kind: 'unhandled' };
    }

    case 'confirmation': {
      if (matchesAny(event, config.confirmExecute)) {
        return { kind: 'action', action: { type: 'CONFIRM' } };
      }
      if (matchesAny(event, config.cancel)) {
        return { kind: 'action', action: { type: 'CANCEL' } };
      }
      return { kind: 'unhandled' };
    }

    case 'receipt': {
      if (matchesAny(event, config.closeReceipt)) {
        return { kind: 'close-receipt' };
      }
      return { kind: 'unhandled' };
    }

    case 'dispatching':
      return { kind: 'unhandled' };

    case 'error': {
      if (matchesAny(event, config.cancel)) {
        return { kind: 'action', action: { type: 'CANCEL' } };
      }
      return { kind: 'unhandled' };
    }

    default:
      return { kind: 'unhandled' };
  }
}
