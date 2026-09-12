import { scaenaTableQuerySchema, scaenaTableResultSchema } from '@yeisme/dsh-creator-studio-host/contracts'
import { scaenaPackageQuerySchema, scaenaPackageResultSchema } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaBatchMembersQuerySchema, eikonaBatchMembersResultSchema } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaBatchPlanResultSchema } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaBatchPageQuerySchema, eikonaBatchPageResultSchema } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaBatchInputQuerySchema, eikonaBatchInputResultSchema } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaDraftQuerySchema, eikonaDraftSaveSchema, eikonaDraftReconcileSchema, eikonaDraftReadResultSchema, eikonaDraftSaveResultSchema } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaStatusInputSchema, eikonaStatusResultSchema } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaRevokeInputSchema, eikonaRevokeResultSchema } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaApprovalInputSchema, eikonaApprovalResultSchema } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaPreparationInputSchema, eikonaPreparationResultSchema } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaReviewQuerySchema, eikonaReviewResultSchema } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaSelectionQuerySchema, eikonaSelectionResultSchema } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaImageQuerySchema, eikonaImageResultSchema } from '@yeisme/dsh-creator-studio-host/contracts'
import { eikonaAssetQuerySchema, eikonaAssetPageSchema } from '@yeisme/dsh-creator-studio-host/contracts'
import { editorRecoverySaveQuerySchema, editorRecoverySavedSchema, editorRecoveryQuerySchema, editorRecoverySummarySchema, editorRecoveryPageSchema, editorRecoveryReadSchema } from '@yeisme/dsh-creator-studio-host/contracts'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import {
  ArtifactRefSchema,
  PaneActionReceiptSchema,
  PaneActionRequestSchema,
  PaneActionReconcileRequestSchema,
} from '@yeisme/dsh-pane-protocol'
import {
  validateCreatorMediaAccess,
  validateCreatorArtifactContent,
  validateCreatorApprovalDecision,
  validateCreatorAssetPage,
  validateCreatorAssetQuery,
  validateCreatorStudioSnapshot,
  validateCreatorOwnerViewSnapshot,
  validateSonoraTranscriptionCatalog,
  validateCreatorStudioContext,
} from '@yeisme/dsh-creator-studio-host/contracts'
import type { CreatorStudioRemote } from './controller.ts'
import { creatorOperationRecoveryPageSchema } from '@yeisme/dsh-creator-studio-host/contracts'
import { creatorCandidatePageSchema, creatorCandidateQuerySchema } from '@yeisme/dsh-creator-studio-host/contracts'

interface StrictSchema {
  parse(value: unknown): unknown
}

const snapshotSchema: StrictSchema = {
  parse(value) {
    const parsed = validateCreatorStudioSnapshot(value)
    if (parsed === undefined) throw new TypeError('creatorStudio.snapshot contract mismatch')
    return parsed
  },
}

const mediaSchema: StrictSchema = {
  parse(value) {
    if (value === null) return null
    const parsed = validateCreatorMediaAccess(value)
    if (parsed === undefined) throw new TypeError('creatorStudio.resolveArtifact contract mismatch')
    return parsed
  },
}

const contentSchema: StrictSchema = {
  parse(value) {
    if (value === null) return null
    const parsed = validateCreatorArtifactContent(value)
    if (parsed === undefined) throw new TypeError('creatorStudio.readArtifactContent contract mismatch')
    return parsed
  },
}

const assetQuerySchema: StrictSchema = {
  parse(value) {
    const parsed = validateCreatorAssetQuery(value)
    if (parsed === undefined) throw new TypeError('creatorStudio.assets query contract mismatch')
    return parsed
  },
}

const assetPageSchema: StrictSchema = {
  parse(value) {
    const parsed = validateCreatorAssetPage(value)
    if (parsed === undefined) throw new TypeError('creatorStudio.assets result contract mismatch')
    return parsed
  },
}

const approvalDecisionSchema: StrictSchema = {
  parse(value) {
    const parsed = validateCreatorApprovalDecision(value)
    if (parsed === undefined) throw new TypeError('creatorStudio.decideApproval query contract mismatch')
    return parsed
  },
}

const strict = (typeSymbol: string, schema: StrictSchema) => ({ mode: 'strict' as const, typeSymbol, schema })

export const creatorStudioRemoteContribution = {
  package: '@yeisme/dsh-creator-studio-host',
  descriptors: [
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.saveAuctraRecoveryDraft@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'saveAuctraRecoveryDraft', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('EditorRecoverySaveQueryV1', editorRecoverySaveQuerySchema) }],
      result: strict('EditorRecoverySavedV1', editorRecoverySavedSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.readEikonaCandidateImage@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'readEikonaCandidateImage', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('EikonaImageQueryV1', eikonaImageQuerySchema) }],
      result: strict('EikonaImageResultV1', eikonaImageResultSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.readEikonaReview@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'readEikonaReview', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('EikonaReviewQueryV1', eikonaReviewQuerySchema) }],
      result: strict('EikonaReviewResultV1', eikonaReviewResultSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.selectEikonaCandidate@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'selectEikonaCandidate', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('EikonaSelectionQueryV1', eikonaSelectionQuerySchema) }],
      result: strict('EikonaSelectionResultV1', eikonaSelectionResultSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.readEikonaDraft@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'readEikonaDraft', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('readEikonaDraftInputV1', eikonaDraftQuerySchema) }],
      result: strict('readEikonaDraftResultV1', eikonaDraftReadResultSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.saveEikonaDraft@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'saveEikonaDraft', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('saveEikonaDraftInputV1', eikonaDraftSaveSchema) }],
      result: strict('saveEikonaDraftResultV1', eikonaDraftSaveResultSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.reconcileEikonaDraft@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'reconcileEikonaDraft', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('reconcileEikonaDraftInputV1', eikonaDraftReconcileSchema) }],
      result: strict('reconcileEikonaDraftResultV1', eikonaDraftSaveResultSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.listEikonaBatchInputs@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'listEikonaBatchInputs', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('EikonaBatchPageQueryV1', eikonaBatchPageQuerySchema) }],
      result: strict('EikonaBatchPageResultV1', eikonaBatchPageResultSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.readEikonaBatchMembers@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'readEikonaBatchMembers', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('EikonaBatchMembersQueryV1', eikonaBatchMembersQuerySchema) }],
      result: strict('EikonaBatchMembersResultV1', eikonaBatchMembersResultSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.readEikonaBatchPlan@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'readEikonaBatchPlan', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('EikonaBatchInputQueryV1', eikonaBatchInputQuerySchema) }],
      result: strict('EikonaBatchPlanResultV1', eikonaBatchPlanResultSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.readEikonaBatchInput@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'readEikonaBatchInput', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('EikonaBatchInputQueryV1', eikonaBatchInputQuerySchema) }],
      result: strict('EikonaBatchInputResultV1', eikonaBatchInputResultSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.readEikonaApprovalStatus@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'readEikonaApprovalStatus', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('EikonaStatusInputV1', eikonaStatusInputSchema) }],
      result: strict('EikonaStatusResultV1', eikonaStatusResultSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.revokeEikonaPreparationApproval@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'revokeEikonaPreparationApproval', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('EikonaRevokeInputV1', eikonaRevokeInputSchema) }],
      result: strict('EikonaRevokeResultV1', eikonaRevokeResultSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.approveEikonaPreparation@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'approveEikonaPreparation', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('EikonaApprovalInputV1', eikonaApprovalInputSchema) }],
      result: strict('EikonaApprovalResultV1', eikonaApprovalResultSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.prepareEikonaGeneration@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'prepareEikonaGeneration', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('EikonaPreparationInputV1', eikonaPreparationInputSchema) }],
      result: strict('EikonaPreparationResultV1', eikonaPreparationResultSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.readEikonaAssetPage@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'readEikonaAssetPage', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('EikonaAssetQueryV1', eikonaAssetQuerySchema) }],
      result: strict('EikonaAssetPageV1', eikonaAssetPageSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.listAuctraRecoveryDrafts@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'listAuctraRecoveryDrafts', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('EditorRecoveryQueryV1', editorRecoveryQuerySchema) }],
      result: strict('EditorRecoveryPageV1', editorRecoveryPageSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.readAuctraRecoveryDraft@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'readAuctraRecoveryDraft', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('EditorRecoverySummaryV1', editorRecoverySummarySchema) }],
      result: strict('EditorRecoveryReadV1', editorRecoveryReadSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.readTranscriptionCatalog@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'readTranscriptionCatalog', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('CreatorStudioContextV1', { parse(value) {
        const context = validateCreatorStudioContext(value)
        if (context === undefined) throw new TypeError('creatorStudio.readTranscriptionCatalog context mismatch')
        return context
      } }) }],
      result: strict('SonoraTranscriptionCatalog | null', { parse(value) {
        if (value === null) return null
        const catalog = validateSonoraTranscriptionCatalog(value)
        if (catalog === undefined) throw new TypeError('creatorStudio.readTranscriptionCatalog contract mismatch')
        return catalog
      } }),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.recallOperationIdentity@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'recallOperationIdentity',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('CreatorOperationIdentityQueryV1', { parse(value) {
        if (typeof value !== 'object' || value === null) throw new TypeError('creatorStudio.recallOperationIdentity query mismatch')
        const query = value as { owner?: unknown; actionId?: unknown; expectedTargetRef?: unknown }
        if (typeof query.owner !== 'string' || query.owner.length === 0 || query.owner.length > 64
          || typeof query.actionId !== 'string' || query.actionId.length === 0 || query.actionId.length > 160
          || typeof query.expectedTargetRef !== 'string' || query.expectedTargetRef.length === 0 || query.expectedTargetRef.length > 512
          || Object.keys(query).length !== 3) throw new TypeError('creatorStudio.recallOperationIdentity query mismatch')
        return { owner: query.owner, actionId: query.actionId, expectedTargetRef: query.expectedTargetRef }
      } }) }],
      result: strict('PaneActionReconcileRequestV1 | null', { parse(value) {
        if (value === null) return null
        return PaneActionReconcileRequestSchema.parse(value)
      } }),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.listOperationRecoveries@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'listOperationRecoveries', invocation: { kind: 'direct' }, parameters: [],
      result: strict('CreatorOperationRecoveryPageV1', creatorOperationRecoveryPageSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.reconcile@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'reconcile',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('PaneActionReconcileRequestV1', PaneActionReconcileRequestSchema) }],
      result: strict('PaneActionReceiptV1', PaneActionReceiptSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.selectScaenaPackage@1', service: 'creatorStudio', namespace: 'creatorStudio', method: 'selectScaenaPackage', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('ScaenaPackageQuery', scaenaPackageQuerySchema) }], result: strict('ScaenaPackageResult', scaenaPackageResultSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.readScaenaTable@1', service: 'creatorStudio', namespace: 'creatorStudio', method: 'readScaenaTable', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('ScaenaTableQuery', scaenaTableQuerySchema) }], result: strict('ScaenaTableResult', scaenaTableResultSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.snapshotOwner@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'snapshotOwner', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('CreatorStudioOwner', { parse(value) {
        if (typeof value !== 'string' || !['eikona', 'scaena', 'auctra', 'sonora', 'pinax', 'anatomia'].includes(value)) throw new TypeError('Invalid Creator Studio owner')
        return value
      } }) }],
      result: strict('CreatorOwnerViewSnapshotV1', { parse(value) {
        const snapshot = validateCreatorOwnerViewSnapshot(value)
        if (snapshot === undefined) throw new TypeError('Owner snapshot contract mismatch')
        return snapshot
      } }),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.snapshot@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'snapshot',
      invocation: { kind: 'direct' }, parameters: [],
      result: strict('CreatorStudioSnapshotV1', snapshotSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.dispatch@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'dispatch',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('PaneActionRequestV1', PaneActionRequestSchema) }],
      result: strict('PaneActionReceiptV1', PaneActionReceiptSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.resolveArtifact@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'resolveArtifact',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('ArtifactRefV1', ArtifactRefSchema) }],
      result: strict('CreatorMediaAccessV1 | null', mediaSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.readArtifactContent@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'readArtifactContent',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('ArtifactRefV1', ArtifactRefSchema) }],
      result: strict('CreatorArtifactContentV1 | null', contentSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.readCandidatePage@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'readCandidatePage',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('CreatorCandidateQueryV1', creatorCandidateQuerySchema) }],
      result: strict('CreatorCandidatePageV1', creatorCandidatePageSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.assets@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'assets',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('CreatorAssetQueryV1', assetQuerySchema) }],
      result: strict('CreatorAssetPageV1', assetPageSchema),
    },
    {
      id: '@yeisme/dsh-creator-studio-host/creatorStudio.decideApproval@1',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'decideApproval',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('CreatorApprovalDecisionV1', approvalDecisionSchema) }],
      result: strict('PaneActionReceiptV1', PaneActionReceiptSchema),
    },
  ],
} as const

function optionalLookup(ctx: ClientContext, name: string): Record<string, unknown> | undefined {
  try {
    const candidate = (ctx.get as unknown as (key: string) => unknown).call(ctx, name)
    return typeof candidate === 'object' && candidate !== null ? candidate as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

function isCreatorRemote(value: unknown): value is CreatorStudioRemote {
  return typeof value === 'object' && value !== null
    && typeof (value as CreatorStudioRemote).snapshot === 'function'
    && typeof (value as CreatorStudioRemote).dispatch === 'function'
    && typeof (value as CreatorStudioRemote).resolveArtifact === 'function'
}

export async function resolveCreatorStudioRemote(ctx: ClientContext): Promise<CreatorStudioRemote | undefined> {
  const direct = optionalLookup(ctx, 'remote.creatorStudio')
  if (isCreatorRemote(direct)) return direct
  const remote = optionalLookup(ctx, 'remote')
  if (isCreatorRemote(remote?.creatorStudio)) return remote.creatorStudio
  const mount = remote?.$mount
  if (typeof mount !== 'function') return undefined
  try {
    await (mount as (contribution: unknown) => Promise<unknown>).call(remote, creatorStudioRemoteContribution)
  } catch {
    return undefined
  }
  const mounted = optionalLookup(ctx, 'remote.creatorStudio')
  return isCreatorRemote(mounted) ? mounted : undefined
}
