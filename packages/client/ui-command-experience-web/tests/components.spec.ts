/**
 * Tests for shipped Web command-experience components.
 *
 * Drive CommandMenu / CommandSelector / ConfirmationDialog / PendingReceipt
 * through the shared reducer. MSW fixtures stand in for owner actions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import * as React from 'react';
import {
  commandReducer,
  createInitialState,
  generateCorrelationId,
  type CommandReducerAction,
  type CommandReducerState,
} from '@yeisme/dsh-client-ui-command-experience-core';
import { CommandMenu, CommandSelector, ConfirmationDialog, PendingReceipt } from '../src/components';
import { createOwnerActionTransport } from '../src/transport';
import {
  MALICIOUS_PLUGIN_DESCRIPTOR,
  MOCK_SESSIONS,
  MOCK_THREADS,
  WEB_COMMAND_CATALOG,
  ownerActionHandlers,
} from './fixtures';
import { sanitizeCommandDescriptor } from '@yeisme/dsh-client-ui-command-experience-core';

const server = setupServer(...ownerActionHandlers);

function createStore(initial: CommandReducerState = createInitialState()) {
  let state = initial;
  const listeners = new Set<() => void>();
  const dispatch = (action: CommandReducerAction) => {
    state = commandReducer(state, action);
    for (const listener of listeners) listener();
  };
  return {
    getState: () => state,
    dispatch,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function Harness({
  store,
  children,
}: {
  store: ReturnType<typeof createStore>;
  children: (state: CommandReducerState, dispatch: (action: CommandReducerAction) => void) => React.ReactNode;
}) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => store.subscribe(() => setTick((value) => value + 1)), [store]);
  return React.createElement(React.Fragment, null, children(store.getState(), store.dispatch));
}

describe('CommandMenu Component', () => {
  it('opens / and shows categories plus disabled reasons from the shared directory', async () => {
    const user = userEvent.setup();
    const store = createStore();
    store.dispatch({ type: 'START_ASSIST', query: '/', draft: '/' });

    render(React.createElement(Harness, {
      store,
      children: (state, dispatch) => React.createElement(CommandMenu, {
        state,
        dispatch,
        commands: WEB_COMMAND_CATALOG,
      }),
    }));

    expect(screen.getByRole('textbox', { name: /command input/i })).toHaveValue('/');
    expect(screen.getByText('discovery')).toBeInTheDocument();
    expect(screen.getByText('session')).toBeInTheDocument();
    expect(screen.getByText('System status projection not available')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(store.getState().state).toBe('idle');
    expect(store.getState().draft).toBe('/');
  });

  it('selects an exact command and unique safe prefix without RPC', async () => {
    const user = userEvent.setup();
    const store = createStore();
    store.dispatch({ type: 'START_ASSIST', query: '/', draft: '/' });

    render(React.createElement(Harness, {
      store,
      children: (state, dispatch) => React.createElement(CommandMenu, {
        state,
        dispatch,
        commands: WEB_COMMAND_CATALOG,
      }),
    }));

    const input = screen.getByRole('textbox', { name: /command input/i });
    await user.clear(input);
    await user.type(input, '/resume');
    expect(store.getState().selectedCommand?.canonicalName).toBe('resume');

    store.dispatch({ type: 'START_ASSIST', query: '/', draft: '/' });
    await user.clear(input);
    await user.type(input, '/hel');
    expect(store.getState().selectedCommand?.canonicalName).toBe('help');
  });
});

describe('CommandSelector keyboard flow', () => {
  beforeEach(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
  });

  it('completes session selection with keyboard and accessible descendant', async () => {
    const user = userEvent.setup();
    const store = createStore();
    const resume = WEB_COMMAND_CATALOG.find((command) => command.canonicalName === 'resume')!;
    store.dispatch({ type: 'SELECT_COMMAND', command: resume });
    store.dispatch({ type: 'OPEN_SELECTOR' });

    const transport = createOwnerActionTransport();
    const sessions = await transport.listSessions();
    const items = sessions.map((session) => ({
      id: session.id,
      label: session.title,
      description: 'saved session',
    }));

    const onSelect = vi.fn();
    render(React.createElement(CommandSelector, {
      state: store.getState(),
      dispatch: store.dispatch,
      selectorType: 'session',
      items,
      onSelect,
    }));

    const trigger = screen.getByRole('button');
    await user.click(trigger);
    const searchInput = screen.getByPlaceholderText(/search sessions/i);
    await user.click(searchInput);
    await user.keyboard('{ArrowDown}');
    expect(searchInput).toHaveAttribute('aria-activedescendant', `session:${MOCK_SESSIONS[0].id}`);
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: MOCK_SESSIONS[0].id }));
    });
    expect(store.getState().selectedRef).toBe(MOCK_SESSIONS[0].id);
  });

  it('cancels the selector, keeps the draft, and restores focus', async () => {
    const user = userEvent.setup();
    const store = createStore();
    store.dispatch({ type: 'START_ASSIST', query: '/resume', draft: '/resume draft' });
    const resume = WEB_COMMAND_CATALOG.find((command) => command.canonicalName === 'resume')!;
    store.dispatch({ type: 'SELECT_COMMAND', command: resume });
    store.dispatch({ type: 'OPEN_SELECTOR' });

    render(React.createElement(Harness, {
      store,
      children: (state, dispatch) => React.createElement(CommandSelector, {
        state,
        dispatch,
        selectorType: 'session',
        items: MOCK_SESSIONS.map((session) => ({ id: session.id, label: session.title })),
      }),
    }));

    await user.click(screen.getByRole('button'));
    const searchInput = screen.getByPlaceholderText(/search sessions/i);
    await user.click(searchInput);
    await user.keyboard('{Escape}');

    expect(store.getState().state).toBe('idle');
    expect(store.getState().draft).toBe('/resume draft');
    expect(screen.getByRole('button')).toHaveFocus();
  });

  it('loads thread options from the owner-action fixture without changing draft on failed receipt', async () => {
    const transport = createOwnerActionTransport();
    const threads = await transport.listThreads();
    expect(threads.map((thread) => thread.id)).toEqual(MOCK_THREADS.map((thread) => thread.id));

    const store = createStore();
    store.dispatch({ type: 'START_ASSIST', query: '/agent', draft: '/agent leftover' });
    const agent = WEB_COMMAND_CATALOG.find((command) => command.canonicalName === 'agent')!;
    store.dispatch({ type: 'SELECT_COMMAND', command: agent });
    const correlationId = generateCorrelationId();
    store.dispatch({ type: 'DISPATCH', correlationId });
    store.dispatch({ type: 'RECEIPT', status: 'failed', correlationId, message: 'owner rejected' });

    expect(store.getState().draft).toBe('/agent leftover');
    expect(store.getState().receipt.status).toBe('failed');
  });
});

describe('ConfirmationDialog and PendingReceipt', () => {
  it('blocks /delete without owner preview', () => {
    const store = createStore();
    const del = {
      ...WEB_COMMAND_CATALOG.find((command) => command.canonicalName === 'delete')!,
      availability: { state: 'available' as const },
    };
    store.dispatch({ type: 'SELECT_COMMAND', command: del });
    store.dispatch({ type: 'REQUEST_CONFIRMATION' });

    render(React.createElement(ConfirmationDialog, {
      state: store.getState(),
      dispatch: store.dispatch,
      preview: null,
      receiptCapable: true,
    }));

    expect(screen.getByRole('status')).toHaveTextContent(/preview/i);
    expect(screen.getByRole('button', { name: /confirm destructive action/i })).toBeDisabled();
  });

  it('confirms when owner preview and receipt exist, then shows pending status text', async () => {
    const user = userEvent.setup();
    const store = createStore();
    const del = {
      ...WEB_COMMAND_CATALOG.find((command) => command.canonicalName === 'delete')!,
      availability: { state: 'available' as const },
    };
    store.dispatch({ type: 'SELECT_COMMAND', command: del });
    store.dispatch({ type: 'REQUEST_CONFIRMATION' });

    render(React.createElement(Harness, {
      store,
      children: (state, dispatch) => {
        if (state.state === 'confirmation') {
          return React.createElement(ConfirmationDialog, {
            state,
            dispatch,
            preview: {
              targetRef: 'session:opaque-1',
              impactSummary: 'Permanently delete one session',
              reversible: false,
              owner: 'dsh',
              capability: 'session.delete.preview',
            },
            receiptCapable: true,
          });
        }
        if (state.state === 'dispatching' || state.state === 'receipt') {
          return React.createElement(PendingReceipt, {
            state,
            receiptStatus: state.receipt.status ?? undefined,
            dispatch,
          });
        }
        return null;
      },
    }));

    await user.click(screen.getByRole('button', { name: /confirm destructive action/i }));
    expect(store.getState().state).toBe('dispatching');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});

describe('long-list projection', () => {
  it('keeps the selected session key after a capability refresh', async () => {
    const user = userEvent.setup();
    const first = Array.from({ length: 80 }, (_, index) => ({
      id: `sess-${index}`,
      label: `Session ${index}`,
    }));
    const selectedId = 'sess-41';

    const view = render(React.createElement(CommandSelector, {
      selectorType: 'session',
      items: first,
      windowSize: 20,
      catalogRevision: 1,
      initialValue: { id: selectedId, label: 'Session 41' },
    }));

    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('option', { name: /Session 41/ })).toBeInTheDocument();

    const refreshed = [
      { id: 'sess-0', label: 'Session 0' },
      { id: 'sess-41', label: 'Session 41' },
      ...Array.from({ length: 78 }, (_, index) => ({
        id: `sess-new-${index}`,
        label: `New ${index}`,
      })),
    ];

    view.rerender(React.createElement(CommandSelector, {
      selectorType: 'session',
      items: refreshed,
      windowSize: 20,
      catalogRevision: 2,
      initialValue: { id: selectedId, label: 'Session 41' },
    }));

    const selected = screen.getByRole('option', { name: /Session 41/ });
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected.id).toBe('session:sess-41');
    expect(screen.queryByRole('option', { name: /Session 42/ })).not.toBeInTheDocument();
  });
});

describe('malicious descriptor fixture', () => {
  it('sanitizes plugin description/icon/category and rejects execution injection', () => {
    const sanitized = sanitizeCommandDescriptor(MALICIOUS_PLUGIN_DESCRIPTOR);
    expect(sanitized.trustedForExecution).toBe(false);
    expect(sanitized.icon).toBeNull();
    expect(sanitized.description).not.toMatch(/\u001b/);
    expect(sanitized.description).not.toContain('<script');
    expect(sanitized.rejected).toEqual(expect.arrayContaining([
      'ansi',
      'html',
      'remote-code',
      'dynamic-import',
      'global-shortcut',
      'untrusted-execute',
    ]));
  });
});
