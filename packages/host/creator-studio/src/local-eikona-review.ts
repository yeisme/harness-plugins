import { z } from 'zod'
import { createHash } from 'node:crypto'
import type { CreatorOwnerAdapterV1, CreatorStudioContextV1 } from './types.ts'
import type { PaneActionReceiptV1 } from '@yeisme/dsh-pane-protocol'
import { inspectEikonaReview } from './eikona-review.ts'
import { eikonaImageQuerySchema, eikonaImageResultSchema } from './eikona-asset-contract.ts'
import { eikonaSelectionQuerySchema } from './eikona-selection-contract.ts'
import { createEikonaAdoptionDescriptor } from './eikona-adoption-descriptor.ts'
import { EIKONA_ADOPT_ACTION, parseEikonaAdoptionRequest } from './eikona-adoption-request.ts'

type Invoke = (args: readonly string[], timeout?: number) => Promise<unknown>
const dataEnvelope = z.object({ data: z.record(z.string(), z.unknown()) })
const assetRef = /^eikona:\/\/artifacts\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/u

export function withLocalEikonaReview(base: CreatorOwnerAdapterV1, invoke: Invoke, resolveProject: () => Promise<string | undefined>): CreatorOwnerAdapterV1 {
  let selected: { artifactRef: string; contentDigest: string; scope: string } | undefined
  let selectionVersion = 0
  const project = async () => { const value = await resolveProject(); if (!value) throw new Error('Project is not registered'); return value }
  const review = async (runId: string) => {
    const projectId = await project()
    const result = dataEnvelope.parse(await invoke(['review', 'status', '--full', '--project', projectId, '--run', runId]))
    return inspectEikonaReview(result.data.review, { runId, ownerProjectRef: projectId })
  }
  const adoption = async (context: CreatorStudioContextV1) => {
    const selection = selected, match = selection?.artifactRef.match(assetRef)
    if (!selection || !match || selection.scope !== JSON.stringify(context)) return undefined
    const state = await review(match[1]!)
    if (selection !== selected || state.status !== 'ready' || !state.canDecide) return undefined
    const candidate = state.candidates.find(item => item.artifactRef === selection.artifactRef && item.contentDigest === selection.contentDigest)
    if (!candidate || candidate.decisionVersion === undefined || !['pending', 'request_revision'].includes(candidate.decisionState ?? '')) return undefined
    return createEikonaAdoptionDescriptor({ status: 'prepared', executionAuthorized: false, artifactRef: selection.artifactRef, observedAt: state.observedAt,
      request: { project_ref: state.projectId, asset_ref: state.runId, review_version: candidate.candidateId, decision: 'accept', expected_content_digest: selection.contentDigest,
        ...(candidate.decisionVersion === 0 ? { require_no_decision: true } : { expected_version: String(candidate.decisionVersion) }) } }, context)
  }
  const decisionReceipt = (raw: unknown, targetRef: string): PaneActionReceiptV1 => {
    const result = dataEnvelope.safeParse(raw)
    const parsed = z.object({ operation_id: z.string().regex(/^[A-Za-z0-9._:-]{1,200}$/u), run_id: z.string(), candidate_id: z.string(), owner_decision: z.string(), accepted: z.boolean() }).safeParse(result.success ? result.data.data.decision : undefined)
    const valid = parsed.success && targetRef === `eikona://artifacts/${parsed.data.run_id}/${parsed.data.candidate_id}`
    return { owner: 'eikona', actionId: EIKONA_ADOPT_ACTION, receiptRef: valid ? parsed.data.operation_id : 'eikona:local:review-unconfirmed',
      status: valid && parsed.data.accepted && parsed.data.owner_decision === 'accepted' ? 'completed' : 'unknown',
      summary: valid && parsed.data.accepted ? 'The fixed candidate was accepted. Delivery remains a separate action.' : 'The original review decision must be reconciled.' }
  }
  return {
    ...base,
    async readEikonaReview(input) { try { return await review(input.runId) } catch { return { status: 'unconfirmed' } } },
    async readEikonaCandidateImage(input) {
      const parsed = eikonaImageQuerySchema.safeParse(input), match = parsed.success ? parsed.data.artifactRef.match(assetRef) : null
      if (!parsed.success || !match) return { status: 'invalid_input' }
      try {
        const result = dataEnvelope.parse(await invoke(['artifacts', 'read', match[1]!, '--full', '--project', await project(), '--artifact', match[2]!, '--digest', parsed.data.contentDigest, '--confirm']))
        const image = eikonaImageResultSchema.safeParse({ status: 'ready', value: result.data.image })
        if (!image.success || image.data.status !== 'ready' || image.data.value.artifactRef !== parsed.data.artifactRef || image.data.value.contentDigest !== parsed.data.contentDigest) return { status: 'unconfirmed' }
        const bytes = Uint8Array.from(Buffer.from(image.data.value.base64, 'base64'))
        if (bytes.length !== image.data.value.byteLength) return { status: 'unconfirmed' }
        return { status: 'ready', value: { artifactRef: parsed.data.artifactRef, contentDigest: parsed.data.contentDigest, bytes, mediaType: image.data.value.mediaType } }
      } catch { return { status: 'unconfirmed' } }
    },
    async selectEikonaCandidate(raw, context) {
      const version = ++selectionVersion
      selected = undefined
      const parsed = eikonaSelectionQuerySchema.safeParse(raw)
      if (!parsed.success) return { status: 'invalid_input' }
      if (!parsed.data.selection) return { status: 'cleared' }
      const selection = parsed.data.selection, match = selection.artifactRef.match(assetRef)
      if (!match) return { status: 'invalid_input' }
      try {
        const value = await review(match[1]!)
        if (version !== selectionVersion) return { status: 'superseded' }
        if (value.status !== 'ready' || !value.candidates.some(item => item.artifactRef === selection.artifactRef && item.contentDigest === selection.contentDigest)) return { status: 'unconfirmed' }
        selected = { ...selection, scope: JSON.stringify(context) }
        return { status: 'selected', selection }
      } catch { return { status: 'unconfirmed' } }
    },
    async readEikonaAssetPage(input, context) {
      try {
        const projectId = await project(), scope = createHash('sha256').update(JSON.stringify(context)).digest('hex')
        const cursorSchema = z.object({ scope: z.string(), project: z.string(), head: z.string(), offset: z.number().int().min(0).max(10000000), item: z.number().int().min(0).max(100000), page: z.string().optional() }).strict()
        const cursor = input.cursor ? cursorSchema.parse(JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'))) : undefined
        if (cursor && (cursor.project !== projectId || cursor.scope !== scope)) return { status: 'permission_denied' }
        const listSchema = z.object({ data: z.object({ total_count: z.number().int().nonnegative(), runs: z.array(z.object({ run_id: z.string().regex(/^[A-Za-z0-9._-]{1,160}$/u), project_id: z.literal(projectId), status: z.string(), artifact_count: z.number().int().nonnegative().optional() })).max(10).nullable().transform(rows => rows ?? []) }) })
        const list = async (offset: number, limit: number) => listSchema.parse(await invoke(['list', '--project', projectId, '--limit', String(limit), '--offset', String(offset), '--full'])).data
        const offset = cursor?.offset ?? 0
        const page = await list(offset, 10)
        const head = offset === 0 ? page.runs[0]?.run_id ?? '' : (await list(0, 1)).runs[0]?.run_id ?? ''
        if (cursor && cursor.head !== head) return { status: 'unconfirmed' }
        const pageDigest = createHash('sha256').update(JSON.stringify(page.runs)).digest('hex')
        if (cursor?.page && cursor.page !== pageDigest) return { status: 'unconfirmed' }
        const results = await Promise.all(page.runs.map(async row => {
          const runId = row.run_id
          try {
            const reviewed = await review(runId)
            const manifest = z.object({ data: z.object({ artifacts: z.array(z.object({ artifact_id: z.string(), mime_type: z.string().max(160) })) }) }).parse(await invoke(['artifacts', 'list', runId]))
            return { reviewed, media: new Map(manifest.data.artifacts.map(artifact => [artifact.artifact_id, artifact.mime_type])) }
          } catch { return undefined }
        }))
        const ready = results.filter(item => item !== undefined && item.reviewed.status === 'ready')
        if (ready.length !== page.runs.length) return { status: 'unconfirmed' }
        const items = ready.flatMap(item => item?.reviewed.status !== 'ready' ? [] : item.reviewed.candidates.flatMap(candidate => candidate.artifactRef && candidate.contentDigest
          ? [{ ref: candidate.artifactRef, title: candidate.label, versionStatus: 'observed_digest' as const, contentDigest: candidate.contentDigest, ...(item.media.get(candidate.candidateId) ? { mediaType: item.media.get(candidate.candidateId)! } : {}) }] : []))
        const start = cursor?.item ?? 0, end = start + (input.limit ?? 50)
        if (start > items.length) return { status: 'unconfirmed' }
        const next = end < items.length ? { scope, project: projectId, head, offset, item: end, page: pageDigest }
          : offset + page.runs.length < page.total_count ? { scope, project: projectId, head, offset: offset + page.runs.length, item: 0 } : undefined
        return { status: 'ready', items: items.slice(start, end), ...(next ? { nextCursor: Buffer.from(JSON.stringify(next)).toString('base64url') } : {}) }
      } catch { return { status: 'unconfirmed' } }
    },
    async snapshot(context) {
      const snapshot = await base.snapshot(context)
      let action
      try { action = await adoption(context) } catch { /* No stale adoption action. */ }
      return { ...snapshot, actions: [...snapshot.actions, ...(action ? [action.descriptor] : [])] }
    },
    async dispatch(input, context) {
      if (input.actionId !== EIKONA_ADOPT_ACTION) return base.dispatch(input, context)
      const parsed = parseEikonaAdoptionRequest(input, context)
      if (!parsed) return decisionReceipt(undefined, input.expectedTargetRef)
      try {
        const current = await adoption(context)
        if (!current || current.descriptor.descriptorRef !== input.descriptorRef) return decisionReceipt(undefined, input.expectedTargetRef)
        return decisionReceipt(await invoke(['review', 'decide', '--project', await project(), '--run', parsed.values.run_id,
          '--candidate', parsed.values.candidate_id, '--digest', parsed.values.content_digest, '--expected-version', String(parsed.values.decision_version),
          '--idempotency-key', input.idempotencyKey, '--confirm']), input.expectedTargetRef)
      } catch { return decisionReceipt(undefined, input.expectedTargetRef) }
    },
    async reconcile(input, context) {
      if (input.actionId !== EIKONA_ADOPT_ACTION) return base.reconcile?.(input, context) ?? decisionReceipt(undefined, input.expectedTargetRef)
      try { return decisionReceipt(await invoke(['review', 'reconcile', '--project', await project(), '--idempotency-key', input.idempotencyKey]), input.expectedTargetRef) }
      catch { return decisionReceipt(undefined, input.expectedTargetRef) }
    },
  }
}
