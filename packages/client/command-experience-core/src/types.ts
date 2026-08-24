/**
 * Command Experience Core Types
 *
 * Shared pure types for unified command directory and interaction state machine.
 * These types are consumed by both Web and TUI adapters.
 */

/**
 * Command execution classification
 */
export type CommandActionKind =
  | 'local'        // Client-local command (e.g., help, copy)
  | 'inspect'      // Read-only inspection (e.g., status, plugins)
  | 'navigation'   // UI navigation (e.g., commands, settings)
  | 'owner-action' // Requires DSH owner action with receipt (e.g., resume, agent)

/**
 * Coverage status relative to Codex reference
 */
export type CommandCoverage =
  | 'equivalent'   // Full feature parity with Codex command
  | 'adapted'      // Functionally equivalent with DSH-specific adaptation
  | 'staged'       // Implemented but awaiting upstream seam or production gate
  | 'conditional'  // Only applicable under specific DSH conditions
  | 'not-applicable' // Does not apply to DSH (with documented reason)

/**
 * Command availability state
 */
export type AvailabilityState = 'available' | 'disabled' | 'hidden'

/**
 * Command danger level
 */
export type CommandDanger = 'safe' | 'confirm' | 'destructive'

/**
 * Supported surfaces
 */
export type CommandSurface = 'web' | 'tui'

/**
 * Command ownership
 */
export type CommandOwner = 'client' | 'dsh' | 'host'

/**
 * Unified command experience entry (V1)
 */
export interface CommandExperienceEntryV1 {
  /** Canonical command name (e.g., "resume", "agent") */
  canonicalName: string;

  /** Alternative names (legacy or platform-specific) */
  aliases: readonly string[];

  /** User-facing description */
  description: string;

  /** Logical category for grouping */
  category: string;

  /** Input specification */
  input: {
    /** Placeholder hint for argument input */
    hint?: string;
    /** JSON schema key for structured arguments */
    schemaKey?: string;
    /** Selector key for picker commands (e.g., threadRef, sessionId) */
    selectorKey?: string;
  };

  /** Surfaces where this command is available */
  surfaces: readonly CommandSurface[];

  /** Execution classification */
  actionKind: CommandActionKind;

  /** Owner of command execution and state */
  owner: CommandOwner;

  /** Danger level affecting confirmation flow */
  danger: CommandDanger;

  /** Current availability state */
  availability: {
    state: AvailabilityState;
    /** Reason if disabled or hidden */
    reason?: string;
  };

  /** Coverage relative to Codex reference */
  coverage: CommandCoverage;

  /** Coverage-specific metadata */
  coverageMetadata?: {
    /** Codex reference semantic */
    codexReference?: string;
    /** DSH equivalent owner/action */
    dshOwner?: string;
    /** Current seam capability */
    currentSeam?: string;
    /** Implementation differences */
    differences?: string[];
    /** Migration or advancement conditions */
    advancementConditions?: string[];
    /** Verification command */
    verifyCommand?: string;
    /** Last probed DSH version */
    lastProbeVersion?: string;
  };

  /** Deprecation notice if applicable */
  deprecation?: {
    /** Replacement command */
    replacement: string;
    /** Planned removal version (if set) */
    removeAfter?: string;
  };
}

/**
 * Reducer state machine states
 */
export type CommandState =
  | 'idle'           // No command input in progress
  | 'assist'         // Command palette open with query
  | 'selected'       // Command selected, waiting for arguments/selector
  | 'argument'       // Collecting structured arguments
  | 'selector'       // Picker open (sessions, threads, etc.)
  | 'confirmation'   // Awaiting user confirmation
  | 'dispatching'    // Command sent, awaiting receipt
  | 'receipt'        // Receipt received (success/rejected/failed/stale)
  | 'error'          // Recoverable error state

/**
 * Receipt status from owner action
 */
export type ReceiptStatus = 'success' | 'rejected' | 'failed' | 'stale'

/**
 * Reducer state
 */
export interface CommandReducerState {
  /** Current state in the machine */
  state: CommandState;

  /** Current command query (for assist) */
  query: string;

  /** Selected command (if any) */
  selectedCommand: CommandExperienceEntryV1 | null;

  /** Collected arguments */
  arguments: Record<string, unknown>;

  /** Selected picker item (opaque ref from owner) */
  selectedRef: string | null;

  /** Dispatch correlation ID */
  correlationId: string | null;

  /** Receipt information */
  receipt: {
    status: ReceiptStatus | null;
    correlationId: string | null;
    message: string | null;
    timestamp: number | null;
  };

  /** Draft content to preserve during command flow */
  draft: string;

  /** Selection anchor in composer */
  selectionStart: number | null;
  selectionEnd: number | null;

  /** Error message (if any) */
  error: string | null;
}

/**
 * Reducer action types
 */
export type CommandReducerAction =
  | { type: 'START_ASSIST'; query: string; draft: string }
  | { type: 'UPDATE_QUERY'; query: string }
  | { type: 'SELECT_COMMAND'; command: CommandExperienceEntryV1 }
  | { type: 'SET_ARGUMENTS'; args: Record<string, unknown> }
  | { type: 'SET_SELECTED_REF'; ref: string | null }
  | { type: 'OPEN_SELECTOR' }
  | { type: 'REQUEST_CONFIRMATION' }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' }
  | { type: 'DISPATCH'; correlationId: string }
  | { type: 'RECEIPT'; status: ReceiptStatus; correlationId: string; message: string | null }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'RESET' }

/**
 * Directory merge source
 */
export interface CommandDirectorySource {
  /** Source identifier (e.g., 'host', 'dsh', 'local', 'compatibility') */
  source: string;

  /** Commands from this source */
  commands: readonly CommandExperienceEntryV1[];

  /** Priority for conflict resolution (higher wins) */
  priority: number;
}

/**
 * Canonical name conflict detection result
 */
export interface CanonicalConflict {
  /** Conflicting canonical name */
  canonicalName: string;

  /** Conflicting entries */
  entries: Array<{
    command: CommandExperienceEntryV1;
    source: string;
  }>;
}

/**
 * Filter options for command directory
 */
export interface CommandFilterOptions {
  /** Surface to filter for */
  surface?: CommandSurface;

  /** Minimum availability state */
  minAvailability?: AvailabilityState;

  /** Category filter */
  category?: string;

  /** Query string for fuzzy matching */
  query?: string;

  /** Include hidden commands */
  includeHidden?: boolean;
}

/**
 * Sort ordering for commands
 */
export type CommandSortOrder =
  | 'category'        // Group by category, sort by name within
  | 'frequency'       // By usage frequency (not yet implemented)
  | 'recent'          // By recent usage (not yet implemented)
  | 'alphabetical'    // Pure alphabetical by canonical name
