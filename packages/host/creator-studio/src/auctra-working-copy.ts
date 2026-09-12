import { createHash } from 'node:crypto'
import { z } from 'zod'
import { PANE_ARTIFACT_SCHEMA } from '@yeisme/dsh-pane-protocol'
import type { CreatorArtifactContentV1 } from './types.ts'

export const auctraWorkingCopyOpenRefSchema = z.string().max(512).regex(/^(?:text|chapter|screenplay-draft):[A-Za-z0-9][A-Za-z0-9._-]*$/u)
const workingRef = z.string().max(512 - 'auctra:working-copy:'.length - 33).regex(/^(?:twc-[A-Za-z0-9][A-Za-z0-9._-]*|screenplay-draft:[A-Za-z0-9][A-Za-z0-9._-]*)$/u)
const metadata = z.object({
  schema_version: z.literal('auctra.text_working_copy.v1alpha1'), working_copy_ref: workingRef,
  project_ref: z.string().min(1).max(4096), unit_ref: z.string().min(1).max(512),
  format: z.enum(['plain_text', 'markdown', 'fountain']), working_revision: z.number().int().nonnegative(),
  content_digest: z.string().regex(/^[a-f0-9]{64}$/u), content_length: z.number().int().nonnegative().max(2 * 1024 * 1024),
  status: z.enum(['editing', 'conflict', 'recovery_required', 'submitted', 'superseded']),
})
const envelope = z.object({ schema_version: z.literal('auctra.api.envelope.v1'), status: z.literal('success'),
  data: z.object({ working_copy: metadata, body: z.string().max(2 * 1024 * 1024), compatibility_projection: z.boolean() }),
})

// Screenplay drafts keep their owner-side digest contract: `sha256:` prefixed and
// computed over CRLF-normalized text, unlike the generic working copy's bare hex
// digest over raw bytes. The compatibility projection reuses the same envelope.
const screenplayMetadata = metadata.extend({
  content_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  base_canonical_revision: z.string().min(1).max(512),
})
const screenplayDigestOf = (body: string) => `sha256:${createHash('sha256').update(body.replaceAll('\r\n', '\n')).digest('hex')}`

function artifactFromCopy(copy: z.infer<typeof metadata>): CreatorArtifactContentV1['artifact'] {
  const projectKey = createHash('sha256').update(copy.project_ref).digest('hex').slice(0, 32)
  return { schema: PANE_ARTIFACT_SCHEMA, owner: 'auctra', kind: 'text', ref: `auctra:working-copy:${projectKey}:${copy.working_copy_ref}`,
    version: `${copy.working_revision}:${copy.content_digest}`, mediaType: copy.format === 'markdown' ? 'text/markdown' : 'text/plain',
    title: 'Working Copy', evidenceRefs: [], capabilities: [] }
}

/** Body-free owner status probe used before publishing a save descriptor. */
export function normalizeAuctraWorkingCopySaveStatus(value: unknown, expected: { ownerProjectRef: string; openRef: string; artifactRef: string; version: string }) {
  const parsed = z.object({ schema_version: z.literal('auctra.api.envelope.v1'), status: z.literal('success'),
    data: metadata.extend({ allowed_actions: z.array(z.string().max(128)).max(64) }) }).safeParse(value)
  if (!parsed.success || parsed.data.data.project_ref !== expected.ownerProjectRef || parsed.data.data.unit_ref !== expected.openRef
    || !['editing', 'submitted'].includes(parsed.data.data.status) || !parsed.data.data.allowed_actions.includes('apply')) return undefined
  const artifact = artifactFromCopy(parsed.data.data)
  return artifact.ref === expected.artifactRef && artifact.version === expected.version ? artifact : undefined
}

/** Body-free compatibility screenplay draft status probe; same save-readiness
 * rules as the generic leg, with the draft digest contract. */
export function normalizeAuctraScreenplayDraftSaveStatus(value: unknown, expected: { ownerProjectRef: string; openRef: string; artifactRef: string; version: string }) {
  const parsed = z.object({ schema_version: z.literal('auctra.api.envelope.v1'), status: z.literal('success'),
    data: screenplayMetadata.extend({ allowed_actions: z.array(z.string().max(128)).max(64) }) }).safeParse(value)
  if (!parsed.success || parsed.data.data.project_ref !== expected.ownerProjectRef || parsed.data.data.working_copy_ref !== expected.openRef
    || !['editing', 'submitted'].includes(parsed.data.data.status) || !parsed.data.data.allowed_actions.includes('apply')) return undefined
  const artifact = artifactFromCopy(parsed.data.data)
  return artifact.ref === expected.artifactRef && artifact.version === expected.version ? artifact : undefined
}

const receipt = z.object({ working_copy: metadata, applied: z.boolean(), replayed: z.boolean(), no_op: z.boolean(),
  journal_ref: z.string().min(1).max(512).optional(), journal_sequence: z.number().int().nonnegative(),
  result_digest: z.string().regex(/^[a-f0-9]{64}$/u), result_length: z.number().int().nonnegative().max(2 * 1024 * 1024) })

/** Normalize an already-authorized owner receipt. Does not authorize or update selection. */
export function normalizeAuctraWorkingCopyReceipt(value: unknown, expected: { ownerProjectRef: string; openRef: string }, reconcile = false) {
  if (!auctraWorkingCopyOpenRefSchema.safeParse(expected.openRef).success || expected.openRef.startsWith('screenplay-draft:')) return undefined
  const parsed = z.object({ schema_version: z.literal('auctra.api.envelope.v1'), status: z.literal('success'), data: z.unknown() }).safeParse(value)
  if (!parsed.success) return undefined
  let candidate = parsed.data.data
  if (reconcile) {
    const result = z.object({ working_copy: metadata, integrity_verified: z.literal(true), last_receipt: receipt }).safeParse(candidate)
    if (!result.success || result.data.working_copy.project_ref !== expected.ownerProjectRef || result.data.working_copy.unit_ref !== expected.openRef
      || result.data.working_copy.working_copy_ref !== result.data.last_receipt.working_copy.working_copy_ref
      || result.data.working_copy.working_revision < result.data.last_receipt.working_copy.working_revision) return undefined
    candidate = result.data.last_receipt
  }
  const result = receipt.safeParse(candidate)
  if (!result.success) return undefined
  const r = result.data, copy = r.working_copy
  if (copy.project_ref !== expected.ownerProjectRef || copy.unit_ref !== expected.openRef || !copy.working_copy_ref.startsWith('twc-')
    || copy.content_digest !== r.result_digest || copy.content_length !== r.result_length || copy.working_revision !== r.journal_sequence
    || Number(r.applied) + Number(r.replayed) + Number(r.no_op) !== 1
    || (!r.no_op && r.journal_ref !== `twcj-${copy.working_copy_ref}-${r.journal_sequence}`)) return undefined
  return { artifact: artifactFromCopy(copy), contentRevision: `${copy.working_revision}:${copy.content_digest}`,
    outcome: r.no_op ? 'unchanged' as const : r.replayed ? 'replayed' as const : 'applied' as const,
    ...(r.journal_ref === undefined ? {} : { receiptRef: r.journal_ref }), byteLength: r.result_length }
}

/** Normalize an already-authorized explicit owner open, never an authorization decision.
 * The caller must bind credentials, project and contract readiness before invoking it.
 * Private filesystem project refs and all unrelated owner fields are discarded.
 */
export function normalizeAuctraWorkingCopyOpen(value: unknown, expected: {
  readonly ownerProjectRef: string
  readonly openRef: string
  readonly version?: string
}): CreatorArtifactContentV1 | undefined {
  if (!auctraWorkingCopyOpenRefSchema.safeParse(expected.openRef).success) return undefined
  // Compatibility screenplay drafts keep their own digest contract; the generic
  // normalizer must fail closed for them instead of guessing a bare-hex body digest.
  if (expected.openRef.startsWith('screenplay-draft:')) return undefined
  const parsed = envelope.safeParse(value)
  if (!parsed.success) return undefined
  const { working_copy: copy, body, compatibility_projection: compatibility } = parsed.data.data
  if (copy.project_ref !== expected.ownerProjectRef || copy.status === 'recovery_required') return undefined
  if (compatibility || copy.unit_ref !== expected.openRef || !copy.working_copy_ref.startsWith('twc-')) return undefined
  const bytes = new TextEncoder().encode(body)
  // Reject invalid surrogate sequences instead of validating their replacement encoding.
  if (new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== body || bytes.byteLength !== copy.content_length
    || createHash('sha256').update(bytes).digest('hex') !== copy.content_digest) return undefined
  const version = `${copy.working_revision}:${copy.content_digest}`
  if (expected.version !== undefined && expected.version !== version) return undefined
  // Compatibility draft ids are project-local; namespace them without exposing paths.
  return {
    artifact: artifactFromCopy(copy),
    contentRevision: version,
    content: body,
  }
}

/** Compatibility screenplay draft state from an explicit owner open. */
export interface AuctraScreenplayDraftBase {
  readonly content: CreatorArtifactContentV1
  readonly baseCanonicalRevision: string
  readonly workingRevision: number
  readonly contentDigest: string
}

/** Normalize a compatibility screenplay draft open. Mutations never go through the
 * generic working-copy PUT; text.draft.save carries `draft:<n>:<canonical>:<digest>`
 * revisions, so the canonical base must be captured here and never guessed later. */
export function normalizeAuctraScreenplayDraftOpen(value: unknown, expected: {
  readonly ownerProjectRef: string
  readonly openRef: string
  readonly version?: string
}): AuctraScreenplayDraftBase | undefined {
  if (!auctraWorkingCopyOpenRefSchema.safeParse(expected.openRef).success || !expected.openRef.startsWith('screenplay-draft:')) return undefined
  const parsed = z.object({ schema_version: z.literal('auctra.api.envelope.v1'), status: z.literal('success'),
    data: z.object({ working_copy: screenplayMetadata, body: z.string().max(2 * 1024 * 1024), compatibility_projection: z.literal(true) }) }).safeParse(value)
  if (!parsed.success) return undefined
  const { working_copy: copy, body } = parsed.data.data
  if (copy.project_ref !== expected.ownerProjectRef || copy.working_copy_ref !== expected.openRef || copy.status !== 'editing') return undefined
  const bytes = new TextEncoder().encode(body)
  if (new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== body || bytes.byteLength !== copy.content_length
    || screenplayDigestOf(body) !== copy.content_digest) return undefined
  const version = `${copy.working_revision}:${copy.content_digest}`
  if (expected.version !== undefined && expected.version !== version) return undefined
  return { content: { artifact: artifactFromCopy(copy), contentRevision: version, content: body },
    baseCanonicalRevision: copy.base_canonical_revision, workingRevision: copy.working_revision, contentDigest: copy.content_digest }
}

/** Shared save receipt projection for the text.draft.save compatibility leg. */
export interface AuctraScreenplayDraftSaveReceipt {
  readonly artifact: CreatorArtifactContentV1['artifact']
  readonly contentRevision: string
  readonly outcome: 'applied' | 'replayed'
  readonly byteLength: number
}

/** Normalize a text.draft.save result. The owner replays by fingerprint
 * (draft ref + canonical base + expected version + content digest); a replay may
 * return a newer head when later saves advanced the draft, which is reported as
 * the current projection, never as a second mutation. */
export function normalizeAuctraScreenplayDraftSave(value: unknown, expected: {
  readonly ownerProjectRef: string
  readonly openRef: string
  readonly baseRevision: number
  readonly baseCanonicalRevision: string
  readonly content: string
  readonly mediaType: string
}): AuctraScreenplayDraftSaveReceipt | undefined {
  if (!auctraWorkingCopyOpenRefSchema.safeParse(expected.openRef).success || !expected.openRef.startsWith('screenplay-draft:')) return undefined
  const parsed = z.object({ schema_version: z.literal('auctra.api.envelope.v1'), status: z.literal('success'),
    data: z.object({ schema_version: z.literal('auctra.text_document.v1'), unit_ref: z.string().min(1).max(512), kind: z.string().min(1).max(64),
      body: z.string().max(2 * 1024 * 1024), revision: z.string().min(1).max(512), version: z.number().int().positive(),
      replayed: z.boolean().optional() }) }).safeParse(value)
  if (!parsed.success) return undefined
  const document = parsed.data.data
  if (document.unit_ref !== expected.openRef) return undefined
  const revision = document.revision.match(/^draft:(\d+):([^:]+):sha256:([a-f0-9]{64})$/u)
  if (!revision || Number(revision[1]) !== document.version) return undefined
  if (document.replayed === true) {
    if (document.version < expected.baseRevision) return undefined
  } else {
    if (document.version !== expected.baseRevision + 1 || revision[2] !== expected.baseCanonicalRevision || revision[3] !== screenplayDigestOf(expected.content).slice(7)
      || document.body !== expected.content) return undefined
  }
  const projectKey = createHash('sha256').update(expected.ownerProjectRef).digest('hex').slice(0, 32)
  const digest = `sha256:${revision[3]}`
  return { artifact: { schema: PANE_ARTIFACT_SCHEMA, owner: 'auctra', kind: 'text',
    ref: `auctra:working-copy:${projectKey}:${expected.openRef}`,
    version: `${document.version}:${digest}`, mediaType: expected.mediaType, title: 'Working Copy', evidenceRefs: [], capabilities: [] },
    contentRevision: `${document.version}:${digest}`, outcome: document.replayed === true ? 'replayed' : 'applied',
    byteLength: new TextEncoder().encode(document.body).byteLength }
}

export const AUCTRA_TEXT_FAMILIES = ['novel-chapter', 'screenplay-scene', 'general-text'] as const
export type AuctraTextFamily = (typeof AUCTRA_TEXT_FAMILIES)[number]
const CHAPTER_KIND = 'chapter'
const SCREENPLAY_KIND = 'screenplay_scene'
const GENERAL_TEXT_KINDS = new Set(['xhs_note', 'wechat_article', 'zhihu_tech_article', 'short_video_script', 'long_video_script', 'product_copy', 'speech'])

export interface AuctraTextStructureItem {
  readonly unitRef: string
  readonly family: AuctraTextFamily
  readonly title: string
  readonly status: string
}

const textUnit = z.object({
  id: z.string().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u),
  kind: z.string().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u),
  title: z.string().min(1).max(160),
  status: z.string().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u),
  platform: z.string().max(64).optional(),
  updated_at: z.string().max(80).optional(),
}).strict()

function familyOf(kind: string): AuctraTextFamily | undefined {
  if (kind === CHAPTER_KIND) return 'novel-chapter'
  if (kind === SCREENPLAY_KIND) return 'screenplay-scene'
  if (GENERAL_TEXT_KINDS.has(kind)) return 'general-text'
  return undefined
}

function unitRefOf(kind: string, id: string): string | undefined {
  const family = familyOf(kind)
  if (family === 'novel-chapter') return `chapter:${id}`
  if (family === 'screenplay-scene' || family === 'general-text') return `text:${id}`
  return undefined
}

/** Body-free project structure list. Unauthorized kinds are omitted, never opened. */
export function normalizeAuctraTextUnitList(value: unknown): readonly AuctraTextStructureItem[] | undefined {
  const parsed = z.object({ schema_version: z.literal('auctra.api.envelope.v1'), status: z.literal('success'),
    data: z.array(textUnit).max(1_000) }).safeParse(value)
  if (!parsed.success) return undefined
  const items: AuctraTextStructureItem[] = []
  for (const unit of parsed.data.data) {
    if ('body' in unit) return undefined
    const family = familyOf(unit.kind)
    const unitRef = unitRefOf(unit.kind, unit.id)
    if (family === undefined || unitRef === undefined || !auctraWorkingCopyOpenRefSchema.safeParse(unitRef).success) continue
    items.push({ unitRef, family, title: unit.title, status: unit.status })
  }
  return items
}

const candidateDescriptor = z.object({
  schema_version: z.literal('auctra.text_working_copy.v1alpha1'),
  candidate_ref: z.string().min(1).max(160).regex(/^cand-[A-Za-z0-9]+$/u),
  working_copy_ref: workingRef,
  form: z.enum(['inline_patch', 'document']),
  base_revision: z.number().int().nonnegative(),
  base_digest: z.string().regex(/^[a-f0-9]{64}$/u),
  result_digest: z.string().regex(/^[a-f0-9]{64}$/u),
  result_length: z.number().int().nonnegative().max(2 * 1024 * 1024),
  patch_edit_count: z.number().int().nonnegative().max(128),
  producer_kind: z.literal('agent_candidate'),
  producer_ref: z.string().max(160).optional(),
  status: z.enum(['pending', 'applied_to_working_copy', 'rejected']),
}).passthrough()

export interface AuctraWorkingCopyCandidate {
  readonly ref: string
  readonly workingCopyRef: string
  readonly version: string
  readonly sourceVersion: string
  readonly status: 'ready' | 'adopted' | 'superseded'
  readonly summary: string
}

export function normalizeAuctraCandidatePage(value: unknown, expected: { ownerProjectRef: string; workingCopyRef: string; limit: number }) {
  const parsed = z.object({ schema_version: z.literal('auctra.api.envelope.v1'), status: z.literal('success'), data: z.object({
    candidates: z.array(candidateDescriptor).max(100), next_cursor: z.string().min(1).max(1024).regex(/^[A-Za-z0-9_-]+$/u).optional(),
  }) }).safeParse(value)
  if (!parsed.success || parsed.data.data.candidates.length > expected.limit) return undefined
  const candidates: AuctraWorkingCopyCandidate[] = [], seen = new Set<string>()
  for (const item of parsed.data.data.candidates) {
    const candidate = normalizeAuctraWorkingCopyCandidate({ schema_version: 'auctra.api.envelope.v1', status: 'success', data: item }, expected)
    if (!candidate || seen.has(candidate.ref)) return undefined
    seen.add(candidate.ref); candidates.push(candidate)
  }
  return { candidates, ...(parsed.data.data.next_cursor === undefined ? {} : { nextCursor: parsed.data.data.next_cursor }) }
}

/** Explicit authorized candidate content only; never insert the body into a snapshot. */
export function normalizeAuctraCandidateContent(value: unknown, expected: {
  ownerProjectRef: string; workingCopyRef: string; candidateRef: string; version: string;
}): CreatorArtifactContentV1 | undefined {
  const parsed = z.object({ schema_version: z.literal('auctra.api.envelope.v1'), status: z.literal('success'),
    data: z.object({ candidate: candidateDescriptor, body: z.string().max(256 * 1024) }) }).safeParse(value)
  if (!parsed.success || !expected.ownerProjectRef) return undefined
  const { candidate, body } = parsed.data.data
  if (candidate.candidate_ref !== expected.candidateRef || candidate.working_copy_ref !== expected.workingCopyRef
    || !candidate.working_copy_ref.startsWith('twc-') || `${candidate.base_revision}:${candidate.result_digest}` !== expected.version) return undefined
  const bytes = new TextEncoder().encode(body)
  if (new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== body || bytes.byteLength !== candidate.result_length
    || createHash('sha256').update(bytes).digest('hex') !== candidate.result_digest) return undefined
  const projectKey = createHash('sha256').update(expected.ownerProjectRef).digest('hex').slice(0, 32)
  return { artifact: { schema: PANE_ARTIFACT_SCHEMA, owner: 'auctra', kind: 'text',
    ref: `auctra:candidate:${projectKey}:${candidate.working_copy_ref}:${candidate.candidate_ref}`, version: expected.version,
    mediaType: 'text/plain', title: 'Candidate', evidenceRefs: [], capabilities: [] }, contentRevision: expected.version, content: body }
}

function candidateStatus(status: z.infer<typeof candidateDescriptor>['status']): AuctraWorkingCopyCandidate['status'] {
  return status === 'pending' ? 'ready' : status === 'applied_to_working_copy' ? 'adopted' : 'superseded'
}

/** Body-free owner candidate descriptor. Insert text and body paths are discarded. */
export function normalizeAuctraWorkingCopyCandidate(value: unknown, expected: { ownerProjectRef: string; workingCopyRef: string }): AuctraWorkingCopyCandidate | undefined {
  const parsed = z.object({ schema_version: z.literal('auctra.api.envelope.v1'), status: z.literal('success'), data: candidateDescriptor }).safeParse(value)
  if (!parsed.success) return undefined
  const candidate = parsed.data.data
  if (candidate.working_copy_ref !== expected.workingCopyRef || !candidate.working_copy_ref.startsWith('twc-')) return undefined
  if ('body' in candidate || 'edits' in candidate || 'body_path' in candidate) return undefined
  return {
    ref: candidate.candidate_ref, workingCopyRef: candidate.working_copy_ref,
    version: `${candidate.base_revision}:${candidate.result_digest}`,
    sourceVersion: `${candidate.base_revision}:${candidate.base_digest}`,
    status: candidateStatus(candidate.status),
    summary: `${candidate.patch_edit_count} edits, ${candidate.result_length} bytes. Adoption updates Working Copy only.`,
  }
}

/** Adopt receipt: Working Copy apply evidence plus the applied candidate. Never a checkpoint or Canon. */
export function normalizeAuctraCandidateAdopt(value: unknown, expected: { ownerProjectRef: string; openRef: string; workingCopyRef: string; candidateRef: string }) {
  const parsed = z.object({ schema_version: z.literal('auctra.api.envelope.v1'), status: z.literal('success'),
    data: z.object({ receipt: z.unknown(), candidate: candidateDescriptor }) }).safeParse(value)
  if (!parsed.success || parsed.data.data.candidate.candidate_ref !== expected.candidateRef
    || parsed.data.data.candidate.working_copy_ref !== expected.workingCopyRef
    || parsed.data.data.candidate.status !== 'applied_to_working_copy') return undefined
  const receipt = normalizeAuctraWorkingCopyReceipt({ schema_version: 'auctra.api.envelope.v1', status: 'success', data: parsed.data.data.receipt },
    { ownerProjectRef: expected.ownerProjectRef, openRef: expected.openRef })
  if (receipt === undefined) return undefined
  return { receipt, candidate: normalizeAuctraWorkingCopyCandidate({ schema_version: 'auctra.api.envelope.v1', status: 'success', data: parsed.data.data.candidate },
    { ownerProjectRef: expected.ownerProjectRef, workingCopyRef: expected.workingCopyRef }) }
}

const checkpointDescriptor = z.object({
  schema_version: z.literal('auctra.text_working_copy.v1alpha1'),
  snapshot_ref: z.string().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u),
  kind: z.literal('checkpoint'),
  working_copy_ref: z.string().regex(/^twc-[A-Za-z0-9][A-Za-z0-9._-]*$/u),
  source_working_revision: z.number().int().nonnegative(),
  body_digest: z.string().regex(/^[a-f0-9]{64}$/u),
  body_length: z.number().int().nonnegative().max(2 * 1024 * 1024),
  producer_kind: z.string().min(1).max(64),
  created_at: z.string().min(1).max(80),
}).passthrough()

export interface AuctraWorkingCopyCheckpoint {
  readonly ref: string
  readonly workingCopyRef: string
  readonly sourceVersion: string
  readonly summary: string
}

/** Body-free Checkpoint descriptor. Body paths are discarded. */
export function normalizeAuctraCheckpoint(value: unknown, expected: { workingCopyRef: string }): AuctraWorkingCopyCheckpoint | undefined {
  const parsed = z.object({ schema_version: z.literal('auctra.api.envelope.v1'), status: z.literal('success'), data: checkpointDescriptor }).safeParse(value)
  if (!parsed.success) return undefined
  const checkpoint = parsed.data.data
  const extra = checkpoint as Record<string, unknown>
  if (checkpoint.working_copy_ref !== expected.workingCopyRef || extra.body !== undefined
    || (typeof extra.body_path === 'string' && extra.body_path !== '')) return undefined
  return {
    ref: checkpoint.snapshot_ref, workingCopyRef: checkpoint.working_copy_ref,
    sourceVersion: `${checkpoint.source_working_revision}:${checkpoint.body_digest}`,
    summary: `Checkpoint ${checkpoint.snapshot_ref} at revision ${checkpoint.source_working_revision}. Review and Canon stay separate.`,
  }
}

export function normalizeAuctraCheckpointPage(value: unknown, expected: { workingCopyRef: string }) {
  const parsed = z.object({ schema_version: z.literal('auctra.api.envelope.v1'), status: z.literal('success'),
    data: z.object({ checkpoints: z.array(checkpointDescriptor).max(100) }) }).safeParse(value)
  if (!parsed.success) return undefined
  const checkpoints: AuctraWorkingCopyCheckpoint[] = [], seen = new Set<string>()
  for (const item of parsed.data.data.checkpoints) {
    const checkpoint = normalizeAuctraCheckpoint({ schema_version: 'auctra.api.envelope.v1', status: 'success', data: item }, expected)
    if (!checkpoint || seen.has(checkpoint.ref)) return undefined
    seen.add(checkpoint.ref); checkpoints.push(checkpoint)
  }
  return { checkpoints }
}

export interface AuctraWorkingCopyReviewSubmit {
  readonly checkpointRef: string
  readonly reviewItemRef: string
  readonly submitted: boolean
  readonly sourceVersion: string
}

/** Body-free review.submit receipt. Canon is not performed. */
export function normalizeAuctraReviewSubmit(value: unknown, expected: { workingCopyRef: string; checkpointRef: string }): AuctraWorkingCopyReviewSubmit | undefined {
  const parsed = z.object({ schema_version: z.literal('auctra.api.envelope.v1'), status: z.literal('success'), data: z.object({
    working_copy: metadata, checkpoint_ref: z.string().min(1).max(160), review_item_ref: z.string().min(1).max(160),
    source_working_revision: z.number().int().nonnegative(), body_digest: z.string().regex(/^[a-f0-9]{64}$/u), submitted: z.boolean(),
  }) }).safeParse(value)
  if (!parsed.success) return undefined
  const receipt = parsed.data.data
  if (receipt.working_copy.working_copy_ref !== expected.workingCopyRef || receipt.checkpoint_ref !== expected.checkpointRef) return undefined
  return {
    checkpointRef: receipt.checkpoint_ref, reviewItemRef: receipt.review_item_ref, submitted: receipt.submitted,
    sourceVersion: `${receipt.source_working_revision}:${receipt.body_digest}`,
  }
}

export interface AuctraReviewQueueItem {
  readonly ref: string
  readonly status: string
  readonly version: string
  readonly title: string
}

export function normalizeAuctraReviewQueue(value: unknown) {
  const parsed = z.object({ schema_version: z.literal('auctra.api.envelope.v1'), status: z.literal('success'), data: z.object({
    Items: z.array(z.object({
      id: z.string().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u),
      type: z.string().min(1).max(64),
      status: z.string().min(1).max(64),
      version: z.string().min(1).max(160),
      title: z.string().max(160).optional(),
    }).passthrough()).max(100),
  }).passthrough() }).safeParse(value)
  if (!parsed.success) return undefined
  const items: AuctraReviewQueueItem[] = [], seen = new Set<string>()
  for (const item of parsed.data.data.Items) {
    if (seen.has(item.id) || item.status !== 'pending') continue
    seen.add(item.id)
    items.push({ ref: item.id, status: item.status, version: item.version, title: item.title ?? item.id })
  }
  return { items }
}

export interface AuctraReviewDecision {
  readonly reviewItemRef: string
  readonly decisionRef: string
  readonly status: 'accepted' | 'rejected'
  readonly acceptedRevision?: string
}

export function normalizeAuctraReviewDecision(value: unknown, expected: { reviewItemRef: string; status: 'accepted' | 'rejected' }): AuctraReviewDecision | undefined {
  const parsed = z.object({ schema_version: z.literal('auctra.api.envelope.v1'), status: z.literal('success'), data: z.object({
    schema_version: z.literal('auctra.review_decision_receipt.v1'),
    review_item_ref: z.string().min(1).max(160),
    decision_ref: z.string().min(1).max(160),
    status: z.enum(['accepted', 'rejected']),
    accepted_revision: z.string().min(1).max(160).optional(),
    evidence_refs: z.array(z.string().max(160)).max(16),
    replayed: z.boolean(),
  }) }).safeParse(value)
  if (!parsed.success) return undefined
  const receipt = parsed.data.data
  const reviewRef = receipt.review_item_ref.replace(/^review:/u, '')
  if (reviewRef !== expected.reviewItemRef && receipt.review_item_ref !== expected.reviewItemRef) return undefined
  if (receipt.status !== expected.status) return undefined
  return {
    reviewItemRef: reviewRef, decisionRef: receipt.decision_ref, status: receipt.status,
    ...(receipt.accepted_revision === undefined ? {} : { acceptedRevision: receipt.accepted_revision }),
  }
}

export interface AuctraExportReceipt {
  readonly artifactRef: string
  readonly unitRef: string
  readonly sourceVersion: string
}

export function normalizeAuctraExportReceipt(value: unknown, expected: { unitRef: string; sourceVersion: string }): AuctraExportReceipt | undefined {
  const parsed = z.object({ schema_version: z.literal('auctra.api.envelope.v1'), status: z.literal('success'), data: z.object({
    schema_version: z.literal('auctra.export_receipt.v1'),
    artifact_ref: z.string().min(1).max(160),
    unit_ref: z.string().min(1).max(160),
    source_version_ref: z.string().min(1).max(160),
    evidence_refs: z.array(z.string().max(160)).max(16),
    replayed: z.boolean(),
    review_decision_ref: z.string().max(160).optional(),
  }) }).safeParse(value)
  if (!parsed.success) return undefined
  const receipt = parsed.data.data
  if (receipt.unit_ref !== expected.unitRef || receipt.source_version_ref !== expected.sourceVersion) return undefined
  return { artifactRef: receipt.artifact_ref, unitRef: receipt.unit_ref, sourceVersion: receipt.source_version_ref }
}

/** Body-free document revision for fixed-version export. The body is discarded. */
export function normalizeAuctraDocumentRevision(value: unknown, expected: { unitId: string }) {
  const parsed = z.object({ schema_version: z.literal('auctra.api.envelope.v1'), status: z.literal('success'),
    data: z.object({ unit_id: z.string().min(1).max(160), revision: z.string().min(1).max(160) }).passthrough() }).safeParse(value)
  if (!parsed.success || parsed.data.data.unit_id !== expected.unitId) return undefined
  return { unitId: parsed.data.data.unit_id, revision: parsed.data.data.revision }
}
