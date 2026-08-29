/**
 * Command Experience Web Types
 *
 * Type definitions for React components and hooks that integrate
 * with the shared command directory and reducer.
 */

import type {
  CommandExperienceEntryV1,
  CommandReducerAction,
  CommandReducerState,
  ReceiptStatus,
} from '@yeisme/dsh-client-ui-command-experience-core';

export interface SelectorItem {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly disabled?: boolean;
  readonly reason?: string;
}

/**
 * Command menu component props
 */
export interface CommandMenuProps {
  /** Current command state from reducer */
  state: CommandReducerState;
  /** Dispatch function for reducer actions */
  dispatch: (action: CommandReducerAction) => void;
  /** Shared command directory consumed by the menu */
  commands?: readonly CommandExperienceEntryV1[];
  /** Optional configuration overrides */
  options?: CommandMenuOptions;
  /** Optional className for styling */
  className?: string;
  /** Restore focus to the composer after cancel */
  onRestoreFocus?: () => void;
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
  /** Jump to the first candidate (default: Home) */
  moveFirst?: string[];
  /** Jump to the last candidate (default: End) */
  moveLast?: string[];
  /** Execute selected command */
  execute?: string[];
  /** Cancel/close */
  cancel?: string[];
  /** Confirm a danger gate (default: Ctrl+Enter / Cmd+Enter; bare Enter never confirms) */
  confirmExecute?: string[];
  /** Close a receipt (default: Escape / Ctrl+D / Cmd+D) */
  closeReceipt?: string[];
  /** Complete the query to the safe unique prefix (default: Tab) */
  tabComplete?: string[];
}

/**
 * Command selector component props
 */
export interface CommandSelectorProps {
  /** Current command state */
  state?: CommandReducerState;
  /** Dispatch function */
  dispatch?: (action: CommandReducerAction) => void;
  /** Selector type (session/thread/workspace/etc.) */
  selectorType: 'session' | 'thread' | 'workspace' | 'argument';
  /** Optional configuration */
  options?: CommandSelectorOptions;
  /** Items to display in selector */
  items?: readonly SelectorItem[];
  /** Bounded window size for long lists */
  windowSize?: number;
  /** Catalog revision used to keep the selection anchor */
  catalogRevision?: number;
  /** Callback when item is selected */
  onSelect?: (item: SelectorItem) => void;
  /** Callback when selector is closed */
  onClose?: () => void;
  /** Initial value to display */
  initialValue?: { id: string; label: string };
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
  /** Custom keyboard shortcuts for the picker list */
  keyboardShortcuts?: CommandKeyboardShortcuts;
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
  /** Owner-authored impact preview. Missing preview keeps delete/archive staged. */
  preview?: {
    readonly targetRef: string;
    readonly impactSummary: string;
    readonly reversible: boolean;
    readonly owner: 'dsh' | 'host';
    readonly capability: string;
  } | null;
  /** Whether the owner can emit a receipt */
  receiptCapable?: boolean;
  /** Custom keyboard shortcuts for confirm/cancel */
  keyboardShortcuts?: CommandKeyboardShortcuts;
}

/**
 * Pending receipt display props
 */
export interface PendingReceiptProps {
  /** Current command state */
  state: CommandReducerState;
  /** Receipt status */
  receiptStatus?: ReceiptStatus | null;
  /** Dispatch function */
  dispatch: (action: CommandReducerAction) => void;
  /** Custom keyboard shortcuts for dismissing the receipt */
  keyboardShortcuts?: CommandKeyboardShortcuts;
}
