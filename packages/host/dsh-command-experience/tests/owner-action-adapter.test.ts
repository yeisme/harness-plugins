/**
 * Owner Action Adapter Tests
 */

import { describe, it, expect } from 'vitest';
import {
  createThreadOpenRequest,
  createSessionResumeRequest,
  createNewChatRequest,
  createForkChatRequest,
  createRenameRequest,
  createCompactRequest,
  createDeleteRequest,
  isValidReceipt,
  areReceiptsEquivalent,
  createMockAdapter,
  type OwnerActionAdapter,
} from '../src/owner-action-adapter';
import type { ThreadRef, SessionRef, OwnerActionReceipt } from '../src/types';

describe('owner-action-adapter', () => {
  describe('action request creators', () => {
    const correlationId = 'test-correlation-123';

    it('should create thread open request', () => {
      const threadRef: ThreadRef = 'thread-123';
      const request = createThreadOpenRequest(threadRef, correlationId);

      expect(request.action.type).toBe('open-thread');
      expect(request.action.targetRef).toBe(threadRef);
      expect(request.action.danger).toBe('safe');
      expect(request.correlationId).toBe(correlationId);
    });

    it('should create session resume request', () => {
      const sessionRef: SessionRef = 'session-456';
      const request = createSessionResumeRequest(sessionRef, correlationId);

      expect(request.action.type).toBe('open-session');
      expect(request.action.targetRef).toBe(sessionRef);
      expect(request.action.danger).toBe('safe');
      expect(request.correlationId).toBe(correlationId);
    });

    it('should create new chat request', () => {
      const request = createNewChatRequest(correlationId);

      expect(request.action.type).toBe('new-chat');
      expect(request.action.targetRef).toBeNull();
      expect(request.action.danger).toBe('safe');
      expect(request.correlationId).toBe(correlationId);
    });

    it('should create fork chat request', () => {
      const request = createForkChatRequest(correlationId);

      expect(request.action.type).toBe('fork-chat');
      expect(request.action.targetRef).toBeNull();
      expect(request.action.danger).toBe('safe');
      expect(request.correlationId).toBe(correlationId);
    });

    it('should create rename request', () => {
      const sessionRef: SessionRef = 'session-789';
      const newTitle = 'Updated Session Title';
      const request = createRenameRequest(sessionRef, newTitle, correlationId);

      expect(request.action.type).toBe('rename-session');
      expect(request.action.targetRef).toBe(sessionRef);
      expect(request.action.parameters).toEqual({ newTitle });
      expect(request.action.danger).toBe('safe');
      expect(request.correlationId).toBe(correlationId);
    });

    it('should create compact request', () => {
      const request = createCompactRequest(correlationId);

      expect(request.action.type).toBe('compact-context');
      expect(request.action.targetRef).toBeNull();
      expect(request.action.danger).toBe('safe');
      expect(request.correlationId).toBe(correlationId);
    });

    it('should create delete request with destructive danger', () => {
      const sessionRef: SessionRef = 'session-delete';
      const request = createDeleteRequest(sessionRef, correlationId);

      expect(request.action.type).toBe('delete-session');
      expect(request.action.targetRef).toBe(sessionRef);
      expect(request.action.danger).toBe('destructive');
      expect(request.correlationId).toBe(correlationId);
    });
  });

  describe('receipt validation', () => {
    it('should validate valid receipt', () => {
      const receipt: OwnerActionReceipt = {
        correlationId: 'corr-123',
        status: 'success',
        timestamp: Date.now(),
        message: 'Operation completed',
      };

      expect(isValidReceipt(receipt)).toBe(true);
    });

    it('should reject invalid receipt (null)', () => {
      expect(isValidReceipt(null)).toBe(false);
    });

    it('should reject invalid receipt (object without required fields)', () => {
      expect(isValidReceipt({})).toBe(false);
      expect(isValidReceipt({ correlationId: 'test' })).toBe(false);
    });

    it('should reject receipt with invalid status', () => {
      const invalidReceipt = {
        correlationId: 'corr-123',
        status: 'invalid-status',
        timestamp: Date.now(),
      };

      expect(isValidReceipt(invalidReceipt)).toBe(false);
    });

    it('should accept all valid receipt statuses', () => {
      const validStatuses: Array<OwnerActionReceipt['status']> = [
        'success',
        'rejected',
        'failed',
        'stale',
      ];

      for (const status of validStatuses) {
        const receipt: OwnerActionReceipt = {
          correlationId: 'corr-123',
          status,
          timestamp: Date.now(),
        };
        expect(isValidReceipt(receipt)).toBe(true);
      }
    });
  });

  describe('receipt equivalence', () => {
    it('should detect equivalent receipts', () => {
      const receipt1: OwnerActionReceipt = {
        correlationId: 'corr-123',
        status: 'success',
        timestamp: 1234567890,
      };

      const receipt2: OwnerActionReceipt = {
        correlationId: 'corr-123',
        status: 'success',
        timestamp: 1234567890,
      };

      expect(areReceiptsEquivalent(receipt1, receipt2)).toBe(true);
    });

    it('should detect non-equivalent receipts (different correlation ID)', () => {
      const receipt1: OwnerActionReceipt = {
        correlationId: 'corr-123',
        status: 'success',
        timestamp: 1234567890,
      };

      const receipt2: OwnerActionReceipt = {
        correlationId: 'corr-456',
        status: 'success',
        timestamp: 1234567890,
      };

      expect(areReceiptsEquivalent(receipt1, receipt2)).toBe(false);
    });

    it('should detect non-equivalent receipts (different status)', () => {
      const receipt1: OwnerActionReceipt = {
        correlationId: 'corr-123',
        status: 'success',
        timestamp: 1234567890,
      };

      const receipt2: OwnerActionReceipt = {
        correlationId: 'corr-123',
        status: 'failed',
        timestamp: 1234567890,
      };

      expect(areReceiptsEquivalent(receipt1, receipt2)).toBe(false);
    });

    it('should detect non-equivalent receipts (different timestamp)', () => {
      const receipt1: OwnerActionReceipt = {
        correlationId: 'corr-123',
        status: 'success',
        timestamp: 1234567890,
      };

      const receipt2: OwnerActionReceipt = {
        correlationId: 'corr-123',
        status: 'success',
        timestamp: 1234567891,
      };

      expect(areReceiptsEquivalent(receipt1, receipt2)).toBe(false);
    });
  });

  describe('mock adapter', () => {
    it('should create mock adapter with default options', () => {
      const adapter = createMockAdapter();

      expect(adapter).toBeDefined();
      expect(typeof adapter.getThreadProjection).toBe('function');
      expect(typeof adapter.getSessionProjection).toBe('function');
      expect(typeof adapter.submitAction).toBe('function');
      expect(typeof adapter.subscribeToReceipts).toBe('function');
      expect(typeof adapter.hasCapability).toBe('function');
    });

    it('should return custom threads from mock adapter', async () => {
      const customThreads = [
        {
          ref: 'thread-1',
          displayName: 'Main Agent',
          status: 'active' as const,
          parentRef: null,
          children: [],
          lastActivity: Date.now(),
          active: true,
        },
      ];

      const adapter = createMockAdapter({ threads: customThreads });
      const threads = await adapter.getThreadProjection();

      expect(threads).toEqual(customThreads);
    });

    it('should return custom sessions from mock adapter', async () => {
      const customSessions = [
        {
          ref: 'session-1',
          title: 'Test Session',
          lastUpdate: Date.now(),
          project: 'test-project',
          status: 'active' as const,
          active: true,
        },
      ];

      const adapter = createMockAdapter({ sessions: customSessions });
      const sessions = await adapter.getSessionProjection();

      expect(sessions).toEqual(customSessions);
    });

    it('should submit action and return correlation ID', async () => {
      const adapter = createMockAdapter();
      const request = {
        action: {
          type: 'open-thread' as const,
          targetRef: 'thread-123' as any,
          parameters: {},
          danger: 'safe' as const,
        },
        correlationId: 'test-123',
      };

      const correlationId = await adapter.submitAction(request);
      expect(correlationId).toBe('test-123');
    });

    it('should subscribe and notify receipt handlers', async () => {
      const adapter = createMockAdapter();
      const receipts: OwnerActionReceipt[] = [];

      const unsubscribe = adapter.subscribeToReceipts((receipt) => {
        receipts.push(receipt);
      });

      const request = {
        action: {
          type: 'new-chat' as const,
          targetRef: null,
          parameters: {},
          danger: 'safe' as const,
        },
        correlationId: 'test-456',
      };

      await adapter.submitAction(request);

      expect(receipts).toHaveLength(1);
      expect(receipts[0].correlationId).toBe('test-456');
      expect(receipts[0].status).toBe('success');

      unsubscribe();

      // After unsubscribe, new receipts should not be received
      receipts.length = 0;
      await adapter.submitAction(request);
      expect(receipts).toHaveLength(0);
    });

    it('should check capabilities correctly', () => {
      const adapter = createMockAdapter({
        capabilities: new Set(['open-thread', 'open-session']),
      });

      expect(adapter.hasCapability('open-thread')).toBe(true);
      expect(adapter.hasCapability('open-session')).toBe(true);
      expect(adapter.hasCapability('delete-session')).toBe(false);
    });
  });

  describe('adapter contract tests', () => {
    it('should satisfy OwnerActionAdapter interface', async () => {
      const adapter = createMockAdapter();

      // Test all interface methods exist and are callable
      await adapter.getThreadProjection();
      await adapter.getSessionProjection();

      const request = {
        action: {
          type: 'new-chat' as const,
          targetRef: null,
          parameters: {},
          danger: 'safe' as const,
        },
        correlationId: 'interface-test',
      };
      await adapter.submitAction(request);

      const unsubscribe = adapter.subscribeToReceipts(() => {});
      unsubscribe();

      adapter.hasCapability('new-chat');

      // If we got here without exceptions, interface is satisfied
      expect(true).toBe(true);
    });
  });
});
