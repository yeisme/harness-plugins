import type {
  DramaShowActionPreviewRequestV1,
  DramaShowAssetPageV1,
  DramaShowAssetQueryV1,
  DramaShowAssetV1,
  DramaShowControlRemoteV1,
  DramaShowControlSnapshotV1,
  DramaShowDeliveryV1,
  DramaShowEpisodePageV1,
  DramaShowEpisodeQueryV1,
  DramaShowEpisodeV1,
  DramaShowReviewPageV1,
  DramaShowReviewQueryV1,
  DramaShowReviewV1,
} from '@yeisme/dsh-ai-drama-director'
import type {
  PaneActionDescriptorV1,
  PaneActionReceiptV1,
  PaneActionRequestV1,
  PaneActionValueV1,
} from '@yeisme/dsh-pane-protocol'
import type {
  AgentBatchRequestV1,
  AnchorDraft,
  AnnotationBatchV1,
  SelectionAnnotationServiceV1,
} from '@yeisme/dsh-selection-host'

export type DramaShowControlReadPhase = 'cold' | 'loading' | 'ready' | 'error'
export type DramaShowSelectionKind = 'episode' | 'review' | 'asset' | 'delivery'

export interface DramaShowSelectionTargetV1 {
  readonly kind: DramaShowSelectionKind
  readonly ref: string
  readonly version: string
}

export type DramaReviewAnnotationKindV1 = 'image-point' | 'image-region' | 'media-frame' | 'media-time-point' | 'media-time-region'

export interface DramaReviewAnnotationInputV1 {
  readonly reviewRef: string
  readonly reviewVersion: string
  readonly kind: DramaReviewAnnotationKindV1
  readonly note: string
  readonly x?: number
  readonly y?: number
  readonly width?: number
  readonly height?: number
  readonly frame?: number
  readonly timeMs?: number
  readonly startMs?: number
  readonly endMs?: number
}

export type DramaSelectionAnnotationOwnerV1 = Pick<SelectionAnnotationServiceV1, 'capability' | 'version' | 'publishAnchor' | 'createBatch' | 'submitBatch' | 'buildAgentRequest'>

export interface DramaShowControlClientStateV1 {
  readonly phase: DramaShowControlReadPhase
  readonly showRef: string | null
  readonly contextRevision: string | null
  readonly snapshot: DramaShowControlSnapshotV1 | null
  readonly errorCode: string | null
  readonly episodePhase: DramaShowControlReadPhase
  readonly episodeQuery: Omit<DramaShowEpisodeQueryV1, 'showRef' | 'cursor'>
  readonly episodeItems: readonly DramaShowEpisodeV1[]
  readonly episodeNextCursor: string | null
  readonly episodeStatus: string | null
  readonly reviewPhase: DramaShowControlReadPhase
  readonly reviewQuery: Omit<DramaShowReviewQueryV1, 'showRef' | 'cursor'>
  readonly reviewItems: readonly DramaShowReviewV1[]
  readonly reviewNextCursor: string | null
  readonly reviewStatus: string | null
  readonly assetPhase: DramaShowControlReadPhase
  readonly assetQuery: Omit<DramaShowAssetQueryV1, 'showRef' | 'cursor'>
  readonly assetItems: readonly DramaShowAssetV1[]
  readonly assetNextCursor: string | null
  readonly assetStatus: string | null
  readonly deliveryPhase: DramaShowControlReadPhase
  readonly delivery: DramaShowDeliveryV1 | null
  readonly selected: readonly DramaShowSelectionTargetV1[]
  readonly previewDescriptor: PaneActionDescriptorV1 | null
  readonly pendingDescriptorRef: string | null
  readonly lastReceipt: PaneActionReceiptV1 | null
  readonly selectionMessage: string | null
  readonly annotationPhase: DramaShowControlReadPhase
  readonly annotationBatch: AnnotationBatchV1 | null
  readonly annotationAgentRequest: AgentBatchRequestV1 | null
  readonly annotationMessage: string | null
}

interface LocalStore<T> {
  getSnapshot(): T
  set(value: T): void
  subscribe(listener: () => void): () => void
}

function createLocalStore<T>(initial: T): LocalStore<T> {
  const listeners = new Set<() => void>()
  let snapshot = initial
  return {
    getSnapshot: () => snapshot,
    set(value) {
      snapshot = value
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const INITIAL: DramaShowControlClientStateV1 = {
  phase: 'cold',
  showRef: null,
  contextRevision: null,
  snapshot: null,
  errorCode: null,
  episodePhase: 'cold',
  episodeQuery: { limit: 50 },
  episodeItems: [],
  episodeNextCursor: null,
  episodeStatus: null,
  reviewPhase: 'cold',
  reviewQuery: { limit: 50 },
  reviewItems: [],
  reviewNextCursor: null,
  reviewStatus: null,
  assetPhase: 'cold',
  assetQuery: { limit: 50 },
  assetItems: [],
  assetNextCursor: null,
  assetStatus: null,
  deliveryPhase: 'cold',
  delivery: null,
  selected: [],
  previewDescriptor: null,
  pendingDescriptorRef: null,
  lastReceipt: null,
  selectionMessage: null,
  annotationPhase: 'cold',
  annotationBatch: null,
  annotationAgentRequest: null,
  annotationMessage: null,
}

export const DRAMA_SHOW_CONTROL_INITIAL_STATE: DramaShowControlClientStateV1 = INITIAL

function pageMatches<T extends { readonly showRef: string; readonly items: readonly unknown[] }>(page: unknown, showRef: string, schemaVersion: string): page is T {
  if (page === null || typeof page !== 'object') return false
  const value = page as { readonly schemaVersion?: unknown; readonly showRef?: unknown; readonly items?: unknown; readonly nextCursor?: unknown }
  return value.schemaVersion === schemaVersion
    && value.showRef === showRef
    && Array.isArray(value.items)
    && value.items.length <= 100
    && (value.nextCursor === undefined || typeof value.nextCursor === 'string')
}

function showSnapshotMatches(value: unknown, showRef: string): value is DramaShowControlSnapshotV1 {
  if (value === null || typeof value !== 'object') return false
  const snapshot = value as Partial<DramaShowControlSnapshotV1>
  return snapshot.schemaVersion === 'drama.show-control.snapshot.v1alpha1'
    && snapshot.showRef === showRef
    && typeof snapshot.snapshotRef === 'string'
    && typeof snapshot.snapshotVersion === 'number'
    && typeof snapshot.status === 'string'
    && typeof snapshot.freshness === 'string'
}

function deliveryMatches(value: unknown, showRef: string): value is DramaShowDeliveryV1 {
  if (value === null || typeof value !== 'object') return false
  const delivery = value as Partial<DramaShowDeliveryV1>
  return delivery.schemaVersion === 'drama.show-control.delivery.v1alpha1'
    && delivery.showRef === showRef
    && Array.isArray(delivery.items)
    && delivery.items.length <= 100
}

function sameSnapshot(left: DramaShowControlSnapshotV1 | null, right: DramaShowControlSnapshotV1): boolean {
  return left?.snapshotRef === right.snapshotRef && left.snapshotVersion === right.snapshotVersion
}

export class DramaShowControlController {
  readonly store = createLocalStore<DramaShowControlClientStateV1>(INITIAL)

  private generation = 0
  private episodeReadVersion = 0
  private reviewReadVersion = 0
  private assetReadVersion = 0
  private deliveryReadVersion = 0
  private idempotency = 0
  private disposed = false

  constructor(
    private readonly remote: DramaShowControlRemoteV1,
    private readonly selectionOwner?: DramaSelectionAnnotationOwnerV1,
  ) {}

  get annotationAvailable(): boolean {
    return this.selectionOwner?.capability === 'selection-annotation'
  }

  bind(showRef: string | undefined, contextRevision: string | undefined): void {
    if (this.disposed) return
    const current = this.store.getSnapshot()
    const nextShow = showRef ?? null
    const nextRevision = contextRevision ?? null
    if (current.showRef === nextShow && current.contextRevision === nextRevision) return
    this.generation += 1
    this.episodeReadVersion += 1
    this.reviewReadVersion += 1
    this.assetReadVersion += 1
    this.deliveryReadVersion += 1
    this.store.set({ ...INITIAL, showRef: nextShow, contextRevision: nextRevision })
  }

  async refresh(): Promise<void> {
    const state = this.store.getSnapshot()
    if (this.disposed || state.showRef === null) return
    const generation = this.generation
    this.store.set({ ...state, phase: 'loading', errorCode: null })
    await Promise.all([
      this.loadSnapshot(generation, state.showRef),
      this.loadEpisodes(state.episodeQuery),
      this.loadReviews(state.reviewQuery),
      this.loadDelivery(),
    ])
  }

  async loadEpisodes(query: Omit<DramaShowEpisodeQueryV1, 'showRef'>, append = false): Promise<void> {
    const state = this.store.getSnapshot()
    if (this.disposed || state.showRef === null) return
    const generation = this.generation
    const readVersion = ++this.episodeReadVersion
    const { cursor: _cursor, ...baseQuery } = query
    this.store.set({ ...state, episodePhase: 'loading', episodeQuery: baseQuery, ...(append ? {} : this.selectionReset()) })
    try {
      const page = await this.remote.episodes({ ...query, showRef: state.showRef })
      if (!this.current(generation, readVersion, 'episode')) return
      if (!pageMatches<DramaShowEpisodePageV1>(page, state.showRef, 'drama.show-control.episode-page.v1alpha1')) return this.publishReadError('episode_contract_mismatch', 'episodePhase')
      const current = this.store.getSnapshot()
      this.store.set({ ...current, episodePhase: 'ready', episodeItems: append ? [...current.episodeItems, ...page.items] : page.items, episodeNextCursor: page.nextCursor ?? null, episodeStatus: page.status })
    } catch {
      if (this.current(generation, readVersion, 'episode')) this.publishReadError('episode_remote_failed', 'episodePhase')
    }
  }

  async loadReviews(query: Omit<DramaShowReviewQueryV1, 'showRef'>, append = false): Promise<void> {
    const state = this.store.getSnapshot()
    if (this.disposed || state.showRef === null) return
    const generation = this.generation
    const readVersion = ++this.reviewReadVersion
    const { cursor: _cursor, ...baseQuery } = query
    this.store.set({ ...state, reviewPhase: 'loading', reviewQuery: baseQuery, ...(append ? {} : this.selectionReset()) })
    try {
      const page = await this.remote.reviews({ ...query, showRef: state.showRef })
      if (!this.current(generation, readVersion, 'review')) return
      if (!pageMatches<DramaShowReviewPageV1>(page, state.showRef, 'drama.show-control.review-page.v1alpha1')) return this.publishReadError('review_contract_mismatch', 'reviewPhase')
      const current = this.store.getSnapshot()
      this.store.set({ ...current, reviewPhase: 'ready', reviewItems: append ? [...current.reviewItems, ...page.items] : page.items, reviewNextCursor: page.nextCursor ?? null, reviewStatus: page.status })
    } catch {
      if (this.current(generation, readVersion, 'review')) this.publishReadError('review_remote_failed', 'reviewPhase')
    }
  }

  async loadAssets(query: Omit<DramaShowAssetQueryV1, 'showRef'>, append = false): Promise<void> {
    const state = this.store.getSnapshot()
    if (this.disposed || state.showRef === null) return
    const generation = this.generation
    const readVersion = ++this.assetReadVersion
    const { cursor: _cursor, ...baseQuery } = query
    this.store.set({ ...state, assetPhase: 'loading', assetQuery: baseQuery, ...(append ? {} : this.selectionReset()) })
    try {
      const page = await this.remote.assets({ ...query, showRef: state.showRef })
      if (!this.current(generation, readVersion, 'asset')) return
      if (!pageMatches<DramaShowAssetPageV1>(page, state.showRef, 'drama.show-control.asset-page.v1alpha1')) return this.publishReadError('asset_contract_mismatch', 'assetPhase')
      const current = this.store.getSnapshot()
      this.store.set({ ...current, assetPhase: 'ready', assetItems: append ? [...current.assetItems, ...page.items] : page.items, assetNextCursor: page.nextCursor ?? null, assetStatus: page.status })
    } catch {
      if (this.current(generation, readVersion, 'asset')) this.publishReadError('asset_remote_failed', 'assetPhase')
    }
  }

  async loadDelivery(): Promise<void> {
    const state = this.store.getSnapshot()
    if (this.disposed || state.showRef === null) return
    const generation = this.generation
    const readVersion = ++this.deliveryReadVersion
    this.store.set({ ...state, deliveryPhase: 'loading' })
    try {
      const delivery = await this.remote.delivery(state.showRef)
      if (!this.current(generation, readVersion, 'delivery')) return
      if (!deliveryMatches(delivery, state.showRef)) return this.publishReadError('delivery_contract_mismatch', 'deliveryPhase')
      this.store.set({ ...this.store.getSnapshot(), deliveryPhase: 'ready', delivery })
    } catch {
      if (this.current(generation, readVersion, 'delivery')) this.publishReadError('delivery_remote_failed', 'deliveryPhase')
    }
  }

  toggleSelection(target: DramaShowSelectionTargetV1): void {
    if (this.disposed || !this.isLoaded(target)) return
    const state = this.store.getSnapshot()
    const exists = state.selected.some(item => item.kind === target.kind && item.ref === target.ref && item.version === target.version)
    const selected = exists ? state.selected.filter(item => !(item.kind === target.kind && item.ref === target.ref && item.version === target.version)) : [...state.selected, target]
    if (selected.length > 100) {
      this.store.set({ ...state, selectionMessage: 'At most 100 loaded targets can be selected.' })
      return
    }
    this.store.set({ ...state, selected, previewDescriptor: null, selectionMessage: null })
  }

  clearSelection(): void {
    const state = this.store.getSnapshot()
    this.store.set({ ...state, selected: [], previewDescriptor: null, selectionMessage: null })
  }

  selectOnly(target: DramaShowSelectionTargetV1): boolean {
    if (this.disposed || !this.isLoaded(target)) return false
    const state = this.store.getSnapshot()
    this.store.set({ ...state, selected: [target], previewDescriptor: null, selectionMessage: null })
    return true
  }

  async previewAction(actionId: string, options: { readonly annotationBatchRef?: string } = {}): Promise<PaneActionDescriptorV1 | undefined> {
    const state = this.store.getSnapshot()
    if (this.disposed || state.showRef === null || state.selected.length < 1 || state.selected.length > 100) return undefined
    const request: DramaShowActionPreviewRequestV1 = {
      showRef: state.showRef,
      actionId,
      targetRefs: state.selected.map(item => item.ref),
      targetVersions: Object.fromEntries(state.selected.map(item => [item.ref, item.version])),
      ...(options.annotationBatchRef === undefined ? {} : { annotationBatchRef: options.annotationBatchRef }),
      idempotencyKey: `show-control:preview:${++this.idempotency}`,
    }
    try {
      const descriptor = await this.remote.previewAction(request)
      if (Date.parse(descriptor.expiresAt) <= Date.now() || descriptor.context.revision !== state.contextRevision) {
        this.store.set({ ...this.store.getSnapshot(), previewDescriptor: null, selectionMessage: 'The owner action preview is stale; reconcile before submitting.' })
        return undefined
      }
      this.store.set({ ...this.store.getSnapshot(), previewDescriptor: descriptor, selectionMessage: null })
      return descriptor
    } catch {
      this.store.set({ ...this.store.getSnapshot(), previewDescriptor: null, selectionMessage: 'Owner action preview is unavailable.' })
      return undefined
    }
  }

  submitAnnotations(inputs: readonly DramaReviewAnnotationInputV1[]): AnnotationBatchV1 | undefined {
    const owner = this.selectionOwner
    const state = this.store.getSnapshot()
    if (this.disposed || owner === undefined || inputs.length < 1 || inputs.length > 100) {
      this.store.set({ ...state, annotationPhase: 'error', annotationMessage: owner === undefined ? 'Selection annotation owner is unavailable.' : 'Select between 1 and 100 review anchors.' })
      return undefined
    }
    this.store.set({ ...state, annotationPhase: 'loading', annotationMessage: null, annotationBatch: null, annotationAgentRequest: null, previewDescriptor: null })
    try {
      const anchors = inputs.map(input => owner.publishAnchor(this.annotationDraft(input)))
      const created = owner.createBatch({ title: `Drama review annotations (${anchors.length})`, anchorIds: anchors.map(anchor => anchor.anchorId) })
      const submitted = owner.submitBatch(created.batchId)
      const agentRequest = owner.buildAgentRequest(submitted.batchId)
      this.store.set({ ...this.store.getSnapshot(), annotationPhase: 'ready', annotationBatch: submitted, annotationAgentRequest: agentRequest, annotationMessage: `Selection owner accepted ${submitted.anchors.length} version-fenced anchors.` })
      return submitted
    } catch (error) {
      this.store.set({ ...this.store.getSnapshot(), annotationPhase: 'error', annotationBatch: null, annotationAgentRequest: null, annotationMessage: error instanceof Error ? error.message : 'Selection owner rejected the annotation batch.' })
      return undefined
    }
  }

  async dispatchPreview(values: Readonly<Record<string, PaneActionValueV1>> = {}): Promise<PaneActionReceiptV1 | undefined> {
    const state = this.store.getSnapshot()
    const descriptor = state.previewDescriptor
    if (this.disposed || descriptor === null || Date.parse(descriptor.expiresAt) <= Date.now()) return undefined
    const request: PaneActionRequestV1 = {
      schema: 'pane.action-request.v1alpha1',
      descriptorRef: descriptor.descriptorRef,
      owner: descriptor.owner,
      actionId: descriptor.actionId,
      expectedTargetRef: descriptor.targetRef,
      expectedTargetVersion: descriptor.targetVersion,
      context: descriptor.context,
      idempotencyKey: `show-control:${descriptor.descriptorRef}:${++this.idempotency}`.replace(/[^A-Za-z0-9._~:-]/g, '-').slice(0, 160),
      values,
    }
    this.store.set({ ...state, pendingDescriptorRef: descriptor.descriptorRef, selectionMessage: null })
    let receipt: PaneActionReceiptV1
    try {
      receipt = await this.remote.dispatch(request)
    } catch {
      receipt = { status: 'unknown', receiptRef: `receipt:show-control:${this.idempotency}`, owner: descriptor.owner, actionId: descriptor.actionId, summary: 'Owner settlement is unknown.', reconcileReason: 'settlement_unknown' }
    }
    const current = this.store.getSnapshot()
    const settled = receipt.status === 'accepted' || receipt.status === 'completed' || receipt.status === 'partial'
    this.store.set({ ...current, pendingDescriptorRef: null, lastReceipt: receipt, ...(settled ? { selected: [], previewDescriptor: null } : {}) })
    return receipt
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.generation += 1
    this.episodeReadVersion += 1
    this.reviewReadVersion += 1
    this.assetReadVersion += 1
    this.deliveryReadVersion += 1
    this.store.set(INITIAL)
  }

  private async loadSnapshot(generation: number, showRef: string): Promise<void> {
    try {
      const snapshot = await this.remote.snapshot(showRef)
      if (this.disposed || this.generation !== generation) return
      if (!showSnapshotMatches(snapshot, showRef)) return this.publishReadError('snapshot_contract_mismatch', 'phase')
      const current = this.store.getSnapshot()
      const identityChanged = current.snapshot !== null && !sameSnapshot(current.snapshot, snapshot)
      this.store.set({ ...current, phase: 'ready', snapshot, errorCode: null, ...(identityChanged ? { ...this.selectionReset(), lastReceipt: null } : {}) })
    } catch {
      if (!this.disposed && this.generation === generation) this.publishReadError('snapshot_remote_failed', 'phase')
    }
  }

  private isLoaded(target: DramaShowSelectionTargetV1): boolean {
    const state = this.store.getSnapshot()
    const collection = target.kind === 'episode' ? state.episodeItems
      : target.kind === 'review' ? state.reviewItems
        : target.kind === 'asset' ? state.assetItems
          : state.delivery?.items ?? []
    return collection.some(item => item.ref === target.ref && item.version === target.version)
  }

  private selectionReset(): Pick<DramaShowControlClientStateV1, 'selected' | 'previewDescriptor' | 'selectionMessage' | 'annotationPhase' | 'annotationBatch' | 'annotationAgentRequest' | 'annotationMessage'> {
    return { selected: [], previewDescriptor: null, selectionMessage: null, annotationPhase: 'cold', annotationBatch: null, annotationAgentRequest: null, annotationMessage: null }
  }

  private annotationDraft(input: DramaReviewAnnotationInputV1): AnchorDraft {
    const state = this.store.getSnapshot()
    const review = state.reviewItems.find(item => item.ref === input.reviewRef && item.version === input.reviewVersion)
    if (review === undefined || review.annotation === undefined || review.artifact === undefined) throw new Error('annotation_target_not_loaded')
    if (review.annotation.artifactRef !== review.artifact.ref || review.annotation.artifactVersion !== review.artifact.version) throw new Error('annotation_target_version_mismatch')
    if (!review.annotation.allowedKinds.includes(input.kind)) throw new Error('annotation_kind_not_allowed')
    const note = input.note.trim()
    if (note.length < 1 || note.length > 512) throw new Error('annotation_note_out_of_bounds')
    const common = { artifactRef: review.annotation.artifactRef, artifactVersion: review.annotation.artifactVersion, quotePreview: note, quoteDigest: review.annotation.quoteDigest }
    const unit = (value: number | undefined, name: string): number => {
      if (value === undefined || !Number.isFinite(value) || value < 0 || value > 1) throw new Error(`annotation_${name}_out_of_bounds`)
      return value
    }
    const time = (value: number | undefined, name: string): number => {
      if (value === undefined || !Number.isSafeInteger(value) || value < 0 || value > 86_400_000) throw new Error(`annotation_${name}_out_of_bounds`)
      return value
    }
    if (input.kind === 'image-point') return { ...common, kind: input.kind, x: unit(input.x, 'x'), y: unit(input.y, 'y') }
    if (input.kind === 'image-region') {
      const x = unit(input.x, 'x'); const y = unit(input.y, 'y'); const width = unit(input.width, 'width'); const height = unit(input.height, 'height')
      if (x + width > 1 || y + height > 1) throw new Error('annotation_region_out_of_bounds')
      return { ...common, kind: input.kind, x, y, width, height }
    }
    if (input.kind === 'media-frame') {
      if (input.frame === undefined || !Number.isSafeInteger(input.frame) || input.frame < 0 || input.frame > 10_000_000) throw new Error('annotation_frame_out_of_bounds')
      return { ...common, kind: input.kind, frame: input.frame, timeMs: time(input.timeMs, 'time') }
    }
    if (input.kind === 'media-time-point') return { ...common, kind: input.kind, timeMs: time(input.timeMs, 'time') }
    const startMs = time(input.startMs, 'start'); const endMs = time(input.endMs, 'end')
    if (endMs <= startMs) throw new Error('annotation_region_time_invalid')
    return { ...common, kind: input.kind, startMs, endMs }
  }

  private current(generation: number, readVersion: number, lane: 'episode' | 'review' | 'asset' | 'delivery'): boolean {
    const currentVersion = lane === 'episode' ? this.episodeReadVersion
      : lane === 'review' ? this.reviewReadVersion
        : lane === 'asset' ? this.assetReadVersion
          : this.deliveryReadVersion
    return !this.disposed && this.generation === generation && currentVersion === readVersion
  }

  private publishReadError(errorCode: string, phase: 'phase' | 'episodePhase' | 'reviewPhase' | 'assetPhase' | 'deliveryPhase'): void {
    const state = this.store.getSnapshot()
    this.store.set({ ...state, [phase]: 'error', errorCode })
  }
}
