import { eikonaBatchMembersQuerySchema, inspectEikonaBatchMembers } from './eikona-batch-members.ts'
import { eikonaBatchLookupSchema, eikonaBatchSubmitSchema, eikonaBatchReconcileSchema, inspectEikonaBatchOperation } from './eikona-batch-operation.ts'
import { inspectEikonaBatchPlan } from './eikona-batch-plan.ts'
import { eikonaBatchPageQuerySchema, inspectEikonaBatchPage, eikonaBatchInputQuerySchema, inspectEikonaBatchInput } from './eikona-batch-input.ts'
import { inspectEikonaGenerationReceipt, inspectEikonaRecoveredGenerationReceipt } from './eikona-generation-receipt.ts'
import { eikonaApprovalInputSchema, inspectEikonaPreparationApproval } from './eikona-preparation-approval.ts'
import { inspectEikonaApprovalStatus } from './eikona-approval-status.ts'
import { matchesEikonaPreparationInput, eikonaPreparationInputSchema } from './eikona-preparation-contract.ts'
import { inspectEikonaMediaAccess, readEikonaMediaBytes } from './eikona-media-access.ts'
import { inspectEikonaAssetPage } from './eikona-asset-page.ts'
import { inspectEikonaReview } from './eikona-review.ts'
import { inspectEikonaPreparation } from './eikona-preparation.ts'
import { inspectEikonaAdoptionReceipt, inspectEikonaRecoveredAdoptionReceipt } from './eikona-adoption-receipt.ts'
import { z } from 'zod'
import { inspectEikonaDiscovery } from './eikona-discovery.ts'
import type { CreatorStudioContextV1 } from './types.ts'

export interface EikonaDiscoveryConnection {
  readonly context: CreatorStudioContextV1
  readonly baseURL: string
  /** Host-verified credential scope for the existing asset graph route. */
  readonly assetScope?: { readonly ownerProjectRef: string; readonly credentialProjects: readonly string[] }
  readonly mediaBaseURL?: string
  readonly headers: Readonly<Record<string, string>>
  readonly admission: { readonly approved: boolean; readonly schemaDigest: string; readonly sdkDigest: string; readonly mediaAccessApproved?: boolean; readonly preparationApproved?: boolean; readonly generationApprovalApproved?: boolean; readonly generationExecutionApproved?: boolean; readonly batchExecutionApproved?: boolean; readonly reviewAdoptionApproved?: boolean }
}
const reviewId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u)
const adoptionBody = z.object({ project_ref: reviewId, asset_ref: reviewId, review_version: reviewId,
  decision: z.literal('accept'), expected_content_digest: z.string().regex(/^[a-f0-9]{64}$/u),
  require_no_decision: z.literal(true).optional(), expected_version: z.string().regex(/^[1-9][0-9]{0,14}$/u).optional(),
}).strict().refine(value => (value.require_no_decision === true) !== (value.expected_version !== undefined))
type AdoptionBody = z.infer<typeof adoptionBody>
const generationBody = z.object({ project_ref: z.string().regex(/^project:[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u),
  approval_ref: z.string().regex(/^ega_[a-f0-9]{64}$/u), prompt_version: z.string().max(300).regex(/^eikona:\/\/prompts\/[A-Za-z0-9._-]+\/versions\/[1-9][0-9]*$/u),
  model: z.literal('openai/gpt-5.4-image-2'), cost_limit: z.object({ max_images: z.literal(1) }).strict(), dry_run: z.literal(false),
}).strict()
type OwnerMutation = { body: AdoptionBody; key: string; kind?: 'review' } | { body: z.infer<typeof generationBody>; key: string; kind: 'generation' }

const keys = ['tenantRef', 'workspaceRef', 'projectRef', 'sessionRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision'] as const
/** Owner discovery and explicit candidate access. Connections and pins are Host-owned. */
export class EikonaDiscoveryClient {
  constructor(private readonly resolve: (context: CreatorStudioContextV1) => Promise<EikonaDiscoveryConnection | undefined>, private readonly fetcher: typeof fetch = fetch) {}
  async pin(context: CreatorStudioContextV1): Promise<EikonaDiscoveryClient | undefined> {
    const scope = { ...context }
    try {
      const original = structuredClone(await this.resolve(scope))
      if (!original) return undefined
      return new EikonaDiscoveryClient(async current => {
        const latest = await this.resolve(current)
        return JSON.stringify(latest) === JSON.stringify(original) ? latest : undefined
      }, this.fetcher)
    } catch { return undefined }
  }
  submitBatch(context: CreatorStudioContextV1, input: unknown) {
    return this.batchOperation(context, input, true)
  }
  reconcileBatch(context: CreatorStudioContextV1, input: unknown) {
    return this.batchOperation(context, input, false)
  }
  lookupBatch(context: CreatorStudioContextV1, input: unknown) {
    return this.batchOperation(context, input, false, true)
  }
  async batchExecutionAvailable(context: CreatorStudioContextV1) {
    const pinned = await this.pin(context)
    if (!pinned) return false
    const binding = await pinned.resolve(context)
    return binding?.admission.approved === true && binding.admission.batchExecutionApproved === true
      && keys.every(key => binding.context[key] === context[key])
      && binding.assetScope?.credentialProjects.length === 1 && binding.assetScope.credentialProjects[0] === binding.assetScope.ownerProjectRef
  }
  private async batchOperation(context: CreatorStudioContextV1, input: unknown, submit: boolean, lookup = false) {
    const parsed = (submit ? eikonaBatchSubmitSchema : lookup ? eikonaBatchLookupSchema : eikonaBatchReconcileSchema).safeParse(input)
    if (!parsed.success) return { status: 'invalid_input' } as const
    try {
      const scope = { ...context }, pinned = await this.pin(scope)
      if (!pinned) return { status: 'unavailable' } as const
      const binding = await pinned.resolve(scope)
      const ownerProject = binding?.assetScope?.ownerProjectRef
      if (!ownerProject) return { status: 'needs_contract' } as const
      const projectRef = ownerProject.startsWith('project:') ? ownerProject : `project:${ownerProject}`
      const fixed = parsed.data
      const body = submit && 'digest' in fixed && 'planDigest' in fixed ? { project_ref: projectRef, request_batch_ref: fixed.batchRef, request_batch_digest: fixed.digest, plan_digest: fixed.planDigest, confirm: true, allow_unknown_cost: 'allowUnknownCost' in fixed && fixed.allowUnknownCost } : { project_ref: projectRef }
      return pinned.request(scope, `/api/v1/owner/batches:${submit ? 'submit' : 'reconcile'}`, value => inspectEikonaBatchOperation(value, { ...fixed, projectRef }), true, undefined, undefined, undefined, false, undefined, false, { body, key: fixed.idempotencyKey, submit })
    } catch { return { status: 'unconfirmed' } as const }
  }
  async readBatchMembers(context: CreatorStudioContextV1, input: unknown) {
    const query = eikonaBatchMembersQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' } as const
    try {
      const scope = { ...context }, pinned = await this.pin(scope)
      if (!pinned) return { status: 'unavailable' } as const
      const binding = await pinned.resolve(scope), ownerProject = binding?.assetScope?.ownerProjectRef
      if (!ownerProject) return { status: 'needs_contract' } as const
      const projectRef = ownerProject.startsWith('project:') ? ownerProject : `project:${ownerProject}`
      const params = new URLSearchParams({ project_ref: projectRef, operation_ref: query.data.operationRef, offset: String(query.data.offset), limit: String(query.data.limit) })
      return pinned.request(scope, `/api/v1/owner/batch-members?${params}`, body => inspectEikonaBatchMembers(body, { ...query.data, projectRef }), true)
    } catch { return { status: 'unconfirmed' } as const }
  }
  async readBatchPlan(context: CreatorStudioContextV1, input: unknown) {
    const query = eikonaBatchInputQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' } as const
    try {
      const scope = { ...context }, pinned = await this.pin(scope)
      if (!pinned) return { status: 'unavailable' } as const
      const binding = await pinned.resolve(scope)
      const ownerProject = binding?.assetScope?.ownerProjectRef
      if (!ownerProject) return { status: 'needs_contract' } as const
      // Batch v2 project refs use the explicit owner project: ingress convention.
      const projectRef = ownerProject.startsWith('project:') ? ownerProject : `project:${ownerProject}`
      const params = new URLSearchParams({ project_ref: projectRef, request_batch_ref: query.data.batchRef, request_batch_digest: query.data.digest })
      return pinned.request(scope, `/api/v1/owner/batch-input/plan?${params}`, body => inspectEikonaBatchPlan(body, { projectRef, ...query.data }), true)
    } catch { return { status: 'unconfirmed' } as const }
  }
  async readBatchInput(context: CreatorStudioContextV1, input: unknown) {
    const query = eikonaBatchInputQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' } as const
    try {
      const scope = { ...context }, pinned = await this.pin(scope)
      if (!pinned) return { status: 'unavailable' } as const
      const binding = await pinned.resolve(scope)
      const ownerProject = binding?.assetScope?.ownerProjectRef
      if (!ownerProject) return { status: 'needs_contract' } as const
      // Batch v2 project refs use the explicit owner project: ingress convention.
      const projectRef = ownerProject.startsWith('project:') ? ownerProject : `project:${ownerProject}`
      const params = new URLSearchParams({ project_ref: projectRef, request_batch_ref: query.data.batchRef, request_batch_digest: query.data.digest })
      return pinned.request(scope, `/api/v1/owner/batch-input?${params}`, body => inspectEikonaBatchInput(body, { projectRef, ...query.data }), true)
    } catch { return { status: 'unconfirmed' } as const }
  }
  async listBatchInputs(context: CreatorStudioContextV1, input: unknown = {}) {
    const query = eikonaBatchPageQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' } as const
    try {
      const scope = { ...context }, pinned = await this.pin(scope)
      if (!pinned) return { status: 'unavailable' } as const
      const binding = await pinned.resolve(scope)
      const ownerProject = binding?.assetScope?.ownerProjectRef
      if (!ownerProject) return { status: 'needs_contract' } as const
      // Batch v2 project refs use the explicit owner project: ingress convention.
      const projectRef = ownerProject.startsWith('project:') ? ownerProject : `project:${ownerProject}`
      const params = new URLSearchParams({ project_ref: projectRef, limit: String(query.data.limit), ...(query.data.cursor ? { cursor: query.data.cursor } : {}) })
      return pinned.request(scope, `/api/v1/owner/batch-inputs?${params}`, body => inspectEikonaBatchPage(body, { projectRef, limit: query.data.limit, ...(query.data.cursor ? { cursor: query.data.cursor } : {}) }), true)
    } catch { return { status: 'unconfirmed' } as const }
  }
  inspect(context: CreatorStudioContextV1) {
    return this.request(context, '/api/v1/owner', (body, binding) => {
      const result = inspectEikonaDiscovery(body, binding.admission)
      return result.status === 'inspected' ? { ...result, generationAvailable: binding.admission.generationExecutionApproved === true && result.operations.some(operation => operation.action === 'eikona.generation.submit' && operation.readiness === 'requires_authorization'), approvalAvailable: result.preparationAvailable && binding.admission.generationApprovalApproved === true
        && binding.assetScope?.credentialProjects.length === 1 && binding.assetScope.credentialProjects[0] === binding.assetScope.ownerProjectRef, preparationAvailable: result.preparationAvailable && binding.admission.preparationApproved === true
        && binding.assetScope?.credentialProjects.length === 1 && binding.assetScope.credentialProjects[0] === binding.assetScope.ownerProjectRef } : result
    })
  }
  prepareGeneration(context: CreatorStudioContextV1, input: unknown) {
    const parsed = eikonaPreparationInputSchema.safeParse(input)
    if (!parsed.success || new TextEncoder().encode(JSON.stringify(parsed.data)).length > 48 * 1024) return Promise.resolve({ status: 'invalid_input' } as const)
    return this.request(context, '/api/v1/owner/generation:prepare', (body, binding) => {
      const ref = z.object({ ref: z.string().regex(/^egp_[a-f0-9]{64}$/u) }).safeParse(body)
      if (!ref.success) return { status: 'needs_contract' as const }
      const result = inspectEikonaPreparation(body, { preparationRef: ref.data.ref, ownerProjectRef: binding.assetScope!.ownerProjectRef })
      if (!matchesEikonaPreparationInput(parsed.data, result)) return { status: 'needs_contract' as const }
      return result
    }, true, undefined, undefined, undefined, false, parsed.data)
  }
  approvePreparation(context: CreatorStudioContextV1, input: unknown) {
    const parsed = eikonaApprovalInputSchema.safeParse(input)
    if (!parsed.success) return Promise.resolve({ status: 'invalid_input' } as const)
    const { confirmed: _confirmed, ...request } = parsed.data
    return this.request(context, '/api/v1/owner/generation:approve', (body, binding) =>
      inspectEikonaPreparationApproval(body, parsed.data, binding.assetScope!.ownerProjectRef), true, undefined, undefined, undefined, false, request, true)
  }
  readPreparation(context: CreatorStudioContextV1, preparationRef: string) {
    if (!/^egp_[a-f0-9]{64}$/u.test(preparationRef)) return Promise.resolve({ status: 'invalid_input' } as const)
    return this.request(context, '/api/v1/owner/preparations/' + preparationRef, (body, binding) =>
      inspectEikonaPreparation(body, { preparationRef, ownerProjectRef: binding.assetScope!.ownerProjectRef }), true, undefined, undefined, undefined, true)
  }
  async readApprovalStatus(context: CreatorStudioContextV1, approvalRef: string) {
    if (!/^ega_[a-f0-9]{64}$/u.test(approvalRef)) return Promise.resolve({ status: 'invalid_input' } as const)
    const scope = { ...context }
    let initial: EikonaDiscoveryConnection | undefined
    try { initial = structuredClone(await this.resolve(scope)) } catch { return { status: 'unconfirmed' } as const }
    if (!initial) return { status: 'unavailable' } as const
    // Pin both requests to the same trusted connection, including credential
    // and project scope. Each request still performs its normal late checks.
    const pinned = new EikonaDiscoveryClient(async current => {
      const latest = await this.resolve(current)
      return JSON.stringify(latest) === JSON.stringify(initial) ? latest : undefined
    }, this.fetcher)
    const discovery = await pinned.inspect(scope)
    if (discovery.status !== 'inspected') return { status: discovery.status } as const
    if (!discovery.approvalStatusAvailable) return { status: 'needs_contract' } as const
    return pinned.request(scope, `/api/v1/owner/approvals/${approvalRef}`, (body, binding) =>
      inspectEikonaApprovalStatus(body, { approvalRef, projectId: binding.assetScope!.ownerProjectRef }), true, undefined, undefined, undefined, true)
  }
  revokePreparationApproval(context: CreatorStudioContextV1, input: unknown) {
    const parsed = z.object({ approvalRef: z.string().regex(/^ega_[a-f0-9]{64}$/u), confirmed: z.literal(true) }).strict().safeParse(input)
    if (!parsed.success) return Promise.resolve({ status: 'invalid_input' } as const)
    return this.request(context, `/api/v1/owner/approvals/${parsed.data.approvalRef}:revoke`, body => {
      const receipt = z.object({ approval_ref: z.literal(parsed.data.approvalRef), state: z.literal('revoked') }).strict().safeParse(body)
      return receipt.success ? { status: 'revoked' as const, approvalRef: receipt.data.approval_ref } : { status: 'unconfirmed' as const }
    }, true, undefined, undefined, undefined, false, {}, true)
  }
  submitGeneration(context: CreatorStudioContextV1, input: unknown) {
    const parsed = z.object({ request: generationBody, idempotencyKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/u), confirmed: z.literal(true) }).strict().safeParse(input)
    if (!parsed.success) return Promise.resolve({ status: 'invalid_input' } as const)
    return this.request(context, '/api/v1/owner/generation:submit', body => inspectEikonaGenerationReceipt(body), true, undefined,
      { body: parsed.data.request, key: parsed.data.idempotencyKey, kind: 'generation' })
  }
  reconcileGeneration(context: CreatorStudioContextV1, input: unknown) {
    const parsed = z.object({ projectId: reviewId, idempotencyKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/u),
      operationRef: z.string().regex(/^own_[a-f0-9]{24}$/u).optional(),
    }).strict().safeParse(input)
    if (!parsed.success) return Promise.resolve({ status: 'invalid_input' } as const)
    const fixed = parsed.data
    return this.request(context, `/api/v1/owner/operations/${encodeURIComponent(fixed.idempotencyKey)}:reconcile`, body =>
      inspectEikonaRecoveredGenerationReceipt(body, fixed.operationRef), true, undefined, undefined, fixed.projectId)
  }
  submitAdoption(context: CreatorStudioContextV1, input: { request: unknown; idempotencyKey: string; confirmed: boolean }) {
    const parsed = z.object({ request: adoptionBody, idempotencyKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u), confirmed: z.literal(true) }).strict().safeParse(input)
    if (!parsed.success) return Promise.resolve({ status: 'invalid_input' } as const)
    const { request, idempotencyKey } = parsed.data
    return this.request(context, '/api/v1/owner/review:decide', body => inspectEikonaAdoptionReceipt(body, {
      runId: request.asset_ref, candidateId: request.review_version, decisionVersion: request.expected_version === undefined ? 0 : Number(request.expected_version),
    }), true, undefined, { body: request, key: idempotencyKey })
  }
  reconcileAdoption(context: CreatorStudioContextV1, input: { runId: string; candidateId: string; decisionVersion: number; idempotencyKey: string; projectId: string; operationRef?: string }) {
    const parsed = z.object({ runId: reviewId, candidateId: reviewId, projectId: reviewId,
      decisionVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1),
      operationRef: z.string().regex(/^own_[a-f0-9]{24}$/u).optional(),
      idempotencyKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u),
    }).strict().safeParse(input)
    if (!parsed.success) return Promise.resolve({ status: 'invalid_input' } as const)
    const fixed = parsed.data
    return this.request(context, `/api/v1/owner/operations/${encodeURIComponent(fixed.idempotencyKey)}:reconcile`, body =>
      inspectEikonaAdoptionReceipt(body, { runId: fixed.runId, candidateId: fixed.candidateId, decisionVersion: fixed.decisionVersion,
        ...(fixed.operationRef === undefined ? {} : { operationRef: fixed.operationRef }) }), true, undefined, undefined, fixed.projectId)
  }
  readReview(context: CreatorStudioContextV1, runId: string) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u.test(runId)) return Promise.resolve({ status: 'invalid_input' } as const)
    return this.request(context, `/api/v1/runs/${encodeURIComponent(runId)}/review`, (body, binding) =>
      inspectEikonaReview(body, { runId, ownerProjectRef: binding.assetScope!.ownerProjectRef }), true)
  }
  recoverAdoption(context: CreatorStudioContextV1, input: { runId: string; candidateId: string; idempotencyKey: string; projectId: string }) {
    const parsed = z.object({ runId: reviewId, candidateId: reviewId, projectId: reviewId,
      idempotencyKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/u) }).strict().safeParse(input)
    if (!parsed.success) return Promise.resolve({ status: 'invalid_input' } as const)
    const fixed = parsed.data
    return this.request(context, `/api/v1/owner/operations/${encodeURIComponent(fixed.idempotencyKey)}:reconcile`, body =>
      inspectEikonaRecoveredAdoptionReceipt(body, fixed), true, undefined, undefined, fixed.projectId)
  }
  listAssets(context: CreatorStudioContextV1, input: { cursor?: string; limit?: number } = {}) {
    const query = z.object({ cursor: z.string().min(1).max(4096).optional(), limit: z.number().int().min(1).max(100).default(50) }).strict().safeParse(input)
    if (!query.success) return Promise.resolve({ status: 'invalid_input' } as const)
    const params = new URLSearchParams({ limit: String(query.data.limit) })
    if (query.data.cursor) params.set('cursor', query.data.cursor)
    const limit = query.data.limit
    return this.request(context, `/api/v1/assets?${params}`, (body, binding) => inspectEikonaAssetPage(body, { ownerProjectRef: binding.assetScope!.ownerProjectRef, limit }), true)
  }
  async readCandidateImage(context: CreatorStudioContextV1, input: { artifactRef: string; contentDigest: string; idempotencyKey: string; confirmed: boolean }, signal = AbortSignal.timeout(15000)) {
    const scope = Object.freeze({ ...context }), claim = { ...input }
    try {
      const initial = await this.resolve(scope)
      if (!initial) return { status: 'unavailable' } as const
      const binding = structuredClone(initial)
      if (keys.some(key => scope[key] !== binding.context[key]) || !binding.admission.approved || binding.admission.mediaAccessApproved !== true) return { status: 'permission_denied' } as const
      signal.throwIfAborted()
      const access = await this.requestMediaAccess(scope, claim)
      if (access.status !== 'ready') return access
      const sameBinding = async () => JSON.stringify(await this.resolve(scope)) === JSON.stringify(binding)
      if (!await sameBinding() || signal.aborted) return { status: 'permission_denied' } as const
      const image = await readEikonaMediaBytes(access.value, this.fetcher, signal)
      if (!await sameBinding() || signal.aborted) return { status: 'permission_denied' } as const
      if (!image) return { status: 'unconfirmed' } as const
      return { status: 'ready' as const, value: { ...image, artifactRef: claim.artifactRef, contentDigest: claim.contentDigest } }
    } catch { return { status: 'unconfirmed' } as const }
  }
  requestMediaAccess(context: CreatorStudioContextV1, input: { artifactRef: string; contentDigest: string; idempotencyKey: string; confirmed: boolean }) {
    const claim = z.object({ artifactRef: z.string().regex(/^eikona:\/\/[A-Za-z0-9._:/-]{1,480}$/u),
      contentDigest: z.string().regex(/^[a-f0-9]{64}$/u), idempotencyKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u), confirmed: z.literal(true),
    }).strict().safeParse(input)
    if (!claim.success) return Promise.resolve({ status: 'invalid_input' } as const)
    const fixed = claim.data
    return this.request(context, `/api/v1/artifacts/${encodeURIComponent(fixed.artifactRef)}/access-grants`, (body, binding) => {
      const value = inspectEikonaMediaAccess(body, { artifactRef: fixed.artifactRef, contentDigest: fixed.contentDigest, mediaBaseURL: binding.mediaBaseURL! })
      return value === undefined ? { status: 'unconfirmed' as const } : { status: 'ready' as const, value }
    }, true, fixed.idempotencyKey)
  }
  private async request<T>(context: CreatorStudioContextV1, path: string, normalize: (body: unknown, binding: EikonaDiscoveryConnection) => T, assets = false, mediaKey?: string, review?: OwnerMutation, reconcileProject?: string, preparationRead = false, preparationWrite?: Record<string, unknown>, approvalWrite = false, batch?: { body: Record<string, unknown>; key: string; submit: boolean }) {
    const scope = Object.freeze({ ...context })
    try {
      const original = await this.resolve(scope)
      if (!original) return { status: 'unavailable' } as const
      const binding = structuredClone(original)
      if (!scope.projectRef || keys.some(key => scope[key] !== binding.context[key])) return { status: 'permission_denied' } as const
      if (!binding.admission.approved) return { status: 'needs_contract' } as const
      if (assets && (!binding.assetScope?.ownerProjectRef || binding.assetScope.credentialProjects.length !== 1
        || binding.assetScope.credentialProjects[0] !== binding.assetScope.ownerProjectRef)) return { status: 'needs_contract' } as const
      if (mediaKey && (binding.admission.mediaAccessApproved !== true || !binding.mediaBaseURL)) return { status: 'needs_contract' } as const
      if (review && ((review.kind === 'generation' ? binding.admission.generationExecutionApproved : binding.admission.reviewAdoptionApproved) !== true || (review.kind === 'generation' ? review.body.project_ref.slice(8) : review.body.project_ref) !== binding.assetScope?.ownerProjectRef)) return { status: 'permission_denied' } as const
      if (reconcileProject && reconcileProject !== binding.assetScope?.ownerProjectRef) return { status: 'permission_denied' } as const
      if (preparationWrite && (approvalWrite ? binding.admission.generationApprovalApproved : binding.admission.preparationApproved) !== true) return { status: 'permission_denied' } as const
      if (batch?.submit && binding.admission.batchExecutionApproved !== true) return { status: 'permission_denied' } as const
      const base = new URL(binding.baseURL)
      if (!['http:', 'https:'].includes(base.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)
        || base.username || base.password || base.search || base.hash || base.pathname !== '/') return { status: 'unavailable' } as const
      const headers = new Headers(binding.headers); headers.set('Accept', 'application/json')
      if (mediaKey) { headers.set('Idempotency-Key', mediaKey); headers.set('Content-Type', 'application/json') }
      if (review) { headers.set('Idempotency-Key', review.key); headers.set('Content-Type', 'application/json') }
      if (batch) { headers.set('Idempotency-Key', batch.key); headers.set('Content-Type', 'application/json') }
      if (preparationWrite) headers.set('Content-Type', 'application/json')
      const url = new URL(path, base)
      if (preparationRead) url.searchParams.set('project_ref', binding.assetScope!.ownerProjectRef)
      const response = await this.fetcher(url, { method: batch || mediaKey || review || reconcileProject || preparationWrite ? 'POST' : 'GET', ...(batch ? { body: JSON.stringify(batch.body) } : preparationWrite ? { body: JSON.stringify({ ...preparationWrite, project_ref: binding.assetScope!.ownerProjectRef }) } : review ? { body: JSON.stringify(review.body) } : mediaKey ? { body: JSON.stringify({ confirm: true }) } : {}), headers, redirect: 'error', signal: AbortSignal.timeout(15000) })
      if (response.status === 401 || response.status === 403) return { status: 'permission_denied' } as const
      if (assets && response.status === 400) return { status: 'invalid_input' } as const
      if (!response.ok || !response.body) return review || batch ? { status: 'unconfirmed' } as const : { status: 'unavailable' } as const
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []; let length = 0
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break
          length += part.value.length
          if (length > 1024 * 1024) { await reader.cancel(); return { status: 'unconfirmed' } as const }
          chunks.push(part.value)
        }
      } finally { reader.releaseLock() }
      const current = await this.resolve(scope)
      if (!current || keys.some(key => scope[key] !== current.context[key]) || current.baseURL !== binding.baseURL
        || !current.admission.approved || current.admission.schemaDigest !== binding.admission.schemaDigest
        || current.admission.sdkDigest !== binding.admission.sdkDigest
        || JSON.stringify(current.headers) !== JSON.stringify(binding.headers)
        || (batch?.submit && current.admission.batchExecutionApproved !== true)
        || (preparationWrite && (approvalWrite ? current.admission.generationApprovalApproved : current.admission.preparationApproved) !== true)
        || (review && (review.kind === 'generation' ? current.admission.generationExecutionApproved : current.admission.reviewAdoptionApproved) !== true)
        || (assets && JSON.stringify(current.assetScope) !== JSON.stringify(binding.assetScope))
        || (mediaKey && (current.admission.mediaAccessApproved !== true || current.mediaBaseURL !== binding.mediaBaseURL))) return review || batch ? { status: 'unconfirmed' } as const : { status: 'permission_denied' } as const
      const bytes = new Uint8Array(length); let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      const envelope = z.object({ ok: z.literal(true), status: z.literal('success'), data: z.unknown() }).strict()
        .safeParse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
      if (!envelope.success) return review || batch ? { status: 'unconfirmed' } as const : { status: 'needs_contract' } as const
      return normalize(envelope.data.data, binding)
    } catch { return { status: 'unconfirmed' } as const }
  }
}
