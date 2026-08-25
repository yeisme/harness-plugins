/**
 * Keyboard, focus, and responsive model for the Director client.
 * Official DSH decorate / command/executed seams are not required.
 */

import {
  DRAMA_FIRST_SUPPORT_PANES,
  DRAMA_SECONDARY_PANES,
  type DramaCommandEntryV1,
  type DramaPaneId,
  type DramaPaneViewV1,
} from './panes.js'

export type DramaFocusZone = 'command' | 'pane' | 'handoff'
export type DramaBreakpoint = 'narrow' | 'regular' | 'wide'

export interface DramaInteractionState {
  readonly focusZone: DramaFocusZone
  readonly focusedCommandIndex: number
  readonly focusedPaneId: DramaPaneId
  readonly breakpoint: DramaBreakpoint
  readonly reducedMotion: boolean
}

export interface DramaKeyEventV1 {
  readonly key: string
  readonly shiftKey?: boolean
}

export function resolveDramaBreakpoint(width: number): DramaBreakpoint {
  if (width < 720) return 'narrow'
  if (width < 1280) return 'regular'
  return 'wide'
}

export function createDramaInteractionState(
  breakpoint: DramaBreakpoint = 'regular',
  reducedMotion = false,
): DramaInteractionState {
  return {
    focusZone: 'command',
    focusedCommandIndex: 0,
    focusedPaneId: 'Context',
    breakpoint,
    reducedMotion,
  }
}

export function visibleDramaPanesForBreakpoint(
  panes: readonly DramaPaneViewV1[],
  breakpoint: DramaBreakpoint,
): readonly DramaPaneViewV1[] {
  if (breakpoint === 'narrow') {
    return panes.filter((pane) => pane.kind === 'first-support' && pane.visible)
  }
  return panes.filter((pane) => pane.visible)
}

export function canSubmitDramaCommand(entry: DramaCommandEntryV1 | undefined): boolean {
  return entry !== undefined && !entry.disabled
}

export function applyDramaKey(
  state: DramaInteractionState,
  event: DramaKeyEventV1,
  commands: readonly DramaCommandEntryV1[],
  panes: readonly DramaPaneViewV1[],
): DramaInteractionState {
  const visiblePanes = visibleDramaPanesForBreakpoint(panes, state.breakpoint)
  if (event.key === 'Tab') {
    return cycleZone(state, event.shiftKey === true)
  }
  if (event.key === 'Escape') {
    return { ...state, focusZone: 'command' }
  }
  if (state.focusZone === 'command') {
    return moveCommandFocus(state, event.key, commands.length)
  }
  if (state.focusZone === 'pane') {
    return movePaneFocus(state, event.key, visiblePanes)
  }
  if (event.key === 'Enter' || event.key === ' ') {
    return state
  }
  return state
}

function cycleZone(state: DramaInteractionState, reverse: boolean): DramaInteractionState {
  const order: readonly DramaFocusZone[] = ['command', 'pane', 'handoff']
  const index = order.indexOf(state.focusZone)
  const next = reverse
    ? (index - 1 + order.length) % order.length
    : (index + 1) % order.length
  return { ...state, focusZone: order[next] ?? 'command' }
}

function moveCommandFocus(
  state: DramaInteractionState,
  key: string,
  count: number,
): DramaInteractionState {
  if (count === 0) return state
  if (key === 'ArrowDown') {
    return { ...state, focusedCommandIndex: (state.focusedCommandIndex + 1) % count }
  }
  if (key === 'ArrowUp') {
    return { ...state, focusedCommandIndex: (state.focusedCommandIndex - 1 + count) % count }
  }
  return state
}

function movePaneFocus(
  state: DramaInteractionState,
  key: string,
  panes: readonly DramaPaneViewV1[],
): DramaInteractionState {
  if (panes.length === 0) return state
  const ids = panes.map((pane) => pane.id)
  const current = ids.indexOf(state.focusedPaneId)
  const index = current < 0 ? 0 : current
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return { ...state, focusedPaneId: ids[(index + 1) % ids.length] ?? 'Context' }
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return { ...state, focusedPaneId: ids[(index - 1 + ids.length) % ids.length] ?? 'Context' }
  }
  return state
}

export function announceDramaFocus(state: DramaInteractionState, commands: readonly DramaCommandEntryV1[]): string {
  if (state.focusZone === 'command') {
    const entry = commands[state.focusedCommandIndex]
    if (entry === undefined) return 'Drama commands'
    return entry.disabled ? `${entry.label} unavailable. ${entry.reason ?? ''}`.trim() : entry.label
  }
  if (state.focusZone === 'pane') return `${state.focusedPaneId} pane`
  return 'Open in Workbench'
}

export const DRAMA_SECONDARY_PANE_IDS = DRAMA_SECONDARY_PANES
export const DRAMA_FIRST_SUPPORT_PANE_IDS = DRAMA_FIRST_SUPPORT_PANES
