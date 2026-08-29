import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import {
  PANE_ACTION_REQUEST_SCHEMA,
  PaneActionReceiptSchema,
  PaneActionRequestSchema,
  type ArtifactRefV1,
  type PaneActionDescriptorV1,
  type PaneActionReceiptV1,
  type PaneActionValueV1,
} from '@yeisme/dsh-pane-protocol'
import {
  validateCreatorAssetPage,
  validateCreatorAssetQuery,
  validateCreatorMediaAccess,
  validateCreatorStudioSnapshot,
  type CreatorAssetQueryV1,
  type CreatorAssetV1,
  type CreatorMediaAccessV1,
  type CreatorStudioOwner,
  type CreatorStudioSnapshotV1,
} from '@yeisme/dsh-creator-studio-host/contracts'

export interface CreatorStudioRemote {
  snapshot(): Promise<RemoteResult<CreatorStudioSnapshotV1>>
  dispatch(request: unknown): Promise<RemoteResult<PaneActionReceiptV1>>
  resolveArtifact(artifact: ArtifactRefV1): Promise<RemoteResult<CreatorMediaAccessV1 | null>>
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

export class CreatorStudioController {
  readonly store: SnapshotStore<CreatorStudioViewState> = createSnapshotStore(INITIAL)

  private generation = 0
  private assetReadVersion = 0
  private activeRead: Promise<void> | undefined
  private disposed = false
  private snapshotRef: string | undefined
  private snapshotVersion = -1
  private contextKey: string | undefined

  constructor(private readonly remote: CreatorStudioRemote) {}

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
    if (this.disposed || current.snapshot?.context === undefined) {
      return this.localReceipt(descriptor, 'reconcile_required', 'Creator Studio context is unavailable.', 'context_unavailable')
    }
    const request = PaneActionRequestSchema.parse({
      schema: PANE_ACTION_REQUEST_SCHEMA,
      descriptorRef: descriptor.descriptorRef,
      owner: descriptor.owner,
      actionId: descriptor.actionId,
      expectedTargetRef: descriptor.targetRef,
      expectedTargetVersion: descriptor.targetVersion,
      context: descriptor.context,
      idempotencyKey: `creator-${descriptor.descriptorRef}-${Date.now()}`.replace(/[^a-z0-9._:-]/giu, '-').slice(0, 160),
      values,
    })
    const generation = this.generation
    this.store.set({ ...current, pendingDescriptorRef: descriptor.descriptorRef, errorCode: null })
    let receipt: PaneActionReceiptV1
    try {
      const result = await this.remote.dispatch(request)
      if (!this.current(generation)) return this.localReceipt(descriptor, 'unknown', 'The previous Creator Studio generation was replaced.', 'generation_replaced')
      if (!result.ok) receipt = this.localReceipt(descriptor, 'unknown', 'The owner action Remote did not settle.', result.error.code)
      else receipt = PaneActionReceiptSchema.safeParse(result.value).success
        ? PaneActionReceiptSchema.parse(result.value)
        : this.localReceipt(descriptor, 'unknown', 'The owner returned an invalid action receipt.', 'receipt_contract_mismatch')
    } catch {
      receipt = this.localReceipt(descriptor, 'unknown', 'The owner action transport is uncertain.', 'settlement_unknown')
    }
    if (this.current(generation)) {
      const next = this.store.getSnapshot()
      this.store.set({ ...next, pendingDescriptorRef: null, lastReceipt: receipt })
      if (receipt.status === 'accepted' || receipt.status === 'completed' || receipt.status === 'partial') void this.refresh()
    }
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
    if (this.disposed || this.remote.decideApproval === undefined) {
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
    try { result = await this.remote.snapshot() } catch {
      this.publishError(generation, 'remote_read_failed')
      return
    }
    if (!this.current(generation)) return
    if (!result.ok) {
      this.publishError(generation, result.error.code)
      return
    }
    const snapshot = validateCreatorStudioSnapshot(result.value)
    if (snapshot === undefined) {
      this.publishError(generation, 'snapshot_contract_mismatch')
      return
    }
    const nextContext = contextIdentity(snapshot)
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
    this.store.set({ ...current, phase: 'ready', snapshot, errorCode: null, pendingDescriptorRef: null })
  }

  private publishError(generation: number, errorCode: string): void {
    if (!this.current(generation)) return
    const current = this.store.getSnapshot()
    this.store.set({ ...current, phase: 'error', errorCode, pendingDescriptorRef: null })
  }

  private current(generation: number): boolean {
    return !this.disposed && this.generation === generation
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
