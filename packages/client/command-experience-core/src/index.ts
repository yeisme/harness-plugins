/**
 * Command Experience Core
 *
 * Shared types, utilities, and reducer for unified command experience
 * across Web and TUI surfaces.
 */

// Types
export type {
  CommandActionKind,
  CommandCoverage,
  AvailabilityState,
  CommandDanger,
  CommandSurface,
  CommandOwner,
  CommandExperienceEntryV1,
  CommandState,
  ReceiptStatus,
  CommandReducerState,
  CommandReducerAction,
  CommandDirectorySource,
  CanonicalConflict,
  CommandFilterOptions,
  CommandSortOrder,
} from './types';

// Directory utilities
export {
  normalizeCommandEntry,
  mergeCommandSources,
  matchesAvailability,
  matchesSurface,
  matchesCategory,
  matchesQuery,
  filterCommands,
  sortCommands,
  getCategories,
  findExactMatch,
  findUniquePrefixMatch,
  findPrefixMatches,
  getCommandSortKey,
  groupByCategory,
  isCommandExecutable,
  requiresConfirmation,
  isCommandDestructive,
} from './directory';

// Reducer
export {
  createInitialState,
  generateCorrelationId,
  commandReducer,
  canCancel,
  needsConfirmation,
  canDispatch,
  isSuccessfulReceipt,
  isFailedReceipt,
  canRecover,
  getRecoveryState,
  actions,
} from './reducer';

// Re-export types for convenience
export type { CommandReducerState as State } from './types';
