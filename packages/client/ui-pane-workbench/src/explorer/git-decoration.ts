import type { ExplorerTreeNodeV1, ExplorerTreeStateV1 } from './tree-state.js'

export type ExplorerGitDecorationKindV1 =
  | 'conflict'
  | 'staged'
  | 'modified'
  | 'untracked'
  | 'ignored'
  | 'renamed'

export type ExplorerGitDecorationFreshnessV1 = 'fresh' | 'stale' | 'offline' | 'unknown'

export interface ExplorerGitDecorationV1 {
  readonly fileRef: string
  readonly repositoryRef: string
  readonly worktreeRef: string
  readonly revision: string
  readonly kind: ExplorerGitDecorationKindV1
  readonly freshness: ExplorerGitDecorationFreshnessV1
}

export interface ExplorerGitCompositionV1 {
  readonly decorations: Readonly<Record<string, ExplorerGitDecorationV1>>
  readonly freshness: ExplorerGitDecorationFreshnessV1
  readonly mutationDisabled: boolean
  readonly mutationReason?: string
}

export function createExplorerGitComposition(
  items: readonly ExplorerGitDecorationV1[],
  freshness: ExplorerGitDecorationFreshnessV1,
): ExplorerGitCompositionV1 {
  const decorations: Record<string, ExplorerGitDecorationV1> = {}
  for (const item of items) decorations[item.fileRef] = item
  const offline = freshness === 'offline' || freshness === 'stale'
  return {
    decorations,
    freshness,
    mutationDisabled: offline || freshness === 'unknown',
    mutationReason: freshness === 'offline'
      ? 'Git decoration is offline'
      : freshness === 'stale'
        ? 'Git decoration is stale'
        : freshness === 'unknown'
          ? 'Git decoration is unknown'
          : undefined,
  }
}

export function composeExplorerGitDecoration(
  node: ExplorerTreeNodeV1,
  composition: ExplorerGitCompositionV1 | undefined,
): ExplorerTreeNodeV1 {
  if (composition === undefined) return node
  const decoration = composition.decorations[node.ref]
  if (decoration === undefined) return node
  return { ...node, gitDecoration: decoration.kind }
}

export function explorerTreeBlockedByGit(composition: ExplorerGitCompositionV1 | undefined): false {
  void composition
  return false
}

export function applyGitCompositionToTree(
  state: ExplorerTreeStateV1,
  composition: ExplorerGitCompositionV1 | undefined,
): ExplorerTreeStateV1 {
  if (composition === undefined) return state
  const nodes: Record<string, ExplorerTreeNodeV1> = {}
  for (const [ref, node] of Object.entries(state.nodes)) {
    nodes[ref] = composeExplorerGitDecoration(node, composition)
  }
  return { ...state, nodes }
}
