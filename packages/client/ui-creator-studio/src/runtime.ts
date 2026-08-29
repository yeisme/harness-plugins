import type {
  ArtifactRefV1,
  PaneActionDescriptorV1,
  PaneActionReceiptV1,
  PaneActionValueV1,
} from '@yeisme/dsh-pane-protocol'
import type { CreatorAssetQueryV1 } from '@yeisme/dsh-creator-studio-host/contracts'
import { CreatorStudioController, type CreatorStudioViewState } from './controller.ts'

export type { CreatorStudioViewState } from './controller.ts'

export const CREATOR_STUDIO_RUNTIME_SCHEMA = 'creator.studio.runtime.v1alpha1' as const
export const CREATOR_STUDIO_RUNTIME_SERVICE = 'creatorStudioRuntime' as const

/**
 * Shared Creator Studio client application service.
 *
 * The service deliberately exposes state and owner operations without
 * exposing the concrete controller or ownership of its lifecycle. Consumers
 * subscribe to the provider-owned instance and must never dispose it.
 */
export interface CreatorStudioRuntimeV1 {
  readonly schemaVersion: typeof CREATOR_STUDIO_RUNTIME_SCHEMA
  readonly mode: 'shared'
  readonly canMutate: true
  getSnapshot(): CreatorStudioViewState
  subscribe(listener: () => void): () => void
  refresh(): Promise<void>
  loadAssets(query: CreatorAssetQueryV1, append?: boolean): Promise<void>
  resolveArtifact(artifact: ArtifactRefV1): Promise<string | undefined>
  dispatchAction(
    descriptor: PaneActionDescriptorV1,
    values: Readonly<Record<string, PaneActionValueV1>>,
  ): Promise<PaneActionReceiptV1>
  decideApproval(decisionRef: string): Promise<PaneActionReceiptV1>
}

/** Builds the single provider-owned runtime facade over a controller. */
export function createCreatorStudioRuntime(controller: CreatorStudioController): CreatorStudioRuntimeV1 {
  return Object.freeze({
    schemaVersion: CREATOR_STUDIO_RUNTIME_SCHEMA,
    mode: 'shared' as const,
    canMutate: true as const,
    getSnapshot: controller.store.getSnapshot,
    subscribe: controller.store.subscribe,
    refresh: () => controller.refresh(),
    loadAssets: (query: CreatorAssetQueryV1, append = false) => controller.loadAssets(query, append),
    resolveArtifact: (artifact: ArtifactRefV1) => controller.resolveArtifact(artifact),
    dispatchAction: (
      descriptor: PaneActionDescriptorV1,
      values: Readonly<Record<string, PaneActionValueV1>>,
    ) => controller.dispatchAction(descriptor, values),
    decideApproval: (decisionRef: string) => controller.decideApproval(decisionRef),
  })
}
