import type {
  ArtifactRefV1,
  PaneActionDescriptorV1,
  PaneActionReceiptV1,
  PaneActionRequestV1,
} from '@yeisme/dsh-pane-protocol'
import { isSafeDramaRef } from './contracts.js'

export const DRAMA_SHOW_CONTROL_SNAPSHOT_SCHEMA = 'drama.show-control.snapshot.v1alpha1' as const
export const DRAMA_SHOW_CONTROL_EPISODE_PAGE_SCHEMA = 'drama.show-control.episode-page.v1alpha1' as const
export const DRAMA_SHOW_CONTROL_REVIEW_PAGE_SCHEMA = 'drama.show-control.review-page.v1alpha1' as const
export const DRAMA_SHOW_CONTROL_ASSET_PAGE_SCHEMA = 'drama.show-control.asset-page.v1alpha1' as const
export const DRAMA_SHOW_CONTROL_DELIVERY_SCHEMA = 'drama.show-control.delivery.v1alpha1' as const
export const DRAMA_SHOW_CONTROL_DEFAULT_PAGE_SIZE = 50
export const DRAMA_SHOW_CONTROL_MAX_PAGE_SIZE = 100
export const DRAMA_SHOW_CONTROL_MAX_BATCH_TARGETS = 100

export type DramaShowControlStatusV1 = 'ready' | 'partial' | 'needs_contract' | 'permission_denied' | 'contract_mismatch'
export type DramaShowControlFreshnessV1 = 'fresh' | 'stale' | 'offline' | 'unknown'

export interface DramaShowControlBindingV1 {
  readonly tenantRef: string
  readonly workspaceRef: string
  readonly principalRef: string
  readonly runtimeGeneration: string
  readonly showRef: string
  readonly contextRevision: string
}

export interface DramaShowControlSummaryV1 {
  readonly episodeCount: number
  readonly activeEpisodeCount: number
  readonly reviewCount: number
  readonly attentionCount: number
  readonly assetCount: number
  readonly deliveryReadyCount: number
}

export interface DramaShowControlSnapshotV1 {
  readonly schemaVersion: typeof DRAMA_SHOW_CONTROL_SNAPSHOT_SCHEMA
  readonly snapshotRef: string
  readonly snapshotVersion: number
  readonly generatedAt: string
  readonly showRef: string
  readonly showVersion: string
  readonly title: string
  readonly status: DramaShowControlStatusV1
  readonly freshness: DramaShowControlFreshnessV1
  readonly safeMessage: string
  readonly summary: DramaShowControlSummaryV1
  readonly blockerRefs: readonly string[]
  readonly evidenceRefs: readonly string[]
}

export interface DramaShowEpisodeV1 {
  readonly ref: string
  readonly version: string
  readonly title: string
  readonly ordinal: number
  readonly stage: 'prepare' | 'text' | 'visual' | 'shots' | 'review' | 'export'
  readonly status: 'pending' | 'running' | 'ready' | 'attention' | 'blocked'
  readonly progress: number
  readonly attentionCount: number
  readonly summary?: string
  readonly evidenceRefs: readonly string[]
}

export interface DramaShowReviewV1 {
  readonly ref: string
  readonly version: string
  readonly episodeRef: string
  readonly owner: string
  readonly title: string
  readonly status: 'pending' | 'approved' | 'rejected' | 'partial' | 'blocked'
  readonly risk: 'low' | 'medium' | 'high'
  readonly summary?: string
  readonly artifact?: ArtifactRefV1
  readonly annotation?: DramaShowReviewAnnotationProjectionV1
  readonly evidenceRefs: readonly string[]
}

export interface DramaShowReviewAnnotationProjectionV1 {
  readonly artifactRef: string
  readonly artifactVersion: string
  readonly quoteDigest: string
  readonly allowedKinds: readonly ('image-point' | 'image-region' | 'media-frame' | 'media-time-point' | 'media-time-region')[]
}

export interface DramaShowAssetV1 {
  readonly ref: string
  readonly version: string
  readonly episodeRef: string
  readonly owner: string
  readonly kind: string
  readonly title: string
  readonly status: string
  readonly summary?: string
  readonly artifact?: ArtifactRefV1
  readonly rightsSummary?: string
  readonly evidenceRefs: readonly string[]
}

export interface DramaShowDeliveryItemV1 {
  readonly ref: string
  readonly version: string
  readonly episodeRef: string
  readonly title: string
  readonly status: 'ready' | 'blocked' | 'attention' | 'submitted'
  readonly rightsStatus: 'ready' | 'attention' | 'blocked' | 'unknown'
  readonly evidenceStatus: 'ready' | 'attention' | 'blocked' | 'unknown'
  readonly previousVersion?: string
  readonly versionDifference?: { readonly changed: boolean; readonly summary: string }
  readonly rightsSummary?: string
  readonly evidenceSummary?: string
  readonly blockerRefs: readonly string[]
  readonly evidenceRefs: readonly string[]
  readonly actions?: readonly DramaShowDeliveryActionV1[]
  readonly receiptHistory?: readonly PaneActionReceiptV1[]
}

export interface DramaShowDeliveryActionV1 {
  readonly actionId: string
  readonly label: string
  readonly kind: 'prepare' | 'submit' | 'remediate'
  readonly disabledReason?: string
}

export interface DramaShowDeliveryV1 {
  readonly schemaVersion: typeof DRAMA_SHOW_CONTROL_DELIVERY_SCHEMA
  readonly snapshotRef: string
  readonly snapshotVersion: number
  readonly generatedAt: string
  readonly showRef: string
  readonly status: DramaShowControlStatusV1
  readonly freshness: DramaShowControlFreshnessV1
  readonly safeMessage: string
  readonly readyCount: number
  readonly totalCount: number
  readonly items: readonly DramaShowDeliveryItemV1[]
  readonly blockerRefs: readonly string[]
  readonly evidenceRefs: readonly string[]
}

export interface DramaShowEpisodeQueryV1 {
  readonly showRef: string
  readonly cursor?: string
  readonly limit?: number
  readonly stage?: DramaShowEpisodeV1['stage']
  readonly status?: DramaShowEpisodeV1['status']
  readonly attention?: boolean
}

export interface DramaShowReviewQueryV1 {
  readonly showRef: string
  readonly cursor?: string
  readonly limit?: number
  readonly episodeRef?: string
  readonly owner?: string
  readonly status?: DramaShowReviewV1['status']
  readonly risk?: DramaShowReviewV1['risk']
}

export interface DramaShowAssetQueryV1 {
  readonly showRef: string
  readonly cursor?: string
  readonly limit?: number
  readonly episodeRef?: string
  readonly owner?: string
  readonly kind?: string
  readonly status?: string
}

export interface DramaShowPageV1<T, TSchema extends string> {
  readonly schemaVersion: TSchema
  readonly snapshotRef: string
  readonly snapshotVersion: number
  readonly showRef: string
  readonly status: DramaShowControlStatusV1
  readonly freshness: DramaShowControlFreshnessV1
  readonly safeMessage: string
  readonly items: readonly T[]
  readonly nextCursor?: string
}

export type DramaShowEpisodePageV1 = DramaShowPageV1<DramaShowEpisodeV1, typeof DRAMA_SHOW_CONTROL_EPISODE_PAGE_SCHEMA>
export type DramaShowReviewPageV1 = DramaShowPageV1<DramaShowReviewV1, typeof DRAMA_SHOW_CONTROL_REVIEW_PAGE_SCHEMA>
export type DramaShowAssetPageV1 = DramaShowPageV1<DramaShowAssetV1, typeof DRAMA_SHOW_CONTROL_ASSET_PAGE_SCHEMA>

export interface DramaShowActionPreviewRequestV1 {
  readonly showRef: string
  readonly actionId: string
  readonly targetRefs: readonly string[]
  readonly targetVersions: Readonly<Record<string, string>>
  readonly annotationBatchRef?: string
  readonly idempotencyKey?: string
}

export interface DramaShowControlOwnerAdapterV1 {
  readonly id: string
  snapshot(binding: DramaShowControlBindingV1): Promise<DramaShowControlSnapshotV1> | DramaShowControlSnapshotV1
  episodes(query: Required<Pick<DramaShowEpisodeQueryV1, 'showRef' | 'limit'>> & Omit<DramaShowEpisodeQueryV1, 'limit'>, binding: DramaShowControlBindingV1): Promise<DramaShowEpisodePageV1> | DramaShowEpisodePageV1
  reviews(query: Required<Pick<DramaShowReviewQueryV1, 'showRef' | 'limit'>> & Omit<DramaShowReviewQueryV1, 'limit'>, binding: DramaShowControlBindingV1): Promise<DramaShowReviewPageV1> | DramaShowReviewPageV1
  assets(query: Required<Pick<DramaShowAssetQueryV1, 'showRef' | 'limit'>> & Omit<DramaShowAssetQueryV1, 'limit'>, binding: DramaShowControlBindingV1): Promise<DramaShowAssetPageV1> | DramaShowAssetPageV1
  delivery(binding: DramaShowControlBindingV1): Promise<DramaShowDeliveryV1> | DramaShowDeliveryV1
  previewAction(request: DramaShowActionPreviewRequestV1, binding: DramaShowControlBindingV1): Promise<PaneActionDescriptorV1> | PaneActionDescriptorV1
  dispatch(request: PaneActionRequestV1, binding: DramaShowControlBindingV1): Promise<PaneActionReceiptV1> | PaneActionReceiptV1
}

export interface DramaShowControlRemoteV1 {
  snapshot(showRef: string): Promise<DramaShowControlSnapshotV1>
  episodes(query: DramaShowEpisodeQueryV1): Promise<DramaShowEpisodePageV1>
  reviews(query: DramaShowReviewQueryV1): Promise<DramaShowReviewPageV1>
  assets(query: DramaShowAssetQueryV1): Promise<DramaShowAssetPageV1>
  delivery(showRef: string): Promise<DramaShowDeliveryV1>
  previewAction(request: DramaShowActionPreviewRequestV1): Promise<PaneActionDescriptorV1>
  dispatch(request: PaneActionRequestV1): Promise<PaneActionReceiptV1>
}

const UNSAFE_BLOB = /(?:^|[:/\\])(?:etc|home|usr|var)|file:\/\/|authorization|cookie|token|secret|password|-----BEGIN|https?:\/\//i
const PANE_ACTION_DESCRIPTOR_SCHEMA = 'pane.action-descriptor.v1alpha1'
const PANE_ACTION_REQUEST_SCHEMA = 'pane.action-request.v1alpha1'

function safeBlob(value: unknown): boolean {
  try { return !UNSAFE_BLOB.test(JSON.stringify(value)) } catch { return false }
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed)
  return Object.keys(value).every(key => allowedSet.has(key))
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function safeRefArray(value: unknown, max = DRAMA_SHOW_CONTROL_MAX_BATCH_TARGETS): value is readonly string[] {
  return Array.isArray(value) && value.length <= max && value.every(item => typeof item === 'string' && isSafeDramaRef(item))
}

function safeText(value: unknown, max = 240): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && safeBlob(value)
}

function safeCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function validPaneContext(value: unknown): value is PaneActionDescriptorV1['context'] {
  const context = record(value)
  return context !== undefined
    && exactKeys(context, ['workspaceRef', 'revision'])
    && typeof context.workspaceRef === 'string' && isSafeDramaRef(context.workspaceRef)
    && typeof context.revision === 'string' && isSafeDramaRef(context.revision)
}

function validActionField(value: unknown): boolean {
  const field = record(value)
  if (field === undefined || !exactKeys(field, ['key', 'label', 'kind', 'required', 'placeholder', 'min', 'max', 'minLength', 'maxLength', 'options', 'artifactKinds'])) return false
  if (typeof field.key !== 'string' || !isSafeDramaRef(field.key) || !safeText(field.label) || typeof field.required !== 'boolean') return false
  if (!['text', 'textarea', 'number', 'select', 'multiselect', 'boolean', 'artifact_ref'].includes(field.kind as string)) return false
  if (field.placeholder !== undefined && (typeof field.placeholder !== 'string' || field.placeholder.length > 240 || !safeBlob(field.placeholder))) return false
  for (const key of ['min', 'max'] as const) if (field[key] !== undefined && (typeof field[key] !== 'number' || !Number.isFinite(field[key]))) return false
  for (const key of ['minLength', 'maxLength'] as const) if (field[key] !== undefined && (!safeCount(field[key]) || (field[key] as number) > 16_384)) return false
  if (field.min !== undefined && field.max !== undefined && (field.min as number) > (field.max as number)) return false
  if (field.minLength !== undefined && field.maxLength !== undefined && (field.minLength as number) > (field.maxLength as number)) return false
  if (field.options !== undefined && (!Array.isArray(field.options) || field.options.length > 128 || field.options.some(option => {
    const candidate = record(option)
    return candidate === undefined || !exactKeys(candidate, ['value', 'label']) || typeof candidate.value !== 'string' || !isSafeDramaRef(candidate.value) || !safeText(candidate.label)
  }))) return false
  if ((field.kind === 'select' || field.kind === 'multiselect') && (!Array.isArray(field.options) || field.options.length === 0)) return false
  return field.artifactKinds === undefined || safeRefArray(field.artifactKinds, 32)
}

function validActionDescriptor(input: unknown): input is PaneActionDescriptorV1 {
  const value = record(input)
  if (value === undefined || !exactKeys(value, ['schema', 'descriptorRef', 'owner', 'actionId', 'label', 'targetRef', 'targetVersion', 'context', 'risk', 'confirmation', 'expiresAt', 'preview', 'fields', 'presentation'])) return false
  const preview = record(value.preview)
  if (value.schema !== PANE_ACTION_DESCRIPTOR_SCHEMA || typeof value.descriptorRef !== 'string' || !isSafeDramaRef(value.descriptorRef)) return false
  if (typeof value.owner !== 'string' || !isSafeDramaRef(value.owner) || typeof value.actionId !== 'string' || !isSafeDramaRef(value.actionId)) return false
  if (!safeText(value.label) || typeof value.targetRef !== 'string' || !isSafeDramaRef(value.targetRef) || typeof value.targetVersion !== 'string' || !isSafeDramaRef(value.targetVersion)) return false
  if (!validPaneContext(value.context) || !['low', 'medium', 'high'].includes(value.risk as string) || !['none', 'confirm', 'approval'].includes(value.confirmation as string)) return false
  if (typeof value.expiresAt !== 'string' || value.expiresAt.length > 80 || !Number.isFinite(Date.parse(value.expiresAt))) return false
  if (preview === undefined || !exactKeys(preview, ['summary', 'cost', 'rights', 'evidenceRefs']) || !safeText(preview.summary, 500)) return false
  if (preview.evidenceRefs !== undefined && !safeRefArray(preview.evidenceRefs, 64)) return false
  if (!Array.isArray(value.fields) || value.fields.length > 32 || !value.fields.every(validActionField)) return false
  const fieldKeys = value.fields.map(field => record(field)?.key)
  return new Set(fieldKeys).size === fieldKeys.length && safeBlob(input)
}

function validActionValue(value: unknown): boolean {
  if (typeof value === 'string') return value.length <= 16_384 && safeBlob(value)
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.length <= 64 && value.every(item => typeof item === 'string' && item.length <= 512 && safeBlob(item))
  return value !== undefined && validArtifact(value)
}

function validActionRequest(input: unknown): input is PaneActionRequestV1 {
  const value = record(input)
  const values = value === undefined ? undefined : record(value.values)
  return value !== undefined
    && exactKeys(value, ['schema', 'descriptorRef', 'owner', 'actionId', 'expectedTargetRef', 'expectedTargetVersion', 'context', 'idempotencyKey', 'values'])
    && value.schema === PANE_ACTION_REQUEST_SCHEMA
    && typeof value.descriptorRef === 'string' && isSafeDramaRef(value.descriptorRef)
    && typeof value.owner === 'string' && isSafeDramaRef(value.owner)
    && typeof value.actionId === 'string' && isSafeDramaRef(value.actionId)
    && typeof value.expectedTargetRef === 'string' && isSafeDramaRef(value.expectedTargetRef)
    && typeof value.expectedTargetVersion === 'string' && isSafeDramaRef(value.expectedTargetVersion)
    && validPaneContext(value.context)
    && typeof value.idempotencyKey === 'string' && value.idempotencyKey.length >= 8 && value.idempotencyKey.length <= 160 && safeBlob(value.idempotencyKey)
    && values !== undefined && Object.keys(values).length <= 32 && Object.values(values).every(validActionValue)
    && safeBlob(input)
}

function validActionReceipt(input: unknown): input is PaneActionReceiptV1 {
  const value = record(input)
  if (value === undefined || !exactKeys(value, ['status', 'receiptRef', 'actionId', 'owner', 'summary', 'outputArtifacts', 'evidenceRefs', 'reconcileReason'])) return false
  if (!['pending', 'accepted', 'completed', 'partial', 'failed', 'approval_required', 'rejected', 'unknown', 'reconcile_required'].includes(value.status as string)) return false
  if (typeof value.receiptRef !== 'string' || !isSafeDramaRef(value.receiptRef)) return false
  for (const key of ['actionId', 'owner'] as const) if (value[key] !== undefined && (typeof value[key] !== 'string' || !isSafeDramaRef(value[key] as string))) return false
  for (const key of ['summary', 'reconcileReason'] as const) if (value[key] !== undefined && !safeText(value[key], 500)) return false
  if (value.outputArtifacts !== undefined && (!Array.isArray(value.outputArtifacts) || value.outputArtifacts.length > 64 || !value.outputArtifacts.every(item => validArtifact(item)))) return false
  return (value.evidenceRefs === undefined || safeRefArray(value.evidenceRefs, 64)) && safeBlob(input)
}

export function validateDramaShowControlBinding(input: unknown): input is DramaShowControlBindingV1 {
  const value = record(input)
  if (value === undefined || !exactKeys(value, ['tenantRef', 'workspaceRef', 'principalRef', 'runtimeGeneration', 'showRef', 'contextRevision'])) return false
  return ['tenantRef', 'workspaceRef', 'principalRef', 'runtimeGeneration', 'showRef', 'contextRevision']
    .every(key => typeof value[key] === 'string' && isSafeDramaRef(value[key] as string))
}

function validStatus(value: unknown): value is DramaShowControlStatusV1 {
  return value === 'ready' || value === 'partial' || value === 'needs_contract' || value === 'permission_denied' || value === 'contract_mismatch'
}

function validFreshness(value: unknown): value is DramaShowControlFreshnessV1 {
  return value === 'fresh' || value === 'stale' || value === 'offline' || value === 'unknown'
}

export function normalizeDramaShowEpisodeQuery(input: unknown): (Required<Pick<DramaShowEpisodeQueryV1, 'showRef' | 'limit'>> & Omit<DramaShowEpisodeQueryV1, 'limit'>) | undefined {
  const value = record(input)
  if (value === undefined || !exactKeys(value, ['showRef', 'cursor', 'limit', 'stage', 'status', 'attention'])) return undefined
  if (typeof value.showRef !== 'string' || !isSafeDramaRef(value.showRef)) return undefined
  if (value.cursor !== undefined && (typeof value.cursor !== 'string' || !isSafeDramaRef(value.cursor))) return undefined
  const limit = value.limit ?? DRAMA_SHOW_CONTROL_DEFAULT_PAGE_SIZE
  if (!safeCount(limit) || limit < 1 || limit > DRAMA_SHOW_CONTROL_MAX_PAGE_SIZE) return undefined
  if (value.stage !== undefined && !['prepare', 'text', 'visual', 'shots', 'review', 'export'].includes(value.stage as string)) return undefined
  if (value.status !== undefined && !['pending', 'running', 'ready', 'attention', 'blocked'].includes(value.status as string)) return undefined
  if (value.attention !== undefined && typeof value.attention !== 'boolean') return undefined
  return { ...(input as DramaShowEpisodeQueryV1), limit }
}

export function normalizeDramaShowReviewQuery(input: unknown): (Required<Pick<DramaShowReviewQueryV1, 'showRef' | 'limit'>> & Omit<DramaShowReviewQueryV1, 'limit'>) | undefined {
  const value = record(input)
  if (value === undefined || !exactKeys(value, ['showRef', 'cursor', 'limit', 'episodeRef', 'owner', 'status', 'risk'])) return undefined
  if (typeof value.showRef !== 'string' || !isSafeDramaRef(value.showRef)) return undefined
  for (const key of ['cursor', 'episodeRef', 'owner'] as const) if (value[key] !== undefined && (typeof value[key] !== 'string' || !isSafeDramaRef(value[key] as string))) return undefined
  const limit = value.limit ?? DRAMA_SHOW_CONTROL_DEFAULT_PAGE_SIZE
  if (!safeCount(limit) || limit < 1 || limit > DRAMA_SHOW_CONTROL_MAX_PAGE_SIZE) return undefined
  if (value.status !== undefined && !['pending', 'approved', 'rejected', 'partial', 'blocked'].includes(value.status as string)) return undefined
  if (value.risk !== undefined && !['low', 'medium', 'high'].includes(value.risk as string)) return undefined
  return { ...(input as DramaShowReviewQueryV1), limit }
}

export function normalizeDramaShowAssetQuery(input: unknown): (Required<Pick<DramaShowAssetQueryV1, 'showRef' | 'limit'>> & Omit<DramaShowAssetQueryV1, 'limit'>) | undefined {
  const value = record(input)
  if (value === undefined || !exactKeys(value, ['showRef', 'cursor', 'limit', 'episodeRef', 'owner', 'kind', 'status'])) return undefined
  if (typeof value.showRef !== 'string' || !isSafeDramaRef(value.showRef)) return undefined
  for (const key of ['cursor', 'episodeRef', 'owner', 'kind', 'status'] as const) if (value[key] !== undefined && (typeof value[key] !== 'string' || !isSafeDramaRef(value[key] as string))) return undefined
  const limit = value.limit ?? DRAMA_SHOW_CONTROL_DEFAULT_PAGE_SIZE
  if (!safeCount(limit) || limit < 1 || limit > DRAMA_SHOW_CONTROL_MAX_PAGE_SIZE) return undefined
  return { ...(input as DramaShowAssetQueryV1), limit }
}

export function validateDramaShowActionPreviewRequest(input: unknown): input is DramaShowActionPreviewRequestV1 {
  const value = record(input)
  if (value === undefined || !exactKeys(value, ['showRef', 'actionId', 'targetRefs', 'targetVersions', 'annotationBatchRef', 'idempotencyKey'])) return false
  if (typeof value.showRef !== 'string' || !isSafeDramaRef(value.showRef)) return false
  if (typeof value.actionId !== 'string' || !isSafeDramaRef(value.actionId)) return false
  if (!safeRefArray(value.targetRefs) || value.targetRefs.length < 1 || new Set(value.targetRefs).size !== value.targetRefs.length) return false
  const versions = record(value.targetVersions)
  if (versions === undefined || !exactKeys(versions, value.targetRefs)) return false
  if (value.annotationBatchRef !== undefined && (typeof value.annotationBatchRef !== 'string' || !isSafeDramaRef(value.annotationBatchRef))) return false
  if (value.idempotencyKey !== undefined && (typeof value.idempotencyKey !== 'string' || value.idempotencyKey.length < 8 || value.idempotencyKey.length > 160 || !isSafeDramaRef(value.idempotencyKey))) return false
  return value.targetRefs.every(target => typeof versions[target] === 'string' && isSafeDramaRef(versions[target] as string)) && safeBlob(input)
}

function validateSnapshotCommon(input: unknown, schemaVersion: string): input is Record<string, unknown> {
  const value = record(input)
  return value !== undefined
    && value.schemaVersion === schemaVersion
    && typeof value.snapshotRef === 'string' && isSafeDramaRef(value.snapshotRef)
    && safeCount(value.snapshotVersion)
    && typeof value.showRef === 'string' && isSafeDramaRef(value.showRef)
    && validStatus(value.status)
    && validFreshness(value.freshness)
    && safeText(value.safeMessage, 500)
    && safeBlob(input)
}

export function validateDramaShowControlSnapshot(input: unknown): input is DramaShowControlSnapshotV1 {
  if (!validateSnapshotCommon(input, DRAMA_SHOW_CONTROL_SNAPSHOT_SCHEMA)) return false
  const raw = record(input)!
  if (!exactKeys(raw, ['schemaVersion', 'snapshotRef', 'snapshotVersion', 'generatedAt', 'showRef', 'showVersion', 'title', 'status', 'freshness', 'safeMessage', 'summary', 'blockerRefs', 'evidenceRefs'])) return false
  const summary = record(raw.summary)
  if (summary === undefined || !exactKeys(summary, ['episodeCount', 'activeEpisodeCount', 'reviewCount', 'attentionCount', 'assetCount', 'deliveryReadyCount'])) return false
  const value = input as unknown as DramaShowControlSnapshotV1
  return typeof value.generatedAt === 'string' && value.generatedAt.length <= 80 && Number.isFinite(Date.parse(value.generatedAt))
    && isSafeDramaRef(value.showVersion)
    && safeText(value.title)
    && safeCount(value.summary?.episodeCount)
    && safeCount(value.summary?.activeEpisodeCount)
    && safeCount(value.summary?.reviewCount)
    && safeCount(value.summary?.attentionCount)
    && safeCount(value.summary?.assetCount)
    && safeCount(value.summary?.deliveryReadyCount)
    && safeRefArray(value.blockerRefs)
    && safeRefArray(value.evidenceRefs)
}

function validatePage<T>(input: unknown, schema: string, validateItem: (item: unknown) => item is T): input is DramaShowPageV1<T, string> {
  if (!validateSnapshotCommon(input, schema)) return false
  const raw = record(input)!
  if (!exactKeys(raw, ['schemaVersion', 'snapshotRef', 'snapshotVersion', 'showRef', 'status', 'freshness', 'safeMessage', 'items', 'nextCursor'])) return false
  const value = input as unknown as DramaShowPageV1<T, string>
  return Array.isArray(value.items)
    && value.items.length <= DRAMA_SHOW_CONTROL_MAX_PAGE_SIZE
    && value.items.every(validateItem)
    && (value.nextCursor === undefined || isSafeDramaRef(value.nextCursor))
}

function validateEpisode(item: unknown): item is DramaShowEpisodeV1 {
  const value = record(item)
  return value !== undefined && exactKeys(value, ['ref', 'version', 'title', 'ordinal', 'stage', 'status', 'progress', 'attentionCount', 'summary', 'evidenceRefs'])
    && typeof value.ref === 'string' && isSafeDramaRef(value.ref)
    && typeof value.version === 'string' && isSafeDramaRef(value.version)
    && safeText(value.title) && safeCount(value.ordinal)
    && ['prepare', 'text', 'visual', 'shots', 'review', 'export'].includes(value.stage as string)
    && ['pending', 'running', 'ready', 'attention', 'blocked'].includes(value.status as string)
    && typeof value.progress === 'number' && value.progress >= 0 && value.progress <= 1
    && safeCount(value.attentionCount) && safeRefArray(value.evidenceRefs)
    && (value.summary === undefined || safeText(value.summary, 500)) && safeBlob(item)
}

function validArtifact(value: unknown): value is ArtifactRefV1 {
  if (value === undefined) return true
  const artifact = record(value)
  return artifact !== undefined
    && exactKeys(artifact, ['schema', 'owner', 'kind', 'ref', 'version', 'mediaType', 'title', 'summary', 'evidenceRefs', 'capabilities'])
    && artifact.schema === 'pane.artifact.v1alpha1'
    && typeof artifact.owner === 'string' && isSafeDramaRef(artifact.owner)
    && typeof artifact.kind === 'string' && isSafeDramaRef(artifact.kind)
    && typeof artifact.ref === 'string' && isSafeDramaRef(artifact.ref)
    && typeof artifact.version === 'string' && isSafeDramaRef(artifact.version)
    && safeText(artifact.mediaType, 160)
    && safeText(artifact.title)
    && (artifact.summary === undefined || safeText(artifact.summary, 500))
    && safeRefArray(artifact.evidenceRefs, 64)
    && safeRefArray(artifact.capabilities, 64)
    && safeBlob(value)
}

function validateReview(item: unknown): item is DramaShowReviewV1 {
  const value = record(item)
  return value !== undefined && exactKeys(value, ['ref', 'version', 'episodeRef', 'owner', 'title', 'status', 'risk', 'summary', 'artifact', 'annotation', 'evidenceRefs'])
    && typeof value.ref === 'string' && isSafeDramaRef(value.ref)
    && typeof value.version === 'string' && isSafeDramaRef(value.version)
    && typeof value.episodeRef === 'string' && isSafeDramaRef(value.episodeRef)
    && typeof value.owner === 'string' && isSafeDramaRef(value.owner)
    && safeText(value.title)
    && ['pending', 'approved', 'rejected', 'partial', 'blocked'].includes(value.status as string)
    && ['low', 'medium', 'high'].includes(value.risk as string)
    && (value.summary === undefined || safeText(value.summary, 500))
    && validArtifact(value.artifact) && validReviewAnnotation(value.annotation) && safeRefArray(value.evidenceRefs) && safeBlob(item)
}

function validReviewAnnotation(input: unknown): input is DramaShowReviewAnnotationProjectionV1 | undefined {
  if (input === undefined) return true
  const value = record(input)
  return value !== undefined && exactKeys(value, ['artifactRef', 'artifactVersion', 'quoteDigest', 'allowedKinds'])
    && typeof value.artifactRef === 'string' && isSafeDramaRef(value.artifactRef)
    && typeof value.artifactVersion === 'string' && isSafeDramaRef(value.artifactVersion)
    && typeof value.quoteDigest === 'string' && /^[a-f0-9]{64}$/u.test(value.quoteDigest)
    && Array.isArray(value.allowedKinds) && value.allowedKinds.length > 0 && value.allowedKinds.length <= 5
    && value.allowedKinds.every(kind => ['image-point', 'image-region', 'media-frame', 'media-time-point', 'media-time-region'].includes(kind as string))
}

function validateAsset(item: unknown): item is DramaShowAssetV1 {
  const value = record(item)
  return value !== undefined && exactKeys(value, ['ref', 'version', 'episodeRef', 'owner', 'kind', 'title', 'status', 'summary', 'artifact', 'rightsSummary', 'evidenceRefs'])
    && typeof value.ref === 'string' && isSafeDramaRef(value.ref)
    && typeof value.version === 'string' && isSafeDramaRef(value.version)
    && typeof value.episodeRef === 'string' && isSafeDramaRef(value.episodeRef)
    && typeof value.owner === 'string' && isSafeDramaRef(value.owner)
    && typeof value.kind === 'string' && isSafeDramaRef(value.kind)
    && safeText(value.title) && typeof value.status === 'string' && isSafeDramaRef(value.status)
    && (value.summary === undefined || safeText(value.summary, 500))
    && (value.rightsSummary === undefined || safeText(value.rightsSummary, 500))
    && validArtifact(value.artifact) && safeRefArray(value.evidenceRefs) && safeBlob(item)
}

export const validateDramaShowEpisodePage = (input: unknown): input is DramaShowEpisodePageV1 => validatePage(input, DRAMA_SHOW_CONTROL_EPISODE_PAGE_SCHEMA, validateEpisode)
export const validateDramaShowReviewPage = (input: unknown): input is DramaShowReviewPageV1 => validatePage(input, DRAMA_SHOW_CONTROL_REVIEW_PAGE_SCHEMA, validateReview)
export const validateDramaShowAssetPage = (input: unknown): input is DramaShowAssetPageV1 => validatePage(input, DRAMA_SHOW_CONTROL_ASSET_PAGE_SCHEMA, validateAsset)

function validateDeliveryItem(input: unknown): input is DramaShowDeliveryItemV1 {
  const item = record(input)
  if (item === undefined || !exactKeys(item, ['ref', 'version', 'episodeRef', 'title', 'status', 'rightsStatus', 'evidenceStatus', 'previousVersion', 'versionDifference', 'rightsSummary', 'evidenceSummary', 'blockerRefs', 'evidenceRefs', 'actions', 'receiptHistory'])) return false
  if (!isSafeDramaRef(item.ref as string) || !isSafeDramaRef(item.version as string) || !isSafeDramaRef(item.episodeRef as string) || !safeText(item.title)) return false
  if (!['ready', 'blocked', 'attention', 'submitted'].includes(item.status as string) || !['ready', 'attention', 'blocked', 'unknown'].includes(item.rightsStatus as string) || !['ready', 'attention', 'blocked', 'unknown'].includes(item.evidenceStatus as string)) return false
  if (item.previousVersion !== undefined && (typeof item.previousVersion !== 'string' || !isSafeDramaRef(item.previousVersion))) return false
  if (item.versionDifference !== undefined) {
    const difference = record(item.versionDifference)
    if (difference === undefined || !exactKeys(difference, ['changed', 'summary']) || typeof difference.changed !== 'boolean' || !safeText(difference.summary, 500)) return false
  }
  if (item.rightsSummary !== undefined && !safeText(item.rightsSummary, 500)) return false
  if (item.evidenceSummary !== undefined && !safeText(item.evidenceSummary, 500)) return false
  if (!safeRefArray(item.blockerRefs) || !safeRefArray(item.evidenceRefs)) return false
  if (item.actions !== undefined && (!Array.isArray(item.actions) || item.actions.length > 16 || item.actions.some(raw => {
    const action = record(raw)
    return action === undefined || !exactKeys(action, ['actionId', 'label', 'kind', 'disabledReason']) || typeof action.actionId !== 'string' || !isSafeDramaRef(action.actionId) || !safeText(action.label) || !['prepare', 'submit', 'remediate'].includes(action.kind as string) || (action.disabledReason !== undefined && !safeText(action.disabledReason, 500))
  }))) return false
  return (item.receiptHistory === undefined || (Array.isArray(item.receiptHistory) && item.receiptHistory.length <= 50 && item.receiptHistory.every(validActionReceipt))) && safeBlob(input)
}

export function validateDramaShowDelivery(input: unknown): input is DramaShowDeliveryV1 {
  if (!validateSnapshotCommon(input, DRAMA_SHOW_CONTROL_DELIVERY_SCHEMA)) return false
  const raw = record(input)!
  if (!exactKeys(raw, ['schemaVersion', 'snapshotRef', 'snapshotVersion', 'generatedAt', 'showRef', 'status', 'freshness', 'safeMessage', 'readyCount', 'totalCount', 'items', 'blockerRefs', 'evidenceRefs'])) return false
  const value = input as unknown as DramaShowDeliveryV1
  return typeof value.generatedAt === 'string' && value.generatedAt.length <= 80 && Number.isFinite(Date.parse(value.generatedAt)) && safeCount(value.readyCount) && safeCount(value.totalCount)
    && value.readyCount <= value.totalCount && Array.isArray(value.items) && value.items.length <= DRAMA_SHOW_CONTROL_MAX_PAGE_SIZE
    && value.items.every(validateDeliveryItem)
    && safeRefArray(value.blockerRefs) && safeRefArray(value.evidenceRefs) && safeBlob(input)
}

function bindingMatches(left: DramaShowControlBindingV1, right: DramaShowControlBindingV1): boolean {
  return left.tenantRef === right.tenantRef
    && left.workspaceRef === right.workspaceRef
    && left.principalRef === right.principalRef
    && left.runtimeGeneration === right.runtimeGeneration
    && left.showRef === right.showRef
    && left.contextRevision === right.contextRevision
}

export class DramaShowControlOwnerDirectory {
  private adapter: DramaShowControlOwnerAdapterV1 | undefined

  register(adapter: DramaShowControlOwnerAdapterV1): () => void {
    if (!isSafeDramaRef(adapter.id)) throw new Error('invalid_show_control_adapter_id')
    if (this.adapter !== undefined) throw new Error('show_control_adapter_already_registered')
    this.adapter = adapter
    let active = true
    return () => {
      if (!active) return
      active = false
      if (this.adapter === adapter) this.adapter = undefined
    }
  }

  current(): DramaShowControlOwnerAdapterV1 | undefined {
    return this.adapter
  }
}

function needsContractSnapshot(binding: DramaShowControlBindingV1): DramaShowControlSnapshotV1 {
  return {
    schemaVersion: DRAMA_SHOW_CONTROL_SNAPSHOT_SCHEMA,
    snapshotRef: `show-control:${binding.runtimeGeneration}:unavailable`,
    snapshotVersion: 0,
    generatedAt: new Date(0).toISOString(),
    showRef: binding.showRef,
    showVersion: 'unavailable',
    title: 'Show Control',
    status: 'needs_contract',
    freshness: 'unknown',
    safeMessage: 'A show-control owner adapter is required.',
    summary: { episodeCount: 0, activeEpisodeCount: 0, reviewCount: 0, attentionCount: 0, assetCount: 0, deliveryReadyCount: 0 },
    blockerRefs: [],
    evidenceRefs: [],
  }
}

function emptyPage<T, TSchema extends string>(binding: DramaShowControlBindingV1, schemaVersion: TSchema): DramaShowPageV1<T, TSchema> {
  return {
    schemaVersion,
    snapshotRef: `show-control:${binding.runtimeGeneration}:unavailable`,
    snapshotVersion: 0,
    showRef: binding.showRef,
    status: 'needs_contract',
    freshness: 'unknown',
    safeMessage: 'A show-control owner adapter is required.',
    items: [],
  }
}

function unavailableReceipt(actionId: string, reason: string): PaneActionReceiptV1 {
  return {
    status: 'reconcile_required',
    receiptRef: `receipt:show-control:${actionId.replace(/[^A-Za-z0-9._~:-]/g, '-').slice(0, 80)}`,
    owner: 'drama-show-control',
    actionId,
    summary: 'Show-control owner settlement is unavailable.',
    reconcileReason: reason,
  }
}

export function createDramaShowControlGateway(input: {
  readonly binding: DramaShowControlBindingV1
  readonly directory: DramaShowControlOwnerDirectory
  readonly now?: () => number
}): DramaShowControlRemoteV1 {
  if (!validateDramaShowControlBinding(input.binding)) throw new Error('invalid_show_control_binding')
  const binding = Object.freeze({ ...input.binding })
  const now = input.now ?? Date.now
  const assertShow = (showRef: string): boolean => showRef === binding.showRef && isSafeDramaRef(showRef)
  const adapter = (): DramaShowControlOwnerAdapterV1 | undefined => input.directory.current()

  return {
    async snapshot(showRef) {
      if (!assertShow(showRef)) return { ...needsContractSnapshot(binding), status: 'permission_denied', safeMessage: 'The requested show is outside the bound context.' }
      const owner = adapter()
      if (owner === undefined) return needsContractSnapshot(binding)
      const result = await owner.snapshot(binding)
      return validateDramaShowControlSnapshot(result) && result.showRef === binding.showRef ? result : { ...needsContractSnapshot(binding), status: 'contract_mismatch', safeMessage: 'The owner returned an invalid show snapshot.' }
    },
    async episodes(raw) {
      const query = normalizeDramaShowEpisodeQuery(raw)
      if (query === undefined || !assertShow(raw.showRef)) return { ...emptyPage<DramaShowEpisodeV1, typeof DRAMA_SHOW_CONTROL_EPISODE_PAGE_SCHEMA>(binding, DRAMA_SHOW_CONTROL_EPISODE_PAGE_SCHEMA), status: 'contract_mismatch', safeMessage: 'The episode query is invalid or outside the bound show.' }
      const owner = adapter()
      if (owner === undefined) return emptyPage(binding, DRAMA_SHOW_CONTROL_EPISODE_PAGE_SCHEMA)
      const result = await owner.episodes(query, binding)
      return validateDramaShowEpisodePage(result) && result.showRef === binding.showRef ? result : { ...emptyPage<DramaShowEpisodeV1, typeof DRAMA_SHOW_CONTROL_EPISODE_PAGE_SCHEMA>(binding, DRAMA_SHOW_CONTROL_EPISODE_PAGE_SCHEMA), status: 'contract_mismatch', safeMessage: 'The owner returned an invalid episode page.' }
    },
    async reviews(raw) {
      const query = normalizeDramaShowReviewQuery(raw)
      if (query === undefined || !assertShow(raw.showRef)) return { ...emptyPage<DramaShowReviewV1, typeof DRAMA_SHOW_CONTROL_REVIEW_PAGE_SCHEMA>(binding, DRAMA_SHOW_CONTROL_REVIEW_PAGE_SCHEMA), status: 'contract_mismatch', safeMessage: 'The review query is invalid or outside the bound show.' }
      const owner = adapter()
      if (owner === undefined) return emptyPage(binding, DRAMA_SHOW_CONTROL_REVIEW_PAGE_SCHEMA)
      const result = await owner.reviews(query, binding)
      return validateDramaShowReviewPage(result) && result.showRef === binding.showRef ? result : { ...emptyPage<DramaShowReviewV1, typeof DRAMA_SHOW_CONTROL_REVIEW_PAGE_SCHEMA>(binding, DRAMA_SHOW_CONTROL_REVIEW_PAGE_SCHEMA), status: 'contract_mismatch', safeMessage: 'The owner returned an invalid review page.' }
    },
    async assets(raw) {
      const query = normalizeDramaShowAssetQuery(raw)
      if (query === undefined || !assertShow(raw.showRef)) return { ...emptyPage<DramaShowAssetV1, typeof DRAMA_SHOW_CONTROL_ASSET_PAGE_SCHEMA>(binding, DRAMA_SHOW_CONTROL_ASSET_PAGE_SCHEMA), status: 'contract_mismatch', safeMessage: 'The asset query is invalid or outside the bound show.' }
      const owner = adapter()
      if (owner === undefined) return emptyPage(binding, DRAMA_SHOW_CONTROL_ASSET_PAGE_SCHEMA)
      const result = await owner.assets(query, binding)
      return validateDramaShowAssetPage(result) && result.showRef === binding.showRef ? result : { ...emptyPage<DramaShowAssetV1, typeof DRAMA_SHOW_CONTROL_ASSET_PAGE_SCHEMA>(binding, DRAMA_SHOW_CONTROL_ASSET_PAGE_SCHEMA), status: 'contract_mismatch', safeMessage: 'The owner returned an invalid asset page.' }
    },
    async delivery(showRef) {
      if (!assertShow(showRef)) return { schemaVersion: DRAMA_SHOW_CONTROL_DELIVERY_SCHEMA, snapshotRef: `show-control:${binding.runtimeGeneration}:unavailable`, snapshotVersion: 0, generatedAt: new Date(0).toISOString(), showRef: binding.showRef, status: 'permission_denied', freshness: 'unknown', safeMessage: 'The requested show is outside the bound context.', readyCount: 0, totalCount: 0, items: [], blockerRefs: [], evidenceRefs: [] }
      const owner = adapter()
      if (owner === undefined) return { schemaVersion: DRAMA_SHOW_CONTROL_DELIVERY_SCHEMA, snapshotRef: `show-control:${binding.runtimeGeneration}:unavailable`, snapshotVersion: 0, generatedAt: new Date(0).toISOString(), showRef: binding.showRef, status: 'needs_contract', freshness: 'unknown', safeMessage: 'A show-control owner adapter is required.', readyCount: 0, totalCount: 0, items: [], blockerRefs: [], evidenceRefs: [] }
      const result = await owner.delivery(binding)
      return validateDramaShowDelivery(result) && result.showRef === binding.showRef ? result : { schemaVersion: DRAMA_SHOW_CONTROL_DELIVERY_SCHEMA, snapshotRef: `show-control:${binding.runtimeGeneration}:invalid`, snapshotVersion: 0, generatedAt: new Date(0).toISOString(), showRef: binding.showRef, status: 'contract_mismatch', freshness: 'unknown', safeMessage: 'The owner returned an invalid delivery projection.', readyCount: 0, totalCount: 0, items: [], blockerRefs: [], evidenceRefs: [] }
    },
    async previewAction(request) {
      if (!validateDramaShowActionPreviewRequest(request) || !assertShow(request.showRef)) {
        throw new Error('invalid_show_control_action_preview')
      }
      const owner = adapter()
      if (owner === undefined) throw new Error('show_control_owner_unavailable')
      const descriptor = await owner.previewAction(request, binding)
      if (!validActionDescriptor(descriptor) || descriptor.context.workspaceRef !== binding.workspaceRef || descriptor.context.revision !== binding.contextRevision || Date.parse(descriptor.expiresAt) <= now()) {
        throw new Error('show_control_descriptor_contract_mismatch')
      }
      return descriptor
    },
    async dispatch(request) {
      if (!validActionRequest(request)) return unavailableReceipt('show-control.dispatch', 'request_contract_mismatch')
      if (request.context.workspaceRef !== binding.workspaceRef || request.context.revision !== binding.contextRevision) return unavailableReceipt(request.actionId, 'context_mismatch')
      const owner = adapter()
      if (owner === undefined) return unavailableReceipt(request.actionId, 'owner_unavailable')
      try {
        const receipt = await owner.dispatch(request, binding)
        return validActionReceipt(receipt) ? receipt : unavailableReceipt(request.actionId, 'receipt_contract_mismatch')
      } catch {
        return unavailableReceipt(request.actionId, 'settlement_unknown')
      }
    },
  }
}

/** Adapter conformance probe used by typed fakes and service adapters. */
export async function verifyDramaShowControlAdapter(
  adapter: DramaShowControlOwnerAdapterV1,
  binding: DramaShowControlBindingV1,
): Promise<{ readonly ok: boolean; readonly failures: readonly string[] }> {
  const failures: string[] = []
  const directory = new DramaShowControlOwnerDirectory()
  const unregister = directory.register(adapter)
  const gateway = createDramaShowControlGateway({ binding, directory })
  try {
    if (!validateDramaShowControlSnapshot(await gateway.snapshot(binding.showRef))) failures.push('snapshot')
    if (!validateDramaShowEpisodePage(await gateway.episodes({ showRef: binding.showRef }))) failures.push('episodes')
    if (!validateDramaShowReviewPage(await gateway.reviews({ showRef: binding.showRef }))) failures.push('reviews')
    if (!validateDramaShowAssetPage(await gateway.assets({ showRef: binding.showRef }))) failures.push('assets')
    if (!validateDramaShowDelivery(await gateway.delivery(binding.showRef))) failures.push('delivery')
  } finally {
    unregister()
  }
  return { ok: failures.length === 0, failures }
}
