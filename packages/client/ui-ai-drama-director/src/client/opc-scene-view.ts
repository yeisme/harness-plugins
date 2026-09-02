/**
 * DSH-local OPC scene package exception view model (opc-scene 1.2).
 *
 * Read-only derivation over a validated Scaena OPC scene package summary:
 * answers Now (context), Why (blocker plus gates), Next (one primary action)
 * and projects exception cards, reframe/depth/role semantics, delivery, and
 * handoff details. The model never persists domain state, never recomputes
 * owner readiness or actions, never synthesizes a local retry, and disables
 * mutations with a typed reason whenever owner facts are unavailable.
 *
 * @module @yeisme/dsh-client-ui-ai-drama-director/client
 */

import type {
  OpcSceneActionDescriptorV1,
  OpcSceneAspectV1,
  OpcSceneDeliveryV1,
  OpcSceneEvidenceBlockV1,
  OpcSceneExceptionFindingV1,
  OpcSceneExceptionKindV1,
  OpcSceneFreshnessV1,
  OpcSceneGateV1,
  OpcScenePackageSummaryV1alpha1,
  OpcSceneReceiptRefV1,
  OpcSceneReframeVariantV1,
} from '@yeisme/dsh-ai-drama-director'

export type OpcSceneViewState =
  | 'clear'
  | 'exception'
  | 'partial'
  | 'stale'
  | 'offline'
  | 'unknown'
  | 'contract_mismatch'

export type OpcSceneCardKind = OpcSceneExceptionKindV1 | 'contract_mismatch'

export interface OpcSceneProjectedActionV1 {
  readonly actionId: string
  readonly label: string
  readonly targetRef: string
  readonly expectedVersion: string
  readonly sideEffectClass: OpcSceneActionDescriptorV1['sideEffectClass']
  readonly requiresConfirmation: boolean
  readonly idempotencyKey: string
  readonly cliDetail: string | undefined
  readonly apiDetail: string | undefined
  readonly enabled: boolean
  readonly disabledReason: string | undefined
}

export interface OpcSceneExceptionCardV1 {
  readonly kind: OpcSceneCardKind
  readonly affectedRef: string
  readonly packageVersion: string
  readonly reasonCode: string
  readonly evidenceRefs: readonly string[]
  readonly recoveryAction: OpcSceneProjectedActionV1 | undefined
  readonly reconcileRef: string | undefined
}

export interface OpcSceneProjectedReframeV1 {
  readonly aspect: OpcSceneAspectV1
  readonly depth: OpcSceneReframeVariantV1['depth']
  readonly status: OpcSceneReframeVariantV1['status']
  readonly reason: string
  readonly impact: string
  readonly costEnvelope: string
  /** Cinematic depth is a shared-contract value needing explicit upgrade confirmation. */
  readonly requiresUpgradeConfirmation: boolean
  readonly action: OpcSceneProjectedActionV1 | undefined
}

export interface OpcSceneRoleLabelV1 {
  readonly role: string
}

/** Detail-only Skill identity; never part of the primary role list. */
export interface OpcSceneRoleDetailV1 {
  readonly role: string
  readonly name: string | undefined
  readonly version: string | undefined
  readonly digest: string | undefined
}

export interface OpcSceneContextSectionV1 {
  readonly showRef: string
  readonly episodeRef: string
  readonly sceneRef: string
  readonly packageRef: string
  readonly packageVersion: string
  readonly stage: string
  readonly readiness: OpcScenePackageSummaryV1alpha1['readiness']
  readonly observedAt: number
}

export interface DramaScenePackageExceptionView {
  readonly state: OpcSceneViewState
  readonly mutationsEnabled: boolean
  readonly context: OpcSceneContextSectionV1 | undefined
  readonly gates: readonly OpcSceneGateV1[]
  readonly exceptionCards: readonly OpcSceneExceptionCardV1[]
  readonly primaryAction: OpcSceneProjectedActionV1 | undefined
  readonly aspect: { readonly primary: OpcSceneAspectV1 } | undefined
  readonly reframes: readonly OpcSceneProjectedReframeV1[]
  readonly roles: readonly OpcSceneRoleLabelV1[]
  readonly rolesDetail: readonly OpcSceneRoleDetailV1[]
  readonly evidence: OpcSceneEvidenceBlockV1 | undefined
  readonly delivery: OpcSceneDeliveryV1 | undefined
  readonly deliveryNotes: readonly string[]
  readonly receipts: readonly OpcSceneReceiptRefV1[]
  readonly handoff: { readonly workbenchDeepLink: string; readonly cliDetail: string | undefined; readonly apiDetail: string | undefined } | undefined
}

export interface OpcSceneViewInput {
  /** Latest validated owner summary; absent means no observation yet. */
  readonly summary?: OpcScenePackageSummaryV1alpha1 | undefined
  /** Last-known safe summary kept for degraded states (never mutated). */
  readonly lastKnownSummary?: OpcScenePackageSummaryV1alpha1 | undefined
  /** Set when the latest fetch failed contract validation. */
  readonly contractMismatch?: boolean | undefined
}

const FRESHNESS_STATE: Readonly<Record<OpcSceneFreshnessV1, OpcSceneViewState | 'clear'>> = {
  fresh: 'clear',
  stale: 'stale',
  partial: 'partial',
  unknown: 'unknown',
  offline: 'offline',
}

function projectAction(
  descriptor: OpcSceneActionDescriptorV1,
  mutationsEnabled: boolean,
): OpcSceneProjectedActionV1 {
  return {
    actionId: descriptor.actionId,
    label: descriptor.label,
    targetRef: descriptor.targetRef,
    expectedVersion: descriptor.expectedVersion,
    sideEffectClass: descriptor.sideEffectClass,
    requiresConfirmation: descriptor.requiresConfirmation,
    idempotencyKey: descriptor.idempotencyKey,
    cliDetail: descriptor.cliDetail,
    apiDetail: descriptor.apiDetail,
    enabled: mutationsEnabled,
    disabledReason: mutationsEnabled ? undefined : 'state:mutations_disabled',
  }
}

function stateCard(kind: OpcSceneCardKind, reasonCode: string, summary: OpcScenePackageSummaryV1alpha1): OpcSceneExceptionCardV1 {
  return {
    kind,
    affectedRef: summary.sceneRef,
    packageVersion: summary.packageVersion,
    reasonCode,
    evidenceRefs: [],
    recoveryAction: undefined,
    reconcileRef: undefined,
  }
}

function deliveryNotes(delivery: OpcSceneDeliveryV1): readonly string[] {
  const notes: string[] = []
  if (delivery.packaging === 'partial') notes.push('partial_package: production_ready=false')
  if (delivery.checksumStatus === 'mismatch') notes.push('checksum_mismatch: owner recovery required')
  if (delivery.grant?.status === 'expired') notes.push('grant_expired: reacquire grant only')
  return notes
}

/**
 * Pure derivation. The projection copies owner facts verbatim: readiness,
 * gates, actions, and receipts are only annotated or disabled — never
 * recomputed, replaced, or auto-retried.
 */
export function deriveDramaScenePackageExceptionView(input: OpcSceneViewInput): DramaScenePackageExceptionView {
  const base = input.summary ?? input.lastKnownSummary
  if (input.contractMismatch) {
    return {
      state: 'contract_mismatch',
      mutationsEnabled: false,
      context: base === undefined ? undefined : contextOf(base),
      gates: [],
      exceptionCards: base === undefined ? [] : [stateCard('contract_mismatch', 'state:contract_mismatch', base)],
      primaryAction: undefined,
      aspect: undefined,
      reframes: [],
      roles: [],
      rolesDetail: [],
      evidence: undefined,
      delivery: undefined,
      deliveryNotes: [],
      receipts: [],
      handoff: undefined,
    }
  }
  if (input.summary === undefined) {
    return {
      state: 'unknown',
      mutationsEnabled: false,
      context: base === undefined ? undefined : contextOf(base),
      gates: base?.gates ?? [],
      exceptionCards: base === undefined ? [] : [stateCard('unknown', 'state:no_observation', base)],
      primaryAction: undefined,
      aspect: undefined,
      reframes: [],
      roles: base?.roles.map(role => ({ role: role.role })) ?? [],
      rolesDetail: detailOf(base),
      evidence: undefined,
      delivery: undefined,
      deliveryNotes: [],
      receipts: [],
      handoff: undefined,
    }
  }

  const summary = input.summary
  const freshState = FRESHNESS_STATE[summary.freshness]
  const state: OpcSceneViewState =
    freshState === 'clear'
      ? summary.exceptions.length > 0
        ? 'exception'
        : 'clear'
      : freshState
  const mutationsEnabled = state === 'clear' || state === 'exception'

  const cards: OpcSceneExceptionCardV1[] = summary.exceptions.map((finding: OpcSceneExceptionFindingV1) => ({
    kind: finding.kind,
    affectedRef: finding.affectedRef,
    packageVersion: summary.packageVersion,
    reasonCode: finding.reasonCode,
    evidenceRefs: finding.evidenceRefs,
    recoveryAction: finding.recoveryAction === undefined ? undefined : projectAction(finding.recoveryAction, mutationsEnabled),
    reconcileRef: finding.reconcileRef,
  }))
  if (!mutationsEnabled) {
    // State cards reuse the finding vocabulary: owner_offline, not a local alias.
    const stateCardKind: OpcSceneCardKind = state === 'offline' ? 'owner_offline' : state
    cards.unshift(stateCard(stateCardKind, `state:${summary.freshness}`, summary))
  }

  return {
    state,
    mutationsEnabled,
    context: contextOf(summary),
    gates: summary.gates,
    exceptionCards: cards,
    primaryAction: summary.primaryAction === undefined ? undefined : projectAction(summary.primaryAction, mutationsEnabled),
    aspect: { primary: summary.primaryAspect },
    reframes: summary.reframes.map(reframe => ({
      aspect: reframe.aspect,
      depth: reframe.depth,
      status: reframe.status,
      reason: reframe.reason,
      impact: reframe.impact,
      costEnvelope: reframe.costEnvelope,
      requiresUpgradeConfirmation: reframe.depth === 'cinematic',
      action: reframe.action === undefined ? undefined : projectAction(reframe.action, mutationsEnabled),
    })),
    roles: summary.roles.map(role => ({ role: role.role })),
    rolesDetail: detailOf(summary),
    evidence: summary.evidence,
    delivery: summary.delivery,
    deliveryNotes: deliveryNotes(summary.delivery),
    receipts: summary.receipts,
    handoff: {
      workbenchDeepLink: summary.workbenchDeepLink,
      cliDetail: summary.primaryAction?.cliDetail,
      apiDetail: summary.primaryAction?.apiDetail,
    },
  }
}

function contextOf(summary: OpcScenePackageSummaryV1alpha1): OpcSceneContextSectionV1 {
  return {
    showRef: summary.showRef,
    episodeRef: summary.episodeRef,
    sceneRef: summary.sceneRef,
    packageRef: summary.packageRef,
    packageVersion: summary.packageVersion,
    stage: summary.stage,
    readiness: summary.readiness,
    observedAt: summary.observedAt,
  }
}

function detailOf(summary: OpcScenePackageSummaryV1alpha1 | undefined): readonly OpcSceneRoleDetailV1[] {
  return summary?.roles.map(role => ({ role: role.role, name: role.name, version: role.version, digest: role.digest })) ?? []
}
