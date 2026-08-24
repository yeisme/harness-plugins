/**
 * Command Experience Web Components
 *
 * React components for command menu, selectors, and dialogs.
 */

import React, { useCallback, useEffect } from 'react';
import type {
  CommandMenuProps,
  CommandSelectorProps,
  ConfirmationDialogProps,
  PendingReceiptProps,
} from './types';
import type { CommandExperienceEntryV1 } from '@yeisme/dsh-client-ui-command-experience-core';
import { useCommandNavigation } from './hooks';
import { getCommandAccessibilityLabel, getCommandDisabledReason } from './utils';

const isCommandExecutable = (cmd: CommandExperienceEntryV1) => {
  return cmd.availability.state === 'available' || cmd.availability.state === 'hidden';
};

export const CommandMenu: React.FC<CommandMenuProps> = ({
  state,
  dispatch,
  options = {},
  className = '',
}) => {
  const {
    showCategories = true,
    showDisabledCommands = false,
    maxCommandsWithoutVirtualization = 100,
  } = options;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const commands: CommandExperienceEntryV1[] = state.selectedCommand ? [state.selectedCommand] : [];
  const draft = state.draft || '';

  // Stable key generation for virtualization
  const getCommandKey = useCallback((cmd: CommandExperienceEntryV1) => {
    return `cmd-${cmd.canonicalName}-${cmd.owner}-${cmd.coverage}`;
  }, []);

  const { navigateUp, navigateDown, resetSelection, navigateToCommand } = useCommandNavigation(
    commands.filter((cmd) => showDisabledCommands || isCommandExecutable(cmd)),
    state.selectedCommand,
    getCommandKey
  );

  const executeCommand = useCallback(() => {
    dispatch({
      type: 'DISPATCH',
      correlationId: Date.now().toString(),
    });
  }, [dispatch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Ctrl/Meta+Enter for execution first (highest priority)
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        executeCommand();
        return;
      }

      // Handle Escape for cancellation
      if (e.key === 'Escape') {
        e.preventDefault();
        dispatch({ type: 'CANCEL' });
        resetSelection();
        // Focus restoration happens in reducer
        return;
      }

      // Handle navigation
      if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
        e.preventDefault();
        navigateDown();
      } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
        e.preventDefault();
        navigateUp();
      }
    };

    if (state.state !== 'idle') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [state.state, navigateUp, navigateDown, dispatch, resetSelection, executeCommand]);

  const categories = React.useMemo(() => {
    const grouped = new Map<string, CommandExperienceEntryV1[]>();
    for (const command of commands) {
      if (!showDisabledCommands && !isCommandExecutable(command)) continue;
      const category = command.category || 'other';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(command);
    }
    return grouped;
  }, [commands, showDisabledCommands]);

  const selectCommand = useCallback((command: CommandExperienceEntryV1) => {
    navigateToCommand(command);
    dispatch({
      type: 'SELECT_COMMAND',
      command,
    });
  }, [dispatch, navigateToCommand]);

  // Focus restoration when menu closes
  useEffect(() => {
    if (state.state === 'idle' && draft.startsWith('/')) {
      inputRef.current?.focus();
    }
  }, [state.state, draft]);

  if (state.state === 'idle' && !draft.startsWith('/')) {
    return null;
  }

  // Bounded projection for large command lists
  const shouldUseVirtualization = commands.length > maxCommandsWithoutVirtualization;

  // Create bounded projection (show first 50 + last 10 for very large lists)
  const createBoundedProjection = useCallback((allCategories: Map<string, CommandExperienceEntryV1[]>) => {
    if (!shouldUseVirtualization) {
      return Array.from(allCategories.entries());
    }

    const boundedCategories = new Map<string, CommandExperienceEntryV1[]>();
    let totalShown = 0;
    const maxVisible = 60; // First 50 + last 10

    for (const [category, cmds] of allCategories.entries()) {
      if (totalShown >= maxVisible) break;

      const remaining = maxVisible - totalShown;
      const boundedCmds = cmds.slice(0, remaining);
      boundedCategories.set(category, boundedCmds);
      totalShown += boundedCmds.length;
    }

    return Array.from(boundedCategories.entries());
  }, [shouldUseVirtualization]);

  const visibleCategories = createBoundedProjection(categories);

  return (
    <div className={`command-menu ${className}`} role="dialog" aria-label="Command Menu" aria-modal="true">
      <input
        type="text"
        value={draft}
        onChange={(e) => dispatch({
          type: 'UPDATE_QUERY',
          query: e.target.value,
        })}
        placeholder="Type a command or search..."
        className="command-menu-input"
        aria-label="Command input"
        aria-autocomplete="list"
        aria-controls="command-list"
        autoFocus
      />

      <ul id="command-list" role="listbox" className="command-list" aria-label="Available commands">
        {visibleCategories.map(([category, cmds]) => (
          <React.Fragment key={category}>
            {showCategories && (
              <li role="presentation" className="command-category">{category}</li>
            )}
            {cmds.map((command) => {
              const isSelected = state.selectedCommand?.canonicalName === command.canonicalName;
              const disabledReason = getCommandDisabledReason(command);

              return (
                <li
                  key={getCommandKey(command)}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={!isCommandExecutable(command)}
                  className={`command-item ${isSelected ? 'selected' : ''} ${disabledReason ? 'disabled' : ''}`}
                  onClick={() => isCommandExecutable(command) && executeCommand()}
                  onMouseEnter={() => selectCommand(command)}
                  aria-label={getCommandAccessibilityLabel(command)}
                >
                  <span className="command-canonical">{command.canonicalName}</span>
                  <span className="command-description">{command.description}</span>
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
      {shouldUseVirtualization && (
        <div className="command-menu-footer" role="status" aria-live="polite">
          Showing {visibleCategories.reduce((sum, [, cmds]) => sum + cmds.length, 0)} of {commands.length} commands
        </div>
      )}
    </div>
  );
};

export const CommandSelector: React.FC<CommandSelectorProps> = ({
  selectorType,
  options = {},
  items = [],
  onSelect,
  onClose,
  initialValue,
}) => {
  const { placeholder = 'Select...' } = options;
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const listRef = React.useRef<HTMLUListElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const filteredItems = React.useMemo(() => {
    if (!query) return items;
    const lowerQuery = query.toLowerCase();
    return items.filter(item =>
      item.label.toLowerCase().includes(lowerQuery) ||
      item.description?.toLowerCase().includes(lowerQuery)
    );
  }, [items, query]);

  const handleSelect = useCallback((item: typeof items[number]) => {
    onSelect?.(item);
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(-1);
    triggerRef.current?.focus();
  }, [onSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredItems.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filteredItems[selectedIndex]) {
          handleSelect(filteredItems[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        onClose?.();
        triggerRef.current?.focus();
        break;
      case 'Tab':
        if (isOpen) {
          e.preventDefault();
        }
        break;
    }
  }, [filteredItems, selectedIndex, handleSelect, isOpen, onClose]);

  const activeDescendant = selectedIndex >= 0 && filteredItems[selectedIndex]
    ? filteredItems[selectedIndex].id
    : undefined;

  return (
    <div className={`command-selector command-selector--${selectorType}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
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
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Search ${selectorType}s...`}
            aria-label={`Search ${selectorType}s`}
            aria-controls={`${selectorType}-list`}
            aria-activedescendant={activeDescendant}
            autoFocus
          />
          <ul
            ref={listRef}
            id={`${selectorType}-list`}
            role="listbox"
            className="command-selector-list"
            aria-label={`${selectorType} options`}
          >
            {filteredItems.length === 0 ? (
              <li role="option" className="command-selector-no-results">
                No {selectorType}s found
              </li>
            ) : (
              filteredItems.map((item, index) => (
                <li
                  key={item.id}
                  id={item.id}
                  role="option"
                  aria-selected={selectedIndex === index}
                  className={`command-selector-item ${selectedIndex === index ? 'selected' : ''}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
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
  ownerPreview,
}) => {
  const command = state.selectedCommand;
  const dangerLevel = command?.danger || 'safe';
  const confirmButtonRef = React.useRef<HTMLButtonElement>(null);

  const handleConfirm = useCallback(() => {
    // Check if owner preview is required for dangerous commands
    if (dangerLevel === 'destructive' && !ownerPreview) {
      // Do not allow destructive actions without owner preview
      // Just return without dispatching - the command stays in confirmation state
      return;
    }
    dispatch({ type: 'CONFIRM' });
  }, [dispatch, dangerLevel, ownerPreview]);

  const handleCancel = useCallback(() => {
    dispatch({ type: 'CANCEL' });
  }, [dispatch]);

  // Focus trap and restoration
  React.useEffect(() => {
    if (command && dangerLevel !== 'safe') {
      // Focus confirm button by default
      confirmButtonRef.current?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          handleConfirm();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [command, dangerLevel, handleConfirm, handleCancel]);

  if (!command || dangerLevel === 'safe') {
    return null;
  }

  // Check if destructive action lacks required owner preview
  const missingPreview = dangerLevel === 'destructive' && !ownerPreview;
  const isDisabled = missingPreview;

  const dangerColors = {
    confirm: 'border-yellow-500',
    destructive: 'border-red-500',
    safe: 'border-gray-500',
  };

  const dangerIcons = {
    confirm: '⚠️',
    destructive: '🔴',
    safe: '',
  };

  return (
    <div
      role="dialog"
      className={`confirmation-dialog ${dangerColors[dangerLevel]} ${isDisabled ? 'confirmation-dialog--disabled' : ''}`}
      aria-modal="true"
      aria-labelledby="confirmation-title"
      aria-describedby="confirmation-description"
    >
      <h2 id="confirmation-title" className="confirmation-title">
        {dangerIcons[dangerLevel]} Confirm {dangerLevel} action
      </h2>

      {missingPreview && (
        <div className="confirmation-warning" role="alert" aria-live="assertive">
          ⚠️ This destructive action requires owner preview to proceed safely.
          The command has been staged and disabled until preview information is available.
        </div>
      )}

      <p id="confirmation-description" className="confirmation-message">
        {customMessage || `Are you sure you want to execute "${command.canonicalName}"?`}
      </p>

      {ownerPreview && (
        <div className="confirmation-preview" role="region" aria-label="Owner preview">
          <h3 className="confirmation-preview-title">{ownerPreview.title}</h3>
          <p className="confirmation-preview-description">{ownerPreview.description}</p>

          {ownerPreview.scope && ownerPreview.scope.length > 0 && (
            <div className="confirmation-preview-scope">
              <strong>Scope:</strong>
              <ul className="confirmation-preview-scope-list">
                {ownerPreview.scope.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="confirmation-preview-meta">
            <span className={`confirmation-preview-reversible ${ownerPreview.reversible ? 'reversible' : 'irreversible'}`}>
              {ownerPreview.reversible ? '✓ Reversible' : '⚠️ Irreversible'}
            </span>
            {ownerPreview.estimatedDuration && (
              <span className="confirmation-preview-duration">
                Est. time: {ownerPreview.estimatedDuration}
              </span>
            )}
          </div>
        </div>
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
          disabled={isDisabled}
          className={`confirmation-btn confirmation-btn--confirm ${isDisabled ? 'confirmation-btn--disabled' : ''}`}
          aria-label={`Confirm ${dangerLevel} action${isDisabled ? ' (disabled - requires owner preview)' : ''}`}
        >
          {isDisabled ? 'Disabled (No Preview)' : `Confirm (Ctrl+Enter)`}
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
  const timeoutRef = React.useRef<NodeJS.Timeout>();

  const handleDismiss = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  // Auto-dismiss after 5 seconds for successful receipts
  React.useEffect(() => {
    if (receiptStatus === 'success') {
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
  }, [receiptStatus, handleDismiss]);

  // Keyboard shortcut to dismiss
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.key === 'd' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        handleDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDismiss]);

  const getStatusMessage = () => {
    switch (receiptStatus) {
      case 'success':
        return { text: 'Completed', aria: 'Command completed successfully' };
      case 'rejected':
        return { text: 'Cancelled', aria: 'Command was cancelled' };
      case 'failed':
        return { text: 'Failed', aria: 'Command execution failed' };
      case 'stale':
        return { text: 'Stale', aria: 'Command expired or was superseded' };
      default:
        return { text: 'Unknown', aria: 'Unknown status' };
    }
  };

  const statusInfo = getStatusMessage();

  return (
    <div
      role="status"
      className={`pending-receipt pending-receipt--${receiptStatus}`}
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
