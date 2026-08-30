/**
 * On-demand Drama Radar Pane: deterministic state reducer and fixed-size
 * terminal-text renderer.
 *
 * The pane is a disposable UI projection of the owner refs: after reload the
 * host re-reads the owner projection and the pane rebuilds from it.
 * `updateRadarPane(state, event)` and `renderRadarPane(state, width, height)`
 * are pure and snapshot-testable; rendering goes to a returned frame, never
 * to the terminal directly, and logs live in a sidecar outside this module.
 */

import {
  RADAR_PROJECTION_SCHEMA,
  type RadarOpportunityProjectionV1,
  type RadarProjectionV1,
  type RadarStatus,
} from './contracts.js'
import { RADAR_STATUS_NEXT_ACTIONS } from './badge.js'

export type RadarPaneView = 'list' | 'detail' | 'compare'

export interface RadarPaneStateV1 {
  readonly schema: typeof RADAR_PROJECTION_SCHEMA
  readonly status: RadarStatus
  readonly view: RadarPaneView
  readonly projection?: RadarProjectionV1
  readonly focusIndex: number
  readonly selectedRef?: string
  readonly compareRefs: readonly string[]
  /** Saved focus context so receipts can return focus to the opportunity. */
  readonly focusMemory?: { readonly ref: string; readonly view: RadarPaneView }
  readonly width: number
  readonly height: number
  readonly message?: string
}

export type RadarPaneEventV1 =
  | { readonly type: 'projection_loaded'; readonly projection: RadarProjectionV1 }
  | { readonly type: 'projection_failed'; readonly status: RadarStatus; readonly message: string }
  | { readonly type: 'open_detail'; readonly ref: string }
  | { readonly type: 'close_detail' }
  | { readonly type: 'start_compare' }
  | { readonly type: 'key'; readonly key: RadarPaneKey }
  | { readonly type: 'action_submitted'; readonly ref: string }
  | { readonly type: 'action_receipt'; readonly ref: string; readonly outcome: 'submitted' | 'reconciled' | 'rejected' | 'unknown'; readonly message: string }
  | { readonly type: 'resize'; readonly width: number; readonly height: number }

export type RadarPaneKey =
  | 'up'
  | 'down'
  | 'enter'
  | 'escape'
  | 's' // save focused opportunity
  | 'd' // dismiss focused opportunity
  | 'c' // toggle compare selection
  | 'w' // workbench handoff
  | 'p' // proposal draft
  | 'r' // refresh (needs confirmation)

export const RADAR_MIN_COMPARE_WIDTH = 72

export function createRadarPaneState(width = 80, height = 24): RadarPaneStateV1 {
  return {
    schema: RADAR_PROJECTION_SCHEMA,
    status: 'ready',
    view: 'list',
    focusIndex: 0,
    compareRefs: [],
    width,
    height,
  }
}

function focusedItem(state: RadarPaneStateV1): RadarOpportunityProjectionV1 | undefined {
  return state.projection?.opportunities[state.focusIndex]
}

function clampFocus(items: readonly RadarOpportunityProjectionV1[], index: number): number {
  if (items.length === 0) return 0
  return Math.max(0, Math.min(index, items.length - 1))
}

export function updateRadarPane(state: RadarPaneStateV1, event: RadarPaneEventV1): RadarPaneStateV1 {
  switch (event.type) {
    case 'projection_loaded': {
      const status = event.projection.status
      return {
        ...state,
        status,
        projection: event.projection,
        view: 'list',
        focusIndex: clampFocus(event.projection.opportunities, state.focusIndex),
        compareRefs: [],
        message: RADAR_STATUS_NEXT_ACTIONS[status],
      }
    }
    case 'projection_failed':
      return {
        ...state,
        status: event.status,
        projection: undefined,
        view: 'list',
        message: `${event.message} ${RADAR_STATUS_NEXT_ACTIONS[event.status]}`,
      }
    case 'open_detail': {
      const index = state.projection?.opportunities.findIndex(item => item.opportunityRef === event.ref) ?? -1
      if (index < 0) return { ...state, message: `unknown opportunity ref ${event.ref}` }
      return { ...state, view: 'detail', focusIndex: index, selectedRef: event.ref }
    }
    case 'close_detail':
      return { ...state, view: 'list', selectedRef: undefined }
    case 'start_compare': {
      if (state.compareRefs.length === 2) {
        return { ...state, view: 'compare' }
      }
      return { ...state, message: 'select two opportunities with c before comparing' }
    }
    case 'key': {
      return applyRadarKey(state, event.key)
    }
    case 'action_submitted': {
      // Action pending: mutations disable until the owner receipt arrives.
      return {
        ...state,
        status: 'action_pending',
        focusMemory: { ref: event.ref, view: state.view },
        message: `action pending for ${event.ref}; waiting for the owner receipt`,
      }
    }
    case 'action_receipt': {
      if (event.outcome === 'unknown') {
        return {
          ...state,
          status: 'reconcile_required',
          message: `${event.message} Reconcile by run ref before retrying; no automatic replay.`,
        }
      }
      // Success: focus returns to the remembered opportunity context.
      const memory = state.focusMemory
      const items = state.projection?.opportunities ?? []
      const restoredIndex = memory === undefined
        ? state.focusIndex
        : clampFocus(items, Math.max(0, items.findIndex(item => item.opportunityRef === memory.ref)))
      return {
        ...state,
        status: event.outcome === 'rejected' ? 'reconcile_required' : state.projection === undefined ? state.status : state.projection.status,
        focusIndex: restoredIndex,
        focusMemory: undefined,
        message: event.message,
      }
    }
    case 'resize':
      return { ...state, width: event.width, height: event.height }
    default:
      return state
  }
}

function applyRadarKey(state: RadarPaneStateV1, key: RadarPaneKey): RadarPaneStateV1 {
  const items = state.projection?.opportunities ?? []
  const mutatingBlocked = state.status !== 'ready' && state.status !== 'degraded' && state.status !== 'empty'
  if (key === 'escape') return updateRadarPane(state, { type: 'close_detail' })
  if (key === 'up') return { ...state, focusIndex: clampFocus(items, state.focusIndex - 1) }
  if (key === 'down') return { ...state, focusIndex: clampFocus(items, state.focusIndex + 1) }
  if (key === 'enter') {
    const item = focusedItem(state)
    if (item === undefined) return state
    return updateRadarPane(state, { type: 'open_detail', ref: item.opportunityRef })
  }
  if (key === 'c') {
    const item = focusedItem(state)
    if (item === undefined) return state
    const current = state.compareRefs
    if (current.includes(item.opportunityRef)) {
      return { ...state, compareRefs: current.filter(ref => ref !== item.opportunityRef) }
    }
    if (current.length === 0) return { ...state, compareRefs: [item.opportunityRef] }
    return { ...state, compareRefs: [current[0]!, item.opportunityRef] }
  }
  if ((key === 's' || key === 'd') && mutatingBlocked) {
    return { ...state, message: `mutation disabled while ${state.status}; ${RADAR_STATUS_NEXT_ACTIONS[state.status]}` }
  }
  // s/d/w/p/r are handled by the host command surface; the pane only records intent focus.
  return { ...state, message: `press Enter to open, c to compare; ${key.toUpperCase()} is dispatched via /drama radar` }
}

function fitLine(text: string, width: number): string {
  return text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`
}

function statusFrame(state: RadarPaneStateV1, width: number, height: number): string {
  const lines = [
    `Drama Radar — ${state.status.replace(/_/gu, ' ')}`,
    state.message ?? RADAR_STATUS_NEXT_ACTIONS[state.status],
  ]
  return padFrame(lines, width, height)
}

function padFrame(lines: readonly string[], width: number, height: number): string {
  const fitted = lines.slice(0, height).map(line => fitLine(line, width).padEnd(width, ' '))
  while (fitted.length < height) fitted.push(' '.repeat(width))
  return fitted.join('\n')
}

function renderList(state: RadarPaneStateV1, width: number): string[] {
  const items = state.projection?.opportunities ?? []
  const lines = [
    `Drama Radar · ${items.length} fits · edition ${state.projection?.editionRef ?? 'none'}`,
    '↑/↓ move  Enter detail  c compare  s save  d dismiss  p proposal  w workbench  r refresh  Esc close',
  ]
  items.forEach((item, index) => {
    const cursor = index === state.focusIndex ? '>' : ' '
    const marker = item.isNew ? 'new' : item.saved ? 'saved' : '   '
    const selected = state.compareRefs.includes(item.opportunityRef) ? '[c]' : '   '
    lines.push(`${cursor} ${selected} ${item.title} · market ${item.marketScore} · fit ${item.personalFit} · risk ${item.riskScore} · ${marker}`)
  })
  if (items.length === 0) lines.push('no fitting opportunities in this edition yet')
  if (state.message !== undefined) lines.push(state.message)
  return lines
}

function renderDetail(state: RadarPaneStateV1, width: number): string[] {
  const item = state.projection?.opportunities.find(entry => entry.opportunityRef === state.selectedRef) ?? focusedItem(state)
  if (item === undefined) return statusFrame(state, width, 1).split('\n')
  return [
    `Detail · ${item.title}`,
    `market ${item.marketScore} · personal fit ${item.personalFit} · risk ${item.riskScore}`,
    `ref ${item.opportunityRef} · ${item.isNew ? 'new' : 'seen'} · ${item.saved ? 'saved' : 'not saved'}`,
    '',
    'reasons',
    ...item.reasons.map(reason => `  - ${reason}`),
    'known limitations',
    ...item.knownLimitations.map(limitation => `  - ${limitation}`),
    '',
    's save · d dismiss · p proposal · w workbench · Esc back',
    ...(state.message === undefined ? [] : [state.message]),
  ]
}

function renderCompare(state: RadarPaneStateV1, width: number): string[] {
  const items = state.projection?.opportunities ?? []
  const pair = state.compareRefs.map(ref => items.find(item => item.opportunityRef === ref))
  if (pair.length !== 2 || pair[0] === undefined || pair[1] === undefined) {
    return ['Compare needs two selected opportunities (press c on two rows).']
  }
  const [left, right] = [pair[0], pair[1]]
  if (width < RADAR_MIN_COMPARE_WIDTH) {
    // Narrow screen: degrade to sequential detail instead of unreachable columns.
    return [
      `Compare (narrow layout · needs ${RADAR_MIN_COMPARE_WIDTH}+ columns)`,
      `A · ${left.title} · market ${left.marketScore} · fit ${left.personalFit} · risk ${left.riskScore}`,
      `    ${left.reasons.join('; ') || 'no reasons'}`,
      `B · ${right.title} · market ${right.marketScore} · fit ${right.personalFit} · risk ${right.riskScore}`,
      `    ${right.reasons.join('; ') || 'no reasons'}`,
      'Esc back · open a wider layout for side-by-side compare',
    ]
  }
  const half = Math.floor((width - 3) / 2)
  const leftLines = [
    `A · ${left.title}`,
    `market ${left.marketScore} · fit ${left.personalFit} · risk ${left.riskScore}`,
    ...left.reasons.map(reason => `- ${reason}`),
  ]
  const rightLines = [
    `B · ${right.title}`,
    `market ${right.marketScore} · fit ${right.personalFit} · risk ${right.riskScore}`,
    ...right.reasons.map(reason => `- ${reason}`),
  ]
  const rows = Math.max(leftLines.length, rightLines.length)
  const lines = [`Compare · ${left.opportunityRef} vs ${right.opportunityRef}`]
  for (let index = 0; index < rows; index += 1) {
    const leftCell = fitLine(leftLines[index] ?? '', half).padEnd(half, ' ')
    const rightCell = fitLine(rightLines[index] ?? '', half).padEnd(half, ' ')
    lines.push(`${leftCell} | ${rightCell}`)
  }
  lines.push('Esc back')
  return lines
}

/** Pure fixed-size frame render; callers own terminal output and cleanup. */
export function renderRadarPane(state: RadarPaneStateV1, width = state.width, height = state.height): string {
  if (state.projection === undefined || state.status === 'offline' || state.status === 'permission_denied' || state.status === 'contract_mismatch' || state.status === 'reconcile_required' || state.status === 'action_pending') {
    return statusFrame(state, width, height)
  }
  if (state.projection.status === 'stale') {
    return padFrame([
      `Drama Radar — stale edition ${state.projection.editionRef}`,
      ...renderList(state, width),
      RADAR_STATUS_NEXT_ACTIONS.stale,
    ], width, height)
  }
  const body = state.view === 'detail'
    ? renderDetail(state, width)
    : state.view === 'compare'
      ? renderCompare(state, width)
      : renderList(state, width)
  return padFrame(body, width, height)
}
