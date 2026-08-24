/**
 * Command Experience Web Hooks
 *
 * React hooks for command directory integration and state management.
 */

import { useState, useCallback, useMemo } from 'react';
import type {
  CommandExperienceEntryV1,
  CommandReducerState,
  CommandReducerAction,
  CommandFilterOptions,
} from '@yeisme/dsh-client-ui-command-experience-core';
import {
  createInitialState,
  commandReducer,
  filterCommands,
  findExactMatch,
  findUniquePrefixMatch,
  findPrefixMatches,
} from '@yeisme/dsh-client-ui-command-experience-core';

/**
 * Hook for accessing command directory
 * Provides filtered and sorted commands without RPC calls.
 */
export function useCommandDirectory(
  commands: CommandExperienceEntryV1[],
  options?: CommandFilterOptions
) {
  const filteredCommands = useMemo(() => {
    return filterCommands(commands, options);
  }, [commands, options]);

  const commandsByCategory = useMemo(() => {
    const grouped = new Map<string, CommandExperienceEntryV1[]>();
    for (const command of filteredCommands) {
      const category = command.category || 'other';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(command);
    }
    return grouped;
  }, [filteredCommands]);

  const findCommand = useCallback((query: string) => {
    return findExactMatch(filteredCommands, query);
  }, [filteredCommands]);

  const findUniqueCommand = useCallback((prefix: string) => {
    return findUniquePrefixMatch(filteredCommands, prefix);
  }, [filteredCommands]);

  const findMatchingCommands = useCallback((prefix: string) => {
    return findPrefixMatches(filteredCommands, prefix);
  }, [filteredCommands]);

  return {
    commands: filteredCommands,
    commandsByCategory,
    findCommand,
    findUniqueCommand,
    findMatchingCommands,
    totalCommands: commands.length,
    filteredCount: filteredCommands.length,
  };
}

/**
 * Hook for command state management with reducer
 */
export function useCommandState(
  _initialState?: Partial<CommandReducerState>
) {
  const [state, dispatch] = useState<CommandReducerState>(() =>
    createInitialState()
  );

  const dispatchWithCorrelation = useCallback(
    (action: CommandReducerAction) => {
      dispatch(commandReducer(state, action));
    },
    [state]
  );

  return {
    state,
    dispatch: dispatchWithCorrelation,
  };
}

/**
 * Hook for keyboard navigation within command menu
 */
export function useCommandNavigation(
  commands: CommandExperienceEntryV1[],
  selectedCommand: CommandExperienceEntryV1 | null
) {
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const navigateToIndex = useCallback((index: number) => {
    if (index >= -1 && index < commands.length) {
      setSelectedIndex(index);
    }
  }, [commands.length]);

  const navigateUp = useCallback(() => {
    navigateToIndex(selectedIndex - 1);
  }, [selectedIndex, navigateToIndex]);

  const navigateDown = useCallback(() => {
    navigateToIndex(selectedIndex + 1);
  }, [selectedIndex, navigateToIndex]);

  const navigateToCommand = useCallback((command: CommandExperienceEntryV1) => {
    const index = commands.findIndex(cmd => cmd.canonicalName === command.canonicalName);
    if (index !== -1) {
      setSelectedIndex(index);
    }
  }, [commands, selectedCommand]);

  const resetSelection = useCallback(() => {
    setSelectedIndex(-1);
  }, []);

  return {
    selectedIndex,
    selectedCommand: selectedIndex >= 0 ? commands[selectedIndex] : null,
    navigateUp,
    navigateDown,
    navigateToIndex,
    navigateToCommand,
    resetSelection,
  };
}

/**
 * Hook for command execution with state updates
 */
export function useCommandExecutor(
  dispatch: (action: CommandReducerAction) => void
) {
  const executeCommand = useCallback(
    (_command: CommandExperienceEntryV1, _args?: Record<string, unknown>) => {
      dispatch({
        type: 'DISPATCH',
        correlationId: Date.now().toString(),
      });
    },
    [dispatch]
  );

  const cancelCommand = useCallback(() => {
    dispatch({ type: 'CANCEL' });
  }, [dispatch]);

  const selectCommand = useCallback(
    (command: CommandExperienceEntryV1) => {
      dispatch({
        type: 'SELECT_COMMAND',
        command,
      });
    },
    [dispatch]
  );

  const updateDraft = useCallback(
    (query: string) => {
      dispatch({
        type: 'UPDATE_QUERY',
        query,
      });
    },
    [dispatch]
  );

  return {
    executeCommand,
    cancelCommand,
    selectCommand,
    updateDraft,
  };
}

/**
 * Hook for command selector state management
 * Handles session/thread/workspace/argument selection
 */
export function useCommandSelector(
  selectorType: 'session' | 'thread' | 'workspace' | 'argument'
) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  const selectItem = useCallback(
    (itemId: string) => {
      setSelectedItem(itemId);
      close();
    },
    [close]
  );

  const updateQuery = useCallback((newQuery: string) => {
    setQuery(newQuery);
  }, []);

  return {
    isOpen,
    selectedItem,
    query,
    open,
    close,
    selectItem,
    updateQuery,
    selectorType,
  };
}
