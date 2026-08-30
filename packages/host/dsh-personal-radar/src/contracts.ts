/**
 * DSH Personal Drama Radar contracts.
 *
 * Host-owned types for typed /drama radar intents, the badge/Pane status
 * model, and the safe Workbench handoff. The plugin must not carry argv
 * beyond the fixed Radar MCP argv, raw prompts, provider payloads,
 * credentials, audit rows, or absolute paths.
 */

export const RADAR_HANDOFF_SPEC = 'radar.mcp.handoff.v1' as const
export const RADAR_INTENT_SCHEMA = 'dsh.radar.intent.v1' as const
export const RADAR_PROJECTION_SCHEMA = 'dsh.radar.projection.v1' as const
export const RADAR_RECEIPT_SCHEMA = 'dsh.radar.receipt.v1' as const
export const RADAR_WORKBENCH_HANDOFF_SCHEMA = 'dsh.radar.workbench-handoff.v1' as const
export const RADAR_PROPOSAL_SCHEMA = 'dsh.radar.proposal-draft.v1' as const
export const RADAR_EVIDENCE_SCHEMA = 'dsh.radar.evidence.v1' as const

export const RADAR_LANES = ['reader', 'curator', 'operator'] as const
export type RadarLane = (typeof RADAR_LANES)[number]

export const RADAR_INTENT_KINDS = [
  'open',
  'save',
  'dismiss',
  'compare',
  'proposal',
  'workbench',
  'refresh',
] as const
export type RadarIntentKind = (typeof RADAR_INTENT_KINDS)[number]

/**
 * Pane/badge status model. Every non-ready status carries a safe next
 * action; status is always expressed as text + icon, never color only.
 */
export const RADAR_STATUSES = [
  'ready',
  'empty',
  'degraded',
  'stale',
  'offline',
  'permission_denied',
  'contract_mismatch',
  'action_pending',
  'reconcile_required',
] as const
export type RadarStatus = (typeof RADAR_STATUSES)[number]

export const RADAR_DISABLED_REASONS = [
  'needs_radar',
  'contract_mismatch',
  'seam_unavailable',
  'capability_blocked',
  'permission_denied',
  'unregistered_intent',
  'lane_violation',
  'missing_ref',
  'missing_confirmation',
  'unsafe_ref',
] as const
export type RadarDisabledReason = (typeof RADAR_DISABLED_REASONS)[number]

export interface RadarIntentV1 {
  readonly schema: typeof RADAR_INTENT_SCHEMA
  readonly kind: RadarIntentKind
  /** Opportunity refs for open/save/dismiss/compare/proposal; empty for refresh. */
  readonly opportunityRefs: readonly string[]
  /** Edition ref for workbench handoff when the user targets an edition. */
  readonly editionRef?: string
  /** Deterministic idempotency key derived from kind + refs. */
  readonly idempotencyKey: string
  /** refresh requires an explicit user confirmation before dispatch. */
  readonly confirmed: boolean
}

export interface RadarOpportunityProjectionV1 {
  readonly opportunityRef: string
  readonly title: string
  readonly marketScore: number
  readonly personalFit: number
  readonly riskScore: number
  readonly reasons: readonly string[]
  readonly knownLimitations: readonly string[]
  readonly isNew: boolean
  readonly saved: boolean
}

/** Bounded safe projection the host may pass to the browser/DSH side. */
export interface RadarProjectionV1 {
  readonly schema: typeof RADAR_PROJECTION_SCHEMA
  readonly editionRef: string
  readonly profileRevision: string
  readonly opportunities: readonly RadarOpportunityProjectionV1[]
  readonly status: RadarStatus
  /** Milliseconds since the edition was built; drives freshness text. */
  readonly ageMs: number
  readonly observedAt: number
}

export type RadarReceiptOutcome = 'submitted' | 'unknown' | 'rejected' | 'reconciled'

export interface RadarActionReceiptV1 {
  readonly schema: typeof RADAR_RECEIPT_SCHEMA
  readonly idempotencyKey: string
  readonly outcome: RadarReceiptOutcome
  readonly reason: string
  readonly runRef?: string
  readonly feedbackRef?: string
  readonly editionRef?: string
}

export interface PersonalRadarOpportunityHandoffV1 {
  readonly schema: typeof RADAR_WORKBENCH_HANDOFF_SCHEMA
  readonly opportunityRef?: string
  readonly editionRef?: string
  readonly profileRevision: string
  readonly reasonRefs: readonly string[]
  readonly evidenceRefs: readonly string[]
  readonly expiresAt: number
  readonly nonce: string
}

export type RadarProposalStatus = 'pending_review' | 'refresh_required'

export interface RadarProposalDraftV1 {
  readonly schema: typeof RADAR_PROPOSAL_SCHEMA
  readonly opportunityRef: string
  readonly profileRevision: string
  readonly reasonRefs: readonly string[]
  readonly evidenceRefs: readonly string[]
  readonly knownLimitations: readonly string[]
  readonly targetOwner: string
  readonly status: RadarProposalStatus
}

const OPAQUE = /^[A-Za-z0-9._~:-]{1,160}$/
const UNSAFE = /(?:^|[:/\\])(?:etc|home|usr|var)|file:\/\/|authorization|cookie|token|secret|password|-----BEGIN|\s--|https?:\/\//i

export function isSafeRadarRef(value: string): boolean {
  return OPAQUE.test(value) && !UNSAFE.test(value) && !value.startsWith('/')
}

function blobUnsafe(value: unknown): boolean {
  return UNSAFE.test(JSON.stringify(value))
}

export function isRadarLane(value: unknown): value is RadarLane {
  return typeof value === 'string' && (RADAR_LANES as readonly string[]).includes(value)
}

export function isRadarIntentKind(value: unknown): value is RadarIntentKind {
  return typeof value === 'string' && (RADAR_INTENT_KINDS as readonly string[]).includes(value)
}

export function isRadarStatus(value: unknown): value is RadarStatus {
  return typeof value === 'string' && (RADAR_STATUSES as readonly string[]).includes(value)
}

export function validateRadarIntent(input: unknown): input is RadarIntentV1 {
  if (input === null || typeof input !== 'object') return false
  const value = input as Partial<RadarIntentV1>
  if (value.schema !== RADAR_INTENT_SCHEMA) return false
  if (!isRadarIntentKind(value.kind)) return false
  if (!Array.isArray(value.opportunityRefs)) return false
  for (const ref of value.opportunityRefs) {
    if (typeof ref !== 'string' || !isSafeRadarRef(ref)) return false
  }
  if (value.editionRef !== undefined && (typeof value.editionRef !== 'string' || !isSafeRadarRef(value.editionRef))) return false
  if (typeof value.idempotencyKey !== 'string' || !isSafeRadarRef(value.idempotencyKey)) return false
  if (typeof value.confirmed !== 'boolean') return false
  return !blobUnsafe(input)
}

export function validateRadarProjection(input: unknown): input is RadarProjectionV1 {
  if (input === null || typeof input !== 'object') return false
  const value = input as Partial<RadarProjectionV1>
  if (value.schema !== RADAR_PROJECTION_SCHEMA) return false
  if (typeof value.editionRef !== 'string' || !isSafeRadarRef(value.editionRef)) return false
  if (typeof value.profileRevision !== 'string' || !isSafeRadarRef(value.profileRevision)) return false
  if (!isRadarStatus(value.status)) return false
  if (typeof value.ageMs !== 'number' || !Number.isFinite(value.ageMs) || value.ageMs < 0) return false
  if (typeof value.observedAt !== 'number' || !Number.isSafeInteger(value.observedAt)) return false
  if (!Array.isArray(value.opportunities)) return false
  for (const opportunity of value.opportunities) {
    if (typeof opportunity.opportunityRef !== 'string' || !isSafeRadarRef(opportunity.opportunityRef)) return false
  }
  return !blobUnsafe(input)
}

export function validateRadarReceipt(input: unknown): input is RadarActionReceiptV1 {
  if (input === null || typeof input !== 'object') return false
  const value = input as Partial<RadarActionReceiptV1>
  if (value.schema !== RADAR_RECEIPT_SCHEMA) return false
  if (typeof value.idempotencyKey !== 'string' || !isSafeRadarRef(value.idempotencyKey)) return false
  if (value.outcome !== 'submitted' && value.outcome !== 'unknown' && value.outcome !== 'rejected' && value.outcome !== 'reconciled') return false
  if (typeof value.reason !== 'string' || value.reason.length === 0) return false
  return !blobUnsafe(input)
}

export function validateRadarWorkbenchHandoff(input: unknown): input is PersonalRadarOpportunityHandoffV1 {
  if (input === null || typeof input !== 'object') return false
  const value = input as Partial<PersonalRadarOpportunityHandoffV1>
  if (value.schema !== RADAR_WORKBENCH_HANDOFF_SCHEMA) return false
  if (value.opportunityRef !== undefined && (typeof value.opportunityRef !== 'string' || !isSafeRadarRef(value.opportunityRef))) return false
  if (value.editionRef !== undefined && (typeof value.editionRef !== 'string' || !isSafeRadarRef(value.editionRef))) return false
  if (typeof value.profileRevision !== 'string' || !isSafeRadarRef(value.profileRevision)) return false
  if (!Array.isArray(value.reasonRefs) || !Array.isArray(value.evidenceRefs)) return false
  if (typeof value.expiresAt !== 'number' || !Number.isSafeInteger(value.expiresAt)) return false
  if (typeof value.nonce !== 'string' || !isSafeRadarRef(value.nonce)) return false
  return !blobUnsafe(input)
}

export function validateRadarProposalDraft(input: unknown): input is RadarProposalDraftV1 {
  if (input === null || typeof input !== 'object') return false
  const value = input as Partial<RadarProposalDraftV1>
  if (value.schema !== RADAR_PROPOSAL_SCHEMA) return false
  if (typeof value.opportunityRef !== 'string' || !isSafeRadarRef(value.opportunityRef)) return false
  if (typeof value.profileRevision !== 'string' || !isSafeRadarRef(value.profileRevision)) return false
  if (!Array.isArray(value.reasonRefs) || !Array.isArray(value.evidenceRefs) || !Array.isArray(value.knownLimitations)) return false
  if (typeof value.targetOwner !== 'string' || !isSafeRadarRef(value.targetOwner)) return false
  if (value.status !== 'pending_review' && value.status !== 'refresh_required') return false
  return !blobUnsafe(input)
}

/** Unknown/timeout/disconnect outcomes never auto-replay. */
export function shouldAutoReplayRadarIntent(): false {
  return false
}
