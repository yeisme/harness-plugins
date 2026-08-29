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
  SelectorItem,
} from './types';

// Components
export {
  CommandMenu,
  CommandSelector,
  ConfirmationDialog,
  PendingReceipt,
} from './components';

export { SessionActionMenu } from './session-hub';
export type { SessionActionMenuProps } from './session-hub';

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
  sanitizeCommandDescription,
} from './utils';

export {
  applyCommandExperienceClient,
  createCommandMenuContribution,
  createLocalCommandMenuHost,
  createMenuController,
  inspectCommandMenuHost,
  probeCommandExperienceCapabilities,
  registerCommandMenuContribution,
} from './client';

export { createOwnerActionTransport } from './transport';
