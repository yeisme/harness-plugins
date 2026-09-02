/**
 * Web command-first shell: Slash Assist + Palette over one live directory.
 *
 * Pure projection and draft/receipt/Activity helpers. Adapters never patch
 * the DOM and never issue RPC on first `/` discovery.
 */

import type {
  CommandDraftV1,
  CommandExperienceEntryV1,
  CommandPresentationScope,
  RankedCommand,
} from '@yeisme/dsh-client-ui-command-experience-core';
import {
  commandDraftReducer,
  createInitialDraft,
  draftAllowsBareEnter,
  executableResults,
  isP1CandidateWithoutHandler,
  projectCommandDetail,
  projectPaletteGroups,
  projectSlashAssistRows,
  resolveCanonicalIdentity,
} from '@yeisme/dsh-client-ui-command-experience-core';

export const SLASH_ASSIST_ROW_CAP = 8;
export const RECEIPT_SUCCESS_COLLAPSE_MS = 4000;
export const ACTIVITY_VIEW_ID = 'workspace.command-activity';
export const SESSION_STATUS_VIEW_ID = 'workspace.session-status';
export const TOKEN_USAGE_VIEW_ID = 'workspace.token-usage';
export const TOKEN_USAGE_OPEN_ID = 'token-usage-open';

export type WebShellEntry = 'slash-assist' | 'palette';

export interface WebDirectoryRevision {
  readonly revision: number;
  readonly commands: readonly CommandExperienceEntryV1[];
}

export interface CommandActivityEventV1 {
  readonly type: 'command/run' | 'command/done';
  readonly sessionRef: string;
  readonly canonicalName: string;
  readonly correlationId: string;
  readonly status?: 'pending' | 'success' | 'rejected' | 'failed' | 'stale' | 'partial';
  readonly summary?: string;
  readonly reasonCode?: string;
  readonly receiptRef?: string;
}

export interface CommandActivityRowV1 {
  readonly correlationId: string;
  readonly canonicalName: string;
  readonly status: 'pending' | 'success' | 'rejected' | 'failed' | 'stale' | 'partial';
  readonly summary: string;
  readonly reasonCode?: string;
  readonly receiptRef?: string;
}

export interface ReceiptLaneV1 {
  readonly correlationId: string | null;
  readonly status: 'idle' | 'pending' | 'success' | 'error' | 'partial' | 'stale';
  readonly collapsed: boolean;
  readonly announcement: string;
  readonly duplicateBlocked: boolean;
}

export interface PaneOpenViewRequest {
  readonly viewKind: string;
  readonly resourceKey?: string;
  readonly retention: 'preview' | 'pinned';
  readonly singleton?: boolean;
}

export interface PaneWorkbenchFace {
  openView(request: PaneOpenViewRequest): { readonly viewId: string; readonly reused: boolean };
}

export interface ComposerControlSnapshot {
  readonly modelLabel: string | null;
  readonly presetLabel: string | null;
  readonly reasoningLabel: string | null;
  readonly permissionLabel: string | null;
}

export interface SuggestionChipV1 {
  readonly id: string;
  readonly label: string;
  readonly draftText: string;
}

const FORBIDDEN_ACTIVITY = /(raw prompt|provider payload|private args|api[_-]?key|authorization|sk-[a-z0-9]|\/home\/|\/var\/)/iu;

export function projectWebDirectory(
  directory: WebDirectoryRevision,
  entry: WebShellEntry,
  query = '/',
): {
  readonly revision: number;
  readonly rows: readonly RankedCommand[];
  readonly rpcIssued: false;
} {
  const rows = entry === 'slash-assist'
    ? projectSlashAssistRows(directory.commands, { query, surface: 'web', limit: SLASH_ASSIST_ROW_CAP })
    : [...projectPaletteGroups(directory.commands, { query, surface: 'web' }).values()].flat();
  return { revision: directory.revision, rows, rpcIssued: false };
}

export function sameCanonicalAcrossEntries(
  directory: WebDirectoryRevision,
  name: string,
): { readonly slash: string | null; readonly palette: string | null } {
  const slash = projectWebDirectory(directory, 'slash-assist', `/${name}`).rows
    .find(row => row.command.canonicalName === resolveCanonicalIdentity(directory.commands, name)?.canonicalName)
  const palette = projectWebDirectory(directory, 'palette', `/${name}`).rows
    .find(row => row.command.canonicalName === resolveCanonicalIdentity(directory.commands, name)?.canonicalName)
  return {
    slash: slash?.command.canonicalName ?? null,
    palette: palette?.command.canonicalName ?? null,
  };
}

export function dropStaleDirectoryRows(
  previous: WebDirectoryRevision,
  next: WebDirectoryRevision,
): readonly string[] {
  const kept = new Set(next.commands.map(command => command.canonicalName));
  return previous.commands
    .map(command => command.canonicalName)
    .filter(name => !kept.has(name));
}

export function startWebDraft(query: string, originalDraft: string): CommandDraftV1 {
  return commandDraftReducer(createInitialDraft(), {
    type: 'START_ASSIST',
    query,
    originalDraft,
  });
}

export function selectWebCommand(draft: CommandDraftV1, command: CommandExperienceEntryV1): CommandDraftV1 {
  return commandDraftReducer(draft, { type: 'SELECT', command });
}

export function restoreComposerDraft(draft: CommandDraftV1): CommandDraftV1 {
  let current = draft;
  for (let i = 0; i < 8 && current.step !== 'idle'; i += 1) {
    current = commandDraftReducer(current, { type: 'ESCAPE' });
  }
  return current;
}

export function receiptLaneFromDraft(draft: CommandDraftV1, now = 0, successAt: number | null = null): ReceiptLaneV1 {
  if (draft.receiptStatus === 'pending' || draft.step === 'dispatching') {
    return {
      correlationId: draft.correlationId,
      status: 'pending',
      collapsed: false,
      announcement: `Running /${draft.canonicalName ?? 'command'}`,
      duplicateBlocked: true,
    };
  }
  if (draft.receiptStatus === 'success' || draft.step === 'receipt-success') {
    const collapsed = successAt !== null && now - successAt >= RECEIPT_SUCCESS_COLLAPSE_MS;
    return {
      correlationId: draft.correlationId,
      status: 'success',
      collapsed,
      announcement: collapsed ? 'Command finished' : `/${draft.canonicalName ?? 'command'} succeeded`,
      duplicateBlocked: false,
    };
  }
  if (draft.receiptStatus === 'stale') {
    return {
      correlationId: draft.correlationId,
      status: 'stale',
      collapsed: false,
      announcement: draft.receiptMessage ?? 'Command is stale',
      duplicateBlocked: false,
    };
  }
  if (draft.receiptStatus === 'rejected' || draft.receiptStatus === 'failed' || draft.step === 'receipt-error') {
    return {
      correlationId: draft.correlationId,
      status: 'error',
      collapsed: false,
      announcement: draft.receiptMessage ?? 'Command failed',
      duplicateBlocked: false,
    };
  }
  return {
    correlationId: null,
    status: 'idle',
    collapsed: true,
    announcement: '',
    duplicateBlocked: false,
  };
}

export function restoreActivityFromEvents(
  events: readonly CommandActivityEventV1[],
  sessionRef: string,
): readonly CommandActivityRowV1[] {
  const byId = new Map<string, CommandActivityRowV1>();
  for (const event of events) {
    if (event.sessionRef !== sessionRef) continue;
    if (FORBIDDEN_ACTIVITY.test(JSON.stringify(event))) continue;
    const existing = byId.get(event.correlationId);
    if (event.type === 'command/run') {
      byId.set(event.correlationId, {
        correlationId: event.correlationId,
        canonicalName: event.canonicalName,
        status: 'pending',
        summary: event.summary ?? `/${event.canonicalName}`,
        ...(event.reasonCode === undefined ? {} : { reasonCode: event.reasonCode }),
        ...(event.receiptRef === undefined ? {} : { receiptRef: event.receiptRef }),
      });
      continue;
    }
    byId.set(event.correlationId, {
      correlationId: event.correlationId,
      canonicalName: event.canonicalName,
      status: event.status ?? existing?.status ?? 'success',
      summary: event.summary ?? existing?.summary ?? `/${event.canonicalName}`,
      ...(event.reasonCode === undefined ? {} : { reasonCode: event.reasonCode }),
      ...(event.receiptRef === undefined ? {} : { receiptRef: event.receiptRef }),
    });
  }
  return [...byId.values()].slice(-20);
}

export function openCommandResultView(
  pane: PaneWorkbenchFace | null,
  request: PaneOpenViewRequest,
): { readonly opened: boolean; readonly reused: boolean; readonly fallback: 'bounded-dialog' | null } {
  if (pane === null) {
    return { opened: false, reused: false, fallback: 'bounded-dialog' };
  }
  const result = pane.openView(request);
  return { opened: true, reused: result.reused, fallback: null };
}

export function compactComposerControls(
  _snapshot: ComposerControlSnapshot,
  width: number,
): readonly (keyof ComposerControlSnapshot)[] {
  if (width >= 1024) {
    return ['modelLabel', 'presetLabel', 'reasoningLabel', 'permissionLabel'];
  }
  return ['modelLabel', 'permissionLabel'];
}

export function turnEndSuggestionChips(
  chips: readonly SuggestionChipV1[],
  draftEmpty: boolean,
): readonly SuggestionChipV1[] {
  if (!draftEmpty) return [];
  return chips.slice(0, 3);
}

export function applySuggestionChip(_currentDraft: string, chip: SuggestionChipV1): string {
  return chip.draftText;
}

export function webResponsiveMode(width: number): 'anchored' | 'sheet' | 'full' {
  if (width >= 1024) return 'anchored';
  if (width >= 768) return 'sheet';
  return 'full';
}

export function coarsePointerMinPx(pointer: 'fine' | 'coarse'): number {
  return pointer === 'coarse' ? 44 : 32;
}

export function probeFirstCommandMenuFallback(input: {
  readonly composerSeam: boolean;
  readonly paletteSeam: boolean;
  readonly legacyMenuSeam: boolean;
}): { readonly useLegacyMenu: boolean; readonly reason: string | null } {
  if (input.composerSeam && input.paletteSeam) {
    return { useLegacyMenu: false, reason: null };
  }
  if (input.legacyMenuSeam) {
    return {
      useLegacyMenu: true,
      reason: 'Composer command-first seam is unavailable; Command Menu fallback remains active',
    };
  }
  return {
    useLegacyMenu: false,
    reason: 'No command menu seam is available',
  };
}

export function firstSupportCommands(directory: WebDirectoryRevision): readonly string[] {
  const names = ['status', 'session', 'new', 'fork', 'rename', 'compact', 'model', 'permissions'];
  return names.filter(name => resolveCanonicalIdentity(directory.commands, name) !== null);
}

export function p1AbsentFromExecutable(directory: WebDirectoryRevision, name: string): boolean {
  return isP1CandidateWithoutHandler(name, directory.commands)
    && !executableResults(directory.commands).some(command => command.canonicalName === name);
}

export function helpDetailFor(directory: WebDirectoryRevision, name: string) {
  const command = resolveCanonicalIdentity(directory.commands, name);
  return command === null ? null : projectCommandDetail(command);
}

export type { CommandPresentationScope };
export { draftAllowsBareEnter };
