/**
 * MSW Fixtures for Owner Action Testing
 *
 * Mocks owner action responses for command execution, selectors, and receipts.
 */

import { http, HttpResponse } from 'msw';

// Base URL for DSH owner action API
const BASE_URL = 'https://api.deepseek.com/v1';

// Types for owner action responses
export interface OwnerActionRequest {
  command: string;
  args?: Record<string, unknown>;
  correlationId?: string;
}

export interface OwnerActionResponse {
  status: 'pending' | 'success' | 'rejected' | 'failed' | 'stale';
  correlationId: string;
  receipt?: {
    id: string;
    status: string;
    result?: unknown;
    error?: string;
  };
  preview?: {
    title: string;
    description: string;
    danger: 'safe' | 'confirm' | 'destructive';
  };
}

// Mock session data for selectors
export const MOCK_SESSIONS = [
  { id: 'sess-1', title: 'Project Planning', timestamp: Date.now() - 3600000 },
  { id: 'sess-2', title: 'Code Review', timestamp: Date.now() - 7200000 },
  { id: 'sess-3', title: 'Bug Investigation', timestamp: Date.now() - 86400000 },
];

export const MOCK_THREADS = [
  { id: 'thread-1', title: 'Main Discussion', messageCount: 15 },
  { id: 'thread-2', title: 'Debug Session', messageCount: 8 },
  { id: 'thread-3', title: 'Architecture Chat', messageCount: 23 },
];

export const MOCK_WORKSPACES = [
  { id: 'ws-1', name: 'Frontend', path: '/projects/frontend' },
  { id: 'ws-2', name: 'Backend', path: '/projects/backend' },
  { id: 'ws-3', name: 'Shared', path: '/projects/shared' },
];

// MSW handlers for owner actions
export const ownerActionHandlers = [
  // Command execution with pending state
  http.post(`${BASE_URL}/commands/execute`, async ({ request }) => {
    const body = (await request.json()) as OwnerActionRequest;

    // Simulate pending response for dangerous commands
    if (body.command === 'delete' || body.command === 'archive') {
      return HttpResponse.json<OwnerActionResponse>({
        status: 'pending',
        correlationId: body.correlationId || 'corr-1',
        preview: {
          title: `Confirm ${body.command}`,
          description: `This action cannot be undone`,
          danger: body.command === 'delete' ? 'destructive' : 'confirm',
        },
      });
    }

    // Immediate success for safe commands
    return HttpResponse.json<OwnerActionResponse>({
      status: 'success',
      correlationId: body.correlationId || 'corr-2',
      receipt: {
        id: 'receipt-1',
        status: 'completed',
        result: { message: 'Command executed successfully' },
      },
    });
  }),

  // Command confirmation endpoint
  http.post(`${BASE_URL}/commands/confirm`, async ({ request }) => {
    const body = (await request.json()) as OwnerActionRequest;

    return HttpResponse.json<OwnerActionResponse>({
      status: 'success',
      correlationId: body.correlationId || 'corr-3',
      receipt: {
        id: 'receipt-2',
        status: 'completed',
        result: { message: 'Action confirmed and executed' },
      },
    });
  }),

  // Command cancellation
  http.post(`${BASE_URL}/commands/cancel`, async ({ request }) => {
    const body = (await request.json()) as OwnerActionRequest;

    return HttpResponse.json<OwnerActionResponse>({
      status: 'rejected',
      correlationId: body.correlationId || 'corr-4',
      receipt: {
        id: 'receipt-3',
        status: 'cancelled',
        result: { message: 'Action cancelled by user' },
      },
    });
  }),

  // Session list for selector
  http.get(`${BASE_URL}/sessions`, () => {
    return HttpResponse.json({ sessions: MOCK_SESSIONS });
  }),

  // Thread list for selector
  http.get(`${BASE_URL}/threads`, () => {
    return HttpResponse.json({ threads: MOCK_THREADS });
  }),

  // Workspace list for selector
  http.get(`${BASE_URL}/workspaces`, () => {
    return HttpResponse.json({ workspaces: MOCK_WORKSPACES });
  }),

  // Receipt status check
  http.get(`${BASE_URL}/receipts/:correlationId`, ({ params }) => {
    const { correlationId } = params;

    // Simulate different receipt states
    if (correlationId === 'stale-corr') {
      return HttpResponse.json<OwnerActionResponse>({
        status: 'stale',
        correlationId: correlationId as string,
        receipt: {
          id: 'receipt-stale',
          status: 'stale',
          error: 'Action expired or was superseded',
        },
      });
    }

    if (correlationId === 'failed-corr') {
      return HttpResponse.json<OwnerActionResponse>({
        status: 'failed',
        correlationId: correlationId as string,
        receipt: {
          id: 'receipt-failed',
          status: 'failed',
          error: 'Execution failed: insufficient permissions',
        },
      });
    }

    return HttpResponse.json<OwnerActionResponse>({
      status: 'success',
      correlationId: correlationId as string,
      receipt: {
        id: 'receipt-success',
        status: 'completed',
        result: { message: 'Action completed successfully' },
      },
    });
  }),

  // Session switching
  http.post(`${BASE_URL}/sessions/switch`, async ({ request }) => {
    const body = (await request.json()) as { sessionId: string };
    const session = MOCK_SESSIONS.find(s => s.id === body.sessionId);

    if (!session) {
      return HttpResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json<OwnerActionResponse>({
      status: 'success',
      correlationId: `switch-${body.sessionId}`,
      receipt: {
        id: `receipt-${body.sessionId}`,
        status: 'completed',
        result: { switchedTo: session.id },
      },
    });
  }),

  // Argument completion suggestions
  http.get(`${BASE_URL}/commands/:command/args`, ({ params }) => {
    const { command } = params;

    if (command === 'agent') {
      return HttpResponse.json({
        suggestions: [
          { value: 'main', description: 'Main agent thread' },
          { value: 'sub-1', description: 'Subagent: Code Review' },
          { value: 'sub-2', description: 'Subagent: Debug' },
        ],
      });
    }

    return HttpResponse.json({ suggestions: [] });
  }),
];

// Helper to setup MSW with test context
export function setupMockServer(handlers = ownerActionHandlers) {
  // This would be called in test setup to configure MSW
  return { handlers };
}

// Helper to create mock owner action responses
export function createMockResponse(
  status: OwnerActionResponse['status'],
  correlationId = 'test-corr'
): OwnerActionResponse {
  const base: OwnerActionResponse = {
    status,
    correlationId,
  };

  switch (status) {
    case 'success':
      return {
        ...base,
        receipt: {
          id: `receipt-${correlationId}`,
          status: 'completed',
          result: { message: 'Action completed' },
        },
      };
    case 'rejected':
      return {
        ...base,
        receipt: {
          id: `receipt-${correlationId}`,
          status: 'cancelled',
          result: { message: 'Action cancelled' },
        },
      };
    case 'failed':
      return {
        ...base,
        receipt: {
          id: `receipt-${correlationId}`,
          status: 'failed',
          error: 'Execution failed',
        },
      };
    case 'stale':
      return {
        ...base,
        receipt: {
          id: `receipt-${correlationId}`,
          status: 'stale',
          error: 'Action expired',
        },
      };
    case 'pending':
      return {
        ...base,
        preview: {
          title: 'Confirm Action',
          description: 'This action requires confirmation',
          danger: 'confirm',
        },
      };
    default:
      return base;
  }
}
