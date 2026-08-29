import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import {
  ArtifactRefSchema,
  PaneActionReceiptSchema,
  PaneActionRequestSchema,
} from '@yeisme/dsh-pane-protocol'
import {
  validateCreatorMediaAccess,
  validateCreatorApprovalDecision,
  validateCreatorAssetPage,
  validateCreatorAssetQuery,
  validateCreatorStudioSnapshot,
} from '@yeisme/dsh-creator-studio-host/contracts'
import type { CreatorStudioRemote } from './controller.ts'

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
