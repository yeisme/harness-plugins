import type { CreatorStudioSnapshotV1 } from '@yeisme/dsh-creator-studio-host/contracts'
import type {
  CreatorStudioRuntimeV1,
  CreatorStudioViewState,
} from '@yeisme/dsh-client-ui-creator-studio/runtime'
import type { CreatorStudioProjectionTransport } from './probe.js'

interface LocalSnapshotStore<T> {
  getSnapshot(): T
  set(value: T): void
  subscribe(listener: () => void): () => void
}

function createLocalSnapshotStore<T>(initial: T): LocalSnapshotStore<T> {
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

const LEGACY_INITIAL: CreatorStudioViewState = {
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

export interface LegacyCreatorStudioRuntimeV1 {
  readonly schemaVersion: 'creator.studio.legacy-readonly.v1alpha1'
  readonly mode: 'legacy-readonly'
  readonly canMutate: false
  getSnapshot(): CreatorStudioViewState
  subscribe(listener: () => void): () => void
  /** Explicit one-shot read. No timer and no automatic retry are installed. */
  refresh(): Promise<void>
  dispose(): void
}

export type DramaCreatorRuntimeV1 = CreatorStudioRuntimeV1 | LegacyCreatorStudioRuntimeV1

const CREATOR_OWNERS = ['eikona', 'scaena', 'sonora', 'auctra', 'pinax', 'anatomia'] as const
const UNSAFE_PROJECTION = /(?:^|[:/\\])(?:etc|home|usr|var)|file:\/\/|authorization|cookie|token|secret|password|-----BEGIN|https?:\/\//iu

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function safeProjection(value: unknown): boolean {
  try { return !UNSAFE_PROJECTION.test(JSON.stringify(value)) } catch { return false }
}

function safeRef(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && /^[A-Za-z0-9][A-Za-z0-9._~:-]*$/u.test(value)
}

function safeText(value: unknown, max = 500): value is string {
  return typeof value === 'string' && value.length <= max && safeProjection(value)
}

function safeRefs(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length <= 64 && value.every(safeRef)
}

function validArtifact(value: unknown): boolean {
  const artifact = record(value)
  return artifact !== undefined
    && safeRef(artifact.owner) && safeRef(artifact.ref) && safeRef(artifact.version)
    && safeRef(artifact.kind) && safeText(artifact.mediaType, 160) && safeText(artifact.title, 240)
    && Array.isArray(artifact.capabilities) && artifact.capabilities.length <= 64 && artifact.capabilities.every(safeRef)
    && (artifact.summary === undefined || safeText(artifact.summary))
    && (artifact.evidenceRefs === undefined || safeRefs(artifact.evidenceRefs))
}

function validResource(value: unknown): boolean {
  const resource = record(value)
  return resource !== undefined
    && safeRef(resource.ref) && safeRef(resource.version) && safeRef(resource.kind)
    && safeText(resource.title, 240) && safeRef(resource.status) && safeRefs(resource.evidenceRefs)
    && (resource.summary === undefined || safeText(resource.summary))
    && (resource.progress === undefined || (typeof resource.progress === 'number' && resource.progress >= 0 && resource.progress <= 1))
    && (resource.artifact === undefined || validArtifact(resource.artifact))
    && (resource.waveform === undefined || (Array.isArray(resource.waveform) && resource.waveform.length <= 4096 && resource.waveform.every(point => typeof point === 'number' && Number.isFinite(point))))
    && safeProjection(value)
}

function validContext(value: unknown): boolean {
  const context = record(value)
  if (context === undefined) return false
  for (const key of ['tenantRef', 'workspaceRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision']) {
    if (!safeRef(context[key])) return false
  }
  return context.projectRef === undefined || safeRef(context.projectRef)
}

function validAction(value: unknown): boolean {
  const action = record(value)
  const context = action === undefined ? undefined : record(action.context)
  const preview = action === undefined ? undefined : record(action.preview)
  return action !== undefined
    && action.schema === 'pane.action-descriptor.v1alpha1'
    && safeRef(action.descriptorRef) && safeRef(action.owner) && safeRef(action.actionId)
    && safeText(action.label, 240) && safeRef(action.targetRef) && safeRef(action.targetVersion)
    && context !== undefined && safeRef(context.workspaceRef) && safeRef(context.revision)
    && ['low', 'medium', 'high'].includes(action.risk as string)
    && ['none', 'confirm', 'approval'].includes(action.confirmation as string)
    && typeof action.expiresAt === 'string' && Number.isFinite(Date.parse(action.expiresAt))
    && preview !== undefined && safeText(preview.summary)
    && Array.isArray(action.fields) && action.fields.length <= 32
    && safeProjection(value)
}

function validReview(value: unknown): boolean {
  const review = record(value)
  return review !== undefined && safeRef(review.ref) && CREATOR_OWNERS.includes(review.owner as never)
    && safeText(review.title, 240) && ['pending', 'approved', 'rejected', 'partial', 'blocked'].includes(review.status as string)
    && ['low', 'medium', 'high'].includes(review.risk as string) && safeRefs(review.evidenceRefs)
    && (review.summary === undefined || safeText(review.summary)) && (review.artifact === undefined || validArtifact(review.artifact))
}

function validJob(value: unknown): boolean {
  const job = record(value)
  return job !== undefined && safeRef(job.ref) && CREATOR_OWNERS.includes(job.owner as never) && safeText(job.title, 240)
    && ['queued', 'running', 'approval_required', 'completed', 'failed', 'unknown', 'reconcile_required'].includes(job.status as string)
    && (job.progress === undefined || (typeof job.progress === 'number' && job.progress >= 0 && job.progress <= 1))
    && (job.summary === undefined || safeText(job.summary)) && (job.receiptRef === undefined || safeRef(job.receiptRef)) && safeRefs(job.evidenceRefs)
}

function validOwner(value: unknown): boolean {
  const owner = record(value)
  return owner !== undefined && owner.schemaVersion === 'creator.owner.snapshot.v1alpha1'
    && CREATOR_OWNERS.includes(owner.owner as never) && ['local', 'service', 'unavailable'].includes(owner.transport as string)
    && safeRef(owner.snapshotRef) && Number.isSafeInteger(owner.snapshotVersion) && (owner.snapshotVersion as number) >= 0
    && safeRef(owner.cursor) && Number.isSafeInteger(owner.sequence) && (owner.sequence as number) >= -1
    && typeof owner.generatedAt === 'string' && Number.isFinite(Date.parse(owner.generatedAt))
    && (owner.context === undefined ? owner.transport === 'unavailable' : validContext(owner.context))
    && typeof owner.status === 'string' && ['fresh', 'stale', 'unknown'].includes(owner.freshness as string) && safeText(owner.summary)
    && Array.isArray(owner.resources) && owner.resources.length <= 1000 && owner.resources.every(validResource)
    && Array.isArray(owner.actions) && owner.actions.length <= 64 && owner.actions.every(validAction)
    && (owner.reviews === undefined || (Array.isArray(owner.reviews) && owner.reviews.length <= 500 && owner.reviews.every(validReview)))
    && (owner.jobs === undefined || (Array.isArray(owner.jobs) && owner.jobs.length <= 500 && owner.jobs.every(validJob)))
    && safeProjection(value)
}

function validateLegacyCreatorStudioSnapshot(input: unknown): CreatorStudioSnapshotV1 | undefined {
  const snapshot = record(input)
  if (snapshot === undefined || snapshot.schemaVersion !== 'creator.studio.snapshot.v1alpha1') return undefined
  if (!safeRef(snapshot.snapshotRef) || !Number.isSafeInteger(snapshot.snapshotVersion) || (snapshot.snapshotVersion as number) < 0) return undefined
  if (typeof snapshot.generatedAt !== 'string' || !Number.isFinite(Date.parse(snapshot.generatedAt)) || typeof snapshot.status !== 'string') return undefined
  if (!['fresh', 'stale', 'unknown'].includes(snapshot.freshness as string) || !['owner_snapshot', 'context_unavailable', 'owner_directory_unavailable', 'partial_owner_projection'].includes(snapshot.reasonCode as string) || !safeText(snapshot.safeMessage)) return undefined
  if (snapshot.context !== undefined && !validContext(snapshot.context)) return undefined
  if (!Array.isArray(snapshot.owners) || snapshot.owners.length !== CREATOR_OWNERS.length || !snapshot.owners.every(validOwner)) return undefined
  const owners = snapshot.owners.map(item => record(item)?.owner)
  if (new Set(owners).size !== CREATOR_OWNERS.length) return undefined
  if (!Array.isArray(snapshot.reviews) || snapshot.reviews.length > 500 || !snapshot.reviews.every(validReview)) return undefined
  if (!Array.isArray(snapshot.jobs) || snapshot.jobs.length > 500 || !snapshot.jobs.every(validJob) || !safeProjection(input)) return undefined
  return input as CreatorStudioSnapshotV1
}

function unwrapSnapshot(value: unknown): { readonly value?: unknown; readonly errorCode?: string } {
  if (value !== null && typeof value === 'object' && 'ok' in value) {
    const result = value as { readonly ok?: unknown; readonly value?: unknown; readonly error?: { readonly code?: unknown } }
    if (result.ok === true) return { value: result.value }
    if (result.ok === false) return { errorCode: typeof result.error?.code === 'string' ? result.error.code : 'legacy_remote_failed' }
  }
  return { value }
}

/**
 * Compatibility adapter for installations that only expose
 * `remote.creatorStudio.snapshot()`. It is intentionally read-only and only
 * performs reads requested through `refresh()`.
 */
export function createLegacyCreatorStudioRuntime(
  remote: CreatorStudioProjectionTransport,
): LegacyCreatorStudioRuntimeV1 {
  const store = createLocalSnapshotStore<CreatorStudioViewState>(LEGACY_INITIAL)
  let generation = 0
  let activeRead: Promise<void> | undefined
  let disposed = false

  const refresh = (): Promise<void> => {
    if (disposed) return Promise.resolve()
    if (activeRead !== undefined) return activeRead
    const readGeneration = generation
    store.set({ ...store.getSnapshot(), phase: 'loading', errorCode: null })
    const operation = Promise.resolve(remote.snapshot())
      .then(raw => {
        if (disposed || generation !== readGeneration) return
        const unwrapped = unwrapSnapshot(raw)
        if (unwrapped.errorCode !== undefined) {
          store.set({ ...store.getSnapshot(), phase: 'error', errorCode: unwrapped.errorCode })
          return
        }
        const snapshot = validateLegacyCreatorStudioSnapshot(unwrapped.value)
        if (snapshot === undefined) {
          store.set({ ...store.getSnapshot(), phase: 'error', errorCode: 'snapshot_contract_mismatch' })
          return
        }
        store.set({ ...LEGACY_INITIAL, phase: 'ready', snapshot })
      })
      .catch(() => {
        if (!disposed && generation === readGeneration) {
          store.set({ ...store.getSnapshot(), phase: 'error', errorCode: 'legacy_remote_failed' })
        }
      })
      .finally(() => {
        if (activeRead === operation) activeRead = undefined
      })
    activeRead = operation
    return operation
  }

  return {
    schemaVersion: 'creator.studio.legacy-readonly.v1alpha1',
    mode: 'legacy-readonly',
    canMutate: false,
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    refresh,
    dispose() {
      if (disposed) return
      disposed = true
      generation += 1
      activeRead = undefined
      store.set(LEGACY_INITIAL)
    },
  }
}

export function creatorProjectionIdentity(
  dramaRevision: string | undefined,
  state: CreatorStudioViewState | undefined,
): string {
  const snapshot = state?.snapshot
  const context = snapshot?.context
  return [
    dramaRevision ?? '',
    context?.tenantRef ?? '',
    context?.workspaceRef ?? '',
    context?.projectRef ?? '',
    context?.principalRef ?? '',
    context?.revision ?? '',
    context?.runtimeGeneration ?? '',
    snapshot?.snapshotRef ?? '',
    snapshot?.snapshotVersion ?? -1,
  ].join('\u0000')
}
