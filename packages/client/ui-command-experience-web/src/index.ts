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

export {
  ACTIVITY_VIEW_ID,
  RECEIPT_SUCCESS_COLLAPSE_MS,
  SESSION_STATUS_VIEW_ID,
  SLASH_ASSIST_ROW_CAP,
  TOKEN_USAGE_OPEN_ID,
  TOKEN_USAGE_VIEW_ID,
  applySuggestionChip,
  compactComposerControls,
  dropStaleDirectoryRows,
  firstSupportCommands,
  helpDetailFor,
  openCommandResultView,
  p1AbsentFromExecutable,
  probeFirstCommandMenuFallback,
  projectWebDirectory,
  receiptLaneFromDraft,
  restoreActivityFromEvents,
  restoreComposerDraft,
  sameCanonicalAcrossEntries,
  selectWebCommand,
  startWebDraft,
  turnEndSuggestionChips,
  webResponsiveMode,
  coarsePointerMinPx,
} from './shell';
export type {
  CommandActivityEventV1,
  CommandActivityRowV1,
  ComposerControlSnapshot,
  PaneOpenViewRequest,
  PaneWorkbenchFace,
  ReceiptLaneV1,
  SuggestionChipV1,
  WebDirectoryRevision,
  WebShellEntry,
} from './shell';
export { activityContainsForbidden, commandResultEntersTranscript } from './activity';
export { COMMAND_SHELL_RADIUS, COMMAND_SHELL_SPACING, commandShellTokens, commandTone } from './visual';
export {
  FIRST_SUPPORT_NAMES,
  runFirstSupportJourney,
  runFirstSupportMatrix,
} from './first-support';
export type {
  FirstSupportJourneyResult,
  FirstSupportName,
  FirstSupportOutcome,
} from './first-support';
