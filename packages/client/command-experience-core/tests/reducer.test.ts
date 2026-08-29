/**
 * Reducer tests
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  commandReducer,
  generateCorrelationId,
  canCancel,
  needsConfirmation,
  canDispatch,
  isSuccessfulReceipt,
  isFailedReceipt,
  canRecover,
  getRecoveryState,
  actions,
} from '../src/reducer';

import type { CommandExperienceEntryV1 } from '../src/types';

describe('reducer', () => {
  const mockCommand: CommandExperienceEntryV1 = {
    canonicalName: 'test',
    aliases: [],
    description: 'Test command',
    category: 'test',
    input: {},
    surfaces: ['web'],
    actionKind: 'local',
    owner: 'client',
    danger: 'safe',
    availability: { state: 'available' },
    coverage: 'equivalent',
  };

  const mockDestructiveCommand: CommandExperienceEntryV1 = {
    ...mockCommand,
    canonicalName: 'delete',
    danger: 'destructive',
  };

  const mockSelectorCommand: CommandExperienceEntryV1 = {
    ...mockCommand,
    canonicalName: 'resume',
    input: { selectorKey: 'sessionId' },
  };

  describe('createInitialState', () => {
    it('should create initial state', () => {
      const state = createInitialState();

      expect(state.state).toBe('idle');
      expect(state.query).toBe('');
      expect(state.selectedCommand).toBeNull();
      expect(state.arguments).toEqual({});
      expect(state.selectedRef).toBeNull();
      expect(state.correlationId).toBeNull();
      expect(state.receipt.status).toBeNull();
      expect(state.draft).toBe('');
      expect(state.error).toBeNull();
    });
  });

  describe('generateCorrelationId', () => {
    it('should generate unique correlation IDs', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();

      expect(id1).toMatch(/^cmd-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^cmd-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('START_ASSIST', () => {
    it('should start assist state', () => {
      const state = createInitialState();
      const action = actions.startAssist('/test', 'draft text');

      const nextState = commandReducer(state, action);

      expect(nextState.state).toBe('assist');
      expect(nextState.query).toBe('/test');
      expect(nextState.draft).toBe('draft text');
    });
  });

  describe('SELECT_COMMAND', () => {
    it('should select command', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.startAssist('/test', 'draft'));

      const nextState = commandReducer(state, actions.selectCommand(mockCommand));

      expect(nextState.state).toBe('selected');
      expect(nextState.selectedCommand).toEqual(mockCommand);
      expect(nextState.query).toBe('test');
    });
  });

  describe('SET_ARGUMENTS', () => {
    it('should set arguments', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.selectCommand(mockCommand));

      const args = { foo: 'bar' };
      const nextState = commandReducer(state, actions.setArguments(args));

      expect(nextState.state).toBe('argument');
      expect(nextState.arguments).toEqual(args);
    });
  });

  describe('SET_SELECTED_REF', () => {
    it('should set selected ref', () => {
      let state = createInitialState();
      const ref = 'session-123';

      const nextState = commandReducer(state, actions.setSelectedRef(ref));

      expect(nextState.selectedRef).toBe(ref);
    });
  });

  describe('OPEN_SELECTOR', () => {
    it('should open selector for a selected command', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.selectCommand(mockSelectorCommand));

      const nextState = commandReducer(state, actions.openSelector());

      expect(nextState.state).toBe('selector');
    });
  });

  describe('REQUEST_CONFIRMATION', () => {
    it('should request confirmation for selected command', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.selectCommand(mockDestructiveCommand));

      const nextState = commandReducer(state, actions.requestConfirmation());

      expect(nextState.state).toBe('confirmation');
    });

    it('should error without selected command', () => {
      const state = createInitialState();
      const nextState = commandReducer(state, actions.requestConfirmation());

      expect(nextState.state).toBe('idle');
      expect(nextState.error).toBeTruthy();
    });
  });

  describe('CONFIRM', () => {
    it('should move to dispatching with correlation ID', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.selectCommand(mockDestructiveCommand));
      state = commandReducer(state, actions.requestConfirmation());

      const nextState = commandReducer(state, actions.confirm());

      expect(nextState.state).toBe('dispatching');
      expect(nextState.correlationId).toBeTruthy();
    });
  });

  describe('CANCEL', () => {
    it('should cancel and restore draft', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.startAssist('/test', 'my draft'));

      const nextState = commandReducer(state, actions.cancel());

      expect(nextState.state).toBe('idle');
      expect(nextState.draft).toBe('my draft');
    });
  });

  describe('DISPATCH', () => {
    it('should dispatch with correlation ID', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.selectCommand(mockCommand));

      const correlationId = generateCorrelationId();
      const nextState = commandReducer(state, actions.dispatch(correlationId));

      expect(nextState.state).toBe('dispatching');
      expect(nextState.correlationId).toBe(correlationId);
    });
  });

  describe('RECEIPT', () => {
    it('should handle success receipt', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.selectCommand(mockCommand));
      const correlationId = generateCorrelationId();
      state = commandReducer(state, actions.dispatch(correlationId));

      const nextState = commandReducer(state, actions.receipt('success', correlationId));

      expect(nextState.state).toBe('receipt');
      expect(nextState.receipt.status).toBe('success');
      expect(nextState.receipt.correlationId).toBe(correlationId);
      expect(nextState.draft).toBe(''); // Cleared on success
    });

    it('should ignore stale receipts', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.selectCommand(mockCommand));
      const currentId = generateCorrelationId();
      state = commandReducer(state, actions.dispatch(currentId));

      const staleId = generateCorrelationId();
      const nextState = commandReducer(state, actions.receipt('success', staleId));

      // State should not change - stale receipt ignored
      expect(nextState.state).toBe('dispatching');
      expect(nextState.correlationId).toBe(currentId);
    });

    it('should preserve draft on failure', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.startAssist('/test', 'my draft'));
      state = commandReducer(state, actions.selectCommand(mockCommand));
      const correlationId = generateCorrelationId();
      state = commandReducer(state, actions.dispatch(correlationId));

      const nextState = commandReducer(state, actions.receipt('rejected', correlationId, 'Access denied'));

      expect(nextState.state).toBe('receipt');
      expect(nextState.receipt.status).toBe('rejected');
      expect(nextState.draft).toBe('my draft'); // Preserved on failure
      expect(nextState.receipt.message).toBe('Access denied');
    });
  });

  describe('SET_ERROR', () => {
    it('should set error state', () => {
      const state = createInitialState();
      const nextState = commandReducer(state, actions.setError('Test error'));

      expect(nextState.state).toBe('error');
      expect(nextState.error).toBe('Test error');
    });
  });

  describe('RESET', () => {
    it('should reset to initial state', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.startAssist('/test', 'draft'));
      state = commandReducer(state, actions.selectCommand(mockCommand));

      const nextState = commandReducer(state, actions.reset());

      expect(nextState).toEqual(createInitialState());
    });
  });

  describe('canCancel', () => {
    it('should return true for cancelable states', () => {
      expect(canCancel(createInitialState())).toBe(false); // idle

      let state = createInitialState();
      state = commandReducer(state, actions.startAssist('/test', ''));
      expect(canCancel(state)).toBe(true); // assist
    });
  });

  describe('needsConfirmation', () => {
    it('should return true for dangerous commands', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.selectCommand(mockDestructiveCommand));

      expect(needsConfirmation(state)).toBe(true);
    });

    it('should return false for safe commands', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.selectCommand(mockCommand));

      expect(needsConfirmation(state)).toBe(false);
    });
  });

  describe('canDispatch', () => {
    it('should return true for ready commands', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.selectCommand(mockCommand));

      expect(canDispatch(state)).toBe(true);
    });

    it('should return false for selector commands without ref', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.selectCommand(mockSelectorCommand));

      expect(canDispatch(state)).toBe(false);
    });

    it('should return true when selector ref is set', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.selectCommand(mockSelectorCommand));
      state = commandReducer(state, actions.setSelectedRef('session-123'));

      expect(canDispatch(state)).toBe(true);
    });
  });

  describe('isSuccessfulReceipt', () => {
    it('should return true for success', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.selectCommand(mockCommand));
      const id = generateCorrelationId();
      state = commandReducer(state, actions.dispatch(id));
      state = commandReducer(state, actions.receipt('success', id));

      expect(isSuccessfulReceipt(state)).toBe(true);
    });

    it('should return false for failures', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.selectCommand(mockCommand));
      const id = generateCorrelationId();
      state = commandReducer(state, actions.dispatch(id));
      state = commandReducer(state, actions.receipt('rejected', id));

      expect(isSuccessfulReceipt(state)).toBe(false);
    });
  });

  describe('isFailedReceipt', () => {
    it('should return true for failures', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.selectCommand(mockCommand));
      const id = generateCorrelationId();
      state = commandReducer(state, actions.dispatch(id));
      state = commandReducer(state, actions.receipt('rejected', id));

      expect(isFailedReceipt(state)).toBe(true);
    });
  });

  describe('canRecover', () => {
    it('should return true for receipt states', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.selectCommand(mockCommand));
      const id = generateCorrelationId();
      state = commandReducer(state, actions.dispatch(id));
      state = commandReducer(state, actions.receipt('success', id));

      expect(canRecover(state)).toBe(true);
    });
  });

  describe('getRecoveryState', () => {
    it('should clear state on success', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.startAssist('/test', 'draft'));
      state = commandReducer(state, actions.selectCommand(mockCommand));
      const id = generateCorrelationId();
      state = commandReducer(state, actions.dispatch(id));
      state = commandReducer(state, actions.receipt('success', id));

      const recovered = getRecoveryState(state);

      expect(recovered.state).toBe('idle');
      expect(recovered.draft).toBe('');
      expect(recovered.error).toBeNull();
    });

    it('should preserve draft on failure', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.startAssist('/test', 'my draft'));
      state = commandReducer(state, actions.selectCommand(mockCommand));
      const id = generateCorrelationId();
      state = commandReducer(state, actions.dispatch(id));
      state = commandReducer(state, actions.receipt('rejected', id));

      const recovered = getRecoveryState(state);

      expect(recovered.state).toBe('idle');
      expect(recovered.draft).toBe('my draft');
      expect(recovered.error).toBeTruthy();
    });
  });

  describe('MOVE_SELECTION', () => {
    const keys = ['a', 'b', 'c'];

    it('moves by delta and clamps at both ends', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.moveSelection({ delta: 1 }, keys));
      expect(state.cursorKey).toBe('a');
      expect(state.cursorMoved).toBe(true);

      state = commandReducer(state, actions.moveSelection({ delta: 1 }, keys));
      expect(state.cursorKey).toBe('b');

      state = commandReducer(state, actions.moveSelection({ delta: 5 }, keys));
      expect(state.cursorKey).toBe('c');

      state = commandReducer(state, actions.moveSelection({ delta: -9 }, keys));
      expect(state.cursorKey).toBeNull();
      expect(state.cursorMoved).toBe(false);
    });

    it('jumps to an explicit index', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.moveSelection({ index: 2 }, keys));
      expect(state.cursorKey).toBe('c');
      state = commandReducer(state, actions.moveSelection({ index: 99 }, keys));
      expect(state.cursorKey).toBe('c');
    });

    it('is a no-op without candidates', () => {
      const state = createInitialState();
      const next = commandReducer(state, actions.moveSelection({ delta: 1 }, []));
      expect(next).toBe(state);
    });
  });

  describe('cursor staleness', () => {
    const keys = ['a', 'b'];

    it('clears a vanished cursor on UPDATE_QUERY without snapping to a neighbor', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.moveSelection({ index: 1 }, keys));
      expect(state.cursorKey).toBe('b');

      state = commandReducer(state, { type: 'UPDATE_QUERY', query: '/x', candidateKeys: ['a'] });
      expect(state.cursorKey).toBeNull();
      expect(state.cursorMoved).toBe(false);
    });

    it('keeps a still-valid cursor on UPDATE_QUERY', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.moveSelection({ index: 0 }, keys));
      state = commandReducer(state, { type: 'UPDATE_QUERY', query: '/a', candidateKeys: ['a'] });
      expect(state.cursorKey).toBe('a');
    });

    it('resets the cursor when a command is selected', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.moveSelection({ index: 1 }, keys));
      state = commandReducer(state, actions.selectCommand(mockCommand));
      expect(state.cursorKey).toBeNull();
      expect(state.cursorMoved).toBe(false);
    });

    it('CLEAR_CURSOR drops a stale cursor so auto-select can resume', () => {
      let state = createInitialState();
      state = commandReducer(state, actions.moveSelection({ index: 1 }, ['a', 'b']));
      // Typing path: UPDATE_QUERY carries no candidate keys, so the adapter
      // clears the cursor explicitly once the refiltered list drops the key.
      state = commandReducer(state, { type: 'UPDATE_QUERY', query: '/x' });
      expect(state.cursorKey).toBe('b');
      state = commandReducer(state, actions.clearCursor());
      expect(state.cursorKey).toBeNull();
      expect(state.cursorMoved).toBe(false);
      // Clearing an already-clear cursor is a no-op (same reference).
      const cleared = state;
      expect(commandReducer(state, actions.clearCursor())).toBe(cleared);
    });
  });
});
