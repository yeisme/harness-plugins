/**
 * Fake Radar provider for tests, conformance, and fixture-based acceptance.
 *
 * Implements the Radar MCP lane surface from `radar.mcp.handoff.v1`:
 * `radar.search` on any lane, `radar.execute` with the lane-cumulative
 * action set (curator: feedback_add/opportunity_review; operator adds
 * collect/score/cluster_build/edition_build/daily_run). The provider is
 * deterministic, keeps its own receipts under `radar://runs`, and can
 * simulate kill/timeout so reconcile tests observe `unknown` outcomes.
 * It never touches a real database, file path, or shell.
 */

import {
  RADAR_HANDOFF_SPEC,
  RADAR_RECEIPT_SCHEMA,
  type RadarActionReceiptV1,
} from './contracts.js'
import type { RadarMcpRequestV1, RadarRunner, RadarSpawnDescriptorV1 } from './adapter.js'

export interface FakeRadarOptionsV1 {
  /** Sequence of forced outcomes consumed in order: e.g. ['unknown','ok']. */
  readonly forcedOutcomes?: readonly ('ok' | 'unknown')[]
  readonly editionRef?: string
  readonly profileRevision?: string
}

export interface FakeRadarReceiptRecordV1 {
  readonly idempotencyKey: string
  readonly receipt: RadarActionReceiptV1
  readonly lane: string
  readonly action: string
}

export interface FakeRadarProvider {
  readonly runner: RadarRunner
  readonly capabilitiesOutput: { readonly spec: typeof RADAR_HANDOFF_SPEC; readonly capabilities: Record<string, string> }
  readonly handoffSpec: typeof RADAR_HANDOFF_SPEC
  /** Owner-side receipt lookup by idempotency key (radar://runs reconcile). */
  lookupReceipt(idempotencyKey: string): Promise<RadarActionReceiptV1 | undefined>
  /** Test seam: settle a previously unknown outcome as if the owner finished. */
  settleUnknown(idempotencyKey: string, receipt: Omit<RadarActionReceiptV1, 'schema' | 'idempotencyKey'>): void
  readonly requests: readonly RadarMcpRequestV1[]
  readonly receiptLog: readonly FakeRadarReceiptRecordV1[]
}

const LANE_ACTIONS: Readonly<Record<string, readonly string[]>> = {
  reader: [],
  curator: ['feedback_add', 'opportunity_review'],
  operator: ['feedback_add', 'opportunity_review', 'collect', 'score', 'cluster_build', 'edition_build', 'daily_run'],
}

export function createFakeRadarProvider(options: FakeRadarOptionsV1 = {}): FakeRadarProvider {
  const requests: RadarMcpRequestV1[] = []
  const receiptLog: FakeRadarReceiptRecordV1[] = []
  const settled = new Map<string, RadarActionReceiptV1>()
  const forced = [...(options.forcedOutcomes ?? [])]
  const editionRef = options.editionRef ?? 'edition:demo-2026-08-30'
  let runCounter = 0

  const runner: RadarRunner = async (descriptor: RadarSpawnDescriptorV1) => {
    requests.push(descriptor.request)
    const forcedOutcome = forced.shift()
    if (forcedOutcome === 'unknown') {
      return { ok: false, error: 'simulated kill/timeout: owner outcome unknown' }
    }
    const request = descriptor.request
    if (request.tool === 'radar.search') {
      return {
        ok: true,
        receipt: {
          outcome: 'submitted',
          reason: `search view ${String(request.args['view'])} returned`,
          editionRef,
        },
      }
    }
    const action = typeof request.args['action'] === 'string' ? request.args['action'] : ''
    const allowed = LANE_ACTIONS[request.lane]
    if (allowed === undefined || !allowed.includes(action)) {
      return {
        ok: true,
        receipt: { outcome: 'rejected', reason: `action ${action} is outside lane ${request.lane}` },
      }
    }
    const key = typeof request.args['idempotency_key'] === 'string' ? request.args['idempotency_key'] : `anon-${requests.length}`
    const existing = settled.get(key)
    if (existing !== undefined) {
      // Idempotent re-dispatch returns the original receipt; the feedback is
      // written exactly once no matter how many times the intent repeats.
      return {
        ok: true,
        receipt: {
          outcome: 'submitted',
          reason: 'duplicate idempotency key; original receipt returned',
          runRef: existing.runRef,
          ...(existing.feedbackRef === undefined ? {} : { feedbackRef: existing.feedbackRef }),
          ...(existing.editionRef === undefined ? {} : { editionRef: existing.editionRef }),
        },
      }
    }
    runCounter += 1
    const receipt: RadarActionReceiptV1 = {
      schema: RADAR_RECEIPT_SCHEMA,
      idempotencyKey: key,
      outcome: 'submitted',
      reason: `${action} accepted by the radar owner`,
      runRef: `run:${action}-${runCounter}`,
      ...(action === 'edition_build' ? { editionRef } : {}),
      ...(action === 'feedback_add' ? { feedbackRef: `feedback:${key}` } : {}),
    }
    settled.set(key, receipt)
    receiptLog.push({ idempotencyKey: key, receipt, lane: request.lane, action })
    return {
      ok: true,
      receipt: {
        outcome: receipt.outcome,
        reason: receipt.reason,
        runRef: receipt.runRef,
        ...(receipt.feedbackRef === undefined ? {} : { feedbackRef: receipt.feedbackRef }),
        ...(receipt.editionRef === undefined ? {} : { editionRef: receipt.editionRef }),
      },
    }
  }

  return {
    runner,
    handoffSpec: RADAR_HANDOFF_SPEC,
    capabilitiesOutput: {
      spec: RADAR_HANDOFF_SPEC,
      capabilities: {
        cli: 'ready',
        collection_layers_0_1: 'ready',
        layer2_browser_fallback: 'blocked',
        personal_profile_feedback: 'ready',
        opportunity_edition: 'ready',
        mcp_stdio_lanes: 'ready',
        remote_mcp_endpoint: 'unavailable',
        a2a: 'unavailable',
        multi_user: 'unavailable',
      },
    },
    async lookupReceipt(idempotencyKey: string) {
      return settled.get(idempotencyKey)
    },
    settleUnknown(idempotencyKey: string, receipt: Omit<RadarActionReceiptV1, 'schema' | 'idempotencyKey'>) {
      settled.set(idempotencyKey, { schema: RADAR_RECEIPT_SCHEMA, idempotencyKey, ...receipt })
    },
    requests,
    receiptLog,
  }
}

/** Deterministic demo projection used by pane/badge tests and conformance. */
export const FAKE_RADAR_DEMO_PROJECTION = {
  schema: 'dsh.radar.projection.v1' as const,
  editionRef: 'edition:demo-2026-08-30',
  profileRevision: 'profile-rev:demo-7',
  status: 'ready' as const,
  ageMs: 38 * 60_000,
  observedAt: 1_787_500_000_000,
  opportunities: [
    {
      opportunityRef: 'opp:demo-1',
      title: 'Rebirth revenge mini-drama',
      marketScore: 82,
      personalFit: 91,
      riskScore: 24,
      reasons: ['rising 7-day demand', 'matches saved themes'],
      knownLimitations: ['platform signal is china-only'],
      isNew: true,
      saved: false,
    },
    {
      opportunityRef: 'opp:demo-2',
      title: 'Cultivation clan short series',
      marketScore: 77,
      personalFit: 88,
      riskScore: 31,
      reasons: ['consistent completion rate'],
      knownLimitations: ['few comparable releases'],
      isNew: true,
      saved: false,
    },
    {
      opportunityRef: 'opp:demo-3',
      title: 'Urban fantasy office drama',
      marketScore: 69,
      personalFit: 74,
      riskScore: 45,
      reasons: ['steady but crowded niche'],
      knownLimitations: ['high competition density'],
      isNew: false,
      saved: true,
    },
  ],
}
