/**
 * Session command adapters: /resume, /new, /fork, /rename, /compact.
 *
 * Owner projections are filtered locally. State changes stay receipt-gated.
 * The plugin does not keep a local session index.
 */

export interface SessionCandidate {
  readonly ref: string;
  readonly title: string;
  readonly status?: string;
  readonly active?: boolean;
}

export interface SessionFilter {
  readonly query?: string;
}

export type SessionCommandId = 'resume' | 'new' | 'fork' | 'rename' | 'compact'

export interface SessionCommandIntent {
  readonly command: SessionCommandId;
  readonly actionType: 'open-session' | 'new-chat' | 'fork-chat' | 'rename-session' | 'compact-context';
  readonly targetRef: string | null;
  readonly parameters: Readonly<Record<string, string>>;
  readonly requiresConfirmation: boolean;
}

export interface ReceiptGatedReload {
  readonly reloadTranscript: boolean;
  readonly keepDraft: boolean;
  readonly keepCurrentSession: boolean;
}

export function filterSessionProjection(
  sessions: readonly SessionCandidate[],
  filter: SessionFilter = {},
): readonly SessionCandidate[] {
  const query = filter.query?.trim().toLowerCase() ?? ''
  if (query.length === 0) return sessions
  return sessions.filter((session) =>
    session.ref.toLowerCase().includes(query) || session.title.toLowerCase().includes(query),
  )
}

export function selectSessionRef(
  sessions: readonly SessionCandidate[],
  selectedRef: string,
): { readonly ok: true; readonly sessionRef: string } | { readonly ok: false; readonly reason: string } {
  const found = sessions.find((session) => session.ref === selectedRef)
  if (found === undefined) {
    return { ok: false, reason: 'Selected sessionRef is stale' }
  }
  return { ok: true, sessionRef: found.ref }
}

export function planSessionCommand(input: {
  readonly command: SessionCommandId;
  readonly selectedRef?: string;
  readonly title?: string;
}): SessionCommandIntent {
  switch (input.command) {
    case 'resume':
      return {
        command: 'resume',
        actionType: 'open-session',
        targetRef: input.selectedRef ?? null,
        parameters: {},
        requiresConfirmation: false,
      }
    case 'new':
      return {
        command: 'new',
        actionType: 'new-chat',
        targetRef: null,
        parameters: {},
        requiresConfirmation: false,
      }
    case 'fork':
      return {
        command: 'fork',
        actionType: 'fork-chat',
        targetRef: null,
        parameters: {},
        requiresConfirmation: true,
      }
    case 'rename':
      return {
        command: 'rename',
        actionType: 'rename-session',
        targetRef: input.selectedRef ?? null,
        parameters: input.title === undefined ? {} : { newTitle: input.title },
        requiresConfirmation: false,
      }
    case 'compact':
      return {
        command: 'compact',
        actionType: 'compact-context',
        targetRef: null,
        parameters: {},
        requiresConfirmation: true,
      }
  }
}

export function applySessionReceipt(status: 'success' | 'rejected' | 'failed' | 'stale' | 'cancelled'): ReceiptGatedReload {
  if (status === 'success') {
    return { reloadTranscript: true, keepDraft: false, keepCurrentSession: false }
  }
  return { reloadTranscript: false, keepDraft: true, keepCurrentSession: true }
}

export function distinguishNewAndFork(command: SessionCommandId): 'create-empty' | 'copy-current' | 'other' {
  if (command === 'new') return 'create-empty'
  if (command === 'fork') return 'copy-current'
  return 'other'
}
