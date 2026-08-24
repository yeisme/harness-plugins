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
  const { showCategories = true, showDisabledCommands = false } = options;
  const commands: CommandExperienceEntryV1[] = state.selectedCommand ? [state.selectedCommand] : [];
  const draft = state.draft || '';

  const { navigateUp, navigateDown, resetSelection } = useCommandNavigation(
    commands.filter((cmd) => showDisabledCommands || isCommandExecutable(cmd)),
    state.selectedCommand
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
        e.preventDefault();
        navigateDown();
      } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
        e.preventDefault();
        navigateUp();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        dispatch({ type: 'CANCEL' });
        resetSelection();
      }
    };

    if (state.state !== 'idle') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [state.state, navigateUp, navigateDown, dispatch, resetSelection]);

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
    dispatch({
      type: 'SELECT_COMMAND',
      command,
    });
  }, [dispatch]);

  const executeCommand = useCallback(() => {
    dispatch({
      type: 'DISPATCH',
      correlationId: Date.now().toString(),
    });
  }, [dispatch]);

  if (state.state === 'idle' && !draft.startsWith('/')) {
    return null;
  }

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
        {Array.from(categories.entries()).map(([category, cmds]) => (
          <React.Fragment key={category}>
            {showCategories && (
              <li role="presentation" className="command-category">{category}</li>
            )}
            {cmds.map((command) => {
              const isSelected = state.selectedCommand?.canonicalName === command.canonicalName;
              const disabledReason = getCommandDisabledReason(command);

              return (
                <li
                  key={command.canonicalName}
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
    </div>
  );
};

export const CommandSelector: React.FC<CommandSelectorProps> = ({
  selectorType,
  options = {},
}) => {
  const { placeholder = 'Select...' } = options;
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  return (
    <div className={`command-selector command-selector--${selectorType}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="command-selector-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {placeholder}
      </button>

      {isOpen && (
        <div role="dialog" className="command-selector-dropdown" aria-modal="true">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${selectorType}s...`}
            aria-label={`Search ${selectorType}s`}
            autoFocus
          />
          <ul role="listbox" className="command-selector-list">
            {/* Items rendered based on selectorType */}
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
}) => {
  const command = state.selectedCommand;
  const dangerLevel = command?.danger || 'safe';

  const handleConfirm = useCallback(() => {
    dispatch({ type: 'CONFIRM' });
  }, [dispatch]);

  const handleCancel = useCallback(() => {
    dispatch({ type: 'CANCEL' });
  }, [dispatch]);

  if (!command || dangerLevel === 'safe') {
    return null;
  }

  return (
    <div role="dialog" className="confirmation-dialog" aria-modal="true" aria-labelledby="confirmation-title">
      <h2 id="confirmation-title" className="confirmation-title">
        Confirm {dangerLevel} action
      </h2>
      <p className="confirmation-message">
        {customMessage || `Are you sure you want to execute "${command.canonicalName}"?`}
      </p>
      <div className="confirmation-actions">
        <button onClick={handleCancel} className="confirmation-btn confirmation-btn--cancel" autoFocus>
          Cancel
        </button>
        <button onClick={handleConfirm} className="confirmation-btn confirmation-btn--confirm">
          Confirm
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

  const handleDismiss = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  return (
    <div
      role="status"
      className={`pending-receipt pending-receipt--${receiptStatus}`}
      aria-live="polite"
    >
      {command && (
        <span className="receipt-command">{command.canonicalName}</span>
      )}
      <span className="receipt-status">
        {receiptStatus === 'success' && 'Completed'}
        {receiptStatus === 'rejected' && 'Cancelled'}
        {receiptStatus === 'failed' && 'Failed'}
        {receiptStatus === 'stale' && 'Stale'}
      </span>
      <button
        onClick={handleDismiss}
        className="receipt-dismiss"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
};
