import type { ExplorerTreeNodeV1 } from './tree-state.js'

export interface ExplorerMetadataV1 {
  readonly ref: string
  readonly version: string
  readonly state: 'ready' | 'partial' | 'unsupported' | 'stale'
  readonly label: string
  readonly detail?: string
  readonly sensitive?: boolean
}

export interface ExplorerRuntimeV2 {
  readonly workspaceRef?: string
  getRootRef?(): string | undefined
  roots(): Promise<readonly ExplorerTreeNodeV1[]>
  listChildren(ref: string): Promise<readonly ExplorerTreeNodeV1[]>
  search?(query: string): Promise<readonly ExplorerTreeNodeV1[]>
  inspectMetadata?(node: ExplorerTreeNodeV1): Promise<ExplorerMetadataV1>
  revealSensitive?(node: ExplorerTreeNodeV1): Promise<{ readonly ok: boolean; readonly reason?: string }>
  openResource(node: ExplorerTreeNodeV1, mode: 'preview' | 'pin'): Promise<{ readonly ok: boolean; readonly reason?: string }> | { readonly ok: boolean; readonly reason?: string }
  readonly mutation?: ExplorerResourceMutationRuntimeV1
  readonly transfer?: ExplorerTransferRuntimeV1
}

export interface ExplorerMutationProposalV1 {
  readonly proposalRef: string
  readonly action: 'create-file' | 'create-directory' | 'rename' | 'move' | 'copy' | 'trash' | 'restore' | 'import-commit'
  readonly summary: string
  readonly risks: readonly string[]
  readonly conflicts: readonly string[]
  readonly reversible: boolean
  readonly expiresAt: string
  readonly execute: (choice?: 'cancel' | 'keep-both' | 'replace') => Promise<{ readonly ok: boolean; readonly reason?: string; readonly undo?: () => Promise<{ readonly ok: boolean; readonly reason?: string }> }>
}

export interface ExplorerResourceMutationRuntimeV1 {
  readonly enabled: boolean
  readonly disabledReason?: string | undefined
  propose(input: { readonly action: ExplorerMutationProposalV1['action']; readonly targetRefs?: readonly string[]; readonly destinationRef?: string; readonly name?: string; readonly importRef?: string; readonly undoRef?: string }): Promise<ExplorerMutationProposalV1>
}

export interface ExplorerTransferRuntimeV1 {
  readonly enabled: boolean
  readonly disabledReason?: string | undefined
  importFile(file: File): Promise<{ readonly importRef: string; readonly name: string; readonly size: number }>
  download(ref: string, version: string): Promise<Uint8Array>
}

let activeRuntime: ExplorerRuntimeV2 | undefined
const listeners = new Set<() => void>()

export function getExplorerRuntime(): ExplorerRuntimeV2 | undefined {
  return activeRuntime
}

export function subscribeExplorerRuntime(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function bindExplorerRuntime(runtime: ExplorerRuntimeV2): () => void {
  activeRuntime = runtime
  for (const listener of listeners) listener()
  return () => {
    if (activeRuntime !== runtime) return
    activeRuntime = undefined
    for (const listener of listeners) listener()
  }
}
