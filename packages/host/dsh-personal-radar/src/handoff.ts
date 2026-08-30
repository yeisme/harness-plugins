/**
 * Workbench handoff and proposal drafts.
 *
 * Handoff deep-links carry only safe typed refs (edition/opportunity/profile
 * revision + reason/evidence refs); the Workbench target re-reads the owner
 * projection and verifies freshness. Proposal drafts stay pending review —
 * no canonical project is created until a human accepts and the target
 * owner writes its own receipt.
 */

import {
  RADAR_PROPOSAL_SCHEMA,
  RADAR_WORKBENCH_HANDOFF_SCHEMA,
  isSafeRadarRef,
  type PersonalRadarOpportunityHandoffV1,
  type RadarProposalDraftV1,
} from './contracts.js'

export const RADAR_HANDOFF_TTL_MS = 10 * 60 * 1000

export interface RadarHandoffInputV1 {
  readonly opportunityRef?: string
  readonly editionRef?: string
  readonly profileRevision: string
  readonly reasonRefs?: readonly string[]
  readonly evidenceRefs?: readonly string[]
}

export interface RadarHandoffOptionsV1 {
  readonly now?: () => number
  readonly nonce?: () => string
}

function defaultNonce(now: number, seed: string): string {
  return `nonce-${now}-${seed}`
}

export function createRadarWorkbenchHandoff(
  input: RadarHandoffInputV1,
  options: RadarHandoffOptionsV1 = {},
): PersonalRadarOpportunityHandoffV1 | { readonly ok: false; readonly reason: string } {
  if (input.opportunityRef === undefined && input.editionRef === undefined) {
    return { ok: false, reason: 'handoff needs an opportunity or edition ref' }
  }
  for (const ref of [input.opportunityRef, input.editionRef, input.profileRevision]) {
    if (ref !== undefined && !isSafeRadarRef(ref)) {
      return { ok: false, reason: `unsafe handoff ref ${ref}` }
    }
  }
  const now = options.now?.() ?? Date.now()
  const nonce = options.nonce?.() ?? defaultNonce(now, input.opportunityRef ?? input.editionRef ?? 'edition')
  return {
    schema: RADAR_WORKBENCH_HANDOFF_SCHEMA,
    ...(input.opportunityRef === undefined ? {} : { opportunityRef: input.opportunityRef }),
    ...(input.editionRef === undefined ? {} : { editionRef: input.editionRef }),
    profileRevision: input.profileRevision,
    reasonRefs: input.reasonRefs ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    expiresAt: now + RADAR_HANDOFF_TTL_MS,
    nonce,
  }
}

/** Stale profile revisions never silently re-point: the handoff fails closed. */
export function verifyRadarHandoffFreshness(
  handoff: PersonalRadarOpportunityHandoffV1,
  activeProfileRevision: string,
): { readonly ok: boolean; readonly reason: string } {
  if (handoff.profileRevision !== activeProfileRevision) {
    return { ok: false, reason: 'profile revision is stale; review the historical context or return to the latest edition' }
  }
  return { ok: true, reason: 'handoff profile revision matches the active revision' }
}

export interface RadarProposalInputV1 {
  readonly opportunityRef: string
  readonly profileRevision: string
  readonly activeProfileRevision: string
  readonly reasonRefs?: readonly string[]
  readonly evidenceRefs?: readonly string[]
  readonly knownLimitations?: readonly string[]
  readonly targetOwner: string
  readonly editionStale?: boolean
}

/**
 * Create a pending-review proposal draft. A stale profile or edition flips
 * the draft to `refresh_required` instead of silently updating references.
 */
export function createRadarProposalDraft(input: RadarProposalInputV1): RadarProposalDraftV1 | { readonly ok: false; readonly reason: string } {
  if (!isSafeRadarRef(input.opportunityRef) || !isSafeRadarRef(input.profileRevision) || !isSafeRadarRef(input.targetOwner)) {
    return { ok: false, reason: 'proposal refs failed the safety check' }
  }
  const stale = input.profileRevision !== input.activeProfileRevision || input.editionStale === true
  return {
    schema: RADAR_PROPOSAL_SCHEMA,
    opportunityRef: input.opportunityRef,
    profileRevision: input.profileRevision,
    reasonRefs: input.reasonRefs ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    knownLimitations: input.knownLimitations ?? [],
    targetOwner: input.targetOwner,
    status: stale ? 'refresh_required' : 'pending_review',
  }
}
