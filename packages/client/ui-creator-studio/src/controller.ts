import { scaenaTableQuerySchema, scaenaTableResultSchema, type ScaenaTableQuery, type ScaenaTableResult } from '@yeisme/dsh-creator-studio-host/contracts'
import { scaenaPackageQuerySchema, scaenaPackageResultSchema, type ScaenaPackageQuery, type ScaenaPackageResult } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaBatchMembersQuerySchema, eikonaBatchMembersResultSchema, matchesEikonaBatchMembers, type EikonaBatchMembersQuery, type EikonaBatchMembersResult } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaBatchPlanResultSchema, type EikonaBatchPlanResult } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaBatchPageQuerySchema, eikonaBatchPageResultSchema, type EikonaBatchPageQuery, type EikonaBatchPageResult } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaBatchInputQuerySchema, eikonaBatchInputResultSchema, type EikonaBatchInputQuery, type EikonaBatchInputResult } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaDraftQuerySchema, eikonaDraftSaveSchema, eikonaDraftReconcileSchema, eikonaDraftReadResultSchema, eikonaDraftSaveResultSchema, type EikonaDraftQuery, type EikonaDraftSave, type EikonaDraftReconcile, type EikonaDraftReadResult, type EikonaDraftSaveResult } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaStatusInputSchema, eikonaStatusResultSchema, matchesEikonaStatus, type EikonaStatusInput, type EikonaStatusResult } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaRevokeInputSchema, eikonaRevokeResultSchema, matchesEikonaRevoke, type EikonaRevokeInput, type EikonaRevokeResult } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaApprovalInputSchema, eikonaApprovalResultSchema, matchesEikonaApproval, type EikonaApprovalInput, type EikonaApprovalResult } from '@yeisme/dsh-creator-studio-host/contracts'
import { matchesEikonaPreparationInput, eikonaPreparationInputSchema, eikonaPreparationResultSchema, type EikonaPreparationInput, type EikonaPreparationResult } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaImageQuerySchema, eikonaImageResultSchema, type EikonaImageQuery, type EikonaImageResult } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaAssetQuerySchema, eikonaAssetPageSchema, type EikonaAssetPage } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaReviewQuerySchema, eikonaReviewResultSchema, type EikonaReviewResult } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaSelectionQuerySchema, eikonaSelectionResultSchema, type EikonaSelectionQuery, type EikonaSelectionResult } from '@yeisme/dsh-creator-studio-host/contracts'
import { editorRecoverySaveQuerySchema, editorRecoverySavedSchema, type EditorRecoverySaveQueryV1, type EditorRecoverySavedV1, editorRecoveryQuerySchema, editorRecoverySummarySchema, editorRecoveryPageSchema, editorRecoveryReadSchema, type EditorRecoveryPageV1, type EditorRecoveryReadV1 } from '@yeisme/dsh-creator-studio-host/contracts'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import {
  PANE_ACTION_REQUEST_SCHEMA,
  PaneActionReceiptSchema,
  PaneActionRequestSchema,
  encodePaneActionValues,
  PaneActionReconcileRequestSchema,
  type ArtifactRefV1,
  type PaneActionDescriptorV1,
  type PaneActionReceiptV1,
  type PaneActionValueV1,
  type PaneActionReconcileRequestV1,
} from '@yeisme/dsh-pane-protocol'
import {
  validateCreatorAssetPage,
  validateCreatorArtifactContent,
  validateCreatorAssetQuery,
  validateCreatorMediaAccess,
  validateCreatorStudioSnapshot,
  validateCreatorOwnerViewSnapshot,
  validateSonoraTranscriptionCatalog,
  type SonoraTranscriptionCatalog,
  type CreatorAssetQueryV1,
  type CreatorAssetV1,
  type CreatorMediaAccessV1,
  type CreatorArtifactContentV1,
  type CreatorStudioOwner,
  type CreatorStudioSnapshotV1,
  type CreatorStudioContextV1,
} from '@yeisme/dsh-creator-studio-host/contracts'
import { auctraStudioAcceptsResponse, auctraStudioScopeKey } from './auctra-studio-scope.ts'
import { creatorOperationRecoveryPageSchema, type CreatorOperationRecoveryPageV1 } from '@yeisme/dsh-creator-studio-host/contracts'
import { creatorCandidatePageSchema, creatorCandidateQuerySchema, type CreatorCandidateQueryV1, type CreatorCandidatePageV1 } from '@yeisme/dsh-creator-studio-host/contracts'

export interface CreatorStudioRemote {
  readScaenaTable?(input: ScaenaTableQuery): Promise<RemoteResult<ScaenaTableResult>>
  selectScaenaPackage?(input: ScaenaPackageQuery): Promise<RemoteResult<ScaenaPackageResult>>
  readEikonaCandidateImage?(input: EikonaImageQuery): Promise<RemoteResult<EikonaImageResult>>
  readEikonaDraft?(input: EikonaDraftQuery): Promise<RemoteResult<EikonaDraftReadResult>>
  saveEikonaDraft?(input: EikonaDraftSave): Promise<RemoteResult<EikonaDraftSaveResult>>
  reconcileEikonaDraft?(input: EikonaDraftReconcile): Promise<RemoteResult<EikonaDraftSaveResult>>
  listEikonaBatchInputs?(input: EikonaBatchPageQuery): Promise<RemoteResult<EikonaBatchPageResult>>
  readEikonaBatchMembers?(input: EikonaBatchMembersQuery): Promise<RemoteResult<EikonaBatchMembersResult>>
  readEikonaBatchPlan?(input: EikonaBatchInputQuery): Promise<RemoteResult<EikonaBatchPlanResult>>
  readEikonaBatchInput?(input: EikonaBatchInputQuery): Promise<RemoteResult<EikonaBatchInputResult>>
  readEikonaApprovalStatus?(input: EikonaStatusInput): Promise<RemoteResult<EikonaStatusResult>>
  revokeEikonaPreparationApproval?(input: EikonaRevokeInput): Promise<RemoteResult<EikonaRevokeResult>>
  approveEikonaPreparation?(input: EikonaApprovalInput): Promise<RemoteResult<EikonaApprovalResult>>
  prepareEikonaGeneration?(input: EikonaPreparationInput): Promise<RemoteResult<EikonaPreparationResult>>
  readEikonaAssetPage?(input: { cursor?: string; limit?: number }): Promise<RemoteResult<EikonaAssetPage>>
  readEikonaReview?(input: { runId: string }): Promise<RemoteResult<EikonaReviewResult>>
  selectEikonaCandidate?(input: EikonaSelectionQuery): Promise<RemoteResult<EikonaSelectionResult>>
  saveAuctraRecoveryDraft?(query: EditorRecoverySaveQueryV1): Promise<RemoteResult<unknown>>
  listAuctraRecoveryDrafts?(input?: { readonly artifact?: ArtifactRefV1; readonly unitRef?: string; readonly cursor?: string; readonly limit?: number }): Promise<RemoteResult<unknown>>
  readAuctraRecoveryDraft?(claim: unknown): Promise<RemoteResult<unknown>>
  listOperationRecoveries?(): Promise<RemoteResult<CreatorOperationRecoveryPageV1>>
  readCandidatePage?(query: CreatorCandidateQueryV1): Promise<RemoteResult<CreatorCandidatePageV1>>
  snapshot(): Promise<RemoteResult<CreatorStudioSnapshotV1>>
  snapshotOwner?(owner: CreatorStudioOwner): Promise<RemoteResult<CreatorStudioSnapshotV1>>
  dispatch(request: unknown): Promise<RemoteResult<PaneActionReceiptV1>>
  reconcile?(request: PaneActionReconcileRequestV1): Promise<RemoteResult<PaneActionReceiptV1>>
  recallOperationIdentity?(query: { readonly owner: string; readonly actionId: string; readonly expectedTargetRef: string }): Promise<RemoteResult<PaneActionReconcileRequestV1 | null>>
  resolveArtifact(artifact: ArtifactRefV1): Promise<RemoteResult<CreatorMediaAccessV1 | null>>
  readArtifactContent?(artifact: ArtifactRefV1): Promise<RemoteResult<CreatorArtifactContentV1 | null>>
  readTranscriptionCatalog?(context: CreatorStudioContextV1): Promise<RemoteResult<SonoraTranscriptionCatalog | null>>
  assets?(query: CreatorAssetQueryV1): Promise<RemoteResult<unknown>>
  decideApproval?(input: { readonly decisionRef: string }): Promise<RemoteResult<PaneActionReceiptV1>>
}

export type CreatorStudioReadPhase = 'cold' | 'loading' | 'ready' | 'error'

export interface CreatorStudioViewState {
  readonly phase: CreatorStudioReadPhase
  readonly snapshot: CreatorStudioSnapshotV1 | null
  readonly errorCode: string | null
  readonly pendingDescriptorRef: string | null
  readonly pendingApprovalRef: string | null
  readonly lastReceipt: PaneActionReceiptV1 | null
  readonly assetPhase: CreatorStudioReadPhase
  readonly assetQuery: CreatorAssetQueryV1
  readonly assetItems: readonly CreatorAssetV1[]
  readonly assetNextCursor: string | null
  readonly assetStatus: string | null
  readonly assetMessage: string | null
  readonly assetUnavailableOwners: readonly CreatorStudioOwner[]
  readonly assetErrorCode: string | null
}

const INITIAL: CreatorStudioViewState = {
  phase: 'cold',
  snapshot: null,
  errorCode: null,
  pendingDescriptorRef: null,
  pendingApprovalRef: null,
  lastReceipt: null,
  assetPhase: 'cold',
  assetQuery: { scope: 'current_project' },
  assetItems: [],
  assetNextCursor: null,
  assetStatus: null,
  assetMessage: null,
  assetUnavailableOwners: [],
  assetErrorCode: null,
}

function contextIdentity(snapshot: CreatorStudioSnapshotV1): string | undefined {
  const context = snapshot.context
  if (context === undefined) return undefined
  return [context.tenantRef, context.workspaceRef, context.projectRef ?? '', context.sessionRef ?? '', context.principalRef, context.revision, context.membershipRevision, context.installationRef, context.pluginDigest, context.policyRevision, context.runtimeGeneration].join('\u0000')
}

function operationContextMatches(a: PaneActionReconcileRequestV1['context'], b: CreatorStudioContextV1): boolean {
  return (['tenantRef', 'workspaceRef', 'projectRef', 'sessionRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision'] as const).every(key => a[key] === b[key])
}

function studioScopeKey(snapshot: CreatorStudioSnapshotV1 | null): string {
  const context = snapshot?.context
  const auctra = snapshot?.owners.find(owner => owner.owner === 'auctra')
  const artifactVersion = auctra?.artifactWorkspace?.artifacts[0]?.artifact.version ?? auctra?.resources[0]?.version
  return auctraStudioScopeKey({
    ...(context?.projectRef === undefined ? {} : { projectRef: context.projectRef }),
    ...(context?.sessionRef === undefined ? {} : { sessionRef: context.sessionRef }),
    ...(artifactVersion === undefined ? {} : { artifactVersion }),
  })
}

export class CreatorStudioController {
  readonly store: SnapshotStore<CreatorStudioViewState> = createSnapshotStore(INITIAL)

  private generation = 0
  private assetReadVersion = 0
  private eikonaSelectionVersion = 0
  private activeRead: Promise<void> | undefined
  private disposed = false
  private snapshotRef: string | undefined
  private snapshotVersion = -1
  private contextKey: string | undefined
  private readonly actionFlights = new Map<string, { request: PaneActionReconcileRequestV1; receipt: PaneActionReceiptV1 | null; reading?: boolean }>()

  constructor(private readonly remote: CreatorStudioRemote, private readonly owner?: CreatorStudioOwner) {}

  async selectScaenaPackage(input: ScaenaPackageQuery): Promise<ScaenaPackageResult> {
    const query = scaenaPackageQuerySchema.safeParse(input), generation = this.generation, context = this.contextKey
    if (!query.success) return { status: 'invalid_input' }
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || !context || !this.remote.selectScaenaPackage) return { status: 'unavailable' }
    try {
      const result = await this.remote.selectScaenaPackage(query.data)
      if (!this.current(generation) || context !== this.contextKey) return { status: 'permission_denied' }
      const parsed = result.ok ? scaenaPackageResultSchema.safeParse(result.value) : undefined
      if (!parsed?.success || (parsed.data.status === 'ready' && parsed.data.packageRef !== query.data.packageRef)) return { status: 'unconfirmed' }
      if (parsed.data.status === 'ready') await this.refresh()
      return parsed.data
    } catch { return { status: 'unconfirmed' } }
  }

  async readScaenaTable(input: ScaenaTableQuery): Promise<ScaenaTableResult> {
    const query = scaenaTableQuerySchema.safeParse(input), generation = this.generation, context = this.contextKey
    if (!query.success) return { status: 'invalid_input' }
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || !context || !this.remote.readScaenaTable) return { status: 'unavailable' }
    try {
      const result = await this.remote.readScaenaTable(query.data)
      if (!this.current(generation) || context !== this.contextKey) return { status: 'permission_denied' }
      const parsed = result.ok ? scaenaTableResultSchema.safeParse(result.value) : undefined
      if (!parsed?.success || (parsed.data.status === 'ready' && parsed.data.view.breakdown_ref !== query.data.breakdownRef)) return { status: 'unconfirmed' }
      if (parsed.data.status === 'ready') await this.refresh()
      return parsed.data
    } catch { return { status: 'unconfirmed' } }
  }

  hasUnresolvedAction(descriptor: PaneActionDescriptorV1): boolean {
    const scope = this.store.getSnapshot().snapshot?.context
    if (!scope || !operationContextMatches(descriptor.context, scope)) return false
    return this.actionFlights.has(JSON.stringify([scope.tenantRef, scope.workspaceRef, scope.projectRef, scope.principalRef, descriptor.owner, descriptor.actionId, descriptor.targetRef]))
  }

  refresh(): Promise<void> {
    if (this.disposed) return Promise.resolve()
    if (this.activeRead !== undefined) return this.activeRead
    const generation = this.generation
    const current = this.store.getSnapshot()
    this.store.set({ ...current, phase: 'loading', errorCode: null })
    const operation = this.read(generation).finally(() => {
      if (this.activeRead === operation) this.activeRead = undefined
    })
    this.activeRead = operation
    return operation
  }

  async dispatchAction(descriptor: PaneActionDescriptorV1, values: Readonly<Record<string, PaneActionValueV1>>): Promise<PaneActionReceiptV1> {
    const current = this.store.getSnapshot()
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || current.snapshot?.context === undefined) {
      return this.localReceipt(descriptor, 'reconcile_required', 'Creator Studio context is unavailable.', 'context_unavailable')
    }
    const scope = current.snapshot.context
    if (descriptor.context.workspaceRef !== scope.workspaceRef || descriptor.context.projectRef !== scope.projectRef) {
      return this.localReceipt(descriptor, 'reconcile_required', 'The action belongs to another project.', 'context_mismatch')
    }
    // A refreshed descriptor or session must not authorize repeating an uncertain operation.
    const actionKey = JSON.stringify([scope.tenantRef, scope.workspaceRef, scope.projectRef, scope.principalRef, descriptor.owner, descriptor.actionId, descriptor.targetRef])
    if (this.actionFlights.has(actionKey)) {
      return this.actionFlights.get(actionKey)!.receipt ?? this.localReceipt(descriptor, 'pending', 'The original action is still pending.', 'action_pending')
    }
    const request = PaneActionRequestSchema.parse({
      schema: PANE_ACTION_REQUEST_SCHEMA,
      descriptorRef: descriptor.descriptorRef,
      owner: descriptor.owner,
      actionId: descriptor.actionId,
      expectedTargetRef: descriptor.targetRef,
      expectedTargetVersion: descriptor.targetVersion,
      context: descriptor.context,
      idempotencyKey: `creator-${crypto.randomUUID()}`,
      ...encodePaneActionValues(descriptor, values),
    })
    const generation = this.generation
    const submittedContext = this.contextKey
    const submittedScope = studioScopeKey(current.snapshot)
    const flight = { request: { schema: 'pane.action-reconcile-request.v1alpha1' as const, owner: request.owner,
      actionId: request.actionId, expectedTargetRef: request.expectedTargetRef, context: request.context, idempotencyKey: request.idempotencyKey }, receipt: null as PaneActionReceiptV1 | null }
    this.actionFlights.set(actionKey, flight)
    this.store.set({ ...current, pendingDescriptorRef: descriptor.descriptorRef, errorCode: null })
    let receipt: PaneActionReceiptV1
    try {
      const recalled = this.remote.recallOperationIdentity === undefined ? undefined : await this.remote.recallOperationIdentity({ owner: descriptor.owner, actionId: descriptor.actionId, expectedTargetRef: descriptor.targetRef })
      if (!this.current(generation) || this.contextKey !== submittedContext) return this.localReceipt(descriptor, 'unknown', 'The context changed while looking up the original request.', 'generation_replaced')
      if (recalled && !recalled.ok) throw Error('original identity lookup failed')
      const original = recalled?.ok && recalled.value !== null ? PaneActionReconcileRequestSchema.safeParse(recalled.value) : undefined
      const found = original?.success && original.data.owner === descriptor.owner && original.data.actionId === descriptor.actionId && original.data.expectedTargetRef === descriptor.targetRef && operationContextMatches(original.data.context, scope)
      if (recalled?.ok && recalled.value !== null && !found) throw Error('original identity contract mismatch')
      if (found) flight.request = original.data
      const result = found
        ? { ok: true as const, value: this.localReceipt(descriptor, 'reconcile_required', 'An original request is stored. Reconcile it before another execution.', 'original_operation_pending') }
        : await this.remote.dispatch(request)
      if (!result.ok) receipt = this.localReceipt(descriptor, 'unknown', 'The owner action Remote did not settle.', result.error.code)
      else receipt = PaneActionReceiptSchema.safeParse(result.value).success
        && (result.value.owner === undefined || result.value.owner === descriptor.owner)
        && (result.value.actionId === undefined || result.value.actionId === descriptor.actionId)
        ? PaneActionReceiptSchema.parse(result.value)
        : this.localReceipt(descriptor, 'unknown', 'The owner returned an invalid action receipt.', 'receipt_contract_mismatch')
    } catch {
      receipt = this.localReceipt(descriptor, 'unknown', 'The owner action transport is uncertain.', 'settlement_unknown')
    }
    if (['unknown', 'reconcile_required', 'pending', 'partial'].includes(receipt.status)) flight.receipt = receipt
    else this.actionFlights.delete(actionKey)
    const live = this.store.getSnapshot()
    if (!this.current(generation) || this.contextKey !== submittedContext || !auctraStudioAcceptsResponse(studioScopeKey(live.snapshot), submittedScope)) {
      return this.localReceipt(descriptor, 'unknown', 'The previous Creator Studio context was replaced.', 'generation_replaced')
    }
    this.store.set({ ...live, pendingDescriptorRef: null, lastReceipt: receipt })
    if (receipt.status === 'accepted' || receipt.status === 'completed' || receipt.status === 'partial') void this.refresh()
    return receipt
  }

  async reconcileAction(descriptor: PaneActionDescriptorV1): Promise<PaneActionReceiptV1> {
    const scope = this.store.getSnapshot().snapshot?.context
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || scope === undefined) return this.localReceipt(descriptor, 'unknown', 'The current project is unavailable.', 'context_unavailable')
    const key = JSON.stringify([scope.tenantRef, scope.workspaceRef, scope.projectRef, scope.principalRef, descriptor.owner, descriptor.actionId, descriptor.targetRef])
    let flight = this.actionFlights.get(key)
    const recallGeneration = this.generation, recallContext = this.contextKey
    if (flight?.reading) return this.localReceipt(descriptor, 'pending', 'The original operation is being observed.', 'action_pending')
    if (this.remote.recallOperationIdentity !== undefined) {
      try {
        const recalled = await this.remote.recallOperationIdentity({ owner: descriptor.owner, actionId: descriptor.actionId, expectedTargetRef: descriptor.targetRef })
        if (!this.current(recallGeneration) || this.contextKey !== recallContext) return this.localReceipt(descriptor, 'unknown', 'The context changed while recalling the original request.', 'generation_replaced')
        const original = recalled.ok && recalled.value !== null ? PaneActionReconcileRequestSchema.safeParse(recalled.value) : undefined
        if (original?.success && original.data.owner === descriptor.owner && original.data.actionId === descriptor.actionId
          && original.data.expectedTargetRef === descriptor.targetRef && operationContextMatches(original.data.context, scope)) {
          flight = { request: original.data, receipt: this.localReceipt(descriptor, 'unknown', 'The original operation identity was restored from Host storage.', 'original_save_unconfirmed') }
          this.actionFlights.set(key, flight)
        }
      } catch { /* Keep looking up only through an explicit original identity. */ }
    }
    if (flight === undefined) return this.localReceipt(descriptor, 'unknown', 'No original operation identity is available.', 'operation_identity_unavailable')
    if (flight.receipt === null || flight.reading) return this.localReceipt(descriptor, 'pending', 'The original operation is being observed.', 'action_pending')
    if (this.remote.reconcile === undefined) return this.localReceipt(descriptor, 'unknown', 'The owner reconciliation route is unavailable.', 'reconcile_unavailable')
    const generation = this.generation, contextKey = this.contextKey
    const submittedScope = studioScopeKey(this.store.getSnapshot().snapshot)
    flight.reading = true
    let receipt: PaneActionReceiptV1
    try {
      const result = await this.remote.reconcile({ ...flight.request, context: scope })
      const parsed = result.ok ? PaneActionReceiptSchema.safeParse(result.value) : undefined
      receipt = parsed?.success && parsed.data.owner === descriptor.owner && parsed.data.actionId === descriptor.actionId
        ? parsed.data : this.localReceipt(descriptor, 'unknown', 'No matching original operation receipt was returned.', 'settlement_unknown')
    } catch { receipt = this.localReceipt(descriptor, 'unknown', 'The original operation is still uncertain.', 'settlement_unknown') }
    finally { flight.reading = false }
    // A rejected lookup is not proof that the original execution failed.
    if (['completed', 'accepted', 'failed'].includes(receipt.status)) this.actionFlights.delete(key)
    else { receipt = receipt.status === 'partial' ? receipt : { ...receipt, status: 'unknown' }; flight.receipt = receipt }
    if (!this.current(generation) || this.contextKey !== contextKey || !auctraStudioAcceptsResponse(studioScopeKey(this.store.getSnapshot().snapshot), submittedScope)) {
      return this.localReceipt(descriptor, 'unknown', 'The project context changed during lookup.', 'generation_replaced')
    }
    this.store.set({ ...this.store.getSnapshot(), lastReceipt: receipt })
    if (['completed', 'accepted', 'partial'].includes(receipt.status)) void this.refresh()
    return receipt
  }

  async loadAssets(input: CreatorAssetQueryV1, append = false): Promise<void> {
    if (this.disposed) return
    const query = validateCreatorAssetQuery(input)
    const current = this.store.getSnapshot()
    if (query === undefined) {
      this.store.set({ ...current, assetPhase: 'error', assetErrorCode: 'asset_query_contract_mismatch' })
      return
    }
    if (this.remote.assets === undefined) {
      this.store.set({ ...current, assetPhase: 'error', assetErrorCode: 'asset_contract_unavailable', assetMessage: 'Creator Studio asset Remote is unavailable.' })
      return
    }
    const generation = this.generation
    const readVersion = ++this.assetReadVersion
    const { cursor: _cursor, ...baseQuery } = query
    this.store.set({ ...current, assetPhase: 'loading', assetQuery: baseQuery, assetErrorCode: null })
    let result: RemoteResult<unknown>
    try { result = await this.remote.assets(query) } catch {
      if (this.current(generation) && this.assetReadVersion === readVersion) this.store.set({ ...this.store.getSnapshot(), assetPhase: 'error', assetErrorCode: 'asset_remote_failed' })
      return
    }
    if (!this.current(generation) || this.assetReadVersion !== readVersion) return
    if (!result.ok) {
      this.store.set({ ...this.store.getSnapshot(), assetPhase: 'error', assetErrorCode: result.error.code })
      return
    }
    const page = validateCreatorAssetPage(result.value)
    if (page === undefined) {
      this.store.set({ ...this.store.getSnapshot(), assetPhase: 'error', assetErrorCode: 'asset_page_contract_mismatch' })
      return
    }
    const before = this.store.getSnapshot()
    this.store.set({
      ...before,
      assetPhase: 'ready',
      assetQuery: baseQuery,
      assetItems: append ? [...before.assetItems, ...page.items] : page.items,
      assetNextCursor: page.nextCursor ?? null,
      assetStatus: page.status,
      assetMessage: page.safeMessage,
      assetUnavailableOwners: page.unavailableOwners,
      assetErrorCode: null,
    })
  }

  async decideApproval(decisionRef: string): Promise<PaneActionReceiptV1> {
    const current = this.store.getSnapshot()
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || this.remote.decideApproval === undefined) {
      return this.localApprovalReceipt(decisionRef, 'reconcile_required', 'The Ordo approval Remote is unavailable.', 'owner_unavailable')
    }
    const generation = this.generation
    this.store.set({ ...current, pendingApprovalRef: decisionRef, errorCode: null })
    let receipt: PaneActionReceiptV1
    try {
      const result = await this.remote.decideApproval({ decisionRef })
      if (!this.current(generation)) return this.localApprovalReceipt(decisionRef, 'unknown', 'The previous Creator Studio generation was replaced.', 'generation_replaced')
      receipt = result.ok && PaneActionReceiptSchema.safeParse(result.value).success
        ? PaneActionReceiptSchema.parse(result.value)
        : this.localApprovalReceipt(decisionRef, 'unknown', 'The Ordo approval settlement is uncertain.', result.ok ? 'receipt_contract_mismatch' : result.error.code)
    } catch {
      receipt = this.localApprovalReceipt(decisionRef, 'unknown', 'The Ordo approval transport is uncertain.', 'settlement_unknown')
    }
    if (this.current(generation)) {
      const next = this.store.getSnapshot()
      this.store.set({ ...next, pendingApprovalRef: null, lastReceipt: receipt })
      if (receipt.status === 'accepted' || receipt.status === 'completed') void this.refresh()
    }
    return receipt
  }

  async resolveArtifact(artifact: ArtifactRefV1): Promise<string | undefined> {
    if (this.disposed) return undefined
    try {
      const result = await this.remote.resolveArtifact(artifact)
      if (!result.ok || result.value === null) return undefined
      const access = validateCreatorMediaAccess(result.value)
      if (access === undefined || Date.parse(access.expiresAt) <= Date.now()) return undefined
      return access.url
    } catch {
      return undefined
    }
  }

  async readArtifactContent(artifact: ArtifactRefV1): Promise<CreatorArtifactContentV1 | undefined> {
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || this.remote.readArtifactContent === undefined) return undefined
    const submittedScope = studioScopeKey(this.store.getSnapshot().snapshot)
    const generation = this.generation
    try {
      const result = await this.remote.readArtifactContent(artifact)
      if (!this.current(generation) || !auctraStudioAcceptsResponse(studioScopeKey(this.store.getSnapshot().snapshot), submittedScope)) return undefined
      if (!result.ok || result.value === null) return undefined
      const content = validateCreatorArtifactContent(result.value)
      return content !== undefined && content.artifact.owner === artifact.owner && content.artifact.ref === artifact.ref && content.artifact.version === artifact.version ? content : undefined
    } catch { return undefined }
  }

  async readEikonaCandidateImage(input: EikonaImageQuery): Promise<EikonaImageResult> {
    const generation = this.generation, context = this.contextKey
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || context === undefined || !this.remote.readEikonaCandidateImage) return { status: 'unavailable' }
    const query = eikonaImageQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' }
    try {
      const result = await this.remote.readEikonaCandidateImage(query.data)
      if (!this.current(generation) || this.contextKey !== context) return { status: 'permission_denied' }
      const parsed = result.ok ? eikonaImageResultSchema.safeParse(result.value) : undefined
      if (!parsed?.success) return { status: 'unconfirmed' }
      if (parsed.data.status !== 'ready') return parsed.data
      const value = parsed.data.value
      if (value.artifactRef !== query.data.artifactRef || value.contentDigest !== query.data.contentDigest) return { status: 'unconfirmed' }
      const raw = atob(value.base64)
      if (raw.length !== value.byteLength || btoa(raw) !== value.base64) return { status: 'unconfirmed' }
      const bytes = Uint8Array.from(raw, character => character.charCodeAt(0))
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
      if (!this.current(generation) || this.contextKey !== context) return { status: 'permission_denied' }
      return digest === value.contentDigest ? parsed.data : { status: 'unconfirmed' }
    } catch { return { status: 'unconfirmed' } }
  }

  async readEikonaDraft(input: unknown): Promise<EikonaDraftReadResult> {
    const generation = this.generation, context = this.contextKey
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || context === undefined || !this.remote.readEikonaDraft) return { status: 'unavailable' }
    const query = eikonaDraftQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid' }
    const current = this.store.getSnapshot().snapshot?.context, scope = query.data.scope
    if (!current || current.tenantRef !== scope.tenantRef || current.workspaceRef !== scope.workspaceRef || current.projectRef !== scope.projectRef) return { status: 'forbidden' }
    try {
      const response = await this.remote.readEikonaDraft(query.data)
      if (!this.current(generation) || this.contextKey !== context) return { status: 'unknown' }
      const parsed = response.ok ? eikonaDraftReadResultSchema.safeParse(response.value) : undefined
      if (!parsed?.success) return { status: 'unknown' }
      if (parsed.data.status === 'ready' && (parsed.data.draft.id !== query.data.id || JSON.stringify(parsed.data.draft.scope) !== JSON.stringify(query.data.scope))) return { status: 'unknown' }
      return parsed.data
    } catch { return { status: 'unknown' } }
  }

  async saveEikonaDraft(input: unknown): Promise<EikonaDraftSaveResult> {
    const generation = this.generation, context = this.contextKey
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || context === undefined || !this.remote.saveEikonaDraft) return { status: 'unavailable' }
    const query = eikonaDraftSaveSchema.safeParse(input)
    if (!query.success) return { status: 'invalid' }
    const current = this.store.getSnapshot().snapshot?.context, scope = query.data.draft.scope
    if (!current || current.tenantRef !== scope.tenantRef || current.workspaceRef !== scope.workspaceRef || current.projectRef !== scope.projectRef) return { status: 'forbidden' }
    try {
      const response = await this.remote.saveEikonaDraft(query.data)
      if (!this.current(generation) || this.contextKey !== context) return { status: 'unknown' }
      const parsed = response.ok ? eikonaDraftSaveResultSchema.safeParse(response.value) : undefined
      if (!parsed?.success) return { status: 'unknown' }
      if (parsed.data.status === 'saved' && parsed.data.requestId !== query.data.requestId) return { status: 'unknown' }
      if (parsed.data.status === 'saved' && parsed.data.revision !== query.data.draft.revision + 1) return { status: 'unknown' }
      return parsed.data
    } catch { return { status: 'unknown' } }
  }

  async reconcileEikonaDraft(input: unknown): Promise<EikonaDraftSaveResult> {
    const generation = this.generation, context = this.contextKey
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || context === undefined || !this.remote.reconcileEikonaDraft) return { status: 'unavailable' }
    const query = eikonaDraftReconcileSchema.safeParse(input)
    if (!query.success) return { status: 'invalid' }
    const current = this.store.getSnapshot().snapshot?.context, scope = query.data.scope
    if (!current || current.tenantRef !== scope.tenantRef || current.workspaceRef !== scope.workspaceRef || current.projectRef !== scope.projectRef) return { status: 'forbidden' }
    try {
      const response = await this.remote.reconcileEikonaDraft(query.data)
      if (!this.current(generation) || this.contextKey !== context) return { status: 'unknown' }
      const parsed = response.ok ? eikonaDraftSaveResultSchema.safeParse(response.value) : undefined
      if (!parsed?.success) return { status: 'unknown' }
      if (parsed.data.status === 'saved' && parsed.data.requestId !== query.data.requestId) return { status: 'unknown' }
      return parsed.data
    } catch { return { status: 'unknown' } }
  }

  async listEikonaBatchInputs(input: unknown): Promise<EikonaBatchPageResult> {
    const generation = this.generation, context = this.contextKey
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || context === undefined || !this.remote.listEikonaBatchInputs) return { status: 'unavailable' }
    const query = eikonaBatchPageQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' }
    try {
      const result = await this.remote.listEikonaBatchInputs(query.data)
      if (!this.current(generation) || this.contextKey !== context) return { status: 'unconfirmed' }
      const page = result.ok ? eikonaBatchPageResultSchema.safeParse(result.value) : undefined
      if (!page?.success || !(page.data.status !== 'ready' || (page.data.items.length <= query.data.limit && (page.data.nextCursor === undefined || page.data.nextCursor !== query.data.cursor)))) return { status: 'unconfirmed' }
      return page.data
    } catch { return { status: 'unconfirmed' } }
  }

  async readEikonaBatchPlan(input: unknown): Promise<EikonaBatchPlanResult> {
    const generation = this.generation, context = this.contextKey
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || context === undefined || !this.remote.readEikonaBatchPlan) return { status: 'unavailable' }
    const query = eikonaBatchInputQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' }
    try {
      const result = await this.remote.readEikonaBatchPlan(query.data)
      if (!this.current(generation) || this.contextKey !== context) return { status: 'unconfirmed' }
      const page = result.ok ? eikonaBatchPlanResultSchema.safeParse(result.value) : undefined
      if (!page?.success || !(page.data.status !== 'ready' || (page.data.batchRef === query.data.batchRef && page.data.digest === query.data.digest))) return { status: 'unconfirmed' }
      return page.data
    } catch { return { status: 'unconfirmed' } }
    finally {
      // The Host may have cleared or replaced its selected plan even when the
      // response was lost. Finish any older snapshot before requesting fresh actions.
      const previous = this.activeRead
      void (async () => {
        await previous
        if (this.current(generation) && this.contextKey === context) await this.refresh()
      })()
    }
  }

  async readEikonaBatchMembers(input: unknown): Promise<EikonaBatchMembersResult> {
    const generation = this.generation, context = this.contextKey
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || context === undefined || !this.remote.readEikonaBatchMembers) return { status: 'unavailable' }
    const query = eikonaBatchMembersQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' }
    try {
      const result = await this.remote.readEikonaBatchMembers(query.data)
      if (!this.current(generation) || this.contextKey !== context) return { status: 'unconfirmed' }
      const page = result.ok ? eikonaBatchMembersResultSchema.safeParse(result.value) : undefined
      if (!page?.success || !matchesEikonaBatchMembers(page.data, query.data)) return { status: 'unconfirmed' }
      return page.data
    } catch { return { status: 'unconfirmed' } }
  }

  async readEikonaBatchInput(input: unknown): Promise<EikonaBatchInputResult> {
    const generation = this.generation, context = this.contextKey
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || context === undefined || !this.remote.readEikonaBatchInput) return { status: 'unavailable' }
    const query = eikonaBatchInputQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' }
    try {
      const result = await this.remote.readEikonaBatchInput(query.data)
      if (!this.current(generation) || this.contextKey !== context) return { status: 'unconfirmed' }
      const page = result.ok ? eikonaBatchInputResultSchema.safeParse(result.value) : undefined
      if (!page?.success || !(page.data.status !== 'ready' || (page.data.batchRef === query.data.batchRef && page.data.digest === query.data.digest))) return { status: 'unconfirmed' }
      return page.data
    } catch { return { status: 'unconfirmed' } }
  }

  async readEikonaApprovalStatus(input: unknown): Promise<EikonaStatusResult> {
    const generation = this.generation, context = this.contextKey
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || context === undefined || !this.remote.readEikonaApprovalStatus) return { status: 'unavailable' }
    const query = eikonaStatusInputSchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' }
    try {
      const result = await this.remote.readEikonaApprovalStatus(query.data)
      if (!this.current(generation) || this.contextKey !== context) return { status: 'unconfirmed' }
      const page = result.ok ? eikonaStatusResultSchema.safeParse(result.value) : undefined
      if (!page?.success || !matchesEikonaStatus(query.data, page.data)) return { status: 'unconfirmed' }
      if (page.data.status === 'observed' && (page.data.revoked || page.data.expired || page.data.consumedOperation)) void this.refresh()
      return page.data
    } catch { return { status: 'unconfirmed' } }
  }

  async revokeEikonaPreparationApproval(input: unknown): Promise<EikonaRevokeResult> {
    const generation = this.generation, context = this.contextKey
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || context === undefined || !this.remote.revokeEikonaPreparationApproval) return { status: 'unavailable' }
    const query = eikonaRevokeInputSchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' }
    try {
      const result = await this.remote.revokeEikonaPreparationApproval(query.data)
      if (!this.current(generation) || this.contextKey !== context) return { status: 'unconfirmed' }
      const page = result.ok ? eikonaRevokeResultSchema.safeParse(result.value) : undefined
      if (!page?.success || !matchesEikonaRevoke(query.data, page.data)) return { status: 'unconfirmed' }
      if (page.data.status === 'revoked') void this.refresh()
      return page.data
    } catch { return { status: 'unconfirmed' } }
  }

  async approveEikonaPreparation(input: unknown): Promise<EikonaApprovalResult> {
    const generation = this.generation, context = this.contextKey
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || context === undefined || !this.remote.approveEikonaPreparation) return { status: 'unavailable' }
    const query = eikonaApprovalInputSchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' }
    try {
      const result = await this.remote.approveEikonaPreparation(query.data)
      if (!this.current(generation) || this.contextKey !== context) return { status: 'unconfirmed' }
      const page = result.ok ? eikonaApprovalResultSchema.safeParse(result.value) : undefined
      if (!page?.success || !matchesEikonaApproval(query.data, page.data)) return { status: 'unconfirmed' }
      if (page.data.status === 'approved') void this.refresh()
      return page.data
    } catch { return { status: 'unconfirmed' } }
  }

  async prepareEikonaGeneration(input: unknown): Promise<EikonaPreparationResult> {
    const generation = this.generation, context = this.contextKey
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || context === undefined || !this.remote.prepareEikonaGeneration) return { status: 'unavailable' }
    const query = eikonaPreparationInputSchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' }
    try {
      const result = await this.remote.prepareEikonaGeneration(query.data)
      if (!this.current(generation) || this.contextKey !== context) return { status: 'permission_denied' }
      const page = result.ok ? eikonaPreparationResultSchema.safeParse(result.value) : undefined
      if (!page?.success || !matchesEikonaPreparationInput(query.data, page.data)) return { status: 'unconfirmed' }
      return page.data
    } catch { return { status: 'unconfirmed' } }
  }

  async readEikonaAssetPage(input: { cursor?: string; limit?: number } = {}): Promise<EikonaAssetPage> {
    const generation = this.generation, context = this.contextKey
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || context === undefined || !this.remote.readEikonaAssetPage) return { status: 'unavailable' }
    const query = eikonaAssetQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' }
    try {
      const result = await this.remote.readEikonaAssetPage({ limit: query.data.limit, ...(query.data.cursor === undefined ? {} : { cursor: query.data.cursor }) })
      if (!this.current(generation) || this.contextKey !== context) return { status: 'permission_denied' }
      const page = result.ok ? eikonaAssetPageSchema.safeParse(result.value) : undefined
      if (!page?.success || (page.data.status === 'ready' && (page.data.items.length > query.data.limit
        || new Set(page.data.items.map(item => item.ref)).size !== page.data.items.length))) return { status: 'unconfirmed' }
      return page.data
    } catch { return { status: 'unconfirmed' } }
  }

  async readEikonaReview(input: { runId: string }): Promise<EikonaReviewResult> {
    const generation = this.generation, context = this.contextKey
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || context === undefined || !this.remote.readEikonaReview) return { status: 'unavailable' }
    const query = eikonaReviewQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' }
    try {
      const result = await this.remote.readEikonaReview(query.data)
      if (!this.current(generation) || this.contextKey !== context) return { status: 'permission_denied' }
      const page = result.ok ? eikonaReviewResultSchema.safeParse(result.value) : undefined
      if (!page?.success || (page.data.status === 'ready' && page.data.runId !== query.data.runId)) return { status: 'unconfirmed' }
      return page.data
    } catch { return { status: 'unconfirmed' } }
  }

  async selectEikonaCandidate(input: EikonaSelectionQuery): Promise<EikonaSelectionResult> {
    const generation = this.generation, context = this.contextKey, version = ++this.eikonaSelectionVersion
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || context === undefined || !this.remote.selectEikonaCandidate) return { status: 'unavailable' }
    const query = eikonaSelectionQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' }
    try {
      const result = await this.remote.selectEikonaCandidate(query.data)
      if (!this.current(generation) || this.contextKey !== context) return { status: 'permission_denied' }
      if (version !== this.eikonaSelectionVersion) return { status: 'superseded' }
      const parsed = result.ok ? eikonaSelectionResultSchema.safeParse(result.value) : undefined
      if (!parsed?.success) return { status: 'unconfirmed' }
      if (parsed.data.status === 'selected' && (!query.data.selection || parsed.data.selection.artifactRef !== query.data.selection.artifactRef
        || parsed.data.selection.contentDigest !== query.data.selection.contentDigest)) return { status: 'unconfirmed' }
      if (parsed.data.status === 'cleared' && query.data.selection !== null) return { status: 'unconfirmed' }
      return parsed.data
    } catch { return { status: 'unconfirmed' } }
  }

  async readCandidatePage(query: CreatorCandidateQueryV1): Promise<CreatorCandidatePageV1> {
    const failure = { schemaVersion: 'creator.candidate-page.v1alpha1' as const, status: 'unavailable' as const }
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || this.contextKey === undefined || this.remote.readCandidatePage === undefined) return failure
    if (!creatorCandidateQuerySchema.safeParse(query).success) return { ...failure, status: 'invalid_input' }
    const submittedScope = studioScopeKey(this.store.getSnapshot().snapshot), generation = this.generation, context = this.contextKey
    try {
      const result = await this.remote.readCandidatePage(query)
      if (!this.current(generation) || this.contextKey !== context || !auctraStudioAcceptsResponse(studioScopeKey(this.store.getSnapshot().snapshot), submittedScope)) return { ...failure, status: 'permission_denied' }
      const page = result.ok ? creatorCandidatePageSchema.safeParse(result.value) : undefined
      if (!page?.success) return { ...failure, status: 'unconfirmed' }
      if (page.data.status === 'ready' && (page.data.candidates.length > query.limit || page.data.artifact.ref !== query.artifact.ref
        || page.data.artifact.version !== query.artifact.version || page.data.artifact.owner !== query.artifact.owner)) return { ...failure, status: 'unconfirmed' }
      return page.data
    } catch { return { ...failure, status: 'unconfirmed' } }
  }

  async listOperationRecoveries(): Promise<CreatorOperationRecoveryPageV1> {
    const unavailable = { schemaVersion: 'creator.operation-recovery-page.v1alpha1' as const, status: 'unavailable' as const }
    const scope = this.store.getSnapshot().snapshot?.context, generation = this.generation, context = this.contextKey
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || !scope || !this.remote.listOperationRecoveries) return unavailable
    try {
      const result = await this.remote.listOperationRecoveries()
      if (!this.current(generation) || this.contextKey !== context) return unavailable
      const page = result.ok ? creatorOperationRecoveryPageSchema.safeParse(result.value) : undefined
      return page?.success && (page.data.status !== 'ready' || operationContextMatches(page.data.context, scope)) ? page.data : unavailable
    } catch { return unavailable }
  }

  /** Recovery drafts are owner content: controller exposes only the typed remote result,
   * never stores body text in the DSH snapshot or operation recovery index. */
  async saveAuctraRecoveryDraft(input: EditorRecoverySaveQueryV1): Promise<EditorRecoverySavedV1> {
    const generation = this.generation, context = this.contextKey
    const query = editorRecoverySaveQuerySchema.safeParse(input)
    if (!query.success) return { status: 'invalid_input' }
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || context === undefined || !this.remote.saveAuctraRecoveryDraft) return { status: 'unavailable' }
    try {
      const response = await this.remote.saveAuctraRecoveryDraft(query.data)
      if (!this.current(generation) || this.contextKey !== context) return { status: 'unconfirmed' }
      const saved = response.ok ? editorRecoverySavedSchema.safeParse(response.value) : undefined
      if (!saved?.success) return { status: 'unconfirmed' }
      if (saved.data.status === 'ready' && (saved.data.value.draft.baseVersion !== query.data.base.contentRevision
        || saved.data.value.draft.revision !== (query.data.previous?.revision ?? 0) + 1
        || (query.data.previous !== undefined && saved.data.value.draft.ref !== query.data.previous.ref))) return { status: 'unconfirmed' }
      return saved.data
    } catch { return { status: 'unconfirmed' } }
  }

  async listAuctraRecoveryDrafts(input: { readonly artifact?: ArtifactRefV1; readonly unitRef?: string; readonly cursor?: string; readonly limit?: number } = {}): Promise<EditorRecoveryPageV1> {
    const generation = this.generation, context = this.contextKey
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || context === undefined || this.remote.listAuctraRecoveryDrafts === undefined) return { status: 'unavailable' }
    try {
      const query = editorRecoveryQuerySchema.safeParse(input)
      if (!query.success) return { status: 'invalid_input' }
      const result = await this.remote.listAuctraRecoveryDrafts({ ...(query.data.artifact === undefined ? {} : { artifact: query.data.artifact }), ...(query.data.cursor === undefined ? {} : { cursor: query.data.cursor }), ...(query.data.limit === undefined ? {} : { limit: query.data.limit }) })
      if (!this.current(generation) || this.contextKey !== context) return { status: 'permission_denied' }
      const page = result.ok ? editorRecoveryPageSchema.safeParse(result.value) : undefined
      if (!page?.success) return { status: 'unconfirmed' }
      if (page.data.status === 'ready' && (page.data.value.drafts.length > (query.data.limit ?? 50) || new Set(page.data.value.drafts.map(draft => draft.ref)).size !== page.data.value.drafts.length)) return { status: 'unconfirmed' }
      return page.data
    } catch { return { status: 'unavailable' } }
  }

  async readAuctraRecoveryDraft(claim: unknown): Promise<EditorRecoveryReadV1> {
    const generation = this.generation, context = this.contextKey
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || context === undefined || this.remote.readAuctraRecoveryDraft === undefined) return { status: 'unavailable' }
    try {
      const requested = editorRecoverySummarySchema.safeParse(claim)
      if (!requested.success) return { status: 'invalid_input' }
      const result = await this.remote.readAuctraRecoveryDraft(requested.data)
      if (!this.current(generation) || this.contextKey !== context) return { status: 'permission_denied' }
      const read = result.ok ? editorRecoveryReadSchema.safeParse(result.value) : undefined
      if (!read?.success) return { status: 'unconfirmed' }
      if (read.data.status === 'ready' && JSON.stringify(read.data.value.draft) !== JSON.stringify(requested.data)) return { status: 'unconfirmed' }
      return read.data
    } catch { return { status: 'unavailable' } }
  }

  async reconcileStoredOperation(input: PaneActionReconcileRequestV1): Promise<PaneActionReceiptV1> {
    const parsed = PaneActionReconcileRequestSchema.safeParse(input)
    const scope = this.store.getSnapshot().snapshot?.context, generation = this.generation, context = this.contextKey
    const unknown: PaneActionReceiptV1 = { status: 'unknown', receiptRef: 'receipt:recovery:unconfirmed', summary: 'The original operation remains unconfirmed.' }
    if (!parsed.success || this.disposed || !scope || !operationContextMatches(parsed.data.context, scope) || !this.remote.reconcile) return unknown
    const request = parsed.data
    const key = JSON.stringify([scope.tenantRef, scope.workspaceRef, scope.projectRef, scope.principalRef, request.owner, request.actionId, request.expectedTargetRef])
    const existing = this.actionFlights.get(key)
    if (existing?.reading) return existing.receipt ?? unknown
    if (existing && existing.request.idempotencyKey !== request.idempotencyKey) return unknown
    const flight = existing ?? { request, receipt: { ...unknown, owner: request.owner, actionId: request.actionId } }
    flight.reading = true
    this.actionFlights.set(key, flight)
    let receipt = flight.receipt ?? unknown
    try {
      const result = await this.remote.reconcile(request)
      const parsedReceipt = result.ok ? PaneActionReceiptSchema.safeParse(result.value) : undefined
      receipt = parsedReceipt?.success && parsedReceipt.data.owner === request.owner && parsedReceipt.data.actionId === request.actionId
        ? parsedReceipt.data : { ...unknown, owner: request.owner, actionId: request.actionId }
    } catch { receipt = { ...unknown, owner: request.owner, actionId: request.actionId } }
    finally { flight.reading = false }
    if (!this.current(generation) || this.contextKey !== context) return unknown
    if (['completed', 'failed'].includes(receipt.status)) this.actionFlights.delete(key)
    else { flight.receipt = receipt; this.actionFlights.set(key, flight) }
    this.store.set({ ...this.store.getSnapshot(), lastReceipt: receipt })
    if (receipt.status === 'completed') void this.refresh()
    return receipt
  }

  async readTranscriptionCatalog(): Promise<SonoraTranscriptionCatalog | undefined> {
    if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || this.contextKey === undefined || this.remote.readTranscriptionCatalog === undefined) return undefined
    const generation = this.generation
    const context = this.contextKey
    const expected = this.store.getSnapshot().snapshot?.context
    if (expected === undefined) return undefined
    try {
      const result = await this.remote.readTranscriptionCatalog(expected)
      if (this.disposed || this.store.getSnapshot().errorCode === 'pane_binding_changed' || generation !== this.generation || context !== this.contextKey || !result.ok) return undefined
      return validateSonoraTranscriptionCatalog(result.value)
    } catch { return undefined }
  }

  reset(): void {
    this.generation += 1
    this.activeRead = undefined
    this.assetReadVersion += 1
    this.snapshotRef = undefined
    this.snapshotVersion = -1
    this.contextKey = undefined
    if (!this.disposed) this.store.set(INITIAL)
  }

  dispose(): void {
    this.disposed = true
    this.reset()
  }

  private async read(generation: number): Promise<void> {
    let result: RemoteResult<CreatorStudioSnapshotV1>
    if (this.owner !== undefined && this.remote.snapshotOwner === undefined) {
      this.publishError(generation, 'owner_snapshot_unavailable')
      return
    }
    try { result = this.owner === undefined ? await this.remote.snapshot() : await this.remote.snapshotOwner!(this.owner) } catch {
      this.publishError(generation, 'remote_read_failed')
      return
    }
    if (!this.current(generation)) return
    if (!result.ok) {
      this.publishError(generation, result.error.code)
      return
    }
    const snapshot = this.owner === undefined ? validateCreatorStudioSnapshot(result.value) : validateCreatorOwnerViewSnapshot(result.value)
    if (snapshot === undefined) {
      this.publishError(generation, 'snapshot_contract_mismatch')
      return
    }
    if (this.owner !== undefined && (snapshot.owners.length !== 1 || snapshot.owners[0]?.owner !== this.owner)) {
      this.publishError(generation, 'owner_snapshot_mismatch')
      return
    }
    const nextContext = contextIdentity(snapshot)
    if (this.owner !== undefined && this.contextKey !== undefined && nextContext !== this.contextKey) {
      this.publishError(generation, 'pane_binding_changed')
      return
    }
    if (this.contextKey !== undefined && nextContext !== this.contextKey) {
      this.snapshotRef = undefined
      this.snapshotVersion = -1
      this.store.set(INITIAL)
    }
    this.contextKey = nextContext
    if (this.snapshotRef === snapshot.snapshotRef && snapshot.snapshotVersion < this.snapshotVersion) {
      this.publishError(generation, 'owner_cursor_drift')
      return
    }
    if (this.snapshotRef === snapshot.snapshotRef && snapshot.snapshotVersion === this.snapshotVersion) {
      const current = this.store.getSnapshot()
      this.store.set({ ...current, phase: 'ready', errorCode: null })
      return
    }
    this.snapshotRef = snapshot.snapshotRef
    this.snapshotVersion = snapshot.snapshotVersion
    const current = this.store.getSnapshot()
    const offline = this.owner !== undefined && snapshot.owners[0]?.status === 'offline'
    const previous = current.snapshot?.owners.find(owner => owner.owner === this.owner)
    if (offline && previous && current.snapshot && contextIdentity(current.snapshot) === nextContext) {
      const retained = { ...snapshot, freshness: 'stale' as const, owners: [{ ...snapshot.owners[0]!, freshness: 'stale' as const, resources: previous.resources, actions: [] }] }
      this.store.set({ ...current, phase: 'error', snapshot: retained, errorCode: 'owner_offline' })
      return
    }
    this.store.set({ ...current, phase: 'ready', snapshot, errorCode: null })
  }

  private publishError(generation: number, errorCode: string): void {
    if (!this.current(generation)) return
    const current = this.store.getSnapshot()
    this.store.set({ ...current, phase: 'error', errorCode })
  }

  private current(generation: number): boolean {
    return !this.disposed && this.store.getSnapshot().errorCode !== 'pane_binding_changed' && this.generation === generation
  }

  private localReceipt(descriptor: PaneActionDescriptorV1, status: PaneActionReceiptV1['status'], summary: string, reconcileReason: string): PaneActionReceiptV1 {
    return PaneActionReceiptSchema.parse({
      status,
      receiptRef: `receipt:creator:${descriptor.descriptorRef.replace(/[^a-z0-9._:-]/giu, '-').slice(0, 96)}`,
      owner: descriptor.owner,
      actionId: descriptor.actionId,
      summary,
      reconcileReason,
    })
  }

  private localApprovalReceipt(decisionRef: string, status: PaneActionReceiptV1['status'], summary: string, reconcileReason: string): PaneActionReceiptV1 {
    return PaneActionReceiptSchema.parse({
      status,
      receiptRef: `receipt:creator:approval:${decisionRef.replace(/[^a-z0-9._:-]/giu, '-').slice(0, 80)}`,
      owner: 'ordo',
      actionId: 'ordo.approval.decide',
      summary,
      reconcileReason,
    })
  }
}
