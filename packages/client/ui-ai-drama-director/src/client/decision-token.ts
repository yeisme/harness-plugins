/**
 * Shared decision-token consumer (exception-director 2.1/2.2).
 *
 * Wraps the owner's PaneAction contract: every submission must first render
 * the exact preview (target/effect/owner/expiry) and commit through the
 * server-minted opaque descriptor ref (CAS echo). Receipt refresh is
 * idempotent — terminal receipts return as-is, already_decided only
 * refetches, and digest/context-revision drift returns stale with
 * mutations disabled. No local approval state machine is built.
 *
 * @module @yeisme/dsh-client-ui-ai-drama-director/client
 */

/** The five decision families this surface consumes. */
export type DecisionActionKind = 'cost' | 'rights' | 'canonical-accept' | 'external-edit-apply' | 'final-export'

export interface DecisionDescriptorLike {
  readonly descriptorRef: string
  readonly owner: string
  readonly actionId: string
  readonly targetRef: string
  readonly targetVersion: string
  readonly expiresAt: string
  readonly confirmation: 'none' | 'confirm' | 'approval'
  readonly preview: {
    readonly summary: string
    readonly cost?: { readonly currency: string; readonly amount: number; readonly estimate: boolean } | undefined
    readonly rights?: { readonly status: 'clear' | 'review_required' | 'blocked' | 'unknown'; readonly summary: string } | undefined
  }
}

export type DecisionSubmissionState = 'submittable' | 'expired' | 'missing-token' | 'preview-inconsistent'

export interface DecisionTokenViewV1 {
  readonly kind: DecisionActionKind
  readonly token: string | undefined
  readonly owner: string
  readonly actionId: string
  readonly target: { readonly ref: string; readonly version: string }
  readonly expiresAt: string
  readonly state: DecisionSubmissionState
  readonly mutationsDisabled: boolean
  readonly disabledReason: string | undefined
  readonly summary: string
}

/** True when the preview carries the fields its declared kind requires. */
function previewConsistent(kind: DecisionActionKind, preview: DecisionDescriptorLike['preview']): boolean {
  if (kind === 'cost') return preview.cost !== undefined
  if (kind === 'rights') return preview.rights !== undefined
  return true
}

/** Derives the submission view: expiry gate + token presence + preview consistency. */
export function deriveDecisionTokenView(
  kind: DecisionActionKind,
  descriptor: DecisionDescriptorLike,
  now = Date.now(),
): DecisionTokenViewV1 {
  let state: DecisionSubmissionState = 'submittable'
  let disabledReason: string | undefined
  if (descriptor.descriptorRef === '') { state = 'missing-token'; disabledReason = 'owner did not mint a decision token' }
  else if (!Number.isFinite(Date.parse(descriptor.expiresAt)) || Date.parse(descriptor.expiresAt) <= now) {
    state = 'expired'
    disabledReason = `token expired at ${descriptor.expiresAt}`
  } else if (!previewConsistent(kind, descriptor.preview)) {
    state = 'preview-inconsistent'
    disabledReason = `preview is missing the ${kind} facts`
  }
  return {
    kind,
    token: state === 'missing-token' ? undefined : descriptor.descriptorRef,
    owner: descriptor.owner,
    actionId: descriptor.actionId,
    target: { ref: descriptor.targetRef, version: descriptor.targetVersion },
    expiresAt: descriptor.expiresAt,
    state,
    mutationsDisabled: state !== 'submittable',
    disabledReason,
    summary: descriptor.preview.summary,
  }
}

/** Builds the CAS request: the minted token ref echoes verbatim. */
export function buildDecisionRequest(
  view: DecisionTokenViewV1,
  input: { readonly context: Record<string, unknown>; readonly values: Record<string, unknown>; readonly idempotencyKey: string },
): { readonly request: Record<string, unknown> } | { readonly error: string } {
  if (view.mutationsDisabled || view.token === undefined) {
    return { error: view.disabledReason ?? 'decision not submittable' }
  }
  if (input.idempotencyKey.length < 8 || input.idempotencyKey.length > 160) {
    return { error: 'idempotency key must be 8-160 characters' }
  }
  return {
    request: {
      schema: 'pane.action-request.v1alpha1',
      descriptorRef: view.token,
      owner: view.owner,
      actionId: view.actionId,
      expectedTargetRef: view.target.ref,
      expectedTargetVersion: view.target.version,
      context: input.context,
      idempotencyKey: input.idempotencyKey,
      values: input.values,
    },
  }
}

export type DecisionRefreshDrift = {
  readonly digestChanged?: boolean | undefined
  readonly contextRevisionChanged?: boolean | undefined
  readonly ownerReportsAlreadyDecided?: boolean | undefined
}

/** Idempotent receipt refresh decision; never a local approval state machine. */
export function refreshDecisionOutcome(
  previousReceipt: { readonly status: string } | undefined,
  drift: DecisionRefreshDrift = {},
): { readonly action: 'return-original' | 'refetch' | 'stale-disable' } {
  if (drift.digestChanged === true || drift.contextRevisionChanged === true) {
    return { action: 'stale-disable' }
  }
  if (previousReceipt !== undefined && previousReceipt.status === 'ok') {
    return { action: 'return-original' }
  }
  if (drift.ownerReportsAlreadyDecided === true) {
    return { action: 'refetch' }
  }
  return { action: 'refetch' }
}
