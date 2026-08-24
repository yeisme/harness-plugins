/**
 * DSH Owner Action Adapter
 *
 * Interface for interacting with DSH owner actions and receipts.
 * Provides type-safe wrappers for opaque refs and correlation.
 */

import type {
  ThreadRef,
  SessionRef,
  ThreadProjection,
  SessionProjection,
  OwnerActionRequest,
  OwnerActionReceipt,
  OwnerActionDescriptor,
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
 * Create delete session action request
 */
export function createDeleteRequest(
  sessionRef: SessionRef,
  correlationId: string
): OwnerActionRequest {
  return {
    action: {
      type: 'delete-session',
      targetRef: sessionRef,
      parameters: {},
      danger: 'destructive',
    },
    correlationId,
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
  };
}
