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
  findSafeUniquePrefix,
} from './discovery';

// Shared keymap
export {
  type CommandKeyEvent,
  type CommandKeymapConfig,
  type CommandKeyResolution,
  type CommandKeyContext,
  DEFAULT_COMMAND_KEYMAP,
  resolveKeymap,
  formatKeyEvent,
  resolveKeyAction,
} from './keymap';

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
  type SessionHubAction,
  type SessionHubActionItem,
  type SessionSubcommand,
  filterSessionProjection,
  selectSessionRef,
  planSessionCommand,
  applySessionReceipt,
  distinguishNewAndFork,
  parseSessionSubcommand,
  buildSessionHubActions,
  planSessionItemAction,
} from './session-commands';

export {
  type OwnerCapabilitySnapshot,
  type CoverageLedgerRow,
  buildP0Catalog,
  inspectCommandsMutateState,
  OFFICIAL_OWNED_INSPECT_NAMES,
  sharedActionIdentity,
  auditCoverageLedger,
} from './p0-catalog';

export {
  type LiveDirectoryConflict,
  type LiveDirectorySnapshot,
  type LiveSlashDirectory,
  P0_DIRECTORY_SOURCE,
  PANE_DIRECTORY_SOURCE,
  HOST_DIRECTORY_SOURCE,
  P0_SOURCE_PRIORITY,
  PANE_SOURCE_PRIORITY,
  HOST_SOURCE_PRIORITY,
  reservedSlashNames,
  isReservedSlashName,
  isSafeSlashName,
  mergeLiveDirectory,
  createLiveSlashDirectory,
} from './live-directory';

export {
  type PaneSlashViewSnapshot,
  type PaneSlashBindingSnapshot,
  type PaneSlashCommandSnapshot,
  PANE_HUB_NAME,
  paneCommandSlashName,
  pickerVisiblePaneViews,
  projectPaneHub,
  projectPaneLauncherCommands,
  projectPaneSlashSource,
} from './pane-projection';

export {
  type InspectSurfaceSnapshot,
  type InspectPlan,
  type HostCommandProjection,
  MCP_INSPECTOR_VIEW_ID,
  AGENT_CONTEXT_VIEW_KIND,
  EXPLORER_VIEW_KIND,
  SOURCE_CONTROL_VIEW_KIND,
  DEFAULT_INSPECT_SURFACES,
  splitSlashRest,
  matchPaneKind,
  planInspectCommand,
  projectHostCommands,
} from './inspect-resolve';

export {
  type SlashPaneViewRecord,
  type SlashPaneWorkbench,
  type PaneCommandLike,
  type SlashOpenViewRequest,
  type SlashHostCommands,
  type SlashConversationViews,
  type SlashPluginRecord,
  type SlashRuntimeHost,
  type SlashInspectResult,
  type SlashRuntime,
  type SlashHostRegistration,
  createSlashRuntime,
  inspectRegistrationsFrom,
  syncInspectRegistrations,
} from './slash-runtime';

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
