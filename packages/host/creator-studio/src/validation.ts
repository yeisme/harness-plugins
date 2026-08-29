import { z } from 'zod'
import {
  ArtifactRefSchema,
  PaneActionDescriptorSchema,
  PaneActionReceiptSchema,
  PaneContextSchema,
  PaneStatusSchema,
  type PaneActionDescriptorV1,
  type PaneActionReceiptV1,
  type PaneContextV1,
} from '@yeisme/dsh-pane-protocol'
import {
  CREATOR_STUDIO_OWNERS,
  type CreatorApprovalDecisionV1,
  type CreatorAssetPageV1,
  type CreatorAssetQueryV1,
  type CreatorAssetV1,
  type CreatorMediaAccessV1,
  type CreatorOwnerSnapshotV1,
  type CreatorOwnerAssetListV1,
  type CreatorStudioContextV1,
  type CreatorStudioSnapshotV1,
} from './types.ts'

const safeRef = z.string().min(1).max(512).regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u)
const safeKey = z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u)
const safeText = z.string().min(1).max(2_048).refine(value => !/[\u0000-\u001f\u007f]/u.test(value), 'control characters are not allowed')
  .refine(value => !/(?:https?:\/\/|wss?:\/\/|\bBearer\b|\bapi[_-]?key\b|(?:^|\s)(?:\/home\/|\/Users\/|[A-Za-z]:[\\/]))/iu.test(value), 'unsafe projection text')
const isoTimestamp = z.string().min(1).max(80).refine(value => Number.isFinite(Date.parse(value)), 'must be an ISO timestamp')

function sameCreatorStudioContext(left: PaneContextV1, right: PaneContextV1): boolean {
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

export const creatorStudioContextSchema = PaneContextSchema.superRefine((value, ctx) => {
  for (const key of ['tenantRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration'] as const) {
    if (value[key] === undefined) ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required` })
  }
})

const metricSchema = z.object({
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(160),
  tone: z.enum(['neutral', 'positive', 'warning', 'critical']).optional(),
}).strict()

const textPreviewSchema = z.object({
  before: z.string().max(1_200).optional(),
  after: z.string().max(1_200).optional(),
}).strict()

const resourceSchema = z.object({
  ref: safeRef,
  version: z.string().min(1).max(160),
  kind: safeKey,
  title: z.string().min(1).max(160),
  status: safeKey,
  summary: z.string().max(1_000).optional(),
  partial: z.boolean().optional(),
  progress: z.number().finite().min(0).max(1).optional(),
  artifact: ArtifactRefSchema.optional(),
  badges: z.array(z.string().min(1).max(64)).max(16).optional(),
  metrics: z.array(metricSchema).max(16).optional(),
  waveform: z.array(z.number().finite().min(0).max(1)).max(256).optional(),
  textPreview: textPreviewSchema.optional(),
  evidenceRefs: z.array(safeRef).max(64),
}).strict()

const assetSchema = resourceSchema.extend({
  owner: z.enum(CREATOR_STUDIO_OWNERS),
  projectRef: safeRef,
  rightsSummary: safeText.optional(),
  lineageRefs: z.array(safeRef).max(64).optional(),
}).strict()

export const creatorAssetQuerySchema = z.object({
  scope: z.enum(['current_project', 'all_projects']),
  cursor: safeRef.optional(),
  limit: z.number().int().min(1).max(200).optional(),
  owner: z.enum(CREATOR_STUDIO_OWNERS).optional(),
  kind: safeKey.optional(),
  status: safeKey.optional(),
  text: z.string().min(1).max(160).refine(value => !/[\u0000-\u001f\u007f]/u.test(value), 'control characters are not allowed').optional(),
}).strict()

export const creatorAssetPageSchema = z.object({
  schemaVersion: z.literal('creator.asset.page.v1alpha1'),
  scope: z.enum(['current_project', 'all_projects']),
  status: z.enum(['ready', 'partial', 'needs_contract', 'permission_denied', 'contract_mismatch']),
  freshness: z.enum(['fresh', 'stale', 'unknown']),
  reasonCode: z.enum(['asset_page', 'project_context_unavailable', 'asset_contract_unavailable', 'partial_owner_projection', 'permission_denied', 'contract_mismatch']),
  safeMessage: safeText,
  items: z.array(assetSchema).max(200),
  nextCursor: safeRef.optional(),
  unavailableOwners: z.array(z.enum(CREATOR_STUDIO_OWNERS)).max(CREATOR_STUDIO_OWNERS.length),
  permissionDeniedOwners: z.array(z.enum(CREATOR_STUDIO_OWNERS)).max(CREATOR_STUDIO_OWNERS.length).optional(),
}).strict()

const creatorOwnerAssetListSchema = z.object({
  status: z.enum(['ready', 'permission_denied', 'needs_contract']),
  safeMessage: safeText,
  items: z.array(assetSchema).max(1_000),
}).strict().superRefine((value, ctx) => {
  if (value.status !== 'ready' && value.items.length > 0) ctx.addIssue({ code: 'custom', path: ['items'], message: 'non-ready asset lists must not contain asset facts' })
})

export const creatorApprovalDecisionSchema = z.object({ decisionRef: safeRef }).strict()

const stageIdSchema = z.enum(['prepare', 'text', 'visual', 'shots', 'review', 'export'])
const stageSchema = z.object({
  id: stageIdSchema,
  label: z.string().min(1).max(80),
  status: z.enum(['pending', 'running', 'ready', 'attention', 'blocked']),
  progress: z.number().finite().min(0).max(1),
  itemCount: z.number().int().nonnegative().max(1_000_000).optional(),
}).strict()

const productionSchema = z.object({
  ref: safeRef,
  version: z.string().min(1).max(160),
  title: z.string().min(1).max(160),
  currentStage: stageIdSchema,
  stages: z.array(stageSchema).length(6),
  blockers: z.array(z.object({
    ref: safeRef,
    title: z.string().min(1).max(160),
    severity: z.enum(['warning', 'critical']),
    summary: z.string().min(1).max(1_000),
  }).strict()).max(64),
}).strict().superRefine((value, ctx) => {
  const ids = value.stages.map(stage => stage.id)
  if (new Set(ids).size !== 6) ctx.addIssue({ code: 'custom', path: ['stages'], message: 'production stages must be unique' })
})

const ownerSchema = z.enum(CREATOR_STUDIO_OWNERS)
const reviewSchema = z.object({
  ref: safeRef,
  owner: ownerSchema,
  title: z.string().min(1).max(160),
  status: z.enum(['pending', 'approved', 'rejected', 'partial', 'blocked']),
  risk: z.enum(['low', 'medium', 'high']),
  summary: z.string().max(1_000).optional(),
  artifact: ArtifactRefSchema.optional(),
  evidenceRefs: z.array(safeRef).max(64),
}).strict()

const jobSchema = z.object({
  ref: safeRef,
  owner: ownerSchema,
  title: z.string().min(1).max(160),
  status: z.enum(['queued', 'running', 'approval_required', 'completed', 'failed', 'unknown', 'reconcile_required']),
  progress: z.number().finite().min(0).max(1).optional(),
  summary: z.string().max(1_000).optional(),
  receiptRef: safeRef.optional(),
  evidenceRefs: z.array(safeRef).max(64),
}).strict()

const generationRunSchema = z.object({
  ref: safeRef,
  source: z.literal('ordo'),
  title: safeText,
  state: safeKey,
  taskCount: z.number().int().nonnegative().max(1_000_000),
  completedTaskCount: z.number().int().nonnegative().max(1_000_000),
  attentionCount: z.number().int().nonnegative().max(1_000_000),
  freshness: z.enum(['fresh', 'stale']),
}).strict().superRefine((run, ctx) => {
  if (run.completedTaskCount > run.taskCount) ctx.addIssue({ code: 'custom', path: ['completedTaskCount'], message: 'completedTaskCount exceeds taskCount' })
})

const approvalSchema = z.object({
  ref: safeRef,
  source: z.literal('ordo'),
  targetRef: safeRef,
  targetVersion: z.string().min(1).max(160),
  ownerRef: safeRef,
  title: safeText,
  status: z.enum(['pending', 'stale']),
  expiresAt: isoTimestamp,
  previewDigest: z.string().regex(/^[a-f0-9]{64}$/u),
}).strict()

const operationsProjectionSchema = z.object({
  status: z.enum(['ready', 'stale', 'offline', 'permission_denied', 'contract_mismatch', 'needs_contract']),
  freshness: z.enum(['fresh', 'stale', 'offline']),
  reasonCode: safeKey,
  safeMessage: safeText,
}).strict()

const operationsSourceContextSchema = z.object({
  tenantRef: safeRef,
  workspaceRef: safeRef,
  principalRef: safeRef,
  contextRevision: z.number().int().nonnegative(),
  installationRef: safeRef,
}).strict()

const operationsSourceSchema = z.object({
  schemaVersion: z.literal('ordo.agent_ops.snapshot.v1alpha1'),
  snapshotRef: safeRef,
  snapshotVersion: z.number().int().nonnegative(),
  generatedAt: isoTimestamp,
  state: z.enum(['ready', 'stale', 'offline', 'permission_denied', 'contract_mismatch', 'needs_contract']),
  freshness: z.enum(['fresh', 'stale', 'offline']),
  reasonCode: safeKey,
  source: z.enum(['owner', 'owner-gated']),
  safeMessage: safeText,
  context: operationsSourceContextSchema.optional(),
  run: z.object({
    runRef: safeRef,
    state: safeKey,
    safeTitle: safeText,
    taskCount: z.number().int().nonnegative().max(1_000_000),
    completedTaskCount: z.number().int().nonnegative().max(1_000_000),
    attentionCount: z.number().int().nonnegative().max(1_000_000),
  }).strict().optional(),
  capacity: z.object({
    policyCap: z.number().int().nonnegative().max(1_000_000),
    observedOrRetained: z.number().int().nonnegative().max(1_000_000),
    qualifiedRoutes: z.number().int().nonnegative().max(1_000_000),
    reservationState: z.enum(['not_supported', 'not_reserved', 'reserved', 'stale', 'revoked', 'unknown']),
  }).strict().optional(),
  actions: z.array(z.object({
    actionType: z.enum(['ordo.reconcile.request', 'ordo.approval.decide']),
    decisionRef: safeRef,
    targetRef: safeRef,
    targetVersion: z.number().int().nonnegative(),
    ownerRef: safeRef,
    safeEffect: safeText,
    expiresAt: isoTimestamp,
    previewDigest: z.string().regex(/^[a-f0-9]{64}$/u),
    contractDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  }).strict()).max(32).optional(),
}).strict()

const operationsDecisionOutcomeSchema = z.union([
  z.object({ kind: z.literal('receipt'), receipt: z.object({ receiptRef: safeRef, state: z.enum(['accepted', 'reconcile_required', 'still_unknown']), safeSummary: safeText }).strict() }).strict(),
  z.object({ kind: z.literal('rejected'), rejection: z.object({ kind: z.literal('rejected'), reason: z.enum(['stale', 'permission_denied', 'not_available', 'expired']), safeMessage: safeText }).strict() }).strict(),
  z.object({ kind: z.literal('unknown'), state: z.enum(['still_unknown', 'reconcile_required']), safeSummary: safeText }).strict(),
])

const creatorOwnerSnapshotBaseSchema = z.object({
  schemaVersion: z.literal('creator.owner.snapshot.v1alpha1'),
  owner: ownerSchema,
  transport: z.enum(['local', 'service']),
  snapshotRef: safeRef,
  snapshotVersion: z.number().int().nonnegative(),
  cursor: safeRef,
  sequence: z.number().int().min(-1),
  generatedAt: isoTimestamp,
  context: creatorStudioContextSchema,
  status: PaneStatusSchema,
  freshness: z.enum(['fresh', 'stale', 'unknown']),
  summary: safeText,
  resources: z.array(resourceSchema).max(1_000),
  actions: z.array(PaneActionDescriptorSchema).max(64),
  production: productionSchema.optional(),
  reviews: z.array(reviewSchema).max(500).optional(),
  jobs: z.array(jobSchema).max(500).optional(),
}).strict()

export const creatorOwnerSnapshotSchema = creatorOwnerSnapshotBaseSchema.superRefine((value, ctx) => {
  if (value.owner !== 'scaena' && (value.production !== undefined || value.reviews !== undefined || value.jobs !== undefined)) {
    ctx.addIssue({ code: 'custom', message: 'only Scaena may publish the composed production, review, and job projection' })
  }
  value.actions.forEach((action, index) => {
    if (action.owner !== value.owner) ctx.addIssue({ code: 'custom', path: ['actions', index, 'owner'], message: 'action owner must match snapshot owner' })
    if (!sameCreatorStudioContext(value.context, action.context)) {
      ctx.addIssue({ code: 'custom', path: ['actions', index, 'context'], message: 'action context must match snapshot context' })
    }
  })
})

const ownerProjectionSchema = creatorOwnerSnapshotBaseSchema.omit({ context: true, transport: true }).extend({
  transport: z.enum(['local', 'service', 'unavailable']),
  context: creatorStudioContextSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.owner !== 'scaena' && (value.production !== undefined || value.reviews !== undefined || value.jobs !== undefined)) {
    ctx.addIssue({ code: 'custom', message: 'only Scaena may publish the composed production, review, and job projection' })
  }
  if (value.transport !== 'unavailable' && value.context === undefined) {
    ctx.addIssue({ code: 'custom', path: ['context'], message: 'available owner projections require context' })
  }
  value.actions.forEach((action, index) => {
    if (action.owner !== value.owner) ctx.addIssue({ code: 'custom', path: ['actions', index, 'owner'], message: 'action owner must match snapshot owner' })
    if (value.context === undefined || !sameCreatorStudioContext(value.context, action.context)) {
      ctx.addIssue({ code: 'custom', path: ['actions', index, 'context'], message: 'action context must match snapshot context' })
    }
  })
})

export const creatorStudioSnapshotSchema = z.object({
  schemaVersion: z.literal('creator.studio.snapshot.v1alpha1'),
  snapshotRef: safeRef,
  snapshotVersion: z.number().int().nonnegative(),
  generatedAt: isoTimestamp,
  status: PaneStatusSchema,
  freshness: z.enum(['fresh', 'stale', 'unknown']),
  reasonCode: z.enum(['owner_snapshot', 'context_unavailable', 'owner_directory_unavailable', 'partial_owner_projection']),
  safeMessage: safeText,
  context: creatorStudioContextSchema.optional(),
  owners: z.array(ownerProjectionSchema).length(CREATOR_STUDIO_OWNERS.length),
  production: productionSchema.optional(),
  reviews: z.array(reviewSchema).max(500),
  jobs: z.array(jobSchema).max(500),
  operations: operationsProjectionSchema.optional(),
  generationRuns: z.array(generationRunSchema).max(500).optional(),
  approvals: z.array(approvalSchema).max(500).optional(),
}).strict().superRefine((value, ctx) => {
  const owners = value.owners.map(owner => owner.owner)
  if (new Set(owners).size !== CREATOR_STUDIO_OWNERS.length) ctx.addIssue({ code: 'custom', path: ['owners'], message: 'creator owner projections must be unique' })
  value.owners.forEach((owner, index) => {
    if (owner.context !== undefined && (value.context === undefined || !sameCreatorStudioContext(value.context, owner.context))) {
      ctx.addIssue({ code: 'custom', path: ['owners', index, 'context'], message: 'owner projection context must match studio context' })
    }
  })
})

const mediaAccessSchema = z.object({
  url: z.string().min(1).max(4_096).refine(value => /^(?:https?:|blob:)/iu.test(value) && !/^(?:javascript:|data:|file:)/iu.test(value), 'unsupported media access URL'),
  expiresAt: isoTimestamp,
}).strict()

export function validateCreatorStudioContext(input: unknown): CreatorStudioContextV1 | undefined {
  const parsed = creatorStudioContextSchema.safeParse(input)
  return parsed.success ? Object.freeze({ ...parsed.data }) as CreatorStudioContextV1 : undefined
}

export function validateCreatorOwnerSnapshot(input: unknown): CreatorOwnerSnapshotV1 | undefined {
  const parsed = creatorOwnerSnapshotSchema.safeParse(input)
  return parsed.success ? parsed.data as unknown as CreatorOwnerSnapshotV1 : undefined
}

export function validateCreatorStudioSnapshot(input: unknown): CreatorStudioSnapshotV1 | undefined {
  const parsed = creatorStudioSnapshotSchema.safeParse(input)
  return parsed.success ? parsed.data as unknown as CreatorStudioSnapshotV1 : undefined
}

export function validateCreatorActionDescriptor(input: unknown): PaneActionDescriptorV1 | undefined {
  const parsed = PaneActionDescriptorSchema.safeParse(input)
  return parsed.success ? parsed.data : undefined
}

export function validateCreatorActionReceipt(input: unknown): PaneActionReceiptV1 | undefined {
  const parsed = PaneActionReceiptSchema.safeParse(input)
  return parsed.success ? parsed.data : undefined
}

export function validateCreatorMediaAccess(input: unknown): CreatorMediaAccessV1 | undefined {
  const parsed = mediaAccessSchema.safeParse(input)
  return parsed.success ? parsed.data : undefined
}

export function validateCreatorAssetQuery(input: unknown): CreatorAssetQueryV1 | undefined {
  const parsed = creatorAssetQuerySchema.safeParse(input)
  return parsed.success ? parsed.data as CreatorAssetQueryV1 : undefined
}

export function validateCreatorAsset(input: unknown): CreatorAssetV1 | undefined {
  const parsed = assetSchema.safeParse(input)
  return parsed.success ? parsed.data as CreatorAssetV1 : undefined
}

export function validateCreatorAssetPage(input: unknown): CreatorAssetPageV1 | undefined {
  const parsed = creatorAssetPageSchema.safeParse(input)
  return parsed.success ? parsed.data as CreatorAssetPageV1 : undefined
}

export function validateCreatorOwnerAssetList(input: unknown): CreatorOwnerAssetListV1 | undefined {
  const parsed = creatorOwnerAssetListSchema.safeParse(input)
  return parsed.success ? parsed.data as CreatorOwnerAssetListV1 : undefined
}

export function validateCreatorApprovalDecision(input: unknown): CreatorApprovalDecisionV1 | undefined {
  const parsed = creatorApprovalDecisionSchema.safeParse(input)
  return parsed.success ? parsed.data as CreatorApprovalDecisionV1 : undefined
}

export function validateCreatorOperationsSourceSnapshot(input: unknown) {
  const parsed = operationsSourceSchema.safeParse(input)
  return parsed.success ? parsed.data : undefined
}

export function validateCreatorOperationsDecisionOutcome(input: unknown) {
  const parsed = operationsDecisionOutcomeSchema.safeParse(input)
  return parsed.success ? parsed.data : undefined
}
