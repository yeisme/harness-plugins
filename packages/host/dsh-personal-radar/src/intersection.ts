/**
 * Lane / operation / capability intersection for typed Radar intents.
 *
 * The effective action set is: Radar lane surface ∩ plugin operation
 * allowlist ∩ probed capabilities. The operator intersection collapses to
 * `edition_build`; collect/daily_run are rejected as unregistered intents.
 * Every rejection carries a stable reason code.
 */

import {
  RADAR_HANDOFF_SPEC,
  type RadarIntentKind,
  type RadarIntentV1,
  type RadarLane,
} from './contracts.js'

export interface RadarOperationV1 {
  readonly kind: RadarIntentKind
  readonly lane: RadarLane
  readonly tool: 'radar.search' | 'radar.execute' | 'local'
  readonly action?: 'feedback_add' | 'edition_build'
  /** Required Radar capabilities from `radar mcp capabilities`. */
  readonly requiredCapabilities: readonly string[]
  /** Intent must carry at least this many opportunity refs. */
  readonly minRefs: number
  readonly maxRefs: number
  /** Dispatch requires explicit user confirmation first. */
  readonly needsConfirmation: boolean
}

/**
 * Frozen operation allowlist. There is deliberately no entry for collect,
 * score, cluster_build, or daily_run: those never leave the plugin.
 */
export const RADAR_INTENT_OPERATIONS: Readonly<Record<RadarIntentKind, RadarOperationV1>> = {
  open: {
    kind: 'open', lane: 'reader', tool: 'radar.search',
    requiredCapabilities: ['opportunity_edition'], minRefs: 0, maxRefs: 1, needsConfirmation: false,
  },
  save: {
    kind: 'save', lane: 'curator', tool: 'radar.execute', action: 'feedback_add',
    requiredCapabilities: ['personal_profile_feedback'], minRefs: 1, maxRefs: 1, needsConfirmation: false,
  },
  dismiss: {
    kind: 'dismiss', lane: 'curator', tool: 'radar.execute', action: 'feedback_add',
    requiredCapabilities: ['personal_profile_feedback'], minRefs: 1, maxRefs: 1, needsConfirmation: false,
  },
  compare: {
    kind: 'compare', lane: 'reader', tool: 'radar.search',
    requiredCapabilities: ['opportunity_edition'], minRefs: 2, maxRefs: 2, needsConfirmation: false,
  },
  proposal: {
    kind: 'proposal', lane: 'reader', tool: 'local',
    requiredCapabilities: ['opportunity_edition'], minRefs: 1, maxRefs: 1, needsConfirmation: false,
  },
  workbench: {
    kind: 'workbench', lane: 'reader', tool: 'local',
    requiredCapabilities: ['opportunity_edition'], minRefs: 0, maxRefs: 1, needsConfirmation: false,
  },
  refresh: {
    kind: 'refresh', lane: 'operator', tool: 'radar.execute', action: 'edition_build',
    requiredCapabilities: ['opportunity_edition'], minRefs: 0, maxRefs: 0, needsConfirmation: true,
  },
} as const

export type RadarIntersectionReject =
  | 'unregistered_intent'
  | 'lane_violation'
  | 'capability_blocked'
  | 'missing_ref'
  | 'missing_confirmation'

export type RadarIntersectionResult =
  | { readonly ok: true; readonly operation: RadarOperationV1 }
  | { readonly ok: false; readonly reason: RadarIntersectionReject; readonly detail: string }

export interface RadarCapabilitySnapshotV1 {
  readonly spec: string
  readonly capabilities: Readonly<Record<string, string>>
}

/**
 * Validate an intent against the intersection matrix. `allowedLanes` is the
 * lane set the host actually probed as available; anything outside it is a
 * lane violation.
 */
export function validateRadarIntersection(
  intent: RadarIntentV1,
  capabilities: RadarCapabilitySnapshotV1,
  allowedLanes: readonly RadarLane[] = ['reader', 'curator', 'operator'],
): RadarIntersectionResult {
  const operation = RADAR_INTENT_OPERATIONS[intent.kind]
  if (operation === undefined) {
    return { ok: false, reason: 'unregistered_intent', detail: `intent kind ${String(intent.kind)} is not in the allowlist` }
  }
  if (capabilities.spec !== RADAR_HANDOFF_SPEC) {
    return { ok: false, reason: 'capability_blocked', detail: `handoff spec ${capabilities.spec} is not ${RADAR_HANDOFF_SPEC}` }
  }
  for (const capability of operation.requiredCapabilities) {
    if (capabilities.capabilities[capability] !== 'ready') {
      return { ok: false, reason: 'capability_blocked', detail: `radar capability ${capability} is not ready` }
    }
  }
  if (!allowedLanes.includes(operation.lane)) {
    return { ok: false, reason: 'lane_violation', detail: `intent ${intent.kind} requires lane ${operation.lane}, which is not available` }
  }
  if (intent.opportunityRefs.length < operation.minRefs || intent.opportunityRefs.length > operation.maxRefs) {
    return { ok: false, reason: 'missing_ref', detail: `intent ${intent.kind} needs ${operation.minRefs}..${operation.maxRefs} refs, got ${intent.opportunityRefs.length}` }
  }
  if (operation.needsConfirmation && !intent.confirmed) {
    return { ok: false, reason: 'missing_confirmation', detail: 'refresh requires an explicit confirmation before edition_build' }
  }
  return { ok: true, operation }
}

/** Stable reason for the operator-only refresh surface. */
export function isOperatorRefreshOnly(action: string): boolean {
  return action === 'edition_build'
}
