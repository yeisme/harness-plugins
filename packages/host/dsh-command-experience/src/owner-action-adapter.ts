/**
 * DSH Owner Action Adapter
 *
 * Interface for interacting with DSH owner actions and receipts.
 * Provides type-safe wrappers for opaque refs and correlation.
 */

import type {
  ThreadRef,
  SessionRef,
  PresetRef,
  ThreadProjection,
  SessionProjection,
  OwnerActionRequest,
  OwnerActionReceipt,
  OwnerActionDescriptor,
  OwnerImpactPreview,
} from './types';

/**
 * Owner action adapter interface
 *
 * This interface must be implemented by the actual DSH runtime integration.
 * The plugin uses this interface to interact with DSH owner actions.
 */
export interface OwnerActionAdapter {
  /**
   * Get thread projection for agent/subagent picker
   * Returns safe projection of current main agent and recursive subagents
   */
  getThreadProjection(): Promise<ThreadProjection[]>;

  /**
   * Get session projection for resume picker
   * Returns safe projection of saved sessions
   */
  getSessionProjection(): Promise<SessionProjection[]>;

  /**
   * Submit owner action request
   * Returns correlation ID for receipt matching
   */
  submitAction(request: OwnerActionRequest): Promise<string>;

  /**
   * Subscribe to owner action receipts
   * Called when receipts arrive from DSH runtime
   */
  subscribeToReceipts(handler: (receipt: OwnerActionReceipt) => void): () => void;

  /**
   * Check if a specific action capability is available
   */
  hasCapability(action: OwnerActionDescriptor['type']): boolean;

  /**
   * Fetch owner-authored impact preview. Missing preview keeps
   * archive/delete staged. The plugin must not invent descendants.
   */
  getActionPreview?(action: OwnerActionDescriptor): Promise<OwnerImpactPreview | null>;
}

/**
 * Create thread open action request
 */
export function createThreadOpenRequest(
  threadRef: ThreadRef,
  correlationId: string
): OwnerActionRequest {
  return {
    action: {
      type: 'open-thread',
      targetRef: threadRef,
      parameters: {},
      danger: 'safe',
    },
    correlationId,
  };
}

/**
 * Create session resume action request
 */
export function createSessionResumeRequest(
  sessionRef: SessionRef,
  correlationId: string
): OwnerActionRequest {
  return {
    action: {
      type: 'open-session',
      targetRef: sessionRef,
      parameters: {},
      danger: 'safe',
    },
    correlationId,
  };
}

/**
 * Create new chat action request
 */
export function createNewChatRequest(
  correlationId: string
): OwnerActionRequest {
  return {
    action: {
      type: 'new-chat',
      targetRef: null,
      parameters: {},
      danger: 'safe',
    },
    correlationId,
  };
}

/**
 * Create fork chat action request
 */
export function createForkChatRequest(
  correlationId: string
): OwnerActionRequest {
  return {
    action: {
      type: 'fork-chat',
      targetRef: null,
      parameters: {},
      danger: 'safe',
    },
    correlationId,
  };
}

/**
 * Create rename session action request
 */
export function createRenameRequest(
  sessionRef: SessionRef,
  newTitle: string,
  correlationId: string
): OwnerActionRequest {
  return {
    action: {
      type: 'rename-session',
      targetRef: sessionRef,
      parameters: { newTitle },
      danger: 'safe',
    },
    correlationId,
  };
}

/**
 * Create compact context action request
 */
export function createApplyPresetRequest(
  presetRef: PresetRef,
  correlationId: string,
): OwnerActionRequest {
  return {
    action: {
      type: 'apply-preset',
      targetRef: presetRef,
      parameters: {},
      danger: 'safe',
    },
    correlationId,
  }
}

export function createCompactRequest(
  correlationId: string
): OwnerActionRequest {
  return {
    action: {
      type: 'compact-context',
      targetRef: null,
      parameters: {},
      danger: 'safe',
    },
    correlationId,
  };
}

/**
 * Create archive session action request. Preview is required before submit.
 */
export function createArchiveRequest(
  sessionRef: SessionRef,
  correlationId: string,
  preview: OwnerImpactPreview | null = null,
): OwnerActionRequest {
  return {
    action: {
      type: 'archive-session',
      targetRef: sessionRef,
      parameters: {},
      danger: 'confirm',
      preview,
    },
    correlationId,
  };
}

/**
 * Create delete session action request. Preview is required before submit.
 * The plugin must not attach descendant lists or filesystem paths.
 */
export function createDeleteRequest(
  sessionRef: SessionRef,
  correlationId: string,
  preview: OwnerImpactPreview | null = null,
): OwnerActionRequest {
  return {
    action: {
      type: 'delete-session',
      targetRef: sessionRef,
      parameters: {},
      danger: 'destructive',
      preview,
    },
    correlationId,
  };
}

export interface DestructiveSubmitDecision {
  readonly allowed: boolean;
  readonly staged: boolean;
  readonly reason: string | null;
  readonly request: OwnerActionRequest | null;
}

/**
 * Stage archive/delete unless the owner preview and receipt path exist.
 * Rejects recursive/descendant payloads so the plugin cannot delete trees.
 */
export function prepareDestructiveSubmit(input: {
  readonly command: 'archive' | 'delete';
  readonly sessionRef: SessionRef;
  readonly correlationId: string;
  readonly preview: OwnerImpactPreview | null;
  readonly receiptCapable: boolean;
  readonly descendants?: readonly unknown[];
  readonly paths?: readonly string[];
  readonly recursive?: boolean;
}): DestructiveSubmitDecision {
  if (input.recursive === true || (input.descendants?.length ?? 0) > 0 || (input.paths?.length ?? 0) > 0) {
    return {
      allowed: false,
      staged: true,
      reason: 'Plugin must not recursively delete',
      request: null,
    };
  }

  if (!input.receiptCapable) {
    return {
      allowed: false,
      staged: true,
      reason: `/${input.command} stays staged until owner receipt is available`,
      request: null,
    };
  }

  if (input.preview === null || input.preview.targetRef !== input.sessionRef) {
    return {
      allowed: false,
      staged: true,
      reason: `/${input.command} stays staged until owner preview is available`,
      request: null,
    };
  }

  const request = input.command === 'archive'
    ? createArchiveRequest(input.sessionRef, input.correlationId, input.preview)
    : createDeleteRequest(input.sessionRef, input.correlationId, input.preview);

  return {
    allowed: true,
    staged: false,
    reason: null,
    request,
  };
}

/**
 * Validate receipt structure
 */
export function isValidReceipt(receipt: unknown): receipt is OwnerActionReceipt {
  if (typeof receipt !== 'object' || receipt === null) {
    return false;
  }

  const r = receipt as Partial<OwnerActionReceipt>;

  return (
    typeof r.correlationId === 'string' &&
    typeof r.status === 'string' &&
    ['success', 'rejected', 'failed', 'stale'].includes(r.status) &&
    typeof r.timestamp === 'number'
  );
}

/**
 * Check if two receipts are equivalent (idempotent)
 */
export function areReceiptsEquivalent(
  a: OwnerActionReceipt,
  b: OwnerActionReceipt
): boolean {
  return (
    a.correlationId === b.correlationId &&
    a.status === b.status &&
    a.timestamp === b.timestamp
  );
}

/**
 * Create a mock/stub owner action adapter for testing
 */
export function createMockAdapter(
  options: {
    threads?: ThreadProjection[];
    sessions?: SessionProjection[];
    capabilities?: Set<OwnerActionDescriptor['type']>;
    previews?: Map<string, OwnerImpactPreview>;
  } = {}
): OwnerActionAdapter {
  const {
    threads = [],
    sessions = [],
    capabilities = new Set([
      'open-thread',
      'open-session',
      'new-chat',
      'fork-chat',
      'rename-session',
      'compact-context',
    ]),
    previews = new Map<string, OwnerImpactPreview>(),
  } = options;

  const receiptHandlers = new Set<(receipt: OwnerActionReceipt) => void>();

  return {
    async getThreadProjection() {
      return threads;
    },

    async getSessionProjection() {
      return sessions;
    },

    async submitAction(request: OwnerActionRequest) {
      // Mock: immediately return a success receipt
      const receipt: OwnerActionReceipt = {
        correlationId: request.correlationId,
        status: 'success',
        timestamp: Date.now(),
        result: {},
      };

      // Notify handlers
      for (const handler of receiptHandlers) {
        handler(receipt);
      }

      return request.correlationId;
    },

    subscribeToReceipts(handler) {
      receiptHandlers.add(handler);
      return () => {
        receiptHandlers.delete(handler);
      };
    },

    hasCapability(action) {
      return capabilities.has(action);
    },

    async getActionPreview(action) {
      if (action.targetRef === null) {
        return null;
      }
      return previews.get(`${action.type}:${action.targetRef}`) ?? null;
    },
  };
}
