/**
 * Professional-pane selection handoff + candidate adoption backfill contracts
 * (dsh-screenplay-production-continuity-v1 task 3.2 选择联动).
 *
 * Professional panes — the canonical Scaena 镜头表
 * (scaena.storyboard_table_view.v1alpha1 rows keyed by scene_ref/shot_ref) and
 * the 3D Director pane — exchange selection with the pipeline workbench by
 * STABLE OBJECT REF, never by array index or transient row position:
 *
 * - a handoff carries only opaque refs plus a monotonic sequence number; every
 *   field is fail-closed decoded and a violating payload is dropped whole;
 * - a handoff whose sequence is not newer than the last applied one from the
 *   same source is a late/duplicate delivery and is dropped;
 * - handoffs and adoptions are fenced by projectRef: a payload from another
 *   project never touches this workbench (no cross-project leakage);
 * - disposal fences everything: after dispose no entry mutates state.
 *
 * Candidate adoption backfill: when a professional pane adopts a candidate
 * (e.g. an image/shot candidate becomes the selected artifact), the pipeline
 * records the adoption keyed by the candidate's fixed ref and the envelope /
 * object-list projection backfills the adopted fixed refs — without reopening
 * the workbench and without touching unrelated nodes. The canvas DRAFT is
 * never rewritten for an adoption: candidate version/artifact truth belongs to
 * the owner, and the next owner snapshot refresh carries it; the backfill only
 * overlays the locally derived view until then.
 *
 * This module owns only the client-side consumption seam. Emitting handoffs
 * from the canonical Scaena table pane stays with the Creator Studio surface
 * (cross-package); the contracts here are the stable wiring point.
 */

/** Neutral handoff schema id; decoded fail-closed by the workbench controller. */
export const PIPELINE_PANE_SELECTION_HANDOFF_SCHEMA = 'dsh.pipeline-pane-selection-handoff.v1alpha1' as const
/** Neutral adoption schema id; decoded fail-closed by the workbench controller. */
export const PIPELINE_CANDIDATE_ADOPTION_SCHEMA = 'dsh.pipeline-candidate-adoption.v1alpha1' as const

/** Known professional-pane sources; unknown sources fail the contract. */
export const PIPELINE_PANE_SELECTION_SOURCES = ['scaena-table', '3d-director'] as const
export type PipelinePaneSelectionSourceV1 = (typeof PIPELINE_PANE_SELECTION_SOURCES)[number]

/** Object kinds a professional pane can address by stable ref. */
export const PIPELINE_PANE_SELECTION_KINDS = ['shot', 'scene', 'object', 'candidate'] as const
export type PipelinePaneSelectionKindV1 = (typeof PIPELINE_PANE_SELECTION_KINDS)[number]

/** Fixed-reference selection handoff from one professional pane. */
export interface PipelinePaneSelectionHandoffV1 {
  readonly schema: typeof PIPELINE_PANE_SELECTION_HANDOFF_SCHEMA
  readonly source: PipelinePaneSelectionSourceV1
  readonly projectRef: string
  /** Monotonic per-source sequence; must strictly increase to be applied. */
  readonly seq: number
  /** Emission time in epoch milliseconds (bounded sanity window on arrival). */
  readonly issuedAt: number
  readonly selection: { readonly kind: PipelinePaneSelectionKindV1; readonly ref: string }
}

/** Fixed refs of an adopted candidate artifact; bounded opaque strings only. */
export interface PipelineAdoptedArtifactRefV1 {
  readonly owner: string
  readonly kind: string
  readonly ref: string
  readonly version: string
  readonly mediaType?: string
  readonly title?: string
}

/** Candidate adoption record from a professional pane. */
export interface PipelineCandidateAdoptionV1 {
  readonly schema: typeof PIPELINE_CANDIDATE_ADOPTION_SCHEMA
  readonly source: PipelinePaneSelectionSourceV1
  readonly projectRef: string
  readonly seq: number
  readonly issuedAt: number
  readonly candidateRef: string
  /** The candidate's version AFTER adoption (the owner-confirmed fixed ref). */
  readonly adoptedVersion: string
  /** The shot the candidate was adopted for, when the pane knows it. */
  readonly adoptedForShotRef?: string
  readonly artifact?: PipelineAdoptedArtifactRefV1
}

/** Controller-visible outcome for one handoff/adoption entry. */
export type PipelinePaneLinkOutcome =
  | { readonly status: 'applied' }
  | { readonly status: 'dropped'; readonly reason: string }

export type PipelinePaneLinkDecodeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string }

const MAX_REF = 160
const MAX_OWNER = 40
const MAX_TEXT = 160
const MAX_SOURCES = PIPELINE_PANE_SELECTION_SOURCES.length
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u
const TEXT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/ -]{0,159}$/u

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSafeRef(value: unknown, max = MAX_REF, pattern = REF_PATTERN): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && pattern.test(value)
}

function isSafeSeq(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value < 1e12
}

/** issuedAt is an epoch-ms timestamp: safe-integer, not past, not absurdly far. */
function isSafeIssuedAt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value < 1e15
}

/** Common envelope fields: schema/source/project/seq/issuedAt. Fail-closed. */
function decodeEnvelope(value: Record<string, unknown>, schema: string): PipelinePaneLinkDecodeResult<{
  readonly source: PipelinePaneSelectionSourceV1
  readonly projectRef: string
  readonly seq: number
  readonly issuedAt: number
}> {
  if (value.schema !== schema) return { ok: false, reason: 'pane link schema is not supported' }
  const source = value.source
  if (typeof source !== 'string' || !(PIPELINE_PANE_SELECTION_SOURCES as readonly string[]).includes(source)) {
    return { ok: false, reason: 'pane link source is not known' }
  }
  if (!isSafeRef(value.projectRef)) return { ok: false, reason: 'pane link project ref failed the contract' }
  if (!isSafeSeq(value.seq)) return { ok: false, reason: 'pane link sequence is not a safe integer' }
  if (!isSafeIssuedAt(value.issuedAt)) return { ok: false, reason: 'pane link timestamp is not a safe epoch value' }
  return { ok: true, value: { source: source as PipelinePaneSelectionSourceV1, projectRef: value.projectRef, seq: value.seq, issuedAt: value.issuedAt } }
}

/** Fail-closed decode of one professional-pane selection handoff. */
export function decodePipelinePaneSelectionHandoff(input: unknown): PipelinePaneLinkDecodeResult<PipelinePaneSelectionHandoffV1> {
  if (!isRecord(input)) return { ok: false, reason: 'pane selection handoff must be an object' }
  const envelope = decodeEnvelope(input, PIPELINE_PANE_SELECTION_HANDOFF_SCHEMA)
  if (!envelope.ok) return envelope
  const selection = input.selection
  if (!isRecord(selection)) return { ok: false, reason: 'pane selection handoff has no selection' }
  const kind = selection.kind
  if (typeof kind !== 'string' || !(PIPELINE_PANE_SELECTION_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, reason: 'pane selection kind is not known' }
  }
  if (!isSafeRef(selection.ref)) return { ok: false, reason: 'pane selection ref failed the contract' }
  return {
    ok: true,
    value: {
      schema: PIPELINE_PANE_SELECTION_HANDOFF_SCHEMA,
      source: envelope.value.source,
      projectRef: envelope.value.projectRef,
      seq: envelope.value.seq,
      issuedAt: envelope.value.issuedAt,
      selection: { kind: kind as PipelinePaneSelectionKindV1, ref: selection.ref },
    },
  }
}

function decodeAdoptedArtifact(input: unknown): PipelinePaneLinkDecodeResult<PipelineAdoptedArtifactRefV1> {
  if (!isRecord(input)) return { ok: false, reason: 'adoption artifact must be an object' }
  if (!isSafeRef(input.owner, MAX_OWNER, TEXT_PATTERN) || !isSafeRef(input.kind, MAX_OWNER, TEXT_PATTERN)) {
    return { ok: false, reason: 'adoption artifact owner/kind failed the contract' }
  }
  if (!isSafeRef(input.ref) || !isSafeRef(input.version)) return { ok: false, reason: 'adoption artifact refs failed the contract' }
  if (input.mediaType !== undefined && !isSafeRef(input.mediaType, MAX_TEXT, TEXT_PATTERN)) {
    return { ok: false, reason: 'adoption artifact media type failed the contract' }
  }
  if (input.title !== undefined && (typeof input.title !== 'string' || input.title.length > MAX_TEXT || input.title.length === 0)) {
    return { ok: false, reason: 'adoption artifact title failed the contract' }
  }
  return {
    ok: true,
    value: {
      owner: input.owner,
      kind: input.kind,
      ref: input.ref,
      version: input.version,
      ...(input.mediaType === undefined ? {} : { mediaType: input.mediaType }),
      ...(input.title === undefined ? {} : { title: input.title }),
    },
  }
}

/** Fail-closed decode of one candidate adoption record. */
export function decodePipelineCandidateAdoption(input: unknown): PipelinePaneLinkDecodeResult<PipelineCandidateAdoptionV1> {
  if (!isRecord(input)) return { ok: false, reason: 'candidate adoption must be an object' }
  const envelope = decodeEnvelope(input, PIPELINE_CANDIDATE_ADOPTION_SCHEMA)
  if (!envelope.ok) return envelope
  if (!isSafeRef(input.candidateRef)) return { ok: false, reason: 'adoption candidate ref failed the contract' }
  if (!isSafeRef(input.adoptedVersion, MAX_TEXT, TEXT_PATTERN)) return { ok: false, reason: 'adoption version failed the contract' }
  if (input.adoptedForShotRef !== undefined && !isSafeRef(input.adoptedForShotRef)) {
    return { ok: false, reason: 'adoption shot ref failed the contract' }
  }
  if (input.artifact !== undefined) {
    const artifact = decodeAdoptedArtifact(input.artifact)
    if (!artifact.ok) return artifact
    return { ok: true, value: { schema: PIPELINE_CANDIDATE_ADOPTION_SCHEMA, ...envelope.value, candidateRef: input.candidateRef, adoptedVersion: input.adoptedVersion, ...(input.adoptedForShotRef === undefined ? {} : { adoptedForShotRef: input.adoptedForShotRef }), artifact: artifact.value } }
  }
  return { ok: true, value: { schema: PIPELINE_CANDIDATE_ADOPTION_SCHEMA, ...envelope.value, candidateRef: input.candidateRef, adoptedVersion: input.adoptedVersion, ...(input.adoptedForShotRef === undefined ? {} : { adoptedForShotRef: input.adoptedForShotRef }) } }
}

/** Bounded registry of the latest applied sequence per source (late/dup drop). */
export class PaneLinkSequenceGate {
  private readonly last = new Map<PipelinePaneSelectionSourceV1, number>()
  constructor(private readonly maxSources = MAX_SOURCES) {}
  /** Returns true when seq is strictly newer than the last accepted one for its source. */
  accept(source: PipelinePaneSelectionSourceV1, seq: number): boolean {
    const last = this.last.get(source)
    if (last !== undefined && seq <= last) return false
    if (this.last.size >= this.maxSources && !this.last.has(source)) return false
    this.last.set(source, seq)
    return true
  }
  observed(source: PipelinePaneSelectionSourceV1): number | undefined {
    return this.last.get(source)
  }
}
