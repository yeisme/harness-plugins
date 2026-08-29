/**
 * Client-side evidence wiring.
 *
 * Every record goes through the host pack's `recordDramaEvidence` redaction
 * contract; the emitter never accepts free text, URLs, paths, prompts, or
 * provider payloads. Records land in a bounded in-memory buffer and an
 * optional sink (integration evidence collectors inject one).
 *
 * Deviation note: the host contract `DRAMA_EVIDENCE_KINDS` has no
 * `review_completed` or `handoff_rejected` kind. Review completion maps to
 * `command_submitted` with `reasonCategory: 'review'`; handoff rejections
 * map to `handoff_contract_mismatch` (or `handoff_expired`) with a
 * `reasonCategory` discriminant. If the host contract later grows those
 * kinds, only `REVIEW_COMPLETED_EVIDENCE` / `handoffRejectionEvidence`
 * change.
 */

import {
  recordDramaEvidence,
  type DramaEvidenceKindV1,
  type DramaEvidenceRecordV1,
} from '@yeisme/dsh-ai-drama-director'

export const DRAMA_EVIDENCE_BUFFER_LIMIT = 100

export type DramaEvidenceSink = (record: DramaEvidenceRecordV1) => void

export interface DramaEvidenceEmitter {
  /** Validates and records one redacted evidence event. Drops invalid input. */
  emit(kind: DramaEvidenceKindV1, extras?: { readonly durationMs?: number; readonly reasonCategory?: string }): DramaEvidenceRecordV1 | undefined
  /** Bounded snapshot of the records emitted in this session. */
  snapshot(): readonly DramaEvidenceRecordV1[]
}

/** Review completion has no dedicated host-contract kind yet; see header. */
export const REVIEW_COMPLETED_EVIDENCE = {
  kind: 'command_submitted',
  reasonCategory: 'review',
} as const

/** Handoff rejection categories all land on contract-mismatch/expired kinds. */
export function handoffRejectionEvidence(reasonCategory: string): {
  readonly kind: DramaEvidenceKindV1
  readonly reasonCategory: string
} {
  return {
    kind: reasonCategory === 'expired' ? 'handoff_expired' : 'handoff_contract_mismatch',
    reasonCategory,
  }
}

export function createDramaEvidenceEmitter(sink?: DramaEvidenceSink): DramaEvidenceEmitter {
  const records: DramaEvidenceRecordV1[] = []
  return {
    emit(kind, extras = {}) {
      const record = recordDramaEvidence({
        kind,
        ...(extras.durationMs === undefined ? {} : { durationMs: extras.durationMs }),
        ...(extras.reasonCategory === undefined ? {} : { reasonCategory: extras.reasonCategory }),
      })
      if (record === undefined) return undefined
      records.push(record)
      if (records.length > DRAMA_EVIDENCE_BUFFER_LIMIT) records.splice(0, records.length - DRAMA_EVIDENCE_BUFFER_LIMIT)
      try {
        sink?.(record)
      } catch {
        // An evidence sink must never break the product path.
      }
      return record
    },
    snapshot() {
      return [...records]
    },
  }
}
