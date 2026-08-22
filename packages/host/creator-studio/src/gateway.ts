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
  type CreatorOwnerProjectionV1,
  type CreatorOwnerSnapshotV1,
  type CreatorStudioContextV1,
  type CreatorStudioOwner,
  type CreatorStudioSnapshotV1,
} from './types.ts'
import {
  validateCreatorActionReceipt,
  validateCreatorMediaAccess,
  validateCreatorOwnerSnapshot,
  validateCreatorStudioContext,
  validateCreatorStudioSnapshot,
} from './validation.ts'

export const CREATOR_STUDIO_EXPECTED_CONTEXT = 'creatorStudioExpectedContext'
export const CREATOR_STUDIO_OWNER_DIRECTORY = 'creatorStudioOwnerDirectory'

function sameContext(left: CreatorStudioContextV1, right: CreatorStudioContextV1): boolean {
  return left.tenantRef === right.tenantRef
    && left.workspaceRef === right.workspaceRef
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
}

export default CreatorStudioGateway
