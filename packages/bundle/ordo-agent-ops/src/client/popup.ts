/**
 * Local Ordo command popup / panel-focus model.
 *
 * Official DSH decorate and command/executed are not used. Menu rows come
 * only from the safe snapshot. Selection returns an exact /ordo line and
 * never mutates.
 */

import type { OrdoAgentOpsSnapshot } from './contracts.ts'

export type OrdoPopupCommandId =
  | 'status'
  | 'preview'
  | 'approvals'
  | 'evidence'
  | 'capacity'
  | 'help'
  | 'qualify'
  | 'reconcile'
  | 'approve'

export interface OrdoPopupItemV1 {
  readonly id: OrdoPopupCommandId
  readonly line: string
  readonly label: string
  readonly mutation: boolean
  readonly disabled: boolean
  readonly reason?: string
}

export interface OrdoPopupStateV1 {
  readonly open: boolean
  readonly focusedIndex: number
  readonly items: readonly OrdoPopupItemV1[]
  readonly panelFocused: boolean
  readonly reducedMotion: boolean
  readonly announcement: string
}

export interface OrdoPopupKeyEventV1 {
  readonly key: string
  readonly shiftKey?: boolean
}

const MUTATION_BLOCKED: Readonly<Record<OrdoAgentOpsSnapshot['state'] | OrdoAgentOpsSnapshot['freshness'], string | undefined>> = {
  ready: undefined,
  stale: 'stale snapshot; request a fresh preview before mutation',
  offline: 'owner is offline; mutation is not available',
  permission_denied: 'permission denied; mutation is not available',
  contract_mismatch: 'contract mismatch; mutation is not available',
  needs_contract: 'owner projection is not mounted',
  fresh: undefined,
}

function mutationBlockReason(snapshot: OrdoAgentOpsSnapshot): string | undefined {
  return MUTATION_BLOCKED[snapshot.freshness] ?? MUTATION_BLOCKED[snapshot.state]
}

function safeRef(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value.length === 0) return fallback
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)) return fallback
  return value
}

export function createOrdoPopupItems(snapshot: OrdoAgentOpsSnapshot): readonly OrdoPopupItemV1[] {
  const runRef = safeRef(snapshot.run?.runRef, 'current')
  const blocked = mutationBlockReason(snapshot)
  const mutationDisabled = blocked !== undefined
  return [
    { id: 'status', line: `/ordo status ${runRef}`, label: 'Status', mutation: false, disabled: false },
    { id: 'preview', line: '/ordo preview current', label: 'Preview', mutation: false, disabled: false },
    { id: 'approvals', line: '/ordo approvals', label: 'Approvals', mutation: false, disabled: false },
    { id: 'evidence', line: '/ordo evidence', label: 'Evidence', mutation: false, disabled: false },
    { id: 'capacity', line: '/ordo capacity', label: 'Capacity', mutation: false, disabled: false },
    { id: 'help', line: '/ordo help', label: 'Help', mutation: false, disabled: false },
    {
      id: 'qualify',
      line: '/ordo qualify current',
      label: 'Qualify',
      mutation: true,
      disabled: mutationDisabled,
      ...(blocked === undefined ? {} : { reason: blocked }),
    },
    {
      id: 'reconcile',
      line: `/ordo reconcile ${runRef}`,
      label: 'Reconcile',
      mutation: true,
      disabled: mutationDisabled,
      ...(blocked === undefined ? {} : { reason: blocked }),
    },
    {
      id: 'approve',
      line: '/ordo approve current-decision',
      label: 'Approve',
      mutation: true,
      disabled: true,
      reason: mutationDisabled ? blocked : 'approve requires a server-authored decision-ref',
    },
  ]
}

export function createOrdoPopupState(
  snapshot: OrdoAgentOpsSnapshot,
  reducedMotion = false,
): OrdoPopupStateV1 {
  const items = createOrdoPopupItems(snapshot)
  return {
    open: false,
    focusedIndex: 0,
    items,
    panelFocused: false,
    reducedMotion,
    announcement: 'Ordo command menu closed',
  }
}

export function openOrdoPopup(state: OrdoPopupStateV1): OrdoPopupStateV1 {
  return {
    ...state,
    open: true,
    focusedIndex: 0,
    panelFocused: false,
    announcement: announceItem(state.items[0]),
  }
}

export function applyOrdoPopupKey(state: OrdoPopupStateV1, event: OrdoPopupKeyEventV1): OrdoPopupStateV1 {
  if (!state.open) {
    if (event.key === 'Enter' || event.key === ' ') return openOrdoPopup(state)
    return state
  }
  if (event.key === 'Escape') {
    return { ...state, open: false, announcement: 'Ordo command menu closed' }
  }
  if (event.key === 'ArrowDown') {
    const focusedIndex = (state.focusedIndex + 1) % state.items.length
    return { ...state, focusedIndex, announcement: announceItem(state.items[focusedIndex]) }
  }
  if (event.key === 'ArrowUp') {
    const focusedIndex = (state.focusedIndex - 1 + state.items.length) % state.items.length
    return { ...state, focusedIndex, announcement: announceItem(state.items[focusedIndex]) }
  }
  return state
}

export function selectOrdoPopupItem(state: OrdoPopupStateV1): {
  readonly state: OrdoPopupStateV1
  readonly line?: string
} {
  const item = state.items[state.focusedIndex]
  if (item === undefined || item.disabled) {
    return {
      state: {
        ...state,
        announcement: item === undefined ? 'No command selected' : `${item.label} unavailable. ${item.reason ?? ''}`.trim(),
      },
    }
  }
  return {
    state: {
      ...state,
      open: false,
      panelFocused: true,
      announcement: `Submitted ${item.line}. Agent Ops panel focused.`,
    },
    line: item.line,
  }
}

export function announceItem(item: OrdoPopupItemV1 | undefined): string {
  if (item === undefined) return 'Ordo command menu'
  if (item.disabled) return `${item.label} unavailable. ${item.reason ?? ''}`.trim()
  return `${item.label}. ${item.line}`
}

export function canSubmitOrdoPopupMutation(snapshot: OrdoAgentOpsSnapshot): boolean {
  return mutationBlockReason(snapshot) === undefined
}
