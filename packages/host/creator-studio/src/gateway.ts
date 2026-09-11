import { scaenaTableQuerySchema, scaenaTableResultSchema } from './scaena-table-contract.ts'
import { scaenaPackageQuerySchema, scaenaPackageResultSchema } from './scaena-package-contract.ts'
import { inputQuerySchema } from "./input-contract.ts"
import { eikonaBatchMembersQuerySchema, eikonaBatchMembersResultSchema, matchesEikonaBatchMembers } from './eikona-batch-members.ts'
import { eikonaBatchPlanResultSchema } from './eikona-batch-plan.ts'
import { eikonaBatchPageQuerySchema, eikonaBatchPageResultSchema } from './eikona-batch-input.ts'
import { eikonaBatchInputQuerySchema, eikonaBatchInputResultSchema } from './eikona-batch-input.ts'
import type { EikonaDraftReadResult, EikonaDraftSaveResult } from './eikona-draft-contract.ts'
import { EikonaDraftStore, type EikonaDraftStorage } from './eikona-draft-store.ts'
import { eikonaStatusInputSchema, eikonaStatusResultSchema, matchesEikonaStatus } from './eikona-approval-status.ts'
import { eikonaRevokeInputSchema, eikonaRevokeResultSchema, matchesEikonaRevoke } from './eikona-preparation-approval.ts'
import { eikonaApprovalInputSchema, eikonaApprovalResultSchema, matchesEikonaApproval } from './eikona-preparation-approval.ts'
import { matchesEikonaPreparationInput, eikonaPreparationInputSchema, eikonaPreparationResultSchema } from './eikona-preparation-contract.ts'
import { eikonaReviewQuerySchema, eikonaReviewResultSchema } from './eikona-review-contract.ts'
import { eikonaSelectionQuerySchema, eikonaSelectionResultSchema } from './eikona-selection-contract.ts'
import { eikonaImageQuerySchema, eikonaImageResultSchema, eikonaAssetQuerySchema, eikonaAssetPageSchema } from './eikona-asset-contract.ts'
import type { CreatorOwnerAdapterV1 } from './types.ts'
import { createHash } from 'node:crypto'
import { editorRecoverySaveQuerySchema, editorRecoverySavedSchema, editorRecoveryQuerySchema, editorRecoverySummarySchema, editorRecoveryPageSchema, editorRecoveryReadSchema } from './editor-recovery-contract.ts'
import { z } from 'zod'
import { creatorCandidateQuerySchema, creatorCandidatePageSchema } from './candidate-history.ts'
import { creatorOperationRecoveryPageSchema, type CreatorOperationRecoveryPageV1 } from './operation-recovery-contract.ts'
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import {
  ArtifactRefSchema,
  PANE_ACTION_REQUEST_SCHEMA,
  PaneActionReceiptSchema,
  PaneActionRequestSchema,
  decodePaneActionValues,
  PaneActionReconcileRequestSchema,
  type PaneActionDescriptorV1,
  type PaneActionFieldDescriptorV1,
  type PaneActionReceiptV1,
  type PaneActionReconcileRequestV1,
  type PaneActionRequestV1,
  type PaneActionValueV1,
  type ProjectCanvasReadResult,
  type ProjectCanvasSaveResult,
} from '@yeisme/dsh-pane-protocol'
import { ProjectCanvasStore, type ProjectCanvasStorage } from './project-canvas-store.ts'
import { OperationRecoveryStore, type OperationRecoveryStorage, type OperationRecoveryRow } from './operation-recovery-store.ts'
import { CreatorStudioOwnerDirectory } from './directory.ts'
import { validateCreatorArtifactImage } from './artifact-image.ts'
import { sonoraTranscriptionCatalogSchema, type SonoraTranscriptionCatalog } from './sonora-transcription-catalog.ts'
import type { SonoraWorksTableResult } from './sonora-works-table.ts'
import {
  CREATOR_STUDIO_OWNERS,
  type CreatorApprovalV1,
  type CreatorAssetPageV1,
  type CreatorAssetQueryV1,
  type CreatorAssetV1,
  type CreatorGenerationRunV1,
  type CreatorOperationsProjectionV1,
  type CreatorOwnerProjectionV1,
  type CreatorOwnerSnapshotV1,
  type CreatorStudioContextV1,
  type CreatorStudioOwner,
  type CreatorStudioSnapshotV1,
} from './types.ts'
import {
  validateCreatorActionReceipt,
  validateCreatorApprovalDecision,
  validateCreatorAsset,
  validateCreatorAssetPage,
  validateCreatorAssetQuery,
  validateCreatorArtifactContent,
  validateCreatorOwnerAssetList,
  validateCreatorMediaAccess,
  validateCreatorOperationsDecisionOutcome,
  validateCreatorOperationsSourceSnapshot,
  validateCreatorOwnerSnapshot,
  validateCreatorStudioContext,
  validateCreatorStudioSnapshot,
  validateCreatorOwnerViewSnapshot,
} from './validation.ts'

export const CREATOR_STUDIO_EXPECTED_CONTEXT = 'creatorStudioExpectedContext'
export const CREATOR_STUDIO_OWNER_DIRECTORY = 'creatorStudioOwnerDirectory'

interface CreatorOperationsService {
  snapshot(): unknown
  decide?(decisionRef: string): Promise<unknown>
}

function sameContext(left: CreatorStudioContextV1, right: CreatorStudioContextV1): boolean {
  return left.tenantRef === right.tenantRef
    && left.workspaceRef === right.workspaceRef
    && left.projectRef === right.projectRef
    && left.sessionRef === right.sessionRef
    && left.principalRef === right.principalRef
    && left.revision === right.revision
    && left.membershipRevision === right.membershipRevision
    && left.installationRef === right.installationRef
    && left.pluginDigest === right.pluginDigest
    && left.policyRevision === right.policyRevision
    && left.runtimeGeneration === right.runtimeGeneration
}

function fallbackOwner(owner: CreatorStudioOwner, status: CreatorOwnerProjectionV1['status'], summary: string): CreatorOwnerProjectionV1 {
  return {
    schemaVersion: 'creator.owner.snapshot.v1alpha1',
    owner,
    transport: 'unavailable',
    snapshotRef: `creator:${owner}:unavailable`,
    snapshotVersion: 0,
    cursor: `creator:${owner}:cursor:unavailable`,
    sequence: -1,
    generatedAt: new Date().toISOString(),
    status,
    freshness: 'unknown',
    summary,
    resources: [],
    actions: [],
  }
}

function asProjection(snapshot: CreatorOwnerSnapshotV1): CreatorOwnerProjectionV1 {
  return { ...snapshot }
}

function overallStatus(owners: readonly CreatorOwnerProjectionV1[]): Pick<CreatorStudioSnapshotV1, 'status' | 'freshness' | 'reasonCode' | 'safeMessage'> {
  const ready = owners.filter(owner => owner.status === 'ready' || owner.status === 'running')
  if (ready.length === owners.length) return { status: 'ready', freshness: 'fresh', reasonCode: 'owner_snapshot', safeMessage: 'All Creator Studio owner projections are ready.' }
  if (ready.length > 0) return { status: 'partial', freshness: 'stale', reasonCode: 'partial_owner_projection', safeMessage: `${ready.length} of ${owners.length} Creator Studio owners are ready.` }
  if (owners.some(owner => owner.status === 'contract_mismatch')) return { status: 'contract_mismatch', freshness: 'unknown', reasonCode: 'partial_owner_projection', safeMessage: 'Creator Studio owner contracts require reconciliation.' }
  return { status: 'offline', freshness: 'unknown', reasonCode: 'owner_directory_unavailable', safeMessage: 'No Creator Studio owner projection is currently available.' }
}

function safeIdempotency(input: string): string {
  return input.replace(/[^a-z0-9._:-]/giu, '-').slice(0, 96) || 'unknown'
}

function operationsContextMatches(context: CreatorStudioContextV1, actual: { tenantRef: string; workspaceRef: string; principalRef: string; installationRef: string }): boolean {
  return context.tenantRef === actual.tenantRef
    && context.workspaceRef === actual.workspaceRef
    && context.principalRef === actual.principalRef
    && context.installationRef === actual.installationRef
}

function assetFailure(scope: CreatorAssetQueryV1['scope'], status: CreatorAssetPageV1['status'], reasonCode: CreatorAssetPageV1['reasonCode'], safeMessage: string): CreatorAssetPageV1 {
  return {
    schemaVersion: 'creator.asset.page.v1alpha1',
    scope,
    status,
    freshness: 'unknown',
    reasonCode,
    safeMessage,
    items: [],
    unavailableOwners: [...CREATOR_STUDIO_OWNERS],
  }
}

function assetOffset(cursor: string | undefined): number | undefined {
  if (cursor === undefined) return 0
  const match = /^assets:(\d+)$/u.exec(cursor)
  if (match === null) return undefined
  const value = Number(match[1])
  return Number.isSafeInteger(value) ? value : undefined
}

function gatewayReceipt(request: Partial<Pick<PaneActionRequestV1, 'owner' | 'actionId' | 'idempotencyKey'>>, status: PaneActionReceiptV1['status'], summary: string, reconcileReason?: string): PaneActionReceiptV1 {
  return PaneActionReceiptSchema.parse({
    status,
    receiptRef: `receipt:creator:${safeIdempotency(request.idempotencyKey ?? 'unknown')}`,
    ...(request.owner === undefined ? {} : { owner: request.owner }),
    ...(request.actionId === undefined ? {} : { actionId: request.actionId }),
    summary,
    ...(reconcileReason === undefined ? {} : { reconcileReason }),
  })
}

function fieldValueValid(field: PaneActionFieldDescriptorV1, value: PaneActionValueV1 | undefined): boolean {
  if (value === undefined) return !field.required
  if (field.kind === 'boolean') return typeof value === 'boolean'
  if (field.kind === 'number') return typeof value === 'number' && (field.min === undefined || value >= field.min) && (field.max === undefined || value <= field.max)
  if (field.kind === 'artifact_ref') {
    if (!ArtifactRefSchema.safeParse(value).success) return false
    return field.artifactKinds === undefined || field.artifactKinds.includes((value as { kind: string }).kind)
  }
  if (field.kind === 'multiselect') {
    if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) return false
    const allowed = new Set(field.options?.map(option => option.value) ?? [])
    return value.every(item => allowed.has(item))
  }
  if (typeof value !== 'string') return false
  if (field.minLength !== undefined && value.length < field.minLength) return false
  if (field.maxLength !== undefined && value.length > field.maxLength) return false
  if (field.kind === 'select') return field.options?.some(option => option.value === value) === true
  return true
}

function requestMatchesDescriptor(request: PaneActionRequestV1, descriptor: PaneActionDescriptorV1): boolean {
  if (request.descriptorRef !== descriptor.descriptorRef
    || request.owner !== descriptor.owner
    || request.actionId !== descriptor.actionId
    || request.expectedTargetRef !== descriptor.targetRef
    || request.expectedTargetVersion !== descriptor.targetVersion
    || !sameContext(request.context as CreatorStudioContextV1, descriptor.context as CreatorStudioContextV1)) return false
  const fields = new Map(descriptor.fields.map(field => [field.key, field]))
  const values = decodePaneActionValues(request)
  if (request.textBody && (descriptor.textBody?.field !== request.textBody.field
    || new TextEncoder().encode(request.textBody.content).byteLength > descriptor.textBody.maxBytes)) return false
  if (Object.keys(values).some(key => !fields.has(key))) return false
  return descriptor.fields.every(field => fieldValueValid(request.textBody?.field === field.key
    ? { ...field, maxLength: undefined } : field, values[field.key]))
}

/** Safe Remote shared by all Creator Studio views. It owns no domain canonical state. */
export class CreatorStudioGateway extends TypertRemoteService {
  private get expectedContext(): CreatorStudioContextV1 | undefined {
    return validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
  }
  private snapshotVersion = 0
  private readonly eikonaDrafts: EikonaDraftStore | undefined
  private readonly canvas: ProjectCanvasStore | undefined
  private readonly operations: OperationRecoveryStore | undefined

  constructor(ctx: Context) {
    super(ctx, 'creatorStudio')
    const storage = ctx.get('storageDomain' as never) as (ProjectCanvasStorage & OperationRecoveryStorage & EikonaDraftStorage) | undefined
    if (storage !== undefined && typeof storage.open === 'function') {
      this.eikonaDrafts = new EikonaDraftStore(storage, () => validateCreatorStudioContext(ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT)))
      this.canvas = new ProjectCanvasStore(storage, () => validateCreatorStudioContext(ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT)))
      this.operations = new OperationRecoveryStore(storage, () => validateCreatorStudioContext(ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT)))
      ctx.effect(() => async () => { await this.eikonaDrafts?.close(); await this.operations?.close(); await this.canvas?.close() }, 'creatorStudio.projectCanvas')
    }
  }

  @Remote('inputRequest')
  async inputRequest(input:unknown) {
    const parsed=inputQuerySchema.safeParse(input),context=this.expectedContext
    const latest=validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
    if(!parsed.success)return {status:'invalid_input' as const}
    if(!context||!latest||!sameContext(context,latest))return {status:'permission_denied' as const}
    const directory=this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory|undefined
    const adapter=directory?.selected(parsed.data.owner),intake=adapter?.inputIntake
    if(!intake)return {status:'unavailable' as const}
    const generation=directory?.generation,result=await intake.run(parsed.data,context)
    const current=validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
    if(!current||!sameContext(context,current)||directory?.generation!==generation||directory?.selected(parsed.data.owner)!==adapter)return {status:'permission_denied' as const}
    return result
  }

  @Remote('readEikonaDraft')
  async readEikonaDraft(input: unknown): Promise<EikonaDraftReadResult> {
    return this.eikonaDrafts?.read(input) ?? { status: 'unavailable' }
  }

  @Remote('saveEikonaDraft')
  async saveEikonaDraft(input: unknown): Promise<EikonaDraftSaveResult> {
    return this.eikonaDrafts?.save(input) ?? { status: 'unavailable' }
  }

  @Remote('reconcileEikonaDraft')
  async reconcileEikonaDraft(input: unknown): Promise<EikonaDraftSaveResult> {
    return this.eikonaDrafts?.reconcile(input) ?? { status: 'unavailable' }
  }

  @Remote('canvasRead')
  async canvasRead(input: unknown): Promise<ProjectCanvasReadResult> {
    return this.canvas?.read(input) ?? { status: 'unavailable' }
  }

  @Remote('canvasSave')
  async canvasSave(input: unknown): Promise<ProjectCanvasSaveResult> {
    return this.canvas?.save(input) ?? { status: 'unavailable' }
  }

  @Remote('canvasReconcile')
  async canvasReconcile(input: unknown): Promise<ProjectCanvasSaveResult> {
    return this.canvas?.reconcile(input) ?? { status: 'unavailable' }
  }

  @Remote('recallOperationIdentity')
  async recallOperationIdentity(input: unknown): Promise<PaneActionReconcileRequestV1 | null> {
    const context = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
    if (context === undefined || this.expectedContext === undefined || !sameContext(context, this.expectedContext) || this.operations === undefined) return null
    const parsed = z.object({ owner: z.string().min(1).max(64), actionId: z.string().min(1).max(160), expectedTargetRef: z.string().min(1).max(512) }).strict().safeParse(input)
    if (!parsed.success) return null
    const row = await this.recoveryRow(parsed.data)
    const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
    if (!latest || !sameContext(context, latest)) return null
    return row ? { ...row.request, context } : null
  }

  @Remote('listOperationRecoveries')
  async listOperationRecoveries(): Promise<CreatorOperationRecoveryPageV1> {
    const unavailable = { schemaVersion: 'creator.operation-recovery-page.v1alpha1' as const, status: 'unavailable' as const }
    const context = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
    if (!context || !this.expectedContext || !sameContext(context, this.expectedContext) || !this.operations) return unavailable
    const result = await this.operations.list()
    const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
    if (result.status !== 'ready' || !latest || !sameContext(context, latest)) return unavailable
    const page = creatorOperationRecoveryPageSchema.safeParse({ schemaVersion: unavailable.schemaVersion, status: 'ready', context,
      operations: result.rows.map(row => ({ request: { ...row.request, context }, targetVersion: row.targetVersion })) })
    return page.success ? page.data : unavailable
  }

  private async recoveryRow(query: { owner: string; actionId: string; expectedTargetRef: string }): Promise<OperationRecoveryRow | undefined> {
    const result = await this.operations?.list()
    return result?.status === 'ready' ? result.rows.find(row => row.request.owner === query.owner && row.request.actionId === query.actionId
      && row.request.expectedTargetRef === query.expectedTargetRef) : undefined
  }

  @Remote('snapshot')
  async snapshot(): Promise<CreatorStudioSnapshotV1> {
    return this.composeSnapshot()
  }

  @Remote('selectScaenaPackage')
  async selectScaenaPackage(input: unknown) {
    const query = scaenaPackageQuerySchema.safeParse(input), context = this.expectedContext
    if (!query.success) return { status: 'invalid_input' as const }
    if (!context) return { status: 'permission_denied' as const }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const adapter = directory?.selected('scaena')
    if (!adapter?.selectScaenaPackage) return { status: 'unavailable' as const }
    const generation = directory?.generation
    try {
      const result = scaenaPackageResultSchema.safeParse(await adapter.selectScaenaPackage(query.data, context))
      const latest = this.expectedContext
      if (!latest || !sameContext(context, latest) || directory?.generation !== generation || directory?.selected('scaena') !== adapter) return { status: 'permission_denied' as const }
      if (!result.success || (result.data.status === 'ready' && result.data.packageRef !== query.data.packageRef)) return { status: 'unconfirmed' as const }
      return result.data
    } catch { return { status: 'unconfirmed' as const } }
  }

  @Remote('readScaenaTable')
  async readScaenaTable(input: unknown) {
    const query = scaenaTableQuerySchema.safeParse(input), context = this.expectedContext
    if (!query.success) return { status: 'invalid_input' as const }
    if (!context) return { status: 'permission_denied' as const }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const adapter = directory?.selected('scaena')
    if (!adapter?.readScaenaTable) return { status: 'unavailable' as const }
    const generation = directory?.generation
    try {
      const result = scaenaTableResultSchema.safeParse(await adapter.readScaenaTable(query.data, context))
      const latest = this.expectedContext
      if (!latest || !sameContext(context, latest) || directory?.generation !== generation || directory?.selected('scaena') !== adapter) return { status: 'permission_denied' as const }
      if (!result.success || (result.data.status === 'ready' && result.data.view.breakdown_ref !== query.data.breakdownRef)) return { status: 'unconfirmed' as const }
      return result.data
    } catch { return { status: 'unconfirmed' as const } }
  }

  @Remote('snapshotOwner')
  async snapshotOwner(input: unknown): Promise<CreatorStudioSnapshotV1> {
    return this.composeSnapshot(z.enum(CREATOR_STUDIO_OWNERS).parse(input))
  }

  private async composeSnapshot(onlyOwner?: CreatorStudioOwner): Promise<CreatorStudioSnapshotV1> {
    const requestedOwners = onlyOwner === undefined ? CREATOR_STUDIO_OWNERS : [onlyOwner]
    const context = this.expectedContext
    const now = new Date().toISOString()
    if (context === undefined) {
      return {
        schemaVersion: 'creator.studio.snapshot.v1alpha1',
        snapshotRef: 'creator:studio:context-unavailable',
        snapshotVersion: 0,
        generatedAt: now,
        status: 'contract_mismatch',
        freshness: 'unknown',
        reasonCode: 'context_unavailable',
        safeMessage: 'Creator Studio is waiting for a frozen tenant and workspace context.',
        owners: requestedOwners.map(owner => fallbackOwner(owner, 'contract_mismatch', 'Owner context is unavailable.')),
        reviews: [],
        jobs: [],
      }
    }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    if (directory === undefined) {
      return {
        schemaVersion: 'creator.studio.snapshot.v1alpha1',
        snapshotRef: `creator:studio:${context.runtimeGeneration}:directory-unavailable`,
        snapshotVersion: 0,
        generatedAt: now,
        status: 'offline',
        freshness: 'unknown',
        reasonCode: 'owner_directory_unavailable',
        safeMessage: 'Creator Studio owner adapters are not mounted.',
        context: context,
        owners: requestedOwners.map(owner => fallbackOwner(owner, 'offline', 'Owner adapter is not mounted.')),
        reviews: [],
        jobs: [],
      }
    }

    const owners = await Promise.all(requestedOwners.map(async owner => {
      const adapter = directory.selected(owner)
      if (adapter === undefined) return fallbackOwner(owner, 'offline', 'Owner adapter is not mounted.')
      try {
        const snapshot = validateCreatorOwnerSnapshot(await adapter.snapshot(context!))
        if (snapshot === undefined || snapshot.owner !== owner || snapshot.transport !== adapter.transport) {
          return fallbackOwner(owner, 'contract_mismatch', 'Owner projection did not match the Creator Studio contract.')
        }
        if (!sameContext(context!, snapshot.context)) {
          return fallbackOwner(owner, 'contract_mismatch', 'Owner projection context changed; reconcile is required.')
        }
        return asProjection(snapshot)
      } catch {
        return fallbackOwner(owner, 'offline', 'Owner projection is unavailable.')
      }
    }))
    const latestContext = this.expectedContext
    if (!latestContext || !sameContext(context, latestContext) || directory !== this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY)) {
      return { schemaVersion: 'creator.studio.snapshot.v1alpha1', snapshotRef: 'creator:studio:context-changed', snapshotVersion: ++this.snapshotVersion,
        generatedAt: now, status: 'contract_mismatch', freshness: 'unknown', reasonCode: 'context_unavailable',
        safeMessage: 'The project context changed. Reload the workspace.', owners: requestedOwners.map(owner => fallbackOwner(owner, 'contract_mismatch', 'Project context changed.')), reviews: [], jobs: [] }
    }
    const aggregate = overallStatus(owners)
    const scaena = owners.find(owner => owner.owner === 'scaena')
    const operations = onlyOwner === undefined ? this.readOperations() : undefined
    const snapshot: CreatorStudioSnapshotV1 = {
      schemaVersion: 'creator.studio.snapshot.v1alpha1',
      snapshotRef: `creator:studio:${context.runtimeGeneration}:${directory.generation}${onlyOwner === undefined ? '' : `:${onlyOwner}`}`,
      snapshotVersion: ++this.snapshotVersion,
      generatedAt: now,
      ...aggregate,
      context: context,
      owners,
      ...(scaena?.production === undefined ? {} : { production: scaena.production }),
      reviews: scaena?.reviews ?? [],
      jobs: scaena?.jobs ?? [],
      ...(operations === undefined ? {} : { operations: operations.operations, generationRuns: operations.generationRuns, approvals: operations.approvals }),
    }
    return (onlyOwner === undefined ? validateCreatorStudioSnapshot(snapshot) : validateCreatorOwnerViewSnapshot(snapshot)) ?? {
      schemaVersion: snapshot.schemaVersion,
      snapshotRef: snapshot.snapshotRef,
      snapshotVersion: snapshot.snapshotVersion,
      generatedAt: snapshot.generatedAt,
      status: 'contract_mismatch',
      freshness: 'unknown',
      reasonCode: 'partial_owner_projection',
      safeMessage: 'Creator Studio could not validate the composed owner projection.',
      context: context,
      owners: snapshot.owners,
      reviews: [],
      jobs: [],
      operations: { status: 'contract_mismatch', freshness: 'stale', reasonCode: 'contract_mismatch', safeMessage: 'Creator Studio operations projection could not be validated.' },
      generationRuns: [],
      approvals: [],
    }
  }

  @Remote('assets')
  async assets(input: unknown): Promise<CreatorAssetPageV1> {
    const query = validateCreatorAssetQuery(input)
    const requestedScope = typeof input === 'object' && input !== null && (input as { scope?: unknown }).scope === 'all_projects' ? 'all_projects' : 'current_project'
    if (query === undefined) return assetFailure(requestedScope, 'contract_mismatch', 'contract_mismatch', 'The asset query did not match the Creator Studio contract.')
    const context = this.expectedContext
    if (context === undefined) return assetFailure(query.scope, 'contract_mismatch', 'contract_mismatch', 'Creator Studio context is unavailable.')
    if (query.scope === 'current_project' && context.projectRef === undefined) {
      return assetFailure(query.scope, 'needs_contract', 'project_context_unavailable', 'The current project reference is unavailable.')
    }
    const offset = assetOffset(query.cursor)
    if (offset === undefined) return assetFailure(query.scope, 'contract_mismatch', 'contract_mismatch', 'The asset cursor did not match the Creator Studio contract.')
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    if (directory === undefined) return assetFailure(query.scope, 'needs_contract', 'asset_contract_unavailable', 'Creator Studio owner adapters are not mounted.')

    const items: CreatorAssetV1[] = []
    const unavailableOwners: CreatorStudioOwner[] = []
    const permissionDeniedOwners: CreatorStudioOwner[] = []
    let availableOwners = 0
    for (const owner of CREATOR_STUDIO_OWNERS) {
      const adapter = directory.selected(owner)
      if (adapter === undefined) {
        unavailableOwners.push(owner)
        continue
      }
      try {
        if (query.scope === 'current_project') {
          const snapshot = validateCreatorOwnerSnapshot(await adapter.snapshot(context))
          if (snapshot === undefined || snapshot.owner !== owner || snapshot.transport !== adapter.transport || !sameContext(context, snapshot.context)) throw new Error('owner snapshot mismatch')
          if (snapshot.status === 'permission_denied') {
            permissionDeniedOwners.push(owner)
            continue
          }
          if (snapshot.status === 'offline' || snapshot.status === 'contract_mismatch' || snapshot.status === 'unknown') throw new Error('owner snapshot unavailable')
          availableOwners += 1
          for (const resource of snapshot.resources) items.push({ ...resource, owner, projectRef: context.projectRef! })
          continue
        }
        if (adapter.listAssets === undefined) {
          unavailableOwners.push(owner)
          continue
        }
        const listed = validateCreatorOwnerAssetList(await adapter.listAssets({ scope: 'all_projects' }, context))
        if (listed === undefined) throw new Error('owner asset page mismatch')
        if (listed.status === 'permission_denied') {
          permissionDeniedOwners.push(owner)
          continue
        }
        if (listed.status === 'needs_contract') {
          unavailableOwners.push(owner)
          continue
        }
        availableOwners += 1
        const validated = listed.items.map(item => validateCreatorAsset(item))
        if (validated.some(item => item === undefined || item.owner !== owner)) throw new Error('owner asset page mismatch')
        items.push(...validated as CreatorAssetV1[])
      } catch {
        unavailableOwners.push(owner)
      }
    }

    const text = query.text?.toLocaleLowerCase()
    const filtered = items.filter(item => (query.owner === undefined || item.owner === query.owner)
      && (query.kind === undefined || item.kind === query.kind)
      && (query.status === undefined || item.status === query.status)
      && (text === undefined || `${item.title}\n${item.summary ?? ''}`.toLocaleLowerCase().includes(text)))
      .sort((left, right) => `${left.projectRef}\u0000${left.owner}\u0000${left.ref}\u0000${left.version}`.localeCompare(`${right.projectRef}\u0000${right.owner}\u0000${right.ref}\u0000${right.version}`))
    const limit = query.limit ?? 100
    const pageItems = filtered.slice(offset, offset + limit)
    const nextOffset = offset + pageItems.length
    const noCapability = availableOwners === 0 && permissionDeniedOwners.length === 0
    const permissionDenied = availableOwners === 0 && permissionDeniedOwners.length > 0
    const partial = unavailableOwners.length > 0 || permissionDeniedOwners.length > 0
    const page: CreatorAssetPageV1 = {
      schemaVersion: 'creator.asset.page.v1alpha1',
      scope: query.scope,
      status: permissionDenied ? 'permission_denied' : noCapability ? 'needs_contract' : partial ? 'partial' : 'ready',
      freshness: permissionDenied || noCapability ? 'unknown' : partial ? 'stale' : 'fresh',
      reasonCode: permissionDenied ? 'permission_denied' : noCapability ? 'asset_contract_unavailable' : partial ? 'partial_owner_projection' : 'asset_page',
      safeMessage: permissionDenied ? 'The current principal is not permitted to read the requested asset scope.' : noCapability ? 'No owner published the requested asset scope.' : partial ? `${availableOwners} of ${CREATOR_STUDIO_OWNERS.length} asset owners are available.` : 'Creator assets are ready.',
      items: pageItems,
      ...(nextOffset < filtered.length ? { nextCursor: `assets:${nextOffset}` } : {}),
      unavailableOwners,
      permissionDeniedOwners,
    }
    return validateCreatorAssetPage(page) ?? assetFailure(query.scope, 'contract_mismatch', 'contract_mismatch', 'The composed asset page did not match the Creator Studio contract.')
  }

  @Remote('decideApproval')
  async decideApproval(input: unknown): Promise<PaneActionReceiptV1> {
    const decision = validateCreatorApprovalDecision(input)
    if (decision === undefined) return gatewayReceipt({}, 'reconcile_required', 'The approval request did not match the Creator Studio contract.', 'request_contract_mismatch')
    const service = this.ctx.get('ordoAgentOps') as CreatorOperationsService | undefined
    if (this.expectedContext === undefined || service === undefined || typeof service.snapshot !== 'function' || typeof service.decide !== 'function') {
      return gatewayReceipt({ actionId: 'ordo.approval.decide', idempotencyKey: decision.decisionRef }, 'reconcile_required', 'The Ordo approval owner is unavailable.', 'owner_unavailable')
    }
    const snapshot = validateCreatorOperationsSourceSnapshot(service.snapshot())
    if (snapshot === undefined || snapshot.context === undefined || !operationsContextMatches(this.expectedContext, snapshot.context) || snapshot.state !== 'ready' || snapshot.freshness !== 'fresh') {
      return gatewayReceipt({ actionId: 'ordo.approval.decide', idempotencyKey: decision.decisionRef }, 'reconcile_required', 'The Ordo approval snapshot is not fresh.', 'owner_snapshot_not_fresh')
    }
    const descriptor = snapshot.actions?.find(action => action.actionType === 'ordo.approval.decide' && action.decisionRef === decision.decisionRef)
    if (descriptor === undefined) return gatewayReceipt({ actionId: 'ordo.approval.decide', idempotencyKey: decision.decisionRef }, 'reconcile_required', 'The approval preview is no longer available.', 'descriptor_changed')
    if (Date.parse(descriptor.expiresAt) <= Date.now()) return gatewayReceipt({ actionId: 'ordo.approval.decide', idempotencyKey: decision.decisionRef }, 'reconcile_required', 'The approval preview expired.', 'descriptor_expired')
    try {
      const outcome = validateCreatorOperationsDecisionOutcome(await service.decide(decision.decisionRef))
      if (outcome === undefined) return gatewayReceipt({ actionId: 'ordo.approval.decide', idempotencyKey: decision.decisionRef }, 'unknown', 'The Ordo approval settlement is unverifiable.', 'settlement_unknown')
      if (outcome.kind === 'receipt') {
        return PaneActionReceiptSchema.parse({
          status: outcome.receipt.state === 'accepted' ? 'accepted' : outcome.receipt.state === 'reconcile_required' ? 'reconcile_required' : 'unknown',
          receiptRef: outcome.receipt.receiptRef,
          owner: 'ordo',
          actionId: 'ordo.approval.decide',
          summary: outcome.receipt.safeSummary,
          ...(outcome.receipt.state === 'accepted' ? {} : { reconcileReason: outcome.receipt.state }),
        })
      }
      if (outcome.kind === 'rejected') {
        const reconcile = outcome.rejection.reason === 'stale' || outcome.rejection.reason === 'expired'
        return gatewayReceipt({ actionId: 'ordo.approval.decide', idempotencyKey: decision.decisionRef }, reconcile ? 'reconcile_required' : 'rejected', outcome.rejection.safeMessage, outcome.rejection.reason)
      }
      return gatewayReceipt({ actionId: 'ordo.approval.decide', idempotencyKey: decision.decisionRef }, outcome.state === 'reconcile_required' ? 'reconcile_required' : 'unknown', outcome.safeSummary, outcome.state)
    } catch {
      return gatewayReceipt({ actionId: 'ordo.approval.decide', idempotencyKey: decision.decisionRef }, 'unknown', 'The Ordo approval transport or settlement is uncertain.', 'settlement_unknown')
    }
  }

  @Remote('reconcile')
  async reconcile(input: unknown): Promise<PaneActionReceiptV1> {
    const parsed = PaneActionReconcileRequestSchema.safeParse(input)
    if (!parsed.success) return gatewayReceipt({}, 'unknown', 'The reconciliation request is invalid.', 'request_contract_mismatch')
    const request = parsed.data
    const context = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
    if (context === undefined || this.expectedContext === undefined || !sameContext(context, this.expectedContext)
      || !sameContext(context, request.context as CreatorStudioContextV1)) {
      return gatewayReceipt(request, 'unknown', 'The reconciliation context is unavailable.', 'context_changed')
    }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const owner = request.owner as CreatorStudioOwner
    const adapter = CREATOR_STUDIO_OWNERS.includes(owner) ? directory?.selected(owner) : undefined
    if (adapter?.reconcile === undefined) return gatewayReceipt(request, 'unknown', 'The owner reconciliation adapter is unavailable.', 'reconcile_unavailable')
    const remembered = await this.recoveryRow(request)
    if (remembered && remembered.request.idempotencyKey !== request.idempotencyKey) return gatewayReceipt(request, 'unknown', 'Use the stored original request key.', 'original_key_mismatch')
    const lookup = remembered ? { ...remembered.request, context } : request
    try {
      // Deliberately bypass expired generation descriptors: the owner authorizes lookup of the original key.
      const receipt = validateCreatorActionReceipt(await adapter.reconcile(lookup, context))
      const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (latest === undefined || !sameContext(context, latest)) return gatewayReceipt(request, 'unknown', 'The reconciliation context changed.', 'context_changed')
      if (receipt?.owner !== owner || receipt.actionId !== request.actionId) return gatewayReceipt(request, 'unknown', 'The owner returned no matching receipt.', 'receipt_contract_mismatch')
      if (remembered && ['completed', 'failed'].includes(receipt.status)) await this.operations?.forget(remembered)
      return receipt
    } catch {
      return gatewayReceipt(request, 'unknown', 'The original operation remains uncertain.', 'settlement_unknown')
    }
  }

  @Remote('dispatch')
  async dispatch(input: unknown): Promise<PaneActionReceiptV1> {
    const parsed = PaneActionRequestSchema.safeParse(input)
    if (!parsed.success) return gatewayReceipt({}, 'reconcile_required', 'The action request did not match the Creator Studio contract.', 'request_contract_mismatch')
    const request = parsed.data
    const context = this.expectedContext
    if (context === undefined || !sameContext(context, request.context as CreatorStudioContextV1)) {
      return gatewayReceipt(request, 'reconcile_required', 'The action context changed; request a new owner preview.', 'context_changed')
    }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const owner = request.owner as CreatorStudioOwner
    if (directory === undefined || !CREATOR_STUDIO_OWNERS.includes(owner)) {
      return gatewayReceipt(request, 'reconcile_required', 'The requested owner adapter is unavailable.', 'owner_unavailable')
    }
    const adapter = directory.selected(owner)
    if (adapter === undefined) return gatewayReceipt(request, 'reconcile_required', 'The requested owner adapter is unavailable.', 'owner_unavailable')
    let snapshot: CreatorOwnerSnapshotV1 | undefined
    try { snapshot = validateCreatorOwnerSnapshot(await adapter.snapshot(context)) } catch { /* converted below */ }
    if (snapshot === undefined || snapshot.status !== 'ready' || snapshot.freshness !== 'fresh' || !sameContext(context, snapshot.context)) {
      return gatewayReceipt(request, 'reconcile_required', 'The owner action snapshot is not fresh; reconcile before dispatch.', 'owner_snapshot_not_fresh')
    }
    const descriptor = snapshot.actions.find(action => action.descriptorRef === request.descriptorRef)
    if (descriptor === undefined || !requestMatchesDescriptor(request, descriptor)) {
      return gatewayReceipt(request, 'reconcile_required', 'The owner action preview changed; request a new preview.', 'descriptor_changed')
    }
    if (Date.parse(descriptor.expiresAt) <= Date.now()) {
      return gatewayReceipt(request, 'reconcile_required', 'The owner action preview expired; request a new preview.', 'descriptor_expired')
    }
    let reserved: OperationRecoveryRow | undefined
    if (this.operations) {
      const result = await this.operations.reserve(request)
      if (result.status === 'existing') return gatewayReceipt(request, 'reconcile_required', 'An original request is already stored; reconcile it before another execution.', 'original_operation_pending')
      if (result.status !== 'saved') return gatewayReceipt(request, 'reconcile_required', 'The original request could not be saved; no owner operation was sent.', 'recovery_storage_unavailable')
      reserved = result.row
    }
    const latestContext = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
    if (!latestContext || !sameContext(context, latestContext) || directory !== this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) || directory.selected(owner) !== adapter) {
      return gatewayReceipt(request, 'reconcile_required', 'The context changed before sending the owner operation.', 'context_changed')
    }
    try {
      const receipt = validateCreatorActionReceipt(await adapter.dispatch({ ...request, schema: PANE_ACTION_REQUEST_SCHEMA }, context))
      const settled = receipt?.owner === owner && receipt.actionId === request.actionId ? receipt
        : gatewayReceipt(request, 'unknown', 'The owner returned no matching action receipt.', 'settlement_unknown')
      const currentContext = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (!currentContext || !sameContext(context, currentContext) || directory !== this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) || directory.selected(owner) !== adapter) {
        return gatewayReceipt(request, 'unknown', 'The context changed while awaiting the owner result.', 'context_changed')
      }
      if (reserved && ['completed', 'failed', 'rejected'].includes(settled.status)) await this.operations?.forget(reserved)
      return settled
    } catch {
      return gatewayReceipt(request, 'unknown', 'The owner action transport or settlement is uncertain.', 'settlement_unknown')
    }
  }

  @Remote('resolveArtifact')
  async resolveArtifact(input: unknown) {
    const context = this.expectedContext
    const artifact = ArtifactRefSchema.safeParse(input)
    if (!artifact.success || context === undefined) return null
    const owner = artifact.data.owner as CreatorStudioOwner
    if (!CREATOR_STUDIO_OWNERS.includes(owner)) return null
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    if (directory === undefined) return null
    try {
      const result = await directory.resolveArtifact(owner, artifact.data, context)
      const latest = this.expectedContext
      return latest && sameContext(context, latest) ? validateCreatorMediaAccess(result) ?? null : null
    } catch {
      return null
    }
  }

  /** Independent read: capability discovery never gates subtitle export dispatch. */
  /** 声音工作列表一页（§2.1）：context/owner/generation 三重 fence 后透传结果。 */
  @Remote('readWorksTable')
  async readWorksTable(input?: unknown): Promise<SonoraWorksTableResult | { status: 'rejected'; reason: 'invalid_input' } | null> {
    const cursor = typeof input === 'string' ? input : undefined
    if (input !== undefined && cursor === undefined) return { status: 'rejected', reason: 'invalid_input' }
    const context = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
    if (context === undefined || this.expectedContext === undefined || !sameContext(context, this.expectedContext)) return null
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const adapter = directory?.selected('sonora')
    if (directory === undefined || adapter?.readWorksTable === undefined) return null
    const generation = directory.generation
    try {
      const result = await adapter.readWorksTable(context, cursor)
      const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (latest === undefined || !sameContext(context, latest) || this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) !== directory
        || directory.generation !== generation || directory.selected('sonora') !== adapter) return null
      return result
    } catch { return null }
  }

  @Remote('readTranscriptionCatalog')
  async readTranscriptionCatalog(input?: unknown): Promise<SonoraTranscriptionCatalog | null> {
    const context = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
    if (context === undefined || this.expectedContext === undefined || !sameContext(context, this.expectedContext)) return null
    if (input !== undefined) {
      const expected = validateCreatorStudioContext(input)
      if (expected === undefined || !sameContext(context, expected)) return null
    }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const adapter = directory?.selected('sonora')
    if (directory === undefined || adapter?.readTranscriptionCatalog === undefined) return null
    const generation = directory.generation
    try {
      const result = await adapter.readTranscriptionCatalog(context)
      const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (latest === undefined || !sameContext(context, latest) || this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) !== directory
        || directory.generation !== generation || directory.selected('sonora') !== adapter) return null
      const parsed = sonoraTranscriptionCatalogSchema.safeParse(result)
      return parsed.success ? parsed.data : null
    } catch { return null }
  }

  /** Bounded candidate history read; never starts an owner operation. */
  @Remote('saveAuctraRecoveryDraft')
  async saveAuctraRecoveryDraft(input: unknown) {
    const query = editorRecoverySaveQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' as const }
    const context = this.expectedContext === undefined ? undefined : { ...this.expectedContext }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const adapter = directory?.selected('auctra')
    if (!context || !directory || !adapter?.saveAuctraRecoveryDraft) return { status: 'unavailable' as const }
    const generation = directory.generation
    try {
      const result = editorRecoverySavedSchema.safeParse(await adapter.saveAuctraRecoveryDraft(query.data, context))
      const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (!latest || !sameContext(context, latest) || this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) !== directory
        || directory.generation !== generation || directory.selected('auctra') !== adapter) return { status: 'unconfirmed' as const }
      if (!result.success) return { status: 'unconfirmed' as const }
      if (result.data.status === 'ready') {
        const draft = result.data.value.draft
        if (draft.baseVersion !== query.data.base.contentRevision || draft.contentDigest !== createHash('sha256').update(query.data.content).digest('hex')
          || draft.byteLength !== new TextEncoder().encode(query.data.content).byteLength || draft.revision !== (query.data.previous?.revision ?? 0) + 1
          || (query.data.previous !== undefined && draft.ref !== query.data.previous.ref)) return { status: 'unconfirmed' as const }
      }
      return result.data
    } catch { return { status: 'unconfirmed' as const } }
  }

  @Remote('listAuctraRecoveryDrafts')
  async listAuctraRecoveryDrafts(input: unknown = {}) {
    const query = editorRecoveryQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' as const }
    return this.auctraRecoveryCall(adapter => adapter.listAuctraRecoveryDrafts?.({ ...(query.data.artifact === undefined ? {} : { artifact: query.data.artifact }), ...(query.data.cursor === undefined ? {} : { cursor: query.data.cursor }), ...(query.data.limit === undefined ? {} : { limit: query.data.limit }) }, { ...this.expectedContext! }), false, query.data.limit ?? 50)
  }

  @Remote('readAuctraRecoveryDraft')
  async readAuctraRecoveryDraft(input: unknown) {
    const claim = editorRecoverySummarySchema.safeParse(input)
    if (!claim.success) return { status: 'invalid_input' as const }
    const result = await this.auctraRecoveryCall(adapter => adapter.readAuctraRecoveryDraft?.(claim.data, { ...this.expectedContext! }), true)
    if (result.status === 'ready' && 'content' in result.value) {
      if (JSON.stringify(result.value.draft) !== JSON.stringify(claim.data)
        || createHash('sha256').update(result.value.content).digest('hex') !== claim.data.contentDigest
        || new TextEncoder().encode(result.value.content).byteLength !== claim.data.byteLength) return { status: 'unconfirmed' as const }
    }
    return result
  }

  private async auctraRecoveryCall(call: (adapter: CreatorOwnerAdapterV1) => unknown, content: boolean, limit = 100) {
    const context = this.expectedContext === undefined ? undefined : { ...this.expectedContext }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const adapter = directory?.selected('auctra')
    if (!context || !directory || !adapter) return { status: 'unavailable' as const }
    const generation = directory.generation
    try {
      const value = await call(adapter)
      const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (!latest || !sameContext(context, latest) || this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) !== directory
        || directory.generation !== generation || directory.selected('auctra') !== adapter) return { status: 'permission_denied' as const }
      const parsed = (content ? editorRecoveryReadSchema : editorRecoveryPageSchema).safeParse(value)
      if (!parsed.success) return { status: 'unconfirmed' as const }
      if (parsed.data.status === 'ready' && 'drafts' in parsed.data.value && (parsed.data.value.drafts.length > limit
        || new Set(parsed.data.value.drafts.map(draft => draft.ref)).size !== parsed.data.value.drafts.length)) return { status: 'unconfirmed' as const }
      return parsed.data
    } catch { return { status: 'unconfirmed' as const } }
  }

  @Remote('readEikonaCandidateImage')
  async readEikonaCandidateImage(input: unknown) {
    const query = eikonaImageQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' as const }
    const context = this.expectedContext === undefined ? undefined : { ...this.expectedContext }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const adapter = directory?.selected('eikona')
    if (!context || !directory || !adapter?.readEikonaCandidateImage) return { status: 'unavailable' as const }
    const generation = directory.generation
    try {
      const result = await adapter.readEikonaCandidateImage(query.data, context)
      const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (!latest || !sameContext(context, latest) || this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) !== directory
        || generation !== directory.generation || adapter !== directory.selected('eikona')) return { status: 'permission_denied' as const }
      if (result.status !== 'ready') {
        const failure = eikonaImageResultSchema.safeParse(result)
        return failure.success ? failure.data : { status: 'unconfirmed' as const }
      }
      const value = result.value
      if (!(value.bytes instanceof Uint8Array) || value.bytes.length === 0 || value.bytes.length > 16 * 1024 * 1024
        || value.artifactRef !== query.data.artifactRef || value.contentDigest !== query.data.contentDigest) return { status: 'unconfirmed' as const }
      const bytes = Buffer.from(value.bytes)
      if (createHash('sha256').update(bytes).digest('hex') !== query.data.contentDigest) return { status: 'unconfirmed' as const }
      return eikonaImageResultSchema.parse({ status: 'ready', value: { artifactRef: value.artifactRef, contentDigest: value.contentDigest,
        mediaType: value.mediaType, byteLength: bytes.length, base64: bytes.toString('base64') } })
    } catch { return { status: 'unconfirmed' as const } }
  }

  @Remote('readEikonaReview')
  async readEikonaReview(input: unknown) {
    const query = eikonaReviewQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' as const }
    const context = this.expectedContext === undefined ? undefined : { ...this.expectedContext }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const adapter = directory?.selected('eikona')
    if (!context || !directory || !adapter?.readEikonaReview) return { status: 'unavailable' as const }
    const generation = directory.generation
    try {
      const value = await adapter.readEikonaReview(query.data, context)
      const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (!latest || !sameContext(context, latest) || this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) !== directory
        || generation !== directory.generation || adapter !== directory.selected('eikona')) return { status: 'permission_denied' as const }
      const parsed = eikonaReviewResultSchema.safeParse(value)
      if (!parsed.success || (parsed.data.status === 'ready' && parsed.data.runId !== query.data.runId)) return { status: 'needs_contract' as const }
      return parsed.data
    } catch { return { status: 'unconfirmed' as const } }
  }
  @Remote('selectEikonaCandidate')
  async selectEikonaCandidate(input: unknown) {
    const query = eikonaSelectionQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' as const }
    const context = this.expectedContext === undefined ? undefined : { ...this.expectedContext }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const adapter = directory?.selected('eikona')
    if (!context || !directory || !adapter?.selectEikonaCandidate) return { status: 'unavailable' as const }
    const generation = directory.generation
    try {
      const value = await adapter.selectEikonaCandidate(query.data, context)
      const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (!latest || !sameContext(context, latest) || this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) !== directory
        || generation !== directory.generation || adapter !== directory.selected('eikona')) return { status: 'permission_denied' as const }
      const parsed = eikonaSelectionResultSchema.safeParse(value)
      if (!parsed.success) return { status: 'needs_contract' as const }
      if (parsed.data.status === 'selected' && (!query.data.selection || parsed.data.selection.artifactRef !== query.data.selection.artifactRef
        || parsed.data.selection.contentDigest !== query.data.selection.contentDigest)) return { status: 'needs_contract' as const }
      if (parsed.data.status === 'cleared' && query.data.selection !== null) return { status: 'needs_contract' as const }
      return parsed.data
    } catch { return { status: 'unconfirmed' as const } }
  }
  @Remote('listEikonaBatchInputs')
  async listEikonaBatchInputs(input: unknown) {
    const query = eikonaBatchPageQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' as const }
    const context = this.expectedContext === undefined ? undefined : { ...this.expectedContext }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const adapter = directory?.selected('eikona')
    if (!context || !directory || !adapter?.listEikonaBatchInputs) return { status: 'unavailable' as const }
    const generation = directory.generation
    try {
      const value = await adapter.listEikonaBatchInputs(query.data, context)
      const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (!latest || !sameContext(context, latest) || this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) !== directory
        || generation !== directory.generation || adapter !== directory.selected('eikona')) return { status: 'unconfirmed' as const }
      const parsed = eikonaBatchPageResultSchema.safeParse(value)
      if (!parsed.success || !(parsed.data.status !== 'ready' || (parsed.data.items.length <= query.data.limit && (parsed.data.nextCursor === undefined || parsed.data.nextCursor !== query.data.cursor)))) return { status: 'unconfirmed' as const }
      return parsed.data
    } catch { return { status: 'unconfirmed' as const } }
  }

  @Remote('readEikonaBatchMembers')
  async readEikonaBatchMembers(input: unknown) {
    const query = eikonaBatchMembersQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' as const }
    const context = this.expectedContext === undefined ? undefined : { ...this.expectedContext }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const adapter = directory?.selected('eikona')
    if (!context || !directory || !adapter?.readEikonaBatchMembers) return { status: 'unavailable' as const }
    const generation = directory.generation
    try {
      const value = await adapter.readEikonaBatchMembers(query.data, context)
      const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (!latest || !sameContext(context, latest) || this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) !== directory
        || generation !== directory.generation || adapter !== directory.selected('eikona')) return { status: 'unconfirmed' as const }
      const parsed = eikonaBatchMembersResultSchema.safeParse(value)
      if (!parsed.success || !matchesEikonaBatchMembers(parsed.data, query.data)) return { status: 'unconfirmed' as const }
      return parsed.data
    } catch { return { status: 'unconfirmed' as const } }
  }

  @Remote('readEikonaBatchPlan')
  async readEikonaBatchPlan(input: unknown) {
    const query = eikonaBatchInputQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' as const }
    const context = this.expectedContext === undefined ? undefined : { ...this.expectedContext }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const adapter = directory?.selected('eikona')
    if (!context || !directory || !adapter?.readEikonaBatchPlan) return { status: 'unavailable' as const }
    const generation = directory.generation
    try {
      const value = await adapter.readEikonaBatchPlan(query.data, context)
      const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (!latest || !sameContext(context, latest) || this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) !== directory
        || generation !== directory.generation || adapter !== directory.selected('eikona')) return { status: 'unconfirmed' as const }
      const parsed = eikonaBatchPlanResultSchema.safeParse(value)
      if (!parsed.success || !(parsed.data.status !== 'ready' || (parsed.data.batchRef === query.data.batchRef && parsed.data.digest === query.data.digest))) return { status: 'unconfirmed' as const }
      return parsed.data
    } catch { return { status: 'unconfirmed' as const } }
  }

  @Remote('readEikonaBatchInput')
  async readEikonaBatchInput(input: unknown) {
    const query = eikonaBatchInputQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' as const }
    const context = this.expectedContext === undefined ? undefined : { ...this.expectedContext }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const adapter = directory?.selected('eikona')
    if (!context || !directory || !adapter?.readEikonaBatchInput) return { status: 'unavailable' as const }
    const generation = directory.generation
    try {
      const value = await adapter.readEikonaBatchInput(query.data, context)
      const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (!latest || !sameContext(context, latest) || this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) !== directory
        || generation !== directory.generation || adapter !== directory.selected('eikona')) return { status: 'unconfirmed' as const }
      const parsed = eikonaBatchInputResultSchema.safeParse(value)
      if (!parsed.success || !(parsed.data.status !== 'ready' || (parsed.data.batchRef === query.data.batchRef && parsed.data.digest === query.data.digest))) return { status: 'unconfirmed' as const }
      return parsed.data
    } catch { return { status: 'unconfirmed' as const } }
  }

  @Remote('readEikonaApprovalStatus')
  async readEikonaApprovalStatus(input: unknown) {
    const query = eikonaStatusInputSchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' as const }
    const context = this.expectedContext === undefined ? undefined : { ...this.expectedContext }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const adapter = directory?.selected('eikona')
    if (!context || !directory || !adapter?.readEikonaApprovalStatus) return { status: 'unavailable' as const }
    const generation = directory.generation
    try {
      const value = await adapter.readEikonaApprovalStatus(query.data, context)
      const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (!latest || !sameContext(context, latest) || this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) !== directory
        || generation !== directory.generation || adapter !== directory.selected('eikona')) return { status: 'unconfirmed' as const }
      const parsed = eikonaStatusResultSchema.safeParse(value)
      if (!parsed.success || !matchesEikonaStatus(query.data, parsed.data)) return { status: 'unconfirmed' as const }
      return parsed.data
    } catch { return { status: 'unconfirmed' as const } }
  }

  @Remote('revokeEikonaPreparationApproval')
  async revokeEikonaPreparationApproval(input: unknown) {
    const query = eikonaRevokeInputSchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' as const }
    const context = this.expectedContext === undefined ? undefined : { ...this.expectedContext }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const adapter = directory?.selected('eikona')
    if (!context || !directory || !adapter?.revokeEikonaPreparationApproval) return { status: 'unavailable' as const }
    const generation = directory.generation
    try {
      const value = await adapter.revokeEikonaPreparationApproval(query.data, context)
      const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (!latest || !sameContext(context, latest) || this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) !== directory
        || generation !== directory.generation || adapter !== directory.selected('eikona')) return { status: 'unconfirmed' as const }
      const parsed = eikonaRevokeResultSchema.safeParse(value)
      if (!parsed.success || !matchesEikonaRevoke(query.data, parsed.data)) return { status: 'unconfirmed' as const }
      return parsed.data
    } catch { return { status: 'unconfirmed' as const } }
  }

  @Remote('approveEikonaPreparation')
  async approveEikonaPreparation(input: unknown) {
    const query = eikonaApprovalInputSchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' as const }
    const context = this.expectedContext === undefined ? undefined : { ...this.expectedContext }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const adapter = directory?.selected('eikona')
    if (!context || !directory || !adapter?.approveEikonaPreparation) return { status: 'unavailable' as const }
    const generation = directory.generation
    try {
      const value = await adapter.approveEikonaPreparation(query.data, context)
      const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (!latest || !sameContext(context, latest) || this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) !== directory
        || generation !== directory.generation || adapter !== directory.selected('eikona')) return { status: 'unconfirmed' as const }
      const parsed = eikonaApprovalResultSchema.safeParse(value)
      if (!parsed.success || !matchesEikonaApproval(query.data, parsed.data)) return { status: 'unconfirmed' as const }
      return parsed.data
    } catch { return { status: 'unconfirmed' as const } }
  }

  @Remote('prepareEikonaGeneration')
  async prepareEikonaGeneration(input: unknown) {
    const query = eikonaPreparationInputSchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' as const }
    const context = this.expectedContext === undefined ? undefined : { ...this.expectedContext }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const adapter = directory?.selected('eikona')
    if (!context || !directory || !adapter?.prepareEikonaGeneration) return { status: 'unavailable' as const }
    const generation = directory.generation
    try {
      const value = await adapter.prepareEikonaGeneration(query.data, context)
      const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (!latest || !sameContext(context, latest) || this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) !== directory
        || generation !== directory.generation || adapter !== directory.selected('eikona')) return { status: 'permission_denied' as const }
      const parsed = eikonaPreparationResultSchema.safeParse(value)
      if (!parsed.success || !matchesEikonaPreparationInput(query.data, parsed.data)) return { status: 'needs_contract' as const }
      return parsed.data
    } catch { return { status: 'unconfirmed' as const } }
  }

  @Remote('readEikonaAssetPage')
  async readEikonaAssetPage(input: unknown) {
    const query = eikonaAssetQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' as const }
    const context = this.expectedContext === undefined ? undefined : { ...this.expectedContext }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const adapter = directory?.selected('eikona')
    if (!context || !directory || !adapter?.readEikonaAssetPage) return { status: 'unavailable' as const }
    const generation = directory.generation
    try {
      const value = await adapter.readEikonaAssetPage({ limit: query.data.limit, ...(query.data.cursor === undefined ? {} : { cursor: query.data.cursor }) }, context)
      const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (!latest || !sameContext(context, latest) || this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) !== directory
        || generation !== directory.generation || adapter !== directory.selected('eikona')) return { status: 'permission_denied' as const }
      const parsed = eikonaAssetPageSchema.safeParse(value)
      if (!parsed.success || (parsed.data.status === 'ready' && (parsed.data.items.length > query.data.limit
        || new Set(parsed.data.items.map(item => item.ref)).size !== parsed.data.items.length))) return { status: 'unconfirmed' as const }
      return parsed.data
    } catch { return { status: 'unconfirmed' as const } }
  }

  @Remote('readCandidatePage')
  async readCandidatePage(input: unknown) {
    const query = creatorCandidateQuerySchema.safeParse(input)
    const failure = { schemaVersion: 'creator.candidate-page.v1alpha1' as const, status: 'unavailable' as const }
    if (!query.success || this.expectedContext === undefined) return { ...failure, status: 'invalid_input' as const }
    const context = { ...this.expectedContext }
    const owner = query.data.artifact.owner as CreatorStudioOwner
    if (!CREATOR_STUDIO_OWNERS.includes(owner)) return failure
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    const adapter = directory?.selected(owner)
    if (!directory || !adapter?.readCandidatePage) return failure
    const generation = directory.generation
    try {
      const page = creatorCandidatePageSchema.safeParse(await adapter.readCandidatePage(query.data, context))
      const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (!latest || !sameContext(context, latest) || this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) !== directory
        || directory.generation !== generation || directory.selected(owner) !== adapter) return { ...failure, status: 'permission_denied' as const }
      if (!page.success) return { ...failure, status: 'unconfirmed' as const }
      if (page.data.status === 'ready' && (page.data.candidates.length > query.data.limit
        || page.data.artifact.ref !== query.data.artifact.ref || page.data.artifact.version !== query.data.artifact.version
        || page.data.artifact.owner !== owner)) return { ...failure, status: 'unconfirmed' as const }
      return page.data
    } catch { return { ...failure, status: 'unconfirmed' as const } }
  }

  /** Explicit ephemeral editor-body read; never composed into a snapshot. */
  @Remote('readArtifactContent')
  async readArtifactContent(input: unknown) {
    const artifact = ArtifactRefSchema.safeParse(input)
    if (!artifact.success || this.expectedContext === undefined) return null
    const context = { ...this.expectedContext }
    const owner = artifact.data.owner as CreatorStudioOwner
    if (!CREATOR_STUDIO_OWNERS.includes(owner)) return null
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    if (directory === undefined) return null
    const generation = directory.generation
    const adapter = directory.selected(owner)
    try {
      const content = validateCreatorArtifactContent(await directory.readArtifactContent(owner, artifact.data, context))
      const latest = validateCreatorStudioContext(this.ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
      if (latest === undefined || !sameContext(context, latest) || directory !== this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY)
        || generation !== directory.generation || adapter !== directory.selected(owner)) return null
      return content?.artifact.owner === owner && content.artifact.ref === artifact.data.ref && content.artifact.version === artifact.data.version ? content : null
    } catch {
      return null
    }
  }

  /** Same-process attachment resolver only: deliberately not a Remote. */
  async readArtifactImage(input: unknown, signal: AbortSignal) {
    signal.throwIfAborted()
    const context = this.expectedContext
    const artifact = ArtifactRefSchema.safeParse(input)
    if (!artifact.success || context === undefined) return null
    const owner = artifact.data.owner as CreatorStudioOwner
    if (!CREATOR_STUDIO_OWNERS.includes(owner)) return null
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    if (directory === undefined) return null
    const generation = directory.generation
    try {
      const image = validateCreatorArtifactImage(await directory.readArtifactImage(owner, artifact.data, context, signal))
      signal.throwIfAborted()
      const latest = this.expectedContext
      if (!latest || !sameContext(context, latest) || directory !== this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) || generation !== directory.generation) return null
      return image?.artifact.owner === owner && image.artifact.ref === artifact.data.ref && image.artifact.version === artifact.data.version ? image : null
    } catch {
      signal.throwIfAborted()
      return null
    }
  }

  private readOperations(): { operations: CreatorOperationsProjectionV1; generationRuns: CreatorGenerationRunV1[]; approvals: CreatorApprovalV1[] } {
    const service = this.ctx.get('ordoAgentOps') as CreatorOperationsService | undefined
    if (service === undefined || typeof service.snapshot !== 'function') {
      return { operations: { status: 'needs_contract', freshness: 'offline', reasonCode: 'owner_read_contract_unavailable', safeMessage: 'Ordo owner read projection is not mounted.' }, generationRuns: [], approvals: [] }
    }
    let source: ReturnType<typeof validateCreatorOperationsSourceSnapshot>
    try { source = validateCreatorOperationsSourceSnapshot(service.snapshot()) } catch { /* converted below */ }
    if (source === undefined) return { operations: { status: 'contract_mismatch', freshness: 'stale', reasonCode: 'contract_mismatch', safeMessage: 'Ordo owner projection did not match the Creator Studio contract.' }, generationRuns: [], approvals: [] }
    if (source.context !== undefined && this.expectedContext !== undefined && !operationsContextMatches(this.expectedContext, source.context)) {
      return { operations: { status: 'contract_mismatch', freshness: 'stale', reasonCode: 'context_mismatch', safeMessage: 'Ordo owner projection context changed; reconcile is required.' }, generationRuns: [], approvals: [] }
    }
    const readable = source.state === 'ready' || source.state === 'stale'
    const freshness = source.freshness === 'fresh' ? 'fresh' : 'stale'
    const generationRuns: CreatorGenerationRunV1[] = readable && source.run !== undefined ? [{
      ref: source.run.runRef,
      source: 'ordo',
      title: source.run.safeTitle,
      state: source.run.state,
      taskCount: source.run.taskCount,
      completedTaskCount: source.run.completedTaskCount,
      attentionCount: source.run.attentionCount,
      freshness,
    }] : []
    const approvals: CreatorApprovalV1[] = readable ? (source.actions ?? []).filter(action => action.actionType === 'ordo.approval.decide').map(action => ({
      ref: action.decisionRef,
      source: 'ordo',
      targetRef: action.targetRef,
      targetVersion: String(action.targetVersion),
      ownerRef: action.ownerRef,
      title: action.safeEffect,
      status: source.freshness === 'fresh' ? 'pending' : 'stale',
      expiresAt: action.expiresAt,
      previewDigest: action.previewDigest,
    })) : []
    return {
      operations: { status: source.state, freshness: source.freshness, reasonCode: source.reasonCode, safeMessage: source.safeMessage },
      generationRuns,
      approvals,
    }
  }
}

export default CreatorStudioGateway
