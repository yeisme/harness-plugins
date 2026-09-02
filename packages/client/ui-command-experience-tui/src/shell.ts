/**
 * TUI command-first shell: pure update/render over the shared directory.
 *
 * The plugin never reads stdin, never enters raw/alternate screen, and never
 * captures signals. Hosts feed logical events and paint the returned frame.
 */

import type {
  CommandDraftV1,
  CommandExperienceEntryV1,
} from '@yeisme/dsh-client-ui-command-experience-core';
import {
  commandDraftReducer,
  createInitialDraft,
  draftAllowsBareEnter,
  executableResults,
  isP1CandidateWithoutHandler,
  projectCommandDetail,
  projectSlashAssistRows,
  resolveCanonicalIdentity,
  slashAssistLimitForViewport,
} from '@yeisme/dsh-client-ui-command-experience-core';
import { COLON_MIGRATION_HINT, normalizeTuiAssistInput } from './assist';

export type TuiCommandMode =
  | 'conversation'
  | 'slash-assist'
  | 'command-center'
  | 'argument'
  | 'selector'
  | 'confirm'
  | 'destructive-confirm'
  | 'dispatching'
  | 'receipt'
  | 'inspector'

export type TuiCenterPage = 'commands' | 'recent' | 'status'

export interface TuiViewport {
  readonly width: number
  readonly height: number
}

/** Owner-safe selector row. `ref` is an opaque id; never a path or URL. */
export interface TuiSelectorItem {
  readonly ref: string
  readonly label: string
}

export interface TuiSelectorState {
  readonly query: string
  readonly cursorKey: string | null
  readonly selectedRef: string | null
  readonly items: readonly TuiSelectorItem[]
  readonly ownerPhrase: string
}

export interface TuiUpdateProjections {
  readonly selectorItems?: readonly TuiSelectorItem[]
  readonly destructivePhrase?: string
}

export interface TuiCommandShellStateV1 {
  readonly mode: TuiCommandMode
  readonly sessionRef: string | null
  readonly inputDraft: string
  readonly originalDraft: string
  readonly commandDraft: CommandDraftV1
  readonly candidates: readonly string[]
  readonly cursorKey: string | null
  readonly overlay: TuiCenterPage | 'help' | null
  readonly selector: TuiSelectorState | null
  readonly confirmation: { readonly grade: 'confirm' | 'destructive'; readonly phrase: string; readonly typed: string; readonly focus: 'cancel' | 'confirm' } | null
  readonly receiptRef: string | null
  readonly viewport: TuiViewport
  readonly scrollAnchor: number
  readonly directoryRevision: number
  readonly color: boolean
  readonly unicode: boolean
  readonly debug: boolean
  readonly eventCount: number
  readonly frameCount: number
}

export type TuiLogicalEvent =
  | { readonly type: 'key'; readonly key: string; readonly ctrl?: boolean; readonly meta?: boolean }
  | { readonly type: 'input'; readonly text: string }
  | { readonly type: 'resize'; readonly width: number; readonly height: number }
  | { readonly type: 'directory'; readonly revision: number; readonly names: readonly string[] }
  | { readonly type: 'receipt'; readonly correlationId: string; readonly status: 'success' | 'rejected' | 'failed' | 'stale' }
  | { readonly type: 'reset-session' }
  | { readonly type: 'set-capabilities'; readonly color: boolean; readonly unicode: boolean }

export type TuiSideCommand =
  | { readonly kind: 'dispatch'; readonly canonicalName: string; readonly correlationId: string }
  | { readonly kind: 'announce'; readonly text: string }
  | { readonly kind: 'debug-log'; readonly record: TuiDebugRecord }

export interface TuiDebugRecord {
  readonly eventCount: number
  readonly frameCount: number
  readonly mode: TuiCommandMode
  readonly width: number
  readonly height: number
}

export interface TuiFrame {
  readonly width: number
  readonly height: number
  readonly lines: readonly string[]
  readonly mode: TuiCommandMode
}

export interface TuiResultRendererContributionV1 {
  readonly viewKind: string
  render(input: { readonly summary: string }): string
}

const FORBIDDEN = /(raw prompt|provider payload|private args|api[_-]?key|authorization|sk-[a-z0-9]|\/home\/|\/var\/|https?:\/\/)/iu

export const TUI_P0_NAMES = [
  'help', 'commands', 'status', 'plugins', 'mcp', 'skills', 'pane', 'explorer', 'git',
  'agent', 'resume', 'session', 'archive', 'delete', 'new', 'fork', 'rename',
  'preset', 'model', 'reasoning', 'permissions',
  'compact', 'plan', 'goal', 'diff', 'review', 'mention',
  'copy', 'feedback', 'init', 'logout', 'quit',
] as const

export function createInitialTuiState(viewport: TuiViewport = { width: 80, height: 24 }): TuiCommandShellStateV1 {
  return {
    mode: 'conversation',
    sessionRef: null,
    inputDraft: '',
    originalDraft: '',
    commandDraft: createInitialDraft(),
    candidates: [],
    cursorKey: null,
    overlay: null,
    selector: null,
    confirmation: null,
    receiptRef: null,
    viewport,
    scrollAnchor: 0,
    directoryRevision: 0,
    color: true,
    unicode: true,
    debug: false,
    eventCount: 0,
    frameCount: 0,
  }
}

function assistLimit(height: number): 8 | 6 | 4 | 3 {
  return slashAssistLimitForViewport(height)
}

function candidateNames(
  commands: readonly CommandExperienceEntryV1[],
  query: string,
  height: number,
): readonly string[] {
  return projectSlashAssistRows(commands, {
    query,
    surface: 'tui',
    limit: assistLimit(height),
  }).map(row => row.command.canonicalName)
}

const SAFE_SELECTOR_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u

export function isOwnerSafeSelectorRef(ref: string): boolean {
  return SAFE_SELECTOR_REF.test(ref) && !/[\\/]/.test(ref) && !/^https?:/i.test(ref)
}

export function ownerSafeSelectorItems(
  items: readonly TuiSelectorItem[] = [],
): readonly TuiSelectorItem[] {
  return items.filter(item => isOwnerSafeSelectorRef(item.ref) && item.label.trim().length > 0)
}

export function update(
  state: TuiCommandShellStateV1,
  event: TuiLogicalEvent,
  commands: readonly CommandExperienceEntryV1[] = [],
  projections: TuiUpdateProjections = {},
): { readonly state: TuiCommandShellStateV1; readonly commands: readonly TuiSideCommand[] } {
  const nextCount = state.eventCount + 1
  const side: TuiSideCommand[] = []

  if (event.type === 'resize') {
    return {
      state: {
        ...state,
        viewport: { width: event.width, height: event.height },
        eventCount: nextCount,
      },
      commands: side,
    }
  }

  if (event.type === 'set-capabilities') {
    return {
      state: { ...state, color: event.color, unicode: event.unicode, eventCount: nextCount },
      commands: side,
    }
  }

  if (event.type === 'reset-session') {
    return {
      state: {
        ...createInitialTuiState(state.viewport),
        color: state.color,
        unicode: state.unicode,
        debug: state.debug,
        eventCount: nextCount,
        directoryRevision: state.directoryRevision,
      },
      commands: side,
    }
  }

  if (event.type === 'directory') {
    const selected = state.commandDraft.canonicalName
    const stale = selected !== null && !event.names.includes(selected)
    return {
      state: {
        ...state,
        directoryRevision: event.revision,
        candidates: event.names,
        commandDraft: stale
          ? { ...state.commandDraft, canonicalName: null }
          : state.commandDraft,
        eventCount: nextCount,
      },
      commands: side,
    }
  }

  if (event.type === 'receipt') {
    const draft = commandDraftReducer(state.commandDraft, {
      type: 'RECEIPT',
      status: event.status,
      correlationId: event.correlationId,
    })
    return {
      state: {
        ...state,
        commandDraft: draft,
        mode: 'receipt',
        receiptRef: event.correlationId,
        eventCount: nextCount,
      },
      commands: side,
    }
  }

  if (event.type === 'input') {
    return applyInput(state, event.text, commands, nextCount)
  }

  return applyKey(state, event, commands, nextCount, side, projections)
}

function applyInput(
  state: TuiCommandShellStateV1,
  text: string,
  commands: readonly CommandExperienceEntryV1[],
  eventCount: number,
): { readonly state: TuiCommandShellStateV1; readonly commands: readonly TuiSideCommand[] } {
  if (state.mode === 'destructive-confirm' && state.confirmation) {
    return {
      state: {
        ...state,
        confirmation: { ...state.confirmation, typed: text },
        eventCount,
      },
      commands: [],
    }
  }
  if (state.mode === 'argument') {
    const draft = commandDraftReducer(state.commandDraft, { type: 'SET_ARGUMENT', text })
    return { state: { ...state, commandDraft: draft, inputDraft: draft.visibleDraft, eventCount }, commands: [] }
  }
  if (state.mode === 'selector' && state.selector) {
    return {
      state: {
        ...state,
        selector: { ...state.selector, query: text },
        eventCount,
      },
      commands: [],
    }
  }
  const normalized = normalizeTuiAssistInput(text)
  const assist = text.trimStart().startsWith('/') || text.trimStart().startsWith(':')
  if (!assist) {
    return {
      state: { ...state, inputDraft: text, originalDraft: state.mode === 'conversation' ? text : state.originalDraft, eventCount },
      commands: [],
    }
  }
  const names = candidateNames(commands, normalized.query, state.viewport.height)
  const draft = commandDraftReducer(createInitialDraft(), {
    type: 'START_ASSIST',
    query: normalized.query,
    originalDraft: state.originalDraft || (assist ? state.originalDraft : text),
  })
  return {
    state: {
      ...state,
      mode: 'slash-assist',
      inputDraft: text,
      originalDraft: state.mode === 'conversation' ? state.inputDraft : state.originalDraft,
      commandDraft: draft,
      candidates: names,
      cursorKey: names[0] ?? null,
      eventCount,
    },
    commands: [],
  }
}

function applyKey(
  state: TuiCommandShellStateV1,
  event: Extract<TuiLogicalEvent, { type: 'key' }>,
  commands: readonly CommandExperienceEntryV1[],
  eventCount: number,
  side: TuiSideCommand[],
  projections: TuiUpdateProjections,
): { readonly state: TuiCommandShellStateV1; readonly commands: readonly TuiSideCommand[] } {
  const key = event.key.toLowerCase()
  const ctrl = event.ctrl === true || event.meta === true

  if (ctrl && key === 'k' && (state.mode === 'conversation' || state.mode === 'slash-assist')) {
    return {
      state: {
        ...state,
        mode: 'command-center',
        overlay: 'commands',
        originalDraft: state.inputDraft,
        eventCount,
      },
      commands: side,
    }
  }

  if (key === 'escape') {
    return applyEscape(state, eventCount)
  }

  if (state.mode === 'command-center') {
    if (key === 'arrowleft' || key === 'h') {
      const pages: TuiCenterPage[] = ['commands', 'recent', 'status']
      const index = pages.indexOf(state.overlay === 'help' ? 'commands' : (state.overlay ?? 'commands'))
      const next = pages[(index + pages.length - 1) % pages.length] ?? 'commands'
      return { state: { ...state, overlay: next, eventCount }, commands: side }
    }
    if (key === 'arrowright' || key === 'l') {
      const pages: TuiCenterPage[] = ['commands', 'recent', 'status']
      const index = pages.indexOf(state.overlay === 'help' ? 'commands' : (state.overlay ?? 'commands'))
      const next = pages[(index + 1) % pages.length] ?? 'commands'
      return { state: { ...state, overlay: next, eventCount }, commands: side }
    }
  }

  if (state.mode === 'slash-assist' || state.mode === 'command-center') {
    if (key === 'arrowdown') {
      const index = Math.max(0, state.candidates.indexOf(state.cursorKey ?? ''))
      const next = state.candidates[Math.min(state.candidates.length - 1, index + 1)] ?? state.cursorKey
      return { state: { ...state, cursorKey: next, eventCount }, commands: side }
    }
    if (key === 'arrowup') {
      const index = Math.max(0, state.candidates.indexOf(state.cursorKey ?? ''))
      const next = state.candidates[Math.max(0, index - 1)] ?? state.cursorKey
      return { state: { ...state, cursorKey: next, eventCount }, commands: side }
    }
    if (key === 'enter') {
      const selected = resolveCanonicalIdentity(commands, state.cursorKey ?? '')
      if (selected === null || selected.availability.state !== 'available') {
        return { state: { ...state, eventCount }, commands: side }
      }
      const centerPage = helpOrCommandsOpenCenter(selected.canonicalName)
      if (centerPage !== null) {
        return {
          state: {
            ...state,
            mode: 'command-center',
            overlay: centerPage,
            eventCount,
          },
          commands: side,
        }
      }
      const draft = commandDraftReducer(state.commandDraft, { type: 'SELECT', command: selected })
      const mode: TuiCommandMode = draft.step === 'selector'
        ? 'selector'
        : draft.step === 'argument'
          ? 'argument'
          : draft.step === 'confirmation-blocking'
            ? 'destructive-confirm'
            : draft.step === 'confirmation-inline'
              ? 'confirm'
              : 'slash-assist'
      const phrase = projections.destructivePhrase ?? ''
      return {
        state: {
          ...state,
          commandDraft: draft,
          mode,
          selector: mode === 'selector'
            ? {
              query: '',
              cursorKey: null,
              selectedRef: null,
              items: ownerSafeSelectorItems(projections.selectorItems),
              ownerPhrase: phrase,
            }
            : null,
          confirmation: mode === 'confirm' || mode === 'destructive-confirm'
            ? {
              grade: mode === 'destructive-confirm' ? 'destructive' : 'confirm',
              phrase: mode === 'destructive-confirm' ? phrase : '',
              typed: '',
              focus: 'cancel',
            }
            : null,
          eventCount,
        },
        commands: side,
      }
    }
  }

  if (state.mode === 'confirm' || state.mode === 'destructive-confirm') {
    if (key === 'enter' && (state.confirmation?.focus ?? 'cancel') === 'cancel') {
      return applyEscape(state, eventCount)
    }
    if (key === 'y' && state.mode === 'confirm') {
      return dispatchSelected(state, eventCount, side)
    }
    if (key === 'arrowright') {
      return {
        state: {
          ...state,
          confirmation: state.confirmation ? { ...state.confirmation, focus: 'confirm' } : state.confirmation,
          eventCount,
        },
        commands: side,
      }
    }
    if (key === 'enter' && state.confirmation?.focus === 'confirm') {
      if (state.mode === 'destructive-confirm') {
        const phrase = state.confirmation.phrase
        if (phrase.length === 0 || state.confirmation.typed !== phrase) {
          return { state: { ...state, eventCount }, commands: side }
        }
      }
      return dispatchSelected(state, eventCount, side)
    }
  }

  if (state.mode === 'selector' && state.selector) {
    const items = state.selector.items
    const refs = items.map(item => item.ref)
    if (key === 'arrowdown' || key === 'arrowup') {
      if (refs.length === 0) {
        return { state: { ...state, eventCount }, commands: side }
      }
      const currentIndex = state.selector.selectedRef === null ? -1 : refs.indexOf(state.selector.selectedRef)
      const nextIndex = key === 'arrowdown'
        ? Math.min(refs.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex <= 0 ? 0 : currentIndex - 1)
      const nextRef = refs[nextIndex] ?? null
      return {
        state: {
          ...state,
          selector: {
            ...state.selector,
            selectedRef: nextRef,
            cursorKey: nextRef,
          },
          eventCount,
        },
        commands: side,
      }
    }
    if (key === 'enter') {
      const selectedRef = state.selector.selectedRef
      if (selectedRef === null || !isOwnerSafeSelectorRef(selectedRef)) {
        return { state: { ...state, eventCount }, commands: side }
      }
      let draft = commandDraftReducer(state.commandDraft, { type: 'SET_REF', ref: selectedRef })
      const selected = resolveCanonicalIdentity(commands, draft.canonicalName ?? '')
      const danger = selected?.danger ?? draft.confirmationGrade
      if (danger === 'destructive' || danger === 'confirm') {
        draft = commandDraftReducer(draft, { type: 'REQUEST_CONFIRM' })
        const phrase = danger === 'destructive' ? state.selector.ownerPhrase : ''
        return {
          state: {
            ...state,
            commandDraft: draft,
            mode: danger === 'destructive' ? 'destructive-confirm' : 'confirm',
            selector: null,
            confirmation: {
              grade: danger,
              phrase,
              typed: '',
              focus: 'cancel',
            },
            eventCount,
          },
          commands: side,
        }
      }
      return {
        state: {
          ...state,
          commandDraft: draft,
          mode: 'slash-assist',
          selector: null,
          eventCount,
        },
        commands: side,
      }
    }
  }

  if ((state.mode === 'slash-assist' || state.mode === 'argument') && key === 'enter' && draftAllowsBareEnter(state.commandDraft) && state.commandDraft.canonicalName) {
    return dispatchSelected(state, eventCount, side)
  }

  return { state: { ...state, eventCount }, commands: side }
}

function dispatchSelected(
  state: TuiCommandShellStateV1,
  eventCount: number,
  side: TuiSideCommand[],
): { readonly state: TuiCommandShellStateV1; readonly commands: readonly TuiSideCommand[] } {
  if (state.commandDraft.receiptStatus === 'pending') {
    return { state: { ...state, eventCount }, commands: side }
  }
  const draft = commandDraftReducer(state.commandDraft, { type: 'CONFIRM' })
  const dispatched = draft.step === 'dispatching'
    ? draft
    : commandDraftReducer(state.commandDraft, { type: 'DISPATCH', correlationId: 'tui-1' })
  if (dispatched.correlationId) {
    side.push({
      kind: 'dispatch',
      canonicalName: dispatched.canonicalName ?? 'unknown',
      correlationId: dispatched.correlationId,
    })
  }
  return {
    state: {
      ...state,
      commandDraft: dispatched,
      mode: 'dispatching',
      confirmation: null,
      eventCount,
    },
    commands: side,
  }
}

function applyEscape(
  state: TuiCommandShellStateV1,
  eventCount: number,
): { readonly state: TuiCommandShellStateV1; readonly commands: readonly TuiSideCommand[] } {
  if (state.mode === 'inspector') {
    return { state: { ...state, mode: 'command-center', overlay: 'commands', eventCount }, commands: [] }
  }
  if (state.mode === 'command-center') {
    return {
      state: {
        ...state,
        mode: 'conversation',
        overlay: null,
        inputDraft: state.originalDraft,
        eventCount,
      },
      commands: [],
    }
  }
  if (state.mode === 'confirm' || state.mode === 'destructive-confirm') {
    return { state: { ...state, mode: 'slash-assist', confirmation: null, eventCount }, commands: [] }
  }
  if (state.mode === 'selector') {
    const draft = commandDraftReducer(state.commandDraft, { type: 'ESCAPE' })
    return { state: { ...state, mode: 'slash-assist', commandDraft: draft, selector: null, eventCount }, commands: [] }
  }
  if (state.mode === 'argument' || state.mode === 'slash-assist' || state.mode === 'receipt' || state.mode === 'dispatching') {
    const draft = commandDraftReducer(state.commandDraft, { type: 'ESCAPE' })
    if (draft.step === 'idle' || state.mode === 'slash-assist') {
      return {
        state: {
          ...state,
          mode: 'conversation',
          commandDraft: createInitialDraft(),
          inputDraft: state.originalDraft,
          candidates: [],
          cursorKey: null,
          eventCount,
        },
        commands: [],
      }
    }
    return { state: { ...state, commandDraft: draft, mode: 'slash-assist', eventCount }, commands: [] }
  }
  return { state: { ...state, eventCount }, commands: [] }
}

function pad(line: string, width: number): string {
  const current = cellWidth(line)
  if (current >= width) {
    let clipped = ''
    for (const char of line) {
      if (cellWidth(clipped + char) > width) break
      clipped += char
    }
    return clipped
  }
  return line + ' '.repeat(width - current)
}

function cellWidth(text: string): number {
  let width = 0
  for (const char of text) {
    width += char.charCodeAt(0) > 0xff ? 2 : 1
  }
  return width
}

export function render(
  state: TuiCommandShellStateV1,
  width = state.viewport.width,
  height = state.viewport.height,
  options: {
    readonly commands?: readonly CommandExperienceEntryV1[]
    readonly statusLine?: string | null
    readonly activity?: readonly string[]
    readonly inspector?: string | null
  } = {},
): TuiFrame {
  const lines: string[] = []
  const glyph = state.unicode ? '·' : '.'
  const status = options.statusLine ?? (state.sessionRef ? `session ${state.sessionRef}` : 'status unavailable')
  lines.push(pad(`dsh ${glyph} ${status}`, width))
  if (state.mode === 'command-center') {
    lines.push(pad(`Command Center  [${state.overlay ?? 'commands'}]  revision ${state.directoryRevision}`, width))
    if (state.overlay === 'status') {
      lines.push(pad(options.statusLine ?? 'status unavailable', width))
    } else if (state.overlay === 'recent') {
      const activity = options.activity ?? []
      if (activity.length === 0) lines.push(pad('No recent activity', width))
      for (const row of activity.slice(0, Math.max(1, height - 6))) {
        lines.push(pad(row, width))
      }
    } else {
      for (const name of state.candidates.slice(0, assistLimit(height))) {
        const mark = name === state.cursorKey ? '>' : ' '
        lines.push(pad(`${mark} /${name}`, width))
      }
    }
  } else if (state.mode === 'slash-assist') {
    const hint = state.inputDraft.trimStart().startsWith(':') ? COLON_MIGRATION_HINT : ''
    if (hint) lines.push(pad(hint, width))
    for (const name of state.candidates.slice(0, assistLimit(height))) {
      const mark = name === state.cursorKey ? '>' : ' '
      const command = options.commands ? resolveCanonicalIdentity(options.commands, name) : null
      const reason = command?.availability.state === 'available' ? '' : (command?.availability.reason ?? '')
      lines.push(pad(`${mark} /${name}  ${reason}`.trimEnd(), width))
    }
  } else if (state.mode === 'confirm' || state.mode === 'destructive-confirm') {
    const focus = state.confirmation?.focus ?? 'cancel'
    lines.push(pad(`Confirm /${state.commandDraft.canonicalName ?? ''}  [${focus === 'cancel' ? 'Cancel' : 'Confirm'}]`, width))
    if (state.mode === 'destructive-confirm') {
      lines.push(pad(`Type ${state.confirmation?.phrase ?? ''} to confirm`, width))
    }
  } else if (state.mode === 'selector') {
    lines.push(pad(`Select ${state.commandDraft.canonicalName ?? 'item'}`, width))
    const items = state.selector?.items ?? []
    if (items.length === 0) {
      lines.push(pad('no selection', width))
    } else {
      for (const item of items) {
        const mark = item.ref === state.selector?.selectedRef ? '>' : ' '
        lines.push(pad(`${mark} ${item.label}`, width))
      }
    }
  } else if (state.mode === 'argument') {
    lines.push(pad(state.commandDraft.visibleDraft, width))
  } else if (state.mode === 'dispatching' || state.mode === 'receipt') {
    lines.push(pad(`receipt ${state.commandDraft.receiptStatus ?? 'pending'}`, width))
  } else if (state.mode === 'inspector') {
    lines.push(pad(options.inspector ?? 'safe text', width))
  } else {
    lines.push(pad(state.inputDraft, width))
  }
  lines.push(pad(`> ${state.inputDraft}`, width))
  while (lines.length < height) lines.push(pad('', width))
  const clipped = lines.slice(0, height).map(line => pad(line, width))
  if (FORBIDDEN.test(clipped.join('\n'))) {
    return {
      width,
      height,
      mode: state.mode,
      lines: clipped.map(line => line.replace(FORBIDDEN, '[redacted]')),
    }
  }
  return { width, height, mode: state.mode, lines: clipped }
}

export function renderStatusline(
  snapshot: { readonly available: boolean; readonly capsuleLabel?: string; readonly lifecycle?: string } | null,
  width: number,
  options: { readonly ascii?: boolean } = {},
): string {
  if (snapshot === null || snapshot.available === false) {
    const text = options.ascii ? 'status unavailable' : 'status unavailable'
    return text.slice(0, width)
  }
  const label = snapshot.lifecycle && ['waiting_approval', 'error', 'offline'].includes(snapshot.lifecycle)
    ? snapshot.lifecycle
    : (snapshot.capsuleLabel ?? 'session')
  return label.slice(0, width)
}

export function validateRendererContribution(value: unknown): TuiResultRendererContributionV1 | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (typeof record.viewKind !== 'string' || record.viewKind.length === 0) return null
  if (typeof record.render !== 'function') return null
  const keys = Object.keys(record)
  if (keys.some(key => /api[_-]?key|authorization|cookie|credential|token|password/iu.test(key))) {
    return null
  }
  if (FORBIDDEN.test(record.viewKind) || /https?:|\/home\/|\/var\//iu.test(record.viewKind)) {
    return null
  }
  return { viewKind: record.viewKind, render: record.render as TuiResultRendererContributionV1['render'] }
}

export function tuiPluginLifecycleContract(): {
  readonly readsStdin: false
  readonly rawMode: false
  readonly alternateScreen: false
  readonly capturesSignals: false
} {
  return {
    readsStdin: false,
    rawMode: false,
    alternateScreen: false,
    capturesSignals: false,
  }
}

export function debugRecord(state: TuiCommandShellStateV1): TuiDebugRecord {
  return {
    eventCount: state.eventCount,
    frameCount: state.frameCount,
    mode: state.mode,
    width: state.viewport.width,
    height: state.viewport.height,
  }
}

export function appendSidecar(
  sink: { write(line: string): void },
  record: TuiDebugRecord,
): void {
  const line = JSON.stringify(record)
  if (FORBIDDEN.test(line)) return
  sink.write(line)
}

export function p1HiddenFromTui(commands: readonly CommandExperienceEntryV1[], name: string): boolean {
  return isP1CandidateWithoutHandler(name, commands)
    && !executableResults(commands).some(command => command.canonicalName === name)
}

export function helpOrCommandsOpenCenter(name: string): TuiCenterPage | 'help' | null {
  if (name === 'commands') return 'commands'
  if (name === 'help') return 'help'
  if (name === 'status') return 'status'
  return null
}

export { cellWidth, projectCommandDetail, resolveCanonicalIdentity }
