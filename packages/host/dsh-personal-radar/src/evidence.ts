/**
 * Redacted Drama Radar evidence records.
 *
 * Evidence never carries secrets, raw prompts, provider payloads, private
 * tool arguments, or absolute paths. Only refs, reason codes, and counters.
 */

import { RADAR_EVIDENCE_SCHEMA, isSafeRadarRef } from './contracts.js'

export const RADAR_EVIDENCE_KINDS = [
  'probe_result',
  'pane_opened',
  'intent_submitted',
  'receipt_resolved',
  'reconcile_required',
  'handoff_issued',
  'proposal_drafted',
] as const
export type RadarEvidenceKindV1 = (typeof RADAR_EVIDENCE_KINDS)[number]

export interface RadarEvidenceRecordV1 {
  readonly schema: typeof RADAR_EVIDENCE_SCHEMA
  readonly kind: RadarEvidenceKindV1
  readonly ts: number
  readonly reasonCode?: string
  readonly refCount: number
}

const ABSOLUTE_PATH = /(?:^|[\s"'])(?:\/[A-Za-z0-9._~-]+)+|(?:[A-Za-z]:[\\/])|\\\\/u
const SECRETISH = /authorization|cookie|token|secret|password|-----BEGIN|https?:\/\//iu

export function isRedactedRadarEvidence(record: unknown): boolean {
  if (record === null || typeof record !== 'object') return false
  const value = record as Partial<RadarEvidenceRecordV1>
  if (value.schema !== RADAR_EVIDENCE_SCHEMA) return false
  if (!RADAR_EVIDENCE_KINDS.includes(value.kind as RadarEvidenceKindV1)) return false
  if (typeof value.ts !== 'number' || !Number.isSafeInteger(value.ts)) return false
  if (typeof value.refCount !== 'number' || !Number.isSafeInteger(value.refCount) || value.refCount < 0) return false
  if (value.reasonCode !== undefined && (typeof value.reasonCode !== 'string' || !isSafeRadarRef(value.reasonCode))) return false
  const blob = JSON.stringify(value)
  return !ABSOLUTE_PATH.test(blob) && !SECRETISH.test(blob)
}

export function recordRadarEvidence(
  kind: RadarEvidenceKindV1,
  input: { readonly ts: number; readonly refCount?: number; readonly reasonCode?: string } = { ts: Date.now() },
): RadarEvidenceRecordV1 {
  return {
    schema: RADAR_EVIDENCE_SCHEMA,
    kind,
    ts: input.ts,
    ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
    refCount: input.refCount ?? 0,
  }
}
