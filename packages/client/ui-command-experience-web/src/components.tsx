/**
 * Command Experience Web Components
 *
 * Consume the shared directory + reducer. No DOM patching.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { CommandExperienceEntryV1 } from '@yeisme/dsh-client-ui-command-experience-core';
import {
  commandStableKey,
  evaluateDangerGate,
  generateCorrelationId,
  groupByCategory,
  isCommandExecutable,
  projectBoundedWindow,
  retainSelectionAnchor,
  resolveAssistQuery,
  selectorStableKey,
} from '@yeisme/dsh-client-ui-command-experience-core';
import type {
  CommandMenuProps,
  CommandSelectorProps,
  ConfirmationDialogProps,
  PendingReceiptProps,
  SelectorItem,
} from './types';
import { useCommandNavigation } from './hooks';
import { getCommandAccessibilityLabel, getCommandDisabledReason, sanitizeCommandDescription } from './utils';

export const CommandMenu: React.FC<CommandMenuProps> = ({
  state,
  dispatch,
  commands = [],
  options = {},
  className = '',
  onRestoreFocus,
}) => {
  const { showCategories = true, showDisabledCommands = true } = options;
  const inputRef = useRef<HTMLInputElement>(null);
  const composerRestoreRef = useRef<HTMLButtonElement>(null);
  const query = state.draft || state.query || '';
  const resolution = useMemo(() => resolveAssistQuery(commands, query || '/'), [commands, query]);
  const visibleCommands = useMemo(
    () => resolution.candidates.filter((command) => showDisabledCommands || isCommandExecutable(command)),
    [resolution.candidates, showDisabledCommands],
  );

  const { selectedCommand, navigateUp, navigateDown, resetSelection, navigateToCommand } =
    useCommandNavigation(visibleCommands, state.selectedCommand ?? resolution.selected);

  const categories = useMemo(() => groupByCategory(visibleCommands), [visibleCommands]);

  const executeSelected = useCallback((command: CommandExperienceEntryV1 | null) => {
    if (command === null || !isCommandExecutable(command)) {
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
    dispatch({ type: 'DISPATCH', correlationId: generateCorrelationId() });
  }, [dispatch]);

  useEffect(() => {
    if (resolution.selected && state.state === 'assist') {
      dispatch({ type: 'SELECT_COMMAND', command: resolution.selected });
      navigateToCommand(resolution.selected);
    }
  }, [resolution.selected, state.state, dispatch, navigateToCommand]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (state.state === 'idle' && !query.startsWith('/')) {
        return;
      }
      if (event.key === 'ArrowDown' || (event.ctrlKey && event.key === 'n')) {
        event.preventDefault();
        navigateDown();
      } else if (event.key === 'ArrowUp' || (event.ctrlKey && event.key === 'p')) {
        event.preventDefault();
        navigateUp();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        dispatch({ type: 'CANCEL' });
        resetSelection();
        onRestoreFocus?.();
        composerRestoreRef.current?.focus();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        executeSelected(selectedCommand ?? resolution.selected ?? state.selectedCommand);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    state.state,
    state.selectedCommand,
    query,
    navigateUp,
    navigateDown,
    dispatch,
    resetSelection,
    executeSelected,
    selectedCommand,
    resolution.selected,
    onRestoreFocus,
  ]);

  useEffect(() => {
    if (state.state === 'idle' && state.draft.startsWith('/')) {
      inputRef.current?.focus();
    }
  }, [state.state, state.draft]);

  if (state.state === 'idle' && !state.draft.startsWith('/') && !query.startsWith('/')) {
    return null;
  }

  const activeCommand = selectedCommand ?? resolution.selected ?? state.selectedCommand;
  const activeDescendant = activeCommand ? commandStableKey(activeCommand.canonicalName) : undefined;

  return (
    <div className={`command-menu ${className}`} role="dialog" aria-label="Command Menu" aria-modal="true">
      <button
        ref={composerRestoreRef}
        type="button"
        className="command-menu-focus-restore"
        aria-label="Restore composer focus"
        tabIndex={-1}
      />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(event) => {
          const next = event.target.value;
          if (state.state === 'idle') {
            dispatch({ type: 'START_ASSIST', query: next, draft: next });
          } else {
            dispatch({ type: 'UPDATE_QUERY', query: next });
          }
        }}
        placeholder="Type a command or search..."
        className="command-menu-input"
        aria-label="Command input"
        aria-autocomplete="list"
        aria-controls="command-list"
        aria-activedescendant={activeDescendant}
        autoFocus
      />

      <ul id="command-list" role="listbox" className="command-list" aria-label="Available commands">
        {Array.from(categories.entries()).map(([category, cmds]) => (
          <React.Fragment key={category}>
            {showCategories && (
              <li role="presentation" className="command-category">{category}</li>
            )}
            {cmds.map((command) => {
              const isSelected = activeCommand?.canonicalName === command.canonicalName;
              const disabledReason = getCommandDisabledReason(command);
              const executable = isCommandExecutable(command);

              return (
                <li
                  key={commandStableKey(command.canonicalName)}
                  id={commandStableKey(command.canonicalName)}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={!executable}
                  className={`command-item ${isSelected ? 'selected' : ''} ${disabledReason ? 'disabled' : ''}`}
                  onClick={() => executable && executeSelected(command)}
                  onMouseEnter={() => navigateToCommand(command)}
                  aria-label={getCommandAccessibilityLabel(command)}
                >
                  <span className="command-canonical">/{command.canonicalName}</span>
                  <span className="command-description">{sanitizeCommandDescription(command.description)}</span>
                  {disabledReason && (
                    <span className="command-disabled-reason" aria-label={`Disabled: ${disabledReason}`}>
                      {disabledReason}
                    </span>
                  )}
                </li>
              );
            })}
          </React.Fragment>
        ))}
      </ul>
    </div>
  );
};

export const CommandSelector: React.FC<CommandSelectorProps> = ({
  state,
  dispatch,
  selectorType,
  options = {},
  items = [],
  windowSize,
  catalogRevision,
  onSelect,
  onClose,
  initialValue,
}) => {
  const { placeholder = 'Select...', maxItems } = options;
  const [isOpen, setIsOpen] = React.useState(state?.state === 'selector');
  const [query, setQuery] = React.useState('');
  const [selectedKey, setSelectedKey] = React.useState<string | null>(
    state?.selectedRef ? selectorStableKey(selectorType, state.selectedRef) : initialValue ? selectorStableKey(selectorType, initialValue.id) : null,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (state?.state === 'selector') {
      setIsOpen(true);
    }
  }, [state?.state]);

  const filteredItems = useMemo(() => {
    if (!query) return [...items];
    const lowerQuery = query.toLowerCase();
    return items.filter((item) =>
      item.label.toLowerCase().includes(lowerQuery) ||
      item.description?.toLowerCase().includes(lowerQuery),
    );
  }, [items, query]);

  const keyedItems = useMemo(
    () => filteredItems.map((item) => ({ ...item, key: selectorStableKey(selectorType, item.id) })),
    [filteredItems, selectorType],
  );

  const retained = useMemo(
    () => retainSelectionAnchor(selectedKey, keyedItems.map((item) => item.key)),
    [selectedKey, keyedItems, catalogRevision],
  );

  const projection = useMemo(
    () => projectBoundedWindow(keyedItems, {
      windowSize: windowSize ?? maxItems ?? 40,
      selectedKey: retained.key,
    }),
    [keyedItems, retained.key, windowSize, maxItems],
  );

  useEffect(() => {
    if (retained.key !== selectedKey) {
      setSelectedKey(retained.key);
    }
  }, [retained.key, selectedKey]);

  const handleSelect = useCallback((item: SelectorItem) => {
    if (item.disabled) {
      return;
    }
    setSelectedKey(selectorStableKey(selectorType, item.id));
    dispatch?.({ type: 'SET_SELECTED_REF', ref: item.id });
    onSelect?.(item);
    setIsOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  }, [dispatch, onSelect, selectorType]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    dispatch?.({ type: 'CANCEL' });
    onClose?.();
    triggerRef.current?.focus();
  }, [dispatch, onClose]);

  const selectedIndex = projection.selectedIndex >= 0
    ? projection.items.findIndex((item) => item.key === projection.selectedKey)
    : -1;

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const next = keyedItems[Math.min((selectedIndex < 0 ? -1 : keyedItems.findIndex((item) => item.key === selectedKey)) + 1, keyedItems.length - 1)];
        if (next) setSelectedKey(next.key);
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const current = keyedItems.findIndex((item) => item.key === selectedKey);
        const prev = keyedItems[Math.max(current - 1, 0)];
        if (prev) setSelectedKey(prev.key);
        break;
      }
      case 'Enter': {
        event.preventDefault();
        const current = keyedItems.find((item) => item.key === selectedKey) ?? projection.items[0];
        if (current) handleSelect(current);
        break;
      }
      case 'Escape':
        event.preventDefault();
        handleClose();
        break;
      default:
        break;
    }
  }, [handleClose, handleSelect, keyedItems, projection.items, selectedIndex, selectedKey]);

  const activeDescendant = projection.selectedKey ?? undefined;

  return (
    <div className={`command-selector command-selector--${selectorType}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className="command-selector-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${selectorType}-list`}
      >
        {initialValue?.label || placeholder}
      </button>

      {isOpen && (
        <div
          role="dialog"
          className="command-selector-dropdown"
          aria-modal="true"
          aria-label={`Select ${selectorType}`}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Search ${selectorType}s...`}
            aria-label={`Search ${selectorType}s`}
            aria-controls={`${selectorType}-list`}
            aria-activedescendant={activeDescendant}
            autoFocus
          />
          <ul
            id={`${selectorType}-list`}
            role="listbox"
            className="command-selector-list"
            aria-label={`${selectorType} options`}
          >
            {projection.items.length === 0 ? (
              <li role="option" className="command-selector-no-results">
                No {selectorType}s found
              </li>
            ) : (
              projection.items.map((item) => (
                <li
                  key={item.key}
                  id={item.key}
                  role="option"
                  aria-selected={item.key === projection.selectedKey}
                  aria-disabled={item.disabled === true}
                  className={`command-selector-item ${item.key === projection.selectedKey ? 'selected' : ''}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedKey(item.key)}
                >
                  <span className="command-selector-item-label">{item.label}</span>
                  {item.description && (
                    <span className="command-selector-item-description">
                      {item.description}
                    </span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  state,
  dispatch,
  customMessage,
  preview = null,
  receiptCapable = true,
}) => {
  const command = state.selectedCommand;
  const dangerLevel = command?.danger || 'safe';
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const gate = command
    ? evaluateDangerGate({ command, preview, receiptCapable })
    : { allowed: false, staged: true, reason: 'No command selected', grade: 'safe' as const };

  const handleConfirm = useCallback(() => {
    if (!gate.allowed) {
      return;
    }
    dispatch({ type: 'CONFIRM' });
  }, [dispatch, gate.allowed]);

  const handleCancel = useCallback(() => {
    dispatch({ type: 'CANCEL' });
  }, [dispatch]);

  useEffect(() => {
    if (command && dangerLevel !== 'safe') {
      confirmButtonRef.current?.focus();
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          handleCancel();
        } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && gate.allowed) {
          event.preventDefault();
          handleConfirm();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [command, dangerLevel, handleConfirm, handleCancel, gate.allowed]);

  if (!command || dangerLevel === 'safe') {
    return null;
  }

  return (
    <div
      role="dialog"
      className={`confirmation-dialog confirmation-dialog--${dangerLevel}`}
      aria-modal="true"
      aria-labelledby="confirmation-title"
      aria-describedby="confirmation-description"
    >
      <h2 id="confirmation-title" className="confirmation-title">
        Confirm {dangerLevel} action
      </h2>
      <p id="confirmation-description" className="confirmation-message">
        {customMessage || `Are you sure you want to execute "${command.canonicalName}"?`}
      </p>
      {preview && (
        <p className="confirmation-preview">{preview.impactSummary}</p>
      )}
      {!gate.allowed && gate.reason && (
        <p role="status" className="confirmation-blocked">{gate.reason}</p>
      )}
      <div className="confirmation-actions" role="group" aria-label="Confirmation actions">
        <button
          onClick={handleCancel}
          className="confirmation-btn confirmation-btn--cancel"
          aria-label="Cancel this action"
        >
          Cancel (Esc)
        </button>
        <button
          ref={confirmButtonRef}
          onClick={handleConfirm}
          className="confirmation-btn confirmation-btn--confirm"
          aria-label={`Confirm ${dangerLevel} action`}
          disabled={!gate.allowed}
        >
          Confirm (Ctrl+Enter)
        </button>
      </div>
    </div>
  );
};

export const PendingReceipt: React.FC<PendingReceiptProps> = ({
  state,
  receiptStatus,
  dispatch,
}) => {
  const command = state.selectedCommand;
  const status = receiptStatus ?? state.receipt.status;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleDismiss = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  useEffect(() => {
    if (status === 'success') {
      timeoutRef.current = setTimeout(() => {
        handleDismiss();
      }, 5000);
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
    return undefined;
  }, [status, handleDismiss]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || (event.key === 'd' && (event.ctrlKey || event.metaKey))) {
        event.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDismiss]);

  const statusInfo = status === 'success'
    ? { text: 'Completed', aria: 'Command completed successfully' }
    : status === 'rejected'
      ? { text: 'Cancelled', aria: 'Command was cancelled' }
      : status === 'failed'
        ? { text: 'Failed', aria: 'Command execution failed' }
        : status === 'stale'
          ? { text: 'Stale', aria: 'Command expired or was superseded' }
          : { text: 'Pending', aria: 'Command is pending' };

  return (
    <div
      role="status"
      className={`pending-receipt pending-receipt--${status ?? 'pending'}`}
      aria-live="polite"
      aria-atomic="true"
      aria-label={statusInfo.aria}
    >
      {command && (
        <span className="receipt-command" aria-label={`Command: ${command.canonicalName}`}>
          {command.canonicalName}
        </span>
      )}
      <span className="receipt-status" aria-label={`Status: ${statusInfo.text}`}>
        {statusInfo.text}
      </span>
      {state.correlationId && (
        <span className="receipt-correlation">{state.correlationId}</span>
      )}
      <button
        onClick={handleDismiss}
        className="receipt-dismiss"
        aria-label="Dismiss notification (Ctrl+D)"
        title="Dismiss (Ctrl+D)"
      >
        ×
      </button>
    </div>
  );
};
