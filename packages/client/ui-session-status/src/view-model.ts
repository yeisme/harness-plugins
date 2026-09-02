/**
 * Shared view model for capsule, popover, pane, and /status.
 * Presentation only: no ledger math, no quota invention.
 */

import type {
  SessionStatusSnapshotV1,
  SourceStatus,
} from './wire.ts'

export type ContextTone = 'neutral' | 'warning' | 'critical'
export type StatusSurface = 'popover' | 'pane' | 'safe-text'

export interface SessionStatusViewModel {
  readonly revision: number
  readonly freshness: SessionStatusSnapshotV1['freshness']
  readonly status: SessionStatusSnapshotV1['status']
  readonly capsuleLabel: string
  readonly capsuleTone: ContextTone
  readonly lifecyclePriority: boolean
  readonly sessionLabel: string
  readonly sessionRef: string
  readonly runtimeLine: string | null
  readonly contextLine: string
  readonly contextTone: ContextTone
  readonly compactSuggested: boolean
  readonly popoverLimits: readonly { readonly label: string; readonly text: string }[]
  readonly paneLimits: readonly { readonly label: string; readonly text: string; readonly message: string }[]
  readonly tokensDeepLink: 'token-usage-open'
  readonly activityDeepLink: 'workspace.command-activity'
  readonly safeText: string
  readonly available: boolean
}

export function contextTone(remainingRatio: number | undefined, status: SourceStatus): ContextTone {
  if (status === 'unavailable' || status === 'unsupported' || remainingRatio === undefined) {
    return 'neutral'
  }
  if (remainingRatio <= 0.10) return 'critical'
  if (remainingRatio <= 0.25) return 'warning'
  return 'neutral'
}

function percent(ratio: number | undefined): string | null {
  if (ratio === undefined) return null
  return `${Math.round(ratio * 100)}%`
}

export function deriveSessionStatusViewModel(snapshot: SessionStatusSnapshotV1): SessionStatusViewModel {
  const lifecyclePriority = snapshot.session.lifecycle === 'waiting_approval'
    || snapshot.session.lifecycle === 'error'
    || snapshot.session.lifecycle === 'offline'
  const tone = contextTone(snapshot.context.remainingRatio, snapshot.context.status)
  const remaining = percent(snapshot.context.remainingRatio)
  const capsuleLabel = lifecyclePriority
    ? snapshot.session.lifecycle.replace('_', ' ')
    : remaining === null
      ? snapshot.context.safeMessage
      : `Context ${remaining}`
  const runtime = snapshot.runtime
  const runtimeParts = [
    runtime?.modelLabel,
    runtime?.presetLabel,
    runtime?.reasoningLabel,
    runtime?.permissionLabel,
  ].filter((part): part is string => part !== undefined)
  const paneLimits = snapshot.limits.map(limit => ({
    label: limit.label,
    text: percent(limit.remainingRatio) ?? limit.status,
    message: limit.safeMessage,
  }))
  const used = snapshot.context.usedTokens
  const limit = snapshot.context.limitTokens
  const contextLine = remaining === null
    ? snapshot.context.safeMessage
    : used !== undefined && limit !== undefined
      ? `${used}/${limit} · ${remaining} remaining`
      : `${remaining} remaining`
  return {
    revision: snapshot.revision,
    freshness: snapshot.freshness,
    status: snapshot.status,
    capsuleLabel,
    capsuleTone: lifecyclePriority ? 'warning' : tone,
    lifecyclePriority,
    sessionLabel: snapshot.session.label,
    sessionRef: snapshot.session.sessionRef,
    runtimeLine: runtimeParts.length === 0 ? null : runtimeParts.join(' · '),
    contextLine,
    contextTone: tone,
    compactSuggested: tone !== 'neutral' && snapshot.context.status === 'ready',
    popoverLimits: paneLimits.slice(0, 2),
    paneLimits,
    tokensDeepLink: 'token-usage-open',
    activityDeepLink: 'workspace.command-activity',
    safeText: [
      snapshot.session.label,
      capsuleLabel,
      contextLine,
      snapshot.context.safeMessage,
    ].join(' · '),
    available: snapshot.status !== 'unavailable',
  }
}

export function statusSurfaceFallback(input: {
  readonly headerAvailable: boolean
  readonly paneAvailable: boolean
}): StatusSurface {
  if (input.headerAvailable) return 'popover'
  if (input.paneAvailable) return 'pane'
  return 'safe-text'
}

/** Capsule / Popover / Pane share one view model; Tokens and Activity stay deep links. */
export function sessionStatusSurfaces(view: SessionStatusViewModel): {
  readonly capsule: { readonly label: string; readonly tone: ContextTone }
  readonly popover: {
    readonly sessionLabel: string
    readonly contextLine: string
    readonly limits: SessionStatusViewModel['popoverLimits']
    readonly tokensDeepLink: 'token-usage-open'
    readonly activityDeepLink: 'workspace.command-activity'
  }
  readonly pane: {
    readonly sessionLabel: string
    readonly contextLine: string
    readonly limits: SessionStatusViewModel['paneLimits']
    readonly tokensDeepLink: 'token-usage-open'
    readonly activityDeepLink: 'workspace.command-activity'
  }
} {
  return {
    capsule: { label: view.capsuleLabel, tone: view.capsuleTone },
    popover: {
      sessionLabel: view.sessionLabel,
      contextLine: view.contextLine,
      limits: view.popoverLimits,
      tokensDeepLink: view.tokensDeepLink,
      activityDeepLink: view.activityDeepLink,
    },
    pane: {
      sessionLabel: view.sessionLabel,
      contextLine: view.contextLine,
      limits: view.paneLimits,
      tokensDeepLink: view.tokensDeepLink,
      activityDeepLink: view.activityDeepLink,
    },
  }
}
