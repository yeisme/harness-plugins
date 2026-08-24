/**
 * Command Experience Web Hooks
 *
 * React hooks that consume the shared directory and reducer.
 */

import { useCallback, useMemo, useReducer, useState } from 'react';
import type {
  CommandExperienceEntryV1,
  CommandFilterOptions,
  CommandReducerAction,
  CommandReducerState,
} from '@yeisme/dsh-client-ui-command-experience-core';
import {
  commandReducer,
  createInitialState,
  filterCommands,
  findExactMatch,
  findPrefixMatches,
  findUniquePrefixMatch,
  generateCorrelationId,
  isCommandExecutable,
  resolveAssistQuery,
} from '@yeisme/dsh-client-ui-command-experience-core';

export function useCommandDirectory(
  commands: readonly CommandExperienceEntryV1[],
  options?: CommandFilterOptions,
) {
  const filteredCommands = useMemo(() => {
    if (options?.query === undefined) {
      return filterCommands(commands, options);
    }
    return filterCommands(commands, {
      ...options,
      query: options.query.replace(/^\s*\/+/, ''),
    });
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
    return findExactMatch(filteredCommands, query.replace(/^\//, ''));
  }, [filteredCommands]);

  const findUniqueCommand = useCallback((prefix: string) => {
    return findUniquePrefixMatch(filteredCommands, prefix.replace(/^\//, ''));
  }, [filteredCommands]);

  const findMatchingCommands = useCallback((prefix: string) => {
    return findPrefixMatches(filteredCommands, prefix.replace(/^\//, ''));
  }, [filteredCommands]);

  const resolve = useCallback((input: string) => {
    return resolveAssistQuery(commands, input);
  }, [commands]);

  return {
    commands: filteredCommands,
    commandsByCategory,
    findCommand,
    findUniqueCommand,
    findMatchingCommands,
    resolve,
    totalCommands: commands.length,
    filteredCount: filteredCommands.length,
  };
}

export function useCommandState(
  _initialState?: Partial<CommandReducerState>,
) {
  const [state, dispatch] = useReducer(commandReducer, undefined, createInitialState);

  return {
    state,
    dispatch,
  };
}

export function useCommandNavigation(
  commands: readonly CommandExperienceEntryV1[],
  selectedCommand: CommandExperienceEntryV1 | null,
) {
  const [selectedIndex, setSelectedIndex] = useState<number>(() => {
    if (selectedCommand === null) return -1;
    return commands.findIndex((cmd) => cmd.canonicalName === selectedCommand.canonicalName);
  });

  const navigateToIndex = useCallback((index: number) => {
    if (index >= -1 && index < commands.length) {
      setSelectedIndex(index);
    }
  }, [commands.length]);

  const navigateUp = useCallback(() => {
    setSelectedIndex((current) => {
      const next = current <= 0 ? -1 : current - 1;
      return next;
    });
  }, []);

  const navigateDown = useCallback(() => {
    setSelectedIndex((current) => {
      if (commands.length === 0) return -1;
      const start = current < 0 ? -1 : current;
      return Math.min(start + 1, commands.length - 1);
    });
  }, [commands.length]);

  const navigateToCommand = useCallback((command: CommandExperienceEntryV1) => {
    const index = commands.findIndex((cmd) => cmd.canonicalName === command.canonicalName);
    if (index !== -1) {
      setSelectedIndex(index);
    }
  }, [commands]);

  const resetSelection = useCallback(() => {
    setSelectedIndex(-1);
  }, []);

  const resolvedIndex = selectedIndex >= commands.length ? -1 : selectedIndex;

  return {
    selectedIndex: resolvedIndex,
    selectedCommand: resolvedIndex >= 0 ? commands[resolvedIndex] ?? null : null,
    navigateUp,
    navigateDown,
    navigateToIndex,
    navigateToCommand,
    resetSelection,
  };
}

export function useCommandExecutor(
  dispatch: (action: CommandReducerAction) => void,
) {
  const executeCommand = useCallback(
    (command: CommandExperienceEntryV1, _args?: Record<string, unknown>) => {
      if (!isCommandExecutable(command)) {
        return;
      }
      dispatch({ type: 'SELECT_COMMAND', command });
      if (command.input.selectorKey) {
        dispatch({ type: 'OPEN_SELECTOR' });
        return;
      }
      if (command.danger !== 'safe') {
        dispatch({ type: 'REQUEST_CONFIRMATION' });
        return;
      }
      dispatch({
        type: 'DISPATCH',
        correlationId: generateCorrelationId(),
      });
    },
    [dispatch],
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
    [dispatch],
  );

  const updateDraft = useCallback(
    (query: string) => {
      dispatch({
        type: 'UPDATE_QUERY',
        query,
      });
    },
    [dispatch],
  );

  return {
    executeCommand,
    cancelCommand,
    selectCommand,
    updateDraft,
  };
}

export function useCommandSelector(
  selectorType: 'session' | 'thread' | 'workspace' | 'argument',
) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  const selectItem = useCallback((itemId: string) => {
    setSelectedItem(itemId);
    setIsOpen(false);
    setQuery('');
  }, []);

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
