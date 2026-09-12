import { LocalStudioCLI } from '@yeisme/dsh-creator-studio-host'
/**
 * Single install surface for the DSH Creator Studio.
 *
 * This package composes safe owner projections and a browser Pane client. The
 * six domain owners retain canonical resources, actions, jobs, approvals, and
 * receipts; this bundle never creates a second ledger or scheduler.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ComposerReferenceOwnerRegistryV1 } from '@yeisme/dsh-desktop-workbench'
import { createCreatorReferenceOwner } from './reference-owner.js'
import {
  CREATOR_STUDIO_OWNER_DIRECTORY,
  CREATOR_STUDIO_EXPECTED_CONTEXT,
  CreatorStudioGateway,
  CreatorStudioOwnerDirectory,
  CREATOR_STUDIO_OWNERS,
  type CreatorOwnerAdapterV1,
  type CreatorStudioTransportPolicyV1,
} from '@yeisme/dsh-creator-studio-host'

export {
  EikonaDiscoveryClient,
  createEikonaDiscoveryAdapter,
  createEikonaReviewAdapter,
  createSelectableEikonaReviewAdapter,
  createEikonaStudioAdapter,
  SonoraSubtitleExportClient,
  createSonoraSubtitleExportAdapter,
  CREATOR_STUDIO_EXPECTED_CONTEXT,
  CREATOR_STUDIO_OWNER_DIRECTORY,
  CreatorStudioGateway,
  CreatorStudioOwnerDirectory,
  validateCreatorActionDescriptor,
  validateCreatorActionReceipt,
  validateCreatorApprovalDecision,
  validateCreatorAsset,
  validateCreatorAssetPage,
  validateCreatorAssetQuery,
  validateCreatorOwnerAssetList,
  validateCreatorMediaAccess,
  validateCreatorArtifactContent,
  validateCreatorArtifactImage,
  validateCreatorOwnerSnapshot,
  validateCreatorStudioContext,
  validateCreatorStudioSnapshot,
} from '@yeisme/dsh-creator-studio-host'
export type {
  EikonaDiscoveryConnection,
  EikonaReviewSelection,
  SonoraTranscriptionCatalog,
  SonoraSubtitleConnection,
  SonoraSubtitleExportInput,
  SonoraSubtitleExportResource,
  SonoraSubtitleExportResult,
  CreatorArtifactActionBindingV1,
  CreatorArtifactCandidateV1,
  CreatorArtifactContentV1,
  CreatorArtifactImageV1,
  CreatorArtifactLifecycleActionsV1,
  CreatorArtifactReferenceProofV1,
  CreatorArtifactWorkspaceItemV1,
  CreatorArtifactWorkspaceV1,
  CreatorApprovalDecisionV1,
  CreatorApprovalV1,
  CreatorAssetPageV1,
  CreatorAssetQueryV1,
  CreatorAssetScopeV1,
  CreatorAssetV1,
  CreatorGenerationRunV1,
  CreatorJobV1,
  CreatorMediaAccessV1,
  CreatorOperationsProjectionV1,
  CreatorOwnerAdapterV1,
  CreatorOwnerAssetQueryV1,
  CreatorOwnerAssetListV1,
  CreatorOwnerProjectionV1,
  CreatorOwnerSnapshotV1,
  CreatorProductionV1,
  CreatorResourceV1,
  CreatorReviewV1,
  CreatorStudioContextV1,
  CreatorStudioOwner,
  CreatorStudioSnapshotV1,
  CreatorStudioTask,
  CreatorStudioTransportPolicyV1,
} from '@yeisme/dsh-creator-studio-host'

type FiberHandle = { dispose(): Promise<void> }

interface TypertRegistryFace {
  register(contribution: typeof creatorStudioTypertContribution): (() => void | Promise<void>) | undefined
}

const creatorStudioTypertContribution = {
  package: '@yeisme/dsh-creator-studio-host',
  face: 'host',
  schemas: [],
  model: {
    services: [{
      key: 'creatorStudio',
      exportName: 'CreatorStudioGateway',
      summary: 'Safe Creator Studio owner projection and action gateway.',
      tags: [],
      members: [
        { kind: 'method', name: 'snapshotOwner', signature: 'snapshotOwner(owner: CreatorStudioOwner): Promise<CreatorStudioSnapshotV1>' },
        { kind: 'method', name: 'selectScaenaPackage', signature: 'selectScaenaPackage(input: ScaenaPackageQuery): Promise<ScaenaPackageResult>' },
        { kind: 'method', name: 'readScaenaTable', signature: 'readScaenaTable(input: ScaenaTableQuery): Promise<ScaenaTableResult>' },
        { kind: 'method', name: 'snapshot', signature: 'snapshot(): Promise<CreatorStudioSnapshotV1>' },
        { kind: 'method', name: 'reconcile', signature: 'reconcile(input: unknown): Promise<PaneActionReceiptV1>' },
        { kind: 'method', name: 'recallOperationIdentity', signature: 'recallOperationIdentity(input: unknown): Promise<PaneActionReconcileRequestV1 | null>' },
        { kind: 'method', name: 'listOperationRecoveries', signature: 'listOperationRecoveries(): Promise<CreatorOperationRecoveryPageV1>' },
        { kind: 'method', name: 'dispatch', signature: 'dispatch(input: unknown): Promise<PaneActionReceiptV1>' },
        { kind: 'method', name: 'resolveArtifact', signature: 'resolveArtifact(input: unknown): Promise<CreatorMediaAccessV1 | null>' },
        { kind: 'method', name: 'readArtifactContent', signature: 'readArtifactContent(input: unknown): Promise<CreatorArtifactContentV1 | null>' },
        { kind: 'method', name: 'readTranscriptionCatalog', signature: 'readTranscriptionCatalog(input?: unknown): Promise<SonoraTranscriptionCatalog | null>' },
        { kind: 'method', name: 'assets', signature: 'assets(input: unknown): Promise<CreatorAssetPageV1>' },
        { kind: 'method', name: 'decideApproval', signature: 'decideApproval(input: unknown): Promise<PaneActionReceiptV1>' },
        { kind: 'method', name: 'canvasRead', signature: 'canvasRead(input: unknown): Promise<ProjectCanvasReadResult>' },
        { kind: 'method', name: 'canvasSave', signature: 'canvasSave(input: unknown): Promise<ProjectCanvasSaveResult>' },
        { kind: 'method', name: 'canvasReconcile', signature: 'canvasReconcile(input: unknown): Promise<ProjectCanvasSaveResult>' },
      ],
      types: [],
    }],
    events: [],
    objects: [],
  },
  invocations: [
    { id: '@yeisme/dsh-creator-studio-host#creatorStudio/selectScaenaPackage', service: 'creatorStudio', namespace: 'creatorStudio', method: 'selectScaenaPackage', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }], result: { mode: 'src-json' } },
    { id: '@yeisme/dsh-creator-studio-host#creatorStudio/readScaenaTable', service: 'creatorStudio', namespace: 'creatorStudio', method: 'readScaenaTable', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }], result: { mode: 'src-json' } },
    {
      id: '@yeisme/dsh-creator-studio-host#creatorStudio/snapshotOwner',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'snapshotOwner', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }], result: { mode: 'src-json' },
    },
    {
      id: '@yeisme/dsh-creator-studio-host#creatorStudio/selectEikonaCandidate',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'selectEikonaCandidate', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }], result: { mode: 'src-json' },
    },
    {
      id: '@yeisme/dsh-creator-studio-host#creatorStudio/readEikonaCandidateImage',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'readEikonaCandidateImage', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }], result: { mode: 'src-json' },
    },
    {
      id: '@yeisme/dsh-creator-studio-host#creatorStudio/readEikonaReview',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'readEikonaReview',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }],
      result: { mode: 'src-json' },
    },
    {
      id: '@yeisme/dsh-creator-studio-host#creatorStudio/readEikonaAssetPage',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'readEikonaAssetPage',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }],
      result: { mode: 'src-json' },
    },
    { id: '@yeisme/dsh-creator-studio-host#creatorStudio/readTranscriptionCatalog', service: 'creatorStudio', namespace: 'creatorStudio', method: 'readTranscriptionCatalog',
      invocation: { kind: 'direct' }, parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }], result: { mode: 'src-json' } },
    { id: '@yeisme/dsh-creator-studio-host#creatorStudio/listEikonaBatchInputs', service: 'creatorStudio', namespace: 'creatorStudio', method: 'listEikonaBatchInputs',
      invocation: { kind: 'direct' }, parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }], result: { mode: 'src-json' } },
    { id: '@yeisme/dsh-creator-studio-host#creatorStudio/readEikonaBatchMembers', service: 'creatorStudio', namespace: 'creatorStudio', method: 'readEikonaBatchMembers',
      invocation: { kind: 'direct' }, parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }], result: { mode: 'src-json' } },
    { id: '@yeisme/dsh-creator-studio-host#creatorStudio/readEikonaBatchPlan', service: 'creatorStudio', namespace: 'creatorStudio', method: 'readEikonaBatchPlan',
      invocation: { kind: 'direct' }, parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }], result: { mode: 'src-json' } },
    { id: '@yeisme/dsh-creator-studio-host#creatorStudio/readEikonaBatchInput', service: 'creatorStudio', namespace: 'creatorStudio', method: 'readEikonaBatchInput',
      invocation: { kind: 'direct' }, parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }], result: { mode: 'src-json' } },
    { id: '@yeisme/dsh-creator-studio-host#creatorStudio/readEikonaApprovalStatus', service: 'creatorStudio', namespace: 'creatorStudio', method: 'readEikonaApprovalStatus',
      invocation: { kind: 'direct' }, parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }], result: { mode: 'src-json' } },
    { id: '@yeisme/dsh-creator-studio-host#creatorStudio/revokeEikonaPreparationApproval', service: 'creatorStudio', namespace: 'creatorStudio', method: 'revokeEikonaPreparationApproval',
      invocation: { kind: 'direct' }, parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }], result: { mode: 'src-json' } },
    { id: '@yeisme/dsh-creator-studio-host#creatorStudio/approveEikonaPreparation', service: 'creatorStudio', namespace: 'creatorStudio', method: 'approveEikonaPreparation',
      invocation: { kind: 'direct' }, parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }], result: { mode: 'src-json' } },
    { id: '@yeisme/dsh-creator-studio-host#creatorStudio/prepareEikonaGeneration', service: 'creatorStudio', namespace: 'creatorStudio', method: 'prepareEikonaGeneration',
      invocation: { kind: 'direct' }, parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }], result: { mode: 'src-json' } },
    ...(['readEikonaDraft', 'saveEikonaDraft', 'reconcileEikonaDraft', 'canvasRead', 'canvasSave', 'canvasReconcile', 'reconcile', 'recallOperationIdentity'] as const).map(method => ({
      id: `@yeisme/dsh-creator-studio-host#creatorStudio/${method}`,
      service: 'creatorStudio', namespace: 'creatorStudio', method,
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }],
      result: { mode: 'src-json' },
    })),
    {
      id: '@yeisme/dsh-creator-studio-host#creatorStudio/listOperationRecoveries',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'listOperationRecoveries',
      invocation: { kind: 'direct' }, parameters: [], result: { mode: 'src-json' },
    },
    {
      id: '@yeisme/dsh-creator-studio-host#creatorStudio/snapshot',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'snapshot',
      invocation: { kind: 'direct' }, parameters: [], result: { mode: 'src-json' },
    },
    {
      id: '@yeisme/dsh-creator-studio-host#creatorStudio/dispatch',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'dispatch',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }],
      result: { mode: 'src-json' },
    },
    {
      id: '@yeisme/dsh-creator-studio-host#creatorStudio/resolveArtifact',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'resolveArtifact',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }],
      result: { mode: 'src-json' },
    },
    {
      id: '@yeisme/dsh-creator-studio-host#creatorStudio/readArtifactContent',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'readArtifactContent',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }],
      result: { mode: 'src-json' },
    },
    {
      id: '@yeisme/dsh-creator-studio-host#creatorStudio/assets',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'assets',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }],
      result: { mode: 'src-json' },
    },
    {
      id: '@yeisme/dsh-creator-studio-host#creatorStudio/decideApproval',
      service: 'creatorStudio', namespace: 'creatorStudio', method: 'decideApproval',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }],
      result: { mode: 'src-json' },
    },
  ],
} as const

type SharedCreatorStudioMount = {
  referenceOwnerMount?: FiberHandle | undefined
  revokeReferenceOwners?: (() => void) | undefined
  references: number
  tail: Promise<void>
  bridge?: FiberHandle | undefined
  localMount?: FiberHandle | undefined
  directory?: CreatorStudioOwnerDirectory | undefined
  disposeDirectory?: (() => void) | undefined
  unregisterTypert?: (() => void | Promise<void>) | undefined
}

const CREATOR_STUDIO_MOUNTS = Symbol.for('yeisme.dsh-creator-studio.host-mounts.v1')
const CREATOR_STUDIO_TRANSPORT_POLICY = 'creatorStudioTransportPolicy'

function mounts(): WeakMap<object, SharedCreatorStudioMount> {
  const store = globalThis as typeof globalThis & Record<symbol, unknown>
  const existing = store[CREATOR_STUDIO_MOUNTS]
  if (existing instanceof WeakMap) return existing as WeakMap<object, SharedCreatorStudioMount>
  const created = new WeakMap<object, SharedCreatorStudioMount>()
  store[CREATOR_STUDIO_MOUNTS] = created
  return created
}

function isTransportPreference(value: unknown): value is 'auto' | 'local' | 'service' {
  return value === 'auto' || value === 'local' || value === 'service'
}

function transportPolicyOf(root: Context): CreatorStudioTransportPolicyV1 {
  const candidate = root.get(CREATOR_STUDIO_TRANSPORT_POLICY) as Partial<CreatorStudioTransportPolicyV1> | undefined
  if (candidate === undefined || !isTransportPreference(candidate.default)) return { default: 'auto' }
  const owners = candidate.owners
  if (owners !== undefined && Object.values(owners).some(value => value !== undefined && !isTransportPreference(value))) return { default: 'auto' }
  return { default: candidate.default, ...(owners === undefined ? {} : { owners }) }
}

function directoryOf(root: Context): CreatorStudioOwnerDirectory | undefined {
  const candidate = root.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
  if (candidate === undefined) return undefined
  if (typeof candidate.register !== 'function' || typeof candidate.selected !== 'function') {
    throw new TypeError('creatorStudioOwnerDirectory does not implement the Creator Studio directory contract')
  }
  return candidate
}

async function acquireCreatorStudio(ctx: Context): Promise<() => Promise<void>> {
  const root = ctx.root
  const store = mounts()
  let mount = store.get(root)
  if (mount === undefined) {
    mount = { references: 0, tail: Promise.resolve() }
    store.set(root, mount)
  }
  mount.references += 1
  const current = mount
  const setup = current.tail.then(async () => {
    if (current.directory === undefined) {
      const existing = directoryOf(root)
      if (existing !== undefined) current.directory = existing
      else {
        const directory = new CreatorStudioOwnerDirectory(transportPolicyOf(root))
        current.directory = directory
        current.disposeDirectory = root.provide(CREATOR_STUDIO_OWNER_DIRECTORY, directory)
      }
    }
    if (current.bridge === undefined && root.get('creatorStudio') === undefined) {
      // Keep discovery and context-unavailable responses available before project binding.
      // Every request obtains its authorized context from the host and rechecks it after I/O.
      current.bridge = root.inject([], async (scope: Context) => {
        const gateway = await scope.plugin(CreatorStudioGateway)
        return () => gateway.dispose()
      })
    }
    if (current.localMount === undefined) {
      current.localMount = root.inject(['workspaceRegistry'] as never, async (scope: Context) => {
        // Explicit service integrations keep their existing authenticated context.
        if (root.get(CREATOR_STUDIO_EXPECTED_CONTEXT) !== undefined) return
        let local: LocalStudioCLI
        try { local = await LocalStudioCLI.open() } catch { return }
        if (root.get(CREATOR_STUDIO_EXPECTED_CONTEXT) !== undefined) return
        const releaseContext = scope.provide(CREATOR_STUDIO_EXPECTED_CONTEXT, local.context)
        const releases: Array<() => void> = []
        try {
          for (const owner of ['eikona', 'scaena'] as const) {
            if (current.directory?.selected(owner) === undefined) releases.push(current.directory!.register(local.adapter(owner)))
          }
        } catch (error) { releases.reverse().forEach(release => release()); releaseContext(); throw error }
        return () => { releases.reverse().forEach(release => release()); releaseContext() }
      })
    }
    if (current.referenceOwnerMount === undefined) {
      current.referenceOwnerMount = root.inject(['composerReferenceOwners', 'creatorStudio', 'workspaceRegistry'] as never, (scope: Context) => {
        const registry = scope.get('composerReferenceOwners' as never) as ComposerReferenceOwnerRegistryV1 | undefined
        const gateway = scope.get('creatorStudio') as CreatorStudioGateway | undefined
        if (registry?.version !== 1 || typeof registry.register !== 'function' || gateway === undefined) return
        const workspaceForSession = (sessionId: string): string | undefined => {
          const workspaces = scope.get('workspaceRegistry' as never) as { list(): readonly { id: string; sessionIds: readonly string[] }[] } | undefined
          return workspaces?.list().find(workspace => workspace.sessionIds.includes(sessionId))?.id
        }
        const disposers: Array<() => void> = []
        let active = true
        const revokeAll = (): void => {
          active = false
          const errors: unknown[] = []
          for (const dispose of disposers.splice(0).reverse()) {
            try { dispose() } catch (error) { errors.push(error) }
          }
          if (errors.length > 0) throw new AggregateError(errors, 'Creator reference provider cleanup failed')
        }
        current.revokeReferenceOwners = revokeAll
        try {
          // Cordis returns context-bound proxies, so object identity is not a
          // service generation token. The injected lifecycles revoke this
          // closure before either registry or Gateway is replaced.
          for (const owner of CREATOR_STUDIO_OWNERS) disposers.push(registry.register(owner, createCreatorReferenceOwner(gateway, owner, workspaceForSession, () => active)))
        } catch (error) {
          try { revokeAll() } catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Creator reference registration failed') }
          throw error
        }
        return () => {
          try { revokeAll() } finally {
            if (current.revokeReferenceOwners === revokeAll) current.revokeReferenceOwners = undefined
          }
        }
      })
    }
    if (current.unregisterTypert === undefined) {
      current.unregisterTypert = (root.get('typert') as TypertRegistryFace | undefined)?.register(creatorStudioTypertContribution)
    }
  })
  current.tail = setup.catch(() => undefined)
  try {
    await setup
  } catch (error) {
    await releaseCreatorStudio(root, current)
    throw error
  }
  let released = false
  return async () => {
    if (released) return
    released = true
    await releaseCreatorStudio(root, current)
  }
}

async function releaseCreatorStudio(root: Context, mount: SharedCreatorStudioMount): Promise<void> {
  if (mount.references > 0) mount.references -= 1
  if (mount.references !== 0) return
  const teardown = mount.tail.then(async () => {
    const localMount = mount.localMount
    mount.localMount = undefined
    const bridge = mount.bridge
    const disposeDirectory = mount.disposeDirectory
    const unregisterTypert = mount.unregisterTypert
    const referenceOwnerMount = mount.referenceOwnerMount
    const revokeReferenceOwners = mount.revokeReferenceOwners
    mount.revokeReferenceOwners = undefined
    mount.referenceOwnerMount = undefined
    mount.bridge = undefined
    mount.directory = undefined
    mount.disposeDirectory = undefined
    mount.unregisterTypert = undefined
    const errors: unknown[] = []
    // Revoke body access first; still attempt every cleanup if one fails.
    for (const cleanup of [() => revokeReferenceOwners?.(), () => referenceOwnerMount?.dispose(), () => unregisterTypert?.(), () => localMount?.dispose(), () => bridge?.dispose(), () => disposeDirectory?.()]) {
      try { await cleanup() } catch (error) { errors.push(error) }
    }
    const store = mounts()
    if (mount.references === 0 && store.get(root) === mount) store.delete(root)
    if (errors.length > 0) throw new AggregateError(errors, 'Creator Studio cleanup failed')
  })
  mount.tail = teardown.catch(() => undefined)
  await teardown
}

/** Register a local or service owner adapter after this bundle has mounted. */
export function registerCreatorStudioOwner(ctx: Context, adapter: CreatorOwnerAdapterV1): () => void {
  const directory = directoryOf(ctx.root)
  if (directory === undefined) throw new Error('Creator Studio is not mounted; install the bundle before registering an owner adapter')
  return directory.register(adapter)
}

export const creatorStudioBundleV1 = {
  id: 'dsh-creator-studio',
  version: '0.1.0-rc.1',
  owners: ['eikona', 'scaena', 'sonora', 'auctra', 'pinax', 'anatomia'],
  tasks: ['text', 'image', 'audio', 'video', 'review', 'analysis', 'context', 'operations', 'assets', 'generation', 'approval'],
} as const

export type CreatorStudioBundleV1 = typeof creatorStudioBundleV1

export const name = 'dsh-creator-studio'
export const inject = ['typert'] as const

export async function apply(ctx: Context): Promise<() => Promise<void>> {
  return acquireCreatorStudio(ctx)
}

const CreatorStudioPlugin = { name, inject, apply }
export default CreatorStudioPlugin
