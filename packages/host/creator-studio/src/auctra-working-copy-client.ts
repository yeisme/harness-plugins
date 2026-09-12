import { AUCTRA_EDITOR_RECOVERY_SCHEMA_DIGEST, auctraRecoveryClientRef, normalizeAuctraRecoveryPage, normalizeAuctraRecoveryContent, normalizeAuctraRecoverySaved, type AuctraRecoveryDraftSummary } from './auctra-editor-recovery.ts'
import { createHash } from 'node:crypto'
import { ArtifactRefSchema, type ArtifactRefV1 } from '@yeisme/dsh-pane-protocol'
import { auctraWorkingCopyOpenRefSchema, normalizeAuctraCandidatePage, normalizeAuctraCandidateContent, normalizeAuctraCandidateAdopt, normalizeAuctraCheckpoint, normalizeAuctraCheckpointPage, normalizeAuctraDocumentRevision, normalizeAuctraExportReceipt, normalizeAuctraReviewDecision, normalizeAuctraReviewQueue, normalizeAuctraReviewSubmit, normalizeAuctraScreenplayDraftOpen, normalizeAuctraScreenplayDraftSave, normalizeAuctraScreenplayDraftSaveStatus, normalizeAuctraTextUnitList, normalizeAuctraWorkingCopyCandidate, normalizeAuctraWorkingCopyOpen, normalizeAuctraWorkingCopyReceipt, normalizeAuctraWorkingCopySaveStatus, type AuctraExportReceipt, type AuctraReviewDecision, type AuctraReviewQueueItem, type AuctraTextStructureItem, type AuctraWorkingCopyCandidate, type AuctraWorkingCopyCheckpoint, type AuctraWorkingCopyReviewSubmit } from './auctra-working-copy.ts'
import type { CreatorArtifactContentV1, CreatorStudioContextV1 } from './types.ts'

export const AUCTRA_WORKING_COPY_SCHEMA_DIGEST = 'b7f15cedede385957b1956e4841637e12f5b379a471c531eccdfada55949314f'
export const AUCTRA_CANDIDATE_CONTENT_SCHEMA_DIGEST = '1780a2fa0ee082cbd3d61ce9b363e115b859e6f529b44842e10d917beec1b0e9'
export const AUCTRA_CANDIDATE_LIST_SCHEMA_DIGEST = '9ed42760be771c1b81070cac1cf0eece686edba2e11e3c8ff8e0b7d82e93509d'
export interface AuctraWorkingCopyConnection {
  readonly context: CreatorStudioContextV1
  readonly baseURL: string
  readonly headers: Readonly<Record<string, string>>
  readonly ownerProjectRef: string
  /** Trusted Host admission, never populated from browser action values or old Workbench flags. */
  readonly admission?: { readonly consumer: 'dsh'; readonly schemaDigest: string; readonly approved: boolean; readonly writeApproved?: boolean; readonly candidateContentDigest?: string; readonly candidateListDigest?: string; readonly candidateRequestRecovery?: 'v1alpha1'; readonly editorRecoveryDigest?: string }
}
export type AuctraWorkingCopyReadResult = { readonly status: 'ready'; readonly value: CreatorArtifactContentV1 }
  | { readonly status: 'needs_contract' | 'permission_denied' | 'unavailable' | 'unconfirmed' | 'invalid_input' | 'conflict' }

type Failure = Exclude<AuctraWorkingCopyReadResult, { status: 'ready' }>
type Result<T> = { readonly status: 'ready'; readonly value: T } | Failure
export type AuctraWorkingCopySaveResult = Result<NonNullable<ReturnType<typeof normalizeAuctraWorkingCopyReceipt>>>
export type AuctraWorkingCopyCandidateResult = Result<AuctraWorkingCopyCandidate>
export type AuctraWorkingCopyAdoptResult = Result<NonNullable<ReturnType<typeof normalizeAuctraCandidateAdopt>>>
export type AuctraWorkingCopyCheckpointResult = Result<AuctraWorkingCopyCheckpoint>
export type AuctraWorkingCopyCheckpointPageResult = Result<{ readonly checkpoints: readonly AuctraWorkingCopyCheckpoint[] }>
export type AuctraWorkingCopyReviewSubmitResult = Result<AuctraWorkingCopyReviewSubmit>
export type AuctraReviewQueueResult = Result<{ readonly items: readonly AuctraReviewQueueItem[] }>
export type AuctraReviewDecisionResult = Result<AuctraReviewDecision>
export type AuctraExportResult = Result<AuctraExportReceipt>
const hash = (body: string) => createHash('sha256').update(body).digest('hex')
const workingRefOf = (artifact: ArtifactRefV1) => artifact.ref.match(/^auctra:working-copy:[a-f0-9]{32}:(twc-[A-Za-z0-9._-]+|screenplay-draft:[A-Za-z0-9][A-Za-z0-9._-]*)$/u)?.[1]
const validKey = (key: string) => /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(key)
const validText = (body: string) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(new TextEncoder().encode(body)) === body

/** Explicit loopback open over the existing Auctra contract; no CLI fallback or auto-retry. */
export class AuctraWorkingCopyClient {
  constructor(private readonly resolve: (context: CreatorStudioContextV1) => Promise<AuctraWorkingCopyConnection | undefined>,
    private readonly fetcher: typeof fetch = fetch) {}

  async saveRecoveryDraft(context: CreatorStudioContextV1, input: { unitRef: string; base: CreatorArtifactContentV1; content: string; previous?: AuctraRecoveryDraftSummary }) {
    const { unitRef, content, base } = input
    const previous = input.previous === undefined ? undefined : Object.freeze({ ...input.previous })
    const artifact = ArtifactRefSchema.safeParse(base.artifact)
    if (!artifact.success || artifact.data.owner !== 'auctra' || artifact.data.kind !== 'text' || !workingRefOf(artifact.data)
      || !auctraWorkingCopyOpenRefSchema.safeParse(unitRef).success || base.contentRevision !== artifact.data.version
      || !/^(0|[1-9][0-9]{0,15}):(?:sha256:)?[a-f0-9]{64}$/u.test(base.contentRevision)
      || !validText(content) || new TextEncoder().encode(content).byteLength > 2 * 1024 * 1024
      || !validText(base.content) || hash(base.content) !== base.contentRevision.split(':').at(-1)) return { status: 'invalid_input' } as const
    const match = previous?.ref.match(/^auctra:editor-recovery:([a-f0-9]{32}):(erd-[a-f0-9]{32})$/u)
    if (previous !== undefined && (!match || previous.unitRef !== unitRef || previous.baseVersion !== base.contentRevision
      || !Number.isSafeInteger(previous.revision) || previous.revision < 1 || previous.revision >= Number.MAX_SAFE_INTEGER)) return { status: 'invalid_input' } as const
    const clientRef = auctraRecoveryClientRef(context)
    const baseVersion = base.contentRevision
    return this.request(context, '', 'POST', { client_ref: clientRef, unit_ref: unitRef, base_version: baseVersion, body: content,
      expected_revision: previous?.revision ?? 0, ...(match === undefined || match === null ? {} : { draft_ref: match[2] }) },
    (body, ownerProjectRef) => normalizeAuctraRecoverySaved(body, { ownerProjectRef, clientRef, unitRef, baseVersion, content,
      ...(previous === undefined ? {} : { previous }) }), artifact.data,
    { editorRecovery: true, ...(match?.[1] === undefined ? {} : { recoveryProjectHash: match[1] }), conflictStatuses: [409], conflictCodes: ['editor_recovery_conflict'],
      path: '/api/v1/projects/current/editor-recovery-drafts/save?major=1' })
  }

  async listRecoveryDrafts(context: CreatorStudioContextV1, input: { unitRef?: string; cursor?: string; limit?: number } = {}) {
    if ((input.unitRef !== undefined && !auctraWorkingCopyOpenRefSchema.safeParse(input.unitRef).success)
      || (input.cursor !== undefined && (input.cursor.length === 0 || input.cursor.length > 1024))
      || (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100))) return { status: 'invalid_input' } as const
    const clientRef = auctraRecoveryClientRef(context)
    const query = new URLSearchParams({ major: '1', client_ref: clientRef, limit: String(input.limit ?? 50) })
    if (input.unitRef !== undefined) query.set('unit_ref', input.unitRef)
    if (input.cursor !== undefined) query.set('cursor', input.cursor)
    return this.request(context, '', 'GET', undefined, (body, ownerProjectRef) => normalizeAuctraRecoveryPage(body,
      { ownerProjectRef, clientRef, ...(input.unitRef === undefined ? {} : { unitRef: input.unitRef }) }), undefined,
      { editorRecovery: true, path: `/api/v1/projects/current/editor-recovery-drafts?${query}` })
  }

  async readRecoveryDraft(context: CreatorStudioContextV1, input: AuctraRecoveryDraftSummary) {
    const claim = Object.freeze({ ...input })
    const match = claim.ref.match(/^auctra:editor-recovery:([a-f0-9]{32}):(erd-[a-f0-9]{32})$/u)
    if (!match) return { status: 'invalid_input' } as const
    const clientRef = auctraRecoveryClientRef(context)
    return this.request(context, '', 'GET', undefined, (body, ownerProjectRef) => normalizeAuctraRecoveryContent(body, { ownerProjectRef, clientRef, claim }), undefined,
      { editorRecovery: true, recoveryProjectHash: match[1]!, path: `/api/v1/projects/current/editor-recovery-drafts/${match[2]}/content?major=1&client_ref=${encodeURIComponent(clientRef)}` })
  }

  async listUnits(context: CreatorStudioContextV1): Promise<Result<readonly AuctraTextStructureItem[]>> {
    return this.request(context, 'text-units', 'GET', undefined, body => normalizeAuctraTextUnitList(body), undefined,
      { family: 'text-units', path: '/api/v1/projects/current/text-units?major=1' })
  }

  async open(context: CreatorStudioContextV1, unitRef: string, expectedVersion?: string): Promise<AuctraWorkingCopyReadResult> {
    if (!auctraWorkingCopyOpenRefSchema.safeParse(unitRef).success) return { status: 'invalid_input' }
    if (unitRef.startsWith('screenplay-draft:')) {
      return this.request(context, 'open', 'POST', { unit_ref: unitRef }, (body, ownerProjectRef) => normalizeAuctraScreenplayDraftOpen(body, {
        ownerProjectRef, openRef: unitRef, ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
      })?.content)
    }
    return this.request(context, 'open', 'POST', { unit_ref: unitRef }, (body, ownerProjectRef) => normalizeAuctraWorkingCopyOpen(body, {
      ownerProjectRef, openRef: unitRef, ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
    }))
  }

  async save(context: CreatorStudioContextV1, input: { unitRef: string; base: CreatorArtifactContentV1; content: string; idempotencyKey: string }): Promise<AuctraWorkingCopySaveResult> {
    const { base, content, unitRef, idempotencyKey } = input
    const artifact = ArtifactRefSchema.safeParse(base.artifact)
    const ref = artifact.success ? workingRefOf(artifact.data) : undefined
    if (!ref || !artifact.success || artifact.data.owner !== 'auctra' || artifact.data.kind !== 'text'
      || !['text/plain', 'text/markdown'].includes(artifact.data.mediaType ?? '')
      || !auctraWorkingCopyOpenRefSchema.safeParse(unitRef).success || unitRef.startsWith('screenplay-draft:') || !validKey(idempotencyKey)
      || base.contentRevision !== artifact.data.version || new TextEncoder().encode(base.content).byteLength > 2 * 1024 * 1024 || new TextEncoder().encode(content).byteLength > 2 * 1024 * 1024) return { status: 'invalid_input' }
    const version = artifact.data.version.match(/^(0|[1-9][0-9]*):([a-f0-9]{64})$/u)
    if (!version || !Number.isSafeInteger(Number(version[1])) || Number(version[1]) >= Number.MAX_SAFE_INTEGER || hash(base.content) !== version[2]
      || !validText(base.content) || !validText(content)) return { status: 'invalid_input' }
    const changed = content !== base.content
    return this.request(context, ref, 'PUT', { base_revision: Number(version[1]), base_digest: version[2], producer_kind: 'human_edit',
      edits: changed ? [{ from_utf16: 0, to_utf16: base.content.length, insert: content }] : [], result_digest: hash(content), idempotency_key: idempotencyKey,
    }, (body, ownerProjectRef) => {
      const receipt = normalizeAuctraWorkingCopyReceipt(body, { ownerProjectRef, openRef: unitRef })
      return receipt?.artifact.ref === artifact.data.ref && receipt.contentRevision === `${Number(version[1]) + Number(changed)}:${hash(content)}`
        && receipt.byteLength === new TextEncoder().encode(content).byteLength ? receipt : undefined
    }, artifact.data)
  }

  async inspectForSave(context: CreatorStudioContextV1, unitRef: string, claim: ArtifactRefV1, candidateRecovery = false): Promise<Result<ArtifactRefV1>> {
    const artifact = ArtifactRefSchema.safeParse(claim)
    const ref = artifact.success ? workingRefOf(artifact.data) : undefined
    if (!artifact.success || !ref || artifact.data.owner !== 'auctra' || artifact.data.kind !== 'text'
      || !auctraWorkingCopyOpenRefSchema.safeParse(unitRef).success) return { status: 'invalid_input' }
    const normalize = unitRef.startsWith('screenplay-draft:') ? normalizeAuctraScreenplayDraftSaveStatus : normalizeAuctraWorkingCopySaveStatus
    return this.request(context, ref, 'GET', undefined, (body, ownerProjectRef) => normalize(body,
      { ownerProjectRef, openRef: unitRef, artifactRef: artifact.data.ref, version: artifact.data.version }), artifact.data, { candidateRecovery })
  }

  async reconcileSave(context: CreatorStudioContextV1, input: { unitRef: string; artifact: ArtifactRefV1; idempotencyKey: string; candidateRecovery?: boolean }): Promise<AuctraWorkingCopySaveResult> {
    const artifact = ArtifactRefSchema.safeParse(input.artifact)
    const ref = artifact.success ? workingRefOf(artifact.data) : undefined
    if (!ref || !artifact.success || artifact.data.owner !== 'auctra' || artifact.data.kind !== 'text' || !validKey(input.idempotencyKey)
      || !auctraWorkingCopyOpenRefSchema.safeParse(input.unitRef).success || input.unitRef.startsWith('screenplay-draft:')) return { status: 'invalid_input' }
    return this.request(context, `${ref}/reconcile`, 'POST', { idempotency_key: input.idempotencyKey }, (body, ownerProjectRef) => {
      const receipt = normalizeAuctraWorkingCopyReceipt(body, { ownerProjectRef, openRef: input.unitRef }, true)
      return receipt?.artifact.ref === artifact.data.ref ? receipt : undefined
    }, artifact.data, { candidateRecovery: input.candidateRecovery === true })
  }

  async createCandidate(context: CreatorStudioContextV1, input: { unitRef: string; base: CreatorArtifactContentV1; content: string; producerRef?: string }): Promise<AuctraWorkingCopyCandidateResult> {
    const { base, content, unitRef } = input
    const artifact = ArtifactRefSchema.safeParse(base.artifact)
    const ref = artifact.success ? workingRefOf(artifact.data) : undefined
    if (!ref || !artifact.success || !ref.startsWith('twc-') || artifact.data.owner !== 'auctra' || artifact.data.kind !== 'text'
      || !auctraWorkingCopyOpenRefSchema.safeParse(unitRef).success || unitRef.startsWith('screenplay-draft:')
      || base.contentRevision !== artifact.data.version || !validText(content) || content.length === 0 || content.length > 256 * 1024) return { status: 'invalid_input' }
    const version = base.contentRevision.match(/^(0|[1-9][0-9]*):([a-f0-9]{64})$/u)
    if (!version || !Number.isSafeInteger(Number(version[1])) || !validText(base.content) || hash(base.content) !== version[2]) return { status: 'invalid_input' }
    return this.request(context, `${ref}/candidates`, 'POST', { form: 'document', body: content, producer_ref: input.producerRef ?? 'agent:dsh',
      expected_base_revision: Number(version[1]), expected_base_digest: version[2] },
      (body, ownerProjectRef) => {
        const candidate = normalizeAuctraWorkingCopyCandidate(body, { ownerProjectRef, workingCopyRef: ref })
        return candidate?.status === 'ready' && candidate.sourceVersion === base.contentRevision
          && candidate.version === `${version[1]}:${hash(content)}` ? candidate : undefined
      }, artifact.data)
  }

  async listCandidates(context: CreatorStudioContextV1, input: { artifact: ArtifactRefV1; cursor?: string; limit?: number }) {
    const artifact = ArtifactRefSchema.safeParse(input.artifact), limit = input.limit ?? 50
    const ref = artifact.success ? workingRefOf(artifact.data) : undefined
    if (!artifact.success || artifact.data.owner !== 'auctra' || artifact.data.kind !== 'text' || !ref?.startsWith('twc-')
      || !Number.isInteger(limit) || limit < 1 || limit > 100 || (input.cursor !== undefined && !/^[A-Za-z0-9_-]{1,1024}$/u.test(input.cursor))) return { status: 'invalid_input' as const }
    return this.request(context, '', 'GET', undefined, (body, ownerProjectRef) => normalizeAuctraCandidatePage(body, { ownerProjectRef, workingCopyRef: ref, limit }), undefined,
      { candidateList: true, scopeArtifact: artifact.data, path: `/api/v1/projects/current/text-working-copies/${ref}/candidates?major=1&limit=${limit}${input.cursor ? `&cursor=${encodeURIComponent(input.cursor)}` : ''}` })
  }

  async readCandidateContent(context: CreatorStudioContextV1, input: { artifact: ArtifactRefV1; candidateRef: string; version: string }): Promise<AuctraWorkingCopyReadResult> {
    const artifact = ArtifactRefSchema.safeParse(input.artifact)
    const ref = artifact.success ? workingRefOf(artifact.data) : undefined
    const version = input.version.match(/^(0|[1-9][0-9]*):([a-f0-9]{64})$/u)
    if (!artifact.success || artifact.data.owner !== 'auctra' || artifact.data.kind !== 'text' || !ref?.startsWith('twc-')
      || !/^cand-[A-Za-z0-9]+$/u.test(input.candidateRef) || !version) return { status: 'invalid_input' }
    return this.request(context, '', 'GET', undefined, (body, ownerProjectRef) => normalizeAuctraCandidateContent(body,
      { ownerProjectRef, workingCopyRef: ref, candidateRef: input.candidateRef, version: input.version }), undefined,
      { candidateContent: true, scopeArtifact: artifact.data,
        path: `/api/v1/projects/current/text-working-copies/${ref}/candidates/${input.candidateRef}/content?major=1&expected_digest=${version[2]}` })
  }

  async showCandidate(context: CreatorStudioContextV1, input: { artifact: ArtifactRefV1; candidateRef: string }): Promise<AuctraWorkingCopyCandidateResult> {
    const artifact = ArtifactRefSchema.safeParse(input.artifact)
    const ref = artifact.success ? workingRefOf(artifact.data) : undefined
    if (!ref || !artifact.success || !ref.startsWith('twc-') || !/^cand-[A-Za-z0-9]+$/u.test(input.candidateRef)) return { status: 'invalid_input' }
    return this.request(context, `${ref}/candidates/${input.candidateRef}`, 'GET', undefined,
      (body, ownerProjectRef) => normalizeAuctraWorkingCopyCandidate(body, { ownerProjectRef, workingCopyRef: ref }))
  }

  async rejectCandidate(context: CreatorStudioContextV1, input: { artifact: ArtifactRefV1; candidateRef: string }): Promise<AuctraWorkingCopyCandidateResult> {
    const artifact = ArtifactRefSchema.safeParse(input.artifact)
    const ref = artifact.success ? workingRefOf(artifact.data) : undefined
    if (!ref || !artifact.success || !ref.startsWith('twc-') || artifact.data.owner !== 'auctra' || artifact.data.kind !== 'text'
      || !/^cand-[A-Za-z0-9]+$/u.test(input.candidateRef)) return { status: 'invalid_input' }
    return this.request(context, `${ref}/candidates/${input.candidateRef}/reject`, 'POST', {},
      (body, ownerProjectRef) => {
        const candidate = normalizeAuctraWorkingCopyCandidate(body, { ownerProjectRef, workingCopyRef: ref })
        return candidate?.ref === input.candidateRef && candidate.status === 'superseded' ? candidate : undefined
      }, artifact.data)
  }

  async adoptCandidate(context: CreatorStudioContextV1, input: { unitRef: string; base: CreatorArtifactContentV1; candidateRef: string; sourceVersion: string; requestKey?: string }): Promise<AuctraWorkingCopyAdoptResult> {
    const artifact = ArtifactRefSchema.safeParse(input.base.artifact)
    const ref = artifact.success ? workingRefOf(artifact.data) : undefined
    if (!ref || !artifact.success || !ref.startsWith('twc-') || !auctraWorkingCopyOpenRefSchema.safeParse(input.unitRef).success
      || input.unitRef.startsWith('screenplay-draft:') || input.base.contentRevision !== artifact.data.version
      || input.sourceVersion !== artifact.data.version || !/^cand-[A-Za-z0-9]+$/u.test(input.candidateRef)) return { status: 'invalid_input' }
    if (input.requestKey !== undefined && (!validKey(input.requestKey) || input.requestKey.startsWith('candidate:'))) return { status: 'invalid_input' }
    return this.request(context, `${ref}/candidates/${input.candidateRef}/apply`, 'POST', input.requestKey === undefined ? {} : { request_key: input.requestKey },
      (body, ownerProjectRef) => {
        const adopted = normalizeAuctraCandidateAdopt(body, { ownerProjectRef, openRef: input.unitRef, workingCopyRef: ref, candidateRef: input.candidateRef })
        return adopted?.receipt.artifact.ref === artifact.data.ref ? adopted : undefined
      }, artifact.data, { candidateRecovery: input.requestKey !== undefined, conflictStatuses: [409, 422], conflictCodes: ['candidate_stale', 'working_copy_conflict', 'idempotency_conflict'] })
  }

  /** Compatibility screenplay draft save via the owner's text.draft.save route.
   * The generic working-copy PUT stays rejected for drafts. The expected revision
   * keeps the CALLER's fixed base (version + digest); a fresh open only supplies
   * the canonical base revision, so a replay of an already-committed save is
   * recognized by the owner's fingerprint instead of being mistaken for a stale
   * base, and a genuinely stale base fails as a typed server conflict. */
  async saveScreenplayDraft(context: CreatorStudioContextV1, input: { draftRef: string; base: CreatorArtifactContentV1; content: string; idempotencyKey: string }): Promise<AuctraWorkingCopySaveResult> {
    const { base, content, draftRef, idempotencyKey } = input
    const unitRef = `screenplay-draft:${draftRef}`
    const artifact = ArtifactRefSchema.safeParse(base.artifact)
    const baseRevision = artifact.success ? base.contentRevision.match(/^(\d+):(sha256:[a-f0-9]{64})$/u) : undefined
    if (!artifact.success || !baseRevision || artifact.data.owner !== 'auctra' || artifact.data.kind !== 'text'
      || !auctraWorkingCopyOpenRefSchema.safeParse(unitRef).success || !validKey(idempotencyKey)
      || base.contentRevision !== artifact.data.version || new TextEncoder().encode(base.content).byteLength > 2 * 1024 * 1024 || new TextEncoder().encode(content).byteLength > 2 * 1024 * 1024
      || !validText(base.content) || !validText(content)) return { status: 'invalid_input' }
    const fresh = await this.request(context, 'open', 'POST', { unit_ref: unitRef }, (body, ownerProjectRef) =>
      normalizeAuctraScreenplayDraftOpen(body, { ownerProjectRef, openRef: unitRef }), artifact.data)
    if (fresh.status !== 'ready') return fresh
    const opened = fresh.value
    if (opened.content.artifact.ref !== artifact.data.ref) return { status: 'invalid_input' }
    const expectedRevision = `draft:${baseRevision[1]}:${opened.baseCanonicalRevision}:${baseRevision[2]}`
    return this.request(context, `${encodeURIComponent(unitRef)}/draft`, 'PUT', { body: content, expected_revision: expectedRevision, idempotency_key: idempotencyKey },
      (body, ownerProjectRef) => normalizeAuctraScreenplayDraftSave(body, { ownerProjectRef, openRef: unitRef, baseRevision: Number(baseRevision[1]),
        baseCanonicalRevision: opened.baseCanonicalRevision, content, mediaType: opened.content.artifact.mediaType ?? 'text/plain' }),
      artifact.data, { family: 'text-units', conflictStatuses: [409], conflictCodes: ['draft_version_conflict'] })
  }

  async createCheckpoint(context: CreatorStudioContextV1, input: { artifact: ArtifactRefV1 }): Promise<AuctraWorkingCopyCheckpointResult> {
    const artifact = ArtifactRefSchema.safeParse(input.artifact)
    const ref = artifact.success ? workingRefOf(artifact.data) : undefined
    if (!ref || !artifact.success || !ref.startsWith('twc-') || artifact.data.owner !== 'auctra' || artifact.data.kind !== 'text') return { status: 'invalid_input' }
    return this.request(context, `${ref}/checkpoints`, 'POST', {},
      (_body, _ownerProjectRef) => normalizeAuctraCheckpoint(_body, { workingCopyRef: ref }), artifact.data)
  }

  async listCheckpoints(context: CreatorStudioContextV1, input: { artifact: ArtifactRefV1 }): Promise<AuctraWorkingCopyCheckpointPageResult> {
    const artifact = ArtifactRefSchema.safeParse(input.artifact)
    const ref = artifact.success ? workingRefOf(artifact.data) : undefined
    if (!artifact.success || artifact.data.owner !== 'auctra' || artifact.data.kind !== 'text' || !ref?.startsWith('twc-')) return { status: 'invalid_input' }
    return this.request(context, `${ref}/checkpoints`, 'GET', undefined,
      (body) => normalizeAuctraCheckpointPage(body, { workingCopyRef: ref }), undefined, { scopeArtifact: artifact.data })
  }

  async submitReview(context: CreatorStudioContextV1, input: { artifact: ArtifactRefV1; checkpointRef: string }): Promise<AuctraWorkingCopyReviewSubmitResult> {
    const artifact = ArtifactRefSchema.safeParse(input.artifact)
    const ref = artifact.success ? workingRefOf(artifact.data) : undefined
    if (!ref || !artifact.success || !ref.startsWith('twc-') || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u.test(input.checkpointRef)) return { status: 'invalid_input' }
    return this.request(context, `${ref}/review`, 'POST', { checkpoint_ref: input.checkpointRef },
      (body) => normalizeAuctraReviewSubmit(body, { workingCopyRef: ref, checkpointRef: input.checkpointRef }), artifact.data)
  }

  async listReviewQueue(context: CreatorStudioContextV1): Promise<AuctraReviewQueueResult> {
    return this.request(context, '', 'GET', undefined, (body) => normalizeAuctraReviewQueue(body), undefined,
      { path: '/api/v1/projects/current/review/queue?status=pending&limit=50' })
  }

  async decideReview(context: CreatorStudioContextV1, input: { artifact: ArtifactRefV1; reviewItemRef: string; expectedVersion: string; decision: 'accept' | 'reject'; idempotencyKey: string }): Promise<AuctraReviewDecisionResult> {
    const artifact = ArtifactRefSchema.safeParse(input.artifact)
    if (!artifact.success || artifact.data.owner !== 'auctra' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u.test(input.reviewItemRef)
      || !validKey(input.idempotencyKey) || input.expectedVersion.length === 0 || input.expectedVersion.length > 160) return { status: 'invalid_input' }
    const status = input.decision === 'accept' ? 'accepted' as const : 'rejected' as const
    return this.request(context, '', 'POST', { expected_version: input.expectedVersion, idempotency_key: input.idempotencyKey },
      (body) => normalizeAuctraReviewDecision(body, { reviewItemRef: input.reviewItemRef, status }), artifact.data,
      { path: `/api/v1/projects/current/review/items/${encodeURIComponent(input.reviewItemRef)}/${input.decision}`,
        conflictStatuses: [409], conflictCodes: ['draft_version_conflict'] })
  }

  async exportFixedVersion(context: CreatorStudioContextV1, input: { artifact: ArtifactRefV1; unitRef: string; expectedRevision: string; format: 'markdown' | 'plain_text'; idempotencyKey: string }): Promise<AuctraExportResult> {
    const artifact = ArtifactRefSchema.safeParse(input.artifact)
    const unitId = auctraWorkingCopyOpenRefSchema.safeParse(input.unitRef).success ? input.unitRef.replace(/^(?:text|chapter):/u, '') : undefined
    if (!artifact.success || artifact.data.owner !== 'auctra' || !unitId || input.unitRef.startsWith('screenplay-draft:')
      || !validKey(input.idempotencyKey) || input.expectedRevision.length === 0 || input.expectedRevision.length > 160) return { status: 'invalid_input' }
    return this.request(context, '', 'POST', { format: input.format, expected_revision: input.expectedRevision, idempotency_key: input.idempotencyKey },
      (body) => normalizeAuctraExportReceipt(body, { unitRef: `text:${unitId}`, sourceVersion: input.expectedRevision }), artifact.data,
      { family: 'text-units', path: `/api/v1/projects/current/text-units/${encodeURIComponent(unitId)}/export`,
        conflictStatuses: [409], conflictCodes: ['draft_version_conflict'] })
  }

  async inspectExportRevision(context: CreatorStudioContextV1, input: { artifact: ArtifactRefV1; unitRef: string }): Promise<Result<{ readonly unitId: string; readonly revision: string }>> {
    const artifact = ArtifactRefSchema.safeParse(input.artifact)
    const unitId = auctraWorkingCopyOpenRefSchema.safeParse(input.unitRef).success ? input.unitRef.replace(/^(?:text|chapter):/u, '') : undefined
    if (!artifact.success || artifact.data.owner !== 'auctra' || !unitId || input.unitRef.startsWith('screenplay-draft:')) return { status: 'invalid_input' }
    return this.request(context, '', 'GET', undefined, (body) => normalizeAuctraDocumentRevision(body, { unitId }), undefined,
      { scopeArtifact: artifact.data, path: `/api/v1/projects/current/text-units/${encodeURIComponent(unitId)}/draft` })
  }

  private async request<T>(context: CreatorStudioContextV1, route: string, method: 'GET' | 'POST' | 'PUT', payload: unknown,
    normalize: (body: unknown, ownerProjectRef: string) => T | undefined, writeArtifact?: ArtifactRefV1,
    options?: { recoveryProjectHash?: string; editorRecovery?: boolean; candidateRecovery?: boolean; candidateList?: boolean; candidateContent?: boolean; scopeArtifact?: ArtifactRefV1; family?: 'working-copies' | 'text-units'; path?: string; conflictStatuses?: number[]; conflictCodes?: string[] }): Promise<Result<T>> {
    const scope = Object.freeze({ ...context })
    let responseSeen = false
    try {
      const binding = await this.resolve(scope)
      if (binding === undefined) return { status: 'unavailable' }
      const keys = ['tenantRef', 'workspaceRef', 'projectRef', 'sessionRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision'] as const
      if (scope.projectRef === undefined || keys.some(key => scope[key] !== binding.context[key])) return { status: 'permission_denied' }
      if (binding.admission?.consumer !== 'dsh' || binding.admission.approved !== true || binding.admission.schemaDigest !== AUCTRA_WORKING_COPY_SCHEMA_DIGEST || (writeArtifact && binding.admission.writeApproved !== true)) return { status: 'needs_contract' }
      if (options?.editorRecovery && binding.admission.editorRecoveryDigest !== AUCTRA_EDITOR_RECOVERY_SCHEMA_DIGEST) return { status: writeArtifact && responseSeen ? 'unconfirmed' : 'needs_contract' }
      if (options?.candidateContent && binding.admission.candidateContentDigest !== AUCTRA_CANDIDATE_CONTENT_SCHEMA_DIGEST) return { status: 'needs_contract' }
      if (options?.candidateList && binding.admission.candidateListDigest !== AUCTRA_CANDIDATE_LIST_SCHEMA_DIGEST) return { status: 'needs_contract' }
      if (options?.candidateRecovery && binding.admission.candidateRequestRecovery !== 'v1alpha1') return { status: writeArtifact && responseSeen ? 'unconfirmed' : 'needs_contract' }
      const base = new URL(binding.baseURL)
      if (!['http:', 'https:'].includes(base.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)
        || base.username || base.password || base.search || base.hash || base.pathname !== '/') return { status: 'unavailable' }
      if (!binding.ownerProjectRef) return { status: 'permission_denied' }
      const ownerProjectRef = binding.ownerProjectRef
      if (options?.recoveryProjectHash !== undefined && options.recoveryProjectHash !== hash(ownerProjectRef).slice(0, 32)) return { status: 'permission_denied' }
      if (writeArtifact && !writeArtifact.ref.startsWith(`auctra:working-copy:${hash(ownerProjectRef).slice(0, 32)}:`)) return { status: 'permission_denied' }
      if (options?.scopeArtifact && !options.scopeArtifact.ref.startsWith(`auctra:working-copy:${hash(ownerProjectRef).slice(0, 32)}:`)) return { status: 'permission_denied' }
      const headers = new Headers(binding.headers)
      headers.set('Accept', 'application/json'); headers.set('Content-Type', 'application/json')
      const path = options?.path ?? `${options?.family === 'text-units' ? '/api/v1/projects/current/text-units/' : '/api/v1/projects/current/text-working-copies/'}${route}?major=1`
      const response = await this.fetcher(new URL(path, base), {
        method, headers, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }), redirect: 'error', signal: AbortSignal.timeout(15_000),
      })
      responseSeen = true
      const conflictStatuses = options?.conflictStatuses ?? [409, 422]
      const conflictResponse = (method === 'PUT' || options?.conflictCodes !== undefined) && conflictStatuses.includes(response.status)
      const invalidPageResponse = method === 'GET' && options?.candidateList === true && response.status === 400
      if (response.status !== 200 && !conflictResponse && !invalidPageResponse) {
        await response.body?.cancel()
        return { status: response.status === 401 || response.status === 403 ? 'permission_denied' : response.status === 404 ? 'unavailable' : 'unconfirmed' }
      }
      const reader = response.body?.getReader()
      if (reader === undefined) return { status: 'unconfirmed' }
      const chunks: Uint8Array[] = []; let length = 0
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          length += value.byteLength
          // Allow JSON escaping overhead for the 2MiB owner body ceiling, but never unbounded output.
          if (length > 16 * 1024 * 1024) { await reader.cancel(); return { status: 'unconfirmed' } }
          chunks.push(value)
        }
      } finally { reader.releaseLock() }
      const bytes = new Uint8Array(length); let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      if (keys.some(key => scope[key] !== binding.context[key]) || binding.ownerProjectRef !== ownerProjectRef) return { status: writeArtifact ? 'unconfirmed' : 'permission_denied' }
      if (binding.admission?.consumer !== 'dsh' || binding.admission.approved !== true || binding.admission.schemaDigest !== AUCTRA_WORKING_COPY_SCHEMA_DIGEST || (writeArtifact && binding.admission.writeApproved !== true)) return { status: writeArtifact ? 'unconfirmed' : 'needs_contract' }
      if (options?.editorRecovery && binding.admission.editorRecoveryDigest !== AUCTRA_EDITOR_RECOVERY_SCHEMA_DIGEST) return { status: writeArtifact && responseSeen ? 'unconfirmed' : 'needs_contract' }
      if (options?.candidateContent && binding.admission.candidateContentDigest !== AUCTRA_CANDIDATE_CONTENT_SCHEMA_DIGEST) return { status: 'needs_contract' }
      if (options?.candidateList && binding.admission.candidateListDigest !== AUCTRA_CANDIDATE_LIST_SCHEMA_DIGEST) return { status: 'needs_contract' }
      if (options?.candidateRecovery && binding.admission.candidateRequestRecovery !== 'v1alpha1') return { status: writeArtifact && responseSeen ? 'unconfirmed' : 'needs_contract' }
      const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      if (invalidPageResponse) {
        return { status: body?.schema_version === 'auctra.api.envelope.v1' && body.status === 'failed'
          && ['patch_invalid', 'invalid_request'].includes(body.error?.code) ? 'invalid_input' : 'unconfirmed' }
      }
      if (conflictResponse) {
        const conflictCodes = options?.conflictCodes ?? (response.status === 409 ? ['working_copy_conflict'] : ['idempotency_conflict'])
        return { status: body?.schema_version === 'auctra.api.envelope.v1' && body.status === 'failed' && conflictCodes.includes(body.error?.code) ? 'conflict' : 'unconfirmed' }
      }
      const value = normalize(body, ownerProjectRef)
      return value === undefined ? { status: 'unconfirmed' } : { status: 'ready', value }
    } catch { return { status: 'unconfirmed' } }
  }
}
