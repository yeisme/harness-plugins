/**
 * Session command adapters: /resume, /new, /fork, /rename, /compact, /session.
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

export type SessionCommandId = 'resume' | 'new' | 'fork' | 'rename' | 'compact' | 'session'

export interface SessionCommandIntent {
  readonly command: SessionCommandId;
  readonly actionType: 'open-session' | 'new-chat' | 'fork-chat' | 'rename-session' | 'compact-context' | 'archive-session' | 'delete-session' | 'restore-session';
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
  /** Text after `/session` (and `:session`), e.g. 'archive session:alpha'. */
  readonly rest?: string;
}): SessionCommandIntent {
  const sessionSubcommand = parseSessionSubcommand(input.rest ?? '')
  const hubTitle = sessionSubcommand.title ?? input.title
  switch (input.command) {
    case 'resume':
      return {
        command: 'resume',
        actionType: 'open-session',
        targetRef: input.selectedRef ?? null,
        parameters: {},
        requiresConfirmation: false,
      }
    case 'session':
      // The hub parses its subcommand; an empty rest is a plain switch.
      return planSessionItemAction({
        action: sessionSubcommand.kind,
        selectedRef: input.selectedRef ?? null,
        ...(hubTitle === undefined ? {} : { title: hubTitle }),
      })
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

/** Actions the /session hub can perform on a picked session. */
export type SessionHubAction = 'switch' | 'rename' | 'archive' | 'restore'

export interface SessionSubcommand {
  readonly kind: SessionHubAction;
  readonly title?: string;
}

const SESSION_SUBCOMMAND_TOKENS = new Set(['switch', 'rename', 'archive', 'restore'])

/**
 * Parse the text after `/session`. Unknown or missing tokens fall back to
 * `switch` so discovery stays forgiving instead of erroring mid-word.
 */
export function parseSessionSubcommand(rest: string): SessionSubcommand {
  const tokens = rest.trim().split(/\s+/).filter((token) => token.length > 0)
  const [head, ...tail] = tokens
  if (head === undefined || !SESSION_SUBCOMMAND_TOKENS.has(head.toLowerCase())) {
    return { kind: 'switch' }
  }
  const kind = head.toLowerCase() as SessionHubAction
  const title = tail.join(' ').trim()
  return {
    kind,
    ...(kind === 'rename' && title.length > 0 ? { title } : {}),
  }
}

/** One row of the /session hub action menu. */
export interface SessionHubActionItem {
  readonly action: SessionHubAction;
  readonly label: string;
  readonly requiredAction: string;
  readonly disabled: boolean;
  readonly reason: string | null;
}

/**
 * Build the hub action rows for a picked session. Actions whose owner
 * capability is missing stay visible but disabled with a reason (no dead
 * buttons). Archived targets show Restore instead of Archive. The hub never
 * offers delete.
 */
export function buildSessionHubActions(input: {
  readonly availableActions: ReadonlySet<string>;
  readonly archived?: boolean;
}): SessionHubActionItem[] {
  const rows: ReadonlyArray<{
    readonly action: SessionHubAction;
    readonly label: string;
    readonly requiredAction: string;
  }> = [
    { action: 'switch', label: 'Switch to this session', requiredAction: 'open-session' },
    { action: 'rename', label: 'Rename this session', requiredAction: 'rename-session' },
    ...(input.archived === true
      ? [{ action: 'restore' as const, label: 'Restore this archived session', requiredAction: 'restore-session' }]
      : [{ action: 'archive' as const, label: 'Archive this session', requiredAction: 'archive-session' }]),
  ];
  return rows.map((row) => {
    const missing = !input.availableActions.has(row.requiredAction);
    return {
      ...row,
      disabled: missing,
      reason: missing ? `missing owner action ${row.requiredAction}` : null,
    };
  });
}

/**
 * Plan the /session hub action for a picked target. Archive and restore map
 * to receipt-gated owner actions; the hub never exposes delete. A null
 * selectedRef addresses the current session, matching /rename semantics.
 */
export function planSessionItemAction(input: {
  readonly action: SessionHubAction;
  readonly selectedRef: string | null;
  readonly title?: string;
}): SessionCommandIntent {
  switch (input.action) {
    case 'switch':
      return {
        command: 'session',
        actionType: 'open-session',
        targetRef: input.selectedRef,
        parameters: {},
        requiresConfirmation: false,
      }
    case 'rename':
      return {
        command: 'session',
        actionType: 'rename-session',
        targetRef: input.selectedRef,
        parameters: input.title === undefined ? {} : { newTitle: input.title },
        requiresConfirmation: false,
      }
    case 'archive':
      return {
        command: 'session',
        actionType: 'archive-session',
        targetRef: input.selectedRef,
        parameters: {},
        requiresConfirmation: true,
      }
    case 'restore':
      return {
        command: 'session',
        actionType: 'restore-session',
        targetRef: input.selectedRef,
        parameters: {},
        requiresConfirmation: false,
      }
  }
}
