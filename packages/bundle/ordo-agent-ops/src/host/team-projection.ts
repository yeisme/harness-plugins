/**
 * Team V1 safe projection (team-hub §1).
 *
 * Browser-visible Team collaboration facts are an owner-authored projection:
 * opaque refs, bounded safe text, states, reason codes, versions, freshness,
 * and server-authored action descriptors. Nothing here connects to the Ordo
 * broker, holds credentials, or creates a domain store; the Host adapter
 * validates every field fail-closed before the projection crosses the
 * browser boundary. Default maturity is `unavailable` until the Ordo owner
 * publishes the Team V1 service (migration step 1).
 *
 * @module @yeisme/dsh-ordo-agent-ops/host
 */
import { z } from 'zod'

export const ORDO_TEAM_SNAPSHOT_SCHEMA = 'ordo.team.snapshot.v1alpha1' as const
export const ORDO_TEAM_EVENT_SCHEMA = 'ordo.team.event.v1alpha1' as const

/** Capability maturity: fake fixtures only until the Ordo owner publishes. */
export type OrdoTeamMaturity = 'unavailable' | 'fixtures' | 'live'

export interface OrdoTeamCapabilityV1 {
  readonly capability: 'ordo.team.v1'
  readonly maturity: OrdoTeamMaturity
  /** Honest reason when maturity is unavailable. */
  readonly reason?: 'owner_service_missing' | 'contract_mismatch' | 'permission_denied' | undefined
}

export type OrdoTeamTaskState = 'pending' | 'assigned' | 'running' | 'blocked' | 'completed'
export type OrdoTeamCriticality = 'normal' | 'critical'
export type OrdoTeamFreshness = 'fresh' | 'stale' | 'offline'

export interface OrdoTeamTaskV1 {
  readonly taskRef: string
  readonly title: string
  readonly state: OrdoTeamTaskState
  readonly criticality: OrdoTeamCriticality
  readonly deliveryRef: string
  readonly blockerCount: number
  readonly assigneeRef: string | undefined
}

export interface OrdoTeamAssignmentV1 {
  readonly assignmentRef: string
  readonly agentRef: string
  readonly taskRef: string
  readonly role: 'writer' | 'reviewer' | 'observer'
  readonly holder: boolean
}

export interface OrdoTeamActionDescriptorV1 {
  readonly actionId: string
  readonly label: string
  readonly kind: 'handoff' | 'candidate' | 'acceptance' | 'promote' | 'reply' | 'take_control'
  readonly requiresConfirmation: 'none' | 'confirm' | 'approval'
  readonly disabledReason: string | undefined
}

export interface OrdoTeamSnapshotV1 {
  readonly schemaVersion: typeof ORDO_TEAM_SNAPSHOT_SCHEMA
  readonly teamRef: string
  readonly contextRevision: number
  readonly generation: number
  readonly cursor: number
  readonly freshness: OrdoTeamFreshness
  readonly safeMessage: string
  readonly tasks: readonly OrdoTeamTaskV1[]
  readonly assignments: readonly OrdoTeamAssignmentV1[]
  readonly actions: readonly OrdoTeamActionDescriptorV1[]
}

export interface OrdoTeamEventV1 {
  readonly schemaVersion: typeof ORDO_TEAM_EVENT_SCHEMA
  readonly teamRef: string
  readonly generation: number
  readonly sequence: number
  readonly kind: 'task_updated' | 'assignment_changed' | 'control_transferred' | 'receipt'
  readonly payload: { readonly taskRef?: string | undefined; readonly agentRef?: string | undefined }
}

const opaqueRef = z.string().min(1).max(256).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
const UNSAFE_TEAM_TEXT = /(?:^|[:/\\])(?:etc|home|usr|var)|file:\/\/|authorization|cookie|bearer\s|token:|secret|password|-----BEGIN|https?:\/\//i
const safeText = z.string().min(1).max(512).refine(
  (value: string) => !UNSAFE_TEAM_TEXT.test(value),
  'team projection text contains a forbidden value',
)
const count = z.number().int().nonnegative().max(1_000_000)

const taskSchema = z.object({
  taskRef: opaqueRef,
  title: safeText,
  state: z.enum(['pending', 'assigned', 'running', 'blocked', 'completed']),
  criticality: z.enum(['normal', 'critical']),
  deliveryRef: opaqueRef,
  blockerCount: count.max(64),
  assigneeRef: opaqueRef.nullish().transform(value => value ?? undefined),
}).strict()

const assignmentSchema = z.object({
  assignmentRef: opaqueRef,
  agentRef: opaqueRef,
  taskRef: opaqueRef,
  role: z.enum(['writer', 'reviewer', 'observer']),
  holder: z.boolean(),
}).strict()

const actionSchema = z.object({
  actionId: z.string().min(1).max(160),
  label: safeText,
  kind: z.enum(['handoff', 'candidate', 'acceptance', 'promote', 'reply', 'take_control']),
  requiresConfirmation: z.enum(['none', 'confirm', 'approval']),
  disabledReason: safeText.nullish().transform(value => value ?? undefined),
}).strict()

export const ordoTeamSnapshotSchema = z.object({
  schemaVersion: z.literal(ORDO_TEAM_SNAPSHOT_SCHEMA),
  teamRef: opaqueRef,
  contextRevision: count,
  generation: count,
  cursor: count,
  freshness: z.enum(['fresh', 'stale', 'offline']),
  safeMessage: safeText,
  tasks: z.array(taskSchema).max(2_000),
  assignments: z.array(assignmentSchema).max(4_000),
  actions: z.array(actionSchema).max(64),
}).strict()

export const ordoTeamEventSchema = z.object({
  schemaVersion: z.literal(ORDO_TEAM_EVENT_SCHEMA),
  teamRef: opaqueRef,
  generation: count,
  sequence: count,
  kind: z.enum(['task_updated', 'assignment_changed', 'control_transferred', 'receipt']),
  payload: z.object({
    taskRef: opaqueRef.nullish().transform(value => value ?? undefined),
    agentRef: opaqueRef.nullish().transform(value => value ?? undefined),
  }).strict(),
}).strict()

/** Fail-closed Team V1 snapshot validation (browser boundary). */
export function validateOrdoTeamSnapshot(input: unknown): OrdoTeamSnapshotV1 | undefined {
  const parsed = ordoTeamSnapshotSchema.safeParse(input)
  return parsed.success ? parsed.data as OrdoTeamSnapshotV1 : undefined
}

/** Fail-closed Team V1 event validation. */
export function validateOrdoTeamEvent(input: unknown): OrdoTeamEventV1 | undefined {
  const parsed = ordoTeamEventSchema.safeParse(input)
  return parsed.success ? parsed.data as OrdoTeamEventV1 : undefined
}

/**
 * Team event gate (§1.2): duplicate → ignore; gap/generation drift → reload;
 * a context switch invalidates the cursor entirely.
 */
export type OrdoTeamEventOutcome =
  | { readonly action: 'apply'; readonly event: OrdoTeamEventV1 }
  | { readonly action: 'ignore'; readonly reason: 'duplicate' }
  | { readonly action: 'reload'; readonly reason: 'gap' | 'generation_drift' | 'context_switch' }

export function gateOrdoTeamEvent(
  previous: { readonly generation: number; readonly cursor: number; readonly teamRef: string } | undefined,
  event: OrdoTeamEventV1,
): OrdoTeamEventOutcome {
  if (previous === undefined) return { action: 'apply', event }
  if (event.teamRef !== previous.teamRef) return { action: 'reload', reason: 'context_switch' }
  if (event.generation !== previous.generation) return { action: 'reload', reason: 'generation_drift' }
  if (event.sequence <= previous.cursor) return { action: 'ignore', reason: 'duplicate' }
  if (event.sequence > previous.cursor + 1) return { action: 'reload', reason: 'gap' }
  return { action: 'apply', event }
}

/**
 * Capability matrix (§2.3): Team V1 maturity, session host capabilities, and
 * honest fallbacks in one projection for the Hub header.
 */
export interface OrdoTeamCapabilityMatrixV1 {
  readonly team: OrdoTeamMaturity
  readonly sessionAgents: 'available' | 'unavailable'
  readonly legacyOrdoPane: 'available'
  readonly mutationEnabled: boolean
  readonly fallback: 'hub-session-agents' | 'legacy-pane'
}

export function resolveOrdoTeamCapabilityMatrix(
  capability: OrdoTeamCapabilityV1 | undefined,
  sessionHostAvailable: boolean,
): OrdoTeamCapabilityMatrixV1 {
  const maturity = capability?.maturity ?? 'unavailable'
  return {
    team: maturity,
    sessionAgents: sessionHostAvailable ? 'available' : 'unavailable',
    legacyOrdoPane: 'available',
    mutationEnabled: maturity === 'live',
    fallback: sessionHostAvailable ? 'hub-session-agents' : 'legacy-pane',
  }
}
