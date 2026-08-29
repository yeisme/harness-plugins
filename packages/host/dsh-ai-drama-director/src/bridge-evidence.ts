/**
 * Bridge evidence — the stable, redacted, aggregatable event category set
 * shared by DSH and Workbench. Records carry only contract version, intent,
 * target surface, stable reason code, timestamps, versions, and opaque
 * correlation refs. Never the nonce, a full envelope, secrets, raw prompts,
 * provider payloads, private tool arguments, or absolute paths.
 */

import { BRIDGE_V2_CONTRACT, BRIDGE_V2_INTENTS, WORKBENCH_AGENT_SPATIAL_SURFACE, type BridgeV2Intent, type BridgeV2ReasonCode } from './bridge-v2.js'

export const DRAMA_BRIDGE_EVIDENCE_SCHEMA = 'drama.bridge-evidence.v1' as const

export const BRIDGE_EVIDENCE_KINDS = [
  'bridge_issued',
  'bridge_launch_requested',
  'bridge_consumed',
  'bridge_reconcile_required',
  'bridge_denied',
  'bridge_expired',
  'bridge_contract_mismatch',
  'bridge_target_unavailable',
] as const

export type BridgeEvidenceKind = (typeof BRIDGE_EVIDENCE_KINDS)[number]

export interface DramaBridgeEvidenceRecordV1 {
  readonly schema: typeof DRAMA_BRIDGE_EVIDENCE_SCHEMA
  readonly kind: BridgeEvidenceKind
  readonly contractVersion: string
  readonly targetSurfaceId: string
  readonly atMs: number
  readonly intent?: BridgeV2Intent
  readonly reasonCode?: BridgeV2ReasonCode
  /** Opaque correlation ref; MUST NOT be the nonce. */
  readonly correlationRef?: string
  readonly resourceVersion?: string
  readonly contextRevision?: number
}

const REASON_CODE = /^[a-z][a-z0-9_]{0,31}$/
const CORRELATION_REF = /^[A-Za-z0-9._~:-]{1,64}$/
const UNSAFE = /(?:prompt|token|secret|password|authorization|cookie|https?:\/\/|file:\/\/|\/etc\/|-----BEGIN|authorization|bearer)/i

export type BridgeEvidenceSink = (record: DramaBridgeEvidenceRecordV1) => void

export interface BridgeEvidenceEmitter {
  emit(event: {
    readonly kind: BridgeEvidenceKind
    readonly reasonCode?: BridgeV2ReasonCode
    readonly intent?: BridgeV2Intent
    readonly correlationRef?: string
    readonly resourceVersion?: string
    readonly contextRevision?: number
    readonly atMs?: number
  }): DramaBridgeEvidenceRecordV1 | undefined
  snapshot(): readonly DramaBridgeEvidenceRecordV1[]
}

/**
 * Builds a redaction-checked bridge evidence record; invalid or
 * secret-carrying input is dropped (returns undefined), never thrown.
 */
export function recordDramaBridgeEvidence(event: {
  readonly kind: BridgeEvidenceKind
  readonly reasonCode?: BridgeV2ReasonCode
  readonly intent?: BridgeV2Intent
  readonly correlationRef?: string
  readonly resourceVersion?: string
  readonly contextRevision?: number
  readonly atMs?: number
}): DramaBridgeEvidenceRecordV1 | undefined {
  if (!BRIDGE_EVIDENCE_KINDS.includes(event.kind)) return undefined
  if (event.intent !== undefined && !BRIDGE_V2_INTENTS.includes(event.intent)) return undefined
  if (event.reasonCode !== undefined && !REASON_CODE.test(event.reasonCode)) return undefined
  if (event.correlationRef !== undefined && !CORRELATION_REF.test(event.correlationRef)) return undefined
  if (event.resourceVersion !== undefined && !CORRELATION_REF.test(event.resourceVersion)) return undefined
  if (event.contextRevision !== undefined && (!Number.isSafeInteger(event.contextRevision) || event.contextRevision < 0)) return undefined
  if (event.atMs !== undefined && (!Number.isSafeInteger(event.atMs) || event.atMs < 0)) return undefined
  const record: DramaBridgeEvidenceRecordV1 = {
    schema: DRAMA_BRIDGE_EVIDENCE_SCHEMA,
    kind: event.kind,
    contractVersion: BRIDGE_V2_CONTRACT,
    targetSurfaceId: WORKBENCH_AGENT_SPATIAL_SURFACE,
    atMs: event.atMs ?? Date.now(),
    ...(event.intent === undefined ? {} : { intent: event.intent }),
    ...(event.reasonCode === undefined ? {} : { reasonCode: event.reasonCode }),
    ...(event.correlationRef === undefined ? {} : { correlationRef: event.correlationRef }),
    ...(event.resourceVersion === undefined ? {} : { resourceVersion: event.resourceVersion }),
    ...(event.contextRevision === undefined ? {} : { contextRevision: event.contextRevision }),
  }
  if (UNSAFE.test(JSON.stringify(record))) return undefined
  return record
}

/** Bounded in-memory bridge evidence emitter with optional sink. */
export function createBridgeEvidenceEmitter(sink?: BridgeEvidenceSink, limit = 100): BridgeEvidenceEmitter {
  const records: DramaBridgeEvidenceRecordV1[] = []
  return {
    emit(event) {
      const record = recordDramaBridgeEvidence(event)
      if (record === undefined) return undefined
      records.push(record)
      while (records.length > limit) records.shift()
      sink?.(record)
      return record
    },
    snapshot: () => [...records],
  }
}

export function isRedactedDramaBridgeEvidence(value: unknown): value is DramaBridgeEvidenceRecordV1 {
  if (value === null || typeof value !== 'object') return false
  const record = value as Partial<DramaBridgeEvidenceRecordV1>
  if (record.schema !== DRAMA_BRIDGE_EVIDENCE_SCHEMA) return false
  if (typeof record.kind !== 'string' || !BRIDGE_EVIDENCE_KINDS.includes(record.kind as BridgeEvidenceKind)) return false
  if (UNSAFE.test(JSON.stringify(value))) return false
  return true
}
