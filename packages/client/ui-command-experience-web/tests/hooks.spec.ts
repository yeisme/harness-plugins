/**
 * Tests for Command Experience Web Hooks
 *
 * Verifies directory access, state management, navigation, and execution.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useCommandDirectory,
  useCommandState,
  useCommandNavigation,
  useCommandExecutor,
  useCommandSelector,
} from '../src/hooks';
import type { CommandExperienceEntryV1 } from '@yeisme/dsh-client-ui-command-experience-core';

// Mock command entries
const mockCommands: CommandExperienceEntryV1[] = [
  {
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
  {
    canonicalName: 'model',
    aliases: [],
    description: 'Change model settings',
    category: 'model',
    input: {},
    surfaces: ['web', 'tui'],
    actionKind: 'owner-action',
    owner: 'dsh',
    danger: 'safe',
    availability: { state: 'available' },
    coverage: 'equivalent',
  },
  {
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
];

describe('useCommandDirectory', () => {
  it('should provide filtered commands', () => {
    const { result } = renderHook(() =>
      useCommandDirectory(mockCommands, { query: '/agent' })
    );

    expect(result.current.filteredCount).toBe(1);
    expect(result.current.commands[0].canonicalName).toBe('agent');
  });

  it('should group commands by category', () => {
    const { result } = renderHook(() =>
      useCommandDirectory(mockCommands)
    );

    expect(result.current.commandsByCategory.size).toBe(2);
    expect(result.current.commandsByCategory.has('session')).toBe(true);
    expect(result.current.commandsByCategory.has('model')).toBe(true);
  });

  it('should find exact command match', () => {
    const { result } = renderHook(() =>
      useCommandDirectory(mockCommands)
    );

    const found = result.current.findCommand('agent');
    expect(found?.canonicalName).toBe('agent');
  });

  it('should find unique prefix match', () => {
    const { result } = renderHook(() =>
      useCommandDirectory(mockCommands)
    );

    const found = result.current.findUniqueCommand('agen');
    expect(found?.canonicalName).toBe('agent');
  });

  it('should return null for ambiguous prefix', () => {
    const { result } = renderHook(() =>
      useCommandDirectory(mockCommands)
    );

    const found = result.current.findUniqueCommand('');
    expect(found).toBeNull();
  });
});

describe('useCommandState', () => {
  it('should create initial state', () => {
    const { result } = renderHook(() => useCommandState());

    expect(result.current.state.state).toBe('idle');
    expect(result.current.state.draft).toBe('');
  });

  it('should dispatch actions with correlation ID', () => {
    const { result } = renderHook(() => useCommandState());

    act(() => {
      result.current.dispatch({
        type: 'START_ASSIST',
        query: 'agent',
        draft: '',
      });
    });

    expect(result.current.state.query).toBe('agent');
  });
});

describe('useCommandNavigation', () => {
  it('should navigate through commands', () => {
    const { result } = renderHook(() =>
      useCommandNavigation(mockCommands, null)
    );

    act(() => {
      result.current.navigateDown();
    });

    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.selectedCommand?.canonicalName).toBe('agent');
  });

  it('should not navigate beyond bounds', () => {
    const { result } = renderHook(() =>
      useCommandNavigation(mockCommands, mockCommands[0])
    );

    act(() => {
      result.current.navigateUp();
    });

    expect(result.current.selectedIndex).toBe(-1);
  });

  it('should reset selection', () => {
    const { result } = renderHook(() =>
      useCommandNavigation(mockCommands, mockCommands[0])
    );

    act(() => {
      result.current.resetSelection();
    });

    expect(result.current.selectedIndex).toBe(-1);
    expect(result.current.selectedCommand).toBeNull();
  });
});

describe('useCommandExecutor', () => {
  it('should execute command', () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useCommandExecutor(dispatch));

    act(() => {
      result.current.executeCommand(mockCommands[0]);
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'DISPATCH',
      })
    );
  });

  it('should cancel command', () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useCommandExecutor(dispatch));

    act(() => {
      result.current.cancelCommand();
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CANCEL',
      })
    );
  });
});

describe('useCommandSelector', () => {
  it('should manage selector state', () => {
    const { result } = renderHook(() => useCommandSelector('session'));

    expect(result.current.isOpen).toBe(false);
    expect(result.current.selectedItem).toBeNull();

    act(() => {
      result.current.open();
    });

    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.selectItem('session-123');
    });

    expect(result.current.selectedItem).toBe('session-123');
    expect(result.current.isOpen).toBe(false);
  });

  it('should update query', () => {
    const { result } = renderHook(() => useCommandSelector('thread'));

    act(() => {
      result.current.updateQuery('search term');
    });

    expect(result.current.query).toBe('search term');
  });
});
