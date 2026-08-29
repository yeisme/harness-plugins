import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import {
  ArtifactRefSchema,
  PANE_ACTION_REQUEST_SCHEMA,
  PaneActionReceiptSchema,
  PaneActionRequestSchema,
  type PaneActionDescriptorV1,
  type PaneActionFieldDescriptorV1,
  type PaneActionReceiptV1,
  type PaneActionRequestV1,
  type PaneActionValueV1,
} from '@yeisme/dsh-pane-protocol'
import { CreatorStudioOwnerDirectory } from './directory.ts'
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
  validateCreatorOwnerAssetList,
  validateCreatorMediaAccess,
  validateCreatorOperationsDecisionOutcome,
  validateCreatorOperationsSourceSnapshot,
  validateCreatorOwnerSnapshot,
  validateCreatorStudioContext,
  validateCreatorStudioSnapshot,
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

function gatewayReceipt(request: Partial<PaneActionRequestV1>, status: PaneActionReceiptV1['status'], summary: string, reconcileReason?: string): PaneActionReceiptV1 {
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
  if (Object.keys(request.values).some(key => !fields.has(key))) return false
  return descriptor.fields.every(field => fieldValueValid(field, request.values[field.key]))
}

/** Safe Remote shared by all Creator Studio views. It owns no domain canonical state. */
export class CreatorStudioGateway extends TypertRemoteService {
  private readonly expectedContext: CreatorStudioContextV1 | undefined
  private snapshotVersion = 0

  constructor(ctx: Context) {
    super(ctx, 'creatorStudio')
    this.expectedContext = validateCreatorStudioContext(ctx.get(CREATOR_STUDIO_EXPECTED_CONTEXT))
  }

  @Remote('snapshot')
  async snapshot(): Promise<CreatorStudioSnapshotV1> {
    const now = new Date().toISOString()
    if (this.expectedContext === undefined) {
      return {
        schemaVersion: 'creator.studio.snapshot.v1alpha1',
        snapshotRef: 'creator:studio:context-unavailable',
        snapshotVersion: 0,
        generatedAt: now,
        status: 'contract_mismatch',
        freshness: 'unknown',
        reasonCode: 'context_unavailable',
        safeMessage: 'Creator Studio is waiting for a frozen tenant and workspace context.',
        owners: CREATOR_STUDIO_OWNERS.map(owner => fallbackOwner(owner, 'contract_mismatch', 'Owner context is unavailable.')),
        reviews: [],
        jobs: [],
      }
    }
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    if (directory === undefined) {
      return {
        schemaVersion: 'creator.studio.snapshot.v1alpha1',
        snapshotRef: `creator:studio:${this.expectedContext.runtimeGeneration}:directory-unavailable`,
        snapshotVersion: 0,
        generatedAt: now,
        status: 'offline',
        freshness: 'unknown',
        reasonCode: 'owner_directory_unavailable',
        safeMessage: 'Creator Studio owner adapters are not mounted.',
        context: this.expectedContext,
        owners: CREATOR_STUDIO_OWNERS.map(owner => fallbackOwner(owner, 'offline', 'Owner adapter is not mounted.')),
        reviews: [],
        jobs: [],
      }
    }

    const owners = await Promise.all(CREATOR_STUDIO_OWNERS.map(async owner => {
      const adapter = directory.selected(owner)
      if (adapter === undefined) return fallbackOwner(owner, 'offline', 'Owner adapter is not mounted.')
      try {
        const snapshot = validateCreatorOwnerSnapshot(await adapter.snapshot(this.expectedContext!))
        if (snapshot === undefined || snapshot.owner !== owner || snapshot.transport !== adapter.transport) {
          return fallbackOwner(owner, 'contract_mismatch', 'Owner projection did not match the Creator Studio contract.')
        }
        if (!sameContext(this.expectedContext!, snapshot.context)) {
          return fallbackOwner(owner, 'contract_mismatch', 'Owner projection context changed; reconcile is required.')
        }
        return asProjection(snapshot)
      } catch {
        return fallbackOwner(owner, 'offline', 'Owner projection is unavailable.')
      }
    }))
    const aggregate = overallStatus(owners)
    const scaena = owners.find(owner => owner.owner === 'scaena')
    const operations = this.readOperations()
    const snapshot: CreatorStudioSnapshotV1 = {
      schemaVersion: 'creator.studio.snapshot.v1alpha1',
      snapshotRef: `creator:studio:${this.expectedContext.runtimeGeneration}:${directory.generation}`,
      snapshotVersion: ++this.snapshotVersion,
      generatedAt: now,
      ...aggregate,
      context: this.expectedContext,
      owners,
      ...(scaena?.production === undefined ? {} : { production: scaena.production }),
      reviews: scaena?.reviews ?? [],
      jobs: scaena?.jobs ?? [],
      operations: operations.operations,
      generationRuns: operations.generationRuns,
      approvals: operations.approvals,
    }
    return validateCreatorStudioSnapshot(snapshot) ?? {
      schemaVersion: snapshot.schemaVersion,
      snapshotRef: snapshot.snapshotRef,
      snapshotVersion: snapshot.snapshotVersion,
      generatedAt: snapshot.generatedAt,
      status: 'contract_mismatch',
      freshness: 'unknown',
      reasonCode: 'partial_owner_projection',
      safeMessage: 'Creator Studio could not validate the composed owner projection.',
      context: this.expectedContext,
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

  @Remote('dispatch')
  async dispatch(input: unknown): Promise<PaneActionReceiptV1> {
    const parsed = PaneActionRequestSchema.safeParse(input)
    if (!parsed.success) return gatewayReceipt({}, 'reconcile_required', 'The action request did not match the Creator Studio contract.', 'request_contract_mismatch')
    const request = parsed.data
    if (this.expectedContext === undefined || !sameContext(this.expectedContext, request.context as CreatorStudioContextV1)) {
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
    try { snapshot = validateCreatorOwnerSnapshot(await adapter.snapshot(this.expectedContext)) } catch { /* converted below */ }
    if (snapshot === undefined || snapshot.status !== 'ready' || snapshot.freshness !== 'fresh' || !sameContext(this.expectedContext, snapshot.context)) {
      return gatewayReceipt(request, 'reconcile_required', 'The owner action snapshot is not fresh; reconcile before dispatch.', 'owner_snapshot_not_fresh')
    }
    const descriptor = snapshot.actions.find(action => action.descriptorRef === request.descriptorRef)
    if (descriptor === undefined || !requestMatchesDescriptor(request, descriptor)) {
      return gatewayReceipt(request, 'reconcile_required', 'The owner action preview changed; request a new preview.', 'descriptor_changed')
    }
    if (Date.parse(descriptor.expiresAt) <= Date.now()) {
      return gatewayReceipt(request, 'reconcile_required', 'The owner action preview expired; request a new preview.', 'descriptor_expired')
    }
    try {
      const receipt = validateCreatorActionReceipt(await adapter.dispatch({ ...request, schema: PANE_ACTION_REQUEST_SCHEMA }, this.expectedContext))
      return receipt ?? gatewayReceipt(request, 'unknown', 'The owner returned no verifiable action receipt.', 'settlement_unknown')
    } catch {
      return gatewayReceipt(request, 'unknown', 'The owner action transport or settlement is uncertain.', 'settlement_unknown')
    }
  }

  @Remote('resolveArtifact')
  async resolveArtifact(input: unknown) {
    const artifact = ArtifactRefSchema.safeParse(input)
    if (!artifact.success || this.expectedContext === undefined) return null
    const owner = artifact.data.owner as CreatorStudioOwner
    if (!CREATOR_STUDIO_OWNERS.includes(owner)) return null
    const directory = this.ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
    if (directory === undefined) return null
    try {
      return validateCreatorMediaAccess(await directory.resolveArtifact(owner, artifact.data, this.expectedContext)) ?? null
    } catch {
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
