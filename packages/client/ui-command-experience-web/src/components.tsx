/**
 * Command Experience Web Components
 *
 * Consume the shared directory + reducer. No DOM patching.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Button, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import {
  Surface,
  SurfaceActionBar,
  SurfaceContextBar,
  SurfaceState,
} from '@yeisme/dsh-client-ui-surface';
import type {
  CommandExperienceEntryV1,
  CommandReducerState,
} from '@yeisme/dsh-client-ui-command-experience-core';
import {
  commandStableKey,
  createInitialState,
  evaluateDangerGate,
  generateCorrelationId,
  groupByCategory,
  isCommandExecutable,
  projectBoundedWindow,
  resolveKeyAction,
  resolveKeymap,
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
import { commandKeyEventFromDom } from './hooks';
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
  const composerRestoreRef = useRef<HTMLButtonElement>(null);
  const query = state.draft || state.query || '';
  const resolution = useMemo(() => resolveAssistQuery(commands, query || '/'), [commands, query]);
  const visibleCommands = useMemo(
    () => resolution.candidates.filter((command) => showDisabledCommands || isCommandExecutable(command)),
    [resolution.candidates, showDisabledCommands],
  );

  const keymap = useMemo(
    () => resolveKeymap(options.keyboardShortcuts),
    [options.keyboardShortcuts],
  );
  const candidateKeys = useMemo(
    () => visibleCommands.map((command) => commandStableKey(command.canonicalName)),
    [visibleCommands],
  );
  const cursorCommand = useMemo(() => {
    if (state.cursorKey === null) {
      return null;
    }
    return visibleCommands.find(
      (command) => commandStableKey(command.canonicalName) === state.cursorKey,
    ) ?? null;
  }, [state.cursorKey, visibleCommands]);

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

  const restoreFocus = useCallback(() => {
    onRestoreFocus?.();
    composerRestoreRef.current?.focus();
  }, [onRestoreFocus]);

  // Stale cursor policy: typing refilters the candidate list after dispatch,
  // so a cursor key that no longer resolves is dropped here — never snapped
  // to a neighbor — letting auto-select resume on the next resolution.
  useEffect(() => {
    if (state.cursorKey !== null && !candidateKeys.includes(state.cursorKey)) {
      dispatch({ type: 'CLEAR_CURSOR' });
    }
  }, [candidateKeys, state.cursorKey, dispatch]);

  // Auto-select the exact/safe-unique match unless the keyboard cursor has
  // moved elsewhere: the cursor outranks discovery's implicit selection.
  useEffect(() => {
    if (!resolution.selected || state.state !== 'assist') {
      return;
    }
    const selectedKey = commandStableKey(resolution.selected.canonicalName);
    if (state.cursorMoved && state.cursorKey !== selectedKey) {
      return;
    }
    dispatch({ type: 'SELECT_COMMAND', command: resolution.selected });
  }, [resolution.selected, state.state, state.cursorMoved, state.cursorKey, dispatch]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (state.state === 'idle' && !query.startsWith('/')) {
        // Palette toggle still opens the menu from idle.
        const toggle = resolveKeyAction({
          event: commandKeyEventFromDom(event),
          state,
          config: keymap,
          context: { candidateKeys, commands: visibleCommands },
        });
        if (toggle.kind === 'toggle') {
          event.preventDefault();
          dispatch({ type: 'START_ASSIST', query: '/', draft: '/' });
        }
        return;
      }

      const resolutionAction = resolveKeyAction({
        event: commandKeyEventFromDom(event),
        state,
        config: keymap,
        context: { candidateKeys, commands: visibleCommands },
      });

      if (resolutionAction.kind === 'action') {
        const action = resolutionAction.action;
        if (action.type === 'MOVE_SELECTION' || action.type === 'UPDATE_QUERY') {
          event.preventDefault();
          dispatch(action.type === 'UPDATE_QUERY'
            ? { type: 'UPDATE_QUERY', query: action.query, candidateKeys }
            : action);
          return;
        }
        if (action.type === 'CANCEL') {
          event.preventDefault();
          dispatch(action);
          restoreFocus();
          return;
        }
        dispatch(action);
        return;
      }

      if (resolutionAction.kind === 'toggle') {
        event.preventDefault();
        dispatch({ type: 'CANCEL' });
        restoreFocus();
        return;
      }

      if (resolutionAction.kind === 'execute-cursor') {
        event.preventDefault();
        executeSelected(cursorCommand ?? resolution.selected ?? state.selectedCommand);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    state,
    query,
    keymap,
    candidateKeys,
    visibleCommands,
    cursorCommand,
    resolution.selected,
    executeSelected,
    restoreFocus,
  ]);

  if (state.state === 'idle' && !state.draft.startsWith('/') && !query.startsWith('/')) {
    return null;
  }

  const activeCommand = cursorCommand ?? resolution.selected ?? state.selectedCommand;
  const activeDescendant = activeCommand ? commandStableKey(activeCommand.canonicalName) : undefined;

  return (
    <Modal open onClose={() => { dispatch({ type: 'CANCEL' }); restoreFocus(); }} title="Command Menu" headless>
      <Surface kind="dialog" className={`command-menu ${className}`} aria-label="Command Menu">
      <button
        ref={composerRestoreRef}
        type="button"
        className="command-menu-focus-restore"
        aria-label="Restore composer focus"
        tabIndex={-1}
      />
      <SurfaceContextBar title="Command Menu" description="Search and run an available command." />
      <div className="ys-body">
      <Input
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

      <div className="command-menu-announcer" role="status" aria-live="polite">
        {activeCommand ? `/${activeCommand.canonicalName}` : ''}
      </div>

      <ul id="command-list" role="listbox" className="command-list ys-list" aria-label="Available commands">
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
                  onMouseEnter={() => dispatch({
                    type: 'MOVE_SELECTION',
                    index: candidateKeys.indexOf(commandStableKey(command.canonicalName)),
                    candidateKeys,
                  })}
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
      </Surface>
    </Modal>
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
  const keymap = useMemo(
    () => resolveKeymap(options.keyboardShortcuts),
    [options.keyboardShortcuts],
  );
  const [isOpen, setIsOpen] = React.useState(state?.state === 'selector');
  const [query, setQuery] = React.useState('');
  const [selectedKey, setSelectedKey] = React.useState<string | null>(
    state?.selectedRef ? selectorStableKey(selectorType, state.selectedRef) : initialValue ? selectorStableKey(selectorType, initialValue.id) : null,
  );
  const triggerRef = useRef<HTMLDivElement>(null);

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
    triggerRef.current?.querySelector('button')?.focus();
  }, [dispatch, onSelect, selectorType]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    dispatch?.({ type: 'CANCEL' });
    onClose?.();
    triggerRef.current?.querySelector('button')?.focus();
  }, [dispatch, onClose]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const selectorState: CommandReducerState = { ...createInitialState(), state: 'selector' };
    const keys = keyedItems.map((item) => item.key);
    const resolution = resolveKeyAction({
      event: commandKeyEventFromDom(event.nativeEvent),
      state: selectorState,
      config: keymap,
      context: { candidateKeys: keys, commands: [] },
    });

    if (resolution.kind === 'action') {
      const action = resolution.action;
      if (action.type === 'MOVE_SELECTION') {
        event.preventDefault();
        const currentIdx = selectedKey === null ? -1 : keys.indexOf(selectedKey);
        let nextIdx: number;
        if (action.index !== undefined) {
          nextIdx = Math.max(0, Math.min(action.index, keys.length - 1));
        } else {
          nextIdx = Math.max(-1, Math.min(currentIdx + (action.delta ?? 0), keys.length - 1));
        }
        const next = nextIdx >= 0 ? keyedItems[nextIdx] : undefined;
        if (next) {
          setSelectedKey(next.key);
        }
        return;
      }
      if (action.type === 'CANCEL') {
        event.preventDefault();
        handleClose();
        return;
      }
      return;
    }

    if (resolution.kind === 'execute-cursor') {
      event.preventDefault();
      const current = keyedItems.find((item) => item.key === selectedKey) ?? projection.items[0];
      if (current) handleSelect(current);
    }
  }, [handleClose, handleSelect, keyedItems, projection.items, selectedKey, keymap]);

  const activeDescendant = projection.selectedKey ?? undefined;

  return (
    <Surface kind="micro" className={`command-selector command-selector--${selectorType}`}>
      <div ref={triggerRef}>
      <Button
        type="button"
        onClick={() => setIsOpen(true)}
        className="command-selector-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${selectorType}-list`}
      >
        {initialValue?.label || placeholder}
      </Button>
      </div>

      <Modal open={isOpen} onClose={handleClose} title={`Select ${selectorType}`} headless>
        <Surface kind="dialog" className="command-selector-dropdown" aria-label={`Select ${selectorType}`}>
          <SurfaceContextBar title={`Select ${selectorType}`} />
          <div className="ys-body">
          <Input
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
        </Surface>
      </Modal>
    </Surface>
  );
};

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  state,
  dispatch,
  customMessage,
  preview = null,
  receiptCapable = true,
  keyboardShortcuts,
}) => {
  const command = state.selectedCommand;
  const dangerLevel = command?.danger || 'safe';
  const keymap = useMemo(() => resolveKeymap(keyboardShortcuts), [keyboardShortcuts]);
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
      const handleKeyDown = (event: KeyboardEvent) => {
        const resolution = resolveKeyAction({
          event: commandKeyEventFromDom(event),
          state,
          config: keymap,
          context: { candidateKeys: [], commands: [] },
        });
        if (resolution.kind !== 'action') {
          return;
        }
        if (resolution.action.type === 'CANCEL') {
          event.preventDefault();
          handleCancel();
        } else if (resolution.action.type === 'CONFIRM' && gate.allowed) {
          event.preventDefault();
          handleConfirm();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [command, dangerLevel, handleConfirm, handleCancel, gate.allowed, state, keymap]);

  if (!command || dangerLevel === 'safe') {
    return null;
  }

  return (
    <Modal open onClose={handleCancel} title={`Confirm ${dangerLevel} action`} headless>
      <Surface kind="dialog" className={`confirmation-dialog confirmation-dialog--${dangerLevel}`}>
      <SurfaceContextBar title={`Confirm ${dangerLevel} action`} />
      <div className="ys-body">
      <p className="confirmation-message">{customMessage || `Are you sure you want to execute "${command.canonicalName}"?`}</p>
      {preview && (
        <p className="confirmation-preview">{preview.impactSummary}</p>
      )}
      {!gate.allowed && gate.reason && (
        <SurfaceState phase="disabled" title="Action unavailable" description={gate.reason} />
      )}
      </div>
      <SurfaceActionBar className="confirmation-actions" role="group" aria-label="Confirmation actions">
        <Button
          onClick={handleCancel}
          className="confirmation-btn confirmation-btn--cancel"
          aria-label="Cancel this action"
        >
          Cancel (Esc)
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirm}
          className="confirmation-btn confirmation-btn--confirm"
          aria-label={`Confirm ${dangerLevel} action`}
          disabled={!gate.allowed}
        >
          Confirm (Ctrl+Enter)
        </Button>
      </SurfaceActionBar>
      </Surface>
    </Modal>
  );
};

export const PendingReceipt: React.FC<PendingReceiptProps> = ({
  state,
  receiptStatus,
  dispatch,
  keyboardShortcuts,
}) => {
  const command = state.selectedCommand;
  const status = receiptStatus ?? state.receipt.status;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const keymap = useMemo(() => resolveKeymap(keyboardShortcuts), [keyboardShortcuts]);

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
      const resolution = resolveKeyAction({
        event: commandKeyEventFromDom(event),
        state,
        config: keymap,
        context: { candidateKeys: [], commands: [] },
      });
      if (resolution.kind === 'close-receipt') {
        event.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDismiss, state, keymap]);

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
    <Surface
      kind="micro"
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
      <Button
        onClick={handleDismiss}
        className="receipt-dismiss"
        aria-label="Dismiss notification (Ctrl+D)"
        title="Dismiss (Ctrl+D)"
      >
        ×
      </Button>
    </Surface>
  );
};
