/**
 * DSH Web Command Experience
 *
 * Unified command menu and interactions through official contribution seams.
 * Zero RPC on discovery, no DOM patching, full accessibility support.
 */

// Public exports
export type {
  CommandMenuProps,
  CommandMenuOptions,
  CommandSelectorProps,
  CommandSelectorOptions,
  ConfirmationDialogProps,
  PendingReceiptProps,
} from './types';

// Components
export {
  CommandMenu,
  CommandSelector,
  ConfirmationDialog,
  PendingReceipt,
} from './components';

// Hooks
export {
  useCommandDirectory,
  useCommandState,
  useCommandNavigation,
  useCommandExecutor,
  useCommandSelector,
} from './hooks';

// Utilities
export {
  getCommandAccessibilityLabel,
  getCommandCategoryLabel,
  getCommandDisabledReason,
  isCommandUnavailable,
} from './utils';
