/**
 * DSH Command Experience Host Adapter Types
 *
 * Types for DSH owner action/receipt projection and capability probing.
 */

/**
 * Opaque reference to a DSH thread (agent or subagent)
 * Provided by DSH owner, treated as opaque by plugin
 */
export type ThreadRef = string;

/**
 * Opaque reference to a DSH session
 * Provided by DSH owner, treated as opaque by plugin
 */
export type SessionRef = string;

/**
 * Opaque reference to a DSH preset
 */
export type PresetRef = string;

/**
 * Safe projection of a DSH thread
 */
export interface ThreadProjection {
  /** Opaque reference for this thread */
  ref: ThreadRef;

  /** Display name */
  displayName: string;

  /** Thread status */
  status: 'active' | 'idle' | 'error' | 'unknown';

  /** Parent thread ref if this is a subagent */
  parentRef: ThreadRef | null;

  /** Child threads if this is a parent */
  children: readonly ThreadProjection[];

  /** Last activity timestamp */
  lastActivity: number;

  /** Whether this is the currently active thread */
  active: boolean;
}

/**
 * Safe projection of a DSH session
 */
export interface SessionProjection {
  /** Opaque reference for this session */
  ref: SessionRef;

  /** Session title (redacted if sensitive) */
  title: string;

  /** Last update timestamp */
  lastUpdate: number;

  /** Project/workspace identifier if safely available */
  project: string | null;

  /** Session status */
  status: 'active' | 'archived' | 'error' | 'unknown';

  /** Whether this is the current session */
  active: boolean;
}

/**
 * Owner action descriptor
 */
export interface OwnerImpactPreview {
  /** Opaque target supplied by the owner */
  targetRef: ThreadRef | SessionRef;

  /** Owner-authored impact summary */
  impactSummary: string;

  /** Whether the owner says the action is reversible */
  reversible: boolean;

  /** Preview capability id */
  capability: string;

  /** Owner-declared descendant count. Plugin must not compute this. */
  descendantCount?: number;
}

export interface OwnerActionDescriptor {
  /** Action type */
  type: 'open-thread' | 'open-session' | 'new-chat' | 'fork-chat' | 'rename-session' | 'compact-context' | 'delete-session' | 'archive-session' | 'apply-preset' | 'set-model' | 'set-reasoning' | 'set-permissions';

  /** Opaque reference for the action target */
  targetRef: ThreadRef | SessionRef | null;

  /** Action parameters */
  parameters: Record<string, unknown>;

  /** Expected danger level */
  danger: 'safe' | 'confirm' | 'destructive';

  /** Owner preview required for confirm/destructive actions */
  preview?: OwnerImpactPreview | null;
}

/**
 * Owner action request
 */
export interface OwnerActionRequest {
  /** Action descriptor */
  action: OwnerActionDescriptor;

  /** Correlation ID for receipt matching */
  correlationId: string;
}

/**
 * Owner action receipt
 */
export interface OwnerActionReceipt {
  /** Correlation ID matching the request */
  correlationId: string;

  /** Receipt status */
  status: 'success' | 'rejected' | 'failed' | 'stale';

  /** Human-readable message */
  message?: string;

  /** Timestamp */
  timestamp: number;

  /** Result data (success case) */
  result?: {
    /** New active thread ref (for thread actions) */
    activeThread?: ThreadRef;

    /** New active session ref (for session actions) */
    activeSession?: SessionRef;

    /** Updated session title (for rename) */
    newTitle?: string;

    /** Confirmation of deletion (for delete) */
    deletedRef?: SessionRef;
  };
}

/**
 * Capability probe result
 */
export interface CapabilityProbeResult {
  /** Whether the bundle can activate */
  canActivate: boolean;

  /** DSH version detected */
  dshVersion: string | null;

  /** Available capabilities */
  capabilities: {
    /** Command directory available */
    commandDirectory: boolean;

    /** Thread projection available */
    threadProjection: boolean;

    /** Session projection available */
    sessionProjection: boolean;

    /** Owner actions available */
    ownerActions: boolean;

    /** Action receipts available */
    actionReceipts: boolean;
  };

  /** Missing required capabilities (if any) */
  missingCapabilities: string[];

  /** Optional unavailable commands with reasons */
  unavailableCommands: Array<{
    command: string;
    reason: string;
  }>;

  /** Fatal errors preventing activation */
  errors: string[];
}

/**
 * Compatibility alias mapping
 */
export interface CompatibilityMapping {
  /** Legacy command name */
  legacy: string;

  /** Canonical replacement command */
  canonical: string;

  /** Whether this is deprecated */
  deprecated: boolean;

  /** Removal version (if set) */
  removeAfter?: string;
}
