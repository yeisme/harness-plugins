/**
 * Tests for Command Experience Web Components
 *
 * Verifies selector, confirmation, and pending receipt components with MSW fixtures
 * and keyboard accessibility.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import * as React from 'react';
import { CommandMenu, CommandSelector, ConfirmationDialog, PendingReceipt } from '../src/components';
import { MOCK_SESSIONS, MOCK_THREADS } from './fixtures';
import type { CommandReducerState } from '@yeisme/dsh-client-ui-command-experience-core';

// Setup MSW server with test fixtures
const server = setupServer(
  http.post('https://api.deepseek.com/v1/commands/execute', async ({ request }) => {
    const body = await request.json() as { command: string };

    if (body.command === 'delete') {
      return HttpResponse.json({
        status: 'pending',
        correlationId: 'test-corr-1',
        preview: {
          title: 'Confirm delete',
          description: 'This action cannot be undone',
          danger: 'destructive',
        },
      });
    }

    return HttpResponse.json({
      status: 'success',
      correlationId: 'test-corr-2',
      receipt: {
        id: 'receipt-1',
        status: 'completed',
      },
    });
  }),

  http.post('https://api.deepseek.com/v1/commands/cancel', () => {
    return HttpResponse.json({
      status: 'rejected',
      correlationId: 'test-corr-3',
      receipt: {
        id: 'receipt-2',
        status: 'cancelled',
      },
    });
  }),

  http.get('https://api.deepseek.com/v1/sessions', () => {
    return HttpResponse.json({ sessions: MOCK_SESSIONS });
  }),

  http.get('https://api.deepseek.com/v1/threads', () => {
    return HttpResponse.json({ threads: MOCK_THREADS });
  })
);

describe('CommandMenu Component', () => {
  beforeEach(() => {
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
  });

  const mockState: CommandReducerState = {
    state: 'assist',
    query: '/agent',
    draft: '/agent',
    selectedCommand: {
      canonicalName: 'agent',
      aliases: [],
      description: 'Switch agent or thread',
      category: 'session',
      input: {},
      surfaces: ['web', 'tui'],
      actionKind: 'owner-action',
      owner: 'dsh',
      danger: 'safe',
      availability: { state: 'available' },
      coverage: 'equivalent',
    },
    correlationId: null,
    receiptStatus: null,
  };

  const mockDispatch = vi.fn();

  it('should render command menu with input', () => {
    render(React.createElement(CommandMenu, { state: mockState, dispatch: mockDispatch }));

    const input = screen.getByRole('textbox', { name: /command input/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('/agent');
  });

  it('should handle escape key to cancel', async () => {
    const user = userEvent.setup();
    render(React.createElement(CommandMenu, { state: mockState, dispatch: mockDispatch }));

    const input = screen.getByRole('textbox', { name: /command input/i });
    await user.click(input);

    await user.keyboard('{Escape}');
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'CANCEL',
    }));
  });

  it('should handle Ctrl+Enter to execute', async () => {
    const user = userEvent.setup();
    render(React.createElement(CommandMenu, { state: mockState, dispatch: mockDispatch }));

    const input = screen.getByRole('textbox', { name: /command input/i });
    await user.click(input);

    await user.keyboard('{Control}{Enter}');
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'DISPATCH',
    }));
  });
});

describe('CommandSelector Component', () => {
  beforeEach(() => {
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
  });

  const mockItems = [
    { id: 'sess-1', label: 'Project Planning', description: 'Started 1 hour ago' },
    { id: 'sess-2', label: 'Code Review', description: 'Started 2 hours ago' },
    { id: 'sess-3', label: 'Bug Investigation', description: 'Started 1 day ago' },
  ];

  it('should render closed selector', () => {
    render(React.createElement(CommandSelector, { selectorType: 'session', items: mockItems }));

    const trigger = screen.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('should open selector on trigger click', async () => {
    const user = userEvent.setup();
    render(React.createElement(CommandSelector, { selectorType: 'session', items: mockItems }));

    const trigger = screen.getByRole('button');
    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByPlaceholderText(/search sessions/i)).toBeInTheDocument();
  });

  it('should filter items based on query', async () => {
    const user = userEvent.setup();
    render(React.createElement(CommandSelector, { selectorType: 'session', items: mockItems }));

    const trigger = screen.getByRole('button');
    await user.click(trigger);

    const searchInput = screen.getByPlaceholderText(/search sessions/i);
    await user.type(searchInput, 'Project');

    await waitFor(() => {
      expect(screen.getByText('Project Planning')).toBeInTheDocument();
      expect(screen.queryByText('Code Review')).not.toBeInTheDocument();
    });
  });

  it('should handle keyboard navigation', async () => {
    const user = userEvent.setup();
    render(React.createElement(CommandSelector, { selectorType: 'session', items: mockItems }));

    const trigger = screen.getByRole('button');
    await user.click(trigger);

    const searchInput = screen.getByPlaceholderText(/search sessions/i);
    await user.click(searchInput);

    // Navigate down
    await user.keyboard('{ArrowDown}');
    const listbox = screen.getByRole('listbox');
    const firstOption = within(listbox).getAllByRole('option')[0];
    expect(firstOption).toHaveAttribute('aria-selected', 'true');

    // Navigate up
    await user.keyboard('{ArrowUp}');
    expect(firstOption).not.toHaveAttribute('aria-selected', 'true');
  });

  it('should handle keyboard selection with Enter', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(React.createElement(CommandSelector, {
      selectorType: 'session',
      items: mockItems,
      onSelect: onSelect
    }));

    const trigger = screen.getByRole('button');
    await user.click(trigger);

    const searchInput = screen.getByPlaceholderText(/search sessions/i);
    await user.click(searchInput);

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(mockItems[0]);
    });
  });

  it('should update active descendant for accessibility', async () => {
    const user = userEvent.setup();
    render(React.createElement(CommandSelector, { selectorType: 'session', items: mockItems }));

    const trigger = screen.getByRole('button');
    await user.click(trigger);

    const searchInput = screen.getByPlaceholderText(/search sessions/i);
    await user.click(searchInput);
    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(searchInput).toHaveAttribute('aria-activedescendant', mockItems[0].id);
    });
  });
});

describe('ConfirmationDialog Component', () => {
  const mockState: CommandReducerState = {
    state: 'confirmation',
    query: '/delete',
    draft: '/delete',
    selectedCommand: {
      canonicalName: 'delete',
      aliases: [],
      description: 'Delete current session',
      category: 'session',
      input: {},
      surfaces: ['web', 'tui'],
      actionKind: 'owner-action',
      owner: 'dsh',
      danger: 'destructive',
      availability: { state: 'available' },
      coverage: 'equivalent',
    },
    correlationId: 'test-corr-1',
    receiptStatus: null,
  };

  const mockDispatch = vi.fn();

  it('should not render for safe commands', () => {
    const safeState = { ...mockState };
    if (safeState.selectedCommand) {
      safeState.selectedCommand.danger = 'safe';
    }

    render(React.createElement(ConfirmationDialog, { state: safeState, dispatch: mockDispatch }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render destructive confirmation dialog', () => {
    render(React.createElement(ConfirmationDialog, { state: mockState, dispatch: mockDispatch }));

    const dialog = screen.getByRole('dialog', { name: /confirm destructive action/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/confirm destructive action/i)).toBeInTheDocument();
  });

  it('should confirm action', async () => {
    const user = userEvent.setup();
    render(React.createElement(ConfirmationDialog, { state: mockState, dispatch: mockDispatch }));

    const confirmButton = screen.getByRole('button', { name: /confirm destructive action/i });
    await user.click(confirmButton);

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'CONFIRM' });
  });

  it('should handle keyboard shortcuts', async () => {
    const user = userEvent.setup();
    render(React.createElement(ConfirmationDialog, { state: mockState, dispatch: mockDispatch }));

    // Test Ctrl+Enter to confirm
    await user.keyboard('{Control}{Enter}');
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'CONFIRM' });

    mockDispatch.mockClear();

    // Test Escape to cancel
    await user.keyboard('{Escape}');
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'CANCEL' });
  });
});

describe('PendingReceipt Component', () => {
  const mockState: CommandReducerState = {
    state: 'receipt',
    query: '/agent',
    draft: '/agent',
    selectedCommand: {
      canonicalName: 'agent',
      aliases: [],
      description: 'Switch agent',
      category: 'session',
      input: {},
      surfaces: ['web', 'tui'],
      actionKind: 'owner-action',
      owner: 'dsh',
      danger: 'safe',
      availability: { state: 'available' },
      coverage: 'equivalent',
    },
    correlationId: 'test-corr-2',
    receiptStatus: 'success',
  };

  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render success receipt', () => {
    render(React.createElement(PendingReceipt, {
      state: mockState,
      receiptStatus: 'success',
      dispatch: mockDispatch
    }));

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('agent')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('should render failed receipt', () => {
    render(React.createElement(PendingReceipt, {
      state: mockState,
      receiptStatus: 'failed',
      dispatch: mockDispatch
    }));

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Command execution failed');
  });

  it('should dismiss on button click', async () => {
    const user = userEvent.setup();
    render(React.createElement(PendingReceipt, {
      state: mockState,
      receiptStatus: 'success',
      dispatch: mockDispatch
    }));

    const dismissButton = screen.getByRole('button', { name: /dismiss notification/i });
    await user.click(dismissButton);

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'RESET' });
  });
});
