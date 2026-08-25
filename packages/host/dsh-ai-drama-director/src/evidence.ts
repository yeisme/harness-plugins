/**
 * Redacted product evidence. Categories only — never free text,
 * script body, prompt, provider payload, or private refs.
 */

export const DRAMA_EVIDENCE_SCHEMA = 'drama.evidence.v1' as const

export const DRAMA_EVIDENCE_KINDS = [
  'pack_installed',
  'pack_disabled',
  'command_opened',
  'command_submitted',
  'command_unknown',
  'command_reconcile',
  'command_needs_contract',
  'context_recovered',
  'handoff_opened',
  'handoff_expired',
  'handoff_contract_mismatch',
] as const

export type DramaEvidenceKindV1 = (typeof DRAMA_EVIDENCE_KINDS)[number]

export interface DramaEvidenceRecordV1 {
  readonly schema: typeof DRAMA_EVIDENCE_SCHEMA
  readonly kind: DramaEvidenceKindV1
  readonly durationMs?: number
  readonly reasonCategory?: string
}

const CATEGORY = /^[a-z][a-z0-9_]{0,63}$/
const UNSAFE = /(?:prompt|token|secret|password|authorization|cookie|https?:\/\/|file:\/\/|\/etc\/|-----BEGIN)/i

export function recordDramaEvidence(input: {
  readonly kind: DramaEvidenceKindV1
  readonly durationMs?: number
  readonly reasonCategory?: string
}): DramaEvidenceRecordV1 | undefined {
  if (!DRAMA_EVIDENCE_KINDS.includes(input.kind)) return undefined
  if (input.durationMs !== undefined && (!Number.isSafeInteger(input.durationMs) || input.durationMs < 0)) {
    return undefined
  }
  if (input.reasonCategory !== undefined && (!CATEGORY.test(input.reasonCategory) || UNSAFE.test(input.reasonCategory))) {
    return undefined
  }
  return {
    schema: DRAMA_EVIDENCE_SCHEMA,
    kind: input.kind,
    ...(input.durationMs === undefined ? {} : { durationMs: input.durationMs }),
    ...(input.reasonCategory === undefined ? {} : { reasonCategory: input.reasonCategory }),
  }
}

export function isRedactedDramaEvidence(value: unknown): value is DramaEvidenceRecordV1 {
  if (value === null || typeof value !== 'object') return false
  const record = value as Partial<DramaEvidenceRecordV1>
  if (record.schema !== DRAMA_EVIDENCE_SCHEMA) return false
  if (typeof record.kind !== 'string' || !DRAMA_EVIDENCE_KINDS.includes(record.kind as DramaEvidenceKindV1)) return false
  if (UNSAFE.test(JSON.stringify(value))) return false
  return true
}
