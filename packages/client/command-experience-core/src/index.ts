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

export {
  type AssistResolution,
  parseSlashToken,
  isSlashAssistInput,
  resolveAssistQuery,
} from './discovery';

export {
  type ProjectableItem,
  type BoundedProjection,
  type ProjectionOptions,
  commandStableKey,
  selectorStableKey,
  projectBoundedWindow,
  retainSelectionAnchor,
} from './projection';

export {
  type OwnerImpactPreview,
  type DangerGate,
  canonicalCommandName,
  gradeCommandDanger,
  requiresOwnerPreview,
  evaluateDangerGate,
  refusePluginRecursiveDelete,
} from './danger';

export {
  TELEMETRY_ALLOWED_FIELDS,
  type TelemetryAllowedField,
  type TelemetryRecord,
  type RedactionResult,
  redactDigest,
  redactTelemetry,
  createUsageRecord,
  collectForbiddenTelemetryKeys,
  assertTelemetryAllowlist,
} from './telemetry';

export {
  type DescriptorSanitizeInput,
  type SanitizedDescriptor,
  stripAnsi,
  escapeDisplayText,
  sanitizeCommandDescriptor,
} from './sanitize';

// Reducer
export {
  type ThreadCandidate,
  type PresetCandidate,
  type AgentTokenResolution,
  flattenThreadProjection,
  selectThreadRef,
  retainStaleThreadSelection,
  resolveAgentToken,
  isBareAgentCommand,
} from './agent-preset';

export {
  type SessionCandidate,
  type SessionCommandId,
  type SessionCommandIntent,
  filterSessionProjection,
  selectSessionRef,
  planSessionCommand,
  applySessionReceipt,
  distinguishNewAndFork,
} from './session-commands';

export {
  type OwnerCapabilitySnapshot,
  type CoverageLedgerRow,
  buildP0Catalog,
  inspectCommandsMutateState,
  sharedActionIdentity,
  auditCoverageLedger,
} from './p0-catalog';

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
