/**
 * Command Experience Reducer
 *
 * Pure reducer for command interaction state machine.
 * Shared between Web and TUI to ensure consistent semantics.
 */

import type {
  CommandReducerState,
  CommandReducerAction,
  CommandExperienceEntryV1,
  ReceiptStatus,
} from './types';

/**
 * Initial reducer state
 */
export const createInitialState = (): CommandReducerState => ({
  state: 'idle',
  query: '',
  selectedCommand: null,
  arguments: {},
  selectedRef: null,
  correlationId: null,
  receipt: {
    status: null,
    correlationId: null,
    message: null,
    timestamp: null,
  },
  draft: '',
  selectionStart: null,
  selectionEnd: null,
  error: null,
});

/**
 * Generate correlation ID for dispatch
 */
export function generateCorrelationId(): string {
  return `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Main reducer function
 */
export function commandReducer(
  state: CommandReducerState,
  action: CommandReducerAction
): CommandReducerState {
  switch (action.type) {
    case 'START_ASSIST':
      return {
        ...createInitialState(),
        state: 'assist',
        query: action.query,
        draft: action.draft,
      };

    case 'UPDATE_QUERY':
      return {
        ...state,
        state: state.state === 'selected' ? 'assist' : state.state,
        query: action.query,
        draft: state.state === 'assist' || state.state === 'idle' || state.state === 'selected'
          ? action.query
          : state.draft,
        selectedCommand: state.state === 'assist' || state.state === 'selected'
          ? null
          : state.selectedCommand,
      };

    case 'SELECT_COMMAND':
      return {
        ...state,
        state: 'selected',
        selectedCommand: action.command,
        query: action.command.canonicalName,
        arguments: {},
        selectedRef: null,
        error: null,
      };

    case 'SET_ARGUMENTS':
      return {
        ...state,
        state: 'argument',
        arguments: { ...state.arguments, ...action.args },
        error: null,
      };

    case 'SET_SELECTED_REF':
      return {
        ...state,
        selectedRef: action.ref,
        error: null,
      };

    case 'OPEN_SELECTOR':
      if (!state.selectedCommand) {
        return {
          ...state,
          error: 'Cannot open selector without selected command',
        };
      }
      return {
        ...state,
        state: 'selector',
        error: null,
      };

    case 'REQUEST_CONFIRMATION':
      // Can only request confirmation if we have a command selected
      if (!state.selectedCommand) {
        return {
          ...createInitialState(),
          error: 'Cannot request confirmation without selected command',
          draft: state.draft,
          selectionStart: state.selectionStart,
          selectionEnd: state.selectionEnd,
        };
      }
      return {
        ...state,
        state: 'confirmation',
        error: null,
      };

    case 'CONFIRM':
      // Move to dispatching state
      return {
        ...state,
        state: 'dispatching',
        correlationId: state.correlationId || generateCorrelationId(),
        error: null,
      };

    case 'CANCEL':
      // Restore draft and return to idle
      return {
        ...createInitialState(),
        draft: state.draft,
        selectionStart: state.selectionStart,
        selectionEnd: state.selectionEnd,
      };

    case 'DISPATCH':
      return {
        ...state,
        state: 'dispatching',
        correlationId: action.correlationId,
        error: null,
      };

    case 'RECEIPT': {
      // Check if this receipt matches our current dispatch
      if (state.correlationId !== action.correlationId) {
        // Stale receipt, ignore
        return state;
      }

      const newState: CommandReducerState = {
        ...state,
        state: 'receipt',
        receipt: {
          status: action.status,
          correlationId: action.correlationId,
          message: action.message ?? null,
          timestamp: Date.now(),
        },
      };

      // On success, clear the draft as command completed
      if (action.status === 'success') {
        newState.draft = '';
        newState.selectedCommand = null;
        newState.arguments = {};
        newState.selectedRef = null;
      }

      return newState;
    }

    case 'SET_ERROR':
      return {
        ...state,
        state: 'error',
        error: action.error,
      };

    case 'RESET':
      return createInitialState();

    default:
      return state;
  }
}

/**
 * Check if state allows cancellation
 */
export function canCancel(state: CommandReducerState): boolean {
  return (
    state.state === 'assist' ||
    state.state === 'selected' ||
    state.state === 'argument' ||
    state.state === 'selector' ||
    state.state === 'confirmation' ||
    state.state === 'error'
  );
}

/**
 * Check if state requires confirmation
 */
export function needsConfirmation(state: CommandReducerState): boolean {
  if (!state.selectedCommand) return false;
  return (
    state.selectedCommand.danger === 'confirm' ||
    state.selectedCommand.danger === 'destructive'
  );
}

/**
 * Check if command is ready to dispatch
 */
export function canDispatch(state: CommandReducerState): boolean {
  if (!state.selectedCommand) return false;

  // Check if command requires selector ref
  if (state.selectedCommand.input.selectorKey && !state.selectedRef) {
    return false;
  }

  // Check if command requires arguments
  if (state.selectedCommand.input.schemaKey && Object.keys(state.arguments).length === 0) {
    return false;
  }

  return true;
}

/**
 * Check if receipt indicates success
 */
export function isSuccessfulReceipt(state: CommandReducerState): boolean {
  return state.receipt.status === 'success';
}

/**
 * Check if receipt indicates failure (rejected, failed, or stale)
 */
export function isFailedReceipt(state: CommandReducerState): boolean {
  return (
    state.receipt.status === 'rejected' ||
    state.receipt.status === 'failed' ||
    state.receipt.status === 'stale'
  );
}

/**
 * Check if we can return to editing from current state
 */
export function canRecover(state: CommandReducerState): boolean {
  return (
    state.state === 'receipt' ||
    state.state === 'error'
  );
}

/**
 * Get next state after recovery
 */
export function getRecoveryState(state: CommandReducerState): CommandReducerState {
  // On successful receipt, clear everything
  if (state.receipt.status === 'success') {
    return createInitialState();
  }

  // On failure, restore draft for retry
  const errorMessage = state.receipt.message || state.error || 'Command failed';
  return {
    ...createInitialState(),
    draft: state.draft,
    selectionStart: state.selectionStart,
    selectionEnd: state.selectionEnd,
    error: errorMessage,
  };
}

/**
 * Create action creators
 */
export const actions = {
  startAssist: (query: string, draft: string): CommandReducerAction => ({
    type: 'START_ASSIST',
    query,
    draft,
  }),

  updateQuery: (query: string): CommandReducerAction => ({
    type: 'UPDATE_QUERY',
    query,
  }),

  selectCommand: (command: CommandExperienceEntryV1): CommandReducerAction => ({
    type: 'SELECT_COMMAND',
    command,
  }),

  setArguments: (args: Record<string, unknown>): CommandReducerAction => ({
    type: 'SET_ARGUMENTS',
    args,
  }),

  setSelectedRef: (ref: string | null): CommandReducerAction => ({
    type: 'SET_SELECTED_REF',
    ref,
  }),

  openSelector: (): CommandReducerAction => ({
    type: 'OPEN_SELECTOR',
  }),

  requestConfirmation: (): CommandReducerAction => ({
    type: 'REQUEST_CONFIRMATION',
  }),

  confirm: (): CommandReducerAction => ({
    type: 'CONFIRM',
  }),

  cancel: (): CommandReducerAction => ({
    type: 'CANCEL',
  }),

  dispatch: (correlationId: string): CommandReducerAction => ({
    type: 'DISPATCH',
    correlationId,
  }),

  receipt: (
    status: ReceiptStatus,
    correlationId: string,
    message: string | null = null
  ): CommandReducerAction => ({
    type: 'RECEIPT',
    status,
    correlationId,
    message,
  }),

  setError: (error: string): CommandReducerAction => ({
    type: 'SET_ERROR',
    error,
  }),

  reset: (): CommandReducerAction => ({
    type: 'RESET',
  }),
};
