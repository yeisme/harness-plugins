import { createHash } from 'node:crypto'
import { decodePaneActionValues, PANE_TEXT_BODY_BYTES, ArtifactRefSchema, PaneActionRequestSchema, PaneActionReconcileRequestSchema, PANE_ACTION_DESCRIPTOR_SCHEMA, PANE_PROTOCOL_LIMITS, type ArtifactRefV1, type PaneActionDescriptorV1, type PaneActionReceiptV1, type PaneContextV1 } from '@yeisme/dsh-pane-protocol'
import { AuctraWorkingCopyClient, type AuctraWorkingCopySaveResult } from './auctra-working-copy-client.ts'
import { auctraWorkingCopyOpenRefSchema, type AuctraWorkingCopyCandidate } from './auctra-working-copy.ts'
import type { CreatorArtifactCandidateV1, CreatorOwnerAdapterV1, CreatorResourceV1, CreatorStudioContextV1 } from './types.ts'
import { creatorCandidateQuerySchema } from './candidate-history.ts'

/** Host selection made from an explicit authorized open, never a browser-supplied path. */
export interface AuctraWorkingCopySelection {
  readonly unitRef: string
  readonly artifact: ArtifactRefV1
  readonly canSave?: boolean
}

const saveAction = 'working-copy.save'
const candidateAction = 'working-copy.candidate.create'
const adoptAction = 'working-copy.candidate.adopt'
const undoAction = 'working-copy.candidate.undo'
const checkpointAction = 'working-copy.checkpoint.create'
const reviewSubmitAction = 'working-copy.review.submit'
const reviewAcceptAction = 'review.accept'
const reviewRejectAction = 'review.reject'
const exportAction = 'text.export'
const editPresentation = { task: 'assets', owner: 'auctra' } as const
const versionsPresentation = { task: 'text', owner: 'auctra', group: 'versions' } as const
const exportPresentation = { task: 'text', owner: 'auctra', group: 'export' } as const
const descriptorFor = (kind: string, artifact: ArtifactRefV1, extra = '') =>
  `auctra:${kind}:${createHash('sha256').update(JSON.stringify([artifact.ref, artifact.version, extra])).digest('hex')}`
const sameContext = (a: PaneContextV1, b: CreatorStudioContextV1) =>
  (['tenantRef', 'workspaceRef', 'projectRef', 'sessionRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision'] as const).every(key => a[key] === b[key])
const familyKind = (family: string) => family === 'novel-chapter' ? 'chapter' : family === 'screenplay-scene' ? 'screenplay_scene' : 'text'
const projectCandidate = (artifact: ArtifactRefV1, candidate: AuctraWorkingCopyCandidate): CreatorArtifactCandidateV1 => ({
  ref: candidate.ref, version: candidate.version, title: candidate.summary, status: candidate.status, sourceVersion: candidate.sourceVersion,
  artifact: { ...artifact, ref: `${artifact.ref.replace('auctra:working-copy:', 'auctra:candidate:')}:${candidate.ref}`,
    version: candidate.version, mediaType: 'text/plain', title: 'Owner candidate', capabilities: [] },
})

/** Working Copy slice. Save requires explicit Host selection and owner write admission. */
export function createAuctraWorkingCopyAdapter(
  client: AuctraWorkingCopyClient,
  selected: (context: CreatorStudioContextV1) => Promise<AuctraWorkingCopySelection | undefined>,
  resolveOriginal?: (artifactRef: string, context: CreatorStudioContextV1) => Promise<AuctraWorkingCopySelection | undefined>,
): CreatorOwnerAdapterV1 {
  let sequence = 0
  let pending: { readonly context: CreatorStudioContextV1; readonly artifactRef: string; readonly sourceVersion: string; readonly candidate: AuctraWorkingCopyCandidate } | undefined
  async function selection(context: CreatorStudioContextV1) {
    const value = await selected({ ...context })
    if (!value || !auctraWorkingCopyOpenRefSchema.safeParse(value.unitRef).success) return undefined
    const artifact = ArtifactRefSchema.safeParse(value.artifact)
    if (!artifact.success || artifact.data.owner !== 'auctra' || artifact.data.kind !== 'text'
      || !artifact.data.ref.startsWith('auctra:working-copy:')) return undefined
    return { unitRef: value.unitRef, artifact: artifact.data, canSave: value.canSave === true }
  }
  function honesty(status: AuctraWorkingCopySaveResult['status']): string {
    if (status === 'needs_contract') return 'Auctra working-copy contract is unavailable or mismatched. No text body is shown.'
    if (status === 'permission_denied') return 'This text type is not authorized for body reads. The body area stays hidden.'
    if (status === 'unavailable') return 'Auctra is unavailable. No text body is shown.'
    if (status === 'conflict') return 'The document changed; keep the pending edit, reread, compare, or save as draft. The newer version was not overwritten.'
    return 'The Working Copy operation was not confirmed. The pending edit is kept and is not marked saved.'
  }
  function receipt(actionId: string, result: AuctraWorkingCopySaveResult): PaneActionReceiptV1 {
    if (result.status === 'ready') return { owner: 'auctra', actionId, status: 'completed',
      receiptRef: result.value.receiptRef ?? `auctra:unchanged:${createHash('sha256').update(result.value.artifact.ref + result.value.contentRevision).digest('hex')}`,
      summary: actionId === adoptAction
        ? 'Auctra adopted the candidate into the Working Copy. Checkpoint, Review, and Canon stay separate.'
        : 'Auctra confirmed the Working Copy save. Formal review and source writeback are separate.',
      outputArtifacts: [result.value.artifact] }
    return { owner: 'auctra', actionId, status: result.status === 'unconfirmed' ? 'unknown' : result.status === 'conflict' ? 'rejected' : 'rejected',
      receiptRef: `auctra:${actionId}:unsettled`, summary: honesty(result.status),
      ...(result.status === 'unconfirmed' ? { reconcileReason: 'original_save_unconfirmed' } : {}) }
  }
  function action(input: { actionId: string; label: string; artifact: ArtifactRefV1; context: CreatorStudioContextV1; extra?: string; fields: PaneActionDescriptorV1['fields']; preview: string; presentation?: PaneActionDescriptorV1['presentation'] }): PaneActionDescriptorV1 {
    return { schema: PANE_ACTION_DESCRIPTOR_SCHEMA, owner: 'auctra', actionId: input.actionId,
      descriptorRef: descriptorFor(input.actionId, input.artifact, input.extra ?? ''), targetRef: input.artifact.ref, targetVersion: input.artifact.version,
      context: input.context, label: input.label, risk: 'low', confirmation: 'none', expiresAt: new Date(Date.now() + 60_000).toISOString(),
      ...(input.actionId === saveAction ? { textBody: { field: 'body', maxBytes: PANE_TEXT_BODY_BYTES } } : {}),
      preview: { summary: input.preview, cost: { currency: 'USD', amount: 0, estimate: false } }, fields: input.fields,
      ...(input.presentation === undefined ? {} : { presentation: input.presentation }) }
  }
  return {
    owner: 'auctra', transport: 'service',
    async saveAuctraRecoveryDraft(query, context) {
      const current = await selection(context)
      if (!current?.canSave || query.base.artifact.ref !== current.artifact.ref || query.base.artifact.version !== current.artifact.version) return { status: 'permission_denied' }
      const result = await client.saveRecoveryDraft(context, { unitRef: current.unitRef, base: query.base, content: query.content,
        ...(query.previous === undefined ? {} : { previous: query.previous }) })
      const latest = await selection(context)
      if (!latest?.canSave || latest.unitRef !== current.unitRef || latest.artifact.ref !== current.artifact.ref || latest.artifact.version !== current.artifact.version) return { status: 'unconfirmed' }
      return result
    },
    async listAuctraRecoveryDrafts(query, context) {
      const current = await selection(context)
      if (!current || (query.artifact !== undefined && (query.artifact.owner !== 'auctra' || query.artifact.ref !== current.artifact.ref || query.artifact.version !== current.artifact.version))) return { status: 'permission_denied' }
      const result = await client.listRecoveryDrafts(context, { ...query, unitRef: current.unitRef })
      const latest = await selection(context)
      if (!latest || latest.unitRef !== current.unitRef || latest.artifact.ref !== current.artifact.ref || latest.artifact.version !== current.artifact.version) return { status: 'permission_denied' }
      return result
    },
    async readAuctraRecoveryDraft(claim, context) {
      const current = await selection(context)
      if (!current || current.unitRef !== claim.unitRef) return { status: 'permission_denied' }
      const result = await client.readRecoveryDraft(context, claim)
      const latest = await selection(context)
      if (!latest || latest.unitRef !== current.unitRef || latest.artifact.ref !== current.artifact.ref || latest.artifact.version !== current.artifact.version) return { status: 'permission_denied' }
      return result
    },
    async readCandidatePage(input, context) {
      const schemaVersion = 'creator.candidate-page.v1alpha1' as const
      const parsed = creatorCandidateQuerySchema.safeParse(input)
      if (!parsed.success) return { schemaVersion, status: 'invalid_input' }
      const scope = { ...context }, query = parsed.data
      const current = await selection(scope)
      if (!current || current.artifact.ref !== query.artifact.ref || current.artifact.version !== query.artifact.version
        || query.artifact.owner !== 'auctra' || query.artifact.kind !== 'text' || query.artifact.mediaType !== current.artifact.mediaType) return { schemaVersion, status: 'permission_denied' }
      const page = await client.listCandidates(scope, { artifact: current.artifact, limit: query.limit, ...(query.cursor === undefined ? {} : { cursor: query.cursor }) })
      const latest = await selection(scope)
      if (!latest || latest.unitRef !== current.unitRef || latest.artifact.ref !== current.artifact.ref || latest.artifact.version !== current.artifact.version) return { schemaVersion, status: 'permission_denied' }
      if (page.status !== 'ready') return { schemaVersion, status: page.status }
      return { schemaVersion, status: 'ready', artifact: current.artifact,
        candidates: page.value.candidates.map(candidate => projectCandidate(current.artifact, candidate)),
        ...(page.value.nextCursor ? { nextCursor: page.value.nextCursor } : {}) }
    },
    async snapshot(context) {
      const scope = { ...context }
      const listed = await client.listUnits(scope)
      const current = await selection(scope)
      const inspect = current?.canSave === true ? await client.inspectForSave(scope, current.unitRef, current.artifact) : undefined
      const writable = inspect?.status === 'ready'
      const screenplay = current?.unitRef.startsWith('screenplay-draft:') === true
      const candidateRecovery = writable && current && !screenplay ? await client.inspectForSave(scope, current.unitRef, current.artifact, true) : undefined
      const canAdopt = candidateRecovery?.status === 'ready'
      const history = current && !screenplay ? await client.listCandidates(scope, { artifact: current.artifact, limit: 50 }) : undefined
      const checkpoints = current && writable && !screenplay ? await client.listCheckpoints(scope, { artifact: current.artifact }) : undefined
      const reviews = current && writable && !screenplay ? await client.listReviewQueue(scope) : undefined
      const exportRevision = current && writable && !screenplay ? await client.inspectExportRevision(scope, { artifact: current.artifact, unitRef: current.unitRef }) : undefined
      const liveCandidate = current && pending !== undefined && pending.artifactRef === current.artifact.ref && sameContext(pending.context, scope) && pending.sourceVersion === current.artifact.version
        ? pending.candidate : undefined
      if (liveCandidate === undefined && pending?.context !== undefined && pending.artifactRef === current?.artifact.ref && sameContext(pending.context, scope)) pending = undefined
      const version = ++sequence
      const blocked = listed.status === 'needs_contract' || inspect?.status === 'needs_contract' ? 'needs_contract'
        : listed.status === 'permission_denied' || inspect?.status === 'permission_denied' ? 'permission_denied'
        : listed.status === 'unavailable' && current === undefined ? 'unavailable' : undefined
      const resources: CreatorResourceV1[] = listed.status === 'ready'
        ? listed.value.map(unit => ({ ref: unit.unitRef, version: unit.status, kind: familyKind(unit.family), title: unit.title, status: unit.status, evidenceRefs: [] }))
        : []
      if (current && !resources.some(resource => resource.artifact?.ref === current.artifact.ref)) {
        resources.unshift({ ref: current.artifact.ref, version: current.artifact.version, kind: 'text', title: 'Working Copy',
          status: 'selected_version', artifact: current.artifact, evidenceRefs: [] })
      }
      const fields = [{ key: 'body', kind: 'textarea' as const, label: 'Text', required: true, maxLength: PANE_PROTOCOL_LIMITS.actionValueChars },
        { key: 'content_revision', kind: 'text' as const, label: 'Base revision', required: true, maxLength: 160 }]
      const actions: PaneActionDescriptorV1[] = []
      if (writable && current) {
        actions.push(action({ actionId: saveAction, label: screenplay ? 'Save screenplay draft' : 'Save Working Copy', artifact: current.artifact, context: scope, fields,
          presentation: editPresentation,
          preview: screenplay
            ? `Save up to 2 MiB of UTF-8 text through text.draft.save. This does not use generic Working Copy apply, write the source file, or promote Canon.`
            : `Save up to 2 MiB of UTF-8 text in the Working Copy. This does not write back the source or promote Canon.` }))
        if (!screenplay) {
          actions.push(action({ actionId: candidateAction, label: 'Create candidate', artifact: current.artifact, context: scope, fields,
            presentation: editPresentation,
            preview: 'Create an owner candidate. The accepted Working Copy stays untouched until adoption. This is not Checkpoint, Review, or Canon.' }))
        }
      }
      const visibleCandidates = history?.status === 'ready' ? [...history.value.candidates] : []
      if (liveCandidate && !visibleCandidates.some(item => item.ref === liveCandidate.ref)) visibleCandidates.unshift(liveCandidate)
      const adoptTarget = visibleCandidates.find(item => item.status === 'ready' && item.sourceVersion === current?.artifact.version)
      const canSelectHistory = history?.status === 'ready'
      if (canAdopt && current && !screenplay && (adoptTarget || canSelectHistory)) {
        const candidateFields = [{ key: 'candidate_ref', kind: 'text' as const, label: 'Candidate', required: true, maxLength: 160 },
          { key: 'candidate_version', kind: 'text' as const, label: 'Candidate version', required: true, maxLength: 160 },
          { key: 'source_version', kind: 'text' as const, label: 'Source version', required: true, maxLength: 160 }]
        actions.push(action({ actionId: adoptAction, label: 'Adopt candidate', artifact: current.artifact, context: scope,
          fields: candidateFields, presentation: editPresentation,
          preview: 'Adopt the owner candidate into the Working Copy only. Checkpoint, Review, and Canon are not performed.' }))
        actions.push(action({ actionId: undoAction, label: 'Undo candidate', artifact: current.artifact, context: scope,
          fields: candidateFields, presentation: editPresentation,
          preview: 'Reject the pending owner candidate. The accepted Working Copy stays untouched. This is not Checkpoint, Review, or Canon.' }))
      }
      if (writable && current && !screenplay) {
        actions.push(action({ actionId: checkpointAction, label: 'Create Checkpoint', artifact: current.artifact, context: scope, fields: [],
          presentation: versionsPresentation,
          preview: 'Create an immutable Checkpoint from the current Working Copy. This is not Review, Canon, or candidate adoption.' }))
        const listedCheckpoints = checkpoints?.status === 'ready' ? checkpoints.value.checkpoints : []
        if (listedCheckpoints.length > 0) {
          actions.push(action({ actionId: reviewSubmitAction, label: 'Submit Checkpoint for Review', artifact: current.artifact, context: scope,
            presentation: versionsPresentation,
            fields: [{ key: 'checkpoint_ref', kind: 'select', label: 'Checkpoint', required: true,
              options: listedCheckpoints.map(item => ({ value: item.ref, label: item.ref })) }],
            preview: 'Submit the selected Checkpoint as a ReviewItem. Canon is not accepted automatically.' }))
        }
        const pendingReviews = reviews?.status === 'ready' ? reviews.value.items : []
        if (pendingReviews.length > 0) {
          const reviewFields: PaneActionDescriptorV1['fields'] = [{ key: 'review_item_ref', kind: 'select', label: 'Review item', required: true,
            options: pendingReviews.map(item => ({ value: item.ref, label: item.title })) },
            { key: 'expected_version', kind: 'select', label: 'Review version', required: true,
              options: pendingReviews.map(item => ({ value: item.version, label: item.version })) }]
          actions.push(action({ actionId: reviewAcceptAction, label: 'Accept Review (Canon)', artifact: current.artifact, context: scope,
            fields: reviewFields, presentation: versionsPresentation,
            preview: 'Accept the pending ReviewItem. This is the Canon decision and is independent of save, adopt, and Checkpoint.' }))
          actions.push(action({ actionId: reviewRejectAction, label: 'Reject Review', artifact: current.artifact, context: scope,
            fields: reviewFields, presentation: versionsPresentation,
            preview: 'Reject the pending ReviewItem. The Working Copy and Checkpoint stay unchanged.' }))
        }
        if (exportRevision?.status === 'ready') {
          actions.push(action({ actionId: exportAction, label: 'Export fixed version', artifact: current.artifact, context: scope,
            presentation: exportPresentation,
            fields: [{ key: 'expected_revision', kind: 'select', label: 'Fixed revision', required: true,
              options: [{ value: exportRevision.value.revision, label: exportRevision.value.revision }] },
              { key: 'format', kind: 'select', label: 'Format', required: true, options: [{ value: 'markdown', label: 'Markdown' }, { value: 'plain_text', label: 'Plain text' }] }],
            preview: 'Export the currently selected document revision. Source writeback is a separate action.' }))
        }
      }
      const candidates: CreatorArtifactCandidateV1[] = current === undefined ? [] : visibleCandidates.map(candidate => ({
        ref: candidate.ref, version: candidate.version, title: candidate.summary, status: candidate.status,
        sourceVersion: candidate.sourceVersion,
        artifact: { ...current.artifact, ref: `${current.artifact.ref.replace('auctra:working-copy:', 'auctra:candidate:')}:${candidate.ref}`, version: candidate.version, mediaType: 'text/plain', title: 'Owner candidate', capabilities: [] },
      }))
      return { schemaVersion: 'creator.owner.snapshot.v1alpha1', owner: 'auctra', transport: 'service',
        snapshotRef: `auctra:working-copy-selection:${version}`, snapshotVersion: version,
        cursor: `auctra:working-copy-selection:${version}`, sequence: version, generatedAt: new Date().toISOString(),
        context: scope, status: blocked === 'needs_contract' ? 'contract_mismatch' : blocked === 'permission_denied' ? 'permission_denied' : writable ? 'ready' : 'attention_required',
        freshness: writable ? 'fresh' : 'unknown',
        summary: blocked ? honesty(blocked) : current ? 'Open the selected Working Copy to verify its current access and version.' : 'Select an accessible Auctra text document.',
        resources, actions,
        artifactWorkspace: { status: blocked === 'needs_contract' ? 'needs_contract' : 'partial',
          safeMessage: blocked ? honesty(blocked) : screenplay
            ? 'Screenplay writeback uses text.draft.save. Candidate adoption is unavailable on the compatibility draft.'
            : history?.status === 'ready' && history.value.nextCursor
              ? 'The first 50 historical candidates are loaded. Use candidate history navigation to read later pages.'
              : 'Explicit read is available for the selected version. Writing, candidate adoption, and formal review are separate owner operations.',
          artifacts: current ? [{ artifact: canSelectHistory ? { ...current.artifact, capabilities: [...new Set([...current.artifact.capabilities, 'candidate.history.read'])] } : current.artifact, acceptedVersion: current.artifact.version, candidates,
            actions: {
              ...(writable ? { saveDraft: { descriptorRef: descriptorFor(saveAction, current.artifact), contentField: 'body', contentRevisionField: 'content_revision' } } : {}),
              ...(!screenplay && writable ? { createCandidate: { descriptorRef: descriptorFor(candidateAction, current.artifact), contentField: 'body', contentRevisionField: 'content_revision' } } : {}),
              ...(!screenplay && canAdopt && (adoptTarget || canSelectHistory) ? { adopt: { descriptorRef: descriptorFor(adoptAction, current.artifact),
                candidateRefField: 'candidate_ref', candidateVersionField: 'candidate_version', sourceVersionField: 'source_version' } } : {}),
            } }] : [] } }
    },
    async dispatch(raw, context) {
      const scope = { ...context }, parsed = PaneActionRequestSchema.safeParse(raw)
      if (!parsed.success) return receipt(saveAction, { status: 'invalid_input' })
      const request = parsed.data, current = await selection(scope)
      if (request.textBody && (request.actionId !== saveAction || request.textBody.field !== 'body')) return receipt(request.actionId, { status: 'invalid_input' })
      const values = decodePaneActionValues(request)
      if (!current?.canSave || request.owner !== 'auctra' || !sameContext(request.context, scope)
        || request.expectedTargetRef !== current.artifact.ref || request.expectedTargetVersion !== current.artifact.version) return receipt(request.actionId, { status: 'invalid_input' })
      const latest = async () => {
        const next = await selection(scope)
        return next?.canSave && next.unitRef === current.unitRef && next.artifact.ref === current.artifact.ref && next.artifact.version === current.artifact.version ? next : undefined
      }
      if (request.actionId === saveAction) {
        if (request.descriptorRef !== descriptorFor(saveAction, current.artifact) || Object.keys(values).length !== 2
          || typeof values.body !== 'string' || values.content_revision !== current.artifact.version) return receipt(saveAction, { status: 'invalid_input' })
        const base = await client.open(scope, current.unitRef, current.artifact.version)
        if (base.status !== 'ready' || base.value.artifact.ref !== current.artifact.ref) return receipt(saveAction, { status: base.status === 'ready' ? 'unavailable' : base.status })
        if (!await latest()) return receipt(saveAction, { status: 'invalid_input' })
        if (current.unitRef.startsWith('screenplay-draft:')) {
          return receipt(saveAction, await client.saveScreenplayDraft(scope, { draftRef: current.unitRef.slice('screenplay-draft:'.length),
            base: base.value, content: values.body, idempotencyKey: request.idempotencyKey }))
        }
        return receipt(saveAction, await client.save(scope, { unitRef: current.unitRef, base: base.value, content: values.body, idempotencyKey: request.idempotencyKey }))
      }
      if (request.actionId === candidateAction) {
        if (current.unitRef.startsWith('screenplay-draft:') || request.descriptorRef !== descriptorFor(candidateAction, current.artifact)
          || Object.keys(values).length !== 2 || typeof values.body !== 'string'
          || values.content_revision !== current.artifact.version) return receipt(candidateAction, { status: 'invalid_input' })
        const base = await client.open(scope, current.unitRef, current.artifact.version)
        if (base.status !== 'ready' || base.value.artifact.ref !== current.artifact.ref) return receipt(candidateAction, { status: base.status === 'ready' ? 'unavailable' : base.status })
        if (!await latest()) return receipt(candidateAction, { status: 'invalid_input' })
        const created = await client.createCandidate(scope, { unitRef: current.unitRef, base: base.value, content: values.body })
        if (created.status !== 'ready') return receipt(candidateAction, created)
        pending = { context: { ...scope }, artifactRef: current.artifact.ref, sourceVersion: current.artifact.version, candidate: created.value }
        return { owner: 'auctra', actionId: candidateAction, status: 'completed', receiptRef: created.value.ref,
          summary: `${created.value.summary} The accepted version is unchanged.` }
      }
      if (request.actionId === adoptAction || request.actionId === undoAction) {
        const candidateRef = values.candidate_ref
        const expectedDescriptor = descriptorFor(request.actionId, current.artifact)
        if (current.unitRef.startsWith('screenplay-draft:') || typeof candidateRef !== 'string'
          || Object.keys(values).length !== 3
          || request.descriptorRef !== expectedDescriptor
          || values.source_version !== current.artifact.version) return receipt(request.actionId, { status: 'invalid_input' })
        const listed = pending !== undefined && pending.candidate.ref === candidateRef && sameContext(pending.context, scope) && pending.artifactRef === current.artifact.ref
          ? { status: 'ready' as const, value: pending.candidate }
          : await client.showCandidate(scope, { artifact: current.artifact, candidateRef })
        if (listed.status !== 'ready' || listed.value.ref !== candidateRef || listed.value.status !== 'ready'
          || values.candidate_version !== listed.value.version) return receipt(request.actionId, { status: 'invalid_input' })
        if (listed.value.sourceVersion !== current.artifact.version) return receipt(request.actionId, { status: 'conflict' })
        const base = await client.open(scope, current.unitRef, current.artifact.version)
        if (base.status !== 'ready' || base.value.artifact.ref !== current.artifact.ref) return receipt(request.actionId, { status: base.status === 'ready' ? 'unavailable' : base.status })
        if (!await latest()) return receipt(request.actionId, { status: 'invalid_input' })
        if (request.actionId === undoAction) {
          const rejected = await client.rejectCandidate(scope, { artifact: current.artifact, candidateRef })
          if (rejected.status !== 'ready') return receipt(undoAction, rejected)
          pending = undefined
          return { owner: 'auctra', actionId: undoAction, status: 'completed', receiptRef: rejected.value.ref,
            summary: 'The owner candidate was rejected. The accepted Working Copy is unchanged.' }
        }
        const adopted = await client.adoptCandidate(scope, { unitRef: current.unitRef, base: base.value, candidateRef, sourceVersion: current.artifact.version, requestKey: request.idempotencyKey })
        if (adopted.status !== 'ready') {
          return receipt(adoptAction, adopted)
        }
        pending = { context: { ...scope }, artifactRef: current.artifact.ref, sourceVersion: adopted.value.receipt.artifact.version, candidate: adopted.value.candidate ?? listed.value }
        return receipt(adoptAction, { status: 'ready', value: adopted.value.receipt })
      }
      if (current.unitRef.startsWith('screenplay-draft:')) return receipt(request.actionId, { status: 'invalid_input' })
      if (request.actionId === checkpointAction) {
        if (request.descriptorRef !== descriptorFor(checkpointAction, current.artifact) || Object.keys(values).length !== 0) return receipt(checkpointAction, { status: 'invalid_input' })
        if (!await latest()) return receipt(checkpointAction, { status: 'invalid_input' })
        const created = await client.createCheckpoint(scope, { artifact: current.artifact })
        if (created.status !== 'ready') return receipt(checkpointAction, created)
        return { owner: 'auctra', actionId: checkpointAction, status: 'completed', receiptRef: created.value.ref,
          summary: `${created.value.summary} Review and Canon stay separate.` }
      }
      if (request.actionId === reviewSubmitAction) {
        const checkpointRef = values.checkpoint_ref
        if (typeof checkpointRef !== 'string' || Object.keys(values).length !== 1
          || request.descriptorRef !== descriptorFor(reviewSubmitAction, current.artifact)) return receipt(reviewSubmitAction, { status: 'invalid_input' })
        if (!await latest()) return receipt(reviewSubmitAction, { status: 'invalid_input' })
        const submitted = await client.submitReview(scope, { artifact: current.artifact, checkpointRef })
        if (submitted.status !== 'ready') return receipt(reviewSubmitAction, submitted)
        return { owner: 'auctra', actionId: reviewSubmitAction, status: 'completed', receiptRef: submitted.value.reviewItemRef,
          summary: submitted.value.submitted
            ? 'Auctra submitted the Checkpoint for Review. Canon is not accepted automatically.'
            : 'Auctra replayed the existing ReviewItem for this Checkpoint. Canon is not accepted automatically.' }
      }
      if (request.actionId === reviewAcceptAction || request.actionId === reviewRejectAction) {
        const reviewItemRef = values.review_item_ref
        const expectedVersion = values.expected_version
        if (typeof reviewItemRef !== 'string' || typeof expectedVersion !== 'string' || Object.keys(values).length !== 2
          || request.descriptorRef !== descriptorFor(request.actionId, current.artifact)) return receipt(request.actionId, { status: 'invalid_input' })
        if (!await latest()) return receipt(request.actionId, { status: 'invalid_input' })
        const decided = await client.decideReview(scope, { artifact: current.artifact, reviewItemRef, expectedVersion,
          decision: request.actionId === reviewAcceptAction ? 'accept' : 'reject', idempotencyKey: request.idempotencyKey })
        if (decided.status !== 'ready') return receipt(request.actionId, decided)
        return { owner: 'auctra', actionId: request.actionId, status: 'completed', receiptRef: decided.value.decisionRef,
          summary: decided.value.status === 'accepted'
            ? 'Auctra accepted the ReviewItem. This Canon decision is independent of save, adopt, and Checkpoint.'
            : 'Auctra rejected the ReviewItem. The Working Copy and Checkpoint stay unchanged.' }
      }
      if (request.actionId === exportAction) {
        const expectedRevision = values.expected_revision
        const format = values.format
        if (typeof expectedRevision !== 'string' || (format !== 'markdown' && format !== 'plain_text') || Object.keys(values).length !== 2
          || request.descriptorRef !== descriptorFor(exportAction, current.artifact)) return receipt(exportAction, { status: 'invalid_input' })
        if (!await latest()) return receipt(exportAction, { status: 'invalid_input' })
        const exported = await client.exportFixedVersion(scope, { artifact: current.artifact, unitRef: current.unitRef,
          expectedRevision, format, idempotencyKey: request.idempotencyKey })
        if (exported.status !== 'ready') return receipt(exportAction, exported)
        return { owner: 'auctra', actionId: exportAction, status: 'completed', receiptRef: exported.value.artifactRef,
          summary: 'Auctra exported the selected document revision. Source writeback was not performed.' }
      }
      return receipt(request.actionId, { status: 'invalid_input' })
    },
    async reconcile(raw, context) {
      const scope = { ...context }, parsed = PaneActionReconcileRequestSchema.safeParse(raw)
      if (!parsed.success || parsed.data.owner !== 'auctra' || !sameContext(parsed.data.context, scope)) {
        return receipt(parsed.success ? parsed.data.actionId : saveAction, { status: 'unconfirmed' })
      }
      const request = parsed.data
      if (request.actionId === adoptAction) {
        const source = resolveOriginal ? await resolveOriginal(request.expectedTargetRef, scope) : await selection(scope)
        if (!source || source.artifact.ref !== request.expectedTargetRef) return receipt(adoptAction, { status: 'unconfirmed' })
        const result = await client.reconcileSave(scope, { unitRef: source.unitRef, artifact: source.artifact, idempotencyKey: request.idempotencyKey, candidateRecovery: true })
        return receipt(adoptAction, result.status === 'ready' ? result : { status: 'unconfirmed' })
      }
      if (request.actionId !== saveAction) return receipt(request.actionId, { status: 'unconfirmed' })
      const source = resolveOriginal ? await resolveOriginal(request.expectedTargetRef, scope) : await selection(scope)
      if (!source || source.artifact.ref !== request.expectedTargetRef) return receipt(saveAction, { status: 'unconfirmed' })
      const result = await client.reconcileSave(scope, { unitRef: source.unitRef, artifact: source.artifact, idempotencyKey: request.idempotencyKey })
      return receipt(saveAction, result.status === 'ready' ? result : { status: 'unconfirmed' })
    },
    async readArtifactContent(artifact, context) {
      const scope = { ...context }
      const claim = { ...artifact }
      const current = await selection(scope)
      if (current && claim.owner === 'auctra' && claim.kind === 'text' && claim.mediaType === 'text/plain') {
        const prefix = `${current.artifact.ref.replace('auctra:working-copy:', 'auctra:candidate:')}:`
        const candidateRef = claim.ref.startsWith(prefix) ? claim.ref.slice(prefix.length) : undefined
        if (candidateRef && /^cand-[A-Za-z0-9]+$/u.test(candidateRef)) {
          const result = await client.readCandidateContent(scope, { artifact: current.artifact, candidateRef, version: claim.version })
          const latest = await selection(scope)
          if (result.status !== 'ready' || result.value.artifact.ref !== claim.ref || !latest || latest.artifact.ref !== current.artifact.ref
            || latest.artifact.version !== current.artifact.version) return undefined
          return result.value
        }
      }
      if (!current || claim.owner !== 'auctra' || claim.kind !== 'text' || claim.ref !== current.artifact.ref
        || claim.mediaType !== current.artifact.mediaType) return undefined
      const result = await client.open(scope, current.unitRef, claim.version)
      if (result.status !== 'ready' || result.value.artifact.ref !== claim.ref || result.value.artifact.mediaType !== claim.mediaType
        || result.value.content.length > 256 * 1024) return undefined
      const latest = await selection(scope)
      if (!latest || latest.unitRef !== current.unitRef || latest.artifact.ref !== claim.ref || latest.artifact.version !== current.artifact.version) return undefined
      return result.value
    },
  }
}
