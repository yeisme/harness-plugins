/**
 * Exception-first default projection (exception-director 1.2/1.3).
 *
 * Derives the `/drama` landing view from owner projections only: current
 * context, the sorted primary blocker (with a count — never a wall of
 * blockers), impact scope, the owner reason, one owner-approved next
 * action, and Review/Run/Delivery deep links. Typed degradation states
 * disable mutation; no retries, no writer replacement, no inferred owner
 * terminal states.
 *
 * @module @yeisme/dsh-client-ui-ai-drama-director/client
 */

export type ExceptionProjectionState =
  | 'ready'
  | 'unknown'
  | 'partial'
  | 'stale'
  | 'owner-unavailable'

export interface ExceptionFirstProjectionInput {
  /** Owner snapshot freshness/state (typed, not inferred). */
  readonly state?: 'ready' | 'stale' | 'partial' | 'unknown' | 'offline' | undefined
  readonly showTitle?: string | undefined
  readonly showRef?: string | undefined
  /** Safe owner message — the only reason text ever displayed. */
  readonly safeMessage?: string | undefined
  /** Owner-issued opaque blocker refs (already safe tokens). */
  readonly blockerRefs?: readonly string[] | undefined
  /** Impact scope: episode refs from delivery items carrying blockers. */
  readonly impactedEpisodeRefs?: readonly string[] | undefined
  /** Owner-authored next actions; only the first approved one surfaces. */
  readonly actions?: readonly { readonly actionId: string; readonly label: string; readonly kind: string; readonly disabledReason?: string | undefined }[] | undefined
}

export interface ExceptionFirstProjectionV1 {
  readonly state: ExceptionProjectionState
  readonly showTitle: string | undefined
  readonly showRef: string | undefined
  readonly primaryBlocker: { readonly ref: string; readonly remaining: number } | undefined
  readonly impactScopeCount: number
  readonly ownerReason: string | undefined
  readonly nextAction: { readonly actionId: string; readonly label: string; readonly disabled: boolean; readonly disabledReason: string | undefined } | undefined
  readonly deepLinks: { readonly review: 'drama.review'; readonly run: 'drama.run'; readonly delivery: 'drama.delivery' }
  readonly mutationsDisabled: boolean
  readonly workbenchDeepLink: boolean
}

const DEGRADATION: Readonly<Record<string, ExceptionProjectionState>> = {
  ready: 'ready',
  stale: 'stale',
  partial: 'partial',
  unknown: 'unknown',
  offline: 'owner-unavailable',
}

/** Pure derivation: multiple blockers collapse to the sorted first + count. */
export function deriveExceptionFirstProjection(input: ExceptionFirstProjectionInput): ExceptionFirstProjectionV1 {
  const state = DEGRADATION[input.state ?? 'unknown'] ?? 'unknown'
  const mutationsDisabled = state !== 'ready'
  const blockers = [...(input.blockerRefs ?? [])].filter(ref => ref !== '').sort((left, right) => left.localeCompare(right))
  const primaryBlocker = blockers.length === 0 ? undefined : { ref: blockers[0]!, remaining: blockers.length - 1 }
  const approved = (input.actions ?? []).find(action => action.disabledReason === undefined)
  return {
    state,
    showTitle: input.showTitle,
    showRef: input.showRef,
    primaryBlocker,
    impactScopeCount: new Set(input.impactedEpisodeRefs ?? []).size,
    ownerReason: input.safeMessage === '' ? undefined : input.safeMessage,
    nextAction: (input.actions ?? []).length === 0 ? undefined : {
      actionId: approved?.actionId ?? (input.actions ?? [])[0]!.actionId,
      label: approved?.label ?? (input.actions ?? [])[0]!.label,
      disabled: mutationsDisabled || approved === undefined,
      disabledReason: approved?.disabledReason ?? (input.actions ?? [])[0]!.disabledReason ?? (mutationsDisabled ? `state:${state}` : undefined),
    },
    deepLinks: { review: 'drama.review', run: 'drama.run', delivery: 'drama.delivery' },
    mutationsDisabled,
    workbenchDeepLink: blockers.length > 1,
  }
}
