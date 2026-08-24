/**
 * Command Experience Web Types
 *
 * Type definitions for React components and hooks that integrate
 * with the shared command directory and reducer.
 */

import type { CommandReducerState, ReceiptStatus, CommandReducerAction } from '@yeisme/dsh-client-ui-command-experience-core';

/**
 * Command menu component props
 */
export interface CommandMenuProps {
  /** Current command state from reducer */
  state: CommandReducerState;
  /** Dispatch function for reducer actions */
  dispatch: (action: CommandReducerAction) => void;
  /** Optional configuration overrides */
  options?: CommandMenuOptions;
  /** Optional className for styling */
  className?: string;
}

/**
 * Command menu configuration options
 */
export interface CommandMenuOptions {
  /** Maximum number of commands to show without virtualization */
  maxCommandsWithoutVirtualization?: number;
  /** Whether to show categories */
  showCategories?: boolean;
  /** Whether to show disabled commands with reasons */
  showDisabledCommands?: boolean;
  /** Custom keyboard shortcuts */
  keyboardShortcuts?: CommandKeyboardShortcuts;
}

/**
 * Keyboard shortcut configuration
 */
export interface CommandKeyboardShortcuts {
  /** Toggle command menu (default: Ctrl+K / Cmd+K) */
  toggle?: string[];
  /** Navigate up */
  navigateUp?: string[];
  /** Navigate down */
  navigateDown?: string[];
  /** Execute selected command */
  execute?: string[];
  /** Cancel/close */
  cancel?: string[];
}

/**
 * Command selector component props
 */
export interface CommandSelectorProps {
  /** Current command state */
  state: CommandReducerState;
  /** Dispatch function */
  dispatch: (action: CommandReducerAction) => void;
  /** Selector type (session/thread/workspace/etc.) */
  selectorType: 'session' | 'thread' | 'workspace' | 'argument';
  /** Optional configuration */
  options?: CommandSelectorOptions;
}

/**
 * Command selector options
 */
export interface CommandSelectorOptions {
  /** Maximum items to show */
  maxItems?: number;
  /** Whether to show disabled items */
  showDisabled?: boolean;
  /** Custom placeholder text */
  placeholder?: string;
}

/**
 * Confirmation dialog props
 */
export interface ConfirmationDialogProps {
  /** Current command state */
  state: CommandReducerState;
  /** Dispatch function */
  dispatch: (action: CommandReducerAction) => void;
  /** Optional custom message */
  customMessage?: string;
}

/**
 * Pending receipt display props
 */
export interface PendingReceiptProps {
  /** Current command state */
  state: CommandReducerState;
  /** Receipt status */
  receiptStatus: ReceiptStatus;
  /** Dispatch function */
  dispatch: (action: CommandReducerAction) => void;
}
