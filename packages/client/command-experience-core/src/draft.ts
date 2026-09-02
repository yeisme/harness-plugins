/**
 * CommandDraftV1: UI composition state for structured command entry.
 *
 * Additive over the existing commandReducer. Draft never persists raw args,
 * credentials, private paths, or owner payloads. Escape is layered.
 */

import type { CommandDanger, CommandExperienceEntryV1, ReceiptStatus } from './types';
import { canDispatch, generateCorrelationId } from './reducer';
import { isCommandExecutable } from './directory';

export type CommandDraftStep =
  | 'idle'
  | 'assist'
  | 'selected'
  | 'argument'
  | 'selector'
  | 'confirmation-inline'
  | 'confirmation-blocking'
  | 'dispatching'
  | 'receipt-pending'
  | 'receipt-success'
  | 'receipt-error';

export interface CommandDraftV1 {
  readonly step: CommandDraftStep;
  readonly canonicalName: string | null;
  readonly query: string;
  readonly visibleDraft: string;
  readonly originalDraft: string;
  readonly selectedRef: string | null;
  readonly argumentText: string;
  readonly confirmationGrade: CommandDanger | null;
  readonly correlationId: string | null;
  readonly receiptStatus: ReceiptStatus | 'pending' | null;
  readonly receiptMessage: string | null;
  readonly nestedSelectorOpen: boolean;
}

export type CommandDraftEvent =
  | { readonly type: 'START_ASSIST'; readonly query: string; readonly originalDraft: string }
  | { readonly type: 'UPDATE_QUERY'; readonly query: string }
  | { readonly type: 'SELECT'; readonly command: CommandExperienceEntryV1 }
  | { readonly type: 'OPEN_SELECTOR' }
  | { readonly type: 'SET_REF'; readonly ref: string | null }
  | { readonly type: 'SET_ARGUMENT'; readonly text: string }
  | { readonly type: 'REQUEST_CONFIRM' }
  | { readonly type: 'ENTER' }
  | { readonly type: 'CONFIRM' }
  | { readonly type: 'ESCAPE' }
  | { readonly type: 'DISPATCH'; readonly correlationId?: string }
  | { readonly type: 'RECEIPT'; readonly status: ReceiptStatus; readonly correlationId: string; readonly message?: string | null }
  | { readonly type: 'RESET' };

export const createInitialDraft = (): CommandDraftV1 => ({
  step: 'idle',
  canonicalName: null,
  query: '',
  visibleDraft: '',
  originalDraft: '',
  selectedRef: null,
  argumentText: '',
  confirmationGrade: null,
  correlationId: null,
  receiptStatus: null,
  receiptMessage: null,
  nestedSelectorOpen: false,
});

function confirmationStep(danger: CommandDanger): CommandDraftStep {
  return danger === 'destructive' ? 'confirmation-blocking' : 'confirmation-inline';
}

function nextAfterSelect(command: CommandExperienceEntryV1): CommandDraftStep {
  if (command.input.selectorKey) {
    return 'selector';
  }
  if (command.input.schemaKey || command.input.hint) {
    return 'argument';
  }
  if (command.danger !== 'safe') {
    return confirmationStep(command.danger);
  }
  return 'selected';
}

function restoreOriginal(draft: CommandDraftV1): CommandDraftV1 {
  return {
    ...createInitialDraft(),
    visibleDraft: draft.originalDraft,
    originalDraft: draft.originalDraft,
  };
}

function selectedShell(draft: CommandDraftV1, command: CommandExperienceEntryV1): CommandDraftV1 {
  return {
    ...draft,
    step: 'selected',
    canonicalName: command.canonicalName,
    query: command.canonicalName,
    visibleDraft: `/${command.canonicalName}`,
    selectedRef: null,
    argumentText: '',
    confirmationGrade: command.danger === 'safe' ? null : command.danger,
    nestedSelectorOpen: false,
    receiptStatus: null,
    receiptMessage: null,
  };
}

export function commandDraftReducer(
  draft: CommandDraftV1,
  event: CommandDraftEvent,
): CommandDraftV1 {
  switch (event.type) {
    case 'START_ASSIST':
      return {
        ...createInitialDraft(),
        step: 'assist',
        query: event.query,
        visibleDraft: event.query,
        originalDraft: event.originalDraft,
      };

    case 'UPDATE_QUERY':
      if (draft.step !== 'assist' && draft.step !== 'idle' && draft.step !== 'selected') {
        return draft;
      }
      return {
        ...draft,
        step: 'assist',
        query: event.query,
        visibleDraft: event.query,
        canonicalName: null,
        selectedRef: null,
      };

    case 'SELECT': {
      if (!isCommandExecutable(event.command)) {
        return {
          ...draft,
          step: 'assist',
          query: event.command.canonicalName,
          visibleDraft: `/${event.command.canonicalName}`,
          canonicalName: null,
        };
      }
      const step = nextAfterSelect(event.command);
      return {
        ...selectedShell(draft, event.command),
        step,
        nestedSelectorOpen: step === 'selector',
        confirmationGrade: event.command.danger === 'safe' ? null : event.command.danger,
      };
    }

    case 'OPEN_SELECTOR':
      if (draft.canonicalName === null) {
        return draft;
      }
      return {
        ...draft,
        step: 'selector',
        nestedSelectorOpen: true,
      };

    case 'SET_REF':
      return {
        ...draft,
        selectedRef: event.ref,
        nestedSelectorOpen: event.ref === null ? draft.nestedSelectorOpen : false,
        step: draft.step === 'selector' && event.ref !== null ? 'selected' : draft.step,
      };

    case 'SET_ARGUMENT':
      return {
        ...draft,
        step: 'argument',
        argumentText: event.text,
        visibleDraft: draft.canonicalName === null
          ? event.text
          : `/${draft.canonicalName} ${event.text}`.trimEnd(),
      };

    case 'REQUEST_CONFIRM':
      if (draft.canonicalName === null || draft.confirmationGrade === null) {
        return draft;
      }
      return {
        ...draft,
        step: confirmationStep(draft.confirmationGrade),
      };

    case 'ENTER':
      return applyEnter(draft);

    case 'CONFIRM':
      return applyConfirm(draft);

    case 'ESCAPE':
      return applyEscape(draft);

    case 'DISPATCH': {
      if (draft.step === 'dispatching' || draft.receiptStatus === 'pending') {
        return draft;
      }
      if (
        draft.confirmationGrade !== null &&
        draft.step !== 'confirmation-inline' &&
        draft.step !== 'confirmation-blocking'
      ) {
        return draft;
      }
      return {
        ...draft,
        step: 'dispatching',
        correlationId: event.correlationId ?? draft.correlationId ?? generateCorrelationId(),
        receiptStatus: 'pending',
        nestedSelectorOpen: false,
      };
    }

    case 'RECEIPT': {
      if (draft.correlationId !== event.correlationId) {
        return draft;
      }
      const success = event.status === 'success';
      return {
        ...draft,
        step: success ? 'receipt-success' : 'receipt-error',
        receiptStatus: event.status,
        receiptMessage: event.message ?? null,
        visibleDraft: success ? '' : draft.originalDraft,
      };
    }

    case 'RESET':
      return createInitialDraft();

    default:
      return draft;
  }
}

function applyEnter(draft: CommandDraftV1): CommandDraftV1 {
  if (draft.step === 'confirmation-inline' || draft.step === 'confirmation-blocking') {
    return draft;
  }
  if (draft.confirmationGrade !== null && draft.confirmationGrade !== 'safe') {
    return {
      ...draft,
      step: confirmationStep(draft.confirmationGrade),
    };
  }
  if (draft.step === 'dispatching' || draft.receiptStatus === 'pending') {
    return draft;
  }
  if (draft.canonicalName === null) {
    return draft;
  }
  return {
    ...draft,
    step: 'dispatching',
    correlationId: draft.correlationId ?? generateCorrelationId(),
    receiptStatus: 'pending',
  };
}

function applyConfirm(draft: CommandDraftV1): CommandDraftV1 {
  if (draft.step !== 'confirmation-inline' && draft.step !== 'confirmation-blocking') {
    return draft;
  }
  if (draft.receiptStatus === 'pending') {
    return draft;
  }
  return {
    ...draft,
    step: 'dispatching',
    correlationId: draft.correlationId ?? generateCorrelationId(),
    receiptStatus: 'pending',
  };
}

function applyEscape(draft: CommandDraftV1): CommandDraftV1 {
  if (draft.nestedSelectorOpen || draft.step === 'selector') {
    return {
      ...draft,
      step: 'selected',
      nestedSelectorOpen: false,
    };
  }
  if (draft.step === 'argument') {
    return {
      ...draft,
      step: 'selected',
      argumentText: '',
      visibleDraft: draft.canonicalName === null ? draft.originalDraft : `/${draft.canonicalName}`,
    };
  }
  if (draft.step === 'confirmation-inline' || draft.step === 'confirmation-blocking') {
    return {
      ...draft,
      step: draft.selectedRef !== null || draft.argumentText.length > 0 ? 'selected' : 'selected',
    };
  }
  if (draft.step === 'selected' || draft.step === 'assist') {
    return restoreOriginal(draft);
  }
  if (draft.step === 'receipt-success' || draft.step === 'receipt-error' || draft.step === 'receipt-pending') {
    return restoreOriginal(draft);
  }
  return draft;
}

export function draftCanDispatch(
  draft: CommandDraftV1,
  command: CommandExperienceEntryV1 | null,
): boolean {
  if (command === null || draft.canonicalName !== command.canonicalName) {
    return false;
  }
  if (!isCommandExecutable(command)) {
    return false;
  }
  if (draft.receiptStatus === 'pending' || draft.step === 'dispatching') {
    return false;
  }
  return canDispatch({
    state: 'selected',
    query: draft.query,
    selectedCommand: command,
    arguments: draft.argumentText.length === 0 ? {} : { text: draft.argumentText },
    selectedRef: draft.selectedRef,
    correlationId: draft.correlationId,
    receipt: { status: null, correlationId: null, message: null, timestamp: null },
    draft: draft.visibleDraft,
    selectionStart: null,
    selectionEnd: null,
    cursorKey: null,
    cursorMoved: false,
    error: null,
  });
}

export function draftAllowsBareEnter(draft: CommandDraftV1): boolean {
  return draft.confirmationGrade === null || draft.confirmationGrade === 'safe';
}
